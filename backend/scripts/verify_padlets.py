"""Verify deployed public/private boards over HTTPS using disposable synthetic data."""
from __future__ import annotations

import base64
import json
import secrets
import shutil
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.parse import unquote
from urllib.request import HTTPCookieProcessor, Request, build_opener

from app.config import get_settings
from app.database import SessionLocal
from app.models import User
from app.services.accounts import create_user


def main() -> None:
    settings = get_settings()
    origin = settings.public_base_url.rstrip('/')
    if not origin.startswith('https://'):
        raise SystemExit('La vérification publique doit utiliser HTTPS.')
    cookies = CookieJar()
    owner = build_opener(HTTPCookieProcessor(cookies))
    visitor = build_opener(HTTPCookieProcessor(CookieJar()))
    marker = secrets.token_hex(8)
    username = f'padlet-check-{marker}'
    password = secrets.token_urlsafe(32)
    board_password = secrets.token_urlsafe(24)
    with SessionLocal() as db:
        user = create_user(db, settings, username=username, password=password)
        user_id = user.id
        db.commit()

    def call(agent, route, method='GET', payload=None, expected=200, content_type=None):
        # Cloudflare rejects Python's default automation agent before the app.
        headers = {'Origin': origin, 'User-Agent': 'MonEspaceProf-Deployment-Check/1.0'}
        data = None
        if payload is not None:
            headers['Content-Type'] = content_type or 'application/json'
            data = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        if agent is owner and method != 'GET':
            token = next((cookie.value for cookie in cookies if cookie.name == settings.csrf_cookie_name), '')
            if token:
                headers['X-CSRF-Token'] = unquote(token)
        request = Request(origin + route, data=data, headers=headers, method=method)  # noqa: S310 - configured HTTPS origin
        try:
            response = agent.open(request, timeout=30)
        except HTTPError as error:
            if error.code == expected:
                return None
            raise RuntimeError(f'Vérification Padlet : {method} {route} a retourné {error.code}') from None
        with response:
            if response.status != expected:
                raise RuntimeError(f'Vérification Padlet : statut inattendu {response.status}')
            if response.status == 204:
                return None
            raw = response.read()
            return json.loads(raw) if 'application/json' in response.headers.get('Content-Type', '') else raw

    try:
        call(owner, '/api/v1/auth/login', 'POST', {'username': username, 'password': password, 'auto_register': False})
        for protected in (False, True):
            slug = f'verification-{marker}-{int(protected)}'
            payload = {'title': 'Vérification du déploiement', 'slug': slug, 'is_published': True,
                       'layout': 'horizontal' if protected else 'vertical',
                       'visibility': 'password' if protected else 'public'}
            if protected:
                payload['password'] = board_password
            board = call(owner, '/api/v1/padlets', 'POST', payload, 201)
            call(owner, f'/api/v1/padlets/{board["id"]}/posts', 'POST',
                 {'type': 'text', 'title': 'Ressource de vérification', 'body': 'Test technique sans données personnelles.'}, 201)
            image = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XcAAAAASUVORK5CYII=')
            boundary = f'mep-{secrets.token_hex(16)}'
            multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="upload"; filename="test.png"\r\n'
                         'Content-Type: image/png\r\n\r\n').encode() + image + f'\r\n--{boundary}--\r\n'.encode()
            uploaded = call(owner, f'/api/v1/padlets/{board["id"]}/files', 'POST', multipart, 201,
                            f'multipart/form-data; boundary={boundary}')
            posted = call(owner, f'/api/v1/padlets/{board["id"]}/posts', 'POST',
                          {'type': 'image', 'title': 'Image de vérification', 'file_id': uploaded['id']}, 201)
            post_id = next(post['id'] for post in posted['posts'] if post['type'] == 'image')
            public = f'/api/v1/public/padlets/{slug}'
            file_url = f'{public}/posts/{post_id}/content'
            if protected:
                call(visitor, public, expected=401)
                call(visitor, file_url, expected=401)
                call(visitor, public + '/unlock', 'POST', {'password': 'incorrect'}, 401)
                call(visitor, public + '/unlock', 'POST', {'password': board_password})
            document = call(visitor, public)
            if len(document['posts']) != 2 or 'password_hash' in json.dumps(document):
                raise RuntimeError('Le contenu public du Padlet ne correspond pas au contenu publié.')
            if call(visitor, file_url) != image:
                raise RuntimeError('Le fichier public servi ne correspond pas au fichier publié.')
            html = call(visitor, f'/padlet/{slug}')
            if b'assets/padlets.js?v=1' not in html:
                raise RuntimeError('La page publique ne sert pas la nouvelle version du frontend.')
            if protected:
                call(visitor, public + '/lock', 'POST', expected=204)
                call(visitor, file_url, expected=401)
            print(f'Padlet HTTPS vérifié : {origin}/padlet/{slug} (données de test supprimées à la fin)')
        # Verify that direct private file links are still denied to anonymous readers.
        call(visitor, '/api/v1/files', expected=401)
        print('Padlets publics et protégés : vérification HTTPS réussie.')
    finally:
        with SessionLocal() as db:
            test_user = db.get(User, user_id)
            if test_user and test_user.username == username:
                db.delete(test_user)
                db.commit()
        # Only directories created above, validated against the configured storage root.
        target = (settings.users_root / str(user_id)).resolve()
        if target.parent == settings.users_root.resolve() and target.name == str(user_id) and target.is_dir():
            shutil.rmtree(target)


if __name__ == '__main__':
    main()
