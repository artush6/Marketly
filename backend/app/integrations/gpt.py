# app/services/gpt.py

import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# internal helpers
from app.utils.sanitizer_util import sanitize
from app.integrations.financials import fetch_stock_financials  # summarize_financials removed

load_dotenv()  # Load environment variables from .env
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def score_stock(financial_data: dict, news_data: dict | list, economical_data: dict) -> dict:
    """
    Evaluate a stock using financial, macroeconomic, and news data via GPT model.
    Returns a structured score with summary, positives, and negatives.
    """

    info = financial_data.get("info", {})

    # --- Safe, minimal payload ---
    safe_payload = {
        "company_overview": {
            "name": info.get("shortName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "currency": info.get("currency"),
            "market_cap": info.get("marketCap"),
        },
        "valuation_metrics": {
            "trailingPE": info.get("trailingPE"),
            "forwardPE": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "price_to_book": info.get("priceToBook"),
            "price_to_sales": info.get("priceToSalesTrailing12Months"),
            "dividend_yield": info.get("dividendYield"),
            "beta": info.get("beta"),
        },
        "financials": {
            "income_statement": financial_data.get("income_statement"),
            "balance_sheet": financial_data.get("balance_sheet"),
            "cash_flow": financial_data.get("cash_flow"),
        },
        "analyst_data": financial_data.get("analyst_data"),
        "news_data": news_data[:20] if isinstance(news_data, list) else news_data,  # limit for safety
        "economical_data": economical_data,
    }

    # --- Truncate for token safety ---
    safe_payload_json = json.dumps(safe_payload, ensure_ascii=False)[:20000]

    try:
        response = client.chat.completions.create(
            model="gpt-5-nano-2025-08-07",
            messages=[
                {
                    "role": "system",
                    "content": (
                        """You are a world-class equity analyst and quant strategist.
                        Evaluate the investment quality of a stock from 0 to 100 using 
                        fundamentals, macroeconomic data, and recent news.

                        Follow this rubric strictly:

                        1. Profitability & Margins (0–17)
                        2. Growth & Stability (0–17)
                        3. Valuation (0–17)
                        4. Balance Sheet & Risk (0–17)
                        5. Market & News Signals (0–16)
                        6. Macro & Market Conditions (0–16)

                        Scoring scale:
                        0–20 = Extremely weak, avoid
                        21–40 = Weak, speculative
                        41–60 = Average, mixed signals
                        61–80 = Strong, attractive
                        81–100 = Exceptional, top-tier

                        Output concise, data-backed insights only.
                        JSON schema:
                        {
                            "score": integer,
                            "summary": string,
                            "positives": [string],
                            "negatives": [string]
                        }
                        """
                    )
                },
                {
                    "role": "user",
                    "content": f"Stock data (financials, macro, news): {safe_payload_json}"
                }
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "stock_score",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "score": {"type": "integer"},
                            "summary": {"type": "string"},
                            "positives": {
                                "type": "array",
                                "items": {"type": "string"}
                            },
                            "negatives": {
                                "type": "array",
                                "items": {"type": "string"}
                            },
                        },
                        "required": ["score", "summary"]
                    },
                },
            },
        )

        content = response.choices[0].message.content
        parsed = json.loads(content)

        # Ensure keys always exist
        parsed.setdefault("positives", [])
        parsed.setdefault("negatives", [])

        return sanitize(parsed)

    except Exception as e:
        print(f"[ERROR] GPT scoring failed: {e}")
        return {"error": str(e)}
