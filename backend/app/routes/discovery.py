"""Small discovery endpoints; no analysis or LLM calls are needed for search."""

import re

import requests
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings

router = APIRouter(prefix="/discovery", tags=["discovery"])
SYMBOL = re.compile(r"^[A-Z0-9][A-Z0-9.:-]{0,19}$")


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
