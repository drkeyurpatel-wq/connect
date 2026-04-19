# H1 Connect

Health1 CRM Platform — purpose-built healthcare CRM natively integrated with HMIS, MedPay, HRMS, and AiSensy.

**Phase 1** (Weeks 1–5): Lead Inbox + HMIS Sync + WhatsApp. See [docs/phase1-spec.md](docs/phase1-spec.md).
**Phase 5** (Weeks 26–33): AI Intelligence Layer — scoring, next-best-action, churn, creative generation, forecasting, anomaly detection. See [docs/phase5-spec.md](docs/phase5-spec.md).

## Stack

- Next.js 14 (App Router) on Vercel
- Supabase (Postgres + Auth + Realtime + Storage + pgvector)
- Tailwind + shadcn/ui
- AiSensy (WhatsApp), HMIS (patient sync), Meta/Google Lead Ads
- Anthropic Claude (Sonnet 4.6 + Haiku 4.5), OpenAI embeddings

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase + integration secrets
npm run dev
```

Schema lives in `h1connect_schema_p1.sql` + `h1connect_schema_p5.sql`. Apply in order against the Supabase project before `npm run dev`.

## AI crons (Phase 5)

Cron endpoints authenticated with bearer `CRON_SECRET`:

| Schedule | Path | Purpose |
|---|---|---|
| `*/15 * * * *` | `/api/cron/lead-score` | Refresh P2C + PLTV |
| `*/30 * * * *` | `/api/cron/best-action-refresh` | Update next-best-action cache |
| `0 3 * * *` | `/api/cron/churn-predict` | Score patient churn risk |
| `0 4 * * *` | `/api/cron/anomaly-scan` | Scan for referral/conversion anomalies |
| `0 2 * * 0` | `/api/cron/capacity-forecast` | Weekly OPD/IPD forecasts |
| `0 5 * * 0` | `/api/cron/voice-pattern-mining` | Cluster weekly call topics |
| `30 5 * * 0` | `/api/cron/campaign-optimize` | Propose A/B winners |

Wire these in `vercel.json` (see `vercel.json`).

## Non-negotiables (ECC v4)

1. `npx next build` before every push
2. One fix, one push, one verify
3. Every webhook signature-verified
4. Every PHI/PII read logged in `audit_log`
5. Health1 logo on every exportable document (see `src/lib/pdf-header.ts`)
6. PDF generation via HTML + Playwright only
