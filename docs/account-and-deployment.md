# Account, deployment and notifications setup

This is the operational guide for the current Marketly app. Production runs the
Next.js frontend on Vercel, the FastAPI API and refresh loop on Render, and
accounts/durable state on Supabase. The Render API process runs the background
refresh worker in its FastAPI lifespan when `BACKGROUND_REFRESH_ENABLED=true`;
a separate worker service is not required for the current setup.

## Supabase

The production project ref is `gffskqucpyujimxaqzrp`. The app uses these
migrations, in dependency order:

1. `20260925093816_background_market_refresh.sql`
2. `20260926094653_relationship_news_intelligence.sql`
3. `20260926153150_harden_relationship_intelligence.sql`
4. `20260927161755_user_research_state.sql`
5. `20261002102000_small_cap_discovery.sql`
6. `20261002103000_small_cap_scan_history.sql`
7. `20261002110000_background_alerts.sql`

All seven are applied to the production project as of October 2, 2026. For a new
Supabase environment, check its migration history before applying any schema;
then apply missing migrations in order using the repository's Supabase workflow.
See [Supabase's migration guide](https://supabase.com/docs/guides/deployment/database-migrations).

Configure these values in the indicated hosting environment:

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Supabase project URL used by browser auth |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel | Public browser Auth key; safe to expose |
| `SUPABASE_URL` | Render | Backend Supabase project URL |
| `SUPABASE_ANON_KEY` | Render | Backend token verification/config |
| `SUPABASE_SERVICE_ROLE_KEY` | Render only | Private server-side persistence; never expose to the browser |
| `BACKGROUND_REFRESH_ENABLED` | Render | Keep `true` to run the durable refresh loop |

Use the same project URL and matching keys across frontend and backend. Do not
commit credentials or put a service-role key in any `NEXT_PUBLIC_` variable.

## Sign-in and account recovery

Users create their own accounts; the app has no pre-created root/admin login.
The login page supports email/password, email-code sign-in and password reset.
Google sign-in is shown only when enabled in the frontend build and configured
in Supabase Auth.

For each production or preview frontend host, add its callback URL to Supabase
Auth's allowed redirect URLs:

```text
https://<your-frontend-host>/auth/callback
http://localhost:3000/auth/callback
```

For Google OAuth, configure the **Supabase callback** as Google's authorized
redirect URI (not the Marketly callback):

```text
https://gffskqucpyujimxaqzrp.supabase.co/auth/v1/callback
```

Enter the Google client ID and client secret in Supabase Auth's Google provider
settings. Set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` in Vercel only after the
provider credentials and redirect URLs are correct, then redeploy Next.js.
Keep OAuth secrets in Supabase, never in frontend variables. For email codes and
password resets, Supabase must be able to send email; its default sending limits
are suitable for testing, while regular production use should have a configured
SMTP provider.

## Web Push alerts

Marketly stores alert preferences and notifications in Supabase and sends pushes
from the Render backend using Web Push. Push is optional; the in-app alert inbox
works without push keys. The worker checks followed tickers and configured news
and discovery signals while the Render service is running. Provider updates may
be delayed, and daily price movement is measured against the previous close.

Generate one VAPID key pair locally:

```bash
npx --yes web-push generate-vapid-keys --json
```

Set the returned `publicKey` and `privateKey` in the Render backend environment:

```text
VAPID_PUBLIC_KEY=<generated publicKey>
VAPID_PRIVATE_KEY=<generated privateKey>
VAPID_SUBJECT=mailto:<contact-email-you-monitor>
```

The subject is contact information for browser push services; it does not send
Marketly emails or control sign-in. Keep the private key in Render only. Restart
or redeploy the backend after setting these values. The Render blueprint declares
the VAPID variables but intentionally does not include secret values.

To subscribe a device, sign in, follow at least one company, open **Alerts**, and
press **Enable this device** from a secure HTTPS origin. On iPhone, web push is
available to Home Screen web apps on iOS 16.4 or later: in Safari choose
**Share → Add to Home Screen**, launch Marketly from its Home Screen icon, then
enable notifications in Marketly. Grant the iOS notification permission when
asked. A normal Safari tab alone is not sufficient for iPhone Web Push. Subscribe
each device separately and use **Send test notification** to verify delivery.

## Deployment order

1. Confirm the Supabase migration history and environment keys.
2. Deploy the FastAPI service on Render with Supabase credentials and
   `BACKGROUND_REFRESH_ENABLED=true`.
3. Add the VAPID values to Render if push is required, then restart the service.
4. Deploy the Next.js frontend on Vercel with its Supabase URL/publishable key
   and provider feature flags.
5. Test account creation, sign-in, password recovery, Google if enabled, and a
   push test on each device.

The codebase does not bundle secrets, guarantee provider data freshness, or
calibrate discovery probabilities against historical outcomes.
