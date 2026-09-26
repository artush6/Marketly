-- Relationship intelligence, ranked news, and persisted market-tape choices.
-- All writes are service-only. Public clients consume these records through FastAPI.

alter table public.companies
  add column if not exists id uuid not null default gen_random_uuid(),
  add column if not exists employee_count integer,
  add column if not exists founded_year integer,
  add column if not exists ipo_date date,
  add column if not exists chief_executive text,
  add column if not exists headquarters text,
  add column if not exists office_locations jsonb not null default '[]'::jsonb,
  add column if not exists company_description text,
  add column if not exists profile_payload jsonb not null default '{}'::jsonb;

-- The first Marketly schema used symbol as the companies primary key. Keep it
-- intact for existing foreign keys while providing a stable surrogate key for
-- relationship records and backend lookups.
create unique index if not exists companies_id_key on public.companies (id);

alter table public.news_articles
  add column if not exists importance_score smallint not null default 1
    check (importance_score between 1 and 5),
  add column if not exists importance_label text not null default 'routine'
    check (importance_label in ('routine', 'notable', 'important', 'critical')),
  add column if not exists relationship_signal boolean not null default false,
  add column if not exists relationship_type text,
  add column if not exists related_company_name text,
  add column if not exists related_symbol text,
  add column if not exists skimmed_at timestamptz;

create index if not exists news_articles_importance_idx
  on public.news_articles (symbol, importance_score desc, published_at desc);
create index if not exists news_articles_relationship_signal_idx
  on public.news_articles (symbol, published_at desc)
  where relationship_signal;

create table if not exists public.company_relationships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  related_company_id uuid references public.companies(id) on delete set null,
  related_company_name text not null,
  related_symbol text,
  relationship_type text not null
    check (relationship_type in ('supplier', 'customer', 'partner', 'competitor', 'investor', 'subsidiary', 'other')),
  direction text not null default 'undirected'
    check (direction in ('incoming', 'outgoing', 'mutual', 'undirected')),
  product_service text,
  evidence_summary text not null,
  source_url text not null,
  source_date date,
  confidence numeric(5,4) not null default 0.7
    check (confidence between 0 and 1),
  discovered_from_news_id uuid references public.news_articles(id) on delete set null,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_verified_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, related_company_name, relationship_type, source_url)
);

create index if not exists company_relationships_company_idx
  on public.company_relationships (company_id, relationship_type, last_verified_at desc);
create index if not exists company_relationships_related_company_idx
  on public.company_relationships (related_company_id)
  where related_company_id is not null;
create index if not exists company_relationships_related_symbol_idx
  on public.company_relationships (related_symbol)
  where related_symbol is not null;

drop trigger if exists company_relationships_set_updated_at on public.company_relationships;
create trigger company_relationships_set_updated_at
before update on public.company_relationships
for each row execute function public.set_updated_at();

create table if not exists public.market_instruments (
  symbol text primary key,
  name text not null,
  asset_class text not null,
  region text,
  proxy_note text,
  default_order smallint not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.market_instruments (symbol, name, asset_class, region, proxy_note, default_order)
values
  ('SPY', 'S&P 500', 'equity_index', 'United States', 'ETF proxy', 10),
  ('DIA', 'Dow Jones', 'equity_index', 'United States', 'ETF proxy', 20),
  ('QQQ', 'Nasdaq 100', 'equity_index', 'United States', 'ETF proxy', 30),
  ('IWM', 'Russell 2000', 'equity_index', 'United States', 'ETF proxy', 40),
  ('GLD', 'Gold', 'commodity', 'Global', 'ETF proxy', 50),
  ('SLV', 'Silver', 'commodity', 'Global', 'ETF proxy', 60),
  ('BNO', 'Brent crude', 'commodity', 'Global', 'ETF proxy', 70),
  ('VGK', 'Europe', 'equity_index', 'Europe', 'ETF proxy', 80),
  ('EWG', 'Germany', 'equity_index', 'Europe', 'ETF proxy', 90),
  ('EWQ', 'France', 'equity_index', 'Europe', 'ETF proxy', 100),
  ('EWU', 'United Kingdom', 'equity_index', 'Europe', 'ETF proxy', 110),
  ('EWJ', 'Japan', 'equity_index', 'Asia', 'ETF proxy', 120),
  ('EEM', 'Emerging markets', 'equity_index', 'Global', 'ETF proxy', 130)
on conflict (symbol) do update set
  name = excluded.name,
  asset_class = excluded.asset_class,
  region = excluded.region,
  proxy_note = excluded.proxy_note,
  default_order = excluded.default_order,
  active = true;

create table if not exists public.workspace_market_trackers (
  workspace_key uuid not null,
  symbol text not null references public.market_instruments(symbol) on delete cascade,
  sort_order smallint not null default 100,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_key, symbol)
);

create index if not exists workspace_market_trackers_order_idx
  on public.workspace_market_trackers (workspace_key, sort_order, symbol);

drop trigger if exists workspace_market_trackers_set_updated_at on public.workspace_market_trackers;
create trigger workspace_market_trackers_set_updated_at
before update on public.workspace_market_trackers
for each row execute function public.set_updated_at();

alter table public.company_relationships enable row level security;
alter table public.market_instruments enable row level security;
alter table public.workspace_market_trackers enable row level security;

revoke all on table public.company_relationships from anon, authenticated;
revoke all on table public.market_instruments from anon, authenticated;
revoke all on table public.workspace_market_trackers from anon, authenticated;
grant all on table public.company_relationships to service_role;
grant all on table public.market_instruments to service_role;
grant all on table public.workspace_market_trackers to service_role;

-- The existing fenced queue executes this job. Each active company is rechecked
-- every fourteen days; news refreshes can promote the job sooner.
alter table public.market_refresh_jobs
  drop constraint if exists market_refresh_jobs_kind_check;
alter table public.market_refresh_jobs
  add constraint market_refresh_jobs_kind_check
  check (kind in ('quote','news','calendar','financials','relationships'));

create or replace function public.register_market_symbols(p_symbols text[])
returns void language sql set search_path = public as $$
  insert into public.market_refresh_jobs(kind, symbol)
  select kind, symbol from unnest(p_symbols) symbol
  cross join unnest(array['quote','calendar','financials','relationships']) kind
  where kind = 'quote' or symbol not in ('SPY','QQQ','DIA','IWM','GLD','SLV','BNO','VGK','EWG','EWQ','EWU','EWJ','EEM')
  on conflict (kind, symbol) do update set active_until = now() + interval '30 days';
$$;
revoke execute on function public.register_market_symbols(text[]) from public, anon, authenticated;
grant execute on function public.register_market_symbols(text[]) to service_role;
