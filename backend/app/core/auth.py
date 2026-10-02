"""Validate bearer sessions against Supabase Auth; never trust client user IDs."""
import os
from dataclasses import dataclass
import requests
from fastapi import Header, HTTPException
from app.core.config import settings

@dataclass(frozen=True)
class Identity:
    user_id: str
    token: str

def current_user(authorization: str | None = Header(default=None)) -> Identity | None:
    if not authorization:
        if os.getenv("MARKETLY_ALLOW_LOCAL_WORKSPACE") == "true" and os.getenv("MARKETLY_ENV") == "development":
            return None
        raise HTTPException(401, "Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token or len(token) > 12000:
        raise HTTPException(401, "Invalid session.")
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise HTTPException(503, "Authentication is not configured.")
    try:
        supabase_url = settings.SUPABASE_URL.rstrip("/")
        if supabase_url.endswith("/rest/v1"):
            supabase_url = supabase_url[:-len("/rest/v1")]
        response = requests.get(f"{supabase_url}/auth/v1/user", headers={"apikey": settings.SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}, timeout=10)
        if response.status_code in (401, 403):
            raise HTTPException(401, "Session expired. Sign in again.")
        response.raise_for_status()
        user = response.json()
        from uuid import UUID
        user_id = str(UUID(user["id"]))
        return Identity(user_id, token)
    except HTTPException:
        raise
    except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
        raise HTTPException(503, "Session verification is temporarily unavailable.") from exc


def own_workspace(workspace: str, user: Identity | None) -> str:
    if user is not None and workspace != user.user_id:
        raise HTTPException(403, "This workspace belongs to another user.")
    return workspace
