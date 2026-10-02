# Marketly Supabase

Supabase provides Auth and Postgres persistence for account research state,
background refresh jobs, company relationships, small-cap discovery and alerts.
The backend uses the service-role key for server-side reads/writes to private
tables; the browser uses only the publishable key for Auth.

## Production project

The production project ref is `gffskqucpyujimxaqzrp`. The seven migrations below
are applied to it as of October 2, 2026. Confirm a project's migration history
before applying migrations to any other environment.

| Order | Migration | Purpose |
| --- | --- | --- |
| 1 | `20260925093816_background_market_refresh.sql` | Durable refresh queue and fenced job functions |
| 2 | `20260926094653_relationship_news_intelligence.sql` | Relationship evidence and news intelligence |
| 3 | `20260926153150_harden_relationship_intelligence.sql` | Relationship data hardening |
| 4 | `20260927161755_user_research_state.sql` | Per-account research state and RLS |
| 5 | `20261002102000_small_cap_discovery.sql` | Small-cap candidates and queue kind |
| 6 | `20261002103000_small_cap_scan_history.sql` | Candidate history and scan payloads |
| 7 | `20261002110000_background_alerts.sql` | Alert preferences, subscriptions and inbox |

For setup and deployment workflow, see [Account and deployment setup](../docs/account-and-deployment.md).
Follow Supabase's [database migration guide](https://supabase.com/docs/guides/deployment/database-migrations)
when reconciling local and remote migration history; do not mark an unapplied
migration as applied manually.

## Data ownership and security

- `user_research_state` owns signed-in preferences and watchlists by `auth.users.id`.
- `user_alert_preferences`, `web_push_subscriptions`, and
  `user_alert_notifications` store private alert settings, device endpoints and
  notification history. VAPID private keys are never stored in Supabase.
- `market_refresh_jobs`, `small_cap_candidates`, and
  `small_cap_candidate_snapshots` are server-managed data.
- Private tables enable RLS and revoke browser-role access where the backend's
  service role is the only intended data path.
- Provider data and derived research scores may be delayed or heuristic; they
  are not point-in-time historical calibration or investment forecasts.

Never commit credentials, production dumps, user data or provider exports.
