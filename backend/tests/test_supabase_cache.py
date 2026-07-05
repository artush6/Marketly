import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.core.cache import CacheManager
from app.integrations.economics import fetch_macro_indicators
from app.integrations.financials import fetch_ticker_financials
from app.integrations.news import get_news
from app.integrations import supabase_store


class SupabaseStoreTests(unittest.TestCase):
    @patch(
        "app.integrations.supabase_store.settings",
        SimpleNamespace(
            SUPABASE_URL="https://project.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY=None,
            SUPABASE_ANON_KEY="anon-key",
        ),
    )
    def test_requires_service_role_key_for_server_side_cache(self):
        self.assertFalse(supabase_store.is_configured())

    @patch(
        "app.integrations.supabase_store.settings",
        SimpleNamespace(
            SUPABASE_URL="https://project.supabase.co/rest/v1",
            SUPABASE_SERVICE_ROLE_KEY="service-key",
            SUPABASE_ANON_KEY="anon-key",
        ),
    )
    @patch("app.integrations.supabase_store.requests.get")
    def test_get_json_reads_unexpired_payload(self, mock_get):
        mock_get.return_value.json.return_value = [{"payload": {"revenue": 100}}]
        mock_get.return_value.raise_for_status.return_value = None

        payload = supabase_store.get_json("tickers", "TMO")

        self.assertEqual(payload, {"revenue": 100})
        args, kwargs = mock_get.call_args
        self.assertEqual(args[0], "https://project.supabase.co/rest/v1/market_data_cache")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer service-key")
        self.assertEqual(kwargs["params"]["namespace"], "eq.tickers")
        self.assertEqual(kwargs["params"]["cache_key"], "eq.TMO")

    @patch(
        "app.integrations.supabase_store.settings",
        SimpleNamespace(
            SUPABASE_URL="https://project.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY="service-key",
            SUPABASE_ANON_KEY=None,
        ),
    )
    @patch("app.integrations.supabase_store.requests.post")
    def test_set_json_upserts_payload_with_ttl(self, mock_post):
        mock_post.return_value.raise_for_status.return_value = None

        supabase_store.set_json("macro", "indicators_20", {"GDP": []}, 3600)

        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://project.supabase.co/rest/v1/market_data_cache")
        self.assertEqual(kwargs["params"]["on_conflict"], "namespace,cache_key")
        self.assertEqual(kwargs["json"]["namespace"], "macro")
        self.assertEqual(kwargs["json"]["cache_key"], "indicators_20")
        self.assertEqual(kwargs["json"]["payload"], {"GDP": []})
        self.assertIn("expires_at", kwargs["json"])

    @patch(
        "app.integrations.supabase_store.settings",
        SimpleNamespace(
            SUPABASE_URL="https://project.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY="service-key",
            SUPABASE_ANON_KEY=None,
        ),
    )
    @patch("app.integrations.supabase_store.requests.post")
    def test_save_financial_payload_uses_live_companies_name_column(self, mock_post):
        mock_post.return_value.raise_for_status.return_value = None

        supabase_store.save_financial_payload(
            "AAPL",
            {
                "info": {"shortName": "Apple Inc.", "currency": "USD"},
                "sources": {},
                "financials": {},
            },
        )

        company_call = mock_post.call_args_list[0]
        self.assertEqual(
            company_call.args[0],
            "https://project.supabase.co/rest/v1/companies",
        )
        self.assertEqual(company_call.kwargs["json"][0]["name"], "Apple Inc.")
        self.assertNotIn("company_name", company_call.kwargs["json"][0])

    @patch(
        "app.integrations.supabase_store.settings",
        SimpleNamespace(
            SUPABASE_URL="https://project.supabase.co",
            SUPABASE_SERVICE_ROLE_KEY="service-key",
            SUPABASE_ANON_KEY=None,
        ),
    )
    @patch("app.integrations.supabase_store.requests.post")
    def test_save_analysis_run_handles_missing_metadata(self, mock_post):
        mock_post.return_value.raise_for_status.return_value = None

        supabase_store.save_analysis_run(
            {
                "analysisId": "analysis-aapl",
                "symbol": "AAPL",
                "analysisVersion": "v1",
                "score": 72,
                "analysisMetadata": None,
            },
        )

        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://project.supabase.co/rest/v1/analysis_runs")
        self.assertEqual(kwargs["json"][0]["data_sources"], {})


class CacheManagerPersistentFallbackTests(unittest.TestCase):
    @patch("app.core.cache.r", None)
    @patch("app.core.cache.supabase_store.get_json", return_value={"symbol": "TMO"})
    def test_get_reads_supabase_when_redis_is_unavailable(self, mock_get_json):
        cached = CacheManager.get(CacheManager.make_key("tickers", "TMO"))

        self.assertEqual(json.loads(cached), {"symbol": "TMO"})
        mock_get_json.assert_called_once_with("tickers", "TMO")

    @patch("app.core.cache.r", None)
    @patch("app.core.cache.supabase_store.set_json")
    def test_set_writes_supabase_when_redis_is_unavailable(self, mock_set_json):
        CacheManager.set(
            CacheManager.make_key("scores", "TMO"),
            json.dumps({"score": 53}),
        )

        mock_set_json.assert_called_once_with("scores", "TMO", {"score": 53}, 21600)


class SnapshotFirstIntegrationTests(unittest.TestCase):
    @patch("app.integrations.financials.CacheManager.get_with_source", return_value=(None, None))
    @patch("app.integrations.financials.CacheManager.set")
    @patch("app.integrations.financials.supabase_store.save_financial_payload")
    @patch(
        "app.integrations.financials.supabase_store.get_latest_snapshot",
        return_value={
            "fetched_at": "2026-07-05T00:00:00+00:00",
            "payload": {
                "symbol": "TMO",
                "info": {"shortName": "Thermo", "marketCap": 1_000_000},
                "quote": {"currentPrice": 10},
                "financials": {
                    "income_statement": [
                        {"date": "2026-03-31", "revenue": 100, "netIncome": 20},
                        {"date": "2025-03-31", "revenue": 90, "netIncome": 18},
                    ]
                },
                "sources": {"income_statement": "sec_xbrl"},
            },
        },
    )
    @patch("app.integrations.financials.fetch_finnhub_payload")
    @patch("app.integrations.financials.validate_financials_configuration")
    def test_financials_read_supabase_snapshot_before_provider_fetch(
        self,
        mock_validate,
        mock_finnhub,
        mock_snapshot,
        mock_save_financial_payload,
        mock_cache_set,
        mock_cache_get,
    ):
        payload = fetch_ticker_financials("TMO")

        self.assertEqual(payload["symbol"], "TMO")
        self.assertEqual(payload["_dataSource"], "supabase")
        mock_snapshot.assert_called_once_with("financials", "TMO")
        mock_save_financial_payload.assert_called_once()
        mock_finnhub.assert_not_called()

    @patch(
        "app.integrations.financials.CacheManager.get_with_source",
        return_value=(
            '{"symbol":"TSLA","info":{"shortName":"Tesla","marketCap":1000000},'
            '"quote":{"currentPrice":10},"financials":{"income_statement":['
            '{"date":"2026-03-31","revenue":100,"netIncome":20},'
            '{"date":"2025-03-31","revenue":90,"netIncome":18}]},'
            '"sources":{"income_statement":"sec_xbrl"}}',
            "cache",
        ),
    )
    @patch("app.integrations.financials.CacheManager.set")
    @patch("app.integrations.financials.supabase_store.save_financial_payload")
    @patch("app.integrations.financials.supabase_store.get_latest_snapshot")
    @patch("app.integrations.financials.fetch_finnhub_payload")
    @patch("app.integrations.financials.validate_financials_configuration")
    def test_financials_cache_hit_materializes_supabase_rows(
        self,
        mock_validate,
        mock_finnhub,
        mock_snapshot,
        mock_save_financial_payload,
        mock_cache_set,
        mock_cache_get,
    ):
        payload = fetch_ticker_financials("TSLA")

        self.assertEqual(payload["symbol"], "TSLA")
        self.assertEqual(payload["_dataSource"], "cache")
        mock_save_financial_payload.assert_called_once()
        mock_snapshot.assert_not_called()
        mock_finnhub.assert_not_called()

    @patch("app.integrations.economics.CacheManager.get_with_source", return_value=(None, None))
    @patch("app.integrations.economics.CacheManager.set")
    @patch(
        "app.integrations.economics.supabase_store.get_latest_snapshot",
        return_value={"payload": {"GDP (Real)": [{"date": "2026-01-01", "value": 1.0}]}},
    )
    @patch("app.integrations.economics._get_fred_client")
    def test_macro_reads_supabase_snapshot_before_fred(
        self,
        mock_fred,
        mock_snapshot,
        mock_cache_set,
        mock_cache_get,
    ):
        payload = fetch_macro_indicators()

        self.assertIn("GDP (Real)", payload)
        self.assertEqual(payload["_dataSource"], "supabase")
        mock_snapshot.assert_called_once_with("macro", "indicators_20")
        mock_fred.assert_not_called()

    @patch("app.integrations.news.CacheManager.get_with_source", return_value=(None, None))
    @patch("app.integrations.news.CacheManager.set")
    @patch("app.integrations.news.supabase_store.save_news_articles")
    @patch(
        "app.integrations.news.supabase_store.get_latest_snapshot",
        return_value={"payload": [{"headline": "cached"}]},
    )
    @patch("app.integrations.news._get_finnhub_client")
    def test_news_reads_supabase_snapshot_before_finnhub(
        self,
        mock_client,
        mock_snapshot,
        mock_save_news_articles,
        mock_cache_set,
        mock_cache_get,
    ):
        payload = get_news("TMO")

        self.assertEqual(payload, [{"headline": "cached"}])
        mock_snapshot.assert_called_once_with("news", "TMO_3d_8")
        mock_save_news_articles.assert_called_once_with("TMO", [{"headline": "cached"}])
        mock_client.assert_not_called()


if __name__ == "__main__":
    unittest.main()
