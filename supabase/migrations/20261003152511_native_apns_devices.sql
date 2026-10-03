-- Native APNs device tokens are private and are only managed by the FastAPI service role.
create table if not exists public.apns_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_token text not null check (device_token ~ '^[0-9a-fA-F]{64,512}$'),
  environment text not null check (environment in ('development', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (device_token, environment)
);

create index if not exists apns_push_devices_user_idx
  on public.apns_push_devices(user_id);

alter table public.apns_push_devices enable row level security;
revoke all on public.apns_push_devices from anon, authenticated;
grant all on public.apns_push_devices to service_role;
