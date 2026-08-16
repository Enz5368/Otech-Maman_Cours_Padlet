from __future__ import annotations

import base64
import binascii
import hashlib
import json
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
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
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
    ".m4v",
    ".mkv",
    ".avi",
    ".wmv",
    ".flv",
    ".mpeg",
    ".mpg",
    ".3gp",
    ".ts",
    ".m2ts",
    ".mp3",
    ".wav",
    ".ogg",
    ".pdf",
    ".zip",
    ".json",
    ".pptx",
    ".docx",
    ".odt",
    ".ods",
    ".odp",
    ".txt",
    ".csv",
    ".md",
}
MIME_EXTENSION_OVERRIDES = {
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.oasis.opendocument.text": ".odt",
    "application/vnd.oasis.opendocument.spreadsheet": ".ods",
    "application/vnd.oasis.opendocument.presentation": ".odp",
}
OPENDOCUMENT_MIME_BY_EXTENSION = {
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odp": "application/vnd.oasis.opendocument.presentation",
}
VIDEO_MIME_BY_EXTENSION = {
    ".avi": "video/x-msvideo", ".mkv": "video/x-matroska", ".wmv": "video/x-ms-wmv",
    ".flv": "video/x-flv", ".m4v": "video/x-m4v", ".mpeg": "video/mpeg",
    ".mpg": "video/mpeg", ".3gp": "video/3gpp", ".ts": "video/mp2t", ".m2ts": "video/mp2t",
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
    if guessed and extension not in VIDEO_MIME_BY_EXTENSION and guessed.split("/", 1)[0] != mime_type.split("/", 1)[0]:
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
        "application/vnd.oasis.opendocument.spreadsheet",
        "application/vnd.oasis.opendocument.presentation",
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


def _video_is_browser_compatible(source: Path) -> bool:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe or source.suffix.lower() != ".mp4":
        return False
    try:
        result = subprocess.run(  # noqa: S603 - arguments séparés et chemin validé
            [ffprobe, "-v", "error", "-show_entries", "stream=codec_type,codec_name", "-of", "json", str(source)],
            check=True, timeout=30, capture_output=True, text=True,
        )
        streams = json.loads(result.stdout or "{}").get("streams", [])
        video_codecs = [item.get("codec_name") for item in streams if item.get("codec_type") == "video"]
        audio_codecs = [item.get("codec_name") for item in streams if item.get("codec_type") == "audio"]
        return video_codecs == ["h264"] and all(codec in {"aac", "mp3"} for codec in audio_codecs)
    except (OSError, subprocess.SubprocessError, ValueError, TypeError):
        return False


def _convert_video_for_browser(source: Path) -> Path:
    """Convertit une vidéo vers le profil compris par les navigateurs modernes."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise HTTPException(status_code=503, detail="Conversion vidéo indisponible sur le serveur")
    converted = source.with_name(f"{source.stem}-conversion.mp4")
    command = [
        ffmpeg, "-nostdin", "-loglevel", "error", "-y", "-i", str(source),
        "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast",
        "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", str(converted),
    ]
    try:
        subprocess.run(command, check=True, timeout=900, capture_output=True)  # noqa: S603
    except (OSError, subprocess.SubprocessError) as exc:
        converted.unlink(missing_ok=True)
        raise HTTPException(status_code=415, detail="Cette vidéo n’a pas pu être convertie en MP4 H.264") from exc
    if not converted.is_file() or converted.stat().st_size == 0:
        converted.unlink(missing_ok=True)
        raise HTTPException(status_code=415, detail="La conversion vidéo n’a produit aucun fichier lisible")
    return converted


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
    # L'ajout doit se terminer dès que le fichier original est stocké. Une
    # conversion synchrone pouvait garder l'interface bloquée jusqu'à 15 min.
    # Le lecteur déclenche déjà convert_stored_video uniquement si le navigateur
    # ne sait pas lire le format d'origine.
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
    original_name = upload.filename or "fichier.bin"
    mime_type = (upload.content_type or "application/octet-stream").lower()
    extension = Path(original_name).suffix.lower()
    if extension in OPENDOCUMENT_MIME_BY_EXTENSION:
        # Windows et certains navigateurs déclarent ces fichiers comme
        # application/octet-stream ou application/x-vnd.oasis.*.
        # L'extension est contrôlée puis la signature ZIP est vérifiée.
        mime_type = OPENDOCUMENT_MIME_BY_EXTENSION[extension]
    if extension in VIDEO_MIME_BY_EXTENSION and not mime_type.startswith("video/"):
        mime_type = VIDEO_MIME_BY_EXTENSION[extension]
    if mime_type == "application/octet-stream":
        mime_type = mimetypes.guess_type(original_name)[0] or mime_type
    return store_stream(
        db,
        settings,
        user,
        upload.file,
        original_name=original_name,
        mime_type=mime_type,
    )


def convert_stored_video(settings: Settings, user: User, record: StoredFile) -> bool:
    if not record.mime_type.startswith("video/"):
        raise HTTPException(status_code=415, detail="Ce fichier n’est pas une vidéo")
    source = resolve_user_file(settings, user.id, record.relative_path)
    converted = _convert_video_for_browser(source)
    converted_size = converted.stat().st_size
    projected_usage = user.storage_used_bytes - record.size_bytes + converted_size
    if converted_size > settings.max_upload_bytes or projected_usage > user.storage_quota_bytes:
        converted.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail="Quota insuffisant pour convertir cette vidéo")
    final_target = source.with_suffix(".mp4")
    converted.replace(final_target)
    if source != final_target:
        source.unlink(missing_ok=True)
    user.storage_used_bytes = projected_usage
    record.original_name = f"{Path(record.original_name).stem}.mp4"
    record.stored_name = final_target.name
    record.relative_path = final_target.relative_to((settings.users_root / str(user.id)).resolve()).as_posix()
    record.mime_type = "video/mp4"
    record.size_bytes = converted_size
    digest = hashlib.sha256()
    with final_target.open("rb") as converted_file:
        while chunk := converted_file.read(1024 * 1024):
            digest.update(chunk)
    record.checksum = digest.hexdigest()
    return True


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
