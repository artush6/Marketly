# Marketly

Marketly is a **full-stack stock portfolio web app** built with **Next.js (frontend)** and **Python FastAPI (backend)**.
It centralizes everything you need to track and analyze your investments: **financials, economic indicators, AI-driven analysis, and news** — all in one clean interface.

---

## 🚀 Features

* **Unified Dashboard** – View portfolio metrics, stock financials, and market data in one place.
* **AI Analysis** – GPT-powered insights to better understand companies and macroeconomic trends.
* **Live News** – Aggregated and filtered articles related to your portfolio.
* **Economic Data** – Key indicators and macro context to support investment decisions.
* **Modern Stack** – Built with Next.js, FastAPI, and Supabase for a smooth developer & user experience.

---

## 🛠️ Tech Stack

**Frontend (Next.js / TypeScript)**

* Next.js App Router
* TailwindCSS (planned)
* API integration via `lib/api.ts`

**Backend (Python / FastAPI)**

* FastAPI for routes & APIs
* Data fetching via `yfinance`, FMP, Finnhub, and FRED
* GPT integration for stock analysis (`app/integrations/gpt.py`)

**Database & Infra**

* Supabase (Postgres, auth, storage)
* Optional Redis caching when `REDIS_URL` is configured

---

## 📂 Project Structure

### Backend (`/backend`)

```
backend/
├── app
│   ├── main.py              # FastAPI entrypoint
│   ├── routes/              # HTTP endpoints
│   ├── integrations/        # External APIs + data fetchers
│   ├── services/            # Cross-source business logic
│   ├── models.py            # Typed backend models
│   ├── serialization.py     # Shared JSON-safe serializer helper
│   └── core/                # Shared config + cache wrapper
├── ARCHITECTURE.md          # Quick map of the live backend
├── run.py                   # Dev server runner
```

### Frontend (`/frontend/src`)

```
frontend/src/
├── app/           # Next.js App Router
├── components/    # Reusable UI components
├── hooks/         # Custom React hooks
├── lib/           # API utils
```

---

## ⚡ Getting Started

### Prerequisites

* **Node.js** (>= 18)
* **Python** (>= 3.11, 3.13 recommended)
* **Supabase account** (if using DB features)

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # on Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will run at:

* **Frontend:** `http://localhost:3000`
* **Backend API:** `http://localhost:8000`

For a quick backend orientation, see `backend/ARCHITECTURE.md`.

---

## 🤝 Contributing

This is an early-stage project. Contributions, ideas, and feedback are welcome!

---

## 📜 License

MIT License – feel free to use, modify, and share.
