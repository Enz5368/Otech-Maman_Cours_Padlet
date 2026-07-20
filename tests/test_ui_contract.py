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


def test_les_entrees_de_gauche_reutilisent_leur_onglet_existant() -> None:
    assert 'openUrlInNewTabAfterSave(appUrl({ view }), `in-viaggio-view-${slugify(view)}`)' in APP_JS
    assert 'const target = window.open("", targetName);' in APP_JS
    assert "target.focus();" in APP_JS


def test_les_activites_ont_un_apercu_impression_et_un_export_word() -> None:
    assert "Aperçu / imprimer" in APP_JS
    assert "function openActivityPrintPreview(activityId)" in APP_JS
    assert "function exportActivityWord(activityId)" in APP_JS
    assert "function makeActivityDocx" in APP_JS
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in APP_JS


def test_les_outils_existants_peuvent_etre_inseres_dans_une_diapo() -> None:
    assert "const slideTools =" in APP_JS
    assert "function addToolElement(activityId)" in APP_JS
    assert 'kind: "tool"' in APP_JS
    assert "function renderSlideTool" in APP_JS
    assert "function spinSlideWheel" in APP_JS
    assert "function configureSlideWheel" in APP_JS
    assert "function toggleSlideWheelAbsence" in APP_JS
    assert "function startSlideTimer" in APP_JS
    assert 'class="slide-wheel-visual"' in APP_JS
    assert 'class="slide-tool-settings"' in APP_JS


def test_le_fichier_html_possede_un_mode_local_autonome() -> None:
    assert "function isLocalFileMode()" in APP_JS
    assert 'window.location.protocol === "file:"' in APP_JS
    assert 'root: { password: "root", role: "admin" }' in APP_JS
    assert 'rose: { password: "it", role: "teacher" }' in APP_JS
    assert "state = ensureDemoData(loadData());" in APP_JS
    assert "if (!usesServerStorage())" in APP_JS
    assert 'id="localLoginHint"' in INDEX


def test_la_vue_a_projeter_propose_l_arbre_de_chaque_item() -> None:
    assert "function openTableauSubtree" in APP_JS
    assert "projectTreeClassNode" in APP_JS
    assert "projectTreeSequenceNode" in APP_JS
    assert "projectTreeLessonNode" in APP_JS
    assert "projectTreeActivityNode" in APP_JS
    assert "openTableauSubtree('class'" in APP_JS
    assert "openTableauSubtree('sequence'" in APP_JS
    assert "openTableauSubtree('lesson'" in APP_JS


def test_le_champ_description_d_une_seance_est_libelle_objectif() -> None:
    assert 'const descriptionLabel = type === "lesson" ? "Objectif" : "Description";' in APP_JS


def test_le_gestionnaire_de_categories_est_guide_et_explicite() -> None:
    assert "Ranger les niveaux par catégorie" in APP_JS
    assert "1</span><div><h3>Créer et ordonner les catégories" in APP_JS
    assert "2</span><div><h3>Choisir la catégorie et l'ordre de chaque niveau" in APP_JS
    assert "Enregistrer les changements" in APP_JS
    assert "function moveCategoryEditorRow" in APP_JS
    assert "function updateCategoryMoveButtons" in APP_JS
    assert "function refreshCategoryAssignmentOptions" in APP_JS
    assert "function updateCategoryCounts" in APP_JS
    assert "Organiser les catégories" in APP_JS


def test_les_niveaux_sont_ordonnables_dans_chaque_categorie() -> None:
    assert "function categoryClassGroups" in APP_JS
    assert "function moveCategoryClassRow" in APP_JS
    assert "function updateClassMoveButtons" in APP_JS
    assert "Place dans la catégorie" in APP_JS
    assert "classDrafts.map" in APP_JS


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


def test_import_accepte_les_exports_zip_et_attend_le_serveur() -> None:
    assert "Importer ZIP ou JSON" in APP_JS
    assert 'accept=".zip,.json,application/zip,application/json"' in APP_JS
    assert 'extractZipEntry(await file.arrayBuffer(), "donnees-completes.json")' in APP_JS
    assert 'await saveData("Sauvegarde importée et enregistrée sur le serveur.", triggerButton)' in APP_JS
    assert "Elle remplacera les données actuelles de ce compte" in APP_JS


def test_studio_confirme_visiblement_la_sauvegarde_et_recharge_les_medias() -> None:
    assert "saveStudio('${activity.id}',false,this)" in APP_JS
    assert 'id="studioSaveStatus" role="status"' in APP_JS
    assert "Présentation enregistrée sur le serveur." in APP_JS
    assert "const savedWorkspace = await operation;" in APP_JS
    assert "state = confirmedState;" in APP_JS
    assert "const uploaded = await window.ServerAPI.upload(file);" in APP_JS
    assert "value: uploaded.content_url" in APP_JS
    assert "reportMediaError(this)" in APP_JS


def test_identite_mon_espace_pro_est_affichee() -> None:
    assert "<title>MON ESPACE PROF · Cartable numérique</title>" in INDEX
    assert "<h1>MON ESPACE PROF</h1>" in INDEX
    assert "MON ESPACE PROF · Cartable numérique" in INDEX


def test_liens_professeur_sont_accessibles_depuis_outils_et_accueil() -> None:
    for url in (
        "https://turboscribe.ai/fr/downloader/youtube/video",
        "https://www.freemake.com/fr/free_video_downloader_choicest/",
        "https://app.getquizwizard.com/create-content/source",
        "https://digistorm.app/",
        "https://www.pictofacile.com/fr",
        "https://ladigitale.dev/digiview/#/",
        "https://falc.unapei.org/",
        "https://mydys.app/fr/index.php",
        "https://dysfacile-ordinateur.lovable.app/",
        "https://digipad.app/p/1739669/e48690b8789e3",
    ):
        assert url in APP_JS
    assert "Cahier de texte" in INDEX
    assert "Messagerie" in INDEX
    assert "dashboard-shortcuts" in APP_JS


def test_sequences_sont_numerotees_sans_doubler_numero_niveau() -> None:
    assert "function sequenceNumber(classe, sequence)" in APP_JS
    assert "Séquence n° ${sequenceNumber(classe, sequence)}" in APP_JS
    assert "N° ${number || classe.order" not in APP_JS


def test_chrono_est_analogique_numerique_et_colore_par_tiers() -> None:
    styles = (ROOT / "assets" / "styles.css").read_text(encoding="utf-8")
    assert "Chrono analogique / numérique" in APP_JS
    assert 'class="timer-face"' in APP_JS
    assert "timerTotal" in APP_JS
    assert 'face.style.setProperty("--timer-green-angle"' in APP_JS
    assert "#41945f 0 var(--timer-green-angle)" in styles
    assert "#ca4545 var(--timer-green-angle) var(--timer-angle)" in styles
    assert "#fff var(--timer-angle) 360deg" in styles


def test_roue_explique_son_fonctionnement_dans_la_roue() -> None:
    assert "La roue choisit au hasard un élève présent" in APP_JS
    assert 'class="wheel-help"' in APP_JS


def test_ordre_dans_les_categories_est_persiste() -> None:
    save_categories = re.search(
        r"async function saveCategoriesFromDrawer.*?\n      }\n\n      function reorderCategory",
        APP_JS,
        re.DOTALL,
    )
    assert save_categories
    source = save_categories.group(0)
    assert "classDrafts.forEach((draft, index)" in source
    assert "classe.order = index + 1;" in source
    assert source.index("classe.order = index + 1;") < source.index("await saveData")


def test_arbre_permet_d_imprimer_une_seance_complete() -> None:
    assert "function openLessonPrintPreview(lessonId)" in APP_JS
    assert "Imprimer la séance" in APP_JS
    assert "Imprimer toute la séance" in APP_JS
    assert "Toutes les activités et leurs diapositives" in APP_JS
