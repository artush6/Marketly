# Routes Layer

`app/routes` contains the FastAPI endpoints.

## What This Layer Does

Routes answer:

> How does an HTTP request enter the backend?

Routes should:

- accept request parameters
- normalize simple input
- call the right service or integration
- convert known failures into HTTP responses
- return schema-compatible output

## Files

```text
routes/
├── analysis.py
├── assistant.py
├── econ_situation.py
├── financials.py
└── news.py
```

## Example

```python
@router.get("/score/{symbol}", response_model=TickerScoreResponse)
def ticker_score(symbol: str, refresh: bool = Query(False)):
    return build_ticker_score(normalize_symbol_input(symbol), force_refresh=refresh)
```

## How It Does It

Each route module creates a FastAPI `APIRouter`, defines endpoint functions, and imports either a service or an integration.

The route layer handles operational concerns:

```text
URL path
  -> query/path params
  -> symbol normalization
  -> service call
  -> known exception mapping
  -> response model validation
```

For `/score/{symbol}`, `analysis.py` catches:

- missing configuration as `503`
- upstream data errors as `502`
- unexpected failures as `500`

That keeps user-facing HTTP behavior separate from the actual finance pipeline.

## Why Routes Stay Thin

Finance logic in routes becomes hard to test and hard to reuse.

The route should not know how valuation works, how scenarios are built, or how GPT is prompted. It should delegate that to services.

## What Should Not Live Here

Do not put:

- financial formulas
- provider reconciliation
- scoring logic
- scenario logic
- GPT prompt construction

Routes are the doorway, not the analysis engine.
