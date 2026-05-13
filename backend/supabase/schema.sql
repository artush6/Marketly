create table if not exists public.market_data_cache (
    id uuid primary key default gen_random_uuid(),
    namespace text not null,
    cache_key text not null,
    payload jsonb not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (namespace, cache_key)
);

create index if not exists market_data_cache_namespace_expires_idx
    on public.market_data_cache (namespace, expires_at desc);

alter table public.market_data_cache enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_market_data_cache_updated_at on public.market_data_cache;

create trigger set_market_data_cache_updated_at
before update on public.market_data_cache
for each row
execute function public.set_updated_at();

create table if not exists public.market_data_snapshots (
    id uuid primary key default gen_random_uuid(),
    kind text not null,
    entity_key text not null,
    payload jsonb not null,
    provenance jsonb not null default '{}'::jsonb,
    period_end date,
    fetched_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists market_data_snapshots_latest_idx
    on public.market_data_snapshots (kind, entity_key, fetched_at desc);

create index if not exists market_data_snapshots_period_idx
    on public.market_data_snapshots (kind, entity_key, period_end desc);

alter table public.market_data_snapshots enable row level security;

create table if not exists public.companies (
    symbol text primary key,
    name text,
    sector text,
    industry text,
    country text,
    currency text,
    first_seen_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.financial_statement_rows (
    id uuid primary key default gen_random_uuid(),
    symbol text not null,
    statement_type text not null,
    period text,
    fiscal_year integer,
    period_end date,
    filed_at date,
    source text not null,
    payload jsonb not null,
    fetched_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (symbol, statement_type, period_end, source)
);

create table if not exists public.financial_metrics (
    id uuid primary key default gen_random_uuid(),
    symbol text not null,
    metric_key text not null,
    metric_value double precision,
    period_end date,
    source text not null,
    provenance jsonb not null default '{}'::jsonb,
    fetched_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (symbol, metric_key, period_end, source)
);

create table if not exists public.macro_observations (
    id uuid primary key default gen_random_uuid(),
    series_name text not null,
    observation_date date not null,
    value double precision,
    source text not null default 'fred',
    fetched_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (series_name, observation_date, source)
);

create table if not exists public.news_articles (
    id uuid primary key default gen_random_uuid(),
    symbol text not null,
    external_id text,
    headline text,
    summary text,
    url text,
    source text,
    published_at timestamptz,
    payload jsonb not null,
    fetched_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (symbol, external_id)
);

create table if not exists public.analysis_runs (
    analysis_id text primary key,
    symbol text not null,
    analysis_version text not null,
    score integer,
    payload jsonb not null,
    data_sources jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists financial_statement_rows_symbol_period_idx
    on public.financial_statement_rows (symbol, period_end desc);

create index if not exists financial_metrics_symbol_key_period_idx
    on public.financial_metrics (symbol, metric_key, period_end desc);

create index if not exists macro_observations_series_date_idx
    on public.macro_observations (series_name, observation_date desc);

create index if not exists news_articles_symbol_published_idx
    on public.news_articles (symbol, published_at desc);

create index if not exists analysis_runs_symbol_created_idx
    on public.analysis_runs (symbol, created_at desc);

alter table public.companies enable row level security;
alter table public.financial_statement_rows enable row level security;
alter table public.financial_metrics enable row level security;
alter table public.macro_observations enable row level security;
alter table public.news_articles enable row level security;
alter table public.analysis_runs enable row level security;
