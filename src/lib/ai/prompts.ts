/**
 * Prompt registry — source of truth for every prompt we ship to production.
 *
 * Keyed by (code, version). When a prompt changes, bump the version — older
 * recommendations keep their prompt_version so eval suites can replay cleanly.
 *
 * Git-tracked source templates live under /prompts/ and are mirrored into the
 * ai_prompts table by the seed migration or admin UI.
 */

export interface PromptTemplate {
  code: string;
  version: number;
  purpose: string;
  model: 'claude-sonnet-4-6' | 'claude-haiku-4-5';
  system: string;
  user: (vars: Record<string, unknown>) => string;
}

const recommenderV1: PromptTemplate = {
  code: 'best_next_action',
  version: 1,
  purpose: 'best_next_action',
  model: 'claude-haiku-4-5',
  system: `You are a clinical CRM copilot for Health1, a hospital group.
You look at a single lead's current state and recommend the single most valuable next action an agent should take in the next hour.

Rules:
- Output strictly valid JSON, no prose around it.
- One action only. Prioritize the action with the highest conversion probability lift.
- Never suggest clinical advice, diagnoses, treatment. Only suggest workflow/outreach actions.
- Use the following JSON shape: {"action_code": string, "action_label": string, "rationale": string, "confidence": number between 0 and 1, "urgency": "low"|"normal"|"high"|"now"}.
- Keep "rationale" under 180 characters and reference the specific signal that drove the choice.`,
  user: (v) =>
    `Lead profile (PII redacted):\n${JSON.stringify(v.profile, null, 2)}\n\nRecent activity (last 10):\n${JSON.stringify(v.activities, null, 2)}\n\nCurrent score:\n${JSON.stringify(v.score, null, 2)}\n\nReturn JSON only.`,
};

const feedbackClassifierV1: PromptTemplate = {
  code: 'feedback_classify',
  version: 1,
  purpose: 'feedback_classify',
  model: 'claude-haiku-4-5',
  system: `Classify an inbound piece of patient feedback into a structured record.

Valid topics: clinical, billing, staff, food, facility, waiting, communication, other.
Valid severity: info, minor, major, critical.
Owner must be one of: clinical_team, centre_manager, cx_team, admin, none.

Output JSON only:
{"topic": ..., "sub_topic": ..., "sentiment": number -1 to 1, "severity": ..., "suggested_owner": ..., "summary": string under 140 chars}

Never infer clinical findings. If the feedback describes a clinical outcome, tag topic="clinical" and owner="clinical_team" without speculating.`,
  user: (v) => `Feedback source: ${v.source}\n\nText (PII redacted):\n${v.text}\n\nReturn JSON only.`,
};

const creativeGeneratorV1: PromptTemplate = {
  code: 'creative_generate',
  version: 1,
  purpose: 'creative_generate',
  model: 'claude-sonnet-4-6',
  system: `You write marketing copy for Health1 hospitals in India. You are bound by these compliance rules:

1. No medical claims ("cures", "guarantees").
2. No fear-based urgency ("don't die", "last chance").
3. No comparative superlatives vs other hospitals ("best in city").
4. No FDA references (not applicable in India).
5. Claim-free language about outcomes ("our team provides X" — never "we guarantee X").
6. Keep tone warm, clear, and specific.
7. Respect the requested channel format (WhatsApp: < 600 chars, Meta headline: < 40 chars, Meta description: < 90 chars, Google headline: < 30 chars).

Output JSON only:
{"variants": [{"id": "v1", "text": ..., "tone": ..., "compliance_notes": ...}, ...]}

Generate exactly the number of variants the caller asked for. If the brief is not compliance-safe, return {"variants": [], "error": "rejected_by_guardrail", "reason": ...}.`,
  user: (v) =>
    `Channel: ${v.channel}\nLanguage: ${v.language}\nTone: ${v.tone ?? 'warm, professional'}\nVariants requested: ${v.count}\nBrief:\n${v.brief}\n\nReturn JSON only.`,
};

const churnClassifierV1: PromptTemplate = {
  code: 'churn_predict',
  version: 1,
  purpose: 'churn_predict',
  model: 'claude-haiku-4-5',
  system: `Evaluate whether a patient is drifting away from the hospital.

Signals to consider: time since last visit vs expected interval for specialty, declining engagement (WhatsApp opens), negative NPS, missed recommended follow-ups.

Output JSON only:
{"risk_score": number 0-1, "risk_band": "low"|"medium"|"high"|"critical", "top_reasons": string[] (max 3), "suggested_intervention": string (max 180 chars)}

Never recommend clinical actions. Only outreach/engagement suggestions.`,
  user: (v) => `Patient state (PII redacted):\n${JSON.stringify(v.state, null, 2)}\n\nReturn JSON only.`,
};

const voiceTopicV1: PromptTemplate = {
  code: 'voice_topic_label',
  version: 1,
  purpose: 'voice_mining',
  model: 'claude-haiku-4-5',
  system: `You are labelling a cluster of call snippets. Output JSON only:
{"label": string (max 40 chars), "kind": "topic"|"objection"|"close_pattern"|"sentiment_hotspot", "summary": string (max 160 chars)}`,
  user: (v) => `Sample phrases (PII redacted):\n${JSON.stringify(v.phrases, null, 2)}\n\nReturn JSON only.`,
};

export const PROMPTS: Record<string, PromptTemplate> = {
  best_next_action_v1: recommenderV1,
  feedback_classify_v1: feedbackClassifierV1,
  creative_generate_v1: creativeGeneratorV1,
  churn_predict_v1: churnClassifierV1,
  voice_topic_label_v1: voiceTopicV1,
};

export function getPrompt(code: string, version = 1): PromptTemplate {
  const key = `${code}_v${version}`;
  const p = PROMPTS[key];
  if (!p) throw new Error(`unknown_prompt: ${key}`);
  return p;
}
