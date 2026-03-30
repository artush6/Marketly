import unittest

from app.models import TickerData
from app.services.scoring.metrics import build_scoring_metrics


class ScoringMetricsTests(unittest.TestCase):
    def test_prefers_api_values_and_uses_fallbacks_for_missing_fields(self):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "AAPL",
                "info": {
                    "trailingPE": 30.0,
                    "forwardPE": 28.0,
                    "priceToBook": 12.0,
                    "priceToSales": 7.0,
                    "dividendYield": 0.01,
                    "marketCap": 1_000.0,
                    "roe": 0.25,
                    "grossMargin": 0.60,
                    "debtToEquity": 1.2,
                },
                "quote": {
                    "currentPrice": 100.0,
                },
                "financials": {
                    "income_statement": [
                        {
                            "revenue": 100.0,
                            "netIncome": 10.0,
                            "operatingIncome": 20.0,
                            "ebitda": 25.0,
                            "costOfRevenue": 55.0,
                            "totalStockholdersEquity": 50.0,
                            "totalDebt": 40.0,
                            "totalAssets": 120.0,
                            "interestExpense": 5.0,
                            "eps": 2.0,
                        },
                        {
                            "revenue": 80.0,
                            "netIncome": 8.0,
                            "eps": 1.5,
                        },
                    ]
                },
            }
        )

        metrics = build_scoring_metrics(ticker_data)

        self.assertEqual(metrics["valuation"]["trailingPE"], 30.0)
        self.assertEqual(metrics["valuation"]["forwardPE"], 28.0)
        self.assertEqual(metrics["valuation"]["priceToBook"], 12.0)
        self.assertEqual(metrics["valuation"]["priceToSales"], 7.0)
        self.assertEqual(metrics["valuation"]["dividendYield"], 0.01)
        self.assertEqual(metrics["profitability"]["grossMargin"], 0.60)
        self.assertEqual(metrics["profitability"]["roe"], 0.25)
        self.assertEqual(metrics["stability"]["debtToEquity"], 1.2)
        self.assertAlmostEqual(metrics["growth"]["revenueGrowthYoY"], 0.25)
        self.assertAlmostEqual(metrics["growth"]["epsGrowthYoY"], 1 / 3)

    def test_computes_valuation_fallbacks_when_api_values_are_missing(self):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "MSFT",
                "info": {
                    "marketCap": 2_000.0,
                },
                "quote": {
                    "currentPrice": 100.0,
                },
                "financials": {
                    "income_statement": [
                        {
                            "revenue": 250.0,
                            "netIncome": 50.0,
                            "totalStockholdersEquity": 400.0,
                            "eps": 5.0,
                        },
                        {
                            "revenue": 200.0,
                            "netIncome": 40.0,
                            "eps": 4.0,
                        },
                    ]
                },
            }
        )

        metrics = build_scoring_metrics(ticker_data)

        self.assertEqual(metrics["valuation"]["trailingPE"], 20.0)
        self.assertEqual(metrics["valuation"]["priceToBook"], 5.0)
        self.assertEqual(metrics["valuation"]["priceToSales"], 8.0)
        self.assertIsNone(metrics["valuation"]["dividendYield"])

    def test_normalizes_percent_like_provider_metrics(self):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "NVDA",
                "info": {
                    "marketCap": 3_000.0,
                    "grossMargin": 75.0,
                    "roe": 48.0,
                    "dividendYield": 0.4,
                    "debtToEquity": 35.0,
                },
                "quote": {
                    "currentPrice": 120.0,
                },
                "financials": {
                    "income_statement": [
                        {
                            "revenue": 200.0,
                            "netIncome": 80.0,
                            "operatingIncome": 90.0,
                            "costOfRevenue": 50.0,
                            "eps": 4.0,
                        },
                        {
                            "revenue": 150.0,
                            "netIncome": 60.0,
                            "eps": 2.0,
                        },
                    ],
                    "balance_sheet": [
                        {
                            "totalStockholdersEquity": 500.0,
                            "totalDebt": 175.0,
                            "totalAssets": 900.0,
                        }
                    ],
                },
            }
        )

        metrics = build_scoring_metrics(ticker_data)

        self.assertEqual(metrics["profitability"]["grossMargin"], 0.75)
        self.assertEqual(metrics["profitability"]["roe"], 0.48)
        self.assertEqual(metrics["valuation"]["dividendYield"], 0.4)
        self.assertEqual(metrics["stability"]["debtToEquity"], 0.35)

    def test_recomputes_implausible_provider_peg_using_growth_percent_scale(self):
        ticker_data = TickerData.from_raw(
            {
                "symbol": "META",
                "info": {
                    "trailingPE": 28.0,
                    "pegRatio": 140.0,
                    "marketCap": 1_000.0,
                },
                "quote": {
                    "currentPrice": 140.0,
                },
                "financials": {
                    "income_statement": [
                        {
                            "revenue": 100.0,
                            "netIncome": 30.0,
                            "eps": 7.0,
                        },
                        {
                            "revenue": 80.0,
                            "netIncome": 20.0,
                            "eps": 5.0,
                        },
                    ],
                    "balance_sheet": [
                        {
                            "totalStockholdersEquity": 300.0,
                        }
                    ],
                },
            }
        )

        metrics = build_scoring_metrics(ticker_data)

        self.assertAlmostEqual(metrics["growth"]["epsGrowthYoY"], 0.4)
        self.assertAlmostEqual(metrics["valuation"]["pegRatio"], 0.7)


if __name__ == "__main__":
    unittest.main()
