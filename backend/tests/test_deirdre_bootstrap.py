from pathlib import Path

from app.security import verify_password


def test_deirdre_account_migration_is_idempotent_and_hashed() -> None:
    migration = (
        Path(__file__).resolve().parents[1] / "migrations" / "005_bootstrap_deirdre_ann_vogt.sql"
    ).read_text(encoding="utf-8")

    assert "Deirdre-Ann Vogt" in migration
    assert "deirdre-annvogt" in migration
    assert "$argon2id$" in migration
    assert "IF account_user_id IS NULL" in migration
    assert "'mdp'" not in migration


def test_deirdre_password_reset_uses_the_requested_password() -> None:
    migration = (
        Path(__file__).resolve().parents[1]
        / "migrations"
        / "006_reset_deirdre_ann_vogt_password.sql"
    ).read_text(encoding="utf-8")

    password_hash = next(part for part in migration.split("'") if part.startswith("$argon2id$"))
    assert "username_normalized = 'deirdre-annvogt'" in migration
    assert "must_change_password = false" in migration
    assert verify_password(password_hash, "aaa")
