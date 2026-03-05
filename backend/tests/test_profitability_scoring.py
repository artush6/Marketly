import unittest

from app.services.scoring.profitability import compute_profitability_metrics


class ProfitabilityScoringTests(unittest.TestCase):
    def test_compute_profitability_metrics_with_valid_data(self):
        income_statement = [
            {
                "revenue": 1000,
                "netIncome": 150,
                "operatingIncome": 220,
                "ebitda": 300,
                "costOfRevenue": 450,
            }
        ]

        result = compute_profitability_metrics(income_statement)

        self.assertAlmostEqual(result["grossMargin"], 0.55)
        self.assertAlmostEqual(result["operatingMargin"], 0.22)
        self.assertAlmostEqual(result["netMargin"], 0.15)
        self.assertAlmostEqual(result["ebitdaMargin"], 0.30)
        self.assertIsNotNone(result["profitabilityScore"])
        self.assertEqual(result["coverage"], 1.0)

    def test_compute_profitability_metrics_handles_missing_data(self):
        income_statement = [{"revenue": 1000, "netIncome": 40}]

        result = compute_profitability_metrics(income_statement)

        self.assertIsNotNone(result["netMargin"])
        self.assertIsNone(result["grossMargin"])
        self.assertIsNone(result["operatingMargin"])
        self.assertIsNone(result["ebitdaMargin"])
        self.assertEqual(result["coverage"], 0.25)


if __name__ == "__main__":
    unittest.main()
