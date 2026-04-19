-- =============================================================================
-- H1 Connect — Phase 4 schema
-- Post-Discharge Engagement + NPS + Loyalty + Advocate Program
-- Target: Supabase Postgres (extends P1)
-- Spec: docs/phase4-spec.md (v1.0, 19 Apr 2026)
-- ECC v4 compliant — RLS default deny, PHI/PII tagged via COMMENT, audit trigger
-- Depends on h1connect_schema_p1.sql
-- =============================================================================

set search_path = public;

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

do $$ begin
    create type discharge_type as enum ('recovered', 'lama', 'transferred', 'expired', 'dama', 'absconded');
exception when duplicate_object then null; end $$;

do $$ begin
    create type journey_type as enum ('marketing', 'post_discharge', 'advocate', 'reminder');
exception when duplicate_object then null; end $$;

do $$ begin
    create type nps_category as enum ('detractor', 'passive', 'promoter');
exception when duplicate_object then null; end $$;

do $$ begin
    create type nps_sentiment as enum ('positive', 'neutral', 'negative', 'mixed');
exception when duplicate_object then null; end $$;

do $$ begin
    create type complication_severity as enum ('normal', 'minor_concern', 'major_concern', 'emergency');
exception when duplicate_object then null; end $$;

do $$ begin
    create type escalation_status as enum ('open', 'acknowledged', 'in_progress', 'resolved', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type complication_outcome as enum ('home_care', 'opd_visit', 'er_admitted', 'referred_elsewhere', 'no_issue', 'lost_to_followup');
exception when duplicate_object then null; end $$;

do $$ begin
    create type loyalty_tier as enum ('basic', 'silver', 'gold', 'platinum');
exception when duplicate_object then null; end $$;

do $$ begin
    create type family_relation as enum ('self', 'spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
    create type loyalty_txn_type as enum ('visit', 'spend', 'savings', 'reward_grant', 'reward_redeem', 'adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
    create type advocate_referral_status as enum ('shared', 'clicked', 'lead_created', 'converted', 'lost');
exception when duplicate_object then null; end $$;

do $$ begin
    create type review_channel as enum ('google', 'practo', 'justdial', 'mouthshut', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
    create type review_status as enum ('sent', 'clicked', 'submitted', 'declined', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
    create type preference_category as enum ('transactional', 'clinical_follow_up', 'marketing', 'reviews', 'loyalty', 'advocate');
exception when duplicate_object then null; end $$;

do $$ begin
    create type preference_channel as enum ('whatsapp', 'sms', 'email', 'voice');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 2. EXTENSIONS TO P1 TABLES
-- =============================================================================

alter table leads
    add column if not exists is_patient boolean not null default false,
    add column if not exists language_pref text,
    add column if not exists primary_loyalty_card_id uuid;

comment on column leads.language_pref is 'ISO 639-1 code; en, hi, gu';

-- journeys table is from P2; if not present we no-op. Safe add.
do $$ begin
    if exists (select 1 from information_schema.tables where table_name = 'journeys') then
        execute 'alter table journeys add column if not exists journey_type journey_type not null default ''marketing''';
    end if;
end $$;

-- =============================================================================
-- 3. DISCHARGE EVENTS
-- =============================================================================

create table if not exists discharge_events (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid references leads(id) on delete set null,

    hmis_admission_id text,
    hmis_patient_id text,
    uhid text not null,
    centre_id uuid references centres(id),
    centre_code text,

    admission_date timestamptz,
    discharge_date timestamptz not null,
    length_of_stay_days int,

    primary_doctor_id uuid references doctors(id),
    primary_doctor_hmis_id text,
    follow_up_doctor_id uuid references doctors(id),
    follow_up_doctor_hmis_id text,

    primary_specialty_id uuid references specialties(id),
    primary_specialty_code text,

    procedures text[] not null default '{}',
    diagnoses_icd10 text[] not null default '{}',

    discharge_type discharge_type not null default 'recovered',
    discharge_summary_url text,

    patient_name text,
    patient_phone text,
    patient_language text,

    raw_payload jsonb not null default '{}',
    processed_at timestamptz,
    skipped_reason text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column discharge_events.uhid is 'PII';
comment on column discharge_events.patient_name is 'PII';
comment on column discharge_events.patient_phone is 'PII';
comment on column discharge_events.procedures is 'PHI';
comment on column discharge_events.diagnoses_icd10 is 'PHI';
comment on column discharge_events.discharge_summary_url is 'PHI';

create unique index if not exists uq_discharge_events_admission
    on discharge_events (centre_code, hmis_admission_id)
    where hmis_admission_id is not null;
create index if not exists idx_discharge_events_lead on discharge_events (lead_id);
create index if not exists idx_discharge_events_date on discharge_events (discharge_date desc);
create index if not exists idx_discharge_events_centre on discharge_events (centre_id, discharge_date desc);

-- =============================================================================
-- 4. POST-DISCHARGE ENROLMENTS
-- =============================================================================

create table if not exists post_discharge_enrolments (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    discharge_event_id uuid not null references discharge_events(id) on delete cascade,
    journey_template_code text not null,
    specialty_overlay text,

    enrolled_at timestamptz not null default now(),
    next_step_at timestamptz,
    current_step_code text,

    day_2_checkin_status text,
    day_7_checkin_status text,
    day_14_nps_status text,
    day_30_followup_status text,
    day_90_checkin_status text,
    day_365_checkup_status text,

    completed_at timestamptz,
    exited_reason text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_pd_enrolment_discharge
    on post_discharge_enrolments (discharge_event_id);
create index if not exists idx_pd_enrolment_lead on post_discharge_enrolments (lead_id);
create index if not exists idx_pd_enrolment_next on post_discharge_enrolments (next_step_at)
    where completed_at is null;

-- =============================================================================
-- 5. NPS
-- =============================================================================

create table if not exists nps_responses (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    discharge_event_id uuid references discharge_events(id) on delete set null,
    enrolment_id uuid references post_discharge_enrolments(id) on delete set null,

    centre_id uuid references centres(id),
    primary_doctor_id uuid references doctors(id),
    specialty_id uuid references specialties(id),

    score int not null check (score between 0 and 10),
    category nps_category not null,
    open_feedback text,
    feedback_sentiment nps_sentiment,
    feedback_topics text[] not null default '{}',
    would_refer boolean,

    channel text not null default 'whatsapp',
    invited_at timestamptz,
    responded_at timestamptz not null default now(),

    classified_at timestamptz,
    classifier_model text,
    classifier_raw jsonb,

    created_at timestamptz not null default now()
);

comment on column nps_responses.open_feedback is 'PHI';

create index if not exists idx_nps_lead on nps_responses (lead_id, responded_at desc);
create index if not exists idx_nps_centre on nps_responses (centre_id, responded_at desc);
create index if not exists idx_nps_doctor on nps_responses (primary_doctor_id, responded_at desc);
create index if not exists idx_nps_category on nps_responses (category, responded_at desc);

-- monthly NPS rollup for fast dashboard reads
create table if not exists nps_monthly_rollup (
    id uuid primary key default uuid_generate_v4(),
    period_month date not null,
    centre_id uuid references centres(id),
    specialty_id uuid references specialties(id),
    doctor_id uuid references doctors(id),
    promoters int not null default 0,
    passives int not null default 0,
    detractors int not null default 0,
    responses int not null default 0,
    invited int not null default 0,
    nps_score numeric(5,2),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_nps_rollup
    on nps_monthly_rollup (period_month, coalesce(centre_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(specialty_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- =============================================================================
-- 6. COMPLICATION FLAGS + CLINICAL ESCALATION
-- =============================================================================

create table if not exists complication_flags (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    discharge_event_id uuid references discharge_events(id) on delete set null,
    enrolment_id uuid references post_discharge_enrolments(id) on delete set null,

    source text not null check (source in ('keyword', 'ai_classifier', 'agent', 'patient_self_report')),
    severity complication_severity not null,
    symptom_text text,
    keywords_matched text[] not null default '{}',
    classifier_label text,
    classifier_confidence numeric(4,3),
    classifier_model text,
    classifier_raw jsonb,

    flagged_at timestamptz not null default now(),
    status escalation_status not null default 'open',
    assigned_doctor_id uuid references doctors(id),
    assigned_agent_id uuid references agents(id),

    first_contact_at timestamptz,
    resolved_at timestamptz,
    outcome complication_outcome,
    outcome_notes text,

    whatsapp_message_id uuid references whatsapp_messages(id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column complication_flags.symptom_text is 'PHI';
comment on column complication_flags.outcome_notes is 'PHI';

create index if not exists idx_complication_lead on complication_flags (lead_id, flagged_at desc);
create index if not exists idx_complication_open on complication_flags (status, severity, flagged_at)
    where status in ('open', 'acknowledged', 'in_progress');
create index if not exists idx_complication_doctor on complication_flags (assigned_doctor_id) where status != 'resolved';

create table if not exists clinical_escalation_sla (
    id uuid primary key default uuid_generate_v4(),
    complication_flag_id uuid not null references complication_flags(id) on delete cascade,
    severity complication_severity not null,
    target_secs int not null,
    started_at timestamptz not null default now(),
    target_at timestamptz not null,
    acknowledged_at timestamptz,
    resolved_at timestamptz,
    breached boolean not null default false,
    breach_secs int
);

create index if not exists idx_escalation_sla_open on clinical_escalation_sla (complication_flag_id) where resolved_at is null;
create index if not exists idx_escalation_sla_breach on clinical_escalation_sla (breached, target_at) where resolved_at is null;

-- =============================================================================
-- 7. FOLLOW-UP APPOINTMENTS
-- =============================================================================

create table if not exists follow_up_appointments (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    discharge_event_id uuid references discharge_events(id) on delete set null,
    enrolment_id uuid references post_discharge_enrolments(id) on delete set null,

    scheduled_at timestamptz,
    doctor_id uuid references doctors(id),
    centre_id uuid references centres(id),
    specialty_id uuid references specialties(id),
    hmis_appointment_id text,

    kind text not null check (kind in ('day_7', 'day_30', 'day_90', 'annual', 'ad_hoc')),
    status text not null default 'proposed' check (status in ('proposed', 'booked', 'confirmed', 'completed', 'no_show', 'cancelled')),
    booking_link text,
    booked_at timestamptz,
    completed_at timestamptz,
    outcome_notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_followup_lead on follow_up_appointments (lead_id, scheduled_at desc);
create index if not exists idx_followup_status on follow_up_appointments (status, scheduled_at);

-- =============================================================================
-- 8. LOYALTY + FAMILY HEALTH CARDS
-- =============================================================================

create table if not exists loyalty_cards (
    id uuid primary key default uuid_generate_v4(),
    card_number text not null unique,
    primary_lead_id uuid not null references leads(id) on delete cascade,

    tier loyalty_tier not null default 'basic',
    lifetime_visits int not null default 0,
    lifetime_spend numeric(12,2) not null default 0,
    rolling_24m_spend numeric(12,2) not null default 0,
    lifetime_savings numeric(12,2) not null default 0,

    tier_achieved_at timestamptz,
    tier_expires_at timestamptz,

    active boolean not null default true,
    activated_at timestamptz not null default now(),
    suspended_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_loyalty_primary on loyalty_cards (primary_lead_id);
create index if not exists idx_loyalty_tier on loyalty_cards (tier) where active = true;

-- add FK from leads.primary_loyalty_card_id now that the table exists
do $$ begin
    if not exists (
        select 1 from information_schema.table_constraints
        where constraint_name = 'leads_primary_loyalty_card_fkey' and table_name = 'leads'
    ) then
        alter table leads
            add constraint leads_primary_loyalty_card_fkey
            foreign key (primary_loyalty_card_id) references loyalty_cards(id) on delete set null;
    end if;
end $$;

create table if not exists family_members (
    id uuid primary key default uuid_generate_v4(),
    loyalty_card_id uuid not null references loyalty_cards(id) on delete cascade,
    lead_id uuid references leads(id) on delete set null,
    full_name text not null,
    phone text,
    relation family_relation not null,
    dob date,
    gender text check (gender in ('male', 'female', 'other') or gender is null),
    added_at timestamptz not null default now(),
    added_by uuid references agents(id),
    removed_at timestamptz,
    removed_by uuid references agents(id)
);

comment on column family_members.full_name is 'PII';
comment on column family_members.phone is 'PII';
comment on column family_members.dob is 'PII';

create unique index if not exists uq_family_card_lead
    on family_members (loyalty_card_id, lead_id)
    where lead_id is not null and removed_at is null;
create index if not exists idx_family_card on family_members (loyalty_card_id) where removed_at is null;

create table if not exists loyalty_transactions (
    id uuid primary key default uuid_generate_v4(),
    loyalty_card_id uuid not null references loyalty_cards(id) on delete cascade,
    lead_id uuid references leads(id) on delete set null,
    txn_type loyalty_txn_type not null,
    amount numeric(12,2) not null default 0,
    description text,
    hmis_reference_id text,
    created_at timestamptz not null default now(),
    created_by uuid references agents(id)
);

create index if not exists idx_loyalty_txn_card on loyalty_transactions (loyalty_card_id, created_at desc);

create table if not exists loyalty_tier_config (
    id uuid primary key default uuid_generate_v4(),
    tier loyalty_tier not null unique,
    min_rolling_24m_spend numeric(12,2) not null,
    discount_pct numeric(5,2) not null default 0,
    priority_booking boolean not null default false,
    free_annual_checkup boolean not null default false,
    description text
);

-- =============================================================================
-- 9. ADVOCATE PROGRAM
-- =============================================================================

create table if not exists advocate_referrals (
    id uuid primary key default uuid_generate_v4(),
    advocate_lead_id uuid not null references leads(id) on delete cascade,
    referral_code text not null unique,

    referee_lead_id uuid references leads(id) on delete set null,
    referee_phone text,
    referee_name text,

    status advocate_referral_status not null default 'shared',
    shared_at timestamptz not null default now(),
    clicked_at timestamptz,
    lead_created_at timestamptz,
    converted_at timestamptz,

    channel text,
    utm_campaign text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on column advocate_referrals.referee_phone is 'PII';
comment on column advocate_referrals.referee_name is 'PII';

create index if not exists idx_advocate_ref_adv on advocate_referrals (advocate_lead_id, created_at desc);
create index if not exists idx_advocate_ref_referee on advocate_referrals (referee_lead_id);
create index if not exists idx_advocate_ref_status on advocate_referrals (status);

create table if not exists advocate_rewards (
    id uuid primary key default uuid_generate_v4(),
    advocate_lead_id uuid not null references leads(id) on delete cascade,
    referral_id uuid references advocate_referrals(id) on delete set null,
    reward_code text not null,
    reward_description text not null,
    material_value_inr numeric(10,2) not null default 0 check (material_value_inr <= 500),
    is_cash boolean not null default false check (is_cash = false),
    granted_at timestamptz not null default now(),
    granted_by uuid references agents(id),
    redeemed_at timestamptz,
    redeemed_reference text,
    notes text
);

create index if not exists idx_advocate_rewards_lead on advocate_rewards (advocate_lead_id, granted_at desc);

-- =============================================================================
-- 10. REVIEWS
-- =============================================================================

create table if not exists review_solicitations (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    discharge_event_id uuid references discharge_events(id) on delete set null,
    channel review_channel not null,
    deep_link text not null,
    status review_status not null default 'sent',
    sent_at timestamptz not null default now(),
    clicked_at timestamptz,
    nps_score_at_ask int check (nps_score_at_ask between 0 and 10),
    min_nps_guard_passed boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_review_sol_lead on review_solicitations (lead_id, sent_at desc);
create index if not exists idx_review_sol_status on review_solicitations (status, sent_at);

create table if not exists review_captures (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    solicitation_id uuid references review_solicitations(id) on delete set null,
    channel review_channel not null,
    review_url text,
    rating int check (rating between 1 and 5),
    snippet text,
    captured_at timestamptz not null default now(),
    captured_by uuid references agents(id),
    source text not null default 'manual' check (source in ('manual', 'deep_link', 'api'))
);

create index if not exists idx_review_cap_lead on review_captures (lead_id, captured_at desc);

-- =============================================================================
-- 11. CHECKUP REMINDERS
-- =============================================================================

create table if not exists checkup_reminders (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    specialty_id uuid references specialties(id),
    reminder_for_date date not null,
    reminder_kind text not null default 'annual' check (reminder_kind in ('annual', 'semiannual', 'quarterly', 'custom')),
    sent_at timestamptz,
    booked_at timestamptz,
    dismissed_at timestamptz,
    cancelled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_checkup_lead on checkup_reminders (lead_id, reminder_for_date);
create index if not exists idx_checkup_due
    on checkup_reminders (reminder_for_date)
    where sent_at is null and cancelled_at is null;

-- =============================================================================
-- 12. PATIENT PREFERENCES
-- =============================================================================

create table if not exists patient_preferences (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    channel preference_channel not null,
    category preference_category not null,
    opted_in boolean not null default true,
    changed_at timestamptz not null default now(),
    changed_by uuid references agents(id),
    source text not null default 'agent' check (source in ('agent', 'patient', 'webhook', 'import', 'default'))
);

create unique index if not exists uq_patient_pref
    on patient_preferences (lead_id, channel, category);
create index if not exists idx_pref_lead on patient_preferences (lead_id);

-- =============================================================================
-- 13. TRIGGERS
-- =============================================================================

drop trigger if exists trg_discharge_events_updated_at on discharge_events;
create trigger trg_discharge_events_updated_at before update on discharge_events
    for each row execute function set_updated_at();

drop trigger if exists trg_pd_enrolment_updated_at on post_discharge_enrolments;
create trigger trg_pd_enrolment_updated_at before update on post_discharge_enrolments
    for each row execute function set_updated_at();

drop trigger if exists trg_complication_updated_at on complication_flags;
create trigger trg_complication_updated_at before update on complication_flags
    for each row execute function set_updated_at();

drop trigger if exists trg_followup_updated_at on follow_up_appointments;
create trigger trg_followup_updated_at before update on follow_up_appointments
    for each row execute function set_updated_at();

drop trigger if exists trg_loyalty_card_updated_at on loyalty_cards;
create trigger trg_loyalty_card_updated_at before update on loyalty_cards
    for each row execute function set_updated_at();

drop trigger if exists trg_advocate_ref_updated_at on advocate_referrals;
create trigger trg_advocate_ref_updated_at before update on advocate_referrals
    for each row execute function set_updated_at();

drop trigger if exists trg_review_sol_updated_at on review_solicitations;
create trigger trg_review_sol_updated_at before update on review_solicitations
    for each row execute function set_updated_at();

drop trigger if exists trg_checkup_updated_at on checkup_reminders;
create trigger trg_checkup_updated_at before update on checkup_reminders
    for each row execute function set_updated_at();

-- NPS category derived from score
create or replace function nps_category_from_score(p_score int)
returns nps_category language sql immutable as $$
    select case
        when p_score >= 9 then 'promoter'::nps_category
        when p_score >= 7 then 'passive'::nps_category
        else 'detractor'::nps_category
    end;
$$;

create or replace function nps_set_category() returns trigger language plpgsql as $$
begin
    new.category := nps_category_from_score(new.score);
    return new;
end $$;

drop trigger if exists trg_nps_set_category on nps_responses;
create trigger trg_nps_set_category before insert or update of score on nps_responses
    for each row execute function nps_set_category();

-- Audit triggers
drop trigger if exists trg_audit_discharge on discharge_events;
create trigger trg_audit_discharge after insert or update or delete on discharge_events
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_nps on nps_responses;
create trigger trg_audit_nps after insert or update or delete on nps_responses
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_complication on complication_flags;
create trigger trg_audit_complication after insert or update or delete on complication_flags
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_loyalty on loyalty_cards;
create trigger trg_audit_loyalty after insert or update or delete on loyalty_cards
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_family on family_members;
create trigger trg_audit_family after insert or update or delete on family_members
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_advocate_ref on advocate_referrals;
create trigger trg_audit_advocate_ref after insert or update or delete on advocate_referrals
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_advocate_rw on advocate_rewards;
create trigger trg_audit_advocate_rw after insert or update or delete on advocate_rewards
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_preferences on patient_preferences;
create trigger trg_audit_preferences after insert or update or delete on patient_preferences
    for each row execute function audit_row_change();

-- =============================================================================
-- 14. HELPER FUNCTIONS
-- =============================================================================

create or replace function is_clinical_reviewer() returns boolean language sql stable security definer as $$
    select exists (
        select 1 from agents
        where id = auth.uid() and active = true
          and (role in ('admin', 'manager') or 'clinical' = any(languages))
    );
$$;

create or replace function has_preference(p_lead uuid, p_channel preference_channel, p_category preference_category)
returns boolean language sql stable as $$
    select coalesce((
        select opted_in
        from patient_preferences
        where lead_id = p_lead and channel = p_channel and category = p_category
        order by changed_at desc
        limit 1
    ), true);
$$;

create or replace function compute_loyalty_tier(p_rolling_spend numeric)
returns loyalty_tier language sql stable as $$
    select tier
    from loyalty_tier_config
    where min_rolling_24m_spend <= coalesce(p_rolling_spend, 0)
    order by min_rolling_24m_spend desc
    limit 1;
$$;

-- =============================================================================
-- 15. RLS
-- =============================================================================

alter table discharge_events enable row level security;
alter table post_discharge_enrolments enable row level security;
alter table nps_responses enable row level security;
alter table nps_monthly_rollup enable row level security;
alter table complication_flags enable row level security;
alter table clinical_escalation_sla enable row level security;
alter table follow_up_appointments enable row level security;
alter table loyalty_cards enable row level security;
alter table family_members enable row level security;
alter table loyalty_transactions enable row level security;
alter table loyalty_tier_config enable row level security;
alter table advocate_referrals enable row level security;
alter table advocate_rewards enable row level security;
alter table review_solicitations enable row level security;
alter table review_captures enable row level security;
alter table checkup_reminders enable row level security;
alter table patient_preferences enable row level security;

-- discharge_events: manager+ read; server-only write
drop policy if exists discharge_events_select on discharge_events;
create policy discharge_events_select on discharge_events for select
    using (is_manager() or (lead_id is not null and is_lead_owner(lead_id)));

-- post_discharge_enrolments: via lead
drop policy if exists pd_enrolment_select on post_discharge_enrolments;
create policy pd_enrolment_select on post_discharge_enrolments for select
    using (is_manager() or is_lead_owner(lead_id));

-- nps_responses: via lead + manager
drop policy if exists nps_select on nps_responses;
create policy nps_select on nps_responses for select
    using (is_manager() or is_lead_owner(lead_id));

-- nps rollup: manager+ only
drop policy if exists nps_rollup_select on nps_monthly_rollup;
create policy nps_rollup_select on nps_monthly_rollup for select
    using (is_manager());

-- complication_flags: clinical reviewers + lead owners
drop policy if exists complication_select on complication_flags;
create policy complication_select on complication_flags for select
    using (is_clinical_reviewer() or is_lead_owner(lead_id));

drop policy if exists complication_update on complication_flags;
create policy complication_update on complication_flags for update
    using (is_clinical_reviewer() or is_lead_owner(lead_id))
    with check (is_clinical_reviewer() or is_lead_owner(lead_id));

drop policy if exists complication_insert on complication_flags;
create policy complication_insert on complication_flags for insert
    with check (is_clinical_reviewer() or is_lead_owner(lead_id));

drop policy if exists escalation_sla_select on clinical_escalation_sla;
create policy escalation_sla_select on clinical_escalation_sla for select
    using (is_clinical_reviewer() or exists (
        select 1 from complication_flags cf where cf.id = complication_flag_id and is_lead_owner(cf.lead_id)
    ));

-- follow_up_appointments: via lead
drop policy if exists followup_select on follow_up_appointments;
create policy followup_select on follow_up_appointments for select
    using (is_manager() or is_lead_owner(lead_id));

drop policy if exists followup_upsert on follow_up_appointments;
create policy followup_upsert on follow_up_appointments for all
    using (is_manager() or is_lead_owner(lead_id))
    with check (is_manager() or is_lead_owner(lead_id));

-- loyalty_cards: primary lead owner + manager centre scope
drop policy if exists loyalty_select on loyalty_cards;
create policy loyalty_select on loyalty_cards for select
    using (is_manager() or is_lead_owner(primary_lead_id));

drop policy if exists loyalty_insert on loyalty_cards;
create policy loyalty_insert on loyalty_cards for insert
    with check (is_manager() or is_lead_owner(primary_lead_id));

drop policy if exists loyalty_update on loyalty_cards;
create policy loyalty_update on loyalty_cards for update
    using (is_manager() or is_lead_owner(primary_lead_id))
    with check (is_manager() or is_lead_owner(primary_lead_id));

-- family_members: via card primary
drop policy if exists family_select on family_members;
create policy family_select on family_members for select
    using (exists (select 1 from loyalty_cards c where c.id = loyalty_card_id and (is_manager() or is_lead_owner(c.primary_lead_id))));

drop policy if exists family_write on family_members;
create policy family_write on family_members for all
    using (exists (select 1 from loyalty_cards c where c.id = loyalty_card_id and (is_manager() or is_lead_owner(c.primary_lead_id))))
    with check (exists (select 1 from loyalty_cards c where c.id = loyalty_card_id and (is_manager() or is_lead_owner(c.primary_lead_id))));

drop policy if exists loyalty_txn_select on loyalty_transactions;
create policy loyalty_txn_select on loyalty_transactions for select
    using (exists (select 1 from loyalty_cards c where c.id = loyalty_card_id and (is_manager() or is_lead_owner(c.primary_lead_id))));

drop policy if exists loyalty_tier_cfg_select on loyalty_tier_config;
create policy loyalty_tier_cfg_select on loyalty_tier_config for select
    using (auth.uid() is not null);

drop policy if exists loyalty_tier_cfg_write on loyalty_tier_config;
create policy loyalty_tier_cfg_write on loyalty_tier_config for all
    using (is_admin()) with check (is_admin());

-- advocate_referrals: advocate lead owner + manager
drop policy if exists advocate_ref_select on advocate_referrals;
create policy advocate_ref_select on advocate_referrals for select
    using (is_manager() or is_lead_owner(advocate_lead_id));

drop policy if exists advocate_ref_write on advocate_referrals;
create policy advocate_ref_write on advocate_referrals for all
    using (is_manager() or is_lead_owner(advocate_lead_id))
    with check (is_manager() or is_lead_owner(advocate_lead_id));

drop policy if exists advocate_rw_select on advocate_rewards;
create policy advocate_rw_select on advocate_rewards for select
    using (is_manager() or is_lead_owner(advocate_lead_id));

drop policy if exists advocate_rw_insert on advocate_rewards;
create policy advocate_rw_insert on advocate_rewards for insert
    with check (is_manager());

-- review_*: manager only + lead owner view own
drop policy if exists review_sol_select on review_solicitations;
create policy review_sol_select on review_solicitations for select
    using (is_manager() or is_lead_owner(lead_id));

drop policy if exists review_cap_select on review_captures;
create policy review_cap_select on review_captures for select
    using (is_manager() or is_lead_owner(lead_id));

drop policy if exists review_cap_insert on review_captures;
create policy review_cap_insert on review_captures for insert
    with check (is_manager() or is_lead_owner(lead_id));

-- checkup_reminders: via lead
drop policy if exists checkup_select on checkup_reminders;
create policy checkup_select on checkup_reminders for select
    using (is_manager() or is_lead_owner(lead_id));

drop policy if exists checkup_write on checkup_reminders;
create policy checkup_write on checkup_reminders for all
    using (is_manager() or is_lead_owner(lead_id))
    with check (is_manager() or is_lead_owner(lead_id));

-- patient_preferences: via lead (agent acting on behalf or manager)
drop policy if exists preferences_select on patient_preferences;
create policy preferences_select on patient_preferences for select
    using (is_manager() or is_lead_owner(lead_id));

drop policy if exists preferences_write on patient_preferences;
create policy preferences_write on patient_preferences for all
    using (is_manager() or is_lead_owner(lead_id))
    with check (is_manager() or is_lead_owner(lead_id));

-- =============================================================================
-- 16. SEED DATA
-- =============================================================================

insert into loyalty_tier_config (tier, min_rolling_24m_spend, discount_pct, priority_booking, free_annual_checkup, description) values
    ('basic',    0,       0,  false, false, 'All patients'),
    ('silver',   50000,   5,  true,  false, 'Silver tier — 5% discount, priority booking'),
    ('gold',     200000, 10,  true,  true,  'Gold tier — 10% discount, free annual checkup'),
    ('platinum', 500000, 15,  true,  true,  'Platinum tier — 15% discount, concierge care')
on conflict (tier) do nothing;

-- Post-discharge preferences default to opted-in for transactional/clinical,
-- agent sets marketing/review explicit. Seed defaults here for reference.
-- (Actual defaults applied via has_preference() fallback.)

-- =============================================================================
-- END OF P4 SCHEMA
-- =============================================================================
