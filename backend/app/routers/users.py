from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from ..config import get_settings
from ..dependencies import CsrfGuard, CurrentUser, DbDep
from ..models import StoredFile, UserQuota, UserSettings
from ..schemas import SettingsWrite, UserResponse

router = APIRouter(prefix="/users/me", tags=["users"])


@router.get("", response_model=UserResponse)
def get_profile(user: CurrentUser):
    return user


@router.get("/settings")
def read_settings(user: CurrentUser, db: DbDep) -> dict:
    record = db.scalar(select(UserSettings).where(UserSettings.user_id == user.id))
    return record.settings_json if record else {}


@router.put("/settings")
def update_settings(payload: SettingsWrite, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    record = db.scalar(select(UserSettings).where(UserSettings.user_id == user.id))
    if not record:
        record = UserSettings(user_id=user.id, settings_json={})
        db.add(record)
    record.settings_json = payload.settings
    db.commit()
    return record.settings_json


@router.get("/storage")
def storage(user: CurrentUser, db: DbDep) -> dict:
    quota = db.scalar(select(UserQuota).where(UserQuota.user_id == user.id))
    files = db.scalars(
        select(StoredFile).where(StoredFile.user_id == user.id, StoredFile.deleted_at.is_(None))
    ).all()
    categories: dict[str, int] = {}
    for item in files:
        categories[item.category] = categories.get(item.category, 0) + item.size_bytes
    user_root = (get_settings().users_root / str(user.id)).resolve()
    backups_root = (user_root / "backups").resolve()
    backups_bytes = 0
    if user_root in backups_root.parents and backups_root.is_dir():
        backups_bytes = sum(path.stat().st_size for path in backups_root.rglob("*") if path.is_file())
    categories["backups"] = backups_bytes
    thumbnails_root = user_root / "thumbnails"
    categories["thumbnails"] = (
        sum(path.stat().st_size for path in thumbnails_root.rglob("*") if path.is_file())
        if thumbnails_root.is_dir()
        else 0
    )
    effective_used = user.storage_used_bytes + backups_bytes
    return {
        "used_bytes": effective_used,
        "quota_bytes": user.storage_quota_bytes,
        "available_bytes": max(0, user.storage_quota_bytes - effective_used),
        "categories": categories,
        "max_file_bytes": quota.max_file_bytes if quota else None,
    }
