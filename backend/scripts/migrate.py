from __future__ import annotations

import os
from pathlib import Path

import psycopg


def psycopg_connection_url(database_url: str) -> str:
    """Convert SQLAlchemy's explicit psycopg URL to a native psycopg URL."""
    sqlalchemy_prefix = "postgresql+psycopg://"
    if database_url.startswith(sqlalchemy_prefix):
        return f"postgresql://{database_url.removeprefix(sqlalchemy_prefix)}"
    return database_url


def main() -> None:
    database_url = os.environ.get("MEP_DATABASE_URL")
    if not database_url:
        raise SystemExit("MEP_DATABASE_URL est obligatoire")
    migrations_dir = Path(__file__).resolve().parents[1] / "migrations"
    with psycopg.connect(psycopg_connection_url(database_url)) as connection:
        connection.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        applied = {row[0] for row in connection.execute("SELECT version FROM schema_migrations")}
        for path in sorted(migrations_dir.glob("*.sql")):
            if path.name in applied:
                continue
            print(f"Application de {path.name}")
            with connection.transaction():
                connection.execute(path.read_text(encoding="utf-8"))
                connection.execute("INSERT INTO schema_migrations(version) VALUES (%s)", (path.name,))
        connection.commit()


if __name__ == "__main__":
    main()

