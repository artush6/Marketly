-- Public market data remains shared; personal workspace records are owner-only.
create table public.user_research_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key ~ '^marketly[.A-Za-z0-9_-]{1,100}$'),
  value text check (octet_length(value) <= 2000000),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_research_state enable row level security;
revoke all on public.user_research_state from anon;
grant select, insert, update, delete on public.user_research_state to authenticated;
create policy "Read own workspace" on public.user_research_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own workspace" on public.user_research_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own workspace" on public.user_research_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own workspace" on public.user_research_state for delete to authenticated using ((select auth.uid()) = user_id);
