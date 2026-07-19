from __future__ import annotations

import secrets
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from threading import Lock

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import select, update

from ..config import get_settings
from ..dependencies import CsrfGuard, CurrentSession, CurrentUser, DbDep
from ..models import PasswordResetToken, ServerSession, User
from ..schemas import (
    AuthCredentials,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
)
from ..security import (
    digest_token,
    hash_password,
    needs_rehash,
    new_session_secrets,
    normalize_username,
    verify_password,
)
from ..services.accounts import create_user
from ..services.audit import record_audit
from ..services.mail import send_password_reset

router = APIRouter(prefix="/auth", tags=["auth"])
_attempts: dict[str, deque[datetime]] = defaultdict(deque)
_attempts_lock = Lock()


def _check_rate_limit(key: str) -> None:
    settings = get_settings()
    cutoff = datetime.now(UTC) - timedelta(seconds=settings.login_window_seconds)
    with _attempts_lock:
        queue = _attempts[key]
        while queue and queue[0] < cutoff:
            queue.popleft()
        if len(queue) >= settings.login_attempts_per_window:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Trop de tentatives")
        queue.append(datetime.now(UTC))


def _clear_rate_limit(key: str) -> None:
    with _attempts_lock:
        _attempts.pop(key, None)


def _set_session_cookies(response: Response, raw_token: str, csrf_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        settings.cookie_name,
        raw_token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.cookie_secure or settings.is_production,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf_token,
        max_age=settings.session_ttl_seconds,
        httponly=False,
        secure=settings.cookie_secure or settings.is_production,
        samesite="lax",
        path="/",
    )


def _new_session(db: DbDep, request: Request, response: Response, user: User) -> None:
    settings = get_settings()
    secrets_bundle = new_session_secrets()
    session = ServerSession(
        user_id=user.id,
        token_hash=secrets_bundle.session_hash,
        csrf_hash=secrets_bundle.csrf_hash,
        expires_at=datetime.now(UTC) + timedelta(seconds=settings.session_ttl_seconds),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:2000],
    )
    db.add(session)
    _set_session_cookies(response, secrets_bundle.session_token, secrets_bundle.csrf_token)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, response: Response, db: DbDep) -> User:
    settings = get_settings()
    normalized = normalize_username(payload.username)
    _check_rate_limit(f"register:{request.client.host if request.client else 'unknown'}:{normalized}")
    if len(payload.password) < 10:
        raise HTTPException(status_code=422, detail="Le mot de passe doit contenir au moins 10 caractères")
    if db.scalar(select(User.id).where(User.username_normalized == normalized)):
        raise HTTPException(status_code=409, detail="Cet identifiant existe déjà")
    user = create_user(
        db,
        settings,
        username=payload.username,
        password=payload.password,
        email=payload.email,
        display_name=payload.display_name,
    )
    _new_session(db, request, response, user)
    record_audit(
        db, "auth.register", user_id=user.id, ip_address=request.client.host if request.client else None
    )
    db.commit()
    return user


@router.post("/login", response_model=UserResponse)
def login(payload: AuthCredentials, request: Request, response: Response, db: DbDep) -> User:
    settings = get_settings()
    normalized = normalize_username(payload.username)
    rate_key = f"login:{request.client.host if request.client else 'unknown'}:{normalized}"
    _check_rate_limit(rate_key)
    user = db.scalar(select(User).where(User.username_normalized == normalized))
    if user is None and payload.auto_register:
        if len(payload.password) < 10:
            raise HTTPException(
                status_code=422, detail="Un nouveau mot de passe doit contenir au moins 10 caractères"
            )
        user = create_user(db, settings, username=payload.username, password=payload.password)
        record_audit(
            db,
            "auth.auto_register",
            user_id=user.id,
            ip_address=request.client.host if request.client else None,
        )
    if user is None or not verify_password(user.password_hash, payload.password):
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.login_attempts_per_window:
                user.locked_until = datetime.now(UTC) + timedelta(seconds=settings.login_window_seconds)
            record_audit(
                db,
                "auth.login_failed",
                user_id=user.id,
                ip_address=request.client.host if request.client else None,
            )
            db.commit()
        raise HTTPException(status_code=401, detail="Identifiant ou mot de passe incorrect")
    now = datetime.now(UTC)
    locked_until = user.locked_until
    if locked_until and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=UTC)
    if user.status != "active" or (locked_until and locked_until > now):
        raise HTTPException(status_code=403, detail="Compte temporairement indisponible")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    _new_session(db, request, response, user)
    record_audit(
        db, "auth.login", user_id=user.id, ip_address=request.client.host if request.client else None
    )
    db.commit()
    _clear_rate_limit(rate_key)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, db: DbDep, current_session: CurrentSession, _csrf: CsrfGuard) -> None:
    settings = get_settings()
    current_session.revoked_at = datetime.now(UTC)
    record_audit(db, "auth.logout", user_id=current_session.user_id)
    db.commit()
    response.delete_cookie(settings.cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")


@router.post("/refresh", response_model=UserResponse)
def refresh(
    request: Request,
    response: Response,
    db: DbDep,
    current_session: CurrentSession,
    user: CurrentUser,
    _csrf: CsrfGuard,
) -> User:
    current_session.revoked_at = datetime.now(UTC)
    _new_session(db, request, response, user)
    record_audit(db, "auth.session_rotated", user_id=user.id)
    db.commit()
    return user


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser) -> User:
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    db: DbDep,
    current_session: CurrentSession,
    user: CurrentUser,
    _csrf: CsrfGuard,
) -> None:
    if not verify_password(user.password_hash, payload.current_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit être différent")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    if payload.revoke_other_sessions:
        db.execute(
            update(ServerSession)
            .where(
                ServerSession.user_id == user.id,
                ServerSession.id != current_session.id,
                ServerSession.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC))
        )
    record_audit(db, "auth.password_changed", user_id=user.id)
    db.commit()


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: DbDep) -> dict[str, str]:
    user = db.scalar(select(User).where(User.username_normalized == normalize_username(payload.username)))
    if user and user.email:
        settings = get_settings()
        raw_token = secrets.token_urlsafe(48)
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=digest_token(raw_token),
                expires_at=datetime.now(UTC) + timedelta(hours=1),
            )
        )
        # Le jeton doit être envoyé par le fournisseur SMTP configuré en production, jamais journalisé.
        delivered = send_password_reset(settings, user.email, raw_token)
        record_audit(
            db,
            "auth.password_reset_requested",
            user_id=user.id,
            details={"delivery": "smtp" if delivered else "smtp_not_configured"},
        )
        db.commit()
    return {"message": "Si le compte est éligible, une procédure de récupération a été créée."}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest, db: DbDep) -> None:
    token = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == digest_token(payload.token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(UTC),
        )
    )
    if not token:
        raise HTTPException(status_code=400, detail="Jeton invalide ou expiré")
    user = db.get(User, token.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Compte introuvable")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    token.used_at = datetime.now(UTC)
    db.execute(
        update(ServerSession).where(ServerSession.user_id == user.id).values(revoked_at=datetime.now(UTC))
    )
    record_audit(db, "auth.password_reset", user_id=user.id)
    db.commit()
