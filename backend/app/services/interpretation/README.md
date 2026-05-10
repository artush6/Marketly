# Interpretation Layer

This layer turns metrics into finance meaning.

## What This Layer Does

Interpretation answers:

> Why do the facts and metrics matter for this specific type of company?

## File

```text
interpretation/
└── service.py
```

## Inputs

```python
build_interpretation_layer(
    ticker_data,
    fact_graph,
    scoring_metrics,
    business_model,
)
```

## How It Does It

The layer pulls key metrics from the scoring blocks:

- gross margin
- operating margin
- revenue growth
- debt to equity
- debt ratio
- trailing P/E
- price to sales
- cash-flow hints

It then applies business-model-aware thresholds.

Example:

```python
if primary_model == "hardware_ecosystem":
    margin_quality = _label_from_score(gross_margin, high_threshold=0.4, low_threshold=0.22)
```

The same gross margin can receive a different interpretation depending on the model. A 45% gross margin is strong for hardware, but not special for pure SaaS.

Finally it turns labels into strengths, risks, and critical unknowns that GPT and scenarios can reuse.

## Output

Example:

```json
{
  "summary": "hardware ecosystem economics suggest strong margins and high valuation sensitivity.",
  "marginQuality": {"label": "strong", "detail": "Gross margin reflects pricing power."},
  "growthDurability": {"label": "mixed", "detail": "Growth depends on upgrade timing."},
  "valuationDependency": {"label": "high", "detail": "The stock discounts a strong future."},
  "criticalUnknowns": ["Installed-base retention is not modeled directly."]
}
```

## Why This Layer Exists

Numbers do not explain themselves.

A high P/E can mean:

- overvaluation
- high expected growth
- temporarily depressed earnings
- catalyst-driven optimism

The interpretation layer explains the meaning in context.

## Why This Is Better Than Asking GPT Directly

The backend creates consistent labels such as `strong`, `mixed`, `weak`, `high`, `moderate`, and `low`.

GPT can then explain those labels instead of inventing a different framework every request.

## Tradeoff

The rules are still heuristic. They encode finance judgment, but they are not statistically optimized.
