import pytest
from fastapi import HTTPException
from app.core.auth import current_user, own_workspace, Identity

def test_missing_auth_fails_closed(monkeypatch):
    monkeypatch.delenv("MARKETLY_ALLOW_LOCAL_WORKSPACE", raising=False)
    with pytest.raises(HTTPException) as exc:
        current_user(None)
    assert exc.value.status_code == 401

def test_development_requires_both_explicit_flags(monkeypatch):
    monkeypatch.setenv("MARKETLY_ALLOW_LOCAL_WORKSPACE", "true")
    monkeypatch.setenv("MARKETLY_ENV", "production")
    with pytest.raises(HTTPException): current_user(None)
    monkeypatch.setenv("MARKETLY_ENV", "development")
    assert current_user(None) is None

def test_workspace_cannot_be_selected_by_another_user():
    user = Identity("owner", "token")
    assert own_workspace("owner", user) == "owner"
    with pytest.raises(HTTPException) as exc: own_workspace("other", user)
    assert exc.value.status_code == 403

def test_rejects_invalid_bearer():
    with pytest.raises(HTTPException): current_user("Basic secret")

def test_verified_user_and_rejected_session(monkeypatch):
    from types import SimpleNamespace
    import app.core.auth as auth
    monkeypatch.setattr(auth,"settings",SimpleNamespace(SUPABASE_URL="https://project.supabase.co",SUPABASE_ANON_KEY="public"))
    monkeypatch.setattr(auth.requests,"get",lambda *a,**k:SimpleNamespace(status_code=200,raise_for_status=lambda:None,json=lambda:{"id":"11111111-1111-4111-8111-111111111111"}))
    assert current_user("Bearer valid").user_id=="11111111-1111-4111-8111-111111111111"
    monkeypatch.setattr(auth.requests,"get",lambda *a,**k:SimpleNamespace(status_code=401))
    with pytest.raises(HTTPException) as exc: current_user("Bearer invalid")
    assert exc.value.status_code==401
