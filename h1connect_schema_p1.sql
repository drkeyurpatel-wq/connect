-- =============================================================================
-- H1 Connect — Phase 1 schema
-- Target: Supabase Postgres (Health1 Tasks org, 7th project)
-- Spec: docs/phase1-spec.md (v1.0, 19 Apr 2026)
-- ECC v4 compliant — RLS default deny, PHI/PII tagged via COMMENT, audit trigger
-- =============================================================================

set search_path = public;

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

do $$ begin
    create type agent_role as enum ('admin', 'manager', 'agent');
exception when duplicate_object then null; end $$;

do $$ begin
    create type lead_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
    create type activity_type as enum (
        'note',
        'call_log',
        'whatsapp_in',
        'whatsapp_out',
        'email_in',
        'email_out',
        'stage_change',
        'assignment_change',
        'sla_breach',
        'hmis_sync',
        'clinical_note',
        'system'
    );
exception when duplicate_object then null; end $$;

do $$ begin
    create type whatsapp_direction as enum ('in', 'out');
exception when duplicate_object then null; end $$;

do $$ begin
    create type sync_status as enum ('pending', 'success', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 2. REFERENCE TABLES
-- =============================================================================

create table if not exists centres (
    id uuid primary key default uuid_generate_v4(),
    code text not null unique,
    name text not null,
    city text not null,
    hmis_centre_id text unique,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists specialties (
    id uuid primary key default uuid_generate_v4(),
    code text not null unique,
    name text not null,
    active boolean not null default true
);

create table if not exists doctors (
    id uuid primary key default uuid_generate_v4(),
    hmis_doctor_id text unique,
    full_name text not null,
    specialty_id uuid references specialties(id),
    centre_id uuid references centres(id),
    active boolean not null default true
);

create table if not exists agents (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    email text not null unique,
    phone text,
    role agent_role not null default 'agent',
    centre_access uuid[] not null default '{}',
    languages text[] not null default '{english}',
    active boolean not null default true,
    last_seen_at timestamptz,
    created_at timestamptz not null default now()
);

comment on column agents.phone is 'PII';

create table if not exists lead_sources (
    id uuid primary key default uuid_generate_v4(),
    code text not null unique,
    name text not null,
    active boolean not null default true
);

create table if not exists lead_stages (
    id uuid primary key default uuid_generate_v4(),
    code text not null unique,
    name text not null,
    stage_order int not null,
    is_terminal boolean not null default false,
    is_won boolean not null default false,
    is_lost boolean not null default false,
    active boolean not null default true
);

create table if not exists lost_reasons (
    id uuid primary key default uuid_generate_v4(),
    code text not null unique,
    name text not null,
    active boolean not null default true
);

create table if not exists campaigns (
    id uuid primary key default uuid_generate_v4(),
    code text not null unique,
    name text not null,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- =============================================================================
-- 3. LEADS + ACTIVITY
-- =============================================================================

create table if not exists leads (
    id uuid primary key default uuid_generate_v4(),
    first_name text not null,
    last_name text,
    phone text not null,
    alt_phone text,
    email text,
    dob date,
    gender text check (gender in ('male', 'female', 'other') or gender is null),
    address text,
    pincode text,

    source_id uuid not null references lead_sources(id),
    campaign_id uuid references campaigns(id),
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,

    centre_interest_id uuid references centres(id),
    specialty_interest_id uuid references specialties(id),
    doctor_interest_id uuid references doctors(id),

    chief_complaint text,
    medical_notes text,

    stage_id uuid not null references lead_stages(id),
    priority lead_priority not null default 'normal',
    assigned_agent_id uuid references agents(id),
    expected_value numeric(12,2),
    lost_reason_id uuid references lost_reasons(id),

    first_response_at timestamptz,
    first_response_sla_secs int,
    sla_breached boolean not null default false,

    hmis_patient_uhid text,
    hmis_registered_at timestamptz,

    deleted_at timestamptz,
    deleted_by uuid references agents(id),

    created_at timestamptz not null default now(),
    created_by uuid references agents(id),
    updated_at timestamptz not null default now(),
    updated_by uuid references agents(id)
);

comment on column leads.first_name is 'PII';
comment on column leads.last_name is 'PII';
comment on column leads.phone is 'PII';
comment on column leads.alt_phone is 'PII';
comment on column leads.email is 'PII';
comment on column leads.dob is 'PII';
comment on column leads.address is 'PII';
comment on column leads.pincode is 'PII';
comment on column leads.chief_complaint is 'PHI';
comment on column leads.medical_notes is 'PHI';
comment on column leads.doctor_interest_id is 'PHI';
comment on column leads.specialty_interest_id is 'PHI';
comment on column leads.expected_value is 'sensitive_internal';
comment on column leads.lost_reason_id is 'sensitive_internal';

create index if not exists idx_leads_phone on leads (phone) where deleted_at is null;
create index if not exists idx_leads_stage on leads (stage_id) where deleted_at is null;
create index if not exists idx_leads_assigned on leads (assigned_agent_id) where deleted_at is null;
create index if not exists idx_leads_centre on leads (centre_interest_id) where deleted_at is null;
create index if not exists idx_leads_created on leads (created_at desc);
create index if not exists idx_leads_source on leads (source_id) where deleted_at is null;

create table if not exists lead_activities (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    activity_type activity_type not null,
    content text,
    metadata jsonb not null default '{}',
    created_at timestamptz not null default now(),
    created_by uuid references agents(id)
);

comment on column lead_activities.content is 'PHI when activity_type = clinical_note';

create index if not exists idx_activities_lead on lead_activities (lead_id, created_at desc);
create index if not exists idx_activities_type on lead_activities (activity_type, created_at desc);

create table if not exists lead_stage_history (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    from_stage_id uuid references lead_stages(id),
    to_stage_id uuid not null references lead_stages(id),
    changed_at timestamptz not null default now(),
    changed_by uuid references agents(id),
    reason text
);

create index if not exists idx_stage_history_lead on lead_stage_history (lead_id, changed_at desc);

create table if not exists lead_assignments (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    from_agent_id uuid references agents(id),
    to_agent_id uuid references agents(id),
    assigned_at timestamptz not null default now(),
    assigned_by uuid references agents(id),
    reason text
);

create index if not exists idx_assignments_lead on lead_assignments (lead_id, assigned_at desc);

-- =============================================================================
-- 4. WHATSAPP
-- =============================================================================

create table if not exists whatsapp_templates (
    id uuid primary key default uuid_generate_v4(),
    aisensy_template_name text not null unique,
    display_name text not null,
    language text not null default 'en',
    body text not null,
    variables jsonb not null default '[]',
    approved boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists whatsapp_messages (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid references leads(id) on delete set null,
    direction whatsapp_direction not null,
    phone text not null,
    aisensy_message_id text unique,
    template_id uuid references whatsapp_templates(id),
    body text,
    media_url text,
    status text,
    raw_payload jsonb,
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

comment on column whatsapp_messages.phone is 'PII';
comment on column whatsapp_messages.body is 'PII';

create index if not exists idx_wa_lead on whatsapp_messages (lead_id, created_at desc);
create index if not exists idx_wa_phone on whatsapp_messages (phone, created_at desc);

-- =============================================================================
-- 5. HMIS SYNC
-- =============================================================================

create table if not exists hmis_patient_sync (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    idempotency_key uuid not null unique,
    status sync_status not null default 'pending',
    hmis_patient_uhid text,
    request_payload jsonb,
    response_payload jsonb,
    error_message text,
    attempt_count int not null default 0,
    last_attempted_at timestamptz,
    synced_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_hmis_sync_lead on hmis_patient_sync (lead_id);
create index if not exists idx_hmis_sync_status on hmis_patient_sync (status) where status in ('pending', 'failed');

create table if not exists hmis_appointment_sync (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    hmis_appointment_id text not null,
    hmis_patient_uhid text,
    appointment_at timestamptz not null,
    doctor_id uuid references doctors(id),
    centre_id uuid references centres(id),
    status text,
    admission_id text,
    admitted_at timestamptz,
    discharged_at timestamptz,
    raw_payload jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_hmis_appt on hmis_appointment_sync (hmis_appointment_id);
create index if not exists idx_hmis_appt_lead on hmis_appointment_sync (lead_id);

-- =============================================================================
-- 6. SLA
-- =============================================================================

create table if not exists sla_policies (
    id uuid primary key default uuid_generate_v4(),
    code text not null unique,
    name text not null,
    target_secs int not null,
    applies_to_stage_id uuid references lead_stages(id),
    applies_to_source_id uuid references lead_sources(id),
    active boolean not null default true
);

create table if not exists sla_events (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    policy_id uuid not null references sla_policies(id),
    started_at timestamptz not null default now(),
    target_at timestamptz not null,
    resolved_at timestamptz,
    breached boolean not null default false,
    breach_secs int
);

create index if not exists idx_sla_open on sla_events (lead_id) where resolved_at is null;
create index if not exists idx_sla_breach on sla_events (breached, target_at) where resolved_at is null;

-- =============================================================================
-- 7. AUDIT LOG
-- =============================================================================

create table if not exists audit_log (
    id uuid primary key default uuid_generate_v4(),
    table_name text not null,
    row_id uuid,
    action text not null check (action in ('insert', 'update', 'delete', 'select_phi')),
    actor_id uuid,
    actor_role text,
    diff jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_table_row on audit_log (table_name, row_id, created_at desc);
create index if not exists idx_audit_actor on audit_log (actor_id, created_at desc);
create index if not exists idx_audit_created on audit_log (created_at desc);

-- =============================================================================
-- 8. TRIGGERS
-- =============================================================================

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
    for each row execute function set_updated_at();

drop trigger if exists trg_hmis_appt_updated_at on hmis_appointment_sync;
create trigger trg_hmis_appt_updated_at before update on hmis_appointment_sync
    for each row execute function set_updated_at();

create or replace function audit_row_change() returns trigger language plpgsql security definer as $$
declare
    v_action text;
    v_row_id uuid;
    v_diff jsonb;
begin
    if (tg_op = 'INSERT') then
        v_action := 'insert';
        v_row_id := (to_jsonb(new)->>'id')::uuid;
        v_diff := to_jsonb(new);
    elsif (tg_op = 'UPDATE') then
        v_action := 'update';
        v_row_id := (to_jsonb(new)->>'id')::uuid;
        v_diff := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
    elsif (tg_op = 'DELETE') then
        v_action := 'delete';
        v_row_id := (to_jsonb(old)->>'id')::uuid;
        v_diff := to_jsonb(old);
    end if;

    insert into audit_log (table_name, row_id, action, actor_id, diff)
    values (tg_table_name, v_row_id, v_action, auth.uid(), v_diff);

    if tg_op = 'DELETE' then return old; end if;
    return new;
end $$;

drop trigger if exists trg_audit_leads on leads;
create trigger trg_audit_leads after insert or update or delete on leads
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_activities on lead_activities;
create trigger trg_audit_activities after insert or update or delete on lead_activities
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_agents on agents;
create trigger trg_audit_agents after insert or update or delete on agents
    for each row execute function audit_row_change();

-- =============================================================================
-- 9. RLS HELPERS
-- =============================================================================

create or replace function is_admin() returns boolean language sql stable security definer as $$
    select exists (
        select 1 from agents
        where id = auth.uid() and role = 'admin' and active = true
    );
$$;

create or replace function is_manager() returns boolean language sql stable security definer as $$
    select exists (
        select 1 from agents
        where id = auth.uid() and role in ('admin', 'manager') and active = true
    );
$$;

create or replace function has_centre_access(p_centre uuid) returns boolean language sql stable security definer as $$
    select exists (
        select 1 from agents
        where id = auth.uid()
          and active = true
          and (role = 'admin' or p_centre = any(centre_access))
    );
$$;

create or replace function is_lead_owner(p_lead uuid) returns boolean language sql stable security definer as $$
    select exists (
        select 1 from leads l
        join agents a on a.id = auth.uid()
        where l.id = p_lead
          and a.active = true
          and (
              a.role = 'admin'
              or l.assigned_agent_id = a.id
              or (a.role = 'manager' and (l.centre_interest_id = any(a.centre_access)))
          )
    );
$$;

-- =============================================================================
-- 10. RLS POLICIES
-- =============================================================================

alter table centres enable row level security;
alter table specialties enable row level security;
alter table doctors enable row level security;
alter table agents enable row level security;
alter table lead_sources enable row level security;
alter table lead_stages enable row level security;
alter table lost_reasons enable row level security;
alter table campaigns enable row level security;
alter table leads enable row level security;
alter table lead_activities enable row level security;
alter table lead_stage_history enable row level security;
alter table lead_assignments enable row level security;
alter table whatsapp_templates enable row level security;
alter table whatsapp_messages enable row level security;
alter table hmis_patient_sync enable row level security;
alter table hmis_appointment_sync enable row level security;
alter table sla_policies enable row level security;
alter table sla_events enable row level security;
alter table audit_log enable row level security;

-- Reference tables: read by any authenticated agent, write by admin
do $$
declare t text;
begin
    foreach t in array array['centres','specialties','doctors','lead_sources','lead_stages','lost_reasons','campaigns','whatsapp_templates','sla_policies']
    loop
        execute format('drop policy if exists %I_select on %I', t||'_select', t);
        execute format('create policy %I on %I for select using (auth.uid() is not null)', t||'_select', t);
        execute format('drop policy if exists %I_write on %I', t||'_write', t);
        execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t||'_write', t);
    end loop;
end $$;

-- agents
drop policy if exists agents_select on agents;
create policy agents_select on agents for select
    using (is_manager() or id = auth.uid());

drop policy if exists agents_insert on agents;
create policy agents_insert on agents for insert
    with check (is_admin());

drop policy if exists agents_update on agents;
create policy agents_update on agents for update
    using (is_admin() or id = auth.uid())
    with check (is_admin() or id = auth.uid());

drop policy if exists agents_delete on agents;
create policy agents_delete on agents for delete
    using (is_admin());

-- leads
drop policy if exists leads_select on leads;
create policy leads_select on leads for select
    using (
        deleted_at is null
        and (
            is_admin()
            or is_lead_owner(id)
            or (centre_interest_id is not null and has_centre_access(centre_interest_id))
        )
    );

drop policy if exists leads_insert on leads;
create policy leads_insert on leads for insert
    with check (
        is_admin()
        or centre_interest_id is null
        or has_centre_access(centre_interest_id)
    );

drop policy if exists leads_update on leads;
create policy leads_update on leads for update
    using (is_lead_owner(id))
    with check (is_lead_owner(id));

drop policy if exists leads_delete on leads;
create policy leads_delete on leads for delete
    using (is_admin());

-- lead_activities
drop policy if exists activities_select on lead_activities;
create policy activities_select on lead_activities for select
    using (exists (select 1 from leads l where l.id = lead_id and (is_admin() or is_lead_owner(l.id))));

drop policy if exists activities_insert on lead_activities;
create policy activities_insert on lead_activities for insert
    with check (is_lead_owner(lead_id));

drop policy if exists activities_update on lead_activities;
create policy activities_update on lead_activities for update
    using (created_by = auth.uid() and created_at > now() - interval '15 minutes')
    with check (created_by = auth.uid());

drop policy if exists activities_delete on lead_activities;
create policy activities_delete on lead_activities for delete
    using (is_admin());

-- history tables: readable via lead access, inserted by server only (no user insert)
drop policy if exists stage_history_select on lead_stage_history;
create policy stage_history_select on lead_stage_history for select
    using (exists (select 1 from leads l where l.id = lead_id and (is_admin() or is_lead_owner(l.id))));

drop policy if exists assignments_select on lead_assignments;
create policy assignments_select on lead_assignments for select
    using (exists (select 1 from leads l where l.id = lead_id and (is_admin() or is_lead_owner(l.id))));

-- whatsapp_messages: via lead
drop policy if exists wa_select on whatsapp_messages;
create policy wa_select on whatsapp_messages for select
    using (
        is_admin()
        or (lead_id is not null and exists (select 1 from leads l where l.id = lead_id and is_lead_owner(l.id)))
    );

-- hmis sync tables: admin + manager readable, server writes
drop policy if exists hmis_patient_sync_select on hmis_patient_sync;
create policy hmis_patient_sync_select on hmis_patient_sync for select
    using (is_manager() or exists (select 1 from leads l where l.id = lead_id and is_lead_owner(l.id)));

drop policy if exists hmis_appt_sync_select on hmis_appointment_sync;
create policy hmis_appt_sync_select on hmis_appointment_sync for select
    using (is_manager() or exists (select 1 from leads l where l.id = lead_id and is_lead_owner(l.id)));

-- sla_events: via lead
drop policy if exists sla_events_select on sla_events;
create policy sla_events_select on sla_events for select
    using (is_manager() or exists (select 1 from leads l where l.id = lead_id and is_lead_owner(l.id)));

-- audit_log: admin only
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select
    using (is_admin());

-- =============================================================================
-- 11. SEED DATA
-- =============================================================================

insert into lead_stages (code, name, stage_order, is_terminal, is_won, is_lost) values
    ('new', 'New', 10, false, false, false),
    ('contacted', 'Contacted', 20, false, false, false),
    ('qualified', 'Qualified', 30, false, false, false),
    ('appointment_booked', 'Appointment Booked', 40, false, false, false),
    ('consulted', 'Consulted', 50, false, false, false),
    ('converted', 'Converted', 60, true, true, false),
    ('admitted', 'Admitted', 70, true, true, false),
    ('lost', 'Lost', 80, true, false, true),
    ('dormant', 'Dormant', 90, false, false, false)
on conflict (code) do nothing;

insert into lead_sources (code, name) values
    ('website_form', 'Website Form'),
    ('whatsapp_inbound', 'WhatsApp Inbound'),
    ('meta_lead_ad', 'Meta Lead Ad'),
    ('google_lead_ad', 'Google Lead Ad'),
    ('walk_in', 'Walk-in'),
    ('doctor_referral', 'Doctor Referral'),
    ('inbound_call', 'Inbound Call'),
    ('outbound_call', 'Outbound Call'),
    ('event', 'Event / Camp'),
    ('other', 'Other')
on conflict (code) do nothing;

insert into lost_reasons (code, name) values
    ('not_interested', 'Not interested'),
    ('price', 'Price / budget'),
    ('chose_competitor', 'Chose competitor'),
    ('distance', 'Distance / location'),
    ('no_response', 'No response'),
    ('duplicate', 'Duplicate lead'),
    ('spam', 'Spam / fake'),
    ('other', 'Other')
on conflict (code) do nothing;

insert into sla_policies (code, name, target_secs, applies_to_stage_id)
select 'first_response_new', 'First response on New lead', 900, s.id
from lead_stages s where s.code = 'new'
on conflict (code) do nothing;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
