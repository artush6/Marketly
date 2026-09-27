"""Batch cached fundamentals; never fetch provider statements for each card."""
from functools import lru_cache
from time import time
from app.integrations import supabase_store
from app.services.comparison import comparison_metrics

@lru_cache(maxsize=4)
def _cached_metrics(symbols, bucket):
    result = {}
    for offset in range(0, len(symbols), 100):
        batch = supabase_store.get_json_many("tickers", list(symbols[offset:offset+100]))
        for symbol, payload in batch.items():
            if isinstance(payload, dict): result[symbol] = comparison_metrics(payload)
    return result

def enrich_stocks(stocks):
    symbols = tuple(sorted({s["symbol"] for s in stocks}))
    try:
        cached = _cached_metrics(symbols, int(time() // 300))
        status = "cached"
    except Exception:
        cached, status = {}, "unavailable"
    return [{**stock, "metrics": cached.get(stock["symbol"], {})} for stock in stocks], status
