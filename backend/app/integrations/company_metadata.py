"""Stable company identity: compact profiles shared by financials and UI metadata."""
from concurrent.futures import Future, ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
from threading import Lock, BoundedSemaphore
from time import monotonic
from urllib.parse import urlparse

from app.integrations import supabase_store

PROFILE_TTL = 30 * 86400
MEMORY_TTL = 600
MAX_MEMORY_ENTRIES = 512
_lock = Lock()
_provider_slots = BoundedSemaphore(2)
_memory = {}
_inflight = {}


def _remember(symbol, payload):
    with _lock:
        if len(_memory) >= MAX_MEMORY_ENTRIES:
            _memory.pop(next(iter(_memory)))
        _memory[symbol] = (monotonic() + MEMORY_TTL, deepcopy(payload))


def get_profile(symbol: str, *, check_persistent: bool = True) -> dict:
    """Single-flight profile discovery, with short L1 and long durable TTLs."""
    with _lock:
        cached = _memory.get(symbol)
        if cached and cached[0] > monotonic():
            return deepcopy(cached[1])
        future = _inflight.get(symbol)
        owner = future is None
        if owner:
            future = Future()
            _inflight[symbol] = future
    if not owner:
        return deepcopy(future.result())
    try:
        payload = supabase_store.get_json('company_profiles', symbol) if check_persistent else None
        if not isinstance(payload, dict):
            # Late import keeps the existing financial provider adapter independent.
            from app.routes.discovery import provider_get
            with _provider_slots:
                profile = provider_get('stock/profile2', {'symbol': symbol})
            if not isinstance(profile, dict):
                raise ValueError('Invalid company profile')
            if profile.get('ticker') and profile['ticker'].upper() != symbol:
                raise ValueError('Company profile symbol mismatch')
            fields = (
                'name', 'ticker', 'logo', 'weburl', 'exchange', 'country', 'currency',
                'finnhubIndustry', 'ipo', 'phone', 'shareOutstanding', 'marketCapitalization',
            )
            payload = {key: profile.get(key) for key in fields}
            logo = payload.get('logo')
            if not isinstance(logo, str) or urlparse(logo).scheme != 'https' or not urlparse(logo).netloc:
                payload['logo'] = None
            payload['fetchedAt'] = datetime.now(timezone.utc).isoformat()
            # Unsupported tickers get a short negative cache, not endless rediscovery.
            supabase_store.set_json('company_profiles', symbol, payload,
                                    PROFILE_TTL if payload.get('name') else 86400)
        _remember(symbol, payload)
        future.set_result(deepcopy(payload))
        return payload
    except Exception as exc:
        future.set_exception(exc)
        raise
    finally:
        with _lock:
            _inflight.pop(symbol, None)


def get_metadata(symbols: list[str]) -> list[dict]:
    # Only compact profile data crosses the network, never entire financial snapshots.
    missing = []
    with _lock:
        for symbol in symbols:
            cached = _memory.get(symbol)
            if not cached or cached[0] <= monotonic():
                missing.append(symbol)
    if missing:
        try:
            persisted = supabase_store.get_json_many('company_profiles', missing)
            for symbol, payload in persisted.items():
                if isinstance(payload, dict):
                    _remember(symbol, payload)
        except Exception:
            pass  # Provider discovery still works during a database outage.

    def resolve(symbol):
        try:
            profile = get_profile(symbol, check_persistent=False)
            return {'symbol': symbol, 'name': profile.get('name') or symbol,
                    'logoUrl': profile.get('logo'), 'exchange': profile.get('exchange'),
                    'industry': profile.get('finnhubIndustry'), 'country': profile.get('country'),
                    'currency': profile.get('currency'), 'fetchedAt': profile.get('fetchedAt'),
                    'source': 'Finnhub', 'status': 'available' if profile.get('name') else 'missing'}
        except Exception:
            return {'symbol': symbol, 'name': symbol, 'logoUrl': None, 'status': 'unavailable'}

    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(resolve, symbols))
