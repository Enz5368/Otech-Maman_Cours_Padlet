from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .database import get_db
from .models import ServerSession, User
from .security import digest_token

DbDep = Annotated[Session, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def get_current_session(
    request: Request,
    db: DbDep,
    settings: SettingsDep,
    session_cookie: Annotated[str | None, Cookie(alias="mep_session")] = None,
) -> ServerSession:
    token = request.cookies.get(settings.cookie_name) or session_cookie
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentification requise")
    session = db.scalar(select(ServerSession).where(ServerSession.token_hash == digest_token(token)))
    now = datetime.now(UTC)
    if not session or session.revoked_at or _as_utc(session.expires_at) <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expirée")
    session.last_seen_at = now
    return session


def get_current_user(
    request: Request,
    session: Annotated[ServerSession, Depends(get_current_session)],
    db: DbDep,
) -> User:
    user = db.get(User, session.user_id)
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte indisponible")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentSession = Annotated[ServerSession, Depends(get_current_session)]


def require_csrf(
    request: Request,
    current_session: CurrentSession,
    settings: SettingsDep,
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    cookie_token = request.cookies.get(settings.csrf_cookie_name)
    if not csrf_header or not cookie_token or csrf_header != cookie_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Jeton CSRF manquant")
    if digest_token(csrf_header) != current_session.csrf_hash:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Jeton CSRF invalide")


CsrfGuard = Annotated[None, Depends(require_csrf)]


def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Rôle administrateur requis")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
