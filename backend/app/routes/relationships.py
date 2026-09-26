"""Persisted company relationship intelligence discovered from dated evidence."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import requests

from fastapi import APIRouter, HTTPException

from app.core.errors import MisconfigurationError
from app.core.config import settings
from app.core.symbols import normalize_symbol_input
from app.integrations import supabase_store
from app.services.relationship_research import identity

router = APIRouter(prefix="/relationships", tags=["relationships"])


def relationship_payload(symbol: str) -> dict:
    relationships = supabase_store.get_company_relationships(symbol)
    companies = supabase_store._select_rows("companies", {"symbol": f"eq.{symbol}", "select": "name", "limit": "1"})
    focal = {identity(symbol), identity(companies[0].get("name")) if companies else ""}
    relationships = [row for row in relationships if identity(row.get("related_company_name")) not in focal
                     and (not row.get("related_symbol") or identity(row["related_symbol"]) not in focal)]
    jobs = supabase_store._select_rows("market_refresh_jobs", {"kind": "eq.relationships", "symbol": f"eq.{symbol}", "select": "next_run_at,lease_until,last_success_at,last_error", "limit": "1"})
    job = jobs[0] if jobs else {}
    now = datetime.now(timezone.utc).isoformat()
    state = "running" if (job.get("lease_until") or "") > now else "failed" if job.get("last_error") else "queued" if job and job.get("next_run_at", now) <= now else "idle"
    return {
        "symbol": symbol,
        "relationships": relationships,
        "count": len(relationships),
        "loadedAt": datetime.now(timezone.utc).isoformat(),
        "researchState": state,
        "researchReport": supabase_store.get_json("relationship_research", symbol),
        "coverageNote": "Dated public evidence across filings, supplier disclosures and corporate archives. Historical evidence does not establish a current relationship; public coverage is not exhaustive.",
    }


@router.get("/{symbol}")
def relationships(symbol: str):
    return relationship_payload(normalize_symbol_input(symbol))


@router.post("/{symbol}/refresh")
def refresh_relationships(symbol: str):
    symbol = normalize_symbol_input(symbol)
    try:
        if not supabase_store.is_configured() or not settings.OPENAI_API_KEY:
            raise MisconfigurationError("Relationship research requires configured OpenAI and Supabase connections.")
        from app.services.market_refresh import rpc
        rpc("enqueue_market_refresh", {"p_kind": "relationships", "p_symbol": symbol})
        now = datetime.now(timezone.utc)
        # Atomic predicates prevent duplicate paid runs while leased, and bound manual rechecks.
        response = requests.patch(supabase_store._rest_url("market_refresh_jobs"), headers=supabase_store._headers(),
            params={"kind": "eq.relationships", "symbol": f"eq.{symbol}",
                    "and": f"(or(lease_until.is.null,lease_until.lt.{now.isoformat()}),or(last_success_at.is.null,last_success_at.lt.{(now-timedelta(minutes=15)).isoformat()}))"},
            json={"next_run_at": now.isoformat(), "last_error": None}, timeout=10)
        response.raise_for_status()
        return relationship_payload(symbol)
    except MisconfigurationError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, "Relationship evidence refresh is temporarily unavailable.") from exc
