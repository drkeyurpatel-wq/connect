import { createServiceClient } from '@/lib/supabase/service';
import { callAnthropic, parseJson } from '../anthropic';
import { getPrompt } from '../prompts';
import { redact } from '../redact';

interface Recommendation {
  action_code: string;
  action_label: string;
  rationale: string;
  confidence: number;
  urgency: 'low' | 'normal' | 'high' | 'now';
}

const VALID_URGENCY = new Set(['low', 'normal', 'high', 'now']);

/**
 * Build the next-best-action cache entry for a single lead.
 * Silently no-ops if the lead is already in a terminal/won/lost stage.
 */
export async function generateRecommendationForLead(leadId: string): Promise<{
  ok: boolean;
  reason?: string;
  recId?: string;
}> {
  const svc = createServiceClient();

  const { data: lead } = await svc
    .from('leads')
    .select(
      'id, first_name, last_name, priority, stage_id, assigned_agent_id, centre_interest_id, specialty_interest_id, chief_complaint, created_at, updated_at',
    )
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return { ok: false, reason: 'not_found' };

  const { data: stage } = await svc
    .from('lead_stages')
    .select('code, is_terminal, is_won, is_lost')
    .eq('id', lead.stage_id)
    .maybeSingle();
  if (stage?.is_terminal) return { ok: false, reason: 'terminal_stage' };

  const [{ data: activities }, { data: score }, { data: waMessages }] = await Promise.all([
    svc
      .from('lead_activities')
      .select('activity_type, content, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10),
    svc
      .from('lead_scores')
      .select('p2c, pltv, feature_contributions')
      .eq('lead_id', leadId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc
      .from('whatsapp_messages')
      .select('direction, created_at, status')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const knownNames = [lead.first_name, lead.last_name].filter(Boolean) as string[];
  const profile = {
    stage: stage?.code,
    priority: lead.priority,
    centre_interest_id: lead.centre_interest_id,
    specialty_interest_id: lead.specialty_interest_id,
    assigned: Boolean(lead.assigned_agent_id),
    days_since_created: daysSince(lead.created_at),
    chief_complaint_redacted: lead.chief_complaint
      ? redact(lead.chief_complaint, knownNames).text
      : null,
    whatsapp_summary: summariseWhatsapp(waMessages ?? []),
  };

  const redactedActivities = (activities ?? []).map((a) => ({
    type: a.activity_type,
    when: a.created_at,
    snippet: a.content ? redact(a.content, knownNames).text.slice(0, 240) : null,
  }));

  const prompt = getPrompt('best_next_action', 1);
  const userText = prompt.user({
    profile,
    activities: redactedActivities,
    score: score ?? null,
  });

  const resp = await callAnthropic({
    purpose: prompt.purpose,
    promptCode: prompt.code,
    promptVersion: prompt.version,
    model: prompt.model,
    system: prompt.system,
    user: userText,
    maxTokens: 400,
    temperature: 0.1,
    subjectTable: 'leads',
    subjectId: leadId,
  });

  if (!resp.ok || !resp.text) return { ok: false, reason: resp.reason ?? 'llm_failed' };
  const parsed = parseJson<Recommendation>(resp.text);
  if (!parsed) return { ok: false, reason: 'unparseable_llm_response' };
  if (!VALID_URGENCY.has(parsed.urgency)) parsed.urgency = 'normal';
  const confidence = clamp(parsed.confidence ?? 0.5, 0, 1);

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: inserted, error } = await svc
    .from('agent_recommendations')
    .insert({
      lead_id: leadId,
      agent_id: lead.assigned_agent_id,
      action_code: String(parsed.action_code).slice(0, 80),
      action_label: String(parsed.action_label).slice(0, 160),
      rationale: String(parsed.rationale).slice(0, 400),
      confidence,
      urgency: parsed.urgency,
      status: 'pending',
      generated_by_prompt: `${prompt.code}:${prompt.version}`,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) return { ok: false, reason: error.message };
  return { ok: true, recId: inserted.id };
}

function summariseWhatsapp(msgs: { direction: 'in' | 'out'; created_at: string; status: string | null }[]) {
  if (msgs.length === 0) return 'none';
  const inbound = msgs.filter((m) => m.direction === 'in');
  const outbound = msgs.filter((m) => m.direction === 'out');
  const lastIn = inbound[0]?.created_at;
  const lastOut = outbound[0]?.created_at;
  return { inbound_count: inbound.length, outbound_count: outbound.length, last_in: lastIn, last_out: lastOut };
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Pick leads whose cached recommendation has expired or who have no active one.
 */
export async function pickLeadsNeedingRecommendation(limit = 50): Promise<string[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('leads')
    .select('id, updated_at, stage_id, lead_stages!inner(is_terminal), agent_recommendations(expires_at, status)')
    .is('deleted_at', null)
    .eq('lead_stages.is_terminal', false)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (!data) return [];
  const now = Date.now();
  return data
    .filter((row) => {
      const recs = (row as unknown as {
        agent_recommendations: { expires_at: string; status: string }[];
      }).agent_recommendations ?? [];
      if (recs.length === 0) return true;
      const active = recs.find((r) => new Date(r.expires_at).getTime() > now && r.status !== 'rejected');
      return !active;
    })
    .map((r) => r.id);
}
