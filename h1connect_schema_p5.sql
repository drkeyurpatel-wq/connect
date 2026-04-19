-- =============================================================================
-- H1 Connect — Phase 5 schema (AI Intelligence Layer)
-- Target: Supabase Postgres (Health1 Tasks org, 7th project)
-- Spec: docs/phase5-spec.md (v1.0, 19 Apr 2026)
-- Layered on top of P1 schema. Apply after h1connect_schema_p1.sql.
-- ECC v4 compliant — RLS default deny, cost logging, prompt versioning, PII redaction.
-- =============================================================================

set search_path = public;

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

do $$ begin
    create type ai_provider as enum ('anthropic', 'openai', 'internal');
exception when duplicate_object then null; end $$;

do $$ begin
    create type recommendation_status as enum ('pending', 'shown', 'accepted', 'rejected', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
    create type churn_risk_band as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
    create type feedback_severity as enum ('info', 'minor', 'major', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
    create type anomaly_kind as enum (
        'referral_spike',
        'conversion_spike',
        'agent_close_outlier',
        'bot_submission',
        'ad_fraud',
        'other'
    );
exception when duplicate_object then null; end $$;

do $$ begin
    create type creative_channel as enum ('whatsapp', 'meta_ad', 'google_ad', 'email', 'sms', 'journey');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 2. PROMPT + INFERENCE INFRASTRUCTURE
-- =============================================================================

create table if not exists ai_prompts (
    id uuid primary key default uuid_generate_v4(),
    code text not null,
    version int not null,
    purpose text not null,
    model text not null,
    system_prompt text not null,
    user_template text not null,
    schema_json jsonb,
    created_at timestamptz not null default now(),
    created_by uuid references agents(id),
    active boolean not null default true,
    unique (code, version)
);

comment on table ai_prompts is 'Versioned prompt registry. Git-tracked source lives in /prompts/.';

create table if not exists ai_inference_log (
    id uuid primary key default uuid_generate_v4(),
    prompt_code text,
    prompt_version int,
    provider ai_provider not null,
    model text not null,
    purpose text not null,
    input_tokens int,
    output_tokens int,
    cost_inr numeric(10,4),
    latency_ms int,
    status text not null check (status in ('ok', 'error', 'redacted_skip', 'budget_blocked')),
    error text,
    subject_table text,
    subject_id uuid,
    created_at timestamptz not null default now(),
    created_by uuid references agents(id)
);

comment on table ai_inference_log is 'Every AI call logged for cost tracking + audit. No prompt/response bodies stored to avoid PHI leak.';

create index if not exists idx_ai_log_created on ai_inference_log (created_at desc);
create index if not exists idx_ai_log_purpose on ai_inference_log (purpose, created_at desc);
create index if not exists idx_ai_log_subject on ai_inference_log (subject_table, subject_id, created_at desc);

-- =============================================================================
-- 3. EMBEDDINGS (pgvector)
-- =============================================================================

create table if not exists embeddings (
    id uuid primary key default uuid_generate_v4(),
    subject_table text not null,
    subject_id uuid not null,
    kind text not null,
    content_hash text not null,
    model text not null default 'text-embedding-3-small',
    embedding vector(1536) not null,
    created_at timestamptz not null default now(),
    unique (subject_table, subject_id, kind, model)
);

create index if not exists idx_embeddings_lookup on embeddings (subject_table, subject_id);
create index if not exists idx_embeddings_hash on embeddings (content_hash);
-- ivfflat index created after sufficient rows exist (run ANALYZE first):
--   create index on embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- =============================================================================
-- 4. LEAD SCORING
-- =============================================================================

create table if not exists lead_score_models (
    id uuid primary key default uuid_generate_v4(),
    code text not null unique,
    version int not null,
    approach text not null check (approach in ('rules_v1', 'claude_hybrid_v1', 'xgb_v1', 'lightgbm_v1')),
    description text,
    feature_weights jsonb not null default '{}',
    active boolean not null default false,
    created_at timestamptz not null default now(),
    activated_at timestamptz
);

create table if not exists lead_scores (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    model_id uuid not null references lead_score_models(id),
    p2c numeric(5,4) not null check (p2c >= 0 and p2c <= 1),
    pltv numeric(12,2),
    feature_contributions jsonb not null default '{}',
    computed_at timestamptz not null default now(),
    unique (lead_id, model_id)
);

create index if not exists idx_lead_scores_lead on lead_scores (lead_id);
create index if not exists idx_lead_scores_p2c on lead_scores (p2c desc);
create index if not exists idx_lead_scores_pltv on lead_scores (pltv desc);

-- =============================================================================
-- 5. BEST-NEXT-ACTION RECOMMENDATIONS
-- =============================================================================

create table if not exists agent_recommendations (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    agent_id uuid references agents(id),
    action_code text not null,
    action_label text not null,
    rationale text not null,
    confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
    urgency text not null check (urgency in ('low', 'normal', 'high', 'now')),
    status recommendation_status not null default 'pending',
    shown_at timestamptz,
    acted_at timestamptz,
    outcome text,
    generated_by_prompt text,
    generated_at timestamptz not null default now(),
    expires_at timestamptz not null default now() + interval '1 hour'
);

create index if not exists idx_recs_lead on agent_recommendations (lead_id, generated_at desc);
create index if not exists idx_recs_agent on agent_recommendations (agent_id, status) where status in ('pending', 'shown');
create index if not exists idx_recs_expiry on agent_recommendations (expires_at) where status in ('pending', 'shown');

-- =============================================================================
-- 6. CHURN PREDICTION
-- =============================================================================

create table if not exists churn_predictions (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid not null references leads(id) on delete cascade,
    hmis_patient_uhid text,
    risk_score numeric(4,3) not null check (risk_score >= 0 and risk_score <= 1),
    risk_band churn_risk_band not null,
    top_reasons jsonb not null default '[]',
    suggested_intervention text,
    specialty_id uuid references specialties(id),
    computed_at timestamptz not null default now(),
    superseded_at timestamptz
);

create index if not exists idx_churn_lead on churn_predictions (lead_id, computed_at desc);
create index if not exists idx_churn_active on churn_predictions (risk_band, computed_at desc) where superseded_at is null;

-- =============================================================================
-- 7. CALL COACHING
-- =============================================================================

create table if not exists call_coaching_events (
    id uuid primary key default uuid_generate_v4(),
    lead_id uuid references leads(id) on delete set null,
    agent_id uuid references agents(id),
    call_ref text,
    event_kind text not null check (event_kind in (
        'sentiment_sample', 'suggestion_shown', 'suggestion_used',
        'suggestion_ignored', 'compliance_alert', 'post_call_note'
    )),
    payload jsonb not null default '{}',
    sentiment numeric(4,3),
    created_at timestamptz not null default now()
);

create index if not exists idx_coaching_lead on call_coaching_events (lead_id, created_at desc);
create index if not exists idx_coaching_agent on call_coaching_events (agent_id, created_at desc);
create index if not exists idx_coaching_call on call_coaching_events (call_ref, created_at);

-- =============================================================================
-- 8. AI CREATIVES
-- =============================================================================

create table if not exists ai_creatives_generated (
    id uuid primary key default uuid_generate_v4(),
    channel creative_channel not null,
    brief text not null,
    language text not null default 'en',
    tone text,
    variants jsonb not null,
    approved_variant_ids jsonb not null default '[]',
    compliance_flags jsonb not null default '[]',
    generated_by uuid references agents(id),
    generated_at timestamptz not null default now(),
    linked_template_id uuid references whatsapp_templates(id),
    linked_campaign_id uuid references campaigns(id),
    prompt_code text,
    prompt_version int
);

create index if not exists idx_creatives_channel on ai_creatives_generated (channel, generated_at desc);
create index if not exists idx_creatives_campaign on ai_creatives_generated (linked_campaign_id);

-- =============================================================================
-- 9. CAMPAIGN AUTO-OPTIMIZATION
-- =============================================================================

create table if not exists campaign_optimizations (
    id uuid primary key default uuid_generate_v4(),
    campaign_id uuid references campaigns(id),
    kind text not null check (kind in (
        'ab_variant_winner', 'send_time_shift', 'audience_tighten',
        'budget_reallocation', 'auto_pause', 'manual_override'
    )),
    decision jsonb not null,
    rationale text,
    confidence numeric(4,3),
    auto_applied boolean not null default false,
    applied_at timestamptz,
    reverted_at timestamptz,
    reverted_by uuid references agents(id),
    approval_required boolean not null default false,
    approved_by uuid references agents(id),
    approved_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_opt_campaign on campaign_optimizations (campaign_id, created_at desc);
create index if not exists idx_opt_pending on campaign_optimizations (approval_required, approved_at) where approval_required = true and approved_at is null;

-- =============================================================================
-- 10. CAPACITY FORECASTS
-- =============================================================================

create table if not exists capacity_forecasts (
    id uuid primary key default uuid_generate_v4(),
    centre_id uuid references centres(id),
    specialty_id uuid references specialties(id),
    horizon_days int not null check (horizon_days in (30, 60, 90)),
    kind text not null check (kind in ('opd_volume', 'ipd_admissions', 'revenue')),
    point_estimate numeric(14,2) not null,
    lower_bound numeric(14,2),
    upper_bound numeric(14,2),
    method text not null,
    inputs_snapshot jsonb not null default '{}',
    forecast_for_date date not null,
    generated_at timestamptz not null default now(),
    unique (centre_id, specialty_id, horizon_days, kind, forecast_for_date)
);

create index if not exists idx_forecast_centre on capacity_forecasts (centre_id, horizon_days, forecast_for_date desc);
create index if not exists idx_forecast_kind on capacity_forecasts (kind, forecast_for_date desc);

-- =============================================================================
-- 11. VOICE PATTERN MINING
-- =============================================================================

create table if not exists voice_pattern_clusters (
    id uuid primary key default uuid_generate_v4(),
    run_id uuid not null,
    cluster_label text not null,
    kind text not null check (kind in ('topic', 'objection', 'close_pattern', 'sentiment_hotspot')),
    size int not null,
    sample_phrases jsonb not null default '[]',
    centre_distribution jsonb not null default '{}',
    specialty_distribution jsonb not null default '{}',
    agent_distribution jsonb not null default '{}',
    first_seen_at timestamptz,
    last_seen_at timestamptz,
    centroid vector(1536),
    created_at timestamptz not null default now()
);

create index if not exists idx_voice_run on voice_pattern_clusters (run_id);
create index if not exists idx_voice_kind on voice_pattern_clusters (kind, size desc);

-- =============================================================================
-- 12. FEEDBACK CLASSIFICATION
-- =============================================================================

create table if not exists feedback_classifications (
    id uuid primary key default uuid_generate_v4(),
    source text not null check (source in ('nps_open_text', 'complaint', 'review', 'whatsapp_reply', 'email', 'other')),
    source_id uuid,
    lead_id uuid references leads(id) on delete set null,
    centre_id uuid references centres(id),
    topic text not null,
    sub_topic text,
    sentiment numeric(4,3),
    severity feedback_severity not null default 'info',
    suggested_owner text,
    routed_to uuid references agents(id),
    routed_at timestamptz,
    resolved_at timestamptz,
    resolution_notes text,
    original_text_hash text not null,
    classified_by_prompt text,
    prompt_version int,
    created_at timestamptz not null default now()
);

comment on column feedback_classifications.original_text_hash is 'sha256 hash; original PHI stored in source table, never duplicated here';

create index if not exists idx_feedback_topic on feedback_classifications (topic, severity, created_at desc);
create index if not exists idx_feedback_open on feedback_classifications (severity, resolved_at) where resolved_at is null;
create index if not exists idx_feedback_centre on feedback_classifications (centre_id, created_at desc);

-- =============================================================================
-- 13. DOCTOR REFERRAL INTELLIGENCE
-- =============================================================================

create table if not exists doctor_intelligence (
    id uuid primary key default uuid_generate_v4(),
    doctor_id uuid not null references doctors(id) on delete cascade,
    referral_velocity_30d numeric(10,2),
    referral_velocity_90d numeric(10,2),
    decay_ratio numeric(5,3),
    dormancy_risk numeric(4,3),
    next_tour_priority numeric(5,2),
    engagement_prompt text,
    similar_to jsonb not null default '[]',
    computed_at timestamptz not null default now(),
    unique (doctor_id)
);

create index if not exists idx_doc_intel_priority on doctor_intelligence (next_tour_priority desc);
create index if not exists idx_doc_intel_dormancy on doctor_intelligence (dormancy_risk desc);

-- =============================================================================
-- 14. ANOMALY DETECTION
-- =============================================================================

create table if not exists anomaly_findings (
    id uuid primary key default uuid_generate_v4(),
    kind anomaly_kind not null,
    severity text not null check (severity in ('info', 'warning', 'critical')),
    subject_table text,
    subject_id uuid,
    metric text not null,
    observed_value numeric,
    expected_value numeric,
    z_score numeric,
    window_start timestamptz,
    window_end timestamptz,
    details jsonb not null default '{}',
    reviewed_at timestamptz,
    reviewed_by uuid references agents(id),
    reviewer_verdict text check (reviewer_verdict in ('true_positive', 'false_positive', 'needs_info') or reviewer_verdict is null),
    created_at timestamptz not null default now()
);

create index if not exists idx_anom_kind on anomaly_findings (kind, created_at desc);
create index if not exists idx_anom_open on anomaly_findings (severity, reviewed_at) where reviewed_at is null;

-- =============================================================================
-- 15. BUDGET CAPS
-- =============================================================================

create table if not exists ai_budget_caps (
    id uuid primary key default uuid_generate_v4(),
    purpose text not null unique,
    daily_cap_inr numeric(10,2) not null,
    monthly_cap_inr numeric(10,2) not null,
    alert_threshold_pct int not null default 80 check (alert_threshold_pct between 1 and 100),
    hard_stop boolean not null default true,
    active boolean not null default true,
    updated_at timestamptz not null default now(),
    updated_by uuid references agents(id)
);

-- =============================================================================
-- 16. TRIGGERS
-- =============================================================================

drop trigger if exists trg_budget_caps_updated_at on ai_budget_caps;
create trigger trg_budget_caps_updated_at before update on ai_budget_caps
    for each row execute function set_updated_at();

drop trigger if exists trg_audit_recommendations on agent_recommendations;
create trigger trg_audit_recommendations after insert or update or delete on agent_recommendations
    for each row execute function audit_row_change();

drop trigger if exists trg_audit_optimizations on campaign_optimizations;
create trigger trg_audit_optimizations after insert or update or delete on campaign_optimizations
    for each row execute function audit_row_change();

-- =============================================================================
-- 17. RLS
-- =============================================================================

alter table ai_prompts enable row level security;
alter table ai_inference_log enable row level security;
alter table embeddings enable row level security;
alter table lead_score_models enable row level security;
alter table lead_scores enable row level security;
alter table agent_recommendations enable row level security;
alter table churn_predictions enable row level security;
alter table call_coaching_events enable row level security;
alter table ai_creatives_generated enable row level security;
alter table campaign_optimizations enable row level security;
alter table capacity_forecasts enable row level security;
alter table voice_pattern_clusters enable row level security;
alter table feedback_classifications enable row level security;
alter table doctor_intelligence enable row level security;
alter table anomaly_findings enable row level security;
alter table ai_budget_caps enable row level security;

-- prompts: read by any agent, write by admin
drop policy if exists ai_prompts_select on ai_prompts;
create policy ai_prompts_select on ai_prompts for select using (auth.uid() is not null);
drop policy if exists ai_prompts_write on ai_prompts;
create policy ai_prompts_write on ai_prompts for all using (is_admin()) with check (is_admin());

-- inference log: admin only
drop policy if exists ai_log_select on ai_inference_log;
create policy ai_log_select on ai_inference_log for select using (is_admin());

-- embeddings: manager+
drop policy if exists embeddings_select on embeddings;
create policy embeddings_select on embeddings for select using (is_manager());

-- score models: read by any agent, admin writes
drop policy if exists lsm_select on lead_score_models;
create policy lsm_select on lead_score_models for select using (auth.uid() is not null);
drop policy if exists lsm_write on lead_score_models;
create policy lsm_write on lead_score_models for all using (is_admin()) with check (is_admin());

-- lead scores: via lead access
drop policy if exists ls_select on lead_scores;
create policy ls_select on lead_scores for select
    using (exists (select 1 from leads l where l.id = lead_id and (is_admin() or is_lead_owner(l.id))));

-- recommendations: via lead access (agent sees own + assigned)
drop policy if exists recs_select on agent_recommendations;
create policy recs_select on agent_recommendations for select
    using (
        is_admin()
        or (agent_id = auth.uid())
        or exists (select 1 from leads l where l.id = lead_id and is_lead_owner(l.id))
    );

drop policy if exists recs_update on agent_recommendations;
create policy recs_update on agent_recommendations for update
    using (agent_id = auth.uid() or is_admin())
    with check (agent_id = auth.uid() or is_admin());

-- churn predictions: manager+ or lead owner
drop policy if exists churn_select on churn_predictions;
create policy churn_select on churn_predictions for select
    using (is_manager() or exists (select 1 from leads l where l.id = lead_id and is_lead_owner(l.id)));

-- coaching events: agent sees self; manager sees team; admin all
drop policy if exists coach_select on call_coaching_events;
create policy coach_select on call_coaching_events for select
    using (is_admin() or is_manager() or agent_id = auth.uid());

-- creatives: manager + admin
drop policy if exists creatives_select on ai_creatives_generated;
create policy creatives_select on ai_creatives_generated for select using (is_manager());
drop policy if exists creatives_insert on ai_creatives_generated;
create policy creatives_insert on ai_creatives_generated for insert with check (is_manager());

-- campaign optimizations: manager + admin
drop policy if exists opt_select on campaign_optimizations;
create policy opt_select on campaign_optimizations for select using (is_manager());
drop policy if exists opt_update on campaign_optimizations;
create policy opt_update on campaign_optimizations for update using (is_manager()) with check (is_manager());

-- forecasts: manager + admin
drop policy if exists forecast_select on capacity_forecasts;
create policy forecast_select on capacity_forecasts for select using (is_manager());

-- voice clusters: manager + admin
drop policy if exists voice_select on voice_pattern_clusters;
create policy voice_select on voice_pattern_clusters for select using (is_manager());

-- feedback: manager or owner-of-related-lead
drop policy if exists feedback_select on feedback_classifications;
create policy feedback_select on feedback_classifications for select
    using (
        is_manager()
        or (lead_id is not null and exists (select 1 from leads l where l.id = lead_id and is_lead_owner(l.id)))
    );

-- doctor intelligence: manager+
drop policy if exists doc_intel_select on doctor_intelligence;
create policy doc_intel_select on doctor_intelligence for select using (is_manager());

-- anomaly findings: admin only
drop policy if exists anom_select on anomaly_findings;
create policy anom_select on anomaly_findings for select using (is_admin());
drop policy if exists anom_update on anomaly_findings;
create policy anom_update on anomaly_findings for update using (is_admin()) with check (is_admin());

-- budget caps: admin only
drop policy if exists budget_select on ai_budget_caps;
create policy budget_select on ai_budget_caps for select using (is_admin());
drop policy if exists budget_write on ai_budget_caps;
create policy budget_write on ai_budget_caps for all using (is_admin()) with check (is_admin());

-- =============================================================================
-- 18. SEED
-- =============================================================================

insert into lead_score_models (code, version, approach, description, feature_weights, active, activated_at) values
    ('p2c_rules_v1', 1, 'rules_v1', 'Rules + weighted heuristics baseline', '{
        "source.meta_lead_ad": 0.10,
        "source.google_lead_ad": 0.10,
        "source.doctor_referral": 0.25,
        "source.website_form": 0.08,
        "priority.urgent": 0.15,
        "priority.high": 0.08,
        "has_email": 0.04,
        "has_complaint": 0.06,
        "has_centre_interest": 0.05,
        "has_specialty_interest": 0.05,
        "whatsapp_in_reply": 0.10
    }'::jsonb, true, now())
on conflict (code, version) do nothing;

insert into ai_budget_caps (purpose, daily_cap_inr, monthly_cap_inr, alert_threshold_pct, hard_stop) values
    ('lead_score', 500, 10000, 80, true),
    ('best_next_action', 800, 18000, 80, true),
    ('churn_predict', 300, 6000, 80, true),
    ('feedback_classify', 400, 8000, 80, true),
    ('creative_generate', 1000, 20000, 80, false),
    ('voice_mining', 600, 12000, 80, true),
    ('anomaly_scan', 200, 4000, 80, true),
    ('call_coaching', 1500, 30000, 90, false)
on conflict (purpose) do nothing;

-- =============================================================================
-- END OF P5 SCHEMA
-- =============================================================================
