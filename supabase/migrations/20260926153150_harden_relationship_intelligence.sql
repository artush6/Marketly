-- Harden shared trigger execution and cover relationship foreign keys.
alter function public.set_updated_at() set search_path = public, pg_temp;

create index if not exists company_relationships_news_idx
  on public.company_relationships (discovered_from_news_id)
  where discovered_from_news_id is not null;

create index if not exists workspace_market_trackers_symbol_idx
  on public.workspace_market_trackers (symbol);
