from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_persistent_data_is_outside_frontend_image() -> None:
    dockerfile = (ROOT / "docker" / "frontend.Dockerfile").read_text(encoding="utf-8")
    assert "/mnt/DriveMaison" not in dockerfile
    assert "Users" not in dockerfile


def test_deployment_no_longer_uses_destructive_rsync() -> None:
    workflow = (ROOT / ".github" / "workflows" / "deploy.yml").read_text(encoding="utf-8")
    assert "rsync --delete" not in workflow
    assert "scripts/backup.sh" in workflow
    assert "rollback" in workflow
    assert "trap rollback 0" in workflow
    assert "trap rollback ERR" not in workflow
    assert 'exit "$FAILURE_CODE"' in workflow
    assert "docker compose up -d --remove-orphans --force-recreate" in workflow
    assert "docker compose build --no-cache frontend" in workflow
    assert 'test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"' in workflow
    assert 'git fetch --no-tags origin "$EXPECTED_COMMIT"' in workflow
    assert 'git reset --hard "$EXPECTED_COMMIT"' in workflow
    assert 'DEPLOYED_INDEX_HASH="$(curl -fsS http://127.0.0.1:30080/' in workflow
    assert '"$DEPLOYED_INDEX_HASH" != "$EXPECTED_INDEX_HASH"' in workflow


def test_required_persistent_mounts_exist() -> None:
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    for path in (
        "/mnt/DriveMaison/Database/postgres",
        "/mnt/DriveMaison/Users",
        "/mnt/DriveMaison/Backups",
        "/mnt/DriveMaison/Logs",
    ):
        assert path in compose


def test_javascript_and_css_are_revalidated_after_deployment() -> None:
    nginx = (ROOT / "docker" / "frontend.nginx.conf").read_text(encoding="utf-8")
    assert "location ~* \\.(?:css|js)$" in nginx
    assert 'add_header Cache-Control "no-cache";' in nginx
