from pathlib import Path


def test_deirdre_account_migration_is_idempotent_and_hashed() -> None:
    migration = (
        Path(__file__).resolve().parents[1] / "migrations" / "005_bootstrap_deirdre_ann_vogt.sql"
    ).read_text(encoding="utf-8")

    assert "Deirdre-Ann Vogt" in migration
    assert "deirdre-annvogt" in migration
    assert "$argon2id$" in migration
    assert "IF account_user_id IS NULL" in migration
    assert "'mdp'" not in migration
