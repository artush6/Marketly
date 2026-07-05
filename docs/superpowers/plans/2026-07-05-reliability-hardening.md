# Marketly Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cold-cache and partial-provider analyses truthful, retryable, and deterministic without manufacturing scores or preserving bad financial snapshots.

**Architecture:** Add deterministic financial-quality metadata at the provider boundary, use it to govern reconciliation, persistence, and scoring, then carry that status through typed APIs into a degraded frontend state. Coalesce concurrent backend fetches per symbol and align retry/deadline behavior so the first request and subsequent cached requests converge on the same best-quality payload.

**Tech Stack:** Python 3.11+/FastAPI/Pydantic/Pytest, Redis and Supabase cache adapters, Next.js 16/React 19/TypeScript/ESLint.

---

## File Map

- Create `backend/app/services/financial_quality.py`: deterministic financial coverage, freshness, cache eligibility, and rank comparison.
- Modify `backend/app/integrations/financials.py`: quality-aware provider reconciliation, single-flight fetching, safe zero selection, cache/snapshot policy, request diagnostics.
- Modify `backend/app/integrations/supabase_store.py`: maximum-age snapshot reads.
- Modify `backend/app/services/scoring/composite.py`: nullable, evidence-based composite score.
- Modify `backend/app/services/analysis_service.py`: degraded analysis contract and quality-aware score cache.
- Modify `backend/app/schemas/analysis.py`: nullable score and complete audit metadata.
- Modify `backend/app/core/config.py`, `backend/app/main.py`, and the proxy route: safe configuration and diagnostics.
- Modify `frontend/src/lib/api.ts`: refresh, coherent deadlines, typed quality metadata, and structured request errors.
- Modify `frontend/src/lib/marketly-analysis.ts`: evidence-based status and bounded financial retry.
- Modify `frontend/src/app/page.tsx`: request cancellation and Strict Mode-safe lifecycle.
- Modify `frontend/src/components/marketly/cinematic-workspace.tsx`: degraded-state UI and honest scenario rendering.
- Extend backend tests and add frontend pure-helper coverage if the existing toolchain can run it without adding a new runtime dependency.

### Task 1: Financial quality contract

**Files:**
- Create: `backend/app/services/financial_quality.py`
- Test: `backend/tests/test_financial_quality.py`

- [ ] **Step 1: Write failing tests for empty, partial, complete, and stale payloads**

```python
def test_empty_payload_is_insufficient_and_not_cacheable():
    quality = assess_financial_quality({"info": {}, "quote": {}, "financials": {}})
    assert quality["status"] == "insufficient"
    assert quality["cacheEligible"] is False
    assert quality["scoreEligible"] is False

def test_complete_payload_is_score_and_cache_eligible():
    quality = assess_financial_quality(complete_payload())
    assert quality["status"] == "complete"
    assert quality["cacheEligible"] is True
    assert quality["scoreEligible"] is True
```

- [ ] **Step 2: Run `PYTHONPATH=. pytest tests/test_financial_quality.py -q` and verify the import fails**
- [ ] **Step 3: Implement `assess_financial_quality`, `attach_financial_quality`, and `quality_rank` with explicit thresholds and ISO timestamps**
- [ ] **Step 4: Run the focused test and full backend suite**
- [ ] **Step 5: Commit `test/feat: add financial quality contract`**

### Task 2: Provider reconciliation and valid zeros

**Files:**
- Modify: `backend/app/integrations/financials.py`
- Modify: `backend/tests/test_financials_integration.py`

- [ ] **Step 1: Add failing tests proving a richer SEC row augments partial FMP data and zero ratios survive fallback selection**

```python
def test_merge_reconciles_statement_rows_instead_of_first_nonempty_wins():
    target = base_payload(income=[{"date": "2026-03-31", "netIncome": 20}])
    merge_provider_payload(target, sec_payload(income=[{"date": "2026-03-31", "revenue": 100}]))
    assert target["financials"]["income_statement"][0] == {
        "date": "2026-03-31", "netIncome": 20, "revenue": 100
    }

def test_fmp_zero_ratio_is_preserved():
    assert payload["info"]["dividendYield"] == 0
```

- [ ] **Step 2: Run the focused tests and verify both fail for the expected current behavior**
- [ ] **Step 3: Replace block-level first-wins merging with period-keyed field reconciliation and an explicit first-non-None selector**
- [ ] **Step 4: Configure the SEC user agent through settings and ensure logs contain provider name/timing but no URLs with credentials**
- [ ] **Step 5: Run financial integration and scoring tests**
- [ ] **Step 6: Commit `fix: reconcile financial provider evidence`**

### Task 3: Fresh snapshots, safe caches, and single-flight fetching

**Files:**
- Modify: `backend/app/integrations/supabase_store.py`
- Modify: `backend/app/integrations/financials.py`
- Modify: `backend/app/core/cache.py`
- Modify: `backend/tests/test_supabase_cache.py`
- Test: `backend/tests/test_financials_concurrency.py`

- [ ] **Step 1: Add failing tests for stale snapshot rejection, insufficient snapshot rejection, quality-ranked writes, force refresh, and two concurrent cold calls**

```python
def test_stale_snapshot_does_not_skip_provider_fetch():
    snapshot = {"fetched_at": "2020-01-01T00:00:00+00:00", "payload": complete_payload()}
    # provider mock must be called and fresh result returned

def test_concurrent_calls_share_one_provider_fetch():
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: fetch_ticker_financials("AAPL", True), range(2)))
    assert provider.call_count == 1
    assert results[0] == results[1]
```

- [ ] **Step 2: Run the tests and verify stale snapshots are reused and providers execute twice**
- [ ] **Step 3: Add `max_age_seconds` to snapshot reads and validate `fetched_at` plus attached quality before reuse**
- [ ] **Step 4: Add a keyed condition/future coordinator around provider collection and always release waiters on exceptions**
- [ ] **Step 5: Cache durable payloads only when quality permits; use a short negative TTL only in the ephemeral cache**
- [ ] **Step 6: Run concurrency tests repeatedly and the full backend suite**
- [ ] **Step 7: Commit `fix: prevent cold-cache financial races`**

### Task 4: Truthful scoring and API schemas

**Files:**
- Modify: `backend/app/services/scoring/composite.py`
- Modify: `backend/app/services/analysis_service.py`
- Modify: `backend/app/services/analysis_fallback.py`
- Modify: `backend/app/schemas/analysis.py`
- Modify: `backend/tests/test_composite_scoring.py`
- Modify: `backend/tests/test_analysis_service.py`
- Modify: `backend/tests/test_analysis_route.py`

- [ ] **Step 1: Add failing tests that empty evidence produces `score is None`, no rating language, and serialized quality/audit metadata**

```python
def test_zero_coverage_has_no_composite_score():
    result = build_composite_score(empty_metrics(), {}, {}, {}, low_quality())
    assert result["score"] is None
    assert result["reason"] == "insufficient_financial_data"
```

- [ ] **Step 2: Run focused tests and verify the current score is 42**
- [ ] **Step 3: Make ratio scoring return no points for missing values, track available/max evidence, and gate the final score on financial quality**
- [ ] **Step 4: Skip rating-oriented GPT synthesis for insufficient data and build a factual degraded summary**
- [ ] **Step 5: Reject cached score payloads that lack eligible input-quality metadata**
- [ ] **Step 6: Add `modelSuggestedScore`, nullable score fields, financial status, and reason to Pydantic schemas**
- [ ] **Step 7: Run route/service/scoring tests and the full backend suite**
- [ ] **Step 8: Commit `fix: withhold scores without financial evidence`**

### Task 5: Frontend request and degraded-state model

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/marketly-analysis.ts`
- Modify: `frontend/src/components/marketly/types.ts`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Extract pure financial-status classification and define examples for empty objects, partial rows, and complete quality metadata**
- [ ] **Step 2: Verify the current build has no way to distinguish those states**
- [ ] **Step 3: Add typed `BackendFinancialQuality`, `StageOutcome`, and `ApiRequestError`; accept abort signals and refresh flags in API helpers**
- [ ] **Step 4: Align the client timeout below the proxy deadline while leaving backend reconciliation headroom**
- [ ] **Step 5: Preserve rejected stage outcomes; retry financials once with refresh when scoring succeeds and the first financial request was transient**
- [ ] **Step 6: Scope updates to analysis ID/AbortController, reset mounted state during effect setup, and cancel requests on reset/unmount**
- [ ] **Step 7: Run frontend lint and production build**
- [ ] **Step 8: Commit `fix: preserve financial loading outcomes`**

### Task 6: Degraded UI and honest scenarios

**Files:**
- Modify: `frontend/src/components/marketly/cinematic-workspace.tsx`
- Modify: `frontend/src/lib/marketly-analysis.ts`

- [ ] **Step 1: Define degraded rendering cases: insufficient score, partial statements, transient failure, and stale data**
- [ ] **Step 2: Add a status banner and retry action wired to a refresh analysis submission**
- [ ] **Step 3: Render `N/A` instead of a numeric verdict when score is null; keep available context visible**
- [ ] **Step 4: Preserve scenario names and probabilities; remove index-based bull/base/bear relabeling and fabricated ±18% targets**
- [ ] **Step 5: Run lint and production build**
- [ ] **Step 6: Commit `fix: render degraded analysis truthfully`**

### Task 7: Safety, tooling, and final verification

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/main.py`
- Modify: `frontend/src/app/api/backend/[...path]/route.ts`
- Modify: `backend/pyproject.toml`
- Modify: relevant READMEs and environment examples

- [ ] **Step 1: Add tests proving the configured SEC user agent is used and the production app does not install tracebacks with local-variable capture**
- [ ] **Step 2: Disable traceback locals by default, remove backend URL disclosure, and add pytest `pythonpath` configuration**
- [ ] **Step 3: Run plain `pytest -q` from `backend/` and confirm all tests pass without `PYTHONPATH`**
- [ ] **Step 4: Run `npm run lint` and `npm run build` from `frontend/`**
- [ ] **Step 5: Run `git diff --check`, inspect the complete diff, and verify no credentials or generated artifacts are present**
- [ ] **Step 6: Commit `chore: finish reliability hardening`**
- [ ] **Step 7: Push `codex/reliability-hardening` to GitHub and report verification evidence**
