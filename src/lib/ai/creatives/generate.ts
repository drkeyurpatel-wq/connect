import { createServiceClient } from '@/lib/supabase/service';
import { callAnthropic, parseJson } from '../anthropic';
import { getPrompt } from '../prompts';

const FORBIDDEN_PATTERNS = [
  /\bguarantee(d|s)?\b/i,
  /\bcure(d|s)?\b/i,
  /\bbest\s+(in|hospital|doctor)\b/i,
  /\bfda\s+approved\b/i,
  /\bmiracle\b/i,
  /\b(you\s+will\s+)?(die|dying)\b/i,
];

interface LlmVariant {
  id?: string;
  text: string;
  tone?: string | null;
  compliance_notes?: string | null;
  flagged?: boolean;
}

interface LlmResponse {
  variants: LlmVariant[];
  error?: string;
  reason?: string;
}

export interface CreativeParams {
  channel: 'whatsapp' | 'meta_ad' | 'google_ad' | 'email' | 'sms' | 'journey';
  language: string;
  tone?: string;
  brief: string;
  count: number;
  campaignId?: string;
  agentId: string;
}

export async function generateCreatives(params: CreativeParams): Promise<{
  ok: boolean;
  reason?: string;
  id?: string;
  variants?: LlmVariant[];
  flags?: string[];
}> {
  if (params.count < 1 || params.count > 10) {
    return { ok: false, reason: 'count_out_of_range' };
  }

  const prompt = getPrompt('creative_generate', 1);
  const resp = await callAnthropic({
    purpose: prompt.purpose,
    promptCode: prompt.code,
    promptVersion: prompt.version,
    model: prompt.model,
    system: prompt.system,
    user: prompt.user({
      channel: params.channel,
      language: params.language,
      tone: params.tone,
      count: params.count,
      brief: params.brief,
    }),
    maxTokens: 800,
    temperature: 0.7,
    createdBy: params.agentId,
  });
  if (!resp.ok || !resp.text) return { ok: false, reason: resp.reason ?? 'llm_failed' };

  const parsed = parseJson<LlmResponse>(resp.text);
  if (!parsed) return { ok: false, reason: 'unparseable_llm_response' };
  if (parsed.error) return { ok: false, reason: parsed.error };

  const variants = (parsed.variants ?? []).slice(0, params.count);
  const flags: string[] = [];
  const cleanVariants = variants.map((v, idx) => {
    const hits = FORBIDDEN_PATTERNS.filter((re) => re.test(v.text));
    if (hits.length) flags.push(`variant_${idx}_forbidden_phrase`);
    return {
      id: v.id ?? `v${idx + 1}`,
      text: String(v.text).slice(0, 2000),
      tone: v.tone ?? params.tone ?? null,
      compliance_notes: v.compliance_notes ?? null,
      flagged: hits.length > 0,
    };
  });

  const svc = createServiceClient();
  const { data, error } = await svc
    .from('ai_creatives_generated')
    .insert({
      channel: params.channel,
      brief: params.brief.slice(0, 4000),
      language: params.language,
      tone: params.tone ?? null,
      variants: cleanVariants,
      compliance_flags: flags,
      generated_by: params.agentId,
      linked_campaign_id: params.campaignId,
      prompt_code: prompt.code,
      prompt_version: prompt.version,
    })
    .select('id')
    .single();

  if (error) return { ok: false, reason: error.message };
  return { ok: true, id: data.id, variants: cleanVariants, flags };
}
