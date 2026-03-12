def calculate_revenue_growth_yoy(revenue_current, revenue_previous):
    if revenue_current is None or revenue_previous in (None, 0):
        return None
    return (revenue_current - revenue_previous) / revenue_previous


def calculate_revenue_cagr(revenue_latest, revenue_oldest):
    if revenue_latest is None or revenue_oldest in (None, 0):
        return None
    return (revenue_latest / revenue_oldest) ** (1/3) - 1


def calculate_eps_growth(eps_current, eps_previous):
    if eps_current is None or eps_previous in (None, 0):
        return None
    return (eps_current - eps_previous) / eps_previous


def calculate_net_income_growth(net_income_current, net_income_previous):
    if net_income_current is None or net_income_previous in (None, 0):
        return None
    return (net_income_current - net_income_previous) / net_income_previous