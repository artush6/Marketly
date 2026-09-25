-- Durable, service-only jobs. No user watchlists or credentials are public.
create table if not exists public.market_refresh_jobs (
  kind text not null check (kind in ('quote','news','calendar','financials')),
  symbol text not null,
  next_run_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  attempts integer not null default 0,
  last_success_at timestamptz,
  last_error text,
  active_until timestamptz not null default now() + interval '30 days',
  primary key (kind, symbol)
);
alter table public.market_refresh_jobs enable row level security;
revoke all on public.market_refresh_jobs from anon, authenticated;
grant all on public.market_refresh_jobs to service_role;
create index if not exists market_refresh_due on public.market_refresh_jobs(next_run_at);

create or replace function public.enqueue_market_refresh(p_kind text, p_symbol text, p_due timestamptz default now())
returns void language sql set search_path = public as $$
  insert into public.market_refresh_jobs(kind, symbol, next_run_at)
  values (p_kind, p_symbol, p_due)
  on conflict (kind, symbol) do update set active_until = now() + interval '30 days';
$$;

-- SKIP LOCKED and a fenced lease allow several API workers to run safely.
create or replace function public.claim_market_refresh()
returns setof public.market_refresh_jobs language sql set search_path = public as $$
  update public.market_refresh_jobs j set lease_until = now() + interval '15 minutes',
    lease_token = gen_random_uuid(), attempts = attempts + 1
  where (j.kind, j.symbol) in (
    select kind, symbol from public.market_refresh_jobs
    where next_run_at <= now() and active_until > now()
      and (lease_until is null or lease_until < now())
    order by next_run_at for update skip locked limit 1
  ) returning j.*;
$$;

create or replace function public.finish_market_refresh(
  p_kind text, p_symbol text, p_token uuid, p_next timestamptz, p_error text default null
) returns void language sql set search_path = public as $$
  update public.market_refresh_jobs set next_run_at = p_next,
    lease_until = null, lease_token = null,
    last_success_at = case when p_error is null then now() else last_success_at end,
    last_error = p_error, attempts = case when p_error is null then 0 else attempts end
  where kind = p_kind and symbol = p_symbol and lease_token = p_token;
$$;

revoke execute on function public.enqueue_market_refresh(text,text,timestamptz) from public, anon, authenticated;
revoke execute on function public.claim_market_refresh() from public, anon, authenticated;
revoke execute on function public.finish_market_refresh(text,text,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.enqueue_market_refresh(text,text,timestamptz) to service_role;
grant execute on function public.claim_market_refresh() to service_role;
grant execute on function public.finish_market_refresh(text,text,uuid,timestamptz,text) to service_role;

create or replace function public.register_market_symbols(p_symbols text[])
returns void language sql set search_path = public as $$
  insert into public.market_refresh_jobs(kind, symbol)
  select kind, symbol from unnest(p_symbols) symbol
  cross join unnest(array['quote','calendar','financials']) kind
  where kind = 'quote' or symbol not in ('SPY','QQQ','DIA','IWM')
  on conflict (kind, symbol) do update set active_until = now() + interval '30 days';
$$;
revoke execute on function public.register_market_symbols(text[]) from public, anon, authenticated;
grant execute on function public.register_market_symbols(text[]) to service_role;
