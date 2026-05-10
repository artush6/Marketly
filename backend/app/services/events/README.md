# Event Catalyst Layer

This layer turns recent news into structured catalysts and risks.

## What This Layer Does

Events answer:

> What recent developments could change the investment story?

It classifies news into rough event types and estimates tone and importance.

## File

```text
events/
└── service.py
```

## Inputs

```python
build_event_catalyst_layer(
    business_model,
    interpretation,
    news_data,
)
```

## How It Does It

The layer loops over recent news items and joins each headline with its summary. It then classifies the text with keyword rules.

Example:

```python
if any(keyword in text for keyword in ("launch", "release", "title")):
    catalyst_type = "product_cycle"
```

Tone is also keyword-based:

- positive terms such as `upgrade`, `strong`, `boost`, `surge`
- negative terms such as `risk`, `delay`, `concern`, `drop`

Then the layer adds model-specific context. For IP-driven or live-service companies, it creates a lifecycle model and retention-risk framing. For hardware ecosystems, it creates an upgrade-cycle and services-attach framing.

## Output

Example:

```json
{
  "keyCatalysts": [
    {
      "title": "Major product launch expected",
      "type": "product_cycle",
      "tone": "positive",
      "importance": "high",
      "rationale": "Recent news flow points to a material operating catalyst."
    }
  ],
  "retentionRisk": "medium",
  "monetizationDurability": "potentially strong if engagement persists"
}
```

## Why This Layer Exists

Financial statements are backward-looking. Catalysts are forward-looking.

A stock can move because of:

- product launches
- earnings guidance
- regulation
- legal risk
- analyst upgrades
- delays
- consumer demand changes

Scenarios need these events to explain what could change.

## Why This Is Imperfect

The current implementation is keyword-based. That makes it simple and explainable, but not deeply nuanced.

The next version should classify more event types and assign better importance scores.
