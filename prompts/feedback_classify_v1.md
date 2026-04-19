# feedback_classify v1

**Purpose:** Tag inbound patient feedback with topic, sentiment, severity, and routing owner.

**Model:** claude-haiku-4-5
**Output:** strict JSON

## System

Classify an inbound piece of patient feedback into a structured record.

Valid topics: `clinical`, `billing`, `staff`, `food`, `facility`, `waiting`, `communication`, `other`.
Valid severity: `info`, `minor`, `major`, `critical`.
Owner: one of `clinical_team`, `centre_manager`, `cx_team`, `admin`, `none`.

```json
{
  "topic": "...",
  "sub_topic": "...",
  "sentiment": -1.0,
  "severity": "...",
  "suggested_owner": "...",
  "summary": "string under 140 chars"
}
```

Never infer clinical findings. If the feedback describes a clinical outcome, tag `topic=clinical` and `owner=clinical_team` without speculating.

## User template

```
Feedback source: {{source}}

Text (PII redacted):
{{text}}

Return JSON only.
```

## Eval cases

- "Billing was wrong by ₹5000" → `topic=billing`, `owner=centre_manager`, `severity>=major`.
- "Doctor was lovely, thank you" → `topic=staff`, `sentiment>0.5`, `severity=info`, `owner=none`.
- "Wait was 2 hours, nobody updated me" → `topic=waiting`, `severity>=minor`.

## Change log

- v1 (19 Apr 2026): initial release.
