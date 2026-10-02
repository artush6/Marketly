# Research workspace upgrade — project note

This file replaces the September 27, 2026 implementation plan. That document's
“blocked” account and cloud-persistence notes described an earlier Supabase
outage and are no longer current. Use the root README and
[Account and deployment setup](account-and-deployment.md) for live setup and
deployment instructions.

## Implemented

- Next.js market/research workspace, ticker research, comparisons, calendar,
  company and world news, saved research and small-cap discovery.
- Supabase account sign-in with email/password, email code, password recovery
  and optional Google OAuth, plus account-scoped research preferences/watchlists.
- FastAPI bearer-token verification and service-role persistence for private
  user state.
- Supabase-backed alert preferences, inbox, per-device Web Push subscriptions,
  followed-stock move alerts, important-news alerts and small-cap discoveries.
- One Render FastAPI service that also runs the durable refresh worker when
  `BACKGROUND_REFRESH_ENABLED=true`.

## External setup that remains account-specific

- Production Vercel and Render environment variables must be present and match
  the intended Supabase project.
- Google sign-in requires a valid Google OAuth client in Supabase and
  `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` in the deployed frontend.
- Web Push requires a VAPID pair and contact subject in Render; each browser or
  device must separately grant notification permission and subscribe.
- Provider availability and email delivery limits depend on configured
  accounts/credentials. These integrations are not proven by a local build.

See the [investor-intelligence audit](investor-intelligence/audit.md) for the
longer product roadmap and the [background refresh guide](background-refresh.md)
for worker cadence and data freshness notes. Historical snapshots and plans are
not deployment instructions.
