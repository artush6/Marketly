def calculate_revenue_growth_yoy(revenue_current, revenue_previous):
    if revenue_current is None or revenue_previous in (None, 0):
        return None
    return (revenue_current - revenue_previous) / revenue_previous

