from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_PATHS = (ROOT / "index.html", ROOT / "robots.txt", ROOT / "sitemap.xml", ROOT / "assets", ROOT / "uploads")
FORBIDDEN_SUFFIXES = {".map", ".bak", ".old", ".pem", ".key", ".sql", ".log"}
FORBIDDEN_NAMES = {".env", ".env.local", "database.sqlite", "backup.zip", "site.zip"}
SECRET_PATTERNS = {
    "private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "GitHub token": re.compile(rb"gh[opsu]_[A-Za-z0-9]{30,}"),
    "generic API token": re.compile(
        rb"(?:api[_-]?key|secret|token)\s*[:=]\s*['\"][A-Za-z0-9_./+\-=]{20,}['\"]", re.I
    ),
}


def public_files() -> list[Path]:
    files: list[Path] = []
    for path in PUBLIC_PATHS:
        if path.is_file():
            files.append(path)
        elif path.is_dir():
            files.extend(item for item in path.rglob("*") if item.is_file())
    return files


def main() -> int:
    failures: list[str] = []
    files = public_files()
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        if path.name.lower() in FORBIDDEN_NAMES or path.suffix.lower() in FORBIDDEN_SUFFIXES:
            failures.append(f"fichier interdit dans l'image frontend: {relative}")
            continue
        if path.stat().st_size > 10 * 1024 * 1024:
            continue
        content = path.read_bytes()
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(content):
                failures.append(f"secret potentiel ({label}) dans {relative}")

    tracked = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, check=True, capture_output=True, text=True
    ).stdout.splitlines()
    for name in tracked:
        if Path(name).name.lower() in FORBIDDEN_NAMES:
            failures.append(f"fichier sensible suivi par Git: {name}")

    if failures:
        print("ÉCHEC DU CONTRÔLE DE SÉCURITÉ", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print(f"Contrôle de sécurité réussi ({len(files)} fichiers publics analysés).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
