#!/bin/sh
set -eu

if docker info >/dev/null 2>&1; then
    docker_cmd() { docker "$@"; }
elif sudo -n /usr/bin/docker info >/dev/null 2>&1; then
    docker_cmd() { sudo -n /usr/bin/docker "$@"; }
else
    echo "Accès Docker refusé : autorisez /usr/bin/docker via sudo sans mot de passe." >&2
    exit 1
fi

ROOT="${BACKUPS_DATA_PATH:-/mnt/DriveMaison/Backups}"
USERS="${USERS_DATA_PATH:-/mnt/DriveMaison/Users}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

test -d "$ROOT" || { echo "Racine de sauvegarde introuvable : $ROOT" >&2; exit 2; }
test -d "$USERS" || { echo "Racine utilisateurs introuvable : $USERS" >&2; exit 2; }
ROOT="$(realpath "$ROOT")"
USERS="$(realpath "$USERS")"
case "$ROOT" in /mnt/DriveMaison/Backups|/mnt/DriveMaison/Backups/*) ;; *) echo "Racine de sauvegarde refusée" >&2; exit 2 ;; esac
case "$USERS" in /mnt/DriveMaison/Users|/mnt/DriveMaison/Users/*) ;; *) echo "Racine utilisateurs refusée" >&2; exit 2 ;; esac
TARGET="$ROOT/global/$STAMP"
TARGET_REL="global/$STAMP"
GIT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"

# Le conteneur écrit les sauvegardes avec les droits Docker. Le compte SSH de
# déploiement n'a donc pas besoin de modifier les ACL des datasets TrueNAS.
docker_cmd run --rm -v "$ROOT:/backups" postgres:17-alpine \
    sh -eu -c 'mkdir -p "/backups/$1"' sh "$TARGET_REL"

docker_cmd compose exec -T postgres \
    pg_dump -U "${POSTGRES_USER:-monespaceprof}" -d "${POSTGRES_DB:-monespaceprof}" -Fc |
    docker_cmd run --rm -i -v "$ROOT:/backups" postgres:17-alpine \
        sh -eu -c 'cat > "/backups/$1/postgres.dump"; test -s "/backups/$1/postgres.dump"' sh "$TARGET_REL"

docker_cmd run --rm -v "$ROOT:/backups" -v "$USERS:/users:ro" postgres:17-alpine \
    sh -eu -c 'tar -C /users -czf "/backups/$1/users.tar.gz" .' sh "$TARGET_REL"

docker_cmd run --rm -v "$ROOT:/backups" postgres:17-alpine \
    sh -eu -c '
        cd "/backups/$1"
        sha256sum postgres.dump users.tar.gz > SHA256SUMS
        {
            echo "application=MonEspaceProf"
            echo "created_at=$2"
            echo "schema_version=001_initial_schema.sql"
            echo "git_commit=$3"
        } > manifest.txt
    ' sh "$TARGET_REL" "$STAMP" "$GIT_COMMIT"

# Conservation globale : 30 instantanés. Les politiques ZFS restent administrées par TrueNAS.
docker_cmd run --rm -v "$ROOT:/backups" postgres:17-alpine \
    sh -eu -c '
        count=0
        for path in $(ls -1dt /backups/global/* 2>/dev/null || true); do
            count=$((count + 1))
            if [ "$count" -gt 30 ]; then
                rm -rf -- "$path"
            fi
        done
    '
echo "Sauvegarde créée : $TARGET"
