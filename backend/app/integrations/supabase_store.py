from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

TABLE_NAME = "market_data_cache"
SNAPSHOT_TABLE_NAME = "market_data_snapshots"


def _supabase_key() -> str | None:
    return settings.SUPABASE_SERVICE_ROLE_KEY


def is_configured() -> bool:
    return bool(settings.SUPABASE_URL and _supabase_key())


def _base_url() -> str:
    base_url = settings.SUPABASE_URL.rstrip("/")
    if base_url.endswith("/rest/v1"):
        return base_url[: -len("/rest/v1")]
    return base_url


def _rest_url(table_name: str = TABLE_NAME) -> str:
    return f"{_base_url()}/rest/v1/{table_name}"


def _headers(*, prefer: str | None = None) -> dict[str, str]:
    key = _supabase_key() or ""
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _upsert_rows(table_name: str, rows: list[dict[str, Any]], *, on_conflict: str) -> None:
    if not rows or not is_configured():
        return

    try:
        response = requests.post(
            _rest_url(table_name),
            headers=_headers(prefer="resolution=merge-duplicates,return=minimal"),
            params={"on_conflict": on_conflict},
            json=rows,
            timeout=10,
        )
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Supabase upsert failed for %s: %s", table_name, exc)


def _expires_at(ttl_seconds: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat()


def get_json(namespace: str, cache_key: str) -> Any | None:
    if not is_configured():
        return None

    now = datetime.now(timezone.utc).isoformat()
    params = {
        "namespace": f"eq.{namespace}",
        "cache_key": f"eq.{cache_key}",
        "expires_at": f"gt.{now}",
        "select": "payload",
        "limit": "1",
    }

    try:
        response = requests.get(_rest_url(), headers=_headers(), params=params, timeout=5)
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return None
        return rows[0].get("payload")
    except Exception as exc:
        logger.warning("Supabase cache read failed for %s:%s: %s", namespace, cache_key, exc)
        return None


def set_json(namespace: str, cache_key: str, payload: Any, ttl_seconds: int) -> None:
    if not is_configured():
        return

    row = {
        "namespace": namespace,
        "cache_key": cache_key,
        "payload": payload,
        "expires_at": _expires_at(ttl_seconds),
    }

    try:
        response = requests.post(
            _rest_url(),
            headers=_headers(prefer="resolution=merge-duplicates,return=minimal"),
            params={"on_conflict": "namespace,cache_key"},
            json=row,
            timeout=5,
        )
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Supabase cache write failed for %s:%s: %s", namespace, cache_key, exc)


def get_latest_snapshot(kind: str, entity_key: str) -> dict[str, Any] | None:
    if not is_configured():
        return None

    params = {
        "kind": f"eq.{kind}",
        "entity_key": f"eq.{entity_key}",
        "select": "payload,provenance,period_end,fetched_at",
        "order": "fetched_at.desc",
        "limit": "1",
    }

    try:
        response = requests.get(
            _rest_url(SNAPSHOT_TABLE_NAME),
            headers=_headers(),
            params=params,
            timeout=5,
        )
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return None
        return rows[0]
    except Exception as exc:
        logger.warning("Supabase snapshot read failed for %s:%s: %s", kind, entity_key, exc)
        return None


def save_snapshot(
    kind: str,
    entity_key: str,
    payload: Any,
    *,
    provenance: dict[str, Any] | None = None,
    period_end: str | None = None,
) -> None:
    if not is_configured():
        return

    row = {
        "kind": kind,
        "entity_key": entity_key,
        "payload": payload,
        "provenance": provenance or {},
        "period_end": period_end,
    }

    try:
        response = requests.post(
            _rest_url(SNAPSHOT_TABLE_NAME),
            headers=_headers(prefer="return=minimal"),
            json=row,
            timeout=5,
        )
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Supabase snapshot write failed for %s:%s: %s", kind, entity_key, exc)


def save_financial_payload(symbol: str, payload: dict[str, Any]) -> None:
    if not is_configured():
        return

    symbol = symbol.upper()
    info = payload.get("info", {})
    sources = payload.get("sources", {})
    company_row = {
        "symbol": symbol,
        "name": info.get("shortName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "country": info.get("country"),
        "currency": info.get("currency"),
    }
    _upsert_rows("companies", [company_row], on_conflict="symbol")

    financials = payload.get("financials", {})
    statement_rows: list[dict[str, Any]] = []
    for statement_type, rows in financials.items():
        if not isinstance(rows, list):
            continue
        source = sources.get(statement_type, "unknown")
        for row in rows:
            if not isinstance(row, dict):
                continue
            period_end = row.get("fiscalDateEnding") or row.get("date")
            if not period_end:
                continue
            statement_rows.append(
                {
                    "symbol": symbol,
                    "statement_type": statement_type,
                    "period": row.get("period"),
                    "fiscal_year": row.get("calendarYear") or row.get("fiscalYear"),
                    "period_end": period_end,
                    "filed_at": row.get("filedDate"),
                    "source": source,
                    "payload": row,
                }
            )
    _upsert_rows(
        "financial_statement_rows",
        statement_rows,
        on_conflict="symbol,statement_type,period_end,source",
    )

    metric_rows: list[dict[str, Any]] = []
    metric_period_end = datetime.now(timezone.utc).date().isoformat()
    metric_keys = (
        "marketCap",
        "beta",
        "trailingPE",
        "forwardPE",
        "priceToBook",
        "priceToSales",
        "dividendYield",
        "roe",
        "grossMargin",
        "debtToEquity",
    )
    for key in metric_keys:
        value = info.get(key)
        if isinstance(value, (int, float)):
            metric_rows.append(
                {
                    "symbol": symbol,
                    "metric_key": key,
                    "metric_value": value,
                    "period_end": metric_period_end,
                    "source": "profile_metrics",
                    "provenance": sources,
                }
            )
    _upsert_rows(
        "financial_metrics",
        metric_rows,
        on_conflict="symbol,metric_key,period_end,source",
    )


def save_macro_observations(payload: dict[str, Any]) -> None:
    rows: list[dict[str, Any]] = []
    for series_name, observations in payload.items():
        if not isinstance(observations, list):
            continue
        for observation in observations:
            if not isinstance(observation, dict) or not observation.get("date"):
                continue
            rows.append(
                {
                    "series_name": series_name,
                    "observation_date": observation.get("date"),
                    "value": observation.get("value"),
                    "source": "fred",
                }
            )
    _upsert_rows("macro_observations", rows, on_conflict="series_name,observation_date,source")


def save_news_articles(symbol: str, articles: list[dict[str, Any]]) -> None:
    rows: list[dict[str, Any]] = []
    for article in articles:
        if not isinstance(article, dict):
            continue
        external_id = str(
            article.get("id")
            or article.get("datetime")
            or article.get("url")
            or article.get("headline")
        )
        published_at = None
        if isinstance(article.get("datetime"), (int, float)):
            published_at = datetime.fromtimestamp(article["datetime"], tz=timezone.utc).isoformat()
        rows.append(
            {
                "symbol": symbol.upper(),
                "external_id": external_id,
                "headline": article.get("headline"),
                "summary": article.get("summary"),
                "url": article.get("url"),
                "source": article.get("source"),
                "published_at": published_at,
                "payload": article,
            }
        )
    _upsert_rows("news_articles", rows, on_conflict="symbol,external_id")


def save_analysis_run(payload: dict[str, Any]) -> None:
    analysis_id = payload.get("analysisId")
    if not analysis_id:
        return
    row = {
        "analysis_id": analysis_id,
        "symbol": payload.get("symbol"),
        "analysis_version": payload.get("analysisVersion"),
        "score": payload.get("score"),
        "payload": payload,
        "data_sources": payload.get("analysisMetadata", {}).get("dataSources", {}),
    }
    _upsert_rows("analysis_runs", [row], on_conflict="analysis_id")
