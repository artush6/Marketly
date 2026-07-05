import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from app.integrations.financials import fetch_ticker_financials


def complete_payload():
    return {
        "info": {"shortName": "Apple", "marketCap": 1_000_000},
        "quote": {"currentPrice": 10},
        "financials": {
            "income_statement": [
                {"date": "2026-03-31", "revenue": 100, "netIncome": 20},
                {"date": "2025-03-31", "revenue": 90, "netIncome": 18},
            ],
            "balance_sheet": [{"date": "2026-03-31", "totalAssets": 300}],
            "cash_flow": [{"date": "2026-03-31", "operatingCashFlow": 30}],
        },
        "sources": {
            "income_statement": "fmp",
            "balance_sheet": "fmp",
            "cash_flow": "fmp",
        },
    }


class FinancialConcurrencyTests(unittest.TestCase):
    @patch("app.integrations.financials.supabase_store.save_financial_payload")
    @patch("app.integrations.financials.supabase_store.save_snapshot")
    @patch("app.integrations.financials.supabase_store.get_latest_snapshot", return_value=None)
    @patch("app.integrations.financials.CacheManager.set")
    @patch("app.integrations.financials.CacheManager.get_with_source", return_value=(None, None))
    @patch("app.integrations.financials.fetch_yahoo_summary", return_value={})
    @patch("app.integrations.financials.fetch_yfinance_dividends", return_value={})
    @patch("app.integrations.financials.fetch_sec_payload", return_value={})
    @patch("app.integrations.financials.fetch_fmp_payload")
    @patch("app.integrations.financials.fetch_finnhub_payload", return_value={})
    @patch("app.integrations.financials.validate_financials_configuration")
    def test_concurrent_cold_calls_share_one_provider_fetch(
        self,
        _validate,
        _finnhub,
        fmp,
        _sec,
        _dividends,
        _yahoo,
        _cache_get,
        _cache_set,
        _snapshot_get,
        _snapshot_save,
        _materialize,
    ):
        def delayed_payload(_symbol):
            time.sleep(0.05)
            return complete_payload()

        fmp.side_effect = delayed_payload

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: fetch_ticker_financials("AAPL", True), range(2)))

        self.assertEqual(fmp.call_count, 1)
        self.assertEqual(results[0]["dataQuality"]["status"], "complete")
        self.assertEqual(results[0], results[1])

    @patch("app.integrations.financials.supabase_store.save_financial_payload")
    @patch("app.integrations.financials.supabase_store.save_snapshot")
    @patch("app.integrations.financials.supabase_store.get_latest_snapshot")
    @patch("app.integrations.financials.CacheManager.set")
    @patch("app.integrations.financials.CacheManager.get_with_source", return_value=(None, None))
    @patch("app.integrations.financials.fetch_yahoo_summary", return_value={})
    @patch("app.integrations.financials.fetch_yfinance_dividends", return_value={})
    @patch("app.integrations.financials.fetch_sec_payload", return_value={})
    @patch("app.integrations.financials.fetch_fmp_payload")
    @patch("app.integrations.financials.fetch_finnhub_payload", return_value={})
    @patch("app.integrations.financials.validate_financials_configuration")
    def test_stale_snapshot_does_not_skip_provider_fetch(
        self,
        _validate,
        _finnhub,
        fmp,
        _sec,
        _dividends,
        _yahoo,
        _cache_get,
        _cache_set,
        snapshot_get,
        _snapshot_save,
        _materialize,
    ):
        snapshot_get.return_value = {
            "payload": complete_payload(),
            "fetched_at": "2020-01-01T00:00:00+00:00",
        }
        fmp.return_value = complete_payload()

        result = fetch_ticker_financials("AAPL")

        fmp.assert_called_once_with("AAPL")
        self.assertEqual(result["_dataSource"], "fresh")


if __name__ == "__main__":
    unittest.main()
