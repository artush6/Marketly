# Business Model Classification Layer

This layer decides what kind of company Marketly is analyzing.

## What This Layer Does

Classification answers:

> What framework should we use to judge this company?

The same metric can mean different things depending on the business model.

Examples:

- High gross margin is normal for SaaS.
- Revenue lumpiness can be normal for a game publisher.
- Debt risk means something different for a bank than for a software company.
- Biotech may be driven more by trial catalysts than current revenue.

## File

```text
classification/
└── service.py
```

## Inputs

```python
classify_business_model(
    ticker_data,
    fact_graph,
    news_data,
)
```

It uses:

- company name
- sector
- industry
- news text
- gross margin
- revenue volatility

## How It Does It

The classifier builds one normalized text blob from company metadata and recent news. It then scores possible business models with keyword and financial evidence.

Example logic:

```python
if "iphone" in text or "hardware" in text:
    add("hardware_ecosystem", 2.0, "Hardware keywords suggest ecosystem economics.")

if gaming_signal:
    add("ip_driven", 3.2, "Gaming language points to franchise dependence.")
```

It also uses numeric hints:

- high gross margin can support SaaS/cloud/IP models
- high revenue volatility can support IP-driven or cyclical models
- launch-related gaming text can support live-services exposure

After scoring, it picks the highest-scoring model as `primaryModel`, keeps strong runners-up as `secondaryModels`, and creates `frameworkFocus` from predefined model frameworks.

## Output

Example:

```json
{
  "primaryModel": "hardware_ecosystem",
  "secondaryModels": ["consumer_platform"],
  "confidence": 0.82,
  "evidence": ["Hardware and installed-base keywords suggest ecosystem economics."],
  "frameworkFocus": ["installed base strength", "services attach"],
  "revenueVolatility": 0.12
}
```

## Why This Works

It prevents one-size-fits-all analysis.

Without classification, the backend might judge Take-Two, Apple, Microsoft, Tesla, and a biotech using the same assumptions. That would be bad finance.

## Why This Is Imperfect

The current classifier is heuristic. It uses keywords and simple financial signals. It is transparent and easy to debug, but it can misclassify complex companies.

Long term, this could become a stronger taxonomy backed by sector rules, embeddings, or curated mappings.
