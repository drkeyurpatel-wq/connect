# H1 Connect — Deploy Guide

**Status**: Phase 1 scaffold + Supabase backend live. Last mile = Vercel import.

## Canonical Infrastructure

| Component | Value |
|---|---|
| Supabase project | `yqyfmnemvedpqnkfraro` (connect, ap-south-1 Mumbai, $10/mo) |
| Supabase URL | `https://yqyfmnemvedpqnkfraro.supabase.co` |
| Anon key | `sb_publishable_A6RAsGDwzLH8vPNiOlb8KA_wY8wg5xW` |
| GitHub repo | `drkeyurpatel-wq/connect` (default branch: `main`) |
| Schema | 19 tables, 5 enums, 37 RLS policies, 6 centres + 10 sources + 9 stages + 8 lost reasons seeded |

## Deploy to Vercel (3 minutes)

### Step 1 — Import the repo

Open this URL:

**https://vercel.com/new**

- "Import Git Repository" → select `drkeyurpatel-wq/connect`
- Vercel auto-detects Next.js (see `vercel.json` in repo)

### Step 2 — Set environment variables

Before clicking Deploy, paste these env vars:

```
NEXT_PUBLIC_SUPABASE_URL
  = https://yqyfmnemvedpqnkfraro.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
  = sb_publishable_A6RAsGDwzLH8vPNiOlb8KA_wY8wg5xW

SUPABASE_SERVICE_ROLE_KEY
  = <grab from https://supabase.com/dashboard/project/yqyfmnemvedpqnkfraro/settings/api>
```

Other env vars (AiSensy, HMIS, Meta/Google, CRON_SECRET) — leave empty for now, fill when ready.

### Step 3 — Deploy

Click Deploy. Wait ~60 seconds. You'll get a URL like `connect-xxx.vercel.app`.

## Bootstrap First User (2 minutes)

H1 Connect uses **magic link auth** (no passwords to set).

### Step 4 — Get your admin account

1. Open `https://<your-vercel-url>/login`
2. Enter your email → click "Send magic link"
3. Open the magic link from your inbox → you're now authenticated
4. Go to https://supabase.com/dashboard/project/yqyfmnemvedpqnkfraro/sql/new
5. Paste and run:

```sql
insert into public.agents (id, full_name, email, role, centre_access, active)
select
    u.id,
    'Dr. Keyur Patel',
    u.email,
    'admin'::public.agent_role,
    (select array_agg(id) from public.centres),
    true
from auth.users u
where u.email = '<your-email-here>'
on conflict (id) do update
set role = 'admin',
    centre_access = excluded.centre_access,
    active = true;
```

6. Refresh `<your-vercel-url>` — you now have admin access to all 6 centres.

## Post-Deploy Wiring (do later, not blocking)

- **AiSensy webhook URL**: `https://<vercel>/api/webhooks/aisensy` — set in AiSensy dashboard
- **HMIS webhook URL**: `https://<vercel>/api/webhooks/hmis-event` — share with HMIS team
- **Meta Lead Ads webhook**: `https://<vercel>/api/webhooks/meta-leads` — verify token in Meta
- **Google Lead Ads webhook**: `https://<vercel>/api/webhooks/google-leads`
- **Website form endpoint**: `https://<vercel>/api/webhooks/website-form` — use this on health1.in forms

## Phase Roadmap

| Phase | Weeks | Scope | Branch |
|---|---|---|---|
| P1 ✓ | 5 | Lead inbox + HMIS sync + WhatsApp | `main` |
| P4 | 3-4 | Post-discharge + NPS + loyalty | `claude/post-discharge-engagement-nps-4TBU5` (scaffolded) |
| P5 | 6-8 | AI intelligence layer | `claude/ai-intelligence-layer-Vg0fs` (scaffolded) |
| P2 | 10-12 | Referral CRM + Campaigns + Meta/Google Ads | not started |
| P3 | 5-6 | Call Center + DialShree CTI + AI summaries | not started |
| P6 | 6-8 | Corporate + TPA + Insurance | not started |
| P7 | 6-8 | Portals + i18n + Email | not started |

Build P2, P3, P6, P7 via Claude Code in parallel feature branches — same pattern as P4/P5.

## ECC v4 Compliance Checklist

- ✓ RLS default-deny on every table
- ✓ PHI/PII columns tagged via `COMMENT ON COLUMN`
- ✓ Audit log trigger on `leads`, `lead_activities`, `agents`
- ✓ Webhook signature verification (AiSensy, Meta, HMIS)
- ✓ Idempotency keys on HMIS patient sync
- ✓ Service role key isolated (server-only, never shipped to client)
- ✓ Separate Supabase project (blast radius isolation from HMIS/MedPay/HRMS)

## Rotate Credentials Post-Deploy

- GitHub PAT `ghp_aOVDRND3...` — revoke at https://github.com/settings/tokens
- Supabase service role key — rotate periodically via dashboard
