# Marketly Frontend

Marketly is a Next.js App Router frontend for a market-intelligence workflow. It combines:

- a workspace-style analysis surface for company and catalyst prompts
- backend-powered financial and scoring data
- follow-up Q&A on the active symbol
- a dedicated financials drill-down route for statement coverage

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Environment

Create `.env.local` with any frontend overrides you need.

```bash
NEXT_PUBLIC_API_URL=/api/backend
BACKEND_API_URL=https://your-backend-url
```

`NEXT_PUBLIC_API_URL` controls the browser-facing base URL.

`BACKEND_API_URL` controls the Next.js proxy route target used by `src/app/api/backend/[...path]/route.ts`.

## App Structure

- `src/app/page.tsx`: main analysis workspace
- `src/app/financials/[symbol]/page.tsx`: financial drill-down
- `src/app/api/backend/[...path]/route.ts`: backend proxy
- `src/lib/marketly-analysis.ts`: data shaping from backend payloads into UI-ready blocks
- `src/components/marketly/*`: primary product UI components

## Current UX Principles

- keep the main workspace calm and dense instead of dashboard-card heavy
- expose backend coverage and missing-data states clearly
- preserve recent prompts and current analysis context locally
- make financial drill-downs reachable without losing the active thesis
