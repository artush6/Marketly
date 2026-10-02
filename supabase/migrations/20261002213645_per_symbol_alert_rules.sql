-- Per-account price and daily-move conditions checked by the market worker.
create table if not exists public.user_symbol_alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol = upper(symbol) and symbol ~ '^[A-Z0-9][A-Z0-9.:-]{0,19}$'),
  trigger_type text not null check (trigger_type in ('price', 'percent_change')),
  direction text not null check (direction in ('above', 'below')),
  threshold numeric(18, 6) not null check (threshold > 0),
  enabled boolean not null default true,
  last_observed_value numeric(18, 6),
  last_observed_session date,
  last_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trigger_type <> 'percent_change' or threshold <= 100),
  unique (user_id, symbol, trigger_type, direction, threshold)
);

create index if not exists user_symbol_alert_rules_active_idx
  on public.user_symbol_alert_rules(symbol, enabled)
  where enabled;

alter table public.user_symbol_alert_rules enable row level security;
revoke all on public.user_symbol_alert_rules from anon, authenticated;
grant all on public.user_symbol_alert_rules to service_role;
