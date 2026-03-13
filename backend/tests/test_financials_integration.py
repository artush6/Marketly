import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.integrations.financials import fetch_fmp_payload, merge_provider_payload
from app.services.scoring.metrics import build_scoring_metrics


class FinancialsIntegrationTests(unittest.TestCase):
    @patch("app.integrations.financials.safe_get")
    @patch(
        "app.integrations.financials.settings",
        SimpleNamespace(FMP_API_KEY="fmp-key", FMPSDK_API_KEY="legacy-fmp-key"),
    )
    def test_fetch_fmp_payload_uses_stable_endpoints_and_maps_statements(self, mock_safe_get):
        def side_effect(url, params=None, source_name="", headers=None):
            if url.endswith("/ratios-ttm"):
                return [
                    {
                        "priceToSalesRatioTTM": 7.2,
                        "debtEquityRatioTTM": 1.5,
                        "dividendYieldTTM": 0.004,
                        "returnOnEquityTTM": 1.1,
                        "grossProfitMarginTTM": 0.46,
                    }
                ]
            if url.endswith("/income-statement"):
                return [{"reportedCurrency": "USD", "revenue": 100, "netIncome": 20}]
            if url.endswith("/balance-sheet-statement"):
                return [{"totalAssets": 300, "totalDebt": 120, "totalStockholdersEquity": 80}]
            if url.endswith("/cash-flow-statement"):
                return [{"operatingCashFlow": 50}]
            if url.endswith("/as-reported-income-statements"):
                return [{"reportedCurrency": "USD", "revenue": 100}]
            return None

        mock_safe_get.side_effect = side_effect

        payload = fetch_fmp_payload("AAPL")

        self.assertEqual(payload["info"]["priceToSales"], 7.2)
        self.assertEqual(payload["info"]["debtToEquity"], 1.5)
        self.assertEqual(payload["info"]["currency"], "USD")
        self.assertEqual(payload["financials"]["income_statement"][0]["revenue"], 100)
        self.assertEqual(payload["financials"]["balance_sheet"][0]["totalAssets"], 300)
        self.assertEqual(payload["financials"]["cash_flow"][0]["operatingCashFlow"], 50)
        self.assertEqual(payload["sources"]["income_statement"], "fmp")
        self.assertEqual(payload["sources"]["balance_sheet"], "fmp")
        self.assertEqual(payload["sources"]["cash_flow"], "fmp")

    def test_merge_provider_payload_merges_financial_blocks_without_overwriting_with_none(self):
        target = {
            "symbol": "AAPL",
            "info": {"shortName": "Apple"},
            "quote": {"c": 200},
            "analyst_data": None,
            "financials": {"income_statement": [{"revenue": 100}]},
            "dividends": {},
            "sources": {"profile": "finnhub"},
        }
        payload = {
            "info": {"currency": "USD", "shortName": None},
            "quote": {"currentPrice": 201},
            "financials": {"balance_sheet": [{"totalAssets": 300}]},
            "sources": {"balance_sheet": "fmp"},
        }

        merge_provider_payload(target, payload)

        self.assertEqual(target["info"]["shortName"], "Apple")
        self.assertEqual(target["info"]["currency"], "USD")
        self.assertEqual(target["quote"]["currentPrice"], 201)
        self.assertIn("balance_sheet", target["financials"])
        self.assertEqual(target["sources"]["balance_sheet"], "fmp")


class ScoringMetricsTests(unittest.TestCase):
    def test_build_scoring_metrics_uses_balance_sheet_for_stability_inputs(self):
        ticker_data = {
            "symbol": "AAPL",
            "info": {"marketCap": 1000},
            "quote": {"currentPrice": 10},
            "financials": {
                "income_statement": [
                    {
                        "revenue": 100,
                        "netIncome": 20,
                        "eps": 2,
                        "operatingIncome": 30,
                        "interestExpense": 5,
                        "costOfRevenue": 40,
                        "ebitda": 35,
                    },
                    {"revenue": 80, "netIncome": 15, "eps": 1.5},
                    {"revenue": 70, "netIncome": 10, "eps": 1.0},
                    {"revenue": 60, "netIncome": 8, "eps": 0.8},
                ],
                "balance_sheet": [
                    {
                        "totalStockholdersEquity": 50,
                        "totalDebt": 25,
                        "totalAssets": 100,
                    }
                ],
            },
        }

        metrics = build_scoring_metrics(ticker_data)

        self.assertEqual(metrics["stability"]["debtToEquity"], 0.5)
        self.assertEqual(metrics["stability"]["debtRatio"], 0.25)
        self.assertEqual(metrics["profitability"]["roe"], 0.4)


if __name__ == "__main__":
    unittest.main()
