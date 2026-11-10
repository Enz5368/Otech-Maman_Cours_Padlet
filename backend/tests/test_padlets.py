from __future__ import annotations

# ruff: noqa: S106 - deliberately public test passwords, never production credentials
import base64
import uuid
from io import BytesIO
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database import SessionLocal
from app.main import app
from app.models import Padlet, PadletAttempt

from .conftest import csrf_headers, register

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XcAAAAASUVORK5CYII=')


@pytest.fixture(autouse=True)
def reset_padlet_attempts(client):
    with SessionLocal() as db:
        db.execute(delete(PadletAttempt))
        db.commit()


def create(client, **extra):
    payload = {"title": "Le mur italien", "slug": f"italien-{uuid.uuid4().hex[:12]}", **extra}
    result = client.post('/api/v1/padlets', json=payload, headers=csrf_headers(client))
    assert result.status_code == 201, result.text
    return result.json()


def update(client, board, **extra):
    payload = {key: board[key] for key in ['title', 'slug', 'description', 'layout', 'visibility',
                                         'background', 'is_published', 'is_archived', 'revision', 'lesson_id']}
    return client.put(f'/api/v1/padlets/{board["id"]}', json={**payload, **extra}, headers=csrf_headers(client))


def post(client, board, **extra):
    return client.post(f'/api/v1/padlets/{board["id"]}/posts',
                       json={"type": "text", "title": "Bonjour", "body": "Ciao !", **extra}, headers=csrf_headers(client))


def test_public_draft_persistence_and_no_private_fields(client):
    register(client, f'padlet-{uuid.uuid4().hex[:8]}')
    board = create(client, lesson_id='ma-seance')
    assert client.get(f'/api/v1/public/padlets/{board["slug"]}').status_code == 404
    board = post(client, board).json()
    board = update(client, board, is_published=True, layout='horizontal').json()
    with TestClient(app) as visitor:
        public = visitor.get(f'/api/v1/public/padlets/{board["slug"]}')
        assert public.status_code == 200
        assert public.json()['posts'][0]['body'] == 'Ciao !'
        assert public.json()['layout'] == 'horizontal'
        assert 'no-store' in public.headers['cache-control']
        assert 'noindex' in public.headers['x-robots-tag']
        for secret in ['password_hash', 'user_id', 'lesson_id', 'has_password', 'file_id', 'revision']:
            assert secret not in public.text
        assert visitor.get('/api/v1/padlets').status_code == 401
    assert client.get(f'/api/v1/padlets/{board["id"]}').json()['lesson_id'] == 'ma-seance'


def test_password_grants_files_and_revocation(client):
    register(client, f'protected-{uuid.uuid4().hex[:8]}')
    board = create(client, visibility='password', password='mot secret', is_published=True)
    root = f'/api/v1/padlets/{board["id"]}'
    upload = client.post(root + '/files', files={'upload': ('photo.png', PNG, 'image/png')}, headers=csrf_headers(client)).json()
    board = post(client, board, type='image', file_id=upload['id']).json()
    post_id = board['posts'][0]['id']
    public = f'/api/v1/public/padlets/{board["slug"]}'
    file_url = f'{public}/posts/{post_id}/content'
    with SessionLocal() as db:
        stored = db.get(Padlet, uuid.UUID(board['id']))
        assert stored.password_hash.startswith('$argon2id$')
        assert 'mot secret' not in stored.password_hash
    assert 'password_hash' not in str(board)
    with TestClient(app) as visitor:
        assert visitor.get(public).status_code == 401
        assert visitor.get(file_url).status_code == 401
        assert visitor.post(public + '/unlock', json={'password': 'mauvais'}).status_code == 401
        granted = visitor.post(public + '/unlock', json={'password': 'mot secret'})
        assert granted.status_code == 200
        assert 'HttpOnly' in granted.headers['set-cookie']
        assert 'SameSite=strict' in granted.headers['set-cookie']
        assert visitor.get(public).status_code == 200
        file = visitor.get(file_url, headers={'Range': 'bytes=0-7'})
        assert file.status_code == 206 and file.content == PNG[:8]
        assert 'no-store' in file.headers['cache-control']
        assert visitor.get(file_url, headers={'Range': 'bytes=9000-9999'}).status_code == 416
        assert visitor.get(upload['content_url']).status_code == 401
        changed = update(client, board, password='nouveau secret').json()
        assert visitor.get(file_url).status_code == 401
        assert visitor.post(public + '/unlock', json={'password': 'mot secret'}).status_code == 401
        assert visitor.post(public + '/unlock', json={'password': 'nouveau secret'}).status_code == 200
        assert visitor.post(public + '/lock').status_code == 204
        assert visitor.get(public).status_code == 401
        assert update(client, changed, is_archived=True).status_code == 200
        assert visitor.get(public).status_code == 404


def test_isolation_csrf_and_file_ownership(client):
    register(client, f'owner-{uuid.uuid4().hex[:8]}')
    board = create(client)
    root = f'/api/v1/padlets/{board["id"]}'
    file = client.post(root + '/files', files={'upload': ('photo.png', PNG, 'image/png')}, headers=csrf_headers(client)).json()
    assert client.post('/api/v1/padlets', json={'title': 'Test', 'slug': 'csrf-test'}).status_code == 403
    with TestClient(app) as other:
        register(other, f'other-{uuid.uuid4().hex[:8]}')
        assert other.get(root).status_code == 404
        assert other.delete(root, headers=csrf_headers(other)).status_code == 404
        assert other.post(root + '/duplicate', headers=csrf_headers(other)).status_code == 404
        assert other.post(root + '/files', files={'upload': ('photo.png', PNG, 'image/png')}, headers=csrf_headers(other)).status_code == 404
        theirs = create(other)
        assert post(other, theirs, type='image', file_id=file['id']).status_code == 404


def test_reorder_hide_trash_restore_duplicate_and_conflict(client):
    register(client, f'order-{uuid.uuid4().hex[:8]}')
    board = create(client, is_published=True)
    root = f'/api/v1/padlets/{board["id"]}'
    board = post(client, board, title='Premier').json()
    first = board['posts'][0]
    board = post(client, board, title='Deuxième').json()
    second = board['posts'][1]
    result = client.put(root + '/order', json={'ids': [second['id'], first['id']]}, headers=csrf_headers(client))
    assert result.status_code == 200
    board = result.json()
    assert board['posts'][0]['title'] == 'Deuxième'
    assert update(client, board, revision=0).status_code == 409
    assert client.put(root + '/order', json={'ids': [first['id'], first['id']]}, headers=csrf_headers(client)).status_code == 422
    first_payload = {'type': 'text', 'title': 'Premier', 'body': 'Ciao !', 'is_visible': False}
    assert client.put(root + '/posts/' + first['id'], json=first_payload, headers=csrf_headers(client)).status_code == 200
    public = f'/api/v1/public/padlets/{board["slug"]}'
    assert len(client.get(public).json()['posts']) == 1
    assert client.delete(root + '/posts/' + second['id'], headers=csrf_headers(client)).status_code == 200
    assert client.get(public).json()['posts'] == []
    assert client.post(root + '/posts/' + second['id'] + '/restore', headers=csrf_headers(client)).status_code == 200
    duplicate = client.post(root + '/duplicate', headers=csrf_headers(client))
    assert duplicate.status_code == 201
    assert duplicate.json()['is_published'] is False and len(duplicate.json()['posts']) == 2
    assert duplicate.json()['slug'] != board['slug']
    assert client.delete(root, headers=csrf_headers(client)).status_code == 204
    assert client.get(public).status_code == 404


def test_password_throttling_origin_and_unknown_board(client):
    register(client, f'limits-{uuid.uuid4().hex[:8]}')
    board = create(client, visibility='password', password='secret-eleve', is_published=True)
    public = f'/api/v1/public/padlets/{board["slug"]}'
    with TestClient(app) as visitor:
        assert visitor.post(public + '/unlock', json={'password': 'secret-eleve'}, headers={'Origin': 'https://evil.invalid'}).status_code == 403
        for _ in range(8):
            assert visitor.post(public + '/unlock', json={'password': 'incorrect'}).status_code == 401
        assert visitor.post(public + '/unlock', json={'password': 'secret-eleve'}).status_code == 429
        assert visitor.post('/api/v1/public/padlets/inconnu/unlock', json={'password': 'incorrect'}).json()['detail'] == 'Lien ou mot de passe incorrect.'


def test_successful_pupils_do_not_exhaust_shared_classroom_ip(client):
    register(client, f'classroom-{uuid.uuid4().hex[:8]}')
    board = create(client, visibility='password', **{'password': 'classe-partagee'}, is_published=True)
    public = f'/api/v1/public/padlets/{board["slug"]}'
    with TestClient(app) as visitor:
        for _ in range(12):
            assert visitor.post(public + '/unlock', json={'password': 'classe-partagee'}).status_code == 200


def test_hidden_deleted_cross_board_files_and_unpublication(client):
    register(client, f'hidden-{uuid.uuid4().hex[:8]}')
    board = create(client, is_published=True)
    other = create(client, is_published=True)
    root = f'/api/v1/padlets/{board["id"]}'
    file = client.post(root + '/files', files={'upload': ('photo.png', PNG, 'image/png')}, headers=csrf_headers(client)).json()
    board = post(client, board, type='image', file_id=file['id'], is_visible=False).json()
    resource = board['posts'][0]
    public = f'/api/v1/public/padlets/{board["slug"]}'
    content = f'{public}/posts/{resource["id"]}/content'
    with TestClient(app) as visitor:
        assert visitor.get(content).status_code == 404
        assert visitor.get(f'/api/v1/public/padlets/{other["slug"]}/posts/{resource["id"]}/content').status_code == 404
        payload = {'type': 'image', 'title': 'Image', 'file_id': file['id'], 'is_visible': True}
        result = client.put(root + '/posts/' + resource['id'], json=payload, headers=csrf_headers(client))
        board = result.json()
        assert visitor.get(content).status_code == 200
        assert visitor.get(content + '?download=true').headers['content-disposition'].startswith('attachment;')
        assert update(client, board, is_published=False).status_code == 200
        assert visitor.get(content).status_code == 404


@pytest.mark.parametrize('kind,filename,mime,data', [
    ('image', 'photo.png', 'image/png', PNG),
    ('video', 'clip.mp4', 'video/mp4', b'\x00\x00\x00\x18ftypmp42' + b'0' * 40),
    ('pdf', 'cours.pdf', 'application/pdf', b'%PDF-1.4\n%%EOF'),
    ('file', 'notes.txt', 'text/plain', b'Ciao'),
    ('docx', 'cours.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', b'DOCX'),
])
def test_resource_files(client, kind, filename, mime, data):
    register(client, f'file-{uuid.uuid4().hex[:8]}')
    board = create(client, is_published=True)
    if kind == 'docx':
        output = BytesIO()
        with ZipFile(output, 'w') as archive:
            archive.writestr('word/document.xml', '<w:document/>')
        data = output.getvalue()
    uploaded = client.post(f'/api/v1/padlets/{board["id"]}/files', files={'upload': (filename, data, mime)}, headers=csrf_headers(client))
    assert uploaded.status_code == 201, uploaded.text
    board = post(client, board, type=kind, file_id=uploaded.json()['id']).json()
    with TestClient(app) as visitor:
        result = visitor.get(f'/api/v1/public/padlets/{board["slug"]}').json()
        response = visitor.get(result['posts'][0]['content_url'])
        assert response.content == data
        if kind in {'docx', 'file'}:
            assert response.headers['content-disposition'].startswith('attachment;')


def test_url_validation_idempotency_and_invalid_upload(client):
    register(client, f'validation-{uuid.uuid4().hex[:8]}')
    board = create(client)
    post_id = str(uuid.uuid4())
    assert post(client, board, id=post_id).status_code == 201
    board = post(client, board, id=post_id).json()
    assert len(board['posts']) == 1
    assert post(client, board, type='link', external_url='javascript:alert(1)').status_code == 422
    assert post(client, board, type='video', external_url='https://youtube.com.evil.invalid/embed/dQw4w9WgXcQ').status_code == 422
    assert post(client, board, type='video', external_url='https://youtu.be/dQw4w9WgXcQ').status_code == 201
    assert post(client, board, type='video', external_url='https://vimeo.com/123456789').status_code == 201
    assert post(client, board, type='link', external_url='https://example.com').status_code == 201
    response = client.post(f'/api/v1/padlets/{board["id"]}/files', files={'upload': ('fake.png', b'fake', 'image/png')}, headers=csrf_headers(client))
    assert response.status_code == 415
    response = client.post(f'/api/v1/padlets/{board["id"]}/files', files={'upload': ('active.svg', b'<svg/>', 'image/svg+xml')}, headers=csrf_headers(client))
    assert response.status_code == 415
    response = client.post(f'/api/v1/padlets/{board["id"]}/files', files={'upload': ('fake.docx', b'PK\x03\x04fake', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}, headers=csrf_headers(client))
    assert response.status_code == 415
