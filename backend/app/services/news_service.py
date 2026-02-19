from app.integrations.news import get_news, get_news_grouped, get_news_mixed


def get_company_news(symbol: str, days: int = 3, max_items: int = 8):
    return get_news(symbol, days=days, max_items=max_items)


def get_grouped_news(symbols: list[str], days: int = 7, max_items: int = 50):
    return get_news_grouped(symbols, max_items=max_items, days=days)


def get_mixed_news(symbols: list[str], days: int = 3, max_items: int = 10):
    return get_news_mixed(symbols, max_items=max_items, days=days)
