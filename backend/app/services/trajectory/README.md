# Trajectory Layer

This layer maps the business story across time horizons.

## What This Layer Does

Trajectory answers:

> How could the company story evolve over 6 months, 12 months, 3 years, 5 years, and 10 years?

## File

```text
trajectory/
└── service.py
```

## Inputs

```python
build_trajectory_layer(
    ticker_data,
    business_model,
    interpretation,
    event_layer,
    history_context,
    scoring_metrics,
    news_data,
)
```

## How It Does It

The layer reads:

- revenue history
- business model
- interpretation labels
- event lifecycle model
- news keywords
- history context

Then it builds:

- past drivers
- upcoming drivers
- horizon-specific outlooks

For IP-driven companies, it creates launch-cycle horizons such as catalyst-driven, event-resolution, franchise-compounding, and franchise-longevity.

For other companies, it uses broader horizons such as narrative-sensitive, execution-sensitive, business-quality, moat-test, and structural.

It also adds specific driver/risk notes when news text contains important terms such as delay or pricing.

## Output

Example:

```json
{
  "pastDrivers": ["Historical stock strength was tied to installed-base expansion."],
  "upcomingDrivers": ["The next 12 months depend on refresh-cycle resilience."],
  "horizons": [
    {
      "horizon": "6M",
      "outlook": "narrative-sensitive",
      "drivers": ["near-term execution"],
      "risks": ["expectation reset"],
      "focus": "Watch whether recent catalysts reinforce the current narrative."
    }
  ]
}
```

## Why This Layer Exists

Short-term stock setup and long-term business quality are different.

A stock can:

- rise near term on hype
- be expensive for one year
- still be a great business over ten years

The trajectory layer separates time horizons so the analysis is less one-dimensional.

## Tradeoff

This layer is partly template-driven. It provides useful structure, but it is not yet a full long-range forecasting model.
