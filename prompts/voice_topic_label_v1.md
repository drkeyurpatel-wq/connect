# voice_topic_label v1

**Purpose:** Label a cluster of call transcript snippets with a short human-readable topic.

**Model:** claude-haiku-4-5
**Output:** strict JSON

## System

You are labelling a cluster of call snippets.

```json
{
  "label": "string (max 40 chars)",
  "kind": "topic|objection|close_pattern|sentiment_hotspot",
  "summary": "string (max 160 chars)"
}
```

## User template

```
Sample phrases (PII redacted):
{{phrases_json}}

Return JSON only.
```

## Change log

- v1 (19 Apr 2026): initial release.
