# Integrations Layer

`app/integrations` is where Marketly talks to the outside world.

## What This Layer Does

Integrations answer:

> What did external providers send us?

This layer fetches data from:

- financial providers
- news providers
- macroeconomic providers
- OpenAI

## Files

```text
integrations/
├── economics.py
├── financials.py
├── gpt.py
└── news.py
```

## How It Works

`financials.py` aggregates stock profile, quote, statement, valuation, and analyst data from configured providers.

`news.py` fetches company news.

`economics.py` fetches macro time series from FRED.

`gpt.py` calls OpenAI for final analysis, scenario generation, and follow-up answers.

## How It Does It

`financials.py` tries configured providers, collects partial payloads, and merges them into a common `TickerData`-compatible shape:

```python
{
  "info": {...},
  "quote": {...},
  "financials": {
    "income_statement": [...],
    "balance_sheet": [...],
    "cash_flow": [...]
  },
  "sources": {...}
}
```

It uses defensive helpers such as `safe_get(...)`, `safe_update(...)`, and provider-specific extractors so one failed endpoint does not crash the whole analysis.

`economics.py` asks FRED for known indicator series, resamples them monthly, and returns compact date/value arrays.

`news.py` fetches recent Finnhub company news and caches it by symbol and lookback window.

`gpt.py` builds compact JSON payloads, sends them to OpenAI with a strict JSON schema, parses the response, sanitizes it, and returns an error dictionary instead of crashing for normal model failures.

## Design Rule

Integrations should fetch and lightly normalize provider data, but they should not decide whether a stock is good.

Good:

```python
payload = fetch_ticker_financials("AAPL")
```

Not good:

```python
payload["investment_view"] = "attractive"
```

That judgment belongs in services.

## Why This Separation Matters

Provider APIs are messy:

- field names differ
- units differ
- some endpoints fail silently
- some data is stale or incomplete

Keeping this mess inside `integrations` protects the analysis engine from provider-specific details.

## Tradeoff

Provider calls currently fail softly in many places. This keeps the app alive, but can hide provider problems. Observability should improve over time.
