# Research workspace

The `/` route is Marketly's signed-in research workspace. It combines a market
overview, company research, company and market news, calendar, small-cap
discovery, comparison, saved research and account settings. The older
`/assistant` route remains available for company-focused conversation.

## Current behavior

- Account authentication uses Supabase sessions; email/password, email-code and
  password-reset flows are available. Google appears only when its Supabase
  provider is configured and `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` is deployed.
- Research preferences and watchlists sync to the signed-in account. Unsupported
  or missing provider values remain unavailable instead of being invented.
- Company comparisons show selected-company values; they are not industry-wide
  aggregates unless a view explicitly says so.
- Background alerts are account-scoped. Price changes use the provider's daily
  move against prior close and can be delayed; a related headline is not proof
  of a cause. Discovery scores and probabilities are heuristic, uncalibrated
  research signals, not forecasts.
- User settings and account flows are protected; the login, callback and reset
  routes remain reachable while signed out.

## Alert subscriptions

The alert page has an in-app inbox and push preferences for 3%, 5% and 10% daily
drops across watched symbols, important followed-company news and bounded
small-cap discovery candidates. On each company page, **Set alert** saves an
account-level absolute price or custom daily percentage rule; a rule can also add
that ticker to the general watchlist. Ticker news must mention the company in its
headline or opening summary sentence, reducing false matches from incidental
mentions later in a story. These are trigger rules and sourced research signals,
not future-return forecasts or trading instructions. Web Push requires VAPID
keys on the FastAPI service. On iPhone, add Marketly to the Home
Screen in Safari, open the installed web app, then allow and enable notifications
from Alerts. Each device subscribes separately. See
[Account and deployment setup](../docs/account-and-deployment.md).

## Development and validation

From this directory, `npm run dev` starts FastAPI and Next.js together after the
backend environment is installed. Run `npm run build` for a production build and
`npm run lint` for ESLint. The API, database migration, and hosting setup are
documented in the root README and linked operations guide.
