# H1 Connect — Phase 1 Specification

| Field | Value |
|---|---|
| **Project** | Health1 CRM Platform (H1 Connect) |
| **Phase** | 1 of 4 (Lead Inbox + HMIS Sync + WhatsApp) |
| **Operational owner** | Dr. Keyur Patel (MD) |
| **Stack** | Next.js 14 + Supabase + Vercel (Stack B) |
| **Repo** | `drkeyurpatel-wq/h1connect` (to create) |
| **Supabase org** | Health1 Tasks (Pro) — 7th project |
| **Status** | Specification — pre-build |
| **Spec version** | 1.0 |
| **Date** | 19 April 2026 |
| **ECC version** | v4 |

---

## 1. Context

Health1 currently uses LeadSquared for CRM with pain across cost, HMIS integration, workflow rigidity, reporting, and social + telephony gaps. H1 Connect is being built as a purpose-designed healthcare CRM natively integrated with HMIS, MedPay, HRMS, and AiSensy. It becomes the 9th Health1 production system.

H1 Connect owns the patient journey from first touch → admission → post-discharge → NPS, consolidating lead channels (website, WhatsApp, Meta, Google, walk-in, inbound call, doctor referral) into a single inbox. Full scope spans four phases over 16–20 weeks. **This document covers Phase 1 only** — Phases 2–4 will have their own specs when their time comes (ECC v4 Rule 13).

---

## 2. Phase 1 Scope (Weeks 1–5)

### 2.1 In scope

1. Unified Lead Inbox with multi-source ingestion
2. Lead pipeline with configurable stages: New → Contacted → Qualified → Appointment Booked → Consulted → Converted → Admitted / Lost / Dormant
3. Lead assignment: manual + round-robin auto-assign by centre + specialty + agent load
4. First-response SLA timer (default 15 min) with breach tracking
5. Lead activity timeline: notes, manual call logs, WhatsApp in/out, stage + assignment changes
6. WhatsApp inbound + outbound via AiSensy (reuse existing integration)
7. HMIS one-way sync: lead → HMIS patient registration on appointment confirmation
8. HMIS reverse sync (minimal): admission + discharge events → CRM for conversion tracking
9. Basic pipeline dashboard: leads by stage, by agent, by source, by centre
10. Agent-facing UI: lead list + detail + timeline + quick actions
11. Manager dashboard: team performance, SLA compliance, conversion funnel
12. Role-based access: admin / manager / agent with centre-scoped visibility
13. Full audit log
14. UTM tracking + basic campaign attribution (for P2 readiness)

### 2.2 Explicitly NOT in scope (P2–P4)

- Call center / DialShree CTI integration → P3
- Marketing campaign builder + drip automation → P2
- Meta Ads / Google Ads spend API for true CAC → P2
- Doctor referral network module → P2
- Post-discharge engagement + NPS flows → P4
- Predictive dialer / outbound calling campaigns → P3
- Call recording + transcription → P3
- Corporate / TPA / insurance modules → deprioritized per scoping (19 Apr 2026)
- AI lead scoring → P4
- Multi-language agent UI → P4 (English + Hindi only in P1 content, UI in English)

---

## 3. Architecture

### 3.1 Stack

```
Client (agents, managers, admin)
  │
  ▼
Next.js 14 App Router  ──────►  Vercel (SSR + API routes)
  │
  ├─► Supabase Auth (email + magic link)
  ├─► Supabase Postgres (leads, activities, audit)
  ├─► Supabase Realtime (live inbox updates)
  └─► Supabase Storage (attachments)

External webhooks (inbound)
  ├─► /api/webhooks/aisensy        (WhatsApp in)
  ├─► /api/webhooks/meta-leads     (Meta Lead Ads)
  ├─► /api/webhooks/google-leads   (Google Lead Ads)
  ├─► /api/webhooks/website-form   (public website)
  └─► /api/webhooks/hmis-event     (admission, discharge, appointment)

External pushes (outbound)
  ├─► AiSensy REST API             (WhatsApp out)
  └─► HMIS REST API                (patient create, appointment sync)
```

### 3.2 Integrations in P1

| Integration | Direction | Mechanism | Status |
|---|---|---|---|
| AiSensy (WhatsApp) | Bidirectional | REST + webhook | Reuse existing credentials |
| HMIS patient create | CRM → HMIS | REST to HMIS `/api/patients/create` | New build both sides |
| HMIS admission/discharge | HMIS → CRM | HMIS webhook → `/api/webhooks/hmis-event` | New build both sides |
| Meta Lead Ads | Meta → CRM | Facebook Graph webhook | New build |
| Google Lead Ads | Google → CRM | Lead webhook | New build |
| Website form | Public → CRM | Public POST endpoint with API key | New build |

### 3.3 Branding

All PDFs, reports, and exports use Health1 cross logo via shared `renderPDFHeader()` helper copied from VPMS `src/lib/pdf-header.ts`. Logo base64 embedded in `src/lib/logo-base64.ts`. No exceptions.

---

## 4. Data Model Summary

Full SQL lives in `h1connect_schema_p1.sql`. See that file for column comments, PHI/PII tagging, RLS policies, and triggers.

---

## 5. Success Metrics (P1 go-live gate)

1. 100% of new leads routing into H1 Connect
2. First-response SLA visible in real time
3. HMIS patient registration success rate ≥ 98%
4. Audit log completeness 100%
5. ≥ 10 agents onboarded with training complete
6. Conversion funnel dashboard cross-verified against HMIS for one full week
7. Playwright E2E suite green (≥ 40 scenarios)
8. Zero RLS leaks (manual pen test)
9. 2-week parallel run with LeadSquared — zero lead lost

Only then is LeadSquared disconnected.

---

## 6. Timeline

| Week | Milestone | Deliverable |
|---|---|---|
| 1 | Foundation | Supabase project, schema applied, Next.js scaffold, auth, agent seed, RLS tested |
| 2 | Lead core | Lead CRUD, activity timeline, stage transitions, assignment, audit log, admin settings |
| 3 | WhatsApp + website | AiSensy webhook + send API, website form + Meta + Google webhooks |
| 4 | HMIS sync + dashboards | HMIS patient-create, admission/discharge webhook, manager dashboards, SLA |
| 5 | Hardening + pilot | E2E suite, RLS pen test, agent training, parallel run with LeadSquared |

---

## 7. Non-negotiable rules (ECC v4)

1. `npx next build` before every push — no exceptions
2. One fix, one push, one verify — no batching
3. Never declare "✅ fixed" without live URL verification
4. Never apply bulk DB schema changes post-Week-1; use migrations
5. Every lead delete is soft delete with audit entry
6. Every financial/clinical number verified twice before display
7. Every external webhook signature-verified
8. Every PHI/PII read logged in `audit_log`
9. Health1 logo on every exportable document
10. PDF creation via HTML + Playwright only — never reportlab or pypdf
