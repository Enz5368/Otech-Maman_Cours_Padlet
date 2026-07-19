from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from ..models import AuditLog


def record_audit(
    db: Session,
    action: str,
    *,
    user_id: uuid.UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            details=details or {},
        )
    )
