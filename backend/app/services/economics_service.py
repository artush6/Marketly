from app.integrations.economics import fetch_macro_indicators


def get_macro_indicators() -> dict:
    return fetch_macro_indicators()
