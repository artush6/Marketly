# Core Layer

`app/core` contains shared infrastructure that other layers depend on, but it does not contain finance logic.

## What This Layer Does

Core answers:

> What does the application need in order to run safely?

It owns:

- configuration loading
- optional cache access
- shared application errors
- ticker symbol normalization helpers

## Files

```text
core/
├── cache.py
├── config.py
├── errors.py
└── symbols.py
```

## Responsibilities

`config.py` reads environment variables and exposes typed settings.

`cache.py` provides Redis-backed caching when Redis is configured. Redis is optional; the app should still work without it.

`errors.py` defines shared exceptions such as `MisconfigurationError`.

`symbols.py` normalizes user ticker input before the rest of the app sees it.

## How It Does It

`config.py` loads `.env` once and builds a frozen `Settings` object. Other modules import `settings` instead of reading environment variables directly.

`cache.py` creates cache keys with a shared prefix pattern, then attempts Redis reads/writes only when Redis is available. If Redis is missing or unhealthy, cache operations degrade safely.

`symbols.py` strips and uppercases ticker input so downstream logic gets consistent symbols like `AAPL` instead of ` aapl `.

The important pattern is:

```python
from app.core.config import settings
from app.core.cache import CacheManager

cache_key = CacheManager.make_key("scores", symbol)
cached = CacheManager.get(cache_key)
```

## Why This Layer Exists

Without this layer, provider code, routes, and services would each load env vars, handle cache failures, and normalize symbols differently.

That would create tiny inconsistencies that become annoying once the app grows.

## What Should Not Live Here

Do not put stock analysis, financial formulas, provider calls, or GPT prompts here.

Core should stay boring and reusable.
