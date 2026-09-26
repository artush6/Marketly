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


def _upsert_rows(
    table_name: str,
    rows: list[dict[str, Any]],
    *,
    on_conflict: str,
    strict: bool = False,
) -> None:
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
        if strict:
            raise
        logger.warning("Supabase upsert failed for %s: %s", table_name, exc)


def _select_rows(table_name: str, params: dict[str, str], *, timeout: int = 5) -> list[dict[str, Any]]:
    if not is_configured():
        return []
    response = requests.get(_rest_url(table_name), headers=_headers(), params=params, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, list) else []


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


def set_json(namespace: str, cache_key: str, payload: Any, ttl_seconds: int, *, strict: bool = False) -> None:
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
        if strict:
            raise
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


def get_financial_history(symbol: str) -> dict[str, Any]:
    """Load normalized statement history so a thin snapshot cannot hide older periods."""
    if not is_configured():
        return {}

    params = {
        "symbol": f"eq.{symbol.upper()}",
        "select": "statement_type,period_end,source,payload",
        "order": "period_end.desc",
        "limit": "500",
    }
    try:
        response = requests.get(
            _rest_url("financial_statement_rows"),
            headers=_headers(),
            params=params,
            timeout=5,
        )
        response.raise_for_status()
        records = response.json()
    except Exception as exc:
        logger.warning("Supabase financial history read failed for %s: %s", symbol, exc)
        return {}

    statements: dict[str, list[dict[str, Any]]] = {}
    sources: dict[str, set[str]] = {}
    keyed: dict[tuple[str, str, str], dict[str, Any]] = {}
    for record in records if isinstance(records, list) else []:
        statement_type = record.get("statement_type")
        payload = record.get("payload")
        if not statement_type or not isinstance(payload, dict):
            continue
        period_end = str(
            payload.get("fiscalDateEnding")
            or payload.get("date")
            or record.get("period_end")
            or ""
        )
        period = str(payload.get("period") or payload.get("fp") or "")
        key = (statement_type, period_end, period)
        current = keyed.get(key)
        if current is None:
            current = dict(payload)
            current.setdefault("date", period_end)
            statements.setdefault(statement_type, []).append(current)
            keyed[key] = current
        else:
            for field_name, value in payload.items():
                if value is not None and current.get(field_name) is None:
                    current[field_name] = value
        source = record.get("source")
        if source:
            sources.setdefault(statement_type, set()).update(
                part for part in str(source).split("+") if part
            )

    for rows in statements.values():
        rows.sort(
            key=lambda row: str(row.get("fiscalDateEnding") or row.get("date") or ""),
            reverse=True,
        )
    return {
        "financials": statements,
        "sources": {
            statement_type: "+".join(sorted(provider_names))
            for statement_type, provider_names in sources.items()
        },
    }

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
        "employee_count": info.get("fullTimeEmployees"),
        "founded_year": info.get("foundedYear"),
        "ipo_date": info.get("ipoDate"),
        "chief_executive": info.get("chiefExecutive"),
        "headquarters": info.get("headquarters"),
        "office_locations": info.get("officeLocations") or [],
        "company_description": info.get("longBusinessSummary"),
        "profile_payload": info,
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
                "importance_score": article.get("importanceScore", 1),
                "importance_label": article.get("importanceLabel", "routine"),
                "relationship_signal": bool(article.get("relationshipSignal")),
                "relationship_type": (article.get("relationshipSignal") or {}).get("relationshipType"),
                "related_company_name": (article.get("relationshipSignal") or {}).get("relatedCompanyName"),
                "related_symbol": (article.get("relationshipSignal") or {}).get("relatedSymbol"),
                "skimmed_at": article.get("skimmedAt"),
                "payload": article,
            }
        )
    _upsert_rows("news_articles", rows, on_conflict="symbol,external_id")
    save_relationship_signals(symbol, articles)


def _company_id(symbol: str) -> str | None:
    _upsert_rows("companies", [{"symbol": symbol.upper()}], on_conflict="symbol")
    rows = _select_rows("companies", {
        "symbol": f"eq.{symbol.upper()}", "select": "id", "limit": "1",
    })
    return str(rows[0]["id"]) if rows and rows[0].get("id") else None


def save_relationship_signals(symbol: str, articles: list[dict[str, Any]]) -> None:
    if not is_configured():
        return
    company_id = _company_id(symbol)
    if not company_id:
        return
    rows: list[dict[str, Any]] = []
    for article in articles:
        signal = article.get("relationshipSignal") if isinstance(article, dict) else None
        source_url = article.get("url") if isinstance(article, dict) else None
        if not isinstance(signal, dict) or not signal.get("relatedCompanyName") or not source_url:
            continue
        source_date = None
        if isinstance(article.get("datetime"), (int, float)):
            source_date = datetime.fromtimestamp(article["datetime"], tz=timezone.utc).date().isoformat()
        rows.append({
            "company_id": company_id,
            "related_company_name": signal["relatedCompanyName"],
            "related_symbol": signal.get("relatedSymbol"),
            "relationship_type": signal.get("relationshipType") or "other",
            "direction": signal.get("direction") or "mutual",
            "product_service": signal.get("productService"),
            "evidence_summary": article.get("headline") or "Relationship mentioned in company news",
            "source_url": source_url,
            "source_date": source_date,
            "confidence": signal.get("confidence", 0.65),
            "last_verified_at": datetime.now(timezone.utc).isoformat(),
        })
    _upsert_rows(
        "company_relationships", rows,
        on_conflict="company_id,related_company_name,relationship_type,source_url",
    )


def get_company_relationships(symbol: str) -> list[dict[str, Any]]:
    company_id = _company_id(symbol)
    if not company_id:
        return []
    return _select_rows("company_relationships", {
        "company_id": f"eq.{company_id}",
        "select": "id,related_company_name,related_symbol,relationship_type,direction,product_service,evidence_summary,source_url,source_date,confidence,last_verified_at",
        "order": "confidence.desc,source_date.desc", "limit": "100",
    })


def get_market_instruments() -> list[dict[str, Any]]:
    try:
        return _select_rows("market_instruments", {
            "active": "eq.true", "select": "symbol,name,asset_class,region,proxy_note,default_order",
            "order": "default_order.asc,symbol.asc",
        })
    except Exception as exc:
        logger.warning("Market instrument read failed: %s", exc)
        return []


def upsert_market_instrument(instrument: dict[str, Any]) -> None:
    _upsert_rows("market_instruments", [instrument], on_conflict="symbol", strict=True)


def get_workspace_trackers(workspace_key: str) -> list[str]:
    try:
        rows = _select_rows("workspace_market_trackers", {
            "workspace_key": f"eq.{workspace_key}", "select": "symbol,sort_order",
            "order": "sort_order.asc,symbol.asc",
        })
        return [str(row["symbol"]) for row in rows if row.get("symbol")]
    except Exception as exc:
        logger.warning("Market tracker read failed: %s", exc)
        return []


def set_workspace_trackers(workspace_key: str, symbols: list[str]) -> None:
    if not is_configured():
        return
    response = requests.delete(
        _rest_url("workspace_market_trackers"), headers=_headers(prefer="return=minimal"),
        params={"workspace_key": f"eq.{workspace_key}"}, timeout=5,
    )
    response.raise_for_status()
    _upsert_rows(
        "workspace_market_trackers",
        [{"workspace_key": workspace_key, "symbol": symbol, "sort_order": index}
         for index, symbol in enumerate(symbols)],
        on_conflict="workspace_key,symbol",
        strict=True,
    )


def save_analysis_run(payload: dict[str, Any]) -> None:
    analysis_id = payload.get("analysisId")
    if not analysis_id:
        return
    metadata = payload.get("analysisMetadata") if isinstance(payload.get("analysisMetadata"), dict) else {}
    row = {
        "analysis_id": analysis_id,
        "symbol": payload.get("symbol"),
        "analysis_version": payload.get("analysisVersion"),
        "score": payload.get("score"),
        "payload": payload,
        "data_sources": metadata.get("dataSources", {}),
    }
    _upsert_rows("analysis_runs", [row], on_conflict="analysis_id")


def get_json_many(namespace: str, cache_keys: list[str]) -> dict[str, Any]:
    """One bounded read for a watchlist. Propagate failure instead of claiming no events."""
    if not is_configured() or not cache_keys:
        return {}
    response = requests.get(_rest_url(), headers=_headers(), params={
        "namespace": "eq." + namespace,
        "cache_key": "in.(" + ",".join(cache_keys) + ")",
        "expires_at": "gt." + datetime.now(timezone.utc).isoformat(),
        "select": "cache_key,payload",
    }, timeout=5)
    response.raise_for_status()
    return {row["cache_key"]: row["payload"] for row in response.json()}


def delete_json(namespace: str, cache_key: str) -> None:
    if not is_configured():
        return
    response = requests.delete(_rest_url(), headers=_headers(), params={
        "namespace": "eq." + namespace, "cache_key": "eq." + cache_key,
    }, timeout=5)
    response.raise_for_status()
