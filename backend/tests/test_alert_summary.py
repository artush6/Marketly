from unittest.mock import Mock, patch

import pytest

from app.services import alert_delivery


@pytest.mark.parametrize("header, expected", [("0-0/72", 72), ("*/0", 0)])
def test_critical_badge_is_exact_private_and_unread(header, expected):
    response = Mock(headers={"Content-Range": header})
    with patch.object(alert_delivery.supabase_store, "_rest_url", return_value="https://example.test/rest/v1/user_alert_notifications"), \
         patch.object(alert_delivery.supabase_store, "_headers", return_value={"Prefer": "count=exact"}), \
         patch.object(alert_delivery.supabase_store.requests, "head", return_value=response) as request:
        assert alert_delivery.unread_critical_count("user-a") == expected
    assert request.call_args.kwargs["params"] == {
        "user_id": "eq.user-a", "severity": "eq.critical", "read_at": "is.null", "select": "id"
    }
    assert request.call_args.kwargs["headers"]["Prefer"] == "count=exact"
    response.raise_for_status.assert_called_once()


def test_missing_count_is_unknown_not_zero():
    with patch.object(alert_delivery.supabase_store, "_rest_url", return_value="https://example.test"), \
         patch.object(alert_delivery.supabase_store, "_headers", return_value={}), \
         patch.object(alert_delivery.supabase_store.requests, "head", return_value=Mock(headers={})):
        with pytest.raises(ValueError):
            alert_delivery.unread_critical_count("user-a")


def test_summary_requires_authentication():
    from app.routes.notifications import alert_summary
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as error:
        alert_summary(None)
    assert error.value.status_code == 401
