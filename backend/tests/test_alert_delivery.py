from unittest.mock import patch

from app.services import alert_delivery


def test_price_move_selects_the_highest_crossed_threshold_once():
    created = []

    def save(user_id, **values):
        created.append((user_id, values))
        return {"id": "alert-1", **values}

    with patch.object(alert_delivery, "recipients", return_value=[
        ("11111111-1111-4111-8111-111111111111", {"price_drop_thresholds": [3, 5, 10]})
    ]), patch.object(alert_delivery, "create_notification", side_effect=save):
        result = alert_delivery.notify_price_drop(
            "ACME", {"changePercent": -6.2, "price": 42},
            {"recentArticles": [], "priceMovePercent": -6.2},
        )

    assert len(result) == 1
    assert created[0][1]["severity"] == "important"
    assert ":5" in created[0][1]["dedupe_key"]
    assert "down 6.2%" in created[0][1]["body"]


def test_price_move_ignores_gains_and_small_drops():
    with patch.object(alert_delivery, "recipients") as recipients:
        assert alert_delivery.notify_price_drop("ACME", {"changePercent": 2.0}, {}) == []
        assert alert_delivery.notify_price_drop("ACME", {"changePercent": -2.9}, {}) == []
    recipients.assert_not_called()


def test_important_news_requires_high_importance_and_followed_user():
    calls = []
    with patch.object(alert_delivery, "recipients", return_value=[("user-1", {})]), \
         patch.object(alert_delivery, "create_notification", side_effect=lambda *a, **k: calls.append(k) or {"id": "1"}):
        sent = alert_delivery.notify_important_news("ACME", [
            {"headline": "Routine", "importanceScore": 2},
            {"headline": "Material event", "importanceScore": 4, "url": "https://example.com/news"},
        ])
    assert sent == 1
    assert calls[0]["severity"] == "important"
    assert calls[0]["explanation"]["url"] == "https://example.com/news"


def test_push_subscription_rejects_insecure_endpoint():
    from app.routes.notifications import SubscriptionInput
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        SubscriptionInput(endpoint="http://push.example.test/" + "a" * 40,
                          keys={"p256dh": "a" * 20, "auth": "b" * 20})


def test_push_subscription_cannot_move_device_between_accounts():
    import pytest

    endpoint = "https://fcm.googleapis.com/fcm/send/" + "a" * 40
    with patch.object(alert_delivery.supabase_store, "is_configured", return_value=True), \
         patch.object(alert_delivery.supabase_store, "_select_rows", return_value=[{"user_id": "other-user"}]), \
         patch.object(alert_delivery.supabase_store, "_upsert_rows") as upsert:
        with pytest.raises(ValueError, match="another account"):
            alert_delivery.upsert_subscription(
                "user-1", {"endpoint": endpoint, "keys": {"p256dh": "p" * 20, "auth": "a" * 20}}, None,
            )
    upsert.assert_not_called()
