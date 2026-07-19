from __future__ import annotations

import base64
import binascii
import hashlib
import mimetypes
import re
import shutil
import subprocess
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import BinaryIO

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import StoredFile, User, UserQuota
from .accounts import ensure_user_directories

ALLOWED_MIME_PREFIXES = ("image/", "video/", "audio/")
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/zip",
    "application/json",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "text/plain",
    "text/csv",
    "text/markdown",
}
ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".mp4",
    ".webm",
    ".mov",
    ".mp3",
    ".wav",
    ".ogg",
    ".pdf",
    ".zip",
    ".json",
    ".pptx",
    ".docx",
    ".odt",
    ".txt",
    ".csv",
    ".md",
}
MIME_EXTENSION_OVERRIDES = {
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.oasis.opendocument.text": ".odt",
}
DATA_URL_RE = re.compile(r"^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$", re.DOTALL)


def category_for_mime(mime_type: str) -> str:
    if mime_type.startswith("image/"):
        return "images"
    if mime_type.startswith("video/"):
        return "videos"
    if mime_type.startswith("audio/"):
        return "audio"
    return "documents"


def validate_mime_and_extension(filename: str, mime_type: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Extension de fichier non autorisée")
    if not (mime_type.startswith(ALLOWED_MIME_PREFIXES) or mime_type in ALLOWED_MIME_TYPES):
        raise HTTPException(status_code=415, detail="Type MIME non autorisé")
    guessed = mimetypes.guess_type(filename)[0]
    if guessed and guessed.split("/", 1)[0] != mime_type.split("/", 1)[0]:
        raise HTTPException(status_code=415, detail="Extension et type MIME incompatibles")
    return extension


def validate_content_signature(data: bytes, mime_type: str) -> None:
    """Contrôle minimal du contenu réel avant persistance."""
    valid = True
    if mime_type == "image/png":
        valid = data.startswith(b"\x89PNG\r\n\x1a\n")
    elif mime_type in {"image/jpeg", "image/jpg"}:
        valid = data.startswith(b"\xff\xd8\xff")
    elif mime_type == "image/gif":
        valid = data.startswith((b"GIF87a", b"GIF89a"))
    elif mime_type == "image/webp":
        valid = data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    elif mime_type == "image/svg+xml":
        valid = b"<svg" in data[:4096].lower()
    elif mime_type == "application/pdf":
        valid = data.startswith(b"%PDF-")
    elif mime_type in {
        "application/zip",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.oasis.opendocument.text",
    }:
        valid = data.startswith(b"PK\x03\x04")
    elif mime_type in {"video/mp4", "video/quicktime"}:
        valid = len(data) >= 12 and data[4:8] == b"ftyp"
    elif mime_type == "video/webm":
        valid = data.startswith(b"\x1a\x45\xdf\xa3")
    elif mime_type in {"audio/mpeg", "audio/mp3"}:
        valid = data.startswith(b"ID3") or (len(data) >= 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0)
    elif mime_type in {"audio/wav", "audio/x-wav"}:
        valid = data.startswith(b"RIFF") and data[8:12] == b"WAVE"
    elif mime_type in {"audio/ogg", "video/ogg"}:
        valid = data.startswith(b"OggS")
    elif mime_type.startswith("text/") or mime_type in {"application/json"}:
        try:
            data.decode("utf-8")
            valid = b"\x00" not in data
        except UnicodeDecodeError:
            valid = False
    if not valid:
        raise HTTPException(status_code=415, detail="Le contenu ne correspond pas au type MIME déclaré")


def _target_path(settings: Settings, user_id: uuid.UUID, category: str, stored_name: str) -> tuple[Path, str]:
    root = ensure_user_directories(settings.users_root, user_id)
    target = (root / category / stored_name).resolve()
    if root not in target.parents:
        raise HTTPException(status_code=400, detail="Chemin de fichier invalide")
    relative = target.relative_to(root).as_posix()
    return target, relative


def resolve_user_file(settings: Settings, user_id: uuid.UUID, relative_path: str) -> Path:
    root = (settings.users_root / str(user_id)).resolve()
    target = (root / relative_path).resolve()
    if root not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    return target


def generate_thumbnail(
    settings: Settings, user: User, record: StoredFile, source: Path, backup_bytes: int = 0
) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg or not record.mime_type.startswith(("image/", "video/")):
        return
    root = (settings.users_root / str(user.id)).resolve()
    target = (root / "thumbnails" / f"{record.id}.jpg").resolve()
    if root not in target.parents:
        raise HTTPException(status_code=400, detail="Chemin de miniature invalide")
    command = [
        ffmpeg,
        "-nostdin",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(source),
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-2",
        str(target),
    ]
    try:
        subprocess.run(  # noqa: S603 - arguments séparés, binaire résolu et chemins validés
            command, check=True, timeout=45, capture_output=True
        )
    except (OSError, subprocess.SubprocessError):
        target.unlink(missing_ok=True)
        return
    thumbnail_size = target.stat().st_size
    if user.storage_used_bytes + backup_bytes + thumbnail_size > user.storage_quota_bytes:
        target.unlink(missing_ok=True)
        return
    record.thumbnail_relative_path = target.relative_to(root).as_posix()
    user.storage_used_bytes += thumbnail_size


def _check_quota(user: User, settings: Settings, size: int, backup_bytes: int = 0) -> None:
    if size > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux")
    if user.storage_used_bytes + backup_bytes + size > user.storage_quota_bytes:
        raise HTTPException(status_code=413, detail="Quota de stockage dépassé")


def store_stream(
    db: Session,
    settings: Settings,
    user: User,
    source: BinaryIO,
    *,
    original_name: str,
    mime_type: str,
) -> StoredFile:
    extension = validate_mime_and_extension(original_name, mime_type)
    category = category_for_mime(mime_type)
    stored_name = f"{uuid.uuid4().hex}{extension}"
    target, relative = _target_path(settings, user.id, category, stored_name)
    digest = hashlib.sha256()
    size = 0
    quota = db.scalar(select(UserQuota).where(UserQuota.user_id == user.id))
    backup_bytes = quota.used_backups_bytes if quota else 0
    try:
        with target.open("xb") as destination:
            first_chunk = source.read(1024 * 1024)
            if not first_chunk:
                raise HTTPException(status_code=422, detail="Le fichier est vide")
            validate_content_signature(first_chunk[:8192], mime_type)
            size += len(first_chunk)
            _check_quota(user, settings, size, backup_bytes)
            digest.update(first_chunk)
            destination.write(first_chunk)
            while chunk := source.read(1024 * 1024):
                size += len(chunk)
                _check_quota(user, settings, size, backup_bytes)
                digest.update(chunk)
                destination.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    record = StoredFile(
        user_id=user.id,
        original_name=Path(original_name).name[:500],
        stored_name=stored_name,
        relative_path=relative,
        mime_type=mime_type,
        size_bytes=size,
        checksum=digest.hexdigest(),
        category=category,
    )
    user.storage_used_bytes += size
    db.add(record)
    db.flush()
    generate_thumbnail(settings, user, record, target, backup_bytes)
    return record


def store_upload(db: Session, settings: Settings, user: User, upload: UploadFile) -> StoredFile:
    return store_stream(
        db,
        settings,
        user,
        upload.file,
        original_name=upload.filename or "fichier.bin",
        mime_type=(upload.content_type or "application/octet-stream").lower(),
    )


def store_data_url(db: Session, settings: Settings, user: User, value: str) -> StoredFile | None:
    match = DATA_URL_RE.match(value)
    if not match:
        return None
    mime_type = (match.group(1) or "application/octet-stream").lower()
    # Le registre MIME minimal des images Linux ne connaît pas toujours les
    # formats Office et renvoie alors .bin, bien que leur type soit autorisé.
    extension = MIME_EXTENSION_OVERRIDES.get(mime_type) or mimetypes.guess_extension(mime_type) or ".bin"
    if extension == ".jpe":
        extension = ".jpg"
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Fichier local encodé invalide") from exc
    from io import BytesIO

    return store_stream(
        db,
        settings,
        user,
        BytesIO(raw),
        original_name=f"fichier-importe{extension}",
        mime_type=mime_type,
    )


def iter_file_range(path: Path, start: int, end: int, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
    remaining = end - start + 1
    with path.open("rb") as handle:
        handle.seek(start)
        while remaining > 0:
            chunk = handle.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk
