from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select, update

from ..config import get_settings
from ..dependencies import AdminUser, CsrfGuard, DbDep
from ..models import AuditLog, Backup, ServerSession, User, UserQuota
from ..schemas import AdminPasswordResetRequest, AdminQuotaRequest, UserResponse
from ..security import hash_password
from ..services.audit import record_audit
from ..services.workspace import save_workspace

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[UserResponse])
def list_users(_admin: AdminUser, db: DbDep) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())


@router.post("/users/{user_id}/disable")
def disable_user(user_id: uuid.UUID, admin: AdminUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    user = db.get(User, user_id)
    if not user or user.id == admin.id:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.status = "disabled"
    db.execute(
        update(ServerSession).where(ServerSession.user_id == user.id).values(revoked_at=user.updated_at)
    )
    record_audit(db, "admin.user_disabled", user_id=admin.id, resource_id=str(user.id))
    db.commit()
    return {"status": user.status}


@router.post("/users/{user_id}/enable")
def enable_user(user_id: uuid.UUID, admin: AdminUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.status = "active"
    record_audit(db, "admin.user_enabled", user_id=admin.id, resource_id=str(user.id))
    db.commit()
    return {"status": user.status}


@router.post("/users/{user_id}/force-password-reset")
def force_password_reset(
    user_id: uuid.UUID,
    payload: AdminPasswordResetRequest,
    admin: AdminUser,
    db: DbDep,
    _csrf: CsrfGuard,
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.password_hash = hash_password(payload.temporary_password)
    user.must_change_password = True
    db.execute(
        update(ServerSession)
        .where(ServerSession.user_id == user.id, ServerSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    record_audit(db, "admin.password_reset_forced", user_id=admin.id, resource_id=str(user.id))
    db.commit()
    return {"must_change_password": True}


@router.patch("/users/{user_id}/quota")
def update_quota(
    user_id: uuid.UUID,
    payload: AdminQuotaRequest,
    admin: AdminUser,
    db: DbDep,
    _csrf: CsrfGuard,
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    quota = db.scalar(select(UserQuota).where(UserQuota.user_id == user.id))
    effective_used = user.storage_used_bytes + (quota.used_backups_bytes if quota else 0)
    if payload.quota_bytes < effective_used:
        raise HTTPException(status_code=422, detail="Le quota est inférieur à l'espace déjà utilisé")
    user.storage_quota_bytes = payload.quota_bytes
    if quota:
        quota.max_bytes = payload.quota_bytes
    record_audit(db, "admin.quota_updated", user_id=admin.id, resource_id=str(user.id))
    db.commit()
    return {"storage_quota_bytes": user.storage_quota_bytes, "storage_used_bytes": user.storage_used_bytes}


@router.delete("/users/{user_id}")
def soft_delete_user(user_id: uuid.UUID, admin: AdminUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    user = db.get(User, user_id)
    if not user or user.id == admin.id:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.status = "deleted"
    db.execute(
        update(ServerSession)
        .where(ServerSession.user_id == user.id, ServerSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    record_audit(db, "admin.user_soft_deleted", user_id=admin.id, resource_id=str(user.id))
    db.commit()
    return {"status": "deleted", "recoverable": True}


@router.get("/audit-logs")
def audit_logs(_admin: AdminUser, db: DbDep, offset: int = 0, limit: int = 100) -> list[dict]:
    rows = db.scalars(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset(max(0, offset)).limit(min(limit, 200))
    ).all()
    return [
        {
            "id": str(row.id),
            "user_id": str(row.user_id) if row.user_id else None,
            "action": row.action,
            "resource_id": row.resource_id,
            "details": row.details,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.get("/backups")
def all_backups(_admin: AdminUser, db: DbDep, offset: int = 0, limit: int = 100) -> list[dict]:
    rows = db.scalars(
        select(Backup).order_by(Backup.created_at.desc()).offset(max(0, offset)).limit(min(limit, 200))
    ).all()
    return [
        {
            "id": str(row.id),
            "user_id": str(row.user_id),
            "status": row.status,
            "cadence": row.cadence,
            "manifest": row.manifest,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post("/backups/{backup_id}/restore")
def admin_restore_backup(backup_id: uuid.UUID, admin: AdminUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    backup = db.get(Backup, backup_id)
    if not backup or backup.status != "completed":
        raise HTTPException(status_code=404, detail="Sauvegarde introuvable")
    target_user = db.get(User, backup.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    root = (get_settings().users_root / str(target_user.id)).resolve()
    path = (root / backup.manifest["relative_path"]).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier de sauvegarde introuvable")
    payload = json.loads(path.read_text(encoding="utf-8"))
    workspace = save_workspace(
        db,
        get_settings(),
        target_user,
        payload["content"],
        schema_version=payload["schema_version"],
        extract_files=False,
    )
    record_audit(
        db,
        "admin.backup_restored",
        user_id=admin.id,
        resource_id=str(backup.id),
        details={"target_user_id": str(target_user.id), "revision": workspace.revision},
    )
    db.commit()
    return {"restored": True, "user_id": str(target_user.id), "revision": workspace.revision}
