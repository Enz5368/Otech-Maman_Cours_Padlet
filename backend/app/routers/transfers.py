from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select

from ..config import get_settings
from ..dependencies import CsrfGuard, CurrentUser, DbDep
from ..models import Backup, Export, UserQuota, UserWorkspace
from ..services.accounts import ensure_user_directories
from ..services.audit import record_audit
from ..services.workspace import save_workspace

router = APIRouter(tags=["exports", "backups"])


def _write_snapshot(
    user_id: uuid.UUID, workspace: UserWorkspace, folder: str, prefix: str
) -> tuple[Path, str]:
    root = ensure_user_directories(get_settings().users_root, user_id)
    target = (
        root / folder / f"{prefix}-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex}.json"
    ).resolve()
    if root not in target.parents:
        raise HTTPException(status_code=400, detail="Chemin d'export invalide")
    payload = json.dumps(
        {
            "application": "MonEspaceProf",
            "app_version": get_settings().app_version,
            "schema_version": workspace.schema_version,
            "revision": workspace.revision,
            "exported_at": datetime.now(UTC).isoformat(),
            "content": workspace.content,
        },
        ensure_ascii=False,
        indent=2,
    ).encode("utf-8")
    target.write_bytes(payload)
    return target, hashlib.sha256(payload).hexdigest()


@router.get("/exports")
def list_exports(user: CurrentUser, db: DbDep) -> list[dict]:
    records = db.scalars(
        select(Export).where(Export.user_id == user.id).order_by(Export.created_at.desc())
    ).all()
    return [
        {"id": str(item.id), "status": item.status, "manifest": item.manifest, "created_at": item.created_at}
        for item in records
    ]


@router.post("/exports")
def create_export(user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    workspace = db.scalar(select(UserWorkspace).where(UserWorkspace.user_id == user.id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Espace introuvable")
    path, checksum = _write_snapshot(user.id, workspace, "exports", "export")
    root = (get_settings().users_root / str(user.id)).resolve()
    record = Export(
        user_id=user.id,
        status="completed",
        completed_at=datetime.now(UTC),
        manifest={"relative_path": path.relative_to(root).as_posix(), "checksum": checksum, "format": "json"},
    )
    db.add(record)
    db.commit()
    return {
        "id": str(record.id),
        "status": record.status,
        "download_url": f"/api/v1/exports/{record.id}/download",
    }


@router.get("/exports/{record_id}/download")
def download_export(record_id: uuid.UUID, user: CurrentUser, db: DbDep):
    record = db.scalar(select(Export).where(Export.id == record_id, Export.user_id == user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Export introuvable")
    root = (get_settings().users_root / str(user.id)).resolve()
    path = (root / record.manifest["relative_path"]).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Export introuvable")
    return FileResponse(path, media_type="application/json", filename="monespaceprof-export.json")


@router.get("/backups")
def list_backups(user: CurrentUser, db: DbDep) -> list[dict]:
    records = db.scalars(
        select(Backup).where(Backup.user_id == user.id).order_by(Backup.created_at.desc())
    ).all()
    return [
        {
            "id": str(item.id),
            "status": item.status,
            "cadence": item.cadence,
            "manifest": item.manifest,
            "created_at": item.created_at,
        }
        for item in records
    ]


@router.post("/backups")
def create_backup(user: CurrentUser, db: DbDep, _csrf: CsrfGuard, cadence: str = "manual") -> dict:
    if cadence not in {"manual", "daily", "weekly", "monthly"}:
        raise HTTPException(status_code=422, detail="Cadence invalide")
    workspace = db.scalar(select(UserWorkspace).where(UserWorkspace.user_id == user.id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Espace introuvable")
    folder = "backups/daily" if cadence == "manual" else f"backups/{cadence}"
    path, checksum = _write_snapshot(user.id, workspace, folder, "backup")
    root = (get_settings().users_root / str(user.id)).resolve()
    record = Backup(
        user_id=user.id,
        status="completed",
        cadence=cadence,
        schema_version=workspace.schema_version,
        checksum=checksum,
        completed_at=datetime.now(UTC),
        manifest={"relative_path": path.relative_to(root).as_posix(), "revision": workspace.revision},
    )
    db.add(record)
    quota = db.scalar(select(UserQuota).where(UserQuota.user_id == user.id))
    if quota:
        backups_root = root / "backups"
        quota.used_backups_bytes = sum(
            path.stat().st_size for path in backups_root.rglob("*") if path.is_file()
        )
    record_audit(
        db, "backup.created", user_id=user.id, resource_id=str(record.id), details={"cadence": cadence}
    )
    db.commit()
    return {"id": str(record.id), "status": record.status}


@router.post("/backups/{record_id}/restore")
def restore_backup(record_id: uuid.UUID, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    record = db.scalar(select(Backup).where(Backup.id == record_id, Backup.user_id == user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Sauvegarde introuvable")
    root = (get_settings().users_root / str(user.id)).resolve()
    path = (root / record.manifest["relative_path"]).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Fichier de sauvegarde introuvable")
    payload = json.loads(path.read_text(encoding="utf-8"))
    workspace = save_workspace(
        db,
        get_settings(),
        user,
        payload["content"],
        schema_version=payload["schema_version"],
        extract_files=False,
    )
    record_audit(
        db,
        "backup.restored",
        user_id=user.id,
        resource_id=str(record.id),
        details={"revision": workspace.revision},
    )
    db.commit()
    return {"restored": True, "revision": workspace.revision}
