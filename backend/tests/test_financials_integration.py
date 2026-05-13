import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.integrations.financials import (
    fetch_fmp_payload,
    fetch_sec_payload,
    fetch_ticker_financials,
    merge_provider_payload,
    validate_financials_configuration,
)
from app.services.scoring.metrics import build_scoring_metrics


class FinancialsIntegrationTests(unittest.TestCase):
    @patch(
        "app.integrations.financials.settings",
        SimpleNamespace(
            FINNHUB_API_KEY=None,
            FMP_API_KEY=None,
            FMPSDK_API_KEY=None,
            RAPIDAPI_KEY=None,
        ),
    )
    def test_validate_financials_configuration_allows_public_sec_fallback(self):
        validate_financials_configuration()

    @patch("app.integrations.financials.safe_get")
    def test_fetch_sec_payload_maps_company_facts_to_statement_rows(self, mock_safe_get):
        def side_effect(url, params=None, source_name="", headers=None):
            if url.endswith("/company_tickers.json"):
                return {"0": {"ticker": "AAPL", "cik_str": 320193, "title": "Apple Inc."}}
            if url.endswith("/CIK0000320193.json") and "/submissions/" in url:
                return {"name": "Apple Inc."}
            if url.endswith("/CIK0000320193.json") and "/companyfacts/" in url:
                return {
                    "facts": {
                        "us-gaap": {
                            "Revenues": {
                                "units": {
                                    "USD": [
                                        {
                                            "val": 100,
                                            "form": "10-Q",
                                            "fy": 2026,
                                            "fp": "Q1",
                                            "end": "2026-03-31",
                                            "filed": "2026-05-01",
                                            "frame": "CY2026Q1",
                                        },
                                        {
                                            "val": 90,
                                            "form": "10-Q",
                                            "fy": 2025,
                                            "fp": "Q4",
                                            "end": "2025-12-31",
                                            "filed": "2026-02-01",
                                            "frame": "CY2025Q4",
                                        },
                                        {
                                            "val": 80,
                                            "form": "10-Q",
                                            "fy": 2025,
                                            "fp": "Q3",
                                            "end": "2025-09-30",
                                            "filed": "2025-11-01",
                                            "frame": "CY2025Q3",
                                        },
                                        {
                                            "val": 70,
                                            "form": "10-Q",
                                            "fy": 2025,
                                            "fp": "Q2",
                                            "end": "2025-06-30",
                                            "filed": "2025-08-01",
                                            "frame": "CY2025Q2",
                                        }
                                    ]
                                }
                            },
                            "NetIncomeLoss": {
                                "units": {
                                    "USD": [
                                        {
                                            "val": 20,
                                            "form": "10-Q",
                                            "fy": 2026,
                                            "fp": "Q1",
                                            "end": "2026-03-31",
                                            "filed": "2026-05-01",
                                            "frame": "CY2026Q1",
                                        },
                                        {
                                            "val": 18,
                                            "form": "10-Q",
                                            "fy": 2025,
                                            "fp": "Q4",
                                            "end": "2025-12-31",
                                            "filed": "2026-02-01",
                                            "frame": "CY2025Q4",
                                        },
                                        {
                                            "val": 16,
                                            "form": "10-Q",
                                            "fy": 2025,
                                            "fp": "Q3",
                                            "end": "2025-09-30",
                                            "filed": "2025-11-01",
                                            "frame": "CY2025Q3",
                                        },
                                        {
                                            "val": 14,
                                            "form": "10-Q",
                                            "fy": 2025,
                                            "fp": "Q2",
                                            "end": "2025-06-30",
                                            "filed": "2025-08-01",
                                            "frame": "CY2025Q2",
                                        }
                                    ]
                                }
                            },
                            "Assets": {
                                "units": {
                                    "USD": [
                                        {
                                            "val": 300,
                                            "form": "10-Q",
                                            "fy": 2026,
                                            "fp": "Q1",
                                            "end": "2026-03-31",
                                            "filed": "2026-05-01",
                                        }
                                    ]
                                }
                            },
                            "StockholdersEquity": {
                                "units": {
                                    "USD": [
                                        {
                                            "val": 150,
                                            "form": "10-Q",
                                            "fy": 2026,
                                            "fp": "Q1",
                                            "end": "2026-03-31",
                                            "filed": "2026-05-01",
                                        }
                                    ]
                                }
                            },
                            "NetCashProvidedByUsedInOperatingActivities": {
                                "units": {
                                    "USD": [
                                        {
                                            "val": 35,
                                            "form": "10-Q",
                                            "fy": 2026,
                                            "fp": "Q1",
                                            "end": "2026-03-31",
                                            "filed": "2026-05-01",
                                        }
                                    ]
                                }
                            },
                        }
                    }
                }
            return None

        mock_safe_get.side_effect = side_effect

        payload = fetch_sec_payload("AAPL")

        self.assertEqual(payload["info"]["shortName"], "Apple Inc.")
        self.assertEqual(payload["financials"]["income_statement"][0]["revenue"], 100)
        self.assertEqual(payload["financials"]["income_statement"][0]["netIncome"], 20)
        self.assertEqual(len(payload["financials"]["income_statement"]), 4)
        self.assertEqual(payload["financials"]["income_statement"][3]["revenue"], 70)
        self.assertEqual(payload["financials"]["balance_sheet"][0]["totalAssets"], 300)
        self.assertEqual(payload["financials"]["balance_sheet"][0]["totalStockholdersEquity"], 150)
        self.assertEqual(payload["financials"]["cash_flow"][0]["operatingCashFlow"], 35)
        self.assertEqual(payload["sources"]["income_statement"], "sec_xbrl")

    @patch("app.integrations.financials.CacheManager")
    @patch("app.integrations.financials.supabase_store.save_financial_payload")
    @patch("app.integrations.financials.supabase_store.save_snapshot")
    @patch("app.integrations.financials.fetch_yahoo_summary", return_value={})
    @patch("app.integrations.financials.fetch_yfinance_dividends", return_value={})
    @patch("app.integrations.financials.fetch_sec_payload")
    @patch("app.integrations.financials.fetch_fmp_payload")
    @patch("app.integrations.financials.fetch_finnhub_payload")
    @patch("app.integrations.financials.validate_financials_configuration")
    def test_fetch_ticker_financials_uses_sec_when_provider_statements_are_missing(
        self,
        mock_validate,
        mock_finnhub,
        mock_fmp,
        mock_sec,
        mock_yfinance,
        mock_yahoo,
        mock_save_snapshot,
        mock_save_financial_payload,
        mock_cache_manager,
    ):
        mock_cache_manager.make_key.return_value = "tickers:AAPL"
        mock_cache_manager.get.return_value = None
        mock_finnhub.return_value = {
            "info": {"shortName": "Apple Inc.", "marketCap": 1000},
            "quote": {},
            "financials": {},
            "sources": {"profile": "finnhub"},
        }
        mock_fmp.return_value = {
            "info": {"grossMargin": 0.4},
            "quote": {},
            "financials": {},
            "sources": {"ratios": "fmp"},
        }
        mock_sec.return_value = {
            "info": {},
            "quote": {},
            "financials": {"income_statement": [{"revenue": 100, "netIncome": 20}]},
            "sources": {"income_statement": "sec_xbrl"},
        }

        merged = fetch_ticker_financials("AAPL", force_refresh=True)

        self.assertEqual(merged["financials"]["income_statement"][0]["revenue"], 100)
        self.assertEqual(merged["sources"]["income_statement"], "sec_xbrl")
        self.assertEqual(merged["_dataSource"], "fresh")
        mock_sec.assert_called_once_with("AAPL")

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
