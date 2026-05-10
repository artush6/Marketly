# History Context Layer

This layer gives the analysis a historical pattern to compare against.

## What This Layer Does

History answers:

> What kind of historical template might this company follow?

It does not run a full backtest. It creates lightweight context for interpretation and scenarios.

## File

```text
history/
└── service.py
```

## Inputs

```python
build_history_context(ticker_data, business_model)
```

## How It Does It

The layer reads available financial history, especially revenue rows, and checks whether there is enough history to say something useful.

It then attaches model-specific analog templates.

Examples:

- `ip_driven` companies get launch-cycle style analogs.
- `hardware_ecosystem` companies get refresh-cycle and services-attach analogs.
- sparse data produces data-gap notes and lower usefulness.

This is deliberately simple: it gives scenarios a historical lens without pretending to be a full backtest.

## Output

Example:

```json
{
  "trendSummary": "Revenue expanded across sampled periods.",
  "analogTemplates": ["launch cycle", "platform monetization"],
  "dataGaps": [],
  "hasUsefulHistory": true
}
```

## Why This Layer Exists

Investing is about change over time.

A single metric snapshot can mislead. The historical layer helps answer:

- Is revenue expanding or contracting?
- Is this company cyclical?
- Does the business depend on launch cycles?
- Are we missing enough history to reduce confidence?

## Tradeoff

This layer is intentionally lightweight. It should not pretend to be a full historical factor model.
