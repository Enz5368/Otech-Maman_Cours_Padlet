from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .security import normalize_username


class AuthCredentials(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=2, max_length=256)
    auto_register: bool = True

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        if not normalize_username(value):
            raise ValueError("Identifiant invalide")
        return value.strip()


class RegisterRequest(AuthCredentials):
    auto_register: bool = False
    email: str | None = Field(default=None, max_length=320)
    display_name: str | None = Field(default=None, max_length=160)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=2, max_length=256)
    new_password: str = Field(min_length=10, max_length=256)
    revoke_other_sessions: bool = True


class ForgotPasswordRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    new_password: str = Field(min_length=10, max_length=256)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str | None
    display_name: str | None
    role: str
    status: str
    must_change_password: bool
    storage_quota_bytes: int
    storage_used_bytes: int
    created_at: datetime


class WorkspaceRead(BaseModel):
    schema_version: int
    revision: int
    content: dict[str, Any]
    updated_at: datetime | None = None


class WorkspaceWrite(BaseModel):
    schema_version: int = 2
    expected_revision: int | None = None
    content: dict[str, Any]


class MigrationImportRequest(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=120)
    source: str = Field(default="localStorage", max_length=80)
    storage_key: str = Field(max_length=255)
    content: dict[str, Any]
    client_counts: dict[str, int] = Field(default_factory=dict)


class GenericWrite(BaseModel):
    data: dict[str, Any]


class SettingsWrite(BaseModel):
    settings: dict[str, Any]


class AdminPasswordResetRequest(BaseModel):
    temporary_password: str = Field(min_length=10, max_length=256)


class AdminQuotaRequest(BaseModel):
    quota_bytes: int = Field(ge=0)
