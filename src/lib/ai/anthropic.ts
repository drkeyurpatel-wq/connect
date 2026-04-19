import { checkBudget } from './budget';
import { logInference } from './log';
import { estimateCostInr } from './pricing';

/**
 * Thin Anthropic Messages API wrapper.
 *
 * Uses fetch() against the public HTTPS endpoint so we don't need to pull in the
 * SDK — keeps Edge runtime friendly and dependency surface small.
 *
 * Responsibilities:
 *  - Budget check before the call (per-purpose caps in ai_budget_caps)
 *  - Cost + token logging to ai_inference_log
 *  - Region header opt-in (verify India residency per P5 open item §19.1)
 */

const API_BASE = 'https://api.anthropic.com/v1';
const API_VERSION = '2023-06-01';

export interface AnthropicCallParams {
  purpose: string;
  promptCode?: string;
  promptVersion?: number;
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5';
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  subjectTable?: string;
  subjectId?: string;
  createdBy?: string;
}

export interface AnthropicCallResult {
  ok: boolean;
  text?: string;
  reason?: string;
  inputTokens?: number;
  outputTokens?: number;
  costInr?: number;
  latencyMs?: number;
}

export async function callAnthropic(params: AnthropicCallParams): Promise<AnthropicCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await logInference({
      provider: 'anthropic',
      model: params.model,
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
      provider: 'anthropic',
      model: params.model,
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
    const resp = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId(params.model),
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.2,
        system: params.system,
        messages: [{ role: 'user', content: params.user }],
      }),
    });

    const latencyMs = Date.now() - started;

    if (!resp.ok) {
      const errText = await resp.text();
      await logInference({
        provider: 'anthropic',
        model: params.model,
        purpose: params.purpose,
        promptCode: params.promptCode,
        promptVersion: params.promptVersion,
        latencyMs,
        status: 'error',
        error: `${resp.status}: ${errText.slice(0, 240)}`,
        subjectTable: params.subjectTable,
        subjectId: params.subjectId,
        createdBy: params.createdBy,
      });
      return { ok: false, reason: `http_${resp.status}`, latencyMs };
    }

    const body = (await resp.json()) as {
      content: { type: string; text?: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };

    const text = (body.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    const inputTokens = body.usage?.input_tokens ?? 0;
    const outputTokens = body.usage?.output_tokens ?? 0;
    const costInr = estimateCostInr(params.model, inputTokens, outputTokens);

    await logInference({
      provider: 'anthropic',
      model: params.model,
      purpose: params.purpose,
      promptCode: params.promptCode,
      promptVersion: params.promptVersion,
      inputTokens,
      outputTokens,
      costInr,
      latencyMs,
      status: 'ok',
      subjectTable: params.subjectTable,
      subjectId: params.subjectId,
      createdBy: params.createdBy,
    });

    return { ok: true, text, inputTokens, outputTokens, costInr, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - started;
    await logInference({
      provider: 'anthropic',
      model: params.model,
      purpose: params.purpose,
      promptCode: params.promptCode,
      promptVersion: params.promptVersion,
      latencyMs,
      status: 'error',
      error: err instanceof Error ? err.message.slice(0, 240) : 'unknown',
      subjectTable: params.subjectTable,
      subjectId: params.subjectId,
      createdBy: params.createdBy,
    });
    return { ok: false, reason: 'exception', latencyMs };
  }
}

function modelId(short: AnthropicCallParams['model']): string {
  switch (short) {
    case 'claude-sonnet-4-6':
      return 'claude-sonnet-4-6';
    case 'claude-haiku-4-5':
      return 'claude-haiku-4-5-20251001';
  }
}

/**
 * Parse a JSON object out of an LLM response, tolerant of markdown fences.
 */
export function parseJson<T>(text: string): T | null {
  if (!text) return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
