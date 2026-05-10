# Scenario Layer

This layer builds possible futures for the stock.

## What This Layer Does

Scenarios answer:

> What could happen next, how likely is each path, and what evidence would change our mind?

## File

```text
scenarios/
└── service.py
```

## How It Works

The current design is hybrid:

```text
deterministic signal summary
  -> GPT scenario generation
  -> validation and normalization
  -> deterministic fallback if GPT fails
```

## How It Does It

First, the service builds a `signalSummary` from structured inputs.

It includes:

- business model
- growth trend
- margin trend
- valuation richness
- balance-sheet risk
- news tone counts
- catalyst intensity
- market regime
- beta
- retention risk
- anomaly flags

Then it calls `generate_scenarios(...)` in `app/integrations/gpt.py`. GPT receives the signal summary and must return structured JSON.

After GPT responds, the service validates the cases:

```python
cases = _normalize_cases(scenarios.get("cases"))
```

Normalization:

- drops invalid cases
- requires thesis text
- converts probabilities to floats
- normalizes probabilities to sum to `1.0`
- limits evidence and trigger lists

If GPT fails or returns unusable output, `_fallback_scenarios(...)` creates deterministic bull/base/bear cases from the business model.

## Inputs

```python
build_scenarios(
    business_model,
    interpretation,
    event_layer,
    history_context,
    ticker_data=ticker_data,
    scoring_metrics=scoring_metrics,
    news_data=news_data,
    economic_data=economic_data,
    market_context=market_context,
)
```

## Output

Example:

```json
{
  "source": "openai",
  "asymmetry": "upside can overshoot before fundamentals catch up",
  "anomalyFlags": ["bullish market can extend valuation beyond fundamental support"],
  "cases": [
    {
      "name": "momentum melt-up",
      "probability": 0.35,
      "confidence": "medium",
      "thesis": "Risk-on demand keeps pulling valuation higher.",
      "mustGoRight": ["Positive catalysts keep arriving."],
      "breaksIf": ["Growth evidence fails to follow the price move."],
      "probabilityRationale": "Narrative momentum has the highest near-term weight.",
      "keyEvidence": ["Positive catalysts are visible."],
      "watchlistTriggers": ["Analyst tone changes."]
    }
  ]
}
```

## Why GPT Is Used Here

Scenario writing needs synthesis.

The backend can calculate:

- valuation is rich
- growth is weak
- market is risk-on
- beta is high
- news tone is positive

GPT can turn that into:

> Momentum melt-up

That is a useful model task because the backend supplies the evidence.

## Guardrails

The service:

- requires valid cases
- normalizes probabilities to sum to 1.0
- limits list sizes
- adds anomaly flags
- falls back to deterministic scenarios when GPT output is invalid

## Tradeoff

Scenario probabilities are analyst-style weights, not mathematically proven odds.
