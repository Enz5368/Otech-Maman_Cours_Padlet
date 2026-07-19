from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import User
from app.services.accounts import create_user

from .conftest import csrf_headers, register


def test_password_is_argon2id_and_never_plaintext(client: TestClient) -> None:
    username = f"prof-{uuid.uuid4().hex[:8]}"
    plaintext = "MotDePasse!123"
    register(client, username, plaintext)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username_normalized == username))
        assert user is not None
        assert user.password_hash != plaintext
        assert user.password_hash.startswith("$argon2id$")


def test_session_cookie_is_http_only_and_logout_revokes_it(client: TestClient) -> None:
    register(client, f"prof-{uuid.uuid4().hex[:8]}")
    cookie_header = client.post(
        "/api/v1/auth/login",
        json={
            "username": f"nouveau-{uuid.uuid4().hex[:8]}",
            "password": "MotDePasse!123",
            "auto_register": True,
        },
    ).headers.get_list("set-cookie")
    assert any(
        "mep_session=" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
        for cookie in cookie_header
    )
    response = client.post("/api/v1/auth/logout", headers=csrf_headers(client))
    assert response.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_new_automatic_account_requires_strong_server_password(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": f"court-{uuid.uuid4().hex[:8]}", "password": "it", "auto_register": True},
    )
    assert response.status_code == 422


def test_initial_password_must_be_changed_before_accessing_data(client: TestClient) -> None:
    username = f"initial-{uuid.uuid4().hex[:8]}"
    with SessionLocal() as db:
        create_user(
            db,
            get_settings(),
            username=username,
            password="mot-de-passe-initial",  # noqa: S106 - secret de test uniquement
            must_change_password=True,
        )
        db.commit()
    login = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "mot-de-passe-initial", "auto_register": False},
    )
    assert login.status_code == 200
    assert client.get("/api/v1/workspace").status_code == 428
    changed = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "mot-de-passe-initial",
            "new_password": "NouveauMotDePasse!123",
            "revoke_other_sessions": True,
        },
        headers=csrf_headers(client),
    )
    assert changed.status_code == 204
    assert client.get("/api/v1/workspace").status_code == 200
