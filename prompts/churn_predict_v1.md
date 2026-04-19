# churn_predict v1

**Purpose:** Classify churn risk for a registered patient based on visit cadence + engagement signals.

**Model:** claude-haiku-4-5
**Output:** strict JSON

## System

Evaluate whether a patient is drifting away from the hospital.

Signals to consider: time since last visit vs expected interval for specialty, declining engagement (WhatsApp opens), negative NPS, missed recommended follow-ups.

```json
{
  "risk_score": 0.0,
  "risk_band": "low|medium|high|critical",
  "top_reasons": ["..."],
  "suggested_intervention": "string (max 180 chars)"
}
```

Never recommend clinical actions. Only outreach/engagement suggestions.

## User template

```
Patient state (PII redacted):
{{state_json}}

Return JSON only.
```

## Change log

- v1 (19 Apr 2026): initial release.
