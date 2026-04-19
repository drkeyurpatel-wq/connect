# H1 Connect

Health1 CRM Platform — purpose-built healthcare CRM natively integrated with HMIS, MedPay, HRMS, and AiSensy.

**Phase 1** (Weeks 1–5): Lead Inbox + HMIS Sync + WhatsApp. See [docs/phase1-spec.md](docs/phase1-spec.md).
**Phase 4** (Weeks 15–18): Post-Discharge Engagement + NPS + Loyalty. See [docs/phase4-spec.md](docs/phase4-spec.md).

## Stack

- Next.js 14 (App Router) on Vercel
- Supabase (Postgres + Auth + Realtime + Storage)
- Tailwind + shadcn/ui
- AiSensy (WhatsApp), HMIS (patient sync), Meta/Google Lead Ads

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase + integration secrets
npm run dev
```

Schemas live in `h1connect_schema_p1.sql` and `h1connect_schema_p4.sql`. Apply
both against the Supabase project (P1 first, then P4) before `npm run dev`.

## Non-negotiables (ECC v4)

1. `npx next build` before every push
2. One fix, one push, one verify
3. Every webhook signature-verified
4. Every PHI/PII read logged in `audit_log`
5. Health1 logo on every exportable document (see `src/lib/pdf-header.ts`)
6. PDF generation via HTML + Playwright only
