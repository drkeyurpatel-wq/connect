# Prompt library

Git-tracked source for every production prompt. The matching runtime registry is `src/lib/ai/prompts.ts`; changes here must be mirrored there and vice versa.

| Prompt | Model | Purpose |
|---|---|---|
| `best_next_action_v1` | Haiku 4.5 | One next-best-action per lead |
| `feedback_classify_v1` | Haiku 4.5 | Inbound feedback tagging |
| `creative_generate_v1` | Sonnet 4.6 | Marketing variants with compliance guardrails |
| `churn_predict_v1` | Haiku 4.5 | Patient churn risk classification |
| `voice_topic_label_v1` | Haiku 4.5 | Call topic cluster labelling |

## Versioning rules

1. Bump the version whenever the system prompt changes semantics.
2. Never delete old versions — eval suites replay them; old recommendations carry `prompt_version`.
3. Each prompt file must include: purpose, model, system prompt, user template, eval cases, change log.
4. Legal + clinical sign-off required before marking a prompt `active = true` in `ai_prompts`.
