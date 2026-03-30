"""Symbol normalization helpers shared across routes and services."""

ALIASES = {
    "APPLE": "AAPL",
    "MICROSOFT": "MSFT",
    "NVIDIA": "NVDA",
}


def normalize_symbol_input(symbol: str) -> str:
    cleaned = symbol.strip().upper()
    return ALIASES.get(cleaned, cleaned)
