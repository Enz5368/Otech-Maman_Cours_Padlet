from __future__ import annotations

import hashlib
import json
import time
from datetime import UTC, datetime

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import Backup, User, UserQuota, UserWorkspace
from app.services.accounts import ensure_user_directories

RETENTION = {"daily": 30, "weekly": 12, "monthly": 24}


def due_cadences(now: datetime) -> tuple[str, ...]:
    cadences = ["daily"]
    if now.weekday() == 6:
        cadences.append("weekly")
    if now.day == 1:
        cadences.append("monthly")
    return tuple(cadences)


def clean_temporary_files(root) -> None:
    cutoff = time.time() - 86_400
    temp_root = (root / "temp").resolve()
    if root not in temp_root.parents:
        raise RuntimeError("Chemin temporaire invalide")
    for path in temp_root.rglob("*"):
        if path.is_file() and path.stat().st_mtime < cutoff:
            path.unlink()


def prune_backups(db, user: User, root) -> None:
    for cadence, keep in RETENTION.items():
        records = db.scalars(
            select(Backup)
            .where(Backup.user_id == user.id, Backup.cadence == cadence, Backup.status == "completed")
            .order_by(Backup.created_at.desc())
        ).all()
        for record in records[keep:]:
            relative = record.manifest.get("relative_path")
            if relative:
                path = (root / relative).resolve()
                if root in path.parents:
                    path.unlink(missing_ok=True)
            db.delete(record)


def main() -> None:
    settings = get_settings()
    now = datetime.now(UTC)
    date_key = now.date().isoformat()
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.status == "active")).all()
        for user in users:
            workspace = db.scalar(select(UserWorkspace).where(UserWorkspace.user_id == user.id))
            if not workspace:
                continue
            root = ensure_user_directories(settings.users_root, user.id)
            clean_temporary_files(root)
            for cadence in due_cadences(now):
                existing = db.scalars(
                    select(Backup).where(Backup.user_id == user.id, Backup.cadence == cadence)
                ).all()
                if any(item.manifest.get("date") == date_key and item.status == "completed" for item in existing):
                    continue
                payload = json.dumps(
                    {
                        "application": "MonEspaceProf",
                        "app_version": settings.app_version,
                        "schema_version": workspace.schema_version,
                        "revision": workspace.revision,
                        "created_at": now.isoformat(),
                        "content": workspace.content,
                    },
                    ensure_ascii=False,
                    indent=2,
                ).encode("utf-8")
                target = (root / "backups" / cadence / f"backup-{date_key}.json").resolve()
                if root not in target.parents:
                    raise RuntimeError("Chemin de sauvegarde utilisateur invalide")
                target.write_bytes(payload)
                checksum = hashlib.sha256(payload).hexdigest()
                db.add(
                    Backup(
                        user_id=user.id,
                        status="completed",
                        cadence=cadence,
                        schema_version=workspace.schema_version,
                        checksum=checksum,
                        completed_at=now,
                        manifest={
                            "date": date_key,
                            "relative_path": target.relative_to(root).as_posix(),
                            "revision": workspace.revision,
                        },
                    )
                )
            db.flush()
            prune_backups(db, user, root)
            quota = db.scalar(select(UserQuota).where(UserQuota.user_id == user.id))
            if quota:
                backups_root = root / "backups"
                quota.used_backups_bytes = sum(
                    path.stat().st_size for path in backups_root.rglob("*") if path.is_file()
                )
        db.commit()


if __name__ == "__main__":
    main()
