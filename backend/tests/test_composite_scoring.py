import unittest

from app.services.scoring.composite import build_composite_score


class CompositeScoringTests(unittest.TestCase):
    def test_builds_deterministic_score_with_subscores(self):
        result = build_composite_score(
            {
                "profitability": {
                    "grossMargin": 0.62,
                    "operatingMargin": 0.3,
                    "netMargin": 0.22,
                    "roe": 0.28,
                },
                "growth": {
                    "revenueGrowthYoY": 0.18,
                    "revenueCagr3Y": 0.12,
                    "epsGrowthYoY": 0.16,
                    "netIncomeGrowthYoY": 0.14,
                },
                "valuation": {
                    "trailingPE": 22,
                    "forwardPE": 20,
                    "priceToSales": 6,
                    "pegRatio": 1.4,
                },
                "stability": {
                    "debtToEquity": 0.4,
                    "debtRatio": 0.25,
                    "interestCoverage": 10,
                },
            },
            {
                "marginQuality": {"label": "strong"},
                "growthDurability": {"label": "strong"},
                "valuationDependency": {"label": "moderate"},
                "balanceSheetRisk": {"label": "low"},
            },
            {
                "equityRiskSentiment": "risk_on",
                "liquidityFlag": "easing",
                "indexTrend": "rising",
                "inflationDirection": "falling",
                "rateDirection": "falling",
            },
            {
                "keyCatalysts": [{"tone": "positive"}, {"tone": "positive"}],
                "retentionRisk": "low",
            },
            {"confidenceLevel": "high"},
        )

        self.assertEqual(result["method"], "deterministic_v1")
        self.assertGreater(result["score"], 60)
        self.assertEqual(result["confidenceAdjustment"], 0)
        self.assertEqual(set(result["subscores"]), set(result["maxSubscores"]))

    def test_low_confidence_applies_adjustment(self):
        result = build_composite_score(
            {"profitability": {}, "growth": {}, "valuation": {}, "stability": {}},
            {},
            {},
            {},
            {"confidenceLevel": "low"},
        )

        self.assertEqual(result["confidenceAdjustment"], -5)
        self.assertEqual(result["score"], result["rawScore"] - 5)


if __name__ == "__main__":
    unittest.main()
