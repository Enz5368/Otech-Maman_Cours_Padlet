from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_root_bootstrap_uses_argon2_and_forces_password_change() -> None:
    migration = (ROOT / "backend" / "migrations" / "002_bootstrap_root.sql").read_text(encoding="utf-8")
    assert "'$argon2id$" in migration
    assert "'admin'" in migration
    assert "true" in migration
    assert "'root',\n            'root'" in migration
    assert "VALUES ('root', 'root')" not in migration
