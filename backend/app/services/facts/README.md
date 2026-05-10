# Fact Graph Layer

This layer turns messy provider data into believed facts with confidence.

## What This Layer Does

Facts answer:

> What do we believe is true, where did it come from, and how reliable is it?

## Files

```text
facts/
├── coverage.py
├── extractors.py
├── models.py
├── reconciliation.py
└── service.py
```

## How It Works

Conceptually:

```text
TickerData
  -> fact candidates
  -> reconciliation
  -> canonical facts
  -> coverage report
```

`extractors.py` pulls candidate facts out of `TickerData`.

`reconciliation.py` chooses a canonical fact from candidates.

`coverage.py` reports whether important fields are filled.

`models.py` defines `FactCandidate`, `CanonicalFact`, and `CoverageReport`.

## How It Does It

The service starts with `TickerData` and extracts named candidate facts.

Example fact keys:

```text
company.name
company.sector
market.market_cap
quote.current_price
valuation.trailing_pe
profitability.gross_margin
financials.revenue.latest
```

Each candidate has:

- key
- value
- source
- quality score
- whether it is inferred
- notes

Reconciliation chooses a canonical value for each key. If competing candidates exist, alternatives are preserved so the system can later explain conflicts.

Coverage then checks a required key list and counts:

- filled fields
- inferred fields
- conflicting fields
- weak confidence fields

## Example

```json
{
  "key": "valuation.trailing_pe",
  "value": 28.4,
  "source": "fmp",
  "confidence": 0.85,
  "inferred": false,
  "alternatives": []
}
```

## Why This Layer Exists

Provider data can be incomplete, conflicting, or scaled differently.

The analysis engine needs to know the difference between:

```text
The company has weak fundamentals.
```

and:

```text
The data is missing or low confidence.
```

Those are very different statements.

## Why This Is Not Enough By Itself

The fact graph says whether data exists and how reliable it is. It does not explain whether the company is good. Metrics and interpretation layers do that.
