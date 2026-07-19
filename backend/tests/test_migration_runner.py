from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATE_PATH = ROOT / "backend" / "scripts" / "migrate.py"


def load_migration_runner():
    spec = importlib.util.spec_from_file_location("migration_runner", MIGRATE_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_sqlalchemy_psycopg_url_is_converted_for_native_driver() -> None:
    runner = load_migration_runner()
    source = "postgresql+psycopg://user:secret@postgres:5432/monespaceprof"

    assert runner.psycopg_connection_url(source) == (
        "postgresql://user:secret@postgres:5432/monespaceprof"
    )


def test_native_postgresql_url_is_unchanged() -> None:
    runner = load_migration_runner()
    source = "postgresql://user:secret@postgres:5432/monespaceprof"

    assert runner.psycopg_connection_url(source) == source
