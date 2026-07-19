"""Extraction mécanique des assets historiques, sans altérer leur contenu."""

from __future__ import annotations

import re
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    index_path = root / "index.html"
    source = index_path.read_text(encoding="utf-8")
    style_match = re.search(
        r"\n    <style>\n(?P<css>.*?)\n    </style>", source, re.DOTALL
    )
    script_match = re.search(
        r"\n    <script>\n(?P<js>.*?)\n    </script>\n  </body>", source, re.DOTALL
    )
    if not style_match or not script_match:
        raise SystemExit("Les blocs historiques n'ont pas été trouvés")
    assets = root / "assets"
    assets.mkdir(exist_ok=True)
    (assets / "styles.css").write_text(
        style_match.group("css") + "\n", encoding="utf-8"
    )
    (assets / "app.js").write_text(script_match.group("js") + "\n", encoding="utf-8")
    output = (
        source[: style_match.start()]
        + '\n    <link rel="stylesheet" href="assets/styles.css" />'
        + source[style_match.end() :]
    )
    script_match = re.search(
        r"\n    <script>\n(?P<js>.*?)\n    </script>\n  </body>", output, re.DOTALL
    )
    if not script_match:
        raise SystemExit("Le bloc JavaScript n'a pas été retrouvé après extraction CSS")
    replacement = '\n    <script src="assets/api-client.js"></script>\n    <script src="assets/app.js"></script>\n  </body>'
    output = output[: script_match.start()] + replacement + output[script_match.end() :]
    index_path.write_text(output, encoding="utf-8")


if __name__ == "__main__":
    main()
