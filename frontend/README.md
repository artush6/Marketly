# Marketly Frontend

Marketly's frontend is a Next.js 16 App Router app. The signed-in workspace
contains company and market research, financials, discovery, saved research,
calendar, settings and an alert inbox. Supabase SSR handles browser sessions;
Next.js proxies authenticated requests to the FastAPI backend.

## Local development

From this directory:

```bash
npm install
cp .env.example .env.local
npm run dev
```

The dev launcher starts and health-checks the backend at `127.0.0.1:8000`
before Next.js at `localhost:3000`. Install backend dependencies and configure
`backend/.env` first; see the root README. Stop the launcher to stop both
processes.

## Frontend environment

```text
NEXT_PUBLIC_API_URL=/api/backend
BACKEND_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false
NEXT_PUBLIC_AUTH_APPLE_ENABLED=false
```

The Supabase URL and publishable key are public client configuration. OAuth
feature flags only show the corresponding button; enable a provider in Supabase
Auth and configure its redirect URLs before turning the flag on. Never put a
service-role key or VAPID private key in this file or any `NEXT_PUBLIC_` value.

## Main routes and modules

- `/`: market and research workspace
- `/login`, `/auth/callback`, `/reset-password`: account flows
- `/alerts`: account-scoped alerts and per-device push setup
- `/calendar`, `/compare`, `/financials/[symbol]`: research views
- `src/app/api/backend/[...path]/route.ts`: authenticated FastAPI proxy
- `src/components/research/`: workspace views and company research
- `src/components/account/account-provider.tsx`: session and account state
- `src/lib/supabase/`: browser/server Supabase clients

For deployment, migrations, email/Google configuration and iPhone notifications,
see [Account and deployment setup](../docs/account-and-deployment.md).

## Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```
