import unittest

from app.services import small_cap_discovery
from app.services.small_cap_discovery import (
    MAX_DEEP_CANDIDATES,
    SmallCapDiscoveryProfile,
    classify_market_cap,
    score_small_cap_candidate,
)


def payload(*, growth=0.25, prior_revenue=800, revenue=1000, op_income=180,
            net_income=130, operating_cash=160, capex=-35,
            debt=100, prior_debt=95, shares=100, prior_shares=99):
    return {
        "symbol": "TEST",
        "info": {
            "shortName": "Test Growth Corp",
            "sector": "Technology",
            "industry": "Software",
            "marketCap": 900_000_000,
            "trailingPE": 24,
            "priceToSales": 4,
        },
        "financials": {
            "income_statement": [
                {"date": "2026-09-30", "revenue": revenue, "operatingIncome": op_income, "netIncome": net_income},
                {"date": "2025-09-30", "revenue": prior_revenue, "operatingIncome": 100, "netIncome": 80},
                {"date": "2023-09-30", "revenue": 560, "operatingIncome": 50, "netIncome": 30},
            ],
            "balance_sheet": [
                {"date": "2026-09-30", "totalDebt": debt, "sharesOutstanding": shares},
                {"date": "2025-09-30", "totalDebt": prior_debt, "sharesOutstanding": prior_shares},
            ],
            "cash_flow": [
                {"date": "2026-09-30", "operatingCashFlow": operating_cash, "capitalExpenditure": capex},
            ],
        },
        "sources": {
            "income_statement": "test",
            "balance_sheet": "test",
            "cash_flow": "test",
            "metrics": "test",
        },
    }


class SmallCapDiscoveryTests(unittest.TestCase):
    def test_market_cap_classification(self):
        self.assertEqual(classify_market_cap(100_000_000), "micro")
        self.assertEqual(classify_market_cap(900_000_000), "small")
        self.assertEqual(classify_market_cap(4_000_000_000), "mid")

    def test_stronger_company_ranks_above_weak_company(self):
        strong = score_small_cap_candidate(
            "GOOD",
            payload(),
            relationship_summary={"verifiedCount": 4, "highConfidenceCount": 3, "types": ["customer"], "available": True},
        )
        weak = score_small_cap_candidate(
            "WEAK",
            payload(
                prior_revenue=1100,
                revenue=900,
                op_income=-60,
                net_income=-90,
                operating_cash=-30,
                capex=-40,
                debt=180,
                prior_debt=100,
                shares=130,
                prior_shares=100,
            ),
            relationship_summary={"verifiedCount": 0, "highConfidenceCount": 0, "types": [], "available": False},
        )
        self.assertGreater(strong["potentialScore"], weak["potentialScore"])
        self.assertGreater(
            strong["futurePotential"]["estimated12mOutperformanceProbability"],
            weak["futurePotential"]["estimated12mOutperformanceProbability"],
        )
        self.assertFalse(strong["futurePotential"]["calibrated"])

    def test_sparse_evidence_shrinks_probability_toward_half(self):
        sparse = score_small_cap_candidate(
            "SPARSE",
            {
                "symbol": "SPARSE",
                "info": {"shortName": "Sparse Corp", "marketCap": 400_000_000},
                "financials": {},
                "sources": {},
            },
            relationship_summary={"verifiedCount": 0, "types": [], "available": False},
        )
        probability = sparse["futurePotential"]["estimated12mOutperformanceProbability"]
        self.assertAlmostEqual(probability, 0.5, places=2)
        self.assertIn("thin_evidence", sparse["riskFlags"])

    def test_risk_score_and_method_versions_are_explicit(self):
        result = score_small_cap_candidate(
            "RISKY",
            payload(op_income=-60, operating_cash=-30, shares=130, prior_shares=100),
            screener_row={"avgVolume": 12_000},
            relationship_summary={"verifiedCount": 0, "types": [], "available": False},
        )
        self.assertGreater(result["riskScore"], 0)
        self.assertIn("low_liquidity", result["riskFlags"])
        self.assertEqual(result["methodVersion"], "small_cap_potential_v1")
        self.assertEqual(result["riskMethodVersion"], "small_cap_risk_v1")
        self.assertIsInstance(result["evidence"], list)
        if result["evidence"]:
            self.assertIn("source", result["evidence"][0])

    def test_profile_normalizes_countries_and_rejects_unbounded_scans(self):
        profile = SmallCapDiscoveryProfile(countries=("us", "US", "ca"), deep_limit=3).validate()
        self.assertEqual(profile.countries, ("US", "CA"))
        with self.assertRaises(ValueError):
            SmallCapDiscoveryProfile(deep_limit=MAX_DEEP_CANDIDATES + 1).validate()
        with self.assertRaises(ValueError):
            SmallCapDiscoveryProfile(min_market_cap=2_000, max_market_cap=1_000).validate()

    def test_scan_uses_profile_for_each_country_and_deduplicates_listings(self):
        calls = []
        def universe(**kwargs):
            calls.append(kwargs)
            return [{"symbol": "SAME", "marketCap": 500_000_000}]
        def financials(symbol):
            return payload()
        original_universe = small_cap_discovery.fetch_small_cap_universe
        original_financials = small_cap_discovery.fetch_ticker_financials
        original_score = small_cap_discovery.score_small_cap_candidate
        try:
            small_cap_discovery.fetch_small_cap_universe = universe
            small_cap_discovery.fetch_ticker_financials = financials
            small_cap_discovery.score_small_cap_candidate = lambda *args, **kwargs: {"symbol": args[0], "potentialScore": 70}
            profile = SmallCapDiscoveryProfile(countries=("US", "CA"), deep_limit=2).validate()
            result = small_cap_discovery.scan_small_caps(profile=profile)
        finally:
            small_cap_discovery.fetch_small_cap_universe = original_universe
            small_cap_discovery.fetch_ticker_financials = original_financials
            small_cap_discovery.score_small_cap_candidate = original_score
        self.assertEqual([call["country"] for call in calls], ["US", "CA"])
        self.assertEqual(result["universeCount"], 1)
        self.assertEqual(result["criteria"]["countries"], ["US", "CA"])

    def test_persistence_keeps_current_row_and_immutable_observation(self):
        original_configured = small_cap_discovery.supabase_store.is_configured
        original_upsert = small_cap_discovery.supabase_store._upsert_rows
        writes = []
        try:
            small_cap_discovery.supabase_store.is_configured = lambda: True
            small_cap_discovery.supabase_store._upsert_rows = lambda table, rows, **kwargs: writes.append((table, rows, kwargs))
            small_cap_discovery.persist_small_cap_scan({
                "generatedAt": "2026-10-02T00:00:00+00:00",
                "candidates": [{
                    "symbol": "TEST", "potentialScore": 73, "riskScore": 22,
                    "evidenceCoverage": 0.8, "methodVersion": "small_cap_potential_v1",
                    "futurePotential": {"estimated12mOutperformanceProbability": 0.64, "method": "heuristic_signal_v1"},
                }],
            })
        finally:
            small_cap_discovery.supabase_store.is_configured = original_configured
            small_cap_discovery.supabase_store._upsert_rows = original_upsert
        self.assertEqual([write[0] for write in writes], ["small_cap_candidates", "small_cap_candidate_snapshots"])
        self.assertEqual(writes[1][1][0]["risk_score"], 22)
        self.assertEqual(writes[1][2]["on_conflict"], "symbol,scanned_at")

    def test_scan_enqueue_uses_durable_queue_with_profile_payload(self):
        original_configured = small_cap_discovery.supabase_store.is_configured
        original_post = small_cap_discovery.requests.post
        class Response:
            def raise_for_status(self):
                return None
            def json(self):
                return True
        calls = []
        try:
            small_cap_discovery.supabase_store.is_configured = lambda: True
            small_cap_discovery.requests.post = lambda *args, **kwargs: calls.append((args, kwargs)) or Response()
            queued = small_cap_discovery.enqueue_small_cap_scan(
                SmallCapDiscoveryProfile(name="europe-micro", countries=("FR", "DE"), deep_limit=4)
            )
        finally:
            small_cap_discovery.supabase_store.is_configured = original_configured
            small_cap_discovery.requests.post = original_post
        self.assertTrue(queued)
        self.assertIn("rpc/enqueue_small_cap_scan", calls[0][0][0])
        self.assertEqual(calls[0][1]["json"]["p_payload"]["countries"], ["FR", "DE"])


if __name__ == "__main__":
    unittest.main()
