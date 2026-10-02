-- Small-cap discovery intelligence and background scan persistence.

create table if not exists public.small_cap_candidates (
  symbol text primary key,
  company_name text,
  sector text,
  industry text,
  market_cap numeric,
  market_cap_class text,
  potential_score smallint check (potential_score between 0 and 100),
  estimated_outperformance_probability numeric(6,4)
    check (estimated_outperformance_probability between 0 and 1),
  probability_method text not null default 'heuristic_signal_v1',
  confidence text,
  evidence_coverage numeric(6,4),
  relationship_count integer not null default 0,
  risk_flags text[] not null default '{}',
  positives text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  last_scanned_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists small_cap_candidates_score_idx
  on public.small_cap_candidates (potential_score desc, last_scanned_at desc);
create index if not exists small_cap_candidates_sector_idx
  on public.small_cap_candidates (sector, potential_score desc);
create index if not exists small_cap_candidates_market_cap_idx
  on public.small_cap_candidates (market_cap);

drop trigger if exists small_cap_candidates_set_updated_at on public.small_cap_candidates;
create trigger small_cap_candidates_set_updated_at
before update on public.small_cap_candidates
for each row execute function public.set_updated_at();

alter table public.small_cap_candidates enable row level security;
revoke all on table public.small_cap_candidates from anon, authenticated;
grant all on table public.small_cap_candidates to service_role;

alter table public.market_refresh_jobs
  drop constraint if exists market_refresh_jobs_kind_check;
alter table public.market_refresh_jobs
  add constraint market_refresh_jobs_kind_check
  check (kind in ('quote','news','calendar','financials','relationships','small_caps'));
