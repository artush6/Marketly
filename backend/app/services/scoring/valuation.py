def calculate_pe_ratio(share_price, eps):
    if share_price is None or eps in (None, 0):
        return None
    return share_price / eps


def calculate_pe_marketcap(market_cap, net_income):
    if market_cap is None or net_income in (None, 0):
        return None
    return market_cap / net_income


def calculate_forward_pe(share_price, expected_eps):
    if share_price is None or expected_eps in (None, 0):
        return None
    return share_price / expected_eps

def calculate_price_to_book(market_cap, shareholders_equity):
    if market_cap is None or shareholders_equity in (None, 0):
        return None
    return market_cap / shareholders_equity


def calculate_price_to_sales(market_cap, revenue):
    if market_cap is None or revenue in (None, 0):
        return None
    return market_cap / revenue


def calculate_peg_ratio(pe_ratio, eps_growth):
    if pe_ratio is None or eps_growth in (None, 0):
        return None
    return pe_ratio / eps_growth