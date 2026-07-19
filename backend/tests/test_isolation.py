from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app

from .conftest import csrf_headers, register


def test_two_users_cannot_read_same_pedagogical_resource(client: TestClient) -> None:
    register(client, f"alice-{uuid.uuid4().hex[:8]}")
    created = client.post(
        "/api/v1/levels",
        json={"data": {"name": "5ème", "description": "Privé", "position": 1}},
        headers=csrf_headers(client),
    )
    assert created.status_code == 201, created.text
    item_id = created.json()["id"]

    with TestClient(app) as bob:
        register(bob, f"bob-{uuid.uuid4().hex[:8]}")
        assert bob.get(f"/api/v1/levels/{item_id}").status_code == 404
        assert (
            bob.patch(
                f"/api/v1/levels/{item_id}",
                json={"data": {"name": "Volé"}},
                headers=csrf_headers(bob),
            ).status_code
            == 404
        )


def test_two_users_cannot_download_same_file(client: TestClient) -> None:
    register(client, f"fichier-a-{uuid.uuid4().hex[:8]}")
    uploaded = client.post(
        "/api/v1/files",
        files={"upload": ("notes.txt", b"contenu secret", "text/plain")},
        headers=csrf_headers(client),
    )
    assert uploaded.status_code == 201, uploaded.text
    file_id = uploaded.json()["id"]
    own_content = client.get(f"/api/v1/files/{file_id}/content", headers={"Range": "bytes=0-6"})
    assert own_content.status_code == 206
    assert own_content.content == b"contenu"

    with TestClient(app) as bob:
        register(bob, f"fichier-b-{uuid.uuid4().hex[:8]}")
        assert bob.get(f"/api/v1/files/{file_id}/content").status_code == 404


def test_parent_from_another_user_is_rejected(client: TestClient) -> None:
    register(client, f"parent-a-{uuid.uuid4().hex[:8]}")
    level = client.post(
        "/api/v1/levels",
        json={"data": {"name": "Seconde"}},
        headers=csrf_headers(client),
    ).json()
    with TestClient(app) as bob:
        register(bob, f"parent-b-{uuid.uuid4().hex[:8]}")
        response = bob.post(
            "/api/v1/sequences",
            json={"data": {"level_id": level["id"], "name": "Intrusion"}},
            headers=csrf_headers(bob),
        )
        assert response.status_code == 404


def test_upload_rejects_mime_spoofing(client: TestClient) -> None:
    register(client, f"mime-{uuid.uuid4().hex[:8]}")
    response = client.post(
        "/api/v1/files",
        files={"upload": ("fausse-image.png", b"ceci n'est pas une image", "image/png")},
        headers=csrf_headers(client),
    )
    assert response.status_code == 415
