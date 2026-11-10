"""Real local API + frontend for the Padlet browser test (isolated test data)."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from app.config import get_settings
from app.database import SessionLocal
from app.main import app
from app.models import UserWorkspace
from app.services.accounts import create_user
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
original_lifespan = app.router.lifespan_context


@asynccontextmanager
async def test_lifespan(application):
    async with original_lifespan(application):
        with SessionLocal() as db:
            user = create_user(db, get_settings(), username='padlet-browser-test', password=os.environ['PADLET_TEST_PASSWORD'])
            db.flush()
            workspace = db.scalar(select(UserWorkspace).where(UserWorkspace.user_id == user.id))
            workspace.content = {'classes': [{'id': 'class', 'title': 'Italien test', 'isVisible': True,
                'sequences': [{'id': 'seq', 'title': 'Premiers pas', 'isVisible': True,
                    'lessons': [{'id': 'lesson', 'title': 'Dire bonjour', 'isVisible': True, 'activities': []}]}]}]}
            db.commit()
        yield


app.router.lifespan_context = test_lifespan
app.mount('/assets', StaticFiles(directory=ROOT / 'assets'), name='assets')
app.mount('/uploads', StaticFiles(directory=ROOT / 'uploads'), name='uploads')


@app.get('/')
@app.get('/index.html')
@app.get('/padlet/{slug}')
def frontend(slug: str = ''):
    response = FileResponse(ROOT / 'index.html')
    if slug:
        response.headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
    return response


if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=int(os.environ['PADLET_TEST_PORT']), log_level='warning')
