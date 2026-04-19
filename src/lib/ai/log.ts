import { createServiceClient } from '@/lib/supabase/service';

export interface InferenceLogEntry {
  promptCode?: string;
  promptVersion?: number;
  provider: 'anthropic' | 'openai' | 'internal';
  model: string;
  purpose: string;
  inputTokens?: number;
  outputTokens?: number;
  costInr?: number;
  latencyMs?: number;
  status: 'ok' | 'error' | 'redacted_skip' | 'budget_blocked';
  error?: string;
  subjectTable?: string;
  subjectId?: string;
  createdBy?: string;
}

/**
 * Persist an AI inference event. Do NOT include prompt bodies or model output —
 * those may contain redacted PHI tokens which we deliberately don't re-log.
 */
export async function logInference(entry: InferenceLogEntry): Promise<void> {
  const svc = createServiceClient();
  await svc.from('ai_inference_log').insert({
    prompt_code: entry.promptCode ?? null,
    prompt_version: entry.promptVersion ?? null,
    provider: entry.provider,
    model: entry.model,
    purpose: entry.purpose,
    input_tokens: entry.inputTokens ?? null,
    output_tokens: entry.outputTokens ?? null,
    cost_inr: entry.costInr ?? null,
    latency_ms: entry.latencyMs ?? null,
    status: entry.status,
    error: entry.error ?? null,
    subject_table: entry.subjectTable ?? null,
    subject_id: entry.subjectId ?? null,
    created_by: entry.createdBy ?? null,
  });
}
