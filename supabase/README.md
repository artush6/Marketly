# Marketly Supabase Schema

This folder contains the database design for persisting Marketly analysis runs.

## What Gets Stored

The schema is designed around one core idea:

> Store enough evidence to understand and regenerate an analysis, not just the final GPT summary.

## Main Tables

```text
companies
  stable company registry keyed by symbol

source_documents
  raw/source memory such as news articles or provider payload references

fact_snapshots
  coverage summary for a point-in-time fact graph

fact_values
  individual canonical facts such as revenue, P/E, market cap, gross margin

analysis_snapshots
  one complete analysis run with version, score, metadata, layers, and full payload

computed_metrics
  queryable metric blocks linked to an analysis run

analysis_scenarios
  individual scenario cases with probability, rationale, evidence, and triggers

analysis_horizons
  trajectory entries for 6M, 12M, 3Y, 5Y, and 10Y views

research_jobs
  operational queue/state for future refresh or deep-research workers
```

## Why Analysis Runs Matter

The most important persistence object is an analysis run:

```text
symbol + analysis_version + data_timestamp + provenance -> analysis_id
```

This lets Marketly answer:

- What did we know at the time?
- Which backend version produced the output?
- Which provider values were used?
- Was the score deterministic?
- Which parts were GPT-generated?
- Can we regenerate only the narrative later?

## What Should Be Committed

Commit:

- `schema.sql`
- future migration SQL files
- RLS policies
- functions
- fake/dev seed data if needed

Do not commit:

- production dumps
- user data
- provider exports with sensitive data
- local database files
- secrets

## Integration Direction

When backend persistence is added, prefer this write order:

1. upsert `companies`
2. insert `fact_snapshots`
3. insert `fact_values`
4. insert `analysis_snapshots`
5. insert `computed_metrics`
6. insert `analysis_scenarios`
7. insert `analysis_horizons`

The backend can still return the full API response immediately. Supabase persistence should be additive and should not block the response unless explicitly required.
