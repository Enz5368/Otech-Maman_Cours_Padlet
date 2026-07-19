from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "tests" / "visual" / "baseline-login.png"


def chrome_binary() -> str:
    configured = os.environ.get("CHROME_BIN")
    candidates = [
        configured,
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(candidate)
    raise SystemExit("Chrome/Chromium introuvable ; définir CHROME_BIN")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="mep-visual-") as directory:
        output = Path(directory) / "current-login.png"
        profile = Path(directory) / "profile"
        subprocess.run(
            [
                chrome_binary(),
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--window-size=1440,1000",
                "--virtual-time-budget=5000",
                f"--user-data-dir={profile}",
                f"--screenshot={output}",
                (ROOT / "index.html").as_uri(),
            ],
            check=True,
            timeout=30,
        )
        for _ in range(20):
            if output.exists():
                break
            time.sleep(0.1)
        if not output.exists():
            raise SystemExit("Chrome n'a pas produit la capture")
        if sha256(output) != sha256(BASELINE):
            current = ROOT / "tests" / "visual" / "current-login.png"
            shutil.copy2(output, current)
            raise SystemExit(f"Régression visuelle détectée ; capture : {current}")
        print("Capture identique pixel pour pixel à la référence.")


if __name__ == "__main__":
    main()
