"""Exercise the deployment worker with fake commands, never real Docker or NAS paths."""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(os.name == 'nt', reason='POSIX deployment worker runs on Linux')


@pytest.mark.parametrize('fails', [False, True])
def test_worker_publishes_marker_only_after_verification_and_rolls_back(tmp_path, fails):
    shell = shutil.which('sh')
    assert shell
    repo = tmp_path / 'repo'
    (repo / '.git').mkdir(parents=True)
    (repo / '.env').touch()
    (repo / 'docker-compose.yml').touch()
    (repo / 'index.html').write_text('test frontend', encoding='utf-8')
    (repo / '.git' / 'mep-last-deployed-commit').write_text('previous-verified', encoding='utf-8')
    tools = tmp_path / 'bin'
    tools.mkdir()
    docker = tools / 'docker'
    docker.write_text('''#!/bin/sh
printf '%s\\n' "$*" >> "$DEPLOY_TEST_LOG"
case "$*" in
  "compose ps --status running --services") echo postgres ;;
  "compose exec -T backend python -m scripts.verify_padlets") test "$DEPLOY_TEST_FAIL" = "false" ;;
esac
''', encoding='utf-8')
    docker.chmod(0o700)
    git = tools / 'git'
    git.write_text('''#!/bin/sh
printf 'git %s\\n' "$*" >> "$DEPLOY_TEST_LOG"
case "$1" in
  rev-parse) echo current-tree ;;
  show) echo 'exit 0' ;;
esac
''', encoding='utf-8')
    git.chmod(0o700)
    curl = tools / 'curl'
    curl.write_text('#!/bin/sh\nprintf "test frontend"\n', encoding='utf-8')
    curl.chmod(0o700)
    worker = (ROOT / 'scripts' / 'deploy_remote.sh').read_text(encoding='utf-8')
    worker = worker.replace('REPO="/mnt/DriveMaison/Database/deploy/apps/Otech-Maman_Cours_Padlet"', f'REPO="{repo.as_posix()}"')
    worker = worker.replace('test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"', ': # fake git has no real commits')
    path = tmp_path / 'worker.sh'
    path.write_text(worker, encoding='utf-8')
    result = subprocess.run([shell, str(path)], check=False, env={
        **os.environ, 'PATH': str(tools) + os.pathsep + os.environ['PATH'], 'EXPECTED_COMMIT': 'new-commit',
        'DEPLOY_TEST_FAIL': str(fails).lower(), 'DEPLOY_TEST_LOG': str(tmp_path / 'commands.log'),
    }, capture_output=True, text=True, timeout=20)
    log = (tmp_path / 'commands.log').read_text()
    marker = (repo / '.git' / 'mep-last-deployed-commit').read_text().strip()
    if fails:
        assert result.returncode != 0
        assert marker == 'previous-verified'
        assert 'git reset --hard previous-verified' in log
        assert 'compose down' in log
    else:
        assert result.returncode == 0, result.stderr
        assert marker == 'new-commit'
        assert 'compose down' not in log
