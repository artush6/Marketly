import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.services.analysis_service import build_ticker_score


def sufficient_financial_payload(symbol="AAPL", name="Apple Inc."):
    return {
        "symbol": symbol,
        "info": {"shortName": name, "marketCap": 1_000_000},
        "quote": {"currentPrice": 10},
        "financials": {
            "income_statement": [
                {"date": "2026-03-31", "revenue": 100, "netIncome": 20},
                {"date": "2025-03-31", "revenue": 90, "netIncome": 18},
            ]
        },
        "sources": {"income_statement": "test"},
    }


class AnalysisServiceTests(unittest.TestCase):
    def setUp(self):
        settings_patcher = patch(
            "app.services.analysis_service.settings",
            SimpleNamespace(
                FRED_API_KEY="fred-key",
                FINNHUB_API_KEY="finnhub-key",
                FMP_API_KEY="fmp-key",
                OPENAI_API_KEY="openai-key",
                FMPSDK_API_KEY="fmp-key",
                RAPIDAPI_KEY=None,
            ),
        )
        validator_patcher = patch(
            "app.services.analysis_service.validate_financials_configuration"
        )
        scenarios_patcher = patch(
            "app.services.scenarios.service.generate_scenarios",
            return_value={"error": "skip network in unit tests"},
        )
        supabase_patcher = patch(
            "app.integrations.supabase_store.is_configured",
            return_value=False,
        )
        self.addCleanup(settings_patcher.stop)
        self.addCleanup(validator_patcher.stop)
        self.addCleanup(scenarios_patcher.stop)
        self.addCleanup(supabase_patcher.stop)
        settings_patcher.start()
        validator_patcher.start()
        scenarios_patcher.start()
        supabase_patcher.start()

    @patch("app.services.analysis_service.score_ticker")
    @patch("app.services.analysis_service.get_news")
    @patch("app.services.analysis_service.fetch_macro_indicators")
    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_build_ticker_score_orchestrates_dependencies(
        self,
        mock_fetch_ticker_financials,
        mock_fetch_macro_indicators,
        mock_get_news,
        mock_score_ticker,
    ):
        mock_fetch_ticker_financials.return_value = sufficient_financial_payload()
        mock_fetch_macro_indicators.return_value = {"GDP (Real)": []}
        mock_get_news.return_value = []
        mock_score_ticker.return_value = {
            "score": 80,
            "summary": "Strong profile",
            "positives": ["Growth"],
            "negatives": ["Rich valuation"],
        }

        result = build_ticker_score("aapl")

        mock_fetch_ticker_financials.assert_called_once_with("AAPL", force_refresh=False)
        mock_fetch_macro_indicators.assert_called_once_with()
        mock_get_news.assert_called_once_with("AAPL")
        self.assertEqual(result["symbol"], "AAPL")
        self.assertNotEqual(result["score"], 80)
        self.assertEqual(result["score"], result["scoreBreakdown"]["score"])
        self.assertEqual(result["scoreBreakdown"]["method"], "deterministic_v1")
        self.assertEqual(result["analysisMetadata"]["gptScore"], 80)
        self.assertEqual(result["analysisMetadata"]["modelSuggestedScore"], 80)
        self.assertIn("analysisId", result)
        self.assertIn("analysisVersion", result)
        self.assertIn("dataTimestamp", result)
        self.assertIn("profitability", result)
        self.assertIn("growth", result)
        self.assertIn("stability", result)
        self.assertIn("valuation", result)
        self.assertIn("analysisMetadata", result)
        self.assertEqual(result["dataSource"], "fresh")
        self.assertEqual(result["analysisMetadata"]["dataSource"], "fresh")
        self.assertEqual(result["analysisMetadata"]["dataSources"]["score"], "fresh")
        self.assertIn("factCoverage", result["analysisMetadata"])
        self.assertIn("dataQualityScore", result["analysisMetadata"])
        self.assertIn("confidenceLevel", result["analysisMetadata"])
        self.assertIn("provenance", result["analysisMetadata"])
        self.assertIn("refreshPolicy", result["analysisMetadata"])
        self.assertIn("inputPartitions", result["analysisMetadata"])
        self.assertIn("businessModel", result)
        self.assertIn("interpretation", result)
        self.assertIn("eventCatalysts", result)
        self.assertIn("historyContext", result)
        self.assertIn("marketContext", result)
        self.assertIn("scenarios", result)
        self.assertEqual(result["analysisSource"], "openai")

    @patch("app.services.analysis_service.score_ticker")
    @patch("app.services.analysis_service.get_news")
    @patch("app.services.analysis_service.fetch_macro_indicators")
    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_build_ticker_score_reconciles_generated_score_with_backend_score(
        self,
        mock_fetch_ticker_financials,
        mock_fetch_macro_indicators,
        mock_get_news,
        mock_score_ticker,
    ):
        mock_fetch_ticker_financials.return_value = {
            "symbol": "TMO",
            "info": {"shortName": "Thermo Fisher Scientific Inc.", "marketCap": 170_000.0},
            "financials": {
                "income_statement": [
                    {
                        "revenue": 11_000.0,
                        "netIncome": 1_600.0,
                        "period": "Q1",
                        "acceptedForm": "10-Q",
                    },
                    {
                        "revenue": 10_000.0,
                        "netIncome": 1_400.0,
                        "period": "Q1",
                        "acceptedForm": "10-Q",
                    },
                ]
            },
            "sources": {"income_statement": "test"},
        }
        mock_fetch_macro_indicators.return_value = {}
        mock_get_news.return_value = []
        mock_score_ticker.return_value = {
            "score": 78,
            "summary": "Strong company with a precomputed composite score of 78, but valuation sensitive.",
            "positives": [],
            "negatives": [],
        }

        result = build_ticker_score("tmo")

        self.assertEqual(result["score"], result["scoreBreakdown"]["score"])
        self.assertEqual(result["analysisMetadata"]["gptScore"], 78)
        self.assertEqual(result["analysisMetadata"]["modelSuggestedScore"], 78)
        self.assertIn(
            f"backend deterministic score of {result['score']}",
            result["summary"],
        )
        self.assertNotIn("score of 78", result["summary"])

    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_build_ticker_score_raises_on_financials_error(self, mock_fetch_ticker_financials):
        mock_fetch_ticker_financials.return_value = {"error": "no provider data"}

        with self.assertRaises(ValueError):
            build_ticker_score("aapl")

    @patch("app.services.analysis_service.score_ticker")
    @patch("app.services.analysis_service.get_news", return_value=[])
    @patch("app.services.analysis_service.fetch_macro_indicators", return_value={})
    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_insufficient_financials_return_degraded_result_without_gpt(
        self,
        fetch_financials,
        _macro,
        _news,
        score_ticker,
    ):
        fetch_financials.return_value = {
            "symbol": "AAPL",
            "info": {"shortName": "Apple Inc."},
            "financials": {},
        }

        result = build_ticker_score("aapl")

        self.assertIsNone(result["score"])
        self.assertEqual(result["analysisSource"], "degraded")
        self.assertEqual(
            result["analysisMetadata"]["financialQuality"]["status"],
            "insufficient",
        )
        score_ticker.assert_not_called()

    @patch("app.services.analysis_service.score_ticker")
    @patch("app.services.analysis_service.get_news")
    @patch("app.services.analysis_service.fetch_macro_indicators")
    @patch("app.services.analysis_service.fetch_ticker_financials")
    def test_build_ticker_score_falls_back_on_analysis_error(
        self,
        mock_fetch_ticker_financials,
        mock_fetch_macro_indicators,
        mock_get_news,
        mock_score_ticker,
    ):
        mock_fetch_ticker_financials.return_value = sufficient_financial_payload()
        mock_fetch_macro_indicators.return_value = {}
        mock_get_news.return_value = []
        mock_score_ticker.return_value = {"error": "openai timeout"}

        result = build_ticker_score("aapl")

        self.assertEqual(result["analysisSource"], "fallback")
        self.assertIsInstance(result["score"], int)
        self.assertEqual(result["score"], result["scoreBreakdown"]["score"])

    @patch("app.services.analysis_service.supabase_store.save_analysis_run")
    @patch("app.services.analysis_service.CacheManager")
    def test_build_ticker_score_returns_cached_score_when_available(
        self,
        mock_cache,
        mock_save_analysis_run,
    ):
        mock_cache.make_key.return_value = "marketly:scores:AAPL"
        mock_cache.get_with_source.return_value = (
            '{"symbol":"AAPL","score":91,"summary":"Cached with a composite score of 72",'
            '"positives":[],"negatives":[],"company":"Apple Inc.",'
            '"profitability":{"coverage":0.0},"growth":{"coverage":0.0},'
            '"stability":{"coverage":0.0},"valuation":{"coverage":0.0},'
            '"analysisMetadata":{"financialQuality":{"scoreEligible":true}}}',
            "cache",
        )

        result = build_ticker_score("aapl")

        self.assertEqual(result["score"], 91)
        self.assertEqual(result["dataSource"], "cache")
        self.assertIn("backend deterministic score of 91", result["summary"])
        mock_cache.get_with_source.assert_called_once_with("marketly:scores:AAPL")
        mock_save_analysis_run.assert_called_once()


if __name__ == "__main__":
    unittest.main()
