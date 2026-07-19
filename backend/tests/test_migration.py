from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from .conftest import csrf_headers, register


def legacy_workspace() -> dict:
    return {
        "demoVersion": 2,
        "categories": ["Collège"],
        "classes": [
            {
                "id": "class-1",
                "title": "5eme",
                "sequences": [
                    {
                        "id": "seq-1",
                        "title": "Leonardo",
                        "lessons": [
                            {
                                "id": "lesson-1",
                                "title": "Chi è Leonardo?",
                                "activities": [
                                    {
                                        "id": "act-1",
                                        "title": "Carte d'identité",
                                        "privateNotes": "Ne jamais projeter",
                                        "slides": [
                                            {
                                                "id": "slide-1",
                                                "elements": [
                                                    {
                                                        "id": "el-1",
                                                        "kind": "text",
                                                        "value": "Leonardo",
                                                        "x": 0,
                                                        "y": 0,
                                                        "w": 100,
                                                        "h": 50,
                                                    }
                                                ],
                                            }
                                        ],
                                        "resources": [],
                                    }
                                ],
                            }
                        ],
                    }
                ],
            }
        ],
        "studentClasses": [{"id": "group-1", "title": "5emeA", "students": ["Anna", "Luca"]}],
        "resources": [],
        "tools": {},
    }


def test_local_storage_migration_is_lossless_and_idempotent(client: TestClient) -> None:
    register(client, f"migration-{uuid.uuid4().hex[:8]}")
    payload = {
        "idempotency_key": "migration-contract-001",
        "source": "localStorage",
        "storage_key": "italia-html-data-v2-prof",
        "content": legacy_workspace(),
        "client_counts": {
            "levels": 1,
            "sequences": 1,
            "lessons": 1,
            "activities": 1,
            "slides": 1,
            "resources": 0,
            "students": 2,
        },
    }
    first = client.post("/api/v1/imports", json=payload, headers=csrf_headers(client))
    assert first.status_code == 200, first.text
    assert first.json()["report"]["mismatches"] == {}
    second = client.post("/api/v1/imports", json=payload, headers=csrf_headers(client))
    assert second.status_code == 200
    assert second.json()["idempotent"] is True
    workspace = client.get("/api/v1/workspace").json()["content"]
    assert (
        workspace["classes"][0]["sequences"][0]["lessons"][0]["activities"][0]["privateNotes"]
        == "Ne jamais projeter"
    )


def test_optimistic_lock_prevents_silent_overwrite(client: TestClient) -> None:
    register(client, f"revision-{uuid.uuid4().hex[:8]}")
    initial = client.get("/api/v1/workspace").json()
    saved = client.put(
        "/api/v1/workspace",
        json={"schema_version": 2, "expected_revision": initial["revision"], "content": legacy_workspace()},
        headers=csrf_headers(client),
    )
    assert saved.status_code == 200, saved.text
    conflict = client.put(
        "/api/v1/workspace",
        json={"schema_version": 2, "expected_revision": initial["revision"], "content": {}},
        headers=csrf_headers(client),
    )
    assert conflict.status_code == 409


def test_adding_a_class_is_persisted_in_the_canonical_workspace(client: TestClient) -> None:
    register(client, f"class-save-{uuid.uuid4().hex[:8]}")
    initial = client.get("/api/v1/workspace").json()
    content = legacy_workspace()
    first = client.put(
        "/api/v1/workspace",
        json={"schema_version": 2, "expected_revision": initial["revision"], "content": content},
        headers=csrf_headers(client),
    )
    assert first.status_code == 200, first.text

    content["classes"].append(
        {
            "id": "class-created-after-login",
            "title": "Nouvelle classe",
            "description": "Créée depuis le formulaire",
            "category": "Collège",
            "order": 2,
            "isVisible": True,
            "sequences": [],
        }
    )
    second = client.put(
        "/api/v1/workspace",
        json={"schema_version": 2, "expected_revision": first.json()["revision"], "content": content},
        headers=csrf_headers(client),
    )
    assert second.status_code == 200, second.text
    reloaded = client.get("/api/v1/workspace").json()["content"]
    assert [item["title"] for item in reloaded["classes"]] == ["5eme", "Nouvelle classe"]


def test_embedded_local_file_is_extracted_to_private_storage(client: TestClient) -> None:
    register(client, f"blob-{uuid.uuid4().hex[:8]}")
    content = legacy_workspace()
    content["resources"] = [
        {
            "id": "resource-data",
            "title": "Document local",
            "type": "DOCUMENT",
            "url": "data:text/plain;base64,Ym9uam91cg==",
        }
    ]
    response = client.post(
        "/api/v1/imports",
        json={
            "idempotency_key": "migration-blob-001",
            "source": "localStorage",
            "storage_key": "italia-html-data-v2-blob",
            "content": content,
            "client_counts": {
                "levels": 1,
                "sequences": 1,
                "lessons": 1,
                "activities": 1,
                "slides": 1,
                "resources": 1,
                "students": 2,
            },
        },
        headers=csrf_headers(client),
    )
    assert response.status_code == 200, response.text
    workspace = client.get("/api/v1/workspace").json()["content"]
    content_url = workspace["resources"][0]["url"]
    assert content_url.startswith("/api/v1/files/")
    assert client.get(content_url).content == b"bonjour"
