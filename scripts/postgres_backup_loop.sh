#!/bin/sh
set -eu

ROOT="${BACKUPS_CONTAINER_PATH:-/backups}/postgres"
mkdir -p "$ROOT"

while true; do
  STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
  TARGET="$ROOT/postgres-$STAMP.dump"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$TARGET"
  sha256sum "$TARGET" > "$TARGET.sha256"
  find "$ROOT" -type f -mtime +30 -name 'postgres-*.dump*' -delete
  sleep 86400
done

