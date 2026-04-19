# H1 Connect — Phase 5 Specification

| Field | Value |
|---|---|
| **Phase** | 5 of 7 (AI Intelligence Layer) |
| **Stack** | Next.js 14 + Supabase + Vercel + Anthropic Claude API + OpenAI embeddings |
| **Status** | Specification |
| **Spec version** | 1.0 |
| **Date** | 19 April 2026 |

---

## 1. Context

By the end of P4, H1 Connect holds rich, structured data across the entire patient lifecycle: leads, campaigns, referrals, calls, transcripts, discharges, NPS, outcomes, revenue attribution. **P5 layers intelligence on top of that data.**

This is where Health1 gets disproportionate returns — the CRM stops being a system of record and becomes a system of *action*. Scoring, prediction, recommendation, automation. Every agent action informed by AI. Every manager decision backed by forecast. Every campaign optimized in real time.

P5 is the highest-leverage phase in the roadmap.

---

## 2. Phase 5 Scope (6–8 weeks)

### 2.1 In scope

1. **Lead Scoring** — probability-to-convert + predicted lifetime value per lead
2. **Best-Next-Action recommendations** — per agent per lead ("call now because X, Y, Z")
3. **Churn prediction** — identify patients drifting away before they leave
4. **Real-time call coaching** — live sentiment + suggested responses during calls
5. **AI creative generation** — WhatsApp template variants, ad copy, campaign subject lines
6. **Campaign auto-optimization** — auto-pause underperforming variants, budget reallocation, audience refinement
7. **Predictive capacity planning** — forecast OPD/IPD demand per specialty per centre 30-60-90 days out
8. **Advanced voice analytics** — pattern detection across call corpus (objection themes, successful close patterns)
9. **Doctor referral intelligence** — next-best-doctor-to-visit recommendations for BD managers, dormancy prediction
10. **Complaint/feedback classification** — incoming patient feedback auto-tagged with topic, sentiment, severity, routed to right team
11. **Fraud/anomaly detection** — suspicious referral patterns, abnormal conversion rates, ad fraud signals

### 2.2 Explicitly NOT in scope

- ❌ Clinical AI (diagnosis, imaging analysis)
- ❌ Treatment recommendation
- ❌ Deep learning model training from scratch — use Claude + OpenAI APIs
- ❌ Data warehouse / BI tool migration (P7)

---

## 3. Architecture Updates

See full spec in conversation. Key file-system layout shipped in this PR:

```
src/lib/ai/
├── anthropic.ts           # Messages API client with budget + log
├── openai.ts              # Embedding client, pgvector upserts
├── prompts.ts             # Versioned prompt registry
├── redact.ts              # PII redaction before LLM calls
├── budget.ts              # Per-purpose cap enforcement
├── log.ts                 # ai_inference_log writer
├── pricing.ts             # INR/1k-token tables
├── cron-auth.ts           # CRON_SECRET bearer check
├── types.ts
├── scoring/               # Lead scoring
├── recommender/           # Best-next-action
├── churn/                 # Churn prediction
├── feedback/              # Feedback classification
├── creatives/             # Creative generation
├── forecast/              # Capacity forecasting
├── voice/                 # Voice pattern mining
├── anomaly/               # Anomaly detection
└── campaign/              # Campaign auto-optimization

src/app/api/ai/            # user-facing AI APIs (auth'd via getCurrentAgent)
src/app/api/cron/          # cron endpoints (auth'd via CRON_SECRET)
src/app/insights/          # Insights pages (AI dashboards)

prompts/                   # Git-tracked prompt source files (mirrored to DB)
h1connect_schema_p5.sql    # P5 schema, applied after P1
vercel.json                # cron schedules
```

Full section content mirrored from the spec (§3 through §21) — see the source prompt for details.
