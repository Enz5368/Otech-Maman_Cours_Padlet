from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from ..config import Settings
from ..models import User, UserQuota, UserSettings, UserWorkspace
from ..security import hash_password, normalize_username

USER_DIRECTORIES = (
    "images",
    "videos",
    "audio",
    "documents",
    "presentations",
    "imports",
    "exports",
    "backups/daily",
    "backups/weekly",
    "backups/monthly",
    "thumbnails",
    "trash",
    "temp",
    "avatars",
)


def ensure_user_directories(users_root: Path, user_id: uuid.UUID) -> Path:
    root = (users_root / str(user_id)).resolve()
    if users_root.resolve() not in root.parents:
        raise ValueError("Chemin utilisateur invalide")
    for directory in USER_DIRECTORIES:
        (root / directory).mkdir(parents=True, exist_ok=True)
    return root


def create_user(
    db: Session,
    settings: Settings,
    *,
    username: str,
    password: str,
    email: str | None = None,
    display_name: str | None = None,
    role: str = "teacher",
    must_change_password: bool = False,
) -> User:
    normalized = normalize_username(username)
    if not normalized:
        raise ValueError("Identifiant invalide")
    user = User(
        username=username.strip(),
        username_normalized=normalized,
        password_hash=hash_password(password),
        email=email,
        display_name=display_name,
        role=role,
        must_change_password=must_change_password,
        storage_quota_bytes=settings.default_quota_bytes,
    )
    db.add(user)
    db.flush()
    db.add(UserSettings(user_id=user.id, settings_json={}))
    db.add(
        UserQuota(
            user_id=user.id,
            max_bytes=settings.default_quota_bytes,
            max_file_bytes=settings.max_upload_bytes,
        )
    )
    db.add(UserWorkspace(user_id=user.id, content={}, schema_version=2, revision=1))
    ensure_user_directories(settings.users_root, user.id)
    return user
