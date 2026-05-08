from __future__ import annotations

from collections import defaultdict

from app.services.facts.models import CanonicalFact, FactCandidate


def reconcile_candidates(candidates: list[FactCandidate]) -> dict[str, CanonicalFact]:
    grouped: dict[str, list[FactCandidate]] = defaultdict(list)
    for candidate in candidates:
        grouped[candidate.key].append(candidate)

    facts: dict[str, CanonicalFact] = {}

    for key, group in grouped.items():
        ranked = sorted(
            group,
            key=lambda item: (item.inferred, -item.quality_score),
        )
        winner = ranked[0]
        distinct_values = {str(item.value) for item in group}
        has_conflict = len(distinct_values) > 1

        confidence = winner.quality_score
        notes: list[str] = []

        if winner.inferred:
            confidence *= 0.75
            notes.append("Selected value is inferred.")

        if has_conflict:
            confidence *= 0.85
            notes.append("Multiple candidate values were available for this fact.")

        if winner.notes:
            notes.append(winner.notes)

        facts[key] = CanonicalFact(
            key=key,
            value=winner.value,
            source=winner.source,
            confidence=round(confidence, 3),
            inferred=winner.inferred,
            alternatives=ranked[1:],
            notes=notes,
        )

    return facts
