# Services Layer

`app/services` contains Marketly's finance and analysis logic.

## What This Layer Does

Services answer:

> What does the data mean?

This layer turns raw provider data into structured analysis.

## Service Flow

```text
analysis_service.py
  -> fact graph
  -> scoring metrics
  -> business model
  -> interpretation
  -> data quality
  -> market context
  -> events
  -> history
  -> scenarios
  -> trajectory
  -> GPT final analysis
```

## How It Does It

`analysis_service.py` is the orchestrator. It does not perform every calculation itself; it calls each layer in order and passes structured outputs forward.

The pattern is:

```python
raw_financials = fetch_ticker_financials(symbol)
ticker_data = TickerData.from_raw(raw_financials)
fact_graph = build_fact_graph(ticker_data)
scoring_metrics = build_scoring_metrics(ticker_data)
business_model = classify_business_model(ticker_data, fact_graph, news_data)
interpretation = build_interpretation_layer(...)
scenarios = build_scenarios(...)
analysis = score_ticker(...)
```

Each layer receives the smallest useful set of inputs and returns a JSON-safe dictionary. Later layers reuse earlier outputs rather than recomputing everything.

This is how Marketly builds a reasoning stack:

```text
facts make metrics safer
metrics feed interpretation
classification changes interpretation
events and market context feed scenarios
scenarios and trajectory feed GPT
data quality tells the user how much to trust it
```

## Files And Folders

```text
services/
├── analysis_service.py
├── analysis_fallback.py
├── data_quality.py
├── market_context.py
├── metadata.py
├── classification/
├── events/
├── facts/
├── history/
├── interpretation/
├── scenarios/
├── scoring/
└── trajectory/
```

## Standalone Service Files

`analysis_service.py` is the orchestrator for `/score/{symbol}`. It decides the order of the analysis pipeline.

`analysis_fallback.py` creates a fallback final analysis if GPT scoring fails.

`data_quality.py` evaluates whether the available data is strong enough to trust.

`market_context.py` summarizes the macro and market regime around the stock.

`metadata.py` creates versioning, analysis IDs, provenance, and refresh policy metadata for future Supabase storage.

## Important Rule

If code is making a business or finance decision, it usually belongs in `services`.

Examples:

- "Is valuation dependency high?"
- "Is this company IP-driven?"
- "Are scenarios skewed by retention risk?"
- "Is data quality low?"

## Why This Layer Exists

Financial analysis needs multiple steps. Putting everything in one endpoint or one GPT prompt would make the system hard to debug.

Services make reasoning explicit.

## Tradeoff

The service layer can grow quickly. Keep each layer focused on one type of reasoning.
