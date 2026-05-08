-- Marketly Supabase schema
-- Purpose:
-- - persist normalized company facts
-- - store analysis snapshots and reasoning layers
-- - track events, catalysts, and historical analogs
-- - support deep onboarding jobs and refresh jobs
--
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core company registry
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  exchange text,
  company_name text,
  sector text,
  industry text,
  country text,
  currency text,
  business_model_primary text,
  business_model_secondary text[] not null default '{}',
  business_model_confidence numeric(5,4),
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists companies_symbol_idx on public.companies (symbol);
create index if not exists companies_business_model_idx on public.companies (business_model_primary);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();


create table if not exists public.company_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  alias text not null,
  alias_type text not null default 'common_name',
  created_at timestamptz not null default timezone('utc', now()),
  unique (company_id, alias),
  unique (alias)
);

create index if not exists company_aliases_company_id_idx on public.company_aliases (company_id);

-- ---------------------------------------------------------------------------
-- Raw ingest / source memory
-- ---------------------------------------------------------------------------

create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type text not null,
  source_name text,
  title text,
  url text,
  published_at timestamptz,
  content_hash text,
  payload jsonb not null default '{}'::jsonb,
  summary text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (company_id, source_type, content_hash)
);

create index if not exists source_documents_company_id_idx on public.source_documents (company_id);
create index if not exists source_documents_source_type_idx on public.source_documents (source_type);
create index if not exists source_documents_published_at_idx on public.source_documents (published_at desc);

-- ---------------------------------------------------------------------------
-- Fact graph persistence
-- ---------------------------------------------------------------------------

create table if not exists public.fact_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  snapshot_date date not null default current_date,
  snapshot_ts timestamptz not null default timezone('utc', now()),
  fact_coverage numeric(5,4) not null default 0,
  fact_field_count integer not null default 0,
  fact_field_total integer not null default 0,
  inferred_fact_count integer not null default 0,
  conflicting_fact_count integer not null default 0,
  weak_fact_fields text[] not null default '{}',
  fact_graph jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists fact_snapshots_company_id_idx on public.fact_snapshots (company_id);
create index if not exists fact_snapshots_company_snapshot_ts_idx on public.fact_snapshots (company_id, snapshot_ts desc);


create table if not exists public.fact_values (
  id uuid primary key default gen_random_uuid(),
  fact_snapshot_id uuid not null references public.fact_snapshots(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  fact_key text not null,
  fact_value jsonb,
  source_name text,
  confidence numeric(5,4) not null default 0,
  inferred boolean not null default false,
  alternatives jsonb not null default '[]'::jsonb,
  notes text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  unique (fact_snapshot_id, fact_key)
);

create index if not exists fact_values_company_id_idx on public.fact_values (company_id);
create index if not exists fact_values_fact_key_idx on public.fact_values (fact_key);
create index if not exists fact_values_company_fact_key_idx on public.fact_values (company_id, fact_key);

-- ---------------------------------------------------------------------------
-- Event / catalyst memory
-- ---------------------------------------------------------------------------

create table if not exists public.company_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_name text not null,
  event_type text not null,
  event_date date,
  event_status text not null default 'observed',
  importance text not null default 'medium',
  tone text,
  pre_event_narrative text,
  post_event_outcome text,
  market_reaction_1d numeric(10,4),
  market_reaction_1w numeric(10,4),
  market_reaction_1m numeric(10,4),
  business_impact text,
  notes text,
  source_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists company_events_company_id_idx on public.company_events (company_id);
create index if not exists company_events_company_event_date_idx on public.company_events (company_id, event_date desc);
create index if not exists company_events_event_type_idx on public.company_events (event_type);

drop trigger if exists company_events_set_updated_at on public.company_events;
create trigger company_events_set_updated_at
before update on public.company_events
for each row execute function public.set_updated_at();


create table if not exists public.catalyst_watch (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  catalyst_name text not null,
  catalyst_type text not null,
  horizon text,
  expected_window_start date,
  expected_window_end date,
  importance text not null default 'medium',
  thesis text,
  what_to_monitor text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists catalyst_watch_company_id_idx on public.catalyst_watch (company_id);
create index if not exists catalyst_watch_status_idx on public.catalyst_watch (status);
create index if not exists catalyst_watch_expected_window_idx on public.catalyst_watch (expected_window_start, expected_window_end);

drop trigger if exists catalyst_watch_set_updated_at on public.catalyst_watch;
create trigger catalyst_watch_set_updated_at
before update on public.catalyst_watch
for each row execute function public.set_updated_at();


create table if not exists public.historical_analogs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  analog_label text not null,
  analog_type text not null,
  reference_company text,
  reference_event text,
  reference_period text,
  rationale text,
  lessons text[] not null default '{}',
  confidence numeric(5,4) not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists historical_analogs_company_id_idx on public.historical_analogs (company_id);
create index if not exists historical_analogs_analog_type_idx on public.historical_analogs (analog_type);

-- ---------------------------------------------------------------------------
-- Analysis snapshots
-- ---------------------------------------------------------------------------

create table if not exists public.analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fact_snapshot_id uuid references public.fact_snapshots(id) on delete set null,
  run_type text not null default 'deep_research',
  analysis_source text not null default 'openai',
  score integer,
  summary text,
  positives text[] not null default '{}',
  negatives text[] not null default '{}',
  profitability jsonb not null default '{}'::jsonb,
  growth jsonb not null default '{}'::jsonb,
  stability jsonb not null default '{}'::jsonb,
  valuation jsonb not null default '{}'::jsonb,
  business_model jsonb not null default '{}'::jsonb,
  interpretation jsonb not null default '{}'::jsonb,
  event_catalysts jsonb not null default '{}'::jsonb,
  history_context jsonb not null default '{}'::jsonb,
  scenarios jsonb not null default '{}'::jsonb,
  trajectory jsonb not null default '{}'::jsonb,
  full_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analysis_snapshots_company_id_idx on public.analysis_snapshots (company_id);
create index if not exists analysis_snapshots_company_created_at_idx on public.analysis_snapshots (company_id, created_at desc);
create index if not exists analysis_snapshots_run_type_idx on public.analysis_snapshots (run_type);


create table if not exists public.analysis_scenarios (
  id uuid primary key default gen_random_uuid(),
  analysis_snapshot_id uuid not null references public.analysis_snapshots(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  case_name text not null,
  probability numeric(6,4),
  confidence text,
  thesis text not null,
  must_go_right text[] not null default '{}',
  breaks_if text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  unique (analysis_snapshot_id, case_name)
);

create index if not exists analysis_scenarios_analysis_snapshot_id_idx on public.analysis_scenarios (analysis_snapshot_id);
create index if not exists analysis_scenarios_company_id_idx on public.analysis_scenarios (company_id);


create table if not exists public.analysis_horizons (
  id uuid primary key default gen_random_uuid(),
  analysis_snapshot_id uuid not null references public.analysis_snapshots(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  horizon text not null,
  outlook text,
  drivers text[] not null default '{}',
  risks text[] not null default '{}',
  focus text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (analysis_snapshot_id, horizon)
);

create index if not exists analysis_horizons_analysis_snapshot_id_idx on public.analysis_horizons (analysis_snapshot_id);
create index if not exists analysis_horizons_company_id_idx on public.analysis_horizons (company_id);

-- ---------------------------------------------------------------------------
-- Operational job tracking
-- ---------------------------------------------------------------------------

create table if not exists public.research_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  priority integer not null default 100,
  requested_by text,
  trigger_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists research_jobs_company_id_idx on public.research_jobs (company_id);
create index if not exists research_jobs_status_priority_idx on public.research_jobs (status, priority, created_at);
create index if not exists research_jobs_job_type_idx on public.research_jobs (job_type);

drop trigger if exists research_jobs_set_updated_at on public.research_jobs;
create trigger research_jobs_set_updated_at
before update on public.research_jobs
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Optional portfolio / tracked names
-- ---------------------------------------------------------------------------

create table if not exists public.tracked_companies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tracking_status text not null default 'active',
  notes text,
  added_at timestamptz not null default timezone('utc', now()),
  unique (company_id)
);

create index if not exists tracked_companies_status_idx on public.tracked_companies (tracking_status);

-- ---------------------------------------------------------------------------
-- Suggested first onboarding workflow
-- ---------------------------------------------------------------------------
-- 1. insert into public.companies(symbol, company_name, ...)
-- 2. insert aliases into public.company_aliases
-- 3. insert row into public.research_jobs(job_type='initial_deep_research')
-- 4. research worker writes:
--    - fact_snapshots + fact_values
--    - company_events
--    - historical_analogs
--    - catalyst_watch
--    - analysis_snapshots + analysis_scenarios + analysis_horizons
