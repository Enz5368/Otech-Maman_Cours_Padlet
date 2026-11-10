#!/bin/sh
set -eu
REPO="/mnt/DriveMaison/Database/deploy/apps/Otech-Maman_Cours_Padlet"
cd "$REPO"
if docker info >/dev/null 2>&1; then
  docker_cmd() { docker "$@"; }
elif sudo -n /usr/bin/docker info >/dev/null 2>&1; then
  docker_cmd() { sudo -n /usr/bin/docker "$@"; }
else
  echo "Le compte de déploiement doit accéder à Docker directement ou via sudo sans mot de passe (/usr/bin/docker)." >&2
  exit 1
fi
# Keep a detached deployment alive across SSH/tunnel reconnects.
exec 9>"$REPO/.git/mep-deploy.lock"
flock -w 1200 9
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
if test -f .git/mep-last-deployed-commit; then
  PREVIOUS_COMMIT="$(cat .git/mep-last-deployed-commit)"
fi
PREVIOUS_COMPOSE=0
test -f docker-compose.yml && PREVIOUS_COMPOSE=1

rollback() {
  FAILURE_CODE=$?
  trap - 0
  if [ "$FAILURE_CODE" -eq 0 ]; then
    return 0
  fi
  set +e
  echo "Échec du déploiement, retour au code $PREVIOUS_COMMIT"
  if test -f docker-compose.yml; then
    echo "Journaux du backend avant rollback :"
    docker_cmd compose logs --no-color --tail 200 backend || true
    docker_cmd compose down || true
  fi
  git reset --hard "$PREVIOUS_COMMIT"
  if [ "$PREVIOUS_COMPOSE" -eq 1 ]; then
    docker_cmd compose build backend scheduler
    docker_cmd compose build --no-cache frontend
    docker_cmd compose up -d --force-recreate
  else
    echo "Ancienne version statique conservée ; redémarrer son service Nginx si le basculement initial l'avait arrêté."
  fi
  exit "$FAILURE_CODE"
}
trap rollback 0

test -f .env
git fetch --no-tags origin "$EXPECTED_COMMIT"
echo "[1/5] Sauvegarde de la base"
if [ "$PREVIOUS_COMPOSE" -eq 1 ] && docker_cmd compose ps --status running --services | grep -q postgres; then
  git show "$EXPECTED_COMMIT:scripts/backup.sh" | sh
else
  echo "Premier déploiement : aucune base existante à sauvegarder."
fi

echo "[2/5] Récupération du commit $EXPECTED_COMMIT"
git reset --hard "$EXPECTED_COMMIT"
test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"
EXPECTED_INDEX_HASH="$(sha256sum index.html | awk '{print $1}')"
echo "[3/5] Construction des images"
docker_cmd compose config --quiet
docker_cmd compose build backend scheduler
docker_cmd compose build --no-cache frontend
echo "Préparation des répertoires de données pour le backend"
docker_cmd compose run --rm --no-deps --user 0:0 --entrypoint sh backend -c '
  mkdir -p /data/users /data/backups /data/logs
  chown 10001:10001 /data/users /data/backups /data/logs
  chmod u+rwx /data/users /data/backups /data/logs
'
echo "[4/5] Redémarrage des services"
docker_cmd compose up -d --remove-orphans --force-recreate

echo "[5/5] Vérification du site réellement servi"
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:30080/health >/dev/null; then
    DEPLOYED_INDEX_HASH="$(curl -fsS http://127.0.0.1:30080/ | sha256sum | awk '{print $1}')"
    if [ "$DEPLOYED_INDEX_HASH" != "$EXPECTED_INDEX_HASH" ]; then
      echo "Le frontend servi ne correspond pas au commit $EXPECTED_COMMIT" >&2
      exit 1
    fi
    docker_cmd compose exec -T backend python -m scripts.verify_padlets
    printf '%s\n' "$EXPECTED_COMMIT" > .git/mep-last-deployed-commit
    trap - 0
    docker_cmd image prune -f --filter "until=168h" >/dev/null
    echo "Déploiement validé : $(date -u +%FT%TZ)"
    exit 0
  fi
  sleep 5
done
echo "La vérification de santé a expiré" >&2
exit 1
