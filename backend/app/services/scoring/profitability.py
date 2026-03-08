"""Simple profitability helpers."""


def calculate_net_margin(net_income, revenue):
    if net_income is None or revenue is None:
        return None
    if revenue == 0:
        return None
    return net_income / revenue


def calculate_operating_margin(operating_income, revenue):
    if operating_income is None or revenue is None:
        return None
    if revenue == 0:
        return None
    return operating_income / revenue


def calculate_ebitda_margin(ebitda, revenue):
    if ebitda is None or revenue is None:
        return None
    if revenue == 0:
        return None
    return ebitda / revenue


def calculate_gross_margin(cost_of_revenue, revenue):
    if cost_of_revenue is None or revenue is None:
        return None
    if revenue == 0:
        return None
    return (revenue - cost_of_revenue) / revenue

def calculate_roe(net_income, shareholder_equity):
    if net_income is None or shareholder_equity is None:
        return None
    return net_income / shareholder_equity

def compute_profitability_metrics(income_statement):
    """Build a simple profitability summary from the latest income statement row."""
    if not income_statement:
        return {
            "grossMargin": None,
            "operatingMargin": None,
            "netMargin": None,
            "ebitdaMargin": None,
            "profitabilityScore": None,
            "coverage": 0.0,
        }

    latest = income_statement[0]

    revenue = latest.get("revenue") or latest.get("totalRevenue")
    net_income = latest.get("netIncome")
    operating_income = latest.get("operatingIncome") or latest.get("incomeFromOperations")
    ebitda = latest.get("ebitda") or latest.get("EBITDA")
    cost_of_revenue = latest.get("costOfRevenue")

    gross_margin = calculate_gross_margin(cost_of_revenue, revenue)
    operating_margin = calculate_operating_margin(operating_income, revenue)
    net_margin = calculate_net_margin(net_income, revenue)
    ebitda_margin = calculate_ebitda_margin(ebitda, revenue)

    available = [v for v in [gross_margin, operating_margin, net_margin, ebitda_margin] if v is not None]
    profitability_score = None
    if available:
        profitability_score = sum(available) / len(available)

    return {
        "grossMargin": gross_margin,
        "operatingMargin": operating_margin,
        "netMargin": net_margin,
        "ebitdaMargin": ebitda_margin,
        "profitabilityScore": profitability_score,
        "coverage": len(available) / 4,
    }
