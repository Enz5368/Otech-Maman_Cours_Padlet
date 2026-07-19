from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
APP_JS = (
    (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
    if (ROOT / "assets" / "app.js").exists()
    else INDEX
)
CONTRACT = json.loads((ROOT / "tests" / "ui_contract.json").read_text(encoding="utf-8"))


def test_identifiants_html_importants_sont_conserves() -> None:
    for identifier in CONTRACT["root_ids"]:
        assert f'id="{identifier}"' in INDEX


def test_ordre_des_menus_est_inchange() -> None:
    views = re.findall(r'class="nav-button(?: active)?" data-view="([^"]+)"', INDEX)
    assert views == CONTRACT["views"]


def test_libelles_visibles_sont_conserves() -> None:
    source = INDEX + APP_JS
    for text in CONTRACT["required_texts"]:
        assert text in source


def test_dimensions_du_studio_sont_conservees() -> None:
    size = CONTRACT["slide_size"]
    assert (
        f"const slideSize = {{ width: {size['width']}, height: {size['height']}, gap: {size['gap']} }};"
        in APP_JS
    )


def test_notes_privees_non_projetees() -> None:
    board_function = re.search(
        r"function showBoard\(.*?\n      }\n\n      function elementsForBoardSlide",
        APP_JS,
        re.DOTALL,
    )
    assert board_function
    assert "privateNotes" not in board_function.group(0)


def test_assets_extraits_sont_charges_dans_le_bon_ordre() -> None:
    assert (
        INDEX.index("assets/styles.css")
        < INDEX.index("assets/api-client.js")
        < INDEX.index("assets/app.js")
    )


def test_assets_frontend_sont_versionnes_contre_le_cache() -> None:
    for asset in ("styles.css", "api-client.js", "app.js"):
        assert f"assets/{asset}?v=" in INDEX


def test_assistant_de_migration_locale_est_absent() -> None:
    api_client = (ROOT / "assets" / "api-client.js").read_text(encoding="utf-8")
    for obsolete_symbol in (
        "offerLegacyMigration",
        "startLegacyMigration",
        "confirmLegacyDeletion",
        "importLocalStorage",
        "mep-migration-complete",
    ):
        assert obsolete_symbol not in APP_JS + api_client
