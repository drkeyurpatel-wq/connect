# H1 Connect — Phase 4 Specification

| Field | Value |
|---|---|
| Project | Health1 CRM Platform (H1 Connect) |
| Phase | 4 of 7 (Post-Discharge Engagement + NPS + Loyalty) |
| Operational owner | Dr. Keyur Patel (MD) |
| Stack | Next.js 14 + Supabase + Vercel |
| Repo | `drkeyurpatel-wq/connect` (extends P1–P3) |
| Status | Specification |
| Spec version | 1.0 |
| Date | 19 April 2026 |
| ECC version | v4 |

---

## 1. Context

P1 captured leads. P2 marketed to them and tracked referrals. P3 gave agents
a voice channel. **P4 closes the patient lifecycle loop**: once a patient is
discharged from a Health1 facility, H1 Connect systematically engages them to
drive clinical outcomes, capture NPS, identify complications early, book
follow-ups, solicit reviews, and convert them into advocates.

Industry baselines that motivate P4:

- 30% of discharged patients have no follow-up plan → 15% 30-day readmission
- Structured Day 2/7/30 check-ins reduce readmissions 25–40%
- NPS promoters refer 2–3× baseline
- Google reviews correlate with 30–50% higher inbound lead volume

---

## 2. Scope

### In scope

1. HMIS discharge event ingestion → journey enrolment
2. Post-discharge journey templates (default + specialty overlays)
3. NPS capture at Day 14 (0–10 + open feedback, Claude classification)
4. NPS analytics by centre / specialty / doctor
5. Complication flagging via keyword triggers + Claude AI classifier
6. Follow-up appointment automation (Day 7 + Day 30)
7. Patient loyalty + family health cards (tiered)
8. Advocate program (NPS ≥ 9 → referral flow, compliance-aware rewards)
9. Review solicitation (Day 7) with deep links to Google / Practo
10. Annual checkup reminder campaigns (specialty-specific)
11. Patient preference center (per-channel, per-category)
12. Clinical escalation workflow with SLA tracking

### Out of scope (deferred)

- Self-service patient portal (P7)
- Video consult follow-up (P7+)
- Remote patient monitoring / wearables (P7+)
- Prescription refill automation (HMIS owned)
- Telemedicine booking (HMIS)

---

## 3. Architecture

### New integrations

| Integration | Direction | Mechanism |
|---|---|---|
| HMIS discharge webhook | HMIS → CRM | `POST /api/webhooks/hmis-event` with `event_type=discharged` |
| HMIS follow-up appt sync | CRM → HMIS | `POST /api/hmis/appointments/create` |
| Google review | CRM → Google | Deep-link only |
| Practo review | CRM → Practo | Deep-link only |

### New background workers

| Cron | Schedule | Purpose |
|---|---|---|
| discharge-journey-trigger | every 5 min | enrol newly discharged patients |
| nps-invite | daily 10:00 IST | enrol Day 14 post-discharge patients |
| complication-escalation | every 5 min | scan replies, route by severity |
| advocate-recruitment | daily 14:00 IST | Day 30 promoters → advocate flow |
| annual-checkup-reminders | daily 09:00 IST | anniversary-based reminders |
| review-follow-up | daily 11:00 IST | thank-you after review |

### Reuses from prior phases

- Journey engine (P2)
- WhatsApp via AiSensy (P1)
- Claude API for classification (P3)
- HMIS sync infrastructure (P1)
- Audit log + RLS helpers (P1)

---

## 4. Discharge event processing

See `src/app/api/webhooks/hmis-event/route.ts`. The `discharged` branch:

1. Upsert `discharge_events` keyed by `(centre_code, hmis_admission_id)`.
2. Match to `leads` by phone + DOB; else create a patient-only lead.
3. Determine journey template from specialty / procedure complexity / discharge type.
4. Skip enrolment if `discharge_type = expired` (bereavement branch instead).
5. Insert `post_discharge_enrolments` row; journey engine handles sends.

Full payload shape documented inline in route.

---

## 5. Journey templates

### Default (non-surgical)

| Day | Channel | Message summary | Branch |
|---|---|---|---|
| 0 (+1h) | WhatsApp | Welcome home + discharge summary link | — |
| 2 | WhatsApp | Feeling good / discomfort / urgent (1/2/3) | 3 → complication_flag |
| 7 | WhatsApp | Day 7 check-in + book follow-up | booked → milestone |
| 14 | WhatsApp | NPS 0–10 + open feedback | ≥9 advocate; ≤6 detractor-recovery |
| 30 | WhatsApp | 30-day follow-up booking | else → agent task |
| 90 | WhatsApp | 90-day recovery check | symptoms → call task |
| 365 | WhatsApp | Annual checkup reminder | booked → milestone |

### Specialty overlays

- **Cardiac (CABG / VALVE)**: adds Day 5 echo, Day 10 suture check, Day 30 echo re-check, Day 45 rehab offer, Day 90 cardiology OPD reminder.
- **Ortho (TKR / THR / spine)**: adds Day 3 physio, Day 14 X-ray, Day 45 OPD, Day 90 functional-status survey.
- **Oncology**: gentler tone; chemo-cycle reminders; **all copy requires clinical sign-off**.

Quiet hours 09:00–21:00 IST; language from `leads.language_pref` or
`discharge_events.patient_language` with English fallback.

---

## 6. NPS capture

Day 14 WhatsApp interactive (0–10) + open feedback prompt.

- **9–10**: thank + advocate recruit prompt
- **7–8**: thank; log for passive-recovery review
- **0–6**: immediate centre-CX notification; 4-hour callback SLA

Stored on `nps_responses`:

- `score` (0–10)
- `category` (auto: detractor/passive/promoter)
- `open_feedback`
- `feedback_sentiment` (Claude)
- `feedback_topics` (Claude)

Dashboards: rolling NPS (30 / 90 / 365 day), centre / specialty / doctor
drill-downs, topic distribution for detractors, response rate.

Target NPS ≥ 60 (world-class for hospitals).

---

## 7. Complication flagging

Two pathways:

**Keyword trigger** (immediate):
`fever`, `bleeding`, `chest pain`, `vomiting`, `sutures open`, `readmitted`,
`emergency`. Language-aware (`bukhar`, `tav`, etc.).

**AI classification** (Claude, async within 2 min):
labels `normal` | `minor_concern` | `major_concern` | `emergency`.

Escalation ladder:

| Label | Action | SLA |
|---|---|---|
| normal | log only | — |
| minor_concern | agent task | 24 h |
| major_concern | notify clinical coordinator + treating doctor | 4 h |
| emergency | page on-call via SMS + voice | 15 min |

Every flag tracks outcome (home care / OPD / ER / referred) feeding back into
journey design.

---

## 8. Loyalty + family health cards

- Card auto-created on first IPD visit; opt-in on OPD.
- `card_number` format: `HC-YYYY-NNNNNN`.
- Tiers: Basic / Silver / Gold / Platinum by rolling 24-month spend.
- Family linkage: primary + up to 8 members; spend rolls up for tier; medical
  records remain separate (HMIS-level PHI isolation; CRM stores metadata only).
- Benefits (P4): 5–15% service discount, priority booking, free annual checkup
  above threshold, birthday health-check offer.

---

## 9. Advocate program

Trigger: NPS ≥ 9 at Day 14. Day 16 prompt → share card → unique tracking code.
New leads attributed to patient-advocate populate `advocate_referrals`.

**Compliance**: no cash commissions (regulated for healthcare providers in
India). Rewards limited to non-monetary, value-capped benefits (< ₹500 equiv).
Internal leaderboard only.

---

## 10. Review solicitation

Day 7 deep-link ask (Google / Practo) — **only** for patients with prior NPS
≥ 8 OR Day 2 positive. Never solicit reviews from detractors (consumer
protection law + platform policy).

`review_solicitations` tracks asks + click-through; `review_captures` logs
off-platform captures.

---

## 11. Data model (P4 additions)

New tables: `discharge_events`, `post_discharge_enrolments`, `nps_responses`,
`complication_flags`, `follow_up_appointments`, `loyalty_cards`,
`family_members`, `loyalty_transactions`, `advocate_referrals`,
`advocate_rewards`, `review_solicitations`, `review_captures`,
`checkup_reminders`, `patient_preferences`, `clinical_escalation_sla`.

Extensions: `leads.is_patient`, `leads.primary_loyalty_card_id`,
`leads.language_pref`; `journeys.journey_type` enum
(`marketing | post_discharge | advocate | reminder`).

See `h1connect_schema_p4.sql`.

---

## 12. RLS + security

- `discharge_events`: manager+ read, service-role (webhook) insert.
- `nps_responses`: manager+ read; lead owners read own; service-role insert.
- `complication_flags`: clinical + manager read; lead owners read own; service-role insert.
- `loyalty_cards`: lead owners read own; manager reads centre-scoped.
- `review_*`: manager+ read.
- `patient_preferences`: lead owners + manager read / write.

### New PHI/PII tags

- `discharge_events.diagnoses_icd10` — PHI
- `discharge_events.procedures` — PHI
- `nps_responses.open_feedback` — may contain PHI
- `complication_flags.symptom_text` — PHI

---

## 13. Success metrics

1. ≥ 95% of HMIS discharges create a post-discharge enrolment
2. Day 2 response rate ≥ 35%
3. Day 14 NPS response rate ≥ 25%
4. Complication flags closed within SLA ≥ 95%
5. ≥ 40% of promoters engage with advocate flow
6. Review-ask → actual-review rate ≥ 8%
7. Measurable 30-day readmission reduction post-go-live
8. Playwright E2E ≥ 30 P4 scenarios green

---

## 14. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| HMIS webhook delays / misses | M | H | hourly reconcile job |
| Message fatigue | H | M | preference center live before P4; max 1/48h non-urgent |
| Detractor public complaints | M | H | 4-h CX SLA; apology + callback |
| AI misclassification of urgent case | M | Crit | keyword override; conservative bias; weekly audit |
| Family card PHI leakage | L | Crit | CRM metadata only; no medical data |
| Advocate reward regulatory risk | L | H | non-monetary, value-capped, legal review |
| Oncology tone-deaf copy | M | H | clinical sign-off required |
| Language mismatch | M | M | English fallback outside {en, hi, gu} |

---

## 15. Open items

1. HMIS discharge webhook availability — confirm with HMIS team
2. Clinical on-call roster per centre for emergency escalation
3. Loyalty tier thresholds (₹ spend cutoffs)
4. Advocate reward catalogue
5. Specialty journey copy — clinical sign-off
6. Gujarati / Hindi NPS copy — clinical + marketing review
7. 30-day readmission baseline from HMIS

---

## 16. Timeline

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Schema + discharge ingestion + default journey | end-to-end discharge flow |
| 2 | NPS + complication flagging + escalation | closed-loop feedback live |
| 3 | Loyalty + family + advocate + reviews | core features operational |
| 4 | Hardening + clinical review + Shilaj pilot | pilot running |

---

## 17. Change log

| Version | Date | Change | Author |
|---|---|---|---|
| 1.0 | 19 Apr 2026 | Initial P4 spec | Claude (Keyur-approved) |
