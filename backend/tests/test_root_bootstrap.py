from __future__ import annotations

from pathlib import Path

from app.security import verify_password

ROOT = Path(__file__).resolve().parents[2]


def test_root_bootstrap_uses_argon2() -> None:
    migration = (ROOT / "backend" / "migrations" / "002_bootstrap_root.sql").read_text(encoding="utf-8")
    assert "'$argon2id$" in migration
    assert "'admin'" in migration
    assert "true" in migration
    assert "'root',\n            'root'" in migration
    assert "VALUES ('root', 'root')" not in migration


def test_rose_bootstrap_creates_requested_temporary_access() -> None:
    migration = (ROOT / "backend" / "migrations" / "003_bootstrap_rose.sql").read_text(encoding="utf-8")
    password_hash = next(part for part in migration.split("'") if part.startswith("$argon2id$"))

    assert "'rose'" in migration
    assert "'teacher'" in migration
    assert "must_change_password = false" in migration
    assert verify_password(password_hash, "it")


def test_password_change_is_made_optional_for_existing_accounts() -> None:
    migration = (ROOT / "backend" / "migrations" / "004_make_password_change_optional.sql").read_text(
        encoding="utf-8"
    )
    assert "UPDATE users SET must_change_password = false" in migration
