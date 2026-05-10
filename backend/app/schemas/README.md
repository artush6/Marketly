# Schemas Layer

`app/schemas` defines public API response contracts.

## What This Layer Does

Schemas answer:

> What shape does the API promise to return?

The main schema is `TickerScoreResponse`, used by `/score/{symbol}`.

## Files

```text
schemas/
└── analysis.py
```

## Why This Layer Exists

The backend has many internal dictionaries. Schemas make the public API explicit.

That matters because:

- the frontend needs stable fields
- Supabase will eventually store these objects
- tests can catch accidental response changes
- users should not see random internal shapes

## Main Response Sections

```text
identity:
  analysisId
  analysisVersion
  dataTimestamp
  symbol
  company

final view:
  score
  summary
  positives
  negatives

metrics:
  profitability
  growth
  stability
  valuation

reasoning layers:
  businessModel
  interpretation
  eventCatalysts
  historyContext
  marketContext
  scenarios
  trajectory

trust metadata:
  analysisMetadata
```

## How It Does It

Schemas use Pydantic models. Each response block has its own model, and `TickerScoreResponse` composes them.

Example:

```python
class ScenarioCaseResponse(BaseModel):
    name: str
    probability: float
    confidence: str
    thesis: str
    mustGoRight: List[str] = Field(default_factory=list)
```

FastAPI uses these models to validate and serialize returned dictionaries. If the service returns extra internal data that is not in the schema, the public response model controls what the endpoint exposes.

Default factories such as `Field(default_factory=list)` avoid shared mutable defaults and keep missing arrays predictable.

## Tradeoff

Schemas can lag behind internal logic if new fields are added quickly. Any public field that matters should be added here deliberately.
