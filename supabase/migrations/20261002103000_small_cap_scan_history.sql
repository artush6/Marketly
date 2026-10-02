-- Extend an already-deployed small-cap scan with immutable score history and
-- profile-aware durable queue input. Keep this separate from the original
-- discovery migration so installations that already applied it receive these
-- additions normally.

create table if not exists public.small_cap_candidate_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.small_cap_candidates(symbol) on delete cascade,
  scanned_at timestamptz not null,
  method_version text not null,
  potential_score smallint check (potential_score between 0 and 100),
  risk_score smallint check (risk_score between 0 and 100),
  evidence_coverage numeric(6,4) check (evidence_coverage between 0 and 1),
  estimated_outperformance_probability numeric(6,4)
    check (estimated_outperformance_probability between 0 and 1),
  probability_method text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (symbol, scanned_at)
);

create index if not exists small_cap_candidate_snapshots_history_idx
  on public.small_cap_candidate_snapshots (symbol, scanned_at desc);

alter table public.small_cap_candidate_snapshots enable row level security;
revoke all on table public.small_cap_candidate_snapshots from anon, authenticated;
grant all on table public.small_cap_candidate_snapshots to service_role;

alter table public.market_refresh_jobs
  add column if not exists input_payload jsonb not null default '{}'::jsonb;

create or replace function public.enqueue_small_cap_scan(p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.market_refresh_jobs
    (kind, symbol, next_run_at, active_until, input_payload, attempts, last_error)
  values
    ('small_caps', 'MARKET', now(), now() + interval '30 days', p_payload, 0, null)
  on conflict (kind, symbol) do update set
    next_run_at = now(),
    active_until = now() + interval '30 days',
    input_payload = excluded.input_payload,
    attempts = 0,
    last_error = null
  where public.market_refresh_jobs.lease_until is null
     or public.market_refresh_jobs.lease_until < now();
  return found;
end;
$$;

revoke execute on function public.enqueue_small_cap_scan(jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_small_cap_scan(jsonb) to service_role;
