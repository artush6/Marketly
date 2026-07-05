import unittest
from datetime import datetime, timedelta, timezone

from app.services.financial_quality import (
    assess_financial_quality,
    attach_financial_quality,
    quality_rank,
)


class FinancialQualityTests(unittest.TestCase):
    def test_empty_payload_is_insufficient_and_not_cacheable(self):
        quality = assess_financial_quality(
            {"info": {}, "quote": {}, "financials": {}, "sources": {}}
        )

        self.assertEqual(quality["status"], "insufficient")
        self.assertEqual(quality["coverage"], 0.0)
        self.assertFalse(quality["cacheEligible"])
        self.assertFalse(quality["scoreEligible"])
        self.assertIn("income_statement", quality["missingCriticalFields"])

    def test_two_income_periods_are_partial_and_score_eligible(self):
        quality = assess_financial_quality(
            {
                "info": {"shortName": "Example Corp", "marketCap": 1_000_000},
                "quote": {"currentPrice": 10},
                "financials": {
                    "income_statement": [
                        {"date": "2026-03-31", "revenue": 100, "netIncome": 20},
                        {"date": "2025-03-31", "revenue": 90, "netIncome": 18},
                    ]
                },
                "sources": {"income_statement": "sec_xbrl"},
            }
        )

        self.assertEqual(quality["status"], "partial")
        self.assertTrue(quality["cacheEligible"])
        self.assertTrue(quality["scoreEligible"])
        self.assertGreater(quality["coverage"], 0.35)

    def test_full_statement_set_is_complete(self):
        payload = {
            "info": {"shortName": "Example Corp", "marketCap": 1_000_000},
            "quote": {"currentPrice": 10},
            "financials": {
                "income_statement": [
                    {
                        "date": "2026-03-31",
                        "revenue": 100,
                        "netIncome": 20,
                        "operatingIncome": 25,
                    },
                    {
                        "date": "2025-03-31",
                        "revenue": 90,
                        "netIncome": 18,
                        "operatingIncome": 22,
                    },
                ],
                "balance_sheet": [
                    {"date": "2026-03-31", "totalAssets": 300, "totalDebt": 50}
                ],
                "cash_flow": [
                    {"date": "2026-03-31", "operatingCashFlow": 30}
                ],
            },
            "sources": {
                "income_statement": "fmp",
                "balance_sheet": "fmp",
                "cash_flow": "fmp",
            },
        }

        quality = assess_financial_quality(payload)

        self.assertEqual(quality["status"], "complete")
        self.assertEqual(quality["statementCoverage"], 1.0)
        self.assertTrue(quality["cacheEligible"])
        self.assertTrue(quality["scoreEligible"])

    def test_old_payload_is_marked_stale(self):
        fetched_at = datetime.now(timezone.utc) - timedelta(days=10)
        quality = assess_financial_quality(
            {
                "info": {"shortName": "Example Corp", "marketCap": 1_000_000},
                "quote": {"currentPrice": 10},
                "financials": {
                    "income_statement": [
                        {"date": "2026-03-31", "revenue": 100, "netIncome": 20},
                        {"date": "2025-03-31", "revenue": 90, "netIncome": 18},
                    ]
                },
                "sources": {"income_statement": "sec_xbrl"},
            },
            fetched_at=fetched_at.isoformat(),
            max_age_seconds=86400,
        )

        self.assertEqual(quality["status"], "stale")
        self.assertFalse(quality["cacheEligible"])
        self.assertFalse(quality["scoreEligible"])

    def test_attach_quality_adds_timestamp_and_rank_orders_statuses(self):
        payload = {"info": {}, "quote": {}, "financials": {}, "sources": {}}

        attached = attach_financial_quality(payload)

        self.assertIn("fetchedAt", attached["dataQuality"])
        self.assertGreater(quality_rank({"status": "complete"}), quality_rank({"status": "partial"}))
        self.assertGreater(quality_rank({"status": "partial"}), quality_rank({"status": "insufficient"}))


if __name__ == "__main__":
    unittest.main()
