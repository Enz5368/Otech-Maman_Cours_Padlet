"""Teacher-owned boards, anonymous read grants, and access-checked media."""
from __future__ import annotations

import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import parse_qs, urlsplit
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, File, Header, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError

from ..config import get_settings
from ..dependencies import CsrfGuard, CurrentUser, DbDep
from ..models import Padlet, PadletAttempt, PadletGrant, PadletPost, StoredFile, User
from ..security import digest_token, hash_password, verify_password
from ..services.audit import record_audit
from ..services.storage import store_upload
from .files import file_content, owned_file

router = APIRouter(tags=["padlets"])
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TTL = 43_200
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
RASTER = {"image/png", "image/jpeg", "image/gif", "image/webp"}


class BoardInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=6, max_length=100)
    description: str = Field(default="", max_length=5000)
    layout: Literal["horizontal", "vertical"] = "vertical"
    visibility: Literal["public", "password"] = "public"
    password: str | None = Field(default=None, min_length=6, max_length=128)
    background: Literal["paper", "wine", "sea", "sage"] = "paper"
    is_published: bool = False
    is_archived: bool = False
    lesson_id: str | None = Field(default=None, max_length=255)
    revision: int | None = None

    @field_validator("title")
    @classmethod
    def valid_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Donnez un titre au Padlet.")
        return value.strip()

    @field_validator("slug")
    @classmethod
    def valid_slug(cls, value: str) -> str:
        if not SLUG.fullmatch(value):
            raise ValueError("Utilisez des lettres minuscules, des chiffres et des tirets pour le lien.")
        return value


class PostInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    id: uuid.UUID | None = None
    type: Literal["text", "image", "video", "docx", "pdf", "link", "file"]
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    instruction: str = Field(default="", max_length=5000)
    body: str = Field(default="", max_length=30000)
    external_url: str = Field(default="", max_length=2000)
    file_id: uuid.UUID | None = None
    is_visible: bool = True

    @field_validator("title")
    @classmethod
    def valid_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Donnez un titre à la ressource.")
        return value.strip()


class OrderInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[uuid.UUID] = Field(max_length=200)


class UnlockInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=128)


def embed_url(value: str) -> str:
    url = urlsplit(value)
    host = (url.hostname or "").lower()
    if url.scheme != "https" or url.username or url.password or url.port not in {None, 443}:
        raise ValueError("Adresse vidéo invalide")
    video_id = ""
    if host in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"}:
        if host == "youtu.be":
            video_id = url.path.strip("/")
        elif url.path == "/watch":
            video_id = parse_qs(url.query).get("v", [""])[0]
        else:
            video_id = re.sub(r"^/(embed|shorts)/", "", url.path)
        if re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            return f"https://www.youtube-nocookie.com/embed/{video_id}"
    if host in {"vimeo.com", "www.vimeo.com", "player.vimeo.com"}:
        video_id = url.path.rstrip("/").split("/")[-1]
        if re.fullmatch(r"[0-9]{1,15}", video_id):
            return f"https://player.vimeo.com/video/{video_id}"
    raise ValueError("Choisissez un lien YouTube ou Vimeo valide.")


def board_owned(db: DbDep, user: User, board_id: uuid.UUID) -> Padlet:
    board = db.scalar(select(Padlet).where(Padlet.id == board_id, Padlet.user_id == user.id).with_for_update())
    if not board:
        raise HTTPException(404, "Padlet introuvable")
    return board


def posts_for(db: DbDep, board: Padlet, public: bool = False) -> list[PadletPost]:
    query = select(PadletPost).where(PadletPost.padlet_id == board.id)
    if public:
        query = query.where(PadletPost.is_visible.is_(True), PadletPost.is_deleted.is_(False))
    return list(db.scalars(query.order_by(PadletPost.sort_order, PadletPost.created_at)))


def post_json(db: DbDep, board: Padlet, post: PadletPost, public: bool) -> dict:
    file = db.get(StoredFile, post.file_id) if post.file_id else None
    available = bool(file and file.user_id == board.user_id and not file.deleted_at)
    url = (f"/api/v1/public/padlets/{board.slug}/posts/{post.id}/content" if public
           else f"/api/v1/files/{file.id}/content") if available else None
    result = {"id": str(post.id), "type": post.type, "title": post.title,
              "description": post.description, "instruction": post.instruction, "body": post.body,
              "external_url": post.external_url, "sort_order": post.sort_order,
              "content_url": url, "file_name": file.original_name if available else None,
              "mime_type": file.mime_type if available else None, "size_bytes": file.size_bytes if available else None}
    if not public:
        result.update(file_id=str(post.file_id) if post.file_id else None,
                      is_visible=post.is_visible, is_deleted=post.is_deleted)
    return result


def board_json(db: DbDep, board: Padlet, public: bool = False, include_posts: bool = True) -> dict:
    result = {"id": str(board.id), "title": board.title, "slug": board.slug,
              "description": board.description, "layout": board.layout, "background": board.background,
              "visibility": board.visibility}
    if not public:
        result.update(is_published=board.is_published, is_archived=board.is_archived,
                      lesson_id=board.lesson_id, revision=board.revision, updated_at=board.updated_at,
                      has_password=bool(board.password_hash))
    if include_posts:
        result["posts"] = [post_json(db, board, post, public) for post in posts_for(db, board, public)]
    return result


def commit_board(db: DbDep, board: Padlet, action: str) -> None:
    board.updated_at = datetime.now(UTC)
    record_audit(db, action, user_id=board.user_id, resource_id=str(board.id))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Ce lien ou cette ressource existe déjà. Choisissez un autre lien.") from exc


def update_board(board: Padlet, payload: BoardInput) -> None:
    if payload.visibility == "password" and not (payload.password or board.password_hash):
        raise HTTPException(422, "Saisissez un mot de passe de 6 caractères minimum.")
    if (board.visibility != payload.visibility or board.slug != payload.slug
            or board.is_published != payload.is_published or board.is_archived != payload.is_archived
            or payload.password):
        board.access_version = (board.access_version or 1) + 1
    if payload.visibility == "public":
        board.password_hash = None
    elif payload.password:
        board.password_hash = hash_password(payload.password)
    for key, value in payload.model_dump(exclude={"password", "revision"}).items():
        setattr(board, key, value)


@router.get("/padlets")
def list_boards(user: CurrentUser, db: DbDep) -> list[dict]:
    return [board_json(db, item, include_posts=False) for item in db.scalars(
        select(Padlet).where(Padlet.user_id == user.id).order_by(Padlet.updated_at.desc()).limit(100))]


@router.post("/padlets", status_code=201)
def create_board(payload: BoardInput, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    if db.scalar(select(func.count()).select_from(Padlet).where(Padlet.user_id == user.id)) >= 100:
        raise HTTPException(422, "La limite de 100 Padlets est atteinte.")
    board = Padlet(id=uuid.uuid4(), user_id=user.id, title=payload.title, slug=payload.slug, visibility="public", access_version=1)
    update_board(board, payload)
    db.add(board)
    commit_board(db, board, "padlet.created")
    return board_json(db, board)


@router.get("/padlets/{board_id}")
def read_board(board_id: uuid.UUID, user: CurrentUser, db: DbDep) -> dict:
    return board_json(db, board_owned(db, user, board_id))


@router.put("/padlets/{board_id}")
def save_board(board_id: uuid.UUID, payload: BoardInput, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    board = board_owned(db, user, board_id)
    if payload.revision is not None and payload.revision != board.revision:
        raise HTTPException(409, "Le Padlet a changé. Rechargez-le avant de réessayer.")
    update_board(board, payload)
    board.revision += 1
    commit_board(db, board, "padlet.updated")
    return board_json(db, board)


@router.post("/padlets/{board_id}/duplicate", status_code=201)
def duplicate_board(board_id: uuid.UUID, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    source = board_owned(db, user, board_id)
    if db.scalar(select(func.count()).select_from(Padlet).where(Padlet.user_id == user.id)) >= 100:
        raise HTTPException(422, "La limite de 100 Padlets est atteinte.")
    board = Padlet(user_id=user.id, title=f"Copie — {source.title}"[:200],
                   slug=f"{source.slug[:80]}-{secrets.token_hex(6)}", description=source.description,
                   layout=source.layout, visibility=source.visibility, password_hash=source.password_hash,
                   background=source.background, lesson_id=source.lesson_id, is_published=False)
    db.add(board)
    db.flush()
    for post in posts_for(db, source):
        if not post.is_deleted:
            values = {key: getattr(post, key) for key in PostInput.model_fields if key != "id"}
            db.add(PadletPost(padlet_id=board.id, sort_order=post.sort_order, **values))
    commit_board(db, board, "padlet.duplicated")
    return board_json(db, board)


@router.delete("/padlets/{board_id}", status_code=204)
def delete_board(board_id: uuid.UUID, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> Response:
    board = board_owned(db, user, board_id)
    db.execute(delete(PadletGrant).where(PadletGrant.padlet_id == board.id))
    db.execute(delete(PadletPost).where(PadletPost.padlet_id == board.id))
    db.delete(board)
    commit_board(db, board, "padlet.deleted")
    return Response(status_code=204)


def validate_post(db: DbDep, user: User, payload: PostInput) -> None:
    if payload.external_url:
        try:
            url = urlsplit(payload.external_url)
            if url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password:
                raise ValueError("Adresse de lien invalide")
            if payload.type == "video":
                payload.external_url = embed_url(payload.external_url)
            elif payload.type != "link":
                raise ValueError("Ce type de ressource ne peut pas contenir un lien externe.")
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
    if payload.file_id:
        file = owned_file(db, user.id, payload.file_id)
        valid = ((payload.type == "image" and file.mime_type in RASTER)
                 or (payload.type == "video" and file.mime_type.startswith("video/"))
                 or (payload.type == "docx" and file.mime_type == DOCX)
                 or (payload.type == "pdf" and file.mime_type == "application/pdf")
                 or (payload.type == "file" and file.mime_type != "image/svg+xml"))
        if not valid:
            raise HTTPException(415, "Le fichier ne correspond pas au type de ressource choisi.")
        if payload.type == "docx" and file.size_bytes > 30 * 1024 * 1024:
            raise HTTPException(413, "Un Word doit peser moins de 30 Mo.")
    elif payload.type not in {"text", "link"} and not (payload.type == "video" and payload.external_url):
        raise HTTPException(422, "Ajoutez un fichier ou un lien vidéo.")
    if payload.type == "link" and not payload.external_url:
        raise HTTPException(422, "Ajoutez l’adresse du lien.")
    if payload.file_id and payload.external_url:
        raise HTTPException(422, "Choisissez un fichier ou un lien, pas les deux.")


@router.post("/padlets/{board_id}/posts", status_code=201)
def add_post(board_id: uuid.UUID, payload: PostInput, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    board = board_owned(db, user, board_id)
    if payload.id:
        existing = db.get(PadletPost, payload.id)
        if existing:
            if existing.padlet_id != board.id:
                raise HTTPException(404, "Ressource introuvable")
            return board_json(db, board)
    if len(posts_for(db, board)) >= 200:
        raise HTTPException(422, "La limite de 200 ressources est atteinte. Videz la corbeille pour continuer.")
    validate_post(db, user, payload)
    order = max((post.sort_order for post in posts_for(db, board)), default=-1) + 1
    post = PadletPost(padlet_id=board.id, sort_order=order, **payload.model_dump(exclude={"id"}))
    if payload.id:
        post.id = payload.id
    db.add(post)
    board.revision += 1
    commit_board(db, board, "padlet.post_added")
    return board_json(db, board)


def owned_post(db: DbDep, board: Padlet, post_id: uuid.UUID) -> PadletPost:
    post = db.scalar(select(PadletPost).where(PadletPost.id == post_id, PadletPost.padlet_id == board.id))
    if not post:
        raise HTTPException(404, "Ressource introuvable")
    return post


@router.put("/padlets/{board_id}/posts/{post_id}")
def edit_post(board_id: uuid.UUID, post_id: uuid.UUID, payload: PostInput,
              user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    board = board_owned(db, user, board_id)
    post = owned_post(db, board, post_id)
    validate_post(db, user, payload)
    for key, value in payload.model_dump(exclude={"id"}).items():
        setattr(post, key, value)
    board.revision += 1
    commit_board(db, board, "padlet.post_updated")
    return board_json(db, board)


@router.delete("/padlets/{board_id}/posts/{post_id}")
def trash_post(board_id: uuid.UUID, post_id: uuid.UUID, user: CurrentUser, db: DbDep, _csrf: CsrfGuard,
               permanent: bool = False) -> dict:
    board = board_owned(db, user, board_id)
    post = owned_post(db, board, post_id)
    if permanent:
        if not post.is_deleted:
            raise HTTPException(422, "Placez d’abord cette ressource dans la corbeille.")
        db.delete(post)
    else:
        post.is_deleted = True
    board.revision += 1
    commit_board(db, board, "padlet.post_trashed")
    return board_json(db, board)


@router.post("/padlets/{board_id}/posts/{post_id}/restore")
def restore_post(board_id: uuid.UUID, post_id: uuid.UUID, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    board = board_owned(db, user, board_id)
    owned_post(db, board, post_id).is_deleted = False
    board.revision += 1
    commit_board(db, board, "padlet.post_restored")
    return board_json(db, board)


@router.put("/padlets/{board_id}/order")
def order_posts(board_id: uuid.UUID, payload: OrderInput, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
    board = board_owned(db, user, board_id)
    posts = [post for post in posts_for(db, board) if not post.is_deleted]
    if len(set(payload.ids)) != len(payload.ids) or set(payload.ids) != {post.id for post in posts}:
        raise HTTPException(422, "La liste des ressources a changé. Rechargez avant de les déplacer.")
    order = {post_id: index for index, post_id in enumerate(payload.ids)}
    for post in posts:
        post.sort_order = order[post.id]
    board.revision += 1
    commit_board(db, board, "padlet.posts_ordered")
    return board_json(db, board)


@router.post("/padlets/{board_id}/files", status_code=201)
def upload_board_file(board_id: uuid.UUID, user: CurrentUser, db: DbDep, _csrf: CsrfGuard,
                      upload: Annotated[UploadFile, File()]) -> dict:
    board_owned(db, user, board_id)
    upload.file.seek(0, 2)
    size = upload.file.tell()
    upload.file.seek(0)
    limit = 30 if Path(upload.filename or "").suffix.lower() == ".docx" else 250
    if size > limit * 1024 * 1024:
        raise HTTPException(413, f"La limite pour ce fichier est de {limit} Mo.")
    if Path(upload.filename or "").suffix.lower() == ".svg":
        raise HTTPException(415, "Choisissez une image PNG, JPEG, GIF ou WebP.")
    if Path(upload.filename or "").suffix.lower() == ".docx":
        try:
            with ZipFile(upload.file) as archive:
                members = archive.infolist()
                if ('word/document.xml' not in archive.namelist() or len(members) > 2500
                        or sum(item.file_size for item in members) > 100 * 1024 * 1024
                        or any(item.flag_bits & 1 or '..' in Path(item.filename).parts
                               or item.filename.startswith(('/', '\\'))
                               or 'vbaproject' in item.filename.lower() for item in members)):
                    raise HTTPException(415, "Ce Word est invalide, chiffré ou trop volumineux une fois ouvert.")
        except BadZipFile as exc:
            raise HTTPException(415, "Ce fichier n’est pas un document Word .docx valide.") from exc
        finally:
            upload.file.seek(0)
    file = store_upload(db, get_settings(), user, upload)
    db.commit()
    return {"id": str(file.id), "original_name": file.original_name, "mime_type": file.mime_type,
            "content_url": f"/api/v1/files/{file.id}/content"}


def public_board(db: DbDep, slug: str) -> Padlet:
    board = db.scalar(select(Padlet).join(User, Padlet.user_id == User.id).where(
        Padlet.slug == slug, Padlet.is_published.is_(True), Padlet.is_archived.is_(False), User.status == "active"))
    if not board:
        raise HTTPException(404, "Ce Padlet est indisponible, archivé ou non publié.")
    return board


def public_access(db: DbDep, request: Request, board: Padlet) -> None:
    if board.visibility == "public":
        return
    raw = request.cookies.get(f"mep_padlet_{board.id.hex}", "")
    grant = db.scalar(select(PadletGrant).where(
        PadletGrant.padlet_id == board.id, PadletGrant.token_hash == digest_token(raw),
        PadletGrant.access_version == board.access_version, PadletGrant.expires_at > datetime.now(UTC))) if raw else None
    if not grant:
        raise HTTPException(401, "Saisissez le mot de passe pour accéder au Padlet.")


def same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if request.headers.get("sec-fetch-site") == "cross-site" or (origin and origin not in {
            get_settings().public_base_url.rstrip("/"), *get_settings().allowed_origins}):
        raise HTTPException(403, "Origine non autorisée")


@router.get("/public/padlets/{slug}")
def public_read(slug: str, request: Request, response: Response, db: DbDep) -> dict:
    board = public_board(db, slug)
    public_access(db, request, board)
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    return board_json(db, board, public=True)


@router.post("/public/padlets/{slug}/unlock")
def public_unlock(slug: str, payload: UnlockInput, request: Request, response: Response, db: DbDep) -> dict:
    same_origin(request)
    # Shared database counters survive restarts and apply across all workers.
    now = datetime.now(UTC)
    db.execute(delete(PadletAttempt).where(PadletAttempt.started_at < now - timedelta(days=1)))
    db.execute(delete(PadletGrant).where(PadletGrant.expires_at < now))
    ip = request.client.host if request.client else "unknown"
    for scope, limit in ((f"ip:{ip}", 40), (f"board:{ip}:{slug}", 8)):
        key = digest_token(scope)
        # A primary-key upsert first makes concurrent attempts serialize on the bucket.
        dialect = db.bind.dialect.name
        if dialect == "postgresql":
            from sqlalchemy.dialects.postgresql import insert
        else:
            from sqlalchemy.dialects.sqlite import insert
        db.execute(insert(PadletAttempt).values(key=key, count=0, started_at=now).on_conflict_do_nothing())
        attempt = db.scalar(select(PadletAttempt).where(PadletAttempt.key == key).with_for_update())
        started = attempt.started_at.replace(tzinfo=UTC) if attempt.started_at.tzinfo is None else attempt.started_at
        if started < now - timedelta(minutes=15):
            attempt.count, attempt.started_at = 0, now
        if attempt.count >= limit:
            db.commit()
            raise HTTPException(429, "Trop de tentatives. Réessayez dans 15 minutes.", headers={"Retry-After": "900"})
        attempt.count += 1
    db.commit()
    board = db.scalar(select(Padlet).where(Padlet.slug == slug, Padlet.is_published.is_(True), Padlet.is_archived.is_(False)))
    if not board or not board.password_hash or not verify_password(board.password_hash, payload.password):
        raise HTTPException(401, "Lien ou mot de passe incorrect.")
    public_board(db, slug)
    # Successful classroom visits must not exhaust the attempts of pupils sharing an IP.
    db.execute(update(PadletAttempt).where(PadletAttempt.key == digest_token(f"board:{ip}:{slug}")).values(count=0))
    db.execute(update(PadletAttempt).where(PadletAttempt.key == digest_token(f"ip:{ip}"), PadletAttempt.count > 0)
               .values(count=PadletAttempt.count - 1))
    raw = secrets.token_urlsafe(48)
    db.add(PadletGrant(padlet_id=board.id, token_hash=digest_token(raw), access_version=board.access_version,
                       expires_at=now + timedelta(seconds=TTL)))
    db.commit()
    response.set_cookie(f"mep_padlet_{board.id.hex}", raw, max_age=TTL, httponly=True,
                        secure=get_settings().cookie_secure, samesite="strict", path=f"/api/v1/public/padlets/{slug}")
    return {"unlocked": True}


@router.post("/public/padlets/{slug}/lock", status_code=204)
def public_lock(slug: str, request: Request, response: Response, db: DbDep) -> None:
    same_origin(request)
    board = db.scalar(select(Padlet).where(Padlet.slug == slug))
    if board:
        raw = request.cookies.get(f"mep_padlet_{board.id.hex}", "")
        db.execute(delete(PadletGrant).where(PadletGrant.padlet_id == board.id, PadletGrant.token_hash == digest_token(raw)))
        db.commit()
        response.delete_cookie(f"mep_padlet_{board.id.hex}", path=f"/api/v1/public/padlets/{slug}")


@router.get("/public/padlets/{slug}/posts/{post_id}/content")
def public_file(slug: str, post_id: uuid.UUID, request: Request, db: DbDep,
                range_header: str | None = Header(default=None, alias="Range"), download: bool = False):
    board = public_board(db, slug)
    public_access(db, request, board)
    post = owned_post(db, board, post_id)
    if post.is_deleted or not post.is_visible or not post.file_id:
        raise HTTPException(404, "Ressource indisponible")
    file = owned_file(db, board.user_id, post.file_id)
    result = file_content(file.id, db.get(User, board.user_id), db, range_header)
    result.headers["Cache-Control"] = "private, no-store"
    result.headers["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    if download or (file.mime_type not in RASTER | {"application/pdf"} and not file.mime_type.startswith(("video/", "audio/"))):
        result.headers["Content-Disposition"] = result.headers["Content-Disposition"].replace("inline;", "attachment;", 1)
    return result
