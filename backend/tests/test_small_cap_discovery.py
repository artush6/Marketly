import unittest

from app.services.small_cap_discovery import classify_market_cap, score_small_cap_candidate


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


if __name__ == "__main__":
    unittest.main()
