# Marketly

Marketly is a full-stack market-intelligence app for researching public companies. It combines a Next.js analysis workspace with a FastAPI backend that fetches provider data, normalizes company facts, scores financial quality, and uses GPT to turn structured evidence into readable investment analysis.

The current product includes:

- a calm, workspace-style frontend for company prompts and ticker analysis
- financial statement drill-downs by symbol
- backend-powered scoring across profitability, growth, stability, and valuation
- business-model classification, event catalysts, scenarios, and trajectory layers
- follow-up Q&A against the active symbol, score payload, financials, and news
- Supabase-backed accounts, private research state, discovery and alert delivery
- configurable per-ticker price and daily-move alerts with background checks
- password, email-code and optional Google sign-in with account recovery

## Repository Layout

```text
.
├── backend/              # FastAPI API, data integrations, analysis pipeline, tests
├── frontend/             # Next.js App Router frontend
├── supabase/             # SQL schema and persistence notes
└── README.md             # Project-level setup and orientation
```

More detailed docs live in:

- `backend/ARCHITECTURE.md` for the backend analysis pipeline
- `frontend/README.md` for frontend development notes
- `supabase/README.md` for database migrations and data ownership
- `docs/account-and-deployment.md` for Vercel, Render, Supabase Auth and push setup
- `backend/app/**/README.md` for layer-specific backend notes

## Tech Stack

Frontend:

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Radix UI primitives, lucide-react icons, Recharts, and lightweight-charts
- Next.js API proxy at `src/app/api/backend/[...path]/route.ts`

Backend:

- Python 3.13 with FastAPI and Uvicorn
- Pydantic models and explicit response schemas
- Financial, news, macro, and GPT integrations
- Optional Redis cache when `REDIS_URL` is configured
- Pytest test coverage for analysis, facts, scoring, routes, and layers

Data and infrastructure:

- Supabase Auth/Postgres for account identity and private research state
- Supabase-backed durable refresh and alert queues
- Provider support through Finnhub, FMP, RapidAPI/yfinance paths, FRED, Event Registry, and OpenAI

## Backend Overview

The backend is designed as an analysis pipeline rather than a thin wrapper around external APIs.

```text
provider data
  -> normalized ticker model
  -> fact graph and coverage checks
  -> financial metrics and scoring
  -> business-model classification
  -> interpretation, events, history, scenarios, trajectory
  -> GPT narrative
  -> typed API response
```

Important backend directories:

```text
backend/app/
├── core/          # config, cache, errors, symbol normalization
├── integrations/  # financials, economics, news, GPT
├── routes/        # FastAPI route modules
├── schemas/       # public API response contracts
├── services/      # analysis, facts, scoring, scenarios, trajectory, etc.
├── main.py        # FastAPI app setup
├── models.py      # internal typed backend models
└── serialization.py
```

Primary endpoints:

- `GET /healthz`
- `GET /financials/{symbol}`
- `GET /news/{symbol}`
- `GET /score/{symbol}?refresh=false`
- `POST /assistant/follow-up`
- `GET /economics`
- `/notifications` for signed-in alert inbox, preferences and push devices

## Frontend Overview

The frontend is a Next.js App Router app in `frontend/`.

Important frontend files:

```text
frontend/src/
├── app/page.tsx                         # main analysis workspace
├── app/financials/[symbol]/page.tsx     # financial drill-down route
├── app/api/backend/[...path]/route.ts   # backend proxy
├── components/marketly/                 # primary product UI
└── lib/
    ├── api.ts                           # typed backend client
    └── marketly-analysis.ts             # backend payload shaping
```

By default the browser talks to `/api/backend`, and that Next.js route proxies to the FastAPI backend.

## Local Development

### Prerequisites

- Node.js 20.9 or newer
- Python 3.13 recommended
- Provider keys for the data/features you want to use; Supabase is required for account sync and alerts

### Install and run

```text
cd backend
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
cd ../frontend
npm install
cp .env.example .env.local
npm run dev
```

`npm run dev` starts and health-checks FastAPI at `http://127.0.0.1:8000`, then
starts Next.js at `http://localhost:3000`. Both stop together. Set
`MARKETLY_PYTHON` only if you need a non-default Python interpreter. Add the
needed provider and Supabase values to `backend/.env`; add frontend public keys
to `frontend/.env.local` as described in [Account and deployment setup](docs/account-and-deployment.md).

```text
NEXT_PUBLIC_API_URL=/api/backend
BACKEND_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Do not put Supabase service-role or VAPID private keys in the frontend or any
`NEXT_PUBLIC_` variable.

## Useful Commands

Backend:

```bash
cd backend
python run.py
pytest
black .
isort .
ruff check .
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run start
npm run lint
```

## Persistence

Supabase stores per-user research state, alert preferences, push subscriptions,
notifications, market refresh jobs, cached data and discovery scan history.
Private account tables use RLS and are accessed by the backend service role; the
frontend uses the Supabase publishable key for Auth. The broader long-term
analysis-evidence model is documented separately and is not all implemented.

See [Supabase migrations](supabase/README.md) and [account/deployment setup](docs/account-and-deployment.md).

## Development Notes

- Keep finance logic in `backend/app/services`, not in route handlers.
- Keep provider-specific cleanup in `backend/app/integrations`.
- Treat GPT as the narrative layer over structured evidence, not the only calculator.
- Keep frontend data shaping in `frontend/src/lib/marketly-analysis.ts` so UI components stay focused on presentation.
- The root README is a project map; deeper implementation details belong in the package and layer READMEs.

## License

No license file is currently committed.
