import { createServiceClient } from '@/lib/supabase/service';
import { extractFeatures, estimatePltv, toProbability } from './features';

/**
 * Compute + persist P2C and PLTV for a batch of leads using the currently
 * active rules-v1 model. Returns the number of leads scored.
 */
export async function scoreLeads(leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  const svc = createServiceClient();

  const { data: model } = await svc
    .from('lead_score_models')
    .select('id, feature_weights')
    .eq('active', true)
    .eq('approach', 'rules_v1')
    .maybeSingle();
  if (!model) throw new Error('no_active_scoring_model');

  const { data: leads } = await svc
    .from('leads')
    .select('id, source_id, priority, email, chief_complaint, centre_interest_id, specialty_interest_id, created_at')
    .in('id', leadIds)
    .is('deleted_at', null);
  if (!leads || leads.length === 0) return 0;

  const sourceIds = Array.from(new Set(leads.map((l) => l.source_id).filter(Boolean))) as string[];
  const specialtyIds = Array.from(new Set(leads.map((l) => l.specialty_interest_id).filter(Boolean))) as string[];

  const [{ data: sources }, { data: specialties }, { data: waRows }] = await Promise.all([
    sourceIds.length
      ? svc.from('lead_sources').select('id, code').in('id', sourceIds)
      : Promise.resolve({ data: [] as { id: string; code: string }[] }),
    specialtyIds.length
      ? svc.from('specialties').select('id, code').in('id', specialtyIds)
      : Promise.resolve({ data: [] as { id: string; code: string }[] }),
    svc
      .from('whatsapp_messages')
      .select('lead_id, direction, created_at')
      .in('lead_id', leads.map((l) => l.id)),
  ]);

  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]));
  const specialtyById = new Map((specialties ?? []).map((s) => [s.id, s]));
  const waByLead = new Map<string, { direction: 'in' | 'out'; created_at: string }[]>();
  for (const m of waRows ?? []) {
    const arr = waByLead.get(m.lead_id) ?? [];
    arr.push({ direction: m.direction, created_at: m.created_at });
    waByLead.set(m.lead_id, arr);
  }

  const weights = (model.feature_weights ?? {}) as Record<string, number>;
  const rows = leads.map((lead) => {
    const features = extractFeatures({
      lead,
      source: sourceById.get(lead.source_id) ?? null,
      whatsappMessages: waByLead.get(lead.id) ?? [],
      weights,
    });
    const p2c = toProbability(features.sum);
    const specialtyCode = lead.specialty_interest_id
      ? specialtyById.get(lead.specialty_interest_id)?.code ?? null
      : null;
    const pltv = estimatePltv(p2c, specialtyCode);
    return {
      lead_id: lead.id,
      model_id: model.id,
      p2c,
      pltv,
      feature_contributions: features.contributions,
      computed_at: new Date().toISOString(),
    };
  });

  const { error } = await svc
    .from('lead_scores')
    .upsert(rows, { onConflict: 'lead_id,model_id' });
  if (error) throw new Error(`score_upsert_failed: ${error.message}`);

  return rows.length;
}

/**
 * Pick leads that need a fresh score: no row in lead_scores, or score older
 * than the lead's last update.
 */
export async function pickLeadsNeedingScore(limit = 200): Promise<string[]> {
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data } = await svc
    .from('leads')
    .select('id, updated_at, lead_scores:lead_scores(computed_at)')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (!data) return [];
  return data
    .filter((row) => {
      const latest = (row as unknown as { lead_scores: { computed_at: string }[] }).lead_scores
        ?.map((s) => s.computed_at)
        .sort()
        .pop();
      if (!latest) return true;
      if (latest < cutoff) return true;
      return latest < row.updated_at;
    })
    .map((r) => r.id);
}
