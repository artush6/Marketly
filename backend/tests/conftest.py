"""Existing route unit tests run in explicit local mode, without real sessions."""
import pytest

@pytest.fixture(autouse=True)
def local_workspace(monkeypatch):
    monkeypatch.setenv("MARKETLY_ALLOW_LOCAL_WORKSPACE", "true")
    monkeypatch.setenv("MARKETLY_ENV", "development")
