-- Private, durable settings and delivery state for opt-in Marketly alerts.
create table if not exists public.user_alert_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  price_drop_thresholds smallint[] not null default array[3,5,10]::smallint[],
  important_news_enabled boolean not null default true,
  discovery_enabled boolean not null default true,
  discovery_min_score smallint not null default 70 check (discovery_min_score between 0 and 100),
  updated_at timestamptz not null default now(),
  check (cardinality(price_drop_thresholds) between 1 and 3),
  check (price_drop_thresholds <@ array[3,5,10]::smallint[])
);

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists web_push_subscriptions_user_idx
  on public.web_push_subscriptions(user_id);

create table if not exists public.user_alert_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('price_move','important_news','discovery')),
  symbol text,
  severity text not null default 'notice' check (severity in ('notice','important','critical')),
  title text not null,
  body text not null,
  target_url text not null default '/alerts',
  explanation jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz
);
create index if not exists user_alert_notifications_user_created_idx
  on public.user_alert_notifications(user_id, created_at desc);

alter table public.user_alert_preferences enable row level security;
alter table public.web_push_subscriptions enable row level security;
alter table public.user_alert_notifications enable row level security;
revoke all on public.user_alert_preferences, public.web_push_subscriptions,
  public.user_alert_notifications from anon, authenticated;
grant all on public.user_alert_preferences, public.web_push_subscriptions,
  public.user_alert_notifications to service_role;

-- Start a bounded weekly US small-cap scan so discovery alerts do not depend
-- on someone opening the dashboard first.
insert into public.market_refresh_jobs
  (kind, symbol, next_run_at, active_until, input_payload, attempts, last_error)
values
  ('small_caps', 'MARKET', now(), now() + interval '30 days',
   '{"name":"small-cap-us","min_market_cap":50000000,"max_market_cap":2000000000,"min_average_volume":100000,"countries":["US"],"deep_limit":10}'::jsonb,
   0, null)
on conflict (kind, symbol) do nothing;

-- Subscribe followed tickers to bounded price, news, calendar and filing refreshes.
create or replace function public.register_market_symbols(p_symbols text[])
returns void language sql set search_path = public as $$
  insert into public.market_refresh_jobs(kind, symbol)
  select kind, symbol from unnest(p_symbols) symbol
  cross join unnest(array['quote','news','calendar','financials','relationships']) kind
  where kind in ('quote','news')
     or symbol not in ('SPY','QQQ','DIA','IWM','GLD','SLV','BNO','VGK','EWG','EWQ','EWU','EWJ','EEM')
  on conflict (kind, symbol) do update set active_until = now() + interval '30 days';
$$;
revoke execute on function public.register_market_symbols(text[]) from public, anon, authenticated;
grant execute on function public.register_market_symbols(text[]) to service_role;
