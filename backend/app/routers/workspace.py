from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..config import get_settings
from ..dependencies import CsrfGuard, CurrentUser, DbDep
from ..models import Import, UserWorkspace
from ..schemas import MigrationImportRequest, WorkspaceRead, WorkspaceWrite
from ..services.audit import record_audit
from ..services.workspace import save_workspace, workspace_counts

router = APIRouter(tags=["workspace", "imports"])


@router.get("/workspace", response_model=WorkspaceRead)
def read_workspace(user: CurrentUser, db: DbDep) -> WorkspaceRead:
    workspace = db.scalar(select(UserWorkspace).where(UserWorkspace.user_id == user.id))
    if not workspace:
        return WorkspaceRead(schema_version=2, revision=0, content={})
    return WorkspaceRead(
        schema_version=workspace.schema_version,
        revision=workspace.revision,
        content=workspace.content,
        updated_at=workspace.updated_at,
    )


@router.put("/workspace", response_model=WorkspaceRead)
def write_workspace(payload: WorkspaceWrite, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> WorkspaceRead:
    workspace = save_workspace(
        db,
        get_settings(),
        user,
        payload.content,
        schema_version=payload.schema_version,
        expected_revision=payload.expected_revision,
    )
    record_audit(db, "workspace.saved", user_id=user.id, details={"revision": workspace.revision})
    db.commit()
    return WorkspaceRead(
        schema_version=workspace.schema_version,
        revision=workspace.revision,
        content=workspace.content,
        updated_at=workspace.updated_at,
    )


@router.get("/imports")
def list_imports(user: CurrentUser, db: DbDep) -> list[dict]:
    records = db.scalars(
        select(Import).where(Import.user_id == user.id).order_by(Import.created_at.desc())
    ).all()
    return [
        {
            "id": str(record.id),
            "status": record.status,
            "source": record.source,
            "manifest": record.manifest,
            "error": record.error,
            "created_at": record.created_at,
            "completed_at": record.completed_at,
        }
        for record in records
    ]


@router.post("/imports", status_code=status.HTTP_200_OK)
def import_local_storage(
    payload: MigrationImportRequest, user: CurrentUser, db: DbDep, _csrf: CsrfGuard
) -> dict:
    existing = db.scalar(
        select(Import).where(Import.user_id == user.id, Import.idempotency_key == payload.idempotency_key)
    )
    if existing and existing.status == "completed":
        return {
            "id": str(existing.id),
            "status": existing.status,
            "report": existing.manifest,
            "idempotent": True,
        }
    record = existing or Import(
        user_id=user.id,
        idempotency_key=payload.idempotency_key,
        source=payload.source,
        status="pending",
        manifest={"storage_key": payload.storage_key},
    )
    if not existing:
        db.add(record)
        db.flush()
    try:
        record.status = "running"
        workspace = save_workspace(db, get_settings(), user, payload.content, schema_version=2)
        server_counts = workspace_counts(workspace.content)
        mismatches = {
            key: {"client": value, "server": server_counts.get(key, 0)}
            for key, value in payload.client_counts.items()
            if server_counts.get(key, 0) != value
        }
        record.status = "completed" if not mismatches else "failed"
        record.completed_at = datetime.now(UTC)
        record.manifest = {
            "storage_key": payload.storage_key,
            "client_counts": payload.client_counts,
            "server_counts": server_counts,
            "mismatches": mismatches,
            "workspace_revision": workspace.revision,
            "local_storage_deleted": False,
        }
        if mismatches:
            record.error = "Le contrôle du nombre d'éléments a échoué"
        record_audit(
            db,
            "migration.local_storage",
            user_id=user.id,
            resource_id=str(record.id),
            details=record.manifest,
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        failed = db.get(Import, record.id)
        if failed:
            failed.status = "failed"
            failed.error = str(exc)[:2000]
            db.commit()
        raise
    if record.status == "failed":
        raise HTTPException(status_code=422, detail={"message": record.error, "report": record.manifest})
    return {"id": str(record.id), "status": record.status, "report": record.manifest, "idempotent": False}
