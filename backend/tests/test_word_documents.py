from __future__ import annotations

import io
import uuid
import zipfile

from fastapi.testclient import TestClient

from app.main import app

from .conftest import csrf_headers, register


def test_native_word_document_roundtrip_and_owner_isolation(client: TestClient) -> None:
    register(client, f"word-{uuid.uuid4().hex[:8]}")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Cours privé</w:t></w:r></w:p></w:body></w:document>')
    original = buffer.getvalue()
    uploaded = client.post(
        "/api/v1/files",
        files={"upload": ("cours.docx", original, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        headers=csrf_headers(client),
    )
    assert uploaded.status_code == 201, uploaded.text
    url = uploaded.json()["content_url"]
    activity = {
        "id": "word-content", "title": "Cours Word", "contentType": "word", "slides": [],
        "document": {"url": url, "fileName": "cours.docx"},
    }
    content = {"classes": [{"id": "class", "sequences": [{"id": "sequence", "lessons": [
        {"id": "lesson", "activities": [activity]},
    ]}]}]}
    revision = client.get("/api/v1/workspace").json()["revision"]
    saved = client.put(
        "/api/v1/workspace",
        json={"schema_version": 2, "expected_revision": revision, "content": content},
        headers=csrf_headers(client),
    )
    assert saved.status_code == 200, saved.text
    restored = client.get("/api/v1/workspace").json()["content"]["classes"][0]["sequences"][0]["lessons"][0]["activities"][0]
    assert restored == activity
    assert client.get(url).content == original
    with TestClient(app) as other:
        register(other, f"other-word-{uuid.uuid4().hex[:8]}")
        assert other.get(url).status_code == 404
