"""Bounded, cached adapter for Finviz's public full-market map."""
import json
import math
import re
from datetime import datetime, timezone
from functools import lru_cache
from threading import Lock
from time import time

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/market", tags=["market"])
_lock = Lock()
_snapshot = None
_refreshed = 0.0


def fetch_public(path: str) -> str:
    # Only fixed provider paths discovered from its public page are accepted.
    with httpx.Client(timeout=12, follow_redirects=False, headers={"User-Agent": "Marketly research dashboard (public market map)"}) as client:
        with client.stream("GET", "https://finviz.com" + path) as response:
            response.raise_for_status()
            body = bytearray()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > 3_000_000:
                    raise ValueError("Map response too large")
            return body.decode("utf-8")


def parse_universe(script: str):
    match = re.search(r'\.exports=(\{name:"Root",children:.*\})\}\}\]\);', script)
    if not match:
        raise ValueError("Map metadata format changed")
    # Quote property names without touching string contents; never execute JS.
    raw = re.sub(r'"(?:\\.|[^"\\])*"|\b(name|description|value|children):',
                 lambda m: '"' + m.group(1) + '":' if m.group(1) else m.group(0), match.group(1))
    return json.loads(raw)


@lru_cache(maxsize=8)
def _universe(kind: str, bucket: int):
    if kind not in {"sec", "sec_all"}:
        raise ValueError("Unsupported market universe")
    page = fetch_public(f"/map?t={kind}")
    runtime = re.search(r'(/assets/dist-legacy/runtime\.v1\.[a-f0-9]+\.js)', page)
    if not runtime:
        raise ValueError("Map runtime unavailable")
    manifest = fetch_public(runtime.group(1))
    version = re.search(r'7791:"([a-f0-9]+)"', manifest)
    if not version:
        raise ValueError("Map universe unavailable")
    return parse_universe(fetch_public(f"/assets/dist-legacy/7791.v1.{version.group(1)}.js"))


def universe(kind: str):
    return _universe(kind, int(time() // 86400))


def combine(root, performance):
    stocks = []
    changes = performance.get("nodes", {})
    for sector in root["children"]:
        for industry in sector["children"]:
            for stock in industry["children"]:
                cap = stock.get("value")
                if not isinstance(cap, (int, float)) or not math.isfinite(cap) or cap <= 0:
                    continue
                change = changes.get(stock["name"])
                if not isinstance(change, (int, float)) or not math.isfinite(change):
                    change = None
                stocks.append({"symbol": stock["name"], "name": stock.get("description", stock["name"]),
                               "sector": sector["name"], "industry": industry["name"],
                               "marketCap": cap, "changePercent": change})
    if len(stocks) < 100:
        raise ValueError("Incomplete market universe")
    return stocks


@router.get("/heatmap")
def heatmap():
    global _snapshot, _refreshed
    with _lock:
        if _snapshot and time() - _refreshed < 600:
            return {**_snapshot, "stale": False}
        try:
            root = universe("sec_all")
            perf = json.loads(fetch_public("/api/map_perf?t=sec_all&st=d1"))
            stocks = combine(root, perf)
            _snapshot = {"stocks": stocks, "source": "Finviz", "sourceUrl": "https://finviz.com/map?t=sec_all",
                         "fetchedAt": datetime.now(timezone.utc).isoformat(),
                         "scope": "US-listed stocks covered by Finviz, including ADRs", "delayed": True,
                         "marketCapUnit": "USD millions"}
            _refreshed = time()
            return {**_snapshot, "stale": False}
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            if _snapshot:
                return {**_snapshot, "stale": True}
            raise HTTPException(503, "Full-market map is temporarily unavailable. Please retry.")


@router.get("/movers")
def movers():
    try:
        sp500_root = universe("sec")
        sp500_perf = json.loads(fetch_public("/api/map_perf?t=sec&st=d1"))
        sp500 = [stock for stock in combine(sp500_root, sp500_perf) if stock.get("changePercent") is not None]

        all_root = universe("sec_all")
        all_perf = json.loads(fetch_public("/api/map_perf?t=sec_all&st=d1"))
        small_caps = [stock for stock in combine(all_root, all_perf)
                      if 300 <= stock["marketCap"] <= 2000 and stock.get("changePercent") is not None]

        def ranked(stocks, reverse):
            return sorted(stocks, key=lambda stock: stock["changePercent"], reverse=reverse)[:8]

        return {
            "sp500": {"gainers": ranked(sp500, True), "losers": ranked(sp500, False)},
            "smallCap": {"gainers": ranked(small_caps, True), "losers": ranked(small_caps, False)},
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "source": "Finviz", "delayed": True, "marketCapUnit": "USD millions",
        }
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "Market movers are temporarily unavailable. Please retry.")
