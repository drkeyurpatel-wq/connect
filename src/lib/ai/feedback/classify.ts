import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { callAnthropic, parseJson } from '../anthropic';
import { getPrompt } from '../prompts';
import { redact } from '../redact';

const TOPICS = new Set([
  'clinical',
  'billing',
  'staff',
  'food',
  'facility',
  'waiting',
  'communication',
  'other',
]);
const SEVERITIES = new Set(['info', 'minor', 'major', 'critical']);
const OWNERS = new Set(['clinical_team', 'centre_manager', 'cx_team', 'admin', 'none']);

interface LlmFeedback {
  topic: string;
  sub_topic?: string;
  sentiment: number;
  severity: string;
  suggested_owner: string;
  summary?: string;
}

export interface ClassifyParams {
  source: 'nps_open_text' | 'complaint' | 'review' | 'whatsapp_reply' | 'email' | 'other';
  sourceId?: string;
  leadId?: string;
  centreId?: string;
  text: string;
  knownNames?: string[];
}

export async function classifyFeedback(params: ClassifyParams): Promise<{
  ok: boolean;
  reason?: string;
  classificationId?: string;
}> {
  const svc = createServiceClient();
  const hash = createHash('sha256').update(params.text).digest('hex');

  const { data: existing } = await svc
    .from('feedback_classifications')
    .select('id')
    .eq('original_text_hash', hash)
    .maybeSingle();
  if (existing) return { ok: true, classificationId: existing.id };

  const { text: redactedText } = redact(params.text, params.knownNames ?? []);
  const prompt = getPrompt('feedback_classify', 1);
  const resp = await callAnthropic({
    purpose: prompt.purpose,
    promptCode: prompt.code,
    promptVersion: prompt.version,
    model: prompt.model,
    system: prompt.system,
    user: prompt.user({ source: params.source, text: redactedText }),
    maxTokens: 300,
    temperature: 0,
    subjectTable: 'feedback',
    subjectId: params.sourceId,
  });
  if (!resp.ok || !resp.text) return { ok: false, reason: resp.reason ?? 'llm_failed' };

  const parsed = parseJson<LlmFeedback>(resp.text);
  if (!parsed) return { ok: false, reason: 'unparseable_llm_response' };

  const topic = TOPICS.has(parsed.topic) ? parsed.topic : 'other';
  const severity = SEVERITIES.has(parsed.severity) ? parsed.severity : 'info';
  const owner = OWNERS.has(parsed.suggested_owner) ? parsed.suggested_owner : 'cx_team';
  const sentiment = Math.max(-1, Math.min(1, Number(parsed.sentiment) || 0));

  const { data: inserted, error } = await svc
    .from('feedback_classifications')
    .insert({
      source: params.source,
      source_id: params.sourceId,
      lead_id: params.leadId,
      centre_id: params.centreId,
      topic,
      sub_topic: parsed.sub_topic ? String(parsed.sub_topic).slice(0, 120) : null,
      sentiment,
      severity,
      suggested_owner: owner,
      original_text_hash: hash,
      classified_by_prompt: `${prompt.code}:${prompt.version}`,
      prompt_version: prompt.version,
    })
    .select('id')
    .single();

  if (error) return { ok: false, reason: error.message };
  return { ok: true, classificationId: inserted.id };
}
