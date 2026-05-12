# Marketly

Marketly is a full-stack market-intelligence app for researching public companies. It combines a Next.js analysis workspace with a FastAPI backend that fetches provider data, normalizes company facts, scores financial quality, and uses GPT to turn structured evidence into readable investment analysis.

The current product centers on:

- a calm, workspace-style frontend for company prompts and ticker analysis
- financial statement drill-downs by symbol
- backend-powered scoring across profitability, growth, stability, and valuation
- business-model classification, event catalysts, scenarios, and trajectory layers
- follow-up Q&A against the active symbol, score payload, financials, and news
- a Supabase schema direction for persisting analysis runs and their evidence

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
- `supabase/README.md` for the database schema direction
- `backend/app/**/README.md` for layer-specific backend notes

## Tech Stack

Frontend:

- Next.js 15 App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Radix UI primitives, lucide-react icons, Recharts, and lightweight-charts
- Next.js API proxy at `src/app/api/backend/[...path]/route.ts`

Backend:

- Python 3.11+ with FastAPI and Uvicorn
- Pydantic models and explicit response schemas
- Financial, news, macro, and GPT integrations
- Optional Redis cache when `REDIS_URL` is configured
- Pytest test coverage for analysis, facts, scoring, routes, and layers

Data and infrastructure:

- Supabase/Postgres schema design for persisted analysis runs
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

- Node.js 18+
- Python 3.11+; Python 3.13 matches the backend tooling config
- API keys for the provider features you plan to use
- Redis and Supabase are optional for local development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

The backend runs at `http://127.0.0.1:8000`.

Fill in the relevant keys in `backend/.env`:

```text
REDIS_URL=
FINNHUB_API_KEY=
FMP_API_KEY=
FMPSDK_API_KEY=
RAPIDAPI_KEY=
FRED_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano-2025-08-07
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

Optional `frontend/.env.local`:

```text
NEXT_PUBLIC_API_URL=/api/backend
BACKEND_API_URL=http://127.0.0.1:8000
```

`NEXT_PUBLIC_API_URL` controls the browser-facing API base. `BACKEND_API_URL` controls the server-side proxy target used by the Next.js backend route.

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

## Current Persistence Direction

The Supabase schema is designed to store analysis evidence, not just final summaries. The main planned entities include:

- companies
- source documents
- fact snapshots and fact values
- analysis snapshots
- computed metrics
- scenarios and trajectory horizons
- research jobs

See `supabase/README.md` and `supabase/schema.sql` for the current schema notes.

## Development Notes

- Keep finance logic in `backend/app/services`, not in route handlers.
- Keep provider-specific cleanup in `backend/app/integrations`.
- Treat GPT as the narrative layer over structured evidence, not the only calculator.
- Keep frontend data shaping in `frontend/src/lib/marketly-analysis.ts` so UI components stay focused on presentation.
- The root README is a project map; deeper implementation details belong in the package and layer READMEs.

## License

No license file is currently committed.
