from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from .database import Base

JsonType = JSON().with_variant(JSONB(), "postgresql")


def now_utc() -> datetime:
    return datetime.now(UTC)


class UUIDTimestampMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


class OwnedMixin(UUIDTimestampMixin):
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)


class User(UUIDTimestampMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(80), unique=True)
    username_normalized: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    role: Mapped[str] = mapped_column(String(30), default="teacher")
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    storage_quota_bytes: Mapped[int] = mapped_column(BigInteger, default=10_737_418_240)
    storage_used_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ServerSession(UUIDTimestampMixin, Base):
    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)


class UserSettings(OwnedMixin, Base):
    __tablename__ = "user_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_settings_user"),)

    settings_json: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)


class UserQuota(OwnedMixin, Base):
    __tablename__ = "user_quotas"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_quotas_user"),)

    max_bytes: Mapped[int] = mapped_column(BigInteger)
    max_file_bytes: Mapped[int] = mapped_column(BigInteger)
    used_images_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    used_videos_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    used_audio_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    used_documents_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    used_backups_bytes: Mapped[int] = mapped_column(BigInteger, default=0)


class UserWorkspace(OwnedMixin, Base):
    __tablename__ = "user_workspaces"
    __table_args__ = (UniqueConstraint("user_id", name="uq_user_workspaces_user"),)

    schema_version: Mapped[int] = mapped_column(Integer, default=2)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)


class Level(OwnedMixin, Base):
    __tablename__ = "levels"
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(120), default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    legacy_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class CourseSequence(OwnedMixin, Base):
    __tablename__ = "sequences"
    level_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("levels.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    final_task: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    legacy_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Lesson(OwnedMixin, Base):
    __tablename__ = "lessons"
    sequence_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("sequences.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    legacy_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Activity(OwnedMixin, Base):
    __tablename__ = "activities"
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("lessons.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    objective: Mapped[str] = mapped_column(Text, default="")
    instruction: Mapped[str] = mapped_column(Text, default="")
    estimated_duration: Mapped[str] = mapped_column(String(80), default="")
    modality: Mapped[str] = mapped_column(String(80), default="")
    level_label: Mapped[str] = mapped_column(String(120), default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    legacy_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Presentation(OwnedMixin, Base):
    __tablename__ = "presentations"
    activity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("activities.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    private_notes: Mapped[str] = mapped_column(Text, default="")
    theme: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    position: Mapped[int] = mapped_column(Integer, default=0)


class Slide(OwnedMixin, Base):
    __tablename__ = "slides"
    presentation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("presentations.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)
    background: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    transition: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    notes: Mapped[str] = mapped_column(Text, default="")
    legacy_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class SlideElement(OwnedMixin, Base):
    __tablename__ = "slide_elements"
    slide_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("slides.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(50))
    x: Mapped[float] = mapped_column(default=0)
    y: Mapped[float] = mapped_column(default=0)
    width: Mapped[float] = mapped_column(default=0)
    height: Mapped[float] = mapped_column(default=0)
    rotation: Mapped[float] = mapped_column(default=0)
    z_index: Mapped[int] = mapped_column(Integer, default=0)
    locked: Mapped[bool] = mapped_column(Boolean, default=False)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    content_json: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    style_json: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    animation_json: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)


class Resource(OwnedMixin, Base):
    __tablename__ = "resources"
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("activities.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    type: Mapped[str] = mapped_column(String(50), default="DOCUMENT")
    category: Mapped[str] = mapped_column(String(100), default="Documents")
    url: Mapped[str] = mapped_column(Text, default="")
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("files.id", ondelete="SET NULL"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)


class StoredFile(OwnedMixin, Base):
    __tablename__ = "files"
    original_name: Mapped[str] = mapped_column(String(500))
    stored_name: Mapped[str] = mapped_column(String(120))
    relative_path: Mapped[str] = mapped_column(String(1000))
    mime_type: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    checksum: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str] = mapped_column(String(50))
    thumbnail_relative_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ClassGroup(OwnedMixin, Base):
    __tablename__ = "class_groups"
    name: Mapped[str] = mapped_column(String(255))
    school_year: Mapped[str] = mapped_column(String(30), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    legacy_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Student(OwnedMixin, Base):
    __tablename__ = "students"
    class_group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("class_groups.id", ondelete="CASCADE"), index=True
    )
    first_name: Mapped[str] = mapped_column(String(120), default="")
    last_name: Mapped[str] = mapped_column(String(120), default="")
    display_name: Mapped[str] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class StudentAbsence(OwnedMixin, Base):
    __tablename__ = "student_absences"
    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="CASCADE"), index=True
    )
    absent_on: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    reason: Mapped[str] = mapped_column(Text, default="")


class DrawHistory(OwnedMixin, Base):
    __tablename__ = "draw_history"
    class_group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("class_groups.id", ondelete="CASCADE"), index=True
    )
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("students.id", ondelete="SET NULL"), nullable=True
    )
    student_name: Mapped[str] = mapped_column(String(255))
    drawn_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class Timer(OwnedMixin, Base):
    __tablename__ = "timers"
    name: Mapped[str] = mapped_column(String(255), default="Chronomètre")
    state_json: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)


class SearchIndex(OwnedMixin, Base):
    __tablename__ = "search_index"
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    title: Mapped[str] = mapped_column(String(500))
    body: Mapped[str] = mapped_column(Text, default="")


class TransferRecord(OwnedMixin):
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("files.id", ondelete="SET NULL"), nullable=True
    )
    manifest: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Export(TransferRecord, Base):
    __tablename__ = "exports"


class Import(TransferRecord, Base):
    __tablename__ = "imports"
    idempotency_key: Mapped[str] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(80), default="localStorage")
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_import_user_key"),)


class Backup(TransferRecord, Base):
    __tablename__ = "backups"
    cadence: Mapped[str] = mapped_column(String(20), default="manual")
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    checksum: Mapped[str] = mapped_column(String(64), default="")


class AuditLog(UUIDTimestampMixin, Base):
    __tablename__ = "audit_logs"
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(120), index=True)
    resource_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)


class PasswordResetToken(UUIDTimestampMixin, Base):
    __tablename__ = "password_reset_tokens"
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


Index("ix_levels_user_position", Level.user_id, Level.position)
Index("ix_sequences_user_level", CourseSequence.user_id, CourseSequence.level_id)
Index("ix_lessons_user_sequence", Lesson.user_id, Lesson.sequence_id)
Index("ix_activities_user_lesson", Activity.user_id, Activity.lesson_id)
Index("ix_files_user_category", StoredFile.user_id, StoredFile.category)
