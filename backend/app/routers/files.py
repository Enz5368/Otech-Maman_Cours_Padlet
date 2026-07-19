from __future__ import annotations

import re
import shutil
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, File, Header, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from ..config import get_settings
from ..dependencies import CsrfGuard, CurrentUser, DbDep
from ..models import StoredFile
from ..services.audit import record_audit
from ..services.storage import iter_file_range, resolve_user_file, store_upload

router = APIRouter(prefix="/files", tags=["files"])
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")


def owned_file(
    db: DbDep, user_id: uuid.UUID, file_id: uuid.UUID, *, include_deleted: bool = False
) -> StoredFile:
    query = select(StoredFile).where(StoredFile.id == file_id, StoredFile.user_id == user_id)
    if not include_deleted:
        query = query.where(StoredFile.deleted_at.is_(None))
    record = db.scalar(query)
    if not record:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    return record


@router.get("")
def list_files(user: CurrentUser, db: DbDep, offset: int = 0, limit: int = 100) -> list[dict]:
    records = db.scalars(
        select(StoredFile)
        .where(StoredFile.user_id == user.id, StoredFile.deleted_at.is_(None))
        .order_by(StoredFile.created_at.desc())
        .offset(max(0, offset))
        .limit(min(max(1, limit), 200))
    ).all()
    return [
        {
            "id": str(item.id),
            "original_name": item.original_name,
            "mime_type": item.mime_type,
            "size_bytes": item.size_bytes,
            "category": item.category,
            "checksum": item.checksum,
            "created_at": item.created_at,
            "content_url": f"/api/v1/files/{item.id}/content",
            "thumbnail_url": f"/api/v1/files/{item.id}/thumbnail" if item.thumbnail_relative_path else None,
        }
        for item in records
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
def upload_file(
    user: CurrentUser,
    db: DbDep,
    _csrf: CsrfGuard,
    upload: Annotated[UploadFile, File()],
) -> dict:
    record = store_upload(db, get_settings(), user, upload)
    record_audit(
        db, "file.uploaded", user_id=user.id, resource_id=str(record.id), details={"size": record.size_bytes}
    )
    db.commit()
    return {
        "id": str(record.id),
        "original_name": record.original_name,
        "mime_type": record.mime_type,
        "size_bytes": record.size_bytes,
        "content_url": f"/api/v1/files/{record.id}/content",
        "thumbnail_url": f"/api/v1/files/{record.id}/thumbnail" if record.thumbnail_relative_path else None,
    }


@router.get("/{file_id}/thumbnail")
def file_thumbnail(file_id: uuid.UUID, user: CurrentUser, db: DbDep):
    record = owned_file(db, user.id, file_id)
    if not record.thumbnail_relative_path:
        raise HTTPException(status_code=404, detail="Miniature introuvable")
    path = resolve_user_file(get_settings(), user.id, record.thumbnail_relative_path)
    return StreamingResponse(
        iter_file_range(path, 0, path.stat().st_size - 1),
        media_type="image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/{file_id}/content")
def file_content(
    file_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    range_header: str | None = Header(default=None, alias="Range"),
):
    record = owned_file(db, user.id, file_id)
    path = resolve_user_file(get_settings(), user.id, record.relative_path)
    size = path.stat().st_size
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'inline; filename="{record.original_name.replace(chr(34), "")}"',
        "Cache-Control": "private, max-age=300",
    }
    if range_header:
        match = RANGE_RE.fullmatch(range_header.strip())
        if not match:
            raise HTTPException(status_code=416, detail="Plage invalide")
        start_text, end_text = match.groups()
        if not start_text:
            length = int(end_text or 0)
            start, end = max(0, size - length), size - 1
        else:
            start = int(start_text)
            end = min(int(end_text) if end_text else size - 1, size - 1)
        if start >= size or start > end:
            raise HTTPException(status_code=416, detail="Plage hors limites")
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        headers["Content-Length"] = str(end - start + 1)
        return StreamingResponse(
            iter_file_range(path, start, end), status_code=206, media_type=record.mime_type, headers=headers
        )
    headers["Content-Length"] = str(size)
    return StreamingResponse(iter_file_range(path, 0, size - 1), media_type=record.mime_type, headers=headers)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def trash_file(file_id: uuid.UUID, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> Response:
    record = owned_file(db, user.id, file_id)
    source = resolve_user_file(get_settings(), user.id, record.relative_path)
    root = (get_settings().users_root / str(user.id)).resolve()
    target = (root / "trash" / record.stored_name).resolve()
    if root not in target.parents:
        raise HTTPException(status_code=400, detail="Chemin de corbeille invalide")
    shutil.move(str(source), str(target))
    record.relative_path = target.relative_to(root).as_posix()
    record.deleted_at = datetime.now(UTC)
    record_audit(db, "file.trashed", user_id=user.id, resource_id=str(record.id))
    db.commit()
    return Response(status_code=204)


@router.post("/{file_id}/restore")
def restore_file(file_id: uuid.UUID, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    record = owned_file(db, user.id, file_id, include_deleted=True)
    if not record.deleted_at:
        return {"id": str(record.id), "restored": False}
    source = resolve_user_file(get_settings(), user.id, record.relative_path)
    root = (get_settings().users_root / str(user.id)).resolve()
    target = (root / record.category / record.stored_name).resolve()
    if root not in target.parents:
        raise HTTPException(status_code=400, detail="Chemin de restauration invalide")
    shutil.move(str(source), str(target))
    record.relative_path = target.relative_to(root).as_posix()
    record.deleted_at = None
    record_audit(db, "file.restored", user_id=user.id, resource_id=str(record.id))
    db.commit()
    return {"id": str(record.id), "restored": True}
