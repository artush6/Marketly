def calculate_debt_to_equity(total_debt, shareholders_equity):
    if total_debt is None or shareholders_equity in (None, 0):
        return None
    return total_debt / shareholders_equity


def calculate_interest_coverage(operating_income, interest_expense):
    if operating_income is None or interest_expense in (None, 0):
        return None
    return operating_income / interest_expense


def calculate_debt_ratio(total_debt, total_assets):
    if total_debt is None or total_assets in (None, 0):
        return None
    return total_debt / total_assets


def calculate_dividend_yield(dividend_per_share, share_price):
    if dividend_per_share is None or share_price in (None, 0):
        return None
    return dividend_per_share / share_price