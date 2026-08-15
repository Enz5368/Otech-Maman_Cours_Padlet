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

if [ "$#" -ne 2 ] || [ "$2" != "--confirm" ]; then
  echo "Usage : $0 /mnt/DriveMaison/Backups/global/<date> --confirm" >&2
  exit 2
fi

TARGET="$(realpath "$1")"
ROOT="$(realpath "${BACKUPS_DATA_PATH:-/mnt/DriveMaison/Backups}")"
USERS="${USERS_DATA_PATH:-/mnt/DriveMaison/Users}"
case "$TARGET" in "$ROOT"/global/*) ;; *) echo "Chemin de sauvegarde refusé" >&2; exit 2 ;; esac

test -f "$TARGET/postgres.dump"
test -f "$TARGET/users.tar.gz"
(cd "$TARGET" && sha256sum -c SHA256SUMS)

docker_cmd compose stop backend nginx
docker_cmd compose exec -T postgres dropdb -U "${POSTGRES_USER:-monespaceprof}" --if-exists "${POSTGRES_DB:-monespaceprof}"
docker_cmd compose exec -T postgres createdb -U "${POSTGRES_USER:-monespaceprof}" "${POSTGRES_DB:-monespaceprof}"
docker_cmd compose exec -T postgres pg_restore -U "${POSTGRES_USER:-monespaceprof}" -d "${POSTGRES_DB:-monespaceprof}" --clean --if-exists < "$TARGET/postgres.dump"
tar -C "$USERS" -xzf "$TARGET/users.tar.gz"
docker_cmd compose up -d backend nginx
echo "Restauration terminée depuis $TARGET"

