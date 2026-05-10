# Marketly Backend Architecture

Marketly is not just a FastAPI backend that calls a few data providers. It is an analysis pipeline.

The important mental model is:

```text
Raw provider data
  -> normalized facts
  -> financial metrics
  -> business-model classification
  -> interpretation layers
  -> scenario analysis
  -> final score narrative
  -> API response
```

The backend should behave like a junior analyst with calculators and checklists, while GPT behaves like a senior analyst-writer who receives structured evidence and explains what matters. GPT should not be trusted as the only calculator or the only source of truth.

## Project Tree

```text
backend/
├── app/
│   ├── core/
│   │   ├── cache.py
│   │   ├── config.py
│   │   ├── errors.py
│   │   └── symbols.py
│   ├── integrations/
│   │   ├── economics.py
│   │   ├── financials.py
│   │   ├── gpt.py
│   │   └── news.py
│   ├── routes/
│   │   ├── analysis.py
│   │   ├── assistant.py
│   │   ├── econ_situation.py
│   │   ├── financials.py
│   │   └── news.py
│   ├── schemas/
│   │   └── analysis.py
│   ├── services/
│   │   ├── analysis_service.py
│   │   ├── analysis_fallback.py
│   │   ├── data_quality.py
│   │   ├── market_context.py
│   │   ├── metadata.py
│   │   ├── classification/
│   │   │   └── service.py
│   │   ├── events/
│   │   │   └── service.py
│   │   ├── facts/
│   │   │   ├── coverage.py
│   │   │   ├── extractors.py
│   │   │   ├── models.py
│   │   │   ├── reconciliation.py
│   │   │   └── service.py
│   │   ├── history/
│   │   │   └── service.py
│   │   ├── interpretation/
│   │   │   └── service.py
│   │   ├── scenarios/
│   │   │   └── service.py
│   │   ├── scoring/
│   │   │   ├── growth.py
│   │   │   ├── metrics.py
│   │   │   ├── profitability.py
│   │   │   ├── stability.py
│   │   │   └── valuation.py
│   │   └── trajectory/
│   │       └── service.py
│   ├── main.py
│   ├── models.py
│   └── serialization.py
├── tests/
│   ├── test_analysis_layers.py
│   ├── test_analysis_route.py
│   ├── test_analysis_service.py
│   ├── test_business_model.py
│   ├── test_fact_graph.py
│   ├── test_financials_integration.py
│   ├── test_profitability_scoring.py
│   ├── test_scoring_metrics.py
│   └── test_trajectory_layer.py
├── ARCHITECTURE.md
├── .todo.md
├── pyproject.toml
├── requirements.txt
└── run.py
```

## High-Level Request Flow

The main analysis endpoint is `/score/{symbol}`.

```text
HTTP request
  -> app/routes/analysis.py
  -> app/services/analysis_service.py
  -> provider integrations
  -> fact graph
  -> scoring metrics
  -> classification
  -> interpretation
  -> data quality
  -> market context
  -> event catalyst layer
  -> scenarios
  -> trajectory
  -> GPT final analysis
  -> response schema
```

The route is intentionally thin. It normalizes the symbol, calls the service, and maps failures into HTTP errors. The route should not own finance logic.

```python
# app/routes/analysis.py
@router.get("/score/{symbol}", response_model=TickerScoreResponse)
def ticker_score(symbol: str, refresh: bool = Query(False)):
    return build_ticker_score(normalize_symbol_input(symbol), force_refresh=refresh)
```

The orchestration lives in `app/services/analysis_service.py` because this is where multiple sources and layers are combined.

## Why The Code Is Split This Way

The split is:

```text
routes/        HTTP concerns
integrations/  outside world: Finnhub, FMP, FRED, OpenAI
services/      business and finance reasoning
schemas/       public API contracts
core/          config, cache, errors, symbol cleanup
models.py      internal typed data model
```

This is not the only possible architecture. It is a practical one for the current size of the product.

### Why this works

- Provider code is isolated, so changing Finnhub or FMP does not rewrite the analysis engine.
- Finance reasoning is testable without HTTP.
- GPT calls are centralized, so prompts and response schemas are easier to manage.
- Public API schemas are explicit, which matters before Supabase persistence.

### Why this is not perfectly optimal

- `analysis_service.py` is becoming large because it is the orchestrator.
- Some finance logic is still heuristic rather than statistically validated.
- Provider freshness is not deeply modeled yet.
- The numeric score is still GPT-generated instead of fully deterministic.

This is acceptable for now because the product is still discovering the right analysis shape. The next major step is to make the score itself deterministic and let GPT explain it.

## The Finance Mental Model

A stock analysis system should answer four questions:

1. What is true?
2. Why does it matter?
3. What could happen next?
4. What would change our mind?

Marketly maps those questions into layers.

```text
Facts                 -> What is true?
Metrics               -> What does the data say numerically?
Business model        -> What kind of company is this?
Interpretation        -> Why does it matter?
Events and context    -> What can change the story?
Scenarios             -> What could happen next?
Trajectory            -> How does the story evolve over time?
Data quality          -> How much should we trust this?
GPT final analysis    -> Explain the view in human language.
```

## Layer 1: Raw Provider Data

Files:

- `app/integrations/financials.py`
- `app/integrations/news.py`
- `app/integrations/economics.py`

This layer fetches raw inputs:

- financial profile, quote, metrics, statements
- company news
- macro indicators from FRED

Provider integrations should not decide whether a stock is attractive. They should fetch, normalize enough for code to consume, and preserve source information.

Example:

```python
raw_financials = fetch_ticker_financials(symbol, force_refresh=force_refresh)
ticker_data = TickerData.from_raw(raw_financials)
economic_data = fetch_macro_indicators()
news_data = get_news(symbol)
```

### Why provider code is separate

Financial APIs are messy:

- one provider may return percentages as `42`, another as `0.42`
- one provider may call revenue `revenue`, another `totalRevenue`
- one provider may return market cap in millions
- some endpoints fail silently or return partial data

Keeping provider mess inside `integrations/` prevents the rest of the app from becoming provider-specific spaghetti.

### Tradeoff

The current provider layer is resilient but too quiet. `safe_get(...)` avoids breaking the app, but soft failures can hide bad endpoints or missing data. This is uptime-friendly and debugging-unfriendly.

## Layer 2: Typed Internal Model

File:

- `app/models.py`

`TickerData` gives the rest of the app a stable shape:

```python
class TickerData(BaseModel):
    symbol: Optional[str] = None
    info: CompanyInfo = Field(default_factory=CompanyInfo)
    quote: Dict[str, Any] = Field(default_factory=dict)
    analyst_data: Optional[Any] = None
    financials: FinancialsBlock = Field(default_factory=FinancialsBlock)
    dividends: Dict[str, Any] = Field(default_factory=dict)
    sources: Dict[str, Any] = Field(default_factory=dict)
```

This does not mean all fields are guaranteed. It means downstream code can safely ask for `ticker_data.info` or `ticker_data.financials` without checking whether those blocks exist.

### Why this works

It gives the analysis engine a common language.

### Why this is not enough

Typing shape is not the same as validating quality. A field can exist and still be stale, scaled wrong, or economically misleading. That is why the fact graph and data quality layers exist.

## Layer 3: Fact Graph

Files:

- `app/services/facts/service.py`
- `app/services/facts/extractors.py`
- `app/services/facts/reconciliation.py`
- `app/services/facts/coverage.py`
- `app/services/facts/models.py`

The fact graph answers:

> What facts do we believe, where did they come from, and how confident are we?

Conceptually:

```text
provider candidates
  -> canonical fact
  -> confidence
  -> alternatives/conflicts
  -> coverage report
```

Example structure:

```python
class CanonicalFact(BaseModel):
    key: str
    value: Any = None
    source: FactSource = "unknown"
    confidence: float = 0.0
    inferred: bool = False
    alternatives: list[FactCandidate] = Field(default_factory=list)
```

### Why this exists

Financial data is not just "present" or "missing." It has quality.

For example:

- `marketCap` from Finnhub metric may need scaling
- `grossMargin` may be provider-derived or statement-derived
- a missing balance sheet does not mean the company is risky; it means we have less evidence

The fact graph lets the app separate:

```text
The business is weak
```

from:

```text
The data is incomplete
```

That distinction is crucial in finance products.

## Layer 4: Financial Metrics

Files:

- `app/services/scoring/metrics.py`
- `app/services/scoring/profitability.py`
- `app/services/scoring/growth.py`
- `app/services/scoring/stability.py`
- `app/services/scoring/valuation.py`

This layer turns financial statements and profile fields into metrics.

Examples:

```python
revenue_growth_yoy = calculate_revenue_growth_yoy(revenue, previous_revenue)
revenue_cagr = calculate_revenue_cagr(revenue, oldest_revenue)
trailing_pe = calculate_pe_ratio(share_price, eps)
debt_to_equity = total_debt / shareholders_equity
```

### What each metric group means

Profitability:

- Does the company convert sales into profit?
- Does it have pricing power?
- Are margins structurally attractive?

Growth:

- Is demand expanding?
- Is growth recent or durable?
- Is earnings growth following revenue growth?

Stability:

- Can the company survive stress?
- Is leverage manageable?
- Can operating income cover interest expense?

Valuation:

- How much are investors paying for the business?
- Is the market already pricing in success?
- Does the stock need growth to justify its price?

### Why metrics are deterministic

Math should be code. GPT should not calculate P/E, revenue growth, or debt ratios from raw blobs if the backend can do it.

### Current weakness

The final numeric score is still GPT-generated. That is useful for quick iteration, but less ideal for trust. The better long-term design is deterministic subscores plus GPT explanation.

## Layer 5: Business Model Classification

File:

- `app/services/classification/service.py`

The same metric means different things for different companies.

Examples:

- Low current earnings may be normal for an IP-driven game publisher between major launches.
- High gross margin is expected for SaaS but unusual for manufacturing.
- High valuation may be acceptable for durable software but dangerous for a cyclical name.
- A biotech can be driven more by trial catalysts than revenue.

Marketly classifies the company into frameworks such as:

```text
saas
cloud
hardware_ecosystem
manufacturing
ip_driven
live_services
consumer_platform
biotech
cyclical
```

Example:

```python
business_model = classify_business_model(ticker_data, fact_graph, news_data)
```

### Why this works

It prevents one-size-fits-all scoring.

### Why this is imperfect

The classifier is heuristic. It uses text signals, margin profile, revenue volatility, and news keywords. That is good enough for early product logic but not as strong as a trained model or a deeply maintained sector taxonomy.

## Layer 6: Interpretation

File:

- `app/services/interpretation/service.py`

Interpretation answers:

> What do the facts and metrics mean for this type of company?

It produces:

- margin quality
- growth durability
- balance-sheet risk
- valuation dependency
- strengths
- risks
- critical unknowns

Example:

```python
interpretation = build_interpretation_layer(
    ticker_data,
    fact_graph,
    scoring_metrics,
    business_model,
)
```

Example output:

```json
{
  "growthDurability": {
    "label": "mixed",
    "detail": "Growth durability depends on installed-base monetization..."
  },
  "valuationDependency": {
    "label": "high",
    "detail": "The stock already discounts a strong future..."
  }
}
```

### Why this layer exists

Raw metrics do not explain themselves.

A `P/E` of 40 might mean:

- overpriced
- justified by durable growth
- temporarily distorted earnings
- market is pricing an upcoming catalyst

Interpretation turns metrics into finance language.

## Layer 7: Data Quality

File:

- `app/services/data_quality.py`

Data quality answers:

> How much should we trust the analysis?

It produces:

- `dataQualityScore`
- `confidenceLevel`
- `missingCriticalFields`
- `analysisLimitations`
- `coverageBreakdown`

Example:

```python
data_quality = build_data_quality(
    ticker_data,
    fact_graph,
    scoring_metrics,
    interpretation,
)
```

### Why this matters

Bad data can masquerade as bad fundamentals.

If debt data is missing, the app should not confidently say the balance sheet is clean. It should say the balance sheet view is low confidence.

### Design decision

Data quality is metadata, not a direct score penalty yet.

That is intentional. A low-quality analysis should reduce confidence before it automatically reduces the investment score. Missing data is not the same thing as weak business quality.

## Layer 8: Market Context

File:

- `app/services/market_context.py`

Market context answers:

> What kind of market environment is this stock being judged inside?

It produces:

- equity risk sentiment
- liquidity flag
- index trend
- rate direction
- Treasury yield direction
- inflation direction
- company news sentiment
- beta sensitivity

Example:

```python
market_context = build_market_context(economic_data, news_data, ticker_data)
```

### Why this matters

The same company can behave differently in different regimes.

Examples:

- High-multiple stocks often do better when rates fall and risk appetite rises.
- High-beta names can overshoot in bullish markets.
- Rich valuation plus weak growth can still work temporarily if liquidity and sentiment are strong.

### Current limitation

This is a compact heuristic layer, not a full macro model. It does not yet include credit spreads, yield curve shape, sector ETFs, earnings revisions, or market breadth.

That is okay for now because the goal is to feed scenarios and GPT a structured regime hint rather than build a hedge fund macro engine.

## Layer 9: Event Catalysts

File:

- `app/services/events/service.py`

This layer turns loose news into structured catalysts.

It classifies news into rough categories:

- product cycle
- engagement
- platform cycle
- regulatory
- macro
- company-specific
- content cycle

Example:

```python
event_layer = build_event_catalyst_layer(
    business_model,
    interpretation,
    news_data,
)
```

### Why this works

Scenario analysis needs to know what can change.

For Take-Two, a launch cycle matters. For Apple, ecosystem and platform-cycle news matters. For biotech, regulatory or clinical milestones matter.

### Current weakness

The current classifier is keyword-based. It is useful and transparent, but it will miss nuance. Later, this should become a structured news intelligence layer with stronger categories and importance scoring.

## Layer 10: History Context

File:

- `app/services/history/service.py`

History context answers:

> What kind of historical pattern should we compare this company to?

It produces:

- trend summary
- analog templates
- data gaps
- whether history is useful

This is not a full backtest. It is a lightweight way to give scenarios context.

Examples:

- IP-driven companies may follow launch, peak, decay, stabilization patterns.
- Hardware ecosystem companies may follow refresh cycle, upgrade wave, services attach, replacement cycle patterns.

## Layer 11: Scenarios

File:

- `app/services/scenarios/service.py`

Scenario analysis answers:

> What plausible futures could happen, how likely are they, and what evidence would change our mind?

The current design is hybrid:

```text
deterministic signal summary
  -> GPT scenario generation
  -> schema validation
  -> probability normalization
  -> deterministic fallback if GPT fails
```

Example:

```python
scenarios = build_scenarios(
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

Each scenario has:

- name
- probability
- confidence
- thesis
- must-go-right conditions
- break conditions
- probability rationale
- key evidence
- watchlist triggers

Example:

```json
{
  "name": "momentum melt-up",
  "probability": 0.35,
  "confidence": "medium",
  "thesis": "Risk-on demand keeps pulling valuation higher despite thin fundamental confirmation.",
  "mustGoRight": ["Positive catalysts keep arriving."],
  "breaksIf": ["Growth evidence fails to follow the price move."],
  "probabilityRationale": "Narrative momentum has the highest near-term weight.",
  "keyEvidence": ["Positive catalysts are visible."],
  "watchlistTriggers": ["Analyst tone changes."]
}
```

### Why GPT is used here

Scenario writing is partly judgment.

The backend can calculate:

- valuation is rich
- growth is weak
- news tone is positive
- beta is high
- market context is risk-on

GPT can turn that into a human scenario:

```text
Momentum melt-up: investors keep rewarding the story before fundamentals catch up.
```

That is a good use of GPT because the backend prepares the evidence and validates the structure.

### Why GPT is not trusted blindly

The service normalizes and validates GPT output:

- requires at least three cases
- requires thesis text
- normalizes probabilities to sum to 1.0
- limits list lengths
- falls back to deterministic scenarios if output is invalid

### Why this is not perfect

Probabilities are still judgmental. They are not statistically calibrated. They should be interpreted as analyst weights, not mathematically proven odds.

## Layer 12: Trajectory

File:

- `app/services/trajectory/service.py`

Trajectory answers:

> How could the business story evolve over 6 months, 12 months, 3 years, 5 years, and 10 years?

Scenarios are possible futures. Trajectory is the time map.

Example horizons:

```text
6M   narrative-sensitive
12M  execution-sensitive
3Y   business-quality
5Y   moat-test
10Y  structural
```

### Why this matters

A good near-term stock setup and a good long-term business are not the same thing.

Examples:

- A stock can rally for six months on hype but disappoint over three years.
- A strong business can be a bad one-year investment if valuation is too high.
- A launch-driven company can look weak before a major release and strong after it.

## Layer 13: GPT Final Analysis

File:

- `app/integrations/gpt.py`

The final GPT call receives curated context:

- financial metrics
- fact graph
- business model
- interpretation
- event layer
- history context
- scenarios
- trajectory
- market context
- data quality
- news
- macro

It returns:

- score
- summary
- positives
- negatives

### Intended GPT role

GPT should:

- explain
- synthesize
- compare tradeoffs
- make the output readable
- reason from structured evidence

GPT should not be the only source for:

- raw financial calculations
- data quality
- provider reconciliation
- final deterministic score long term

## Metadata For Supabase

Files:

- `app/services/metadata.py`
- `app/schemas/analysis.py`

The response now includes fields that are designed for persistence:

- `analysisId`
- `analysisVersion`
- `dataTimestamp`
- `provenance`
- `refreshPolicy`
- `inputPartitions`

Example:

```json
{
  "analysisVersion": "2026-05-scenarios-v3",
  "provenance": {
    "financialFacts": {
      "profile": "finnhub",
      "metrics": "fmp"
    },
    "macro": {
      "provider": "fred"
    },
    "generatedLayers": {
      "scenarios": "openai",
      "analysis": "openai"
    }
  }
}
```

### Why this matters before Supabase

Once results are stored, shape matters.

Without versioning, old analysis and new analysis become indistinguishable. Without provenance, weird scores are hard to debug. Without refresh policy, everything gets refreshed too often or not often enough.

## Public API Contract

File:

- `app/schemas/analysis.py`

The `/score/{symbol}` response is modeled by `TickerScoreResponse`.

Major sections:

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
  analysisSource

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

## Caching

File:

- `app/core/cache.py`

Caching is optional. If Redis is unavailable, the app should still run.

Why:

- local development should not require Redis
- provider failures should not crash startup
- optional caching keeps the architecture simple

Tradeoff:

- optional caching means performance and provider usage can vary by environment
- cached analysis can become stale if refresh rules are not enforced carefully

## Testing Strategy

Tests currently cover:

- route behavior
- analysis orchestration
- fact graph
- business model classification
- scoring metrics
- profitability
- financial integration merging
- trajectory
- scenario generation/fallback behavior

Run:

```bash
PYTHONPATH=. pytest -q
```

Compile check:

```bash
PYTHONPATH=. python3 -m compileall app tests
```

## Important Design Decisions

### Decision: keep route logic thin

Why:

- HTTP handlers should not own finance logic
- services are easier to test

Tradeoff:

- `analysis_service.py` becomes the central orchestrator and needs discipline.

### Decision: compute metrics in code

Why:

- deterministic math is testable
- GPT can hallucinate or inconsistently scale values

Tradeoff:

- finance formulas and provider normalization must be maintained manually.

### Decision: use GPT for scenario writing

Why:

- scenario narratives require judgment and synthesis
- backend signals can be too rigid if used alone

Tradeoff:

- probabilities are not statistically calibrated
- output must be validated and normalized

### Decision: keep deterministic scenario fallback

Why:

- OpenAI failures should not break `/score`
- the product should degrade gracefully

Tradeoff:

- fallback scenarios are generic and less valuable than GPT-backed scenarios.

### Decision: data quality reduces confidence, not score

Why:

- missing data is not the same as bad fundamentals
- users need to know when the answer is less reliable

Tradeoff:

- the final score may still look precise even when confidence is low. The UI should surface confidence clearly.

### Decision: market context is heuristic

Why:

- compact regime signals improve scenario reasoning quickly
- full macro modeling would be premature

Tradeoff:

- risk-on/risk-off labels are approximate and should not be treated as trading signals.

## How To Add A New Analysis Layer

Use this pattern:

1. Create a service under `app/services/<layer>/` or `app/services/<layer>.py`.
2. Accept structured inputs, not raw request objects.
3. Return a JSON-safe dictionary.
4. Add the layer to `analysis_service.py`.
5. Add schema fields in `app/schemas/analysis.py` if exposed publicly.
6. Add unit tests.
7. Add provenance or metadata if the layer affects stored results.

Example:

```python
sector_context = build_sector_context(
    ticker_data=ticker_data,
    scoring_metrics=scoring_metrics,
    news_data=news_data,
)
```

Then pass it into GPT and/or scenarios only after it is structured.

## What Should Not Go Where

Do not put provider calls in services unless the service is explicitly an orchestrator.

Do not put finance logic in routes.

Do not make GPT parse massive raw blobs when a deterministic layer can summarize the evidence first.

Do not store raw API output as the only source of truth once Supabase is added. Store raw data, normalized facts, computed metrics, generated layers, and metadata separately enough that they can be regenerated independently.

## Supabase Direction

When Supabase is added, think in partitions:

```text
raw_provider_payloads
normalized_facts
computed_metrics
analysis_runs
analysis_layers
scenario_cases
news_items
macro_snapshots
```

The most important object is not a stock. It is an analysis run:

```text
symbol + analysisVersion + dataTimestamp + provenance -> analysisId
```

This lets the product answer:

- What did we know at the time?
- Which pipeline generated this?
- Which provider values were used?
- Which layers were GPT-generated?
- Can we regenerate only the summary without refetching financials?

## Current Known Weak Spots

- Final numeric score is still GPT-generated.
- Market context is useful but simple.
- Event intelligence is keyword-based.
- Scenario probabilities are analyst-style weights, not calibrated odds.
- Provider observability should be stronger.
- Cash-flow and capital-structure analysis should be expanded.
- No Supabase persistence yet.

These are not failures. They are the next boundary of the product.
