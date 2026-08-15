from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
APP_JS = (
    (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
    if (ROOT / "assets" / "app.js").exists()
    else INDEX
)
STYLES = (ROOT / "assets" / "styles.css").read_text(encoding="utf-8")
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


def test_chaque_sequence_propose_un_document_d_accroche_avant_l_arbre() -> None:
    card_start = APP_JS.index("function tableauSequenceCard")
    card_end = APP_JS.index("function renderTableauSequence", card_start)
    card = APP_JS[card_start:card_end]
    assert card.index("sequenceHookDocumentControl(sequence)") < card.index("openTableauSubtree('sequence'")
    assert "async function setSequenceHookDocument" in APP_JS
    assert "sequence.hookDocument =" in APP_JS
    editable_start = APP_JS.index("function sequenceCard")
    editable_end = APP_JS.index("function renderSequencePage", editable_start)
    editable_card = APP_JS[editable_start:editable_end]
    assert editable_card.index("sequenceHookDocumentControl(sequence)") < editable_card.index("openEditableSubtree")


def test_le_studio_accepte_collage_double_clic_et_texte_auto_ajuste() -> None:
    assert 'studio.addEventListener("paste"' in APP_JS
    assert 'studio.addEventListener("dblclick"' in APP_JS
    assert "insertStudioClipboardImage" in APP_JS
    assert "function fitStudioText" in APP_JS
    assert "while (size > 8" in APP_JS


def test_les_liens_en_nouvel_onglet_reutilisent_trois_emplacements() -> None:
    assert 'event.target.closest("a[target=\'_blank\']")' in APP_JS
    assert 'Number(localStorage.getItem(key) || 0) % 3' in APP_JS


def test_la_connexion_serveur_laisse_le_serveur_normaliser_l_identifiant() -> None:
    login_start = APP_JS.index("async function loginAccount")
    login_end = APP_JS.index("function currentUsername", login_start)
    login = APP_JS[login_start:login_end]
    assert 'const cleanUsername = String(username || "").trim();' in login
    assert "await window.ServerAPI.login(cleanUsername, password)" in login
    assert "const localUsername = slugify(cleanUsername);" in login
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


def test_changement_de_mot_de_passe_a_une_interface_de_securite_complete() -> None:
    assert "password-strength" in APP_JS
    assert "newPasswordConfirmation" in APP_JS
    assert '"current-password"' in APP_JS
    assert "Les autres appareils connectés seront déconnectés" in APP_JS
    assert "bindPasswordForm" in APP_JS


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


def test_export_pptx_embarque_les_medias_et_produit_un_zip_windows_valide() -> None:
    assert "const files = await buildExportFiles();" in APP_JS
    assert 'const supported = new Set(["image", "audio", "video"]);' in APP_JS
    assert 'fetch(url, { credentials: "include" })' in APP_JS
    assert "exportMediaFetchCache" in APP_JS
    assert '"ppt/media/media-placeholder.png"' in APP_JS
    assert "pptxSlideRels(slideMedia[index])" in APP_JS
    assert "relationships/media" in APP_JS
    assert 'item.kind === "video" ? "video" : item.kind === "audio" ? "audio" : "image"' in APP_JS
    assert "ppt/slideMasters/" in APP_JS
    assert "ppt/slideLayouts/" in APP_JS
    assert "ppt/theme/" in APP_JS
    assert 'fetch("assets/pptx-template.pptx?v=1")' in APP_JS
    assert "readStoredZipFiles" in APP_JS
    with zipfile.ZipFile(ROOT / "assets" / "pptx-template.pptx") as template:
        assert template.testzip() is None
        assert "ppt/slideMasters/slideMaster1.xml" in template.namelist()
        assert "ppt/slideLayouts/slideLayout1.xml" in template.namelist()
        assert "ppt/theme/theme1.xml" in template.namelist()
    assert "zipDosDateTime(new Date())" in APP_JS
    assert "appendStoredFilesToExport(files)" in APP_JS
    assert "collectActivityMediaExportFiles(activity, activityFolder)" in APP_JS
    assert "`${activityFolder}/${String(index + 1).padStart(2, \"0\")}-${element.kind}.${extension}`" in APP_JS
    assert "`${activityFolder}/medias/" not in APP_JS
    assert 'path: `medias/${String(index + 1).padStart(3, "0")}-${baseName}${extension}`' in APP_JS
    assert "exportSlug(classe.title, 14)" in APP_JS
    assert "exportSlug(sequence.title, 14)" in APP_JS
    assert "exportSlug(lesson.title, 14)" in APP_JS
    assert "exportSlug(activity.title, 14)" in APP_JS
    assert ".slice(-maxLength)" in APP_JS


def test_studio_confirme_visiblement_la_sauvegarde_et_recharge_les_medias() -> None:
    assert "saveStudio('${activity.id}',false,this)" in APP_JS
    assert 'id="studioSaveStatus" role="status"' in APP_JS
    assert "Activité enregistrée sur le serveur." in APP_JS
    assert "const savedWorkspace = await operation;" in APP_JS
    assert "state = confirmedState;" in APP_JS
    assert "const uploaded = await window.ServerAPI.upload(file);" in APP_JS
    assert "value: uploaded.content_url" in APP_JS
    assert "reportMediaError(this)" in APP_JS


def test_documents_bureautiques_ne_declenchent_pas_de_telechargement_automatique() -> None:
    assert 'mimeType === "application/pdf" ? "pdf"' in APP_JS
    assert ': "document";' in APP_JS
    assert "isStoredDocumentUrl(element.value)" in APP_JS
    assert 'class="slide-document-card"' in APP_JS
    assert "Ouvrir le document" in APP_JS
    assert 'element.kind === "pdf"' in APP_JS
    assert "classifyStoredSlideElements()" in APP_JS
    assert "mimeByUrl" in APP_JS
    assert "hydrateDocumentPreviews()" in APP_JS
    assert '"word/document.xml"' in APP_JS
    assert "docxXmlToHtml" in APP_JS
    assert 'classList.add("loaded")' in APP_JS
    assert "officeDocumentToHtml" in APP_JS
    assert "listZipEntryNames" in APP_JS
    assert 'class="pptx-preview-slide"' in APP_JS
    assert "pptxSlidePreviewImages" in APP_JS
    assert 'class="pptx-preview-image"' in APP_JS
    assert "changePptxPreviewSlide" in APP_JS
    assert 'data-pptx-index="0"' in APP_JS
    assert '${index ? "hidden" : ""}' in APP_JS


def test_retour_presentation_rouvre_la_seance_correspondante() -> None:
    assert "const result = activityId ? findActivity(activityId) : null;" in APP_JS
    assert "openLessonPage(result.classe.id, result.sequence.id, result.lesson.id)" in APP_JS


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
    assert "conic-gradient(#41945f 0 var(--timer-green-angle)" in styles
    assert "#ca4545 var(--timer-green-angle) var(--timer-angle)" in styles
    assert "#fff var(--timer-angle) 360deg" in styles
    timer_face = re.search(r"\.timer-face \{.*?\n      }", styles, re.DOTALL)
    assert timer_face
    assert "from -90deg" not in timer_face.group(0)


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
def test_import_pptx_devient_des_diapos_natives_du_site() -> None:
    assert "importPptxAsSiteSlides(file)" in APP_JS
    assert "pptxShapeBounds" in APP_JS
    assert "paginateImportedElements(elements)" in APP_JS
    assert "activity.slides = onlyBlankSlide ? importedSlides" in APP_JS


def test_version_gratuite_est_editable_sans_ecriture_serveur() -> None:
    assert "return isLoggedIn() || freeExampleOpen;" in APP_JS
    assert "if (!freeExampleOpen)" in APP_JS
    assert "isLocalFileMode() || freeExampleOpen" in APP_JS


def test_tutoriel_complet_est_accessible_et_passable() -> None:
    assert 'data-view="tutorial"' in INDEX
    assert 'id="tourOverlay"' in INDEX
    assert "function startTutorial()" in APP_JS
    assert "function startFreeExampleTutorial()" in APP_JS
    assert "Passer le tutoriel" in APP_JS
    assert "Précédent" in APP_JS
    assert "Suivant" in APP_JS
    assert "setTimeout(startFreeExampleTutorial, 250);" in APP_JS


def test_description_publique_ne_divulgue_aucun_identifiant() -> None:
    assert "Créez, organisez et projetez vos cours" in INDEX
    assert "rose / it" not in INDEX
    assert "root / root" not in INDEX


def test_diapos_reordonnables_avec_miniatures() -> None:
    assert 'class="slide-thumbnails"' in APP_JS
    assert "function reorderStudioSlide(" in APP_JS
    assert 'draggable="true"' in APP_JS


def test_plan_de_classe_et_emploi_du_temps_sont_disponibles() -> None:
    assert "function openSeatingPlan(" in APP_JS
    assert "maximum 40" in APP_JS
    assert 'data-view="schedule"' in INDEX
    assert "function renderSchedule()" in APP_JS
    assert 'id="currentCourseShortcut"' in INDEX


def test_plan_de_classe_style_cinema_et_emploi_du_temps_lycee() -> None:
    assert 'class="cinema-room"' in APP_JS
    assert "Sièges par rangée" in APP_JS
    assert ".desk::before" in STYLES
    assert "function renderTimetableGrid()" in APP_JS
    assert '["lundi", "mardi", "mercredi", "jeudi", "vendredi"]' in APP_JS
    assert 'aria-label="Emploi du temps du lundi au vendredi"' in APP_JS
    assert ".timetable-course" in STYLES
    assert "assets/styles.css?v=espace-prof-20" in INDEX


def test_initialisation_ne_lit_pas_le_mode_demo_avant_sa_declaration() -> None:
    ensure_block = APP_JS.split("function ensureDemoData(data)", 1)[1].split("function ensureActivitySlides", 1)[0]
    assert "freeExampleOpen" not in ensure_block


def test_zip_fourni_est_la_base_de_la_version_gratuite() -> None:
    example = ROOT / "assets" / "free-example"
    assert (example / "data.json").is_file()
    data = json.loads((example / "data.json").read_text(encoding="utf-8"))
    assert len(data["classes"]) == 1
    assert "assets/free-example/data.json?v=2026-08-13-1" in APP_JS
    assert "/api/v1/files/" not in json.dumps(data)
    assert any(path.suffix == ".mp4" for path in example.iterdir())
    assert "convertFreePptxDocuments()" in APP_JS


def test_exemple_gratuit_est_a_jour_et_sans_texte_mal_encode() -> None:
    example = json.loads((ROOT / "assets" / "free-example" / "data.json").read_text(encoding="utf-8"))
    serialized = json.dumps(example, ensure_ascii=False)
    assert example["demoVersion"] == 3
    assert example["exampleUpdatedAt"] == "2026-08-13"
    assert "Ã" not in serialized
    assert "â€“" not in serialized
    assert "â€”" not in serialized


def test_migration_pptx_payante_detecte_le_contenu_et_continue_apres_une_erreur() -> None:
    assert "officeExtensionFromArrayBuffer(bytes)" in APP_JS
    assert 'if (detectedExtension !== "pptx")' in APP_JS
    assert 'console.warn("Conversion Office ignorée pour ce fichier"' in APP_JS


def test_word_reste_un_document_et_n_est_jamais_converti_en_diapos() -> None:
    assert "importDocxAsSiteSlides" not in APP_JS
    assert 'element.kind === "document" && /\\.pptx' in APP_JS
    assert 'file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"' in APP_JS
    assert "/\\.(pptx|docx)$/i.test(file.name" not in APP_JS


def test_anciens_liens_404_connus_sont_restaures_dans_tous_les_comptes() -> None:
    assert "const recoveredExportFiles" in APP_JS
    assert "recoverKnownExportFileUrls()" in APP_JS
    assert '"6eaac43f-3a48-482c-9152-1a18408e63c4"' in APP_JS


def test_video_interdite_est_absente_et_remplacee_par_ninna_nanna() -> None:
    example = ROOT / "assets" / "free-example"
    assert not any("banger" in path.name.lower() for path in example.iterdir())
    safe_video = example / "001-nda-ninna-nann.mp4"
    assert safe_video.is_file()
    assert safe_video.stat().st_size == 11_981_688
    data = (example / "data.json").read_text(encoding="utf-8")
    assert "banger" not in data.lower()
    assert "assets/free-example/001-nda-ninna-nann.mp4" in data
    assert '"6574efd1-b6d4-4070-84a2-9b11cca9bf73": "assets/free-example/001-nda-ninna-nann.mp4"' in APP_JS


def test_export_zip_continue_si_un_media_retourne_404() -> None:
    assert 'path: "RAPPORT-MEDIAS-MANQUANTS.txt"' in APP_JS
    assert "recordExportWarning" in APP_JS
    assert "return null;" in APP_JS
    assert "downloads.filter(Boolean)" in APP_JS
