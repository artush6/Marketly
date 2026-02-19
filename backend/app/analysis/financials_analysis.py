from app.domain.models import StockFinancials


class FinancialsAnalysis:
    def __init__(
        self,
        financial_data: StockFinancials,
        news_data: dict | None = None,
        economical_data: dict | None = None,
    ):
        self.financial_data = financial_data
        self.news_data = news_data
        self.economical_data = economical_data

    def revenue_growth(self):
        income = self.financial_data.financials.income_statement

        if not income or not isinstance(income, list) or len(income) < 2:
            return None

        try:
            latest = income[0].get("revenue")
            oldest = income[-1].get("revenue")
            years = len(income) - 1

            if latest and oldest and oldest > 0:
                return (latest / oldest) ** (1 / years) - 1

            return None

        except Exception:
            return None
