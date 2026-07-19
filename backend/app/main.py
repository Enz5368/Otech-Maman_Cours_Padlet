from __future__ import annotations

import json
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text

from .config import get_settings
from .database import Base, SessionLocal, engine
from .models import User
from .routers import admin, auth, entities, files, search, transfers, users, workspace
from .security import normalize_username
from .services.accounts import create_user, ensure_user_directories

logger = logging.getLogger("monespaceprof")
logging.basicConfig(level=logging.INFO, format="%(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    settings.users_root.mkdir(parents=True, exist_ok=True)
    settings.backups_root.mkdir(parents=True, exist_ok=True)
    settings.logs_root.mkdir(parents=True, exist_ok=True)
    if not settings.is_production:
        Base.metadata.create_all(engine)
    if settings.initial_rose_password:
        with SessionLocal() as db:
            rose = db.scalar(select(User).where(User.username_normalized == normalize_username("rose")))
            if not rose:
                create_user(
                    db,
                    settings,
                    username="rose",
                    password=settings.initial_rose_password,
                    must_change_password=True,
                )
                db.commit()
                logger.info(json.dumps({"event": "bootstrap.rose_created"}))
    with SessionLocal() as db:
        for user_id in db.scalars(select(User.id)):
            ensure_user_directories(settings.users_root, user_id)
    yield


app = FastAPI(
    title="MonEspaceProf API",
    version=get_settings().app_version,
    docs_url="/api/docs" if not get_settings().is_production else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "If-Match", "Range"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; "
        "style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; "
        "frame-src 'self' https:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
    )
    logger.info(
        json.dumps(
            {
                "event": "http.request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            }
        )
    )
    return response


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    logger.exception(json.dumps({"event": "http.unhandled_error", "path": request.url.path}))
    return JSONResponse(
        status_code=500,
        content={"detail": "Erreur interne", "request_id": request.headers.get("x-request-id")},
    )


@app.get("/health", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok", "version": get_settings().app_version}


@app.get("/ready", include_in_schema=False)
def ready() -> dict[str, str]:
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ready"}


API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(workspace.router, prefix=API_PREFIX)
app.include_router(files.router, prefix=API_PREFIX)
app.include_router(search.router, prefix=API_PREFIX)
app.include_router(transfers.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
# Le routeur générique est volontairement enregistré en dernier.
app.include_router(entities.router, prefix=API_PREFIX)
