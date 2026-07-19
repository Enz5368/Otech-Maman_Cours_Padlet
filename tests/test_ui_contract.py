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


def test_categories_sont_initialisees_apres_chargement_du_workspace() -> None:
    assert (
        'data.categories = Array.isArray(data.categories) ? data.categories : ["Collège", "Lycée"];'
        in APP_JS
    )


def test_les_classes_utilisateur_ne_sont_pas_recreees_depuis_la_demo() -> None:
    ensure_data = re.search(
        r"function ensureDemoData\(data\).*?\n      }\n\n      function ensureActivitySlides",
        APP_JS,
        re.DOTALL,
    )
    assert ensure_data
    source = ensure_data.group(0)
    assert "data.classes.length === 0" not in source
    assert "defaultClasses" not in source
    assert "looksLikeOldDemo" not in source
    assert "hasDefaultStudentClass" not in source


def test_un_nouvel_onglet_attend_la_sauvegarde_serveur() -> None:
    assert "let pendingWorkspaceSave = Promise.resolve(true);" in APP_JS
    assert "window.ServerAPI.saveWorkspace(snapshot, true)" in APP_JS
    assert "function openUrlInNewTabAfterSave(url)" in APP_JS
    assert "Promise.resolve(pendingWorkspaceSave).then" in APP_JS


def test_enregistrement_bloque_interface_jusqu_a_confirmation() -> None:
    assert "async function saveData(message, triggerButton)" in APP_JS
    assert "function beginSaveLock(triggerButton)" in APP_JS
    assert "Enregistrement sur le serveur…" in APP_JS
    assert 'button.setAttribute("aria-busy", "true")' in APP_JS
    assert "if (activeSaveLocks === 0) return;" in APP_JS


def test_editeur_ne_se_ferme_qu_apres_sauvegarde() -> None:
    editor = re.search(
        r"async function saveEditor\(event, type, id\).*?\n      }\n\n      function upsertItem",
        APP_JS,
        re.DOTALL,
    )
    assert editor
    source = editor.group(0)
    assert 'await saveData("Enregistré sur le serveur.", event.submitter)' in source
    assert source.index("if (saved)") < source.index("closeEditor()")


def test_conflit_et_brouillon_local_sont_recuperes() -> None:
    api_client = (ROOT / "assets" / "api-client.js").read_text(encoding="utf-8")
    assert "if (error.status !== 409) throw error;" in api_client
    assert 'const latest = await request("/workspace");' in api_client
    assert "async replayOfflineDraft(currentWorkspace)" in api_client
    assert "const recoveredWorkspace = await window.ServerAPI.replayOfflineDraft(workspace)" in APP_JS


def test_reglages_permettent_de_changer_et_reinitialiser_un_mot_de_passe() -> None:
    api_client = (ROOT / "assets" / "api-client.js").read_text(encoding="utf-8")
    assert "Changer mon mot de passe" in APP_JS
    assert "function resetAccountPassword" in APP_JS
    assert 'request("/admin/users")' in api_client
    assert "force-password-reset" in api_client


def test_changement_de_mot_de_passe_n_est_jamais_impose_a_la_connexion() -> None:
    login_function = re.search(
        r"async function loginAccount\(.*?\n      }\n\n      function currentUsername",
        APP_JS,
        re.DOTALL,
    )
    bootstrap_function = re.search(
        r"async function bootstrapApplication\(\).*?\n      }\n\n      bootstrapApplication",
        APP_JS,
        re.DOTALL,
    )
    assert login_function
    assert bootstrap_function
    assert "offerPasswordChange" not in login_function.group(0)
    assert "offerPasswordChange" not in bootstrap_function.group(0)
    assert '<button class="btn icon" type="button" onclick="closeEditor()">X</button>' in APP_JS


def test_vue_arbre_affiche_toute_la_hierarchie_des_cours() -> None:
    styles = (ROOT / "assets" / "styles.css").read_text(encoding="utf-8")
    assert 'data-view="tree"' in INDEX
    assert 'tree: ["Arbre"' in APP_JS
    assert 'if (currentView === "tree") renderTree();' in APP_JS
    assert "state.classes.map(treeClassNode)" in APP_JS
    assert "treeSequenceNode" in APP_JS
    assert "treeLessonNode" in APP_JS
    assert "treeActivityNode" in APP_JS
    assert "treeResourceNode" in APP_JS
    assert ".course-tree li::before" in styles
