from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

TEST_ROOT = Path(tempfile.mkdtemp(prefix="monespaceprof-tests-"))
os.environ["MEP_ENVIRONMENT"] = "test"
os.environ["MEP_DATABASE_URL"] = f"sqlite:///{(TEST_ROOT / 'test.db').as_posix()}"
os.environ["MEP_USERS_ROOT"] = str(TEST_ROOT / "users")
os.environ["MEP_BACKUPS_ROOT"] = str(TEST_ROOT / "backups")
os.environ["MEP_LOGS_ROOT"] = str(TEST_ROOT / "logs")
os.environ["MEP_COOKIE_SECURE"] = "false"

from app.main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def register(client: TestClient, username: str, password: str = "MotDePasse!123") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password, "auto_register": False},
    )
    assert response.status_code == 201, response.text
    return response.json()


def csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("mep_csrf")
    assert token
    return {"X-CSRF-Token": token}
