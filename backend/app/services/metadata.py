from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from app.serialization import sanitize


ANALYSIS_VERSION = "2026-05-scenarios-v3"


def build_analysis_id(
    symbol: str,
    analysis_version: str,
    data_timestamp: str,
    provenance: dict[str, Any],
) -> str:
    payload = sanitize(
        {
            "symbol": symbol.upper(),
            "analysisVersion": analysis_version,
            "dataTimestamp": data_timestamp,
            "provenance": provenance,
        }
    )
    digest = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return digest[:24]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def build_provenance(
    ticker_sources: dict[str, Any] | None,
    *,
    analysis_source: str,
    scenario_source: str,
) -> dict[str, Any]:
    ticker_sources = ticker_sources or {}
    return {
        "financialFacts": ticker_sources,
        "macro": {"provider": "fred", "kind": "raw"},
        "news": {"provider": "finnhub", "kind": "raw"},
        "computedLayers": {
            "factGraph": "marketly",
            "scoringMetrics": "marketly",
            "businessModel": "marketly",
            "interpretation": "marketly",
            "eventCatalysts": "marketly",
            "historyContext": "marketly",
            "trajectory": "marketly",
        },
        "generatedLayers": {
            "scenarios": scenario_source,
            "analysis": analysis_source,
        },
    }


def build_refresh_policy() -> dict[str, Any]:
    return {
        "financialFacts": "daily_or_on_quarterly_report",
        "news": "hourly",
        "macro": "daily",
        "marketContext": "daily",
        "computedMetrics": "when_financial_facts_change",
        "scenarios": "when_metrics_news_or_market_context_change",
        "gptAnalysis": "when_any_primary_input_changes",
    }
