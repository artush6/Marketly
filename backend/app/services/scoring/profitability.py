def calculate_net_margin(net_income, revenue):
    if not net_income or not revenue:
        return None
    if revenue == 0:
        return None
    return net_income / revenue


def calculate_operating_margin(operating_income, revenue):
    if not operating_income or not revenue:
        return None
    if revenue == 0:
        return None
    return operating_income / revenue

def calculate_EBTDA_margin(EBITDA, revenue):
    if not EBITDA or not revenue:
        return None
    if revenue == 0:
        return None
    return EBITDA / revenue

def calculate_gross_margin(cost_of_revenue, revenue):
    if not cost_of_revenue or not revenue:
        return None
    if revenue == 0:
        return None
    return (revenue - cost_of_revenue) / (revenue)

