import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { checkBudget } from './budget';
import { logInference } from './log';
import { estimateCostInr } from './pricing';

/**
 * OpenAI embedding wrapper (text-embedding-3-small).
 *
 * Cached: if (subject_table, subject_id, kind) already has an embedding whose
 * content_hash matches the current text, we skip the network call entirely.
 */

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

export interface EmbedParams {
  purpose: string;
  text: string;
  subjectTable: string;
  subjectId: string;
  kind: string;
  createdBy?: string;
}

export interface EmbedResult {
  ok: boolean;
  cached?: boolean;
  reason?: string;
  dim?: number;
}

export async function embedAndStore(params: EmbedParams): Promise<EmbedResult> {
  const svc = createServiceClient();
  const hash = sha256(params.text);

  const { data: existing } = await svc
    .from('embeddings')
    .select('id, content_hash')
    .eq('subject_table', params.subjectTable)
    .eq('subject_id', params.subjectId)
    .eq('kind', params.kind)
    .eq('model', EMBEDDING_MODEL)
    .maybeSingle();

  if (existing && existing.content_hash === hash) {
    return { ok: true, cached: true, dim: EMBEDDING_DIM };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await logInference({
      provider: 'openai',
      model: EMBEDDING_MODEL,
      purpose: params.purpose,
      status: 'error',
      error: 'missing_api_key',
      subjectTable: params.subjectTable,
      subjectId: params.subjectId,
      createdBy: params.createdBy,
    });
    return { ok: false, reason: 'missing_api_key' };
  }

  const budget = await checkBudget(params.purpose);
  if (!budget.allowed) {
    await logInference({
      provider: 'openai',
      model: EMBEDDING_MODEL,
      purpose: params.purpose,
      status: 'budget_blocked',
      error: budget.reason,
      subjectTable: params.subjectTable,
      subjectId: params.subjectId,
      createdBy: params.createdBy,
    });
    return { ok: false, reason: budget.reason };
  }

  const started = Date.now();
  try {
    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: params.text }),
    });
    const latencyMs = Date.now() - started;
    if (!resp.ok) {
      const err = await resp.text();
      await logInference({
        provider: 'openai',
        model: EMBEDDING_MODEL,
        purpose: params.purpose,
        status: 'error',
        error: `${resp.status}: ${err.slice(0, 240)}`,
        latencyMs,
        subjectTable: params.subjectTable,
        subjectId: params.subjectId,
        createdBy: params.createdBy,
      });
      return { ok: false, reason: `http_${resp.status}` };
    }
    const body = (await resp.json()) as {
      data: { embedding: number[] }[];
      usage?: { prompt_tokens: number; total_tokens: number };
    };
    const vec = body.data?.[0]?.embedding;
    if (!vec || vec.length !== EMBEDDING_DIM) {
      return { ok: false, reason: 'bad_embedding_shape' };
    }
    const inputTokens = body.usage?.prompt_tokens ?? 0;
    const costInr = estimateCostInr(EMBEDDING_MODEL, inputTokens, 0);

    await svc.from('embeddings').upsert(
      {
        subject_table: params.subjectTable,
        subject_id: params.subjectId,
        kind: params.kind,
        model: EMBEDDING_MODEL,
        content_hash: hash,
        embedding: vec as unknown as string,
      },
      { onConflict: 'subject_table,subject_id,kind,model' },
    );

    await logInference({
      provider: 'openai',
      model: EMBEDDING_MODEL,
      purpose: params.purpose,
      inputTokens,
      outputTokens: 0,
      costInr,
      latencyMs,
      status: 'ok',
      subjectTable: params.subjectTable,
      subjectId: params.subjectId,
      createdBy: params.createdBy,
    });

    return { ok: true, cached: false, dim: EMBEDDING_DIM };
  } catch (err) {
    await logInference({
      provider: 'openai',
      model: EMBEDDING_MODEL,
      purpose: params.purpose,
      status: 'error',
      error: err instanceof Error ? err.message.slice(0, 240) : 'unknown',
      subjectTable: params.subjectTable,
      subjectId: params.subjectId,
      createdBy: params.createdBy,
    });
    return { ok: false, reason: 'exception' };
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
