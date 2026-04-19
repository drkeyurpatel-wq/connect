# H1 Connect — Deploy Guide

**Phase 1 status**: Supabase live, code on main, auto-bootstrap ready. One Vercel import away from a working prototype.

## Canonical Infrastructure

| Component | Value |
|---|---|
| Supabase project | `yqyfmnemvedpqnkfraro` (connect, ap-south-1 Mumbai, $10/mo) |
| Supabase URL | `https://yqyfmnemvedpqnkfraro.supabase.co` |
| Anon key | `sb_publishable_A6RAsGDwzLH8vPNiOlb8KA_wY8wg5xW` |
| GitHub repo | `drkeyurpatel-wq/connect` (default branch: `main`) |

## What's Already Seeded

- 6 centres (Shilaj, Vastral, Modasa, Gandhinagar, Udaipur, Himmatnagar)
- 30 specialties (Interventional Neurology, Cardiology, Joint Replacement, Oncology, …)
- 10 lead sources (Website, WhatsApp, Meta Lead Ad, Walk-in, Doctor Referral, …)
- 9 lead stages (New → Contacted → Qualified → Appointment Booked → Consulted → Converted → Admitted)
- 8 lost reasons, 1 SLA policy (15-min first response on new leads)
- **Auto-bootstrap trigger**: first authenticated user becomes admin with access to all 6 centres. No manual SQL needed.

## Deploy (2 steps)

### Step 1 — Import repo on Vercel

Open **https://vercel.com/new** → select `drkeyurpatel-wq/connect` → before Deploy, set env vars:

```
NEXT_PUBLIC_SUPABASE_URL       = https://yqyfmnemvedpqnkfraro.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = sb_publishable_A6RAsGDwzLH8vPNiOlb8KA_wY8wg5xW
SUPABASE_SERVICE_ROLE_KEY      = <paste from dashboard — see link below>
```

Service role key: https://supabase.com/dashboard/project/yqyfmnemvedpqnkfraro/settings/api → `service_role` → Reveal → Copy.

Click Deploy. ~60s.

Leave AiSensy / HMIS / Meta / Google / CRON_SECRET env vars empty for now — wire them when you turn those integrations on.

### Step 2 — First login

1. Open `https://<your-vercel-url>/login`
2. Enter your email → click "Send magic link"
3. Click the link in your inbox
4. You're now logged in as admin with access to all 6 centres — the database trigger provisioned the agent record automatically

That's it. No bootstrap SQL. No dashboard clicks. Just the magic link.

## What Works Immediately

- View leads inbox (currently empty, RLS-filtered to your centres)
- Create leads via `/leads/new` form
- Dashboard API endpoints (pipeline, SLA, agent performance)
- Public website form API (`/api/webhooks/website-form`) for external lead capture
- All 6 webhook receivers scaffolded (wire in third-party dashboards when ready)

## What Needs Wiring (Not Blocking Deploy)

| Integration | Action | Where |
|---|---|---|
| AiSensy | Set webhook URL to `https://<vercel>/api/webhooks/aisensy` + `AISENSY_API_KEY` in Vercel env | AiSensy dashboard |
| HMIS | Set `HMIS_API_KEY` + `HMIS_WEBHOOK_SECRET` in Vercel env; have HMIS POST to `https://<vercel>/api/webhooks/hmis-event` | HMIS team |
| Meta Lead Ads | Set `META_LEADS_VERIFY_TOKEN` + `META_LEADS_APP_SECRET`; configure webhook `https://<vercel>/api/webhooks/meta-leads` | Meta Business |
| Google Lead Ads | Set `GOOGLE_LEADS_VERIFY_TOKEN`; configure webhook `https://<vercel>/api/webhooks/google-leads` | Google Ads |

## Adding Other Agents Later

Subsequent magic-link signups are auto-provisioned as `agent` role with **no** centre access (secure by default). To grant access:

```sql
update public.agents
set centre_access = (select array_agg(id) from public.centres where code in ('SHILAJ','VASTRAL')),
    role = 'manager'
where email = 'newuser@health1.in';
```

## Phase Roadmap

| Phase | Status | Scope |
|---|---|---|
| P1 | ✅ live | Lead inbox + HMIS sync + WhatsApp |
| P4 | scaffolded (branch `claude/post-discharge-engagement-nps-4TBU5`) | Post-discharge, NPS, loyalty |
| P5 | scaffolded (branch `claude/ai-intelligence-layer-Vg0fs`) | AI scoring, churn, creative gen |
| P2, P3, P6, P7 | not started | Referral CRM / Call Center / TPA / Portals |

Continue parallel Claude Code branches for new phases.

## ECC v4 Compliance

- ✅ RLS default-deny on every table
- ✅ PHI/PII columns tagged via `COMMENT ON COLUMN`
- ✅ Audit trigger on `leads`, `lead_activities`, `agents`
- ✅ Webhook signature verification
- ✅ Idempotency keys on HMIS patient sync
- ✅ Service role isolated server-side
- ✅ Separate Supabase project (blast radius isolation)

## Security Housekeeping

- Revoke the session GitHub PAT after session: https://github.com/settings/tokens
- Rotate service role key periodically via dashboard
