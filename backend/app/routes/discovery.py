"""Small discovery endpoints; no analysis or LLM calls are needed for search."""

import re

import requests
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.integrations import supabase_store
from app.services.small_cap_discovery import (
    DISCOVERY_PROFILE_PRESETS,
    MAX_DEEP_CANDIDATES,
    SmallCapDiscoveryProfile,
    enqueue_small_cap_scan,
    load_persisted_small_caps,
    load_small_cap_history,
    small_cap_scan_status,
)

router = APIRouter(prefix="/discovery", tags=["discovery"])
SYMBOL = re.compile(r"^[A-Z0-9][A-Z0-9.:-]{0,19}$")


class SmallCapScanRequest(BaseModel):
    name: str = Field(default="custom", max_length=80)
    min_market_cap: int = Field(default=50_000_000, ge=0)
    max_market_cap: int = Field(default=2_000_000_000, gt=0)
    min_average_volume: int = Field(default=100_000, ge=0)
    countries: list[str] = Field(default_factory=lambda: ["US"], min_length=1, max_length=5)
    sector: str | None = Field(default=None, max_length=80)
    deep_limit: int = Field(default=10, ge=1, le=MAX_DEEP_CANDIDATES)

    def as_profile(self) -> SmallCapDiscoveryProfile:
        try:
            return SmallCapDiscoveryProfile(
                name=self.name,
                min_market_cap=self.min_market_cap,
                max_market_cap=self.max_market_cap,
                min_average_volume=self.min_average_volume,
                countries=tuple(self.countries),
                sector=self.sector,
                deep_limit=self.deep_limit,
            ).validate()
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc


def provider_get(path: str, params: dict):
    if not settings.FINNHUB_API_KEY:
        raise HTTPException(503, "Company discovery requires a Finnhub API key.")
    try:
        response = requests.get(
            f"https://finnhub.io/api/v1/{path}",
            params={**params, "token": settings.FINNHUB_API_KEY},
            timeout=8,
        )
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict) and payload.get("error"):
            raise ValueError("Provider returned an error")
        return payload
    except (requests.RequestException, ValueError):
        raise HTTPException(502, "Company discovery is temporarily unavailable.")


@router.get("/search")
def search(q: str = Query(min_length=1, max_length=80)):
    query = q.strip()
    if not query:
        raise HTTPException(422, "Enter a company name or ticker.")
    payload = provider_get("search", {"q": query})
    if not isinstance(payload, dict):
        raise HTTPException(502, "Invalid company search response.")
    results = []
    seen = set()
    for item in payload.get("result", []):
        if not isinstance(item, dict):
            continue
        symbol = item.get("symbol", "")
        if not isinstance(symbol, str) or not SYMBOL.fullmatch(symbol) or symbol in seen:
            continue
        seen.add(symbol)
        results.append({"symbol": symbol, "name": item.get("description") or symbol,
                        "type": item.get("type") or "Security"})
        if len(results) == 12:
            break
    return {"results": results, "source": "Finnhub"}


@router.get("/peers/{symbol}")
def peers(symbol: str):
    symbol = symbol.strip().upper()
    if not SYMBOL.fullmatch(symbol):
        raise HTTPException(422, "Invalid ticker.")
    payload = provider_get("stock/peers", {"symbol": symbol})
    if not isinstance(payload, list):
        raise HTTPException(502, "Invalid peer response.")
    results = list(dict.fromkeys(item for item in payload if isinstance(item, str)
                                and SYMBOL.fullmatch(item) and item != symbol))[:6]
    return {"symbols": results, "source": "Finnhub", "benchmark": "Selected peer average"}


@router.get("/comparables/{symbol}")
def comparables(symbol: str):
    """Return typed peer candidates while preserving why each company matched."""
    symbol = symbol.strip().upper()
    if not SYMBOL.fullmatch(symbol):
        raise HTTPException(422, "Invalid ticker.")
    provider_payload = provider_get("stock/peers", {"symbol": symbol})
    if not isinstance(provider_payload, list):
        raise HTTPException(502, "Invalid peer response.")
    industry = list(dict.fromkeys(
        item for item in provider_payload
        if isinstance(item, str) and SYMBOL.fullmatch(item) and item != symbol
    ))[:12]
    verified_competitors = []
    persistence_available = supabase_store.is_configured()
    if persistence_available:
        try:
            for row in supabase_store.get_company_relationships(symbol):
                related = row.get("related_symbol")
                if (row.get("relationship_type") == "competitor" and isinstance(related, str)
                        and SYMBOL.fullmatch(related.upper()) and related.upper() != symbol):
                    verified_competitors.append({
                        "symbol": related.upper(),
                        "name": row.get("related_company_name") or related.upper(),
                        "evidence": row.get("evidence_summary"),
                        "sourceUrl": row.get("source_url"),
                        "sourceDate": row.get("source_date"),
                        "confidence": row.get("confidence"),
                    })
        except Exception:
            persistence_available = False
    # Deduplicate competitor evidence without losing a directly disclosed match.
    by_symbol = {row["symbol"]: row for row in verified_competitors}
    return {
        "symbol": symbol,
        "groups": [
            {"type": "verified_competitor", "label": "Verified competitors", "candidates": list(by_symbol.values())[:12],
             "method": "Named competitor relationships with stored source evidence."},
            {"type": "industry_peer", "label": "Industry peers", "candidates": [{"symbol": value} for value in industry],
             "method": "Finnhub peer suggestions; review business-model fit before comparison."},
        ],
        "coverage": {"verifiedRelationships": persistence_available, "industryProvider": "Finnhub"},
        "limitations": [
            "Peer membership is a discovery aid, not proof that operating models or accounting bases are comparable.",
            "Business-model, valuation, growth-profile, historical-analog, and supply-chain groups require broader normalized coverage and remain unavailable.",
            "No historical outcome calibration or point-in-time universe is provided.",
        ],
    }


@router.get("/small-caps")
def small_cap_candidates(
    limit: int = Query(default=30, ge=1, le=100),
    min_score: int = Query(default=0, ge=0, le=100),
):
    """Read the durable discovery shortlist without making provider calls."""
    return {
        "candidates": load_persisted_small_caps(limit=limit, min_score=min_score),
        "persistenceAvailable": supabase_store.is_configured(),
        "source": "Marketly deterministic small-cap discovery",
    }


@router.get("/small-caps/profiles")
def small_cap_profile_presets():
    return {
        "profiles": [
            {
                "name": name,
                **limits,
                "min_average_volume": 100_000,
                "countries": ["US"],
                "deep_limit": 10,
            }
            for name, limits in DISCOVERY_PROFILE_PRESETS.items()
        ],
        "marketCapCurrency": "USD",
    }


@router.get("/small-caps/{symbol}/history")
def small_cap_candidate_history(symbol: str, limit: int = Query(default=50, ge=1, le=100)):
    symbol = symbol.strip().upper()
    if not SYMBOL.fullmatch(symbol):
        raise HTTPException(422, "Invalid ticker.")
    return {
        "symbol": symbol,
        "observations": load_small_cap_history(symbol, limit=limit),
        "persistenceAvailable": supabase_store.is_configured(),
    }


@router.get("/small-caps/scan-status")
def small_cap_scan_status_route():
    try:
        status = small_cap_scan_status()
    except Exception as exc:
        raise HTTPException(503, "Small-cap scan status is temporarily unavailable.") from exc
    return {"available": status is not None, "scan": status}


@router.post("/small-caps/scan", status_code=status.HTTP_202_ACCEPTED)
def run_small_cap_scan(request: SmallCapScanRequest):
    """Queue an explicit bounded scan; the durable worker handles provider I/O."""
    if not settings.FMP_API_KEY:
        raise HTTPException(503, "Small-cap screening requires an FMP API key.")
    if not supabase_store.is_configured():
        raise HTTPException(503, "Durable discovery requires Supabase to be configured.")
    profile = request.as_profile()
    try:
        queued = enqueue_small_cap_scan(profile)
    except Exception as exc:
        raise HTTPException(503, "Small-cap scan could not be queued.") from exc
    if not queued:
        raise HTTPException(409, "A small-cap scan is already running.")
    return {"queued": True, "profile": profile.__dict__, "statusUrl": "/discovery/small-caps/scan-status"}
