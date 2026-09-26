"""Source-backed research for company relationships and discovery."""
import json
from typing import Any

from app.core.config import settings
from app.integrations.gpt import _get_client, FOLLOW_UP_SYSTEM_PROMPT


def _bounded(value: Any, depth: int = 0) -> Any:
    """Keep research context useful without cutting JSON mid-value."""
    if depth >= 5:
        return "[nested context omitted]"
    if isinstance(value, dict):
        return {str(key)[:100]: _bounded(item, depth + 1) for key, item in list(value.items())[:30]}
    if isinstance(value, list):
        return [_bounded(item, depth + 1) for item in value[:12]]
    if isinstance(value, str):
        return value[:1600]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return str(value)[:400]


def _context_json(context: dict[str, Any], limit: int = 24_000) -> str:
    bounded = _bounded(context)
    serialized = json.dumps(bounded, ensure_ascii=False, default=str)
    if len(serialized) <= limit:
        return serialized

    result: dict[str, Any] = {}
    for key, value in bounded.items():
        candidate = {**result, key: value}
        if len(json.dumps(candidate, ensure_ascii=False, default=str)) <= limit - 80:
            result[key] = value
        else:
            result[f"{key}_note"] = "omitted to fit the research context limit"
    return json.dumps(result, ensure_ascii=False, default=str)


def research_answer(question, context, conversation=None):
    response = _get_client().with_options(timeout=90.0).responses.create(
        model=settings.OPENAI_MODEL,
        reasoning={"effort": "low"},
        tools=[{"type": "web_search"}],
        instructions=FOLLOW_UP_SYSTEM_PROMPT.replace(
            'Return JSON with exactly one string field: {"answer": string}.',
            'Return a readable answer with citations. Prefer issuer filings and investor relations sources. '
            'For supply chains distinguish suppliers (sell to the focal company), customers (buy from it), '
            'partners and competitors. Put an entity under suppliers or customers only when the cited source '
            'explicitly supports that buying or selling direction; manufacturing collaboration, interoperability, '
            'or ecosystem membership alone is partner evidence, not supplier/customer evidence. Do not list generic '
            'customer categories when company names were requested. Never infer a commercial relationship from '
            'sector similarity. Prefer a short, high-confidence list over padding. State dates and whether a '
            'relationship is confirmed or only suggested. Coverage is not exhaustive.'
        ).replace(
            'Base current company-specific claims on the supplied market, company, analysis, news, and conversation context.',
            'Base current company-specific claims on the supplied context and retrieved web research; cite those claims.',
        ),
        input=[*(conversation or [])[-10:], {"role": "user", "content":
            "Context: " + _context_json(context) + "\nQuestion: " + question}],
        max_output_tokens=5000,
        store=False,
    )
    if response.status != "completed" or not response.output_text.strip():
        raise ValueError("Research did not finish. Please narrow the question and retry.")
    sources = []
    for item in response.output:
        for content in getattr(item, "content", []):
            for annotation in getattr(content, "annotations", []):
                if getattr(annotation, "type", "") == "url_citation":
                    entry = {"url": annotation.url, "title": annotation.title or annotation.url}
                    if entry not in sources:
                        sources.append(entry)
    return {"answer": response.output_text, "sources": sources}
