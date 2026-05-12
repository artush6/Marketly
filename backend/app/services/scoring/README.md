# Scoring Metrics Layer

This layer calculates financial metrics.

## What This Layer Does

Scoring metrics answer:

> What does the financial math say?

This layer owns both the metric blocks and the deterministic composite score used by `/score/{symbol}`. GPT explains the score, but the backend now computes the number.

## Files

```text
scoring/
├── composite.py
├── growth.py
├── metrics.py
├── profitability.py
├── stability.py
└── valuation.py
```

## Metric Groups

Profitability:

- gross margin
- operating margin
- net margin
- EBITDA margin
- ROE

Growth:

- revenue growth year over year
- revenue CAGR
- EPS growth
- net income growth

Stability:

- debt to equity
- debt ratio
- interest coverage

Valuation:

- trailing P/E
- forward P/E
- PEG
- price to book
- price to sales
- dividend yield
- market cap

## Example

```python
scoring_metrics = build_scoring_metrics(ticker_data)
```

## How It Does It

`metrics.py` is the aggregator. It pulls the latest and previous statement rows, extracts values with fallback key names, normalizes percent-like fields, and calls specific calculation helpers.

Example:

```python
revenue = _statement_value(latest, "revenue", "totalRevenue")
previous_revenue = _statement_value(previous, "revenue", "totalRevenue")
revenue_growth_yoy = calculate_revenue_growth_yoy(revenue, previous_revenue)
```

Provider fields are preferred when useful, but statement-derived calculations fill gaps.

Each metric group also gets a `coverage` value:

```python
growth["coverage"] = filled_growth_fields / total_growth_fields
```

Coverage is important because a missing metric should reduce confidence, not silently pretend the company is weak.

`composite.py` converts metrics and interpretation labels into category subscores:

```text
profitability  0-17
growth         0-17
valuation      0-17
balance sheet  0-17
market/news    0-16
macro          0-16
```

It then applies a confidence adjustment from the data-quality layer. This final deterministic result becomes the API's `score`.

Output shape:

```json
{
  "profitability": {"grossMargin": 0.42, "coverage": 0.8},
  "growth": {"revenueGrowthYoY": 0.11, "coverage": 0.75},
  "stability": {"debtToEquity": 0.4, "coverage": 0.67},
  "valuation": {"trailingPE": 28.2, "coverage": 0.83}
}
```

## Why This Layer Exists

Financial math should be deterministic and testable.

GPT should not be responsible for calculating revenue growth or P/E when code can do it.

## Current Weakness

The composite score is deterministic and auditable, but the weights are still heuristic. They should be refined with regression fixtures and user feedback.

## Tradeoff

Metrics can be misleading without context. That is why classification and interpretation layers exist.
