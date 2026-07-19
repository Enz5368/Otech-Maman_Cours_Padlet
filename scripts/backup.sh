#!/bin/sh
set -eu

ROOT="${BACKUPS_DATA_PATH:-/mnt/DriveMaison/Backups}"
USERS="${USERS_DATA_PATH:-/mnt/DriveMaison/Users}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$ROOT/global/$STAMP"

mkdir -p "$ROOT" "$USERS"
ROOT="$(realpath "$ROOT")"
USERS="$(realpath "$USERS")"
case "$ROOT" in /mnt/DriveMaison/Backups|/mnt/DriveMaison/Backups/*) ;; *) echo "Racine de sauvegarde refusée" >&2; exit 2 ;; esac
case "$USERS" in /mnt/DriveMaison/Users|/mnt/DriveMaison/Users/*) ;; *) echo "Racine utilisateurs refusée" >&2; exit 2 ;; esac
TARGET="$ROOT/global/$STAMP"
mkdir -p "$TARGET"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-monespaceprof}" -d "${POSTGRES_DB:-monespaceprof}" -Fc > "$TARGET/postgres.dump"
tar -C "$USERS" -czf "$TARGET/users.tar.gz" .
sha256sum "$TARGET/postgres.dump" "$TARGET/users.tar.gz" > "$TARGET/SHA256SUMS"
cat > "$TARGET/manifest.txt" <<EOF
application=MonEspaceProf
created_at=$STAMP
schema_version=001_initial_schema.sql
git_commit=$(git rev-parse HEAD 2>/dev/null || echo unknown)
EOF

# Conservation globale : 30 instantanés. Les politiques ZFS restent administrées par TrueNAS.
find "$ROOT/global" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | awk 'NR>30 {print $2}' | xargs -r rm -rf --
echo "Sauvegarde créée : $TARGET"
