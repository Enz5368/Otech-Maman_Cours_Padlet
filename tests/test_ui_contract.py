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
    assert "async function exportActivityWord(activityId" in APP_JS
    assert "function makeActivityDocx" in APP_JS
    assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in APP_JS


def test_les_outils_existants_peuvent_etre_inseres_dans_une_diapo() -> None:
    assert "const slideTools =" in APP_JS
    assert "function addToolElement(activityId, toolId" in APP_JS
    assert 'kind: "tool"' in APP_JS
    assert "function renderSlideTool" in APP_JS
    assert "function spinSlideWheel" in APP_JS
    assert "function configureSlideWheel" in APP_JS
    assert "function toggleSlideWheelAbsence" in APP_JS
    assert "function startSlideTimer" in APP_JS
    assert 'class="slide-wheel-visual"' in APP_JS
    assert 'class="slide-tool-settings"' in APP_JS
    assert ">+ Roue</button>" in APP_JS
    assert ">+ Chrono</button>" in APP_JS
    assert "studioToolSelect" not in APP_JS
    assert "function initResponsiveSlideTool(" in APP_JS
    assert "new ResizeObserver(update).observe(node)" in APP_JS
    assert 'container-type:size' in STYLES
    assert ".slide-el.tool-compact" in STYLES
    assert ".slide-el.tool-tiny" in STYLES
    assert "studio-wheel-button" in APP_JS
    assert "studio-timer-button" in APP_JS
    assert 'studio-tool-button wheel"' not in APP_JS
    assert "flex-wrap:wrap" in STYLES
    assert "overflow:visible" in STYLES
    assert "grid-template-columns: minmax(0, 1fr)" in STYLES


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
    assert "overflow: auto" in styles
    assert "justify-content: center" in styles
    assert ".course-tree li::after" in styles
    assert ".course-tree ul ul::before" in styles
    assert ".tree-node-stack .tree-node { width: 100%; }" in styles
    assert "grid-template-columns: 330px auto" not in styles
    assert ".course-tree-scroll" in styles


def test_sequences_et_seances_peuvent_etre_copiees_dans_une_autre_classe() -> None:
    assert "function openCopySequence(" in APP_JS
    assert "function openCopyLesson(" in APP_JS
    assert "function copyCourseItem(" in APP_JS
    assert "function cloneSequenceForClass(" in APP_JS
    assert "function cloneLessonForSequence(" in APP_JS
    assert "function cloneActivityForLesson(" in APP_JS
    assert 'element, id: uid("el")' in APP_JS
    assert 'resource, id: uid("res")' in APP_JS
    assert "Copier vers une classe" in APP_JS
    assert "La copie sera indépendante" in APP_JS


def test_import_accepte_les_exports_zip_et_attend_le_serveur() -> None:
    assert "Importer ZIP ou JSON" in APP_JS
    assert 'accept=".zip,.json,application/zip,application/json"' in APP_JS
    assert 'extractZipEntry(await file.arrayBuffer(), "donnees-completes.json")' in APP_JS
    assert 'await saveData("Sauvegarde importée et enregistrée sur le serveur.", triggerButton)' in APP_JS
    assert "Elle remplacera les données actuelles de ce compte" in APP_JS


def test_export_pptx_embarque_les_medias_et_produit_un_zip_windows_valide() -> None:
    assert "const files = await buildExportFiles();" in APP_JS
    assert "new Blob(makeZipParts(files)" in APP_JS
    assert "function makeZipParts(files)" in APP_JS
    assert 'onclick="exportZip(this)"' in APP_JS
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
    assert 'path: `medias/${String(index + 1).padStart(3, "0")}-${baseName}${extension}`' in APP_JS
    assert "exportSlug(classe.title, 14)" in APP_JS
    assert "makeSequenceDocx({ sequence, classe }, false)" in APP_JS
    assert "embedMedia = true" in APP_JS
    assert 'element.kind !== "tool"' in APP_JS
    assert 'exportSlug(sequence.title, 40)}.docx`' in APP_JS
    assert "classFolder}/sequences/" not in APP_JS
    assert "sequenceFolder" not in APP_JS
    assert "lessonFolder" not in APP_JS
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


def test_description_publique_est_professionnelle_et_connexion_exclue_des_snippets() -> None:
    assert "MON ESPACE PROF est le cartable numérique des enseignants" in INDEX
    assert 'id="loginForm" class="login-card" data-nosnippet' in INDEX
    assert "root / root" not in INDEX
    assert "rose / it" not in INDEX


def test_root_peut_creer_un_compte_enseignant() -> None:
    api_client = (ROOT / "assets" / "api-client.js").read_text(encoding="utf-8")
    assert "adminCreateUser(payload)" in api_client
    assert 'request("/admin/users", { method: "POST"' in api_client
    assert "async function createAdminAccount(event)" in APP_JS
    assert "Créer le compte enseignant" in APP_JS
    assert 'auto_register: false' in api_client


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


def test_arbre_exporte_sequences_et_seances_en_polycopie_word() -> None:
    assert "async function exportLessonWord(lessonId" in APP_JS
    assert "async function exportSequenceWord(sequenceId" in APP_JS
    assert "function openSequenceWordPreview(sequenceId)" in APP_JS
    assert "Aperçu / exporter Word" in APP_JS
    assert "Deux diapos par feuille A4 portrait par défaut" in APP_JS
    assert "makeWordHandoutDocx" in APP_JS
    assert "composePortraitWordSheet" in APP_JS
    assert "makeMixedOrientationDocx" in APP_JS
    assert 'w:orient="landscape"' in APP_JS
    assert "docxRasterMedia(element)" in APP_JS
    assert "docxImageParagraph(" in APP_JS


def test_export_word_reproduit_apercu_sans_outils_interactifs() -> None:
    assert 'filter((element) => element.kind !== "tool")' in APP_JS
    assert 'id="sequencePrintPreview"' in APP_JS
    assert 'makePreviewPagesDocx("lessonPrintPreview")' in APP_JS
    assert 'makePreviewPagesDocx("sequencePrintPreview")' in APP_JS
    assert 'makePreviewPagesDocx("activityPrintPreview")' in APP_JS
    assert "async function rasterizePreviewPage(" in APP_JS
    assert "async function paintPreviewElement(" in APP_JS
    assert "async function paintPreviewBytes(" in APP_JS
    assert "function paintPreviewTextNode(" in APP_JS
    assert "createImageBitmap(new Blob([bytes]))" in APP_JS
    assert "<foreignObject" not in APP_JS
    assert "function docxPreviewPageParagraph(" in APP_JS
    assert "function setWordSlideLayout(" in APP_JS
    assert "print-slide-path" in APP_JS
    assert "word-slide-layout-control" in STYLES
    assert "toggleWordSlideIncluded" in APP_JS
    assert "setAllWordSlidesIncluded" in APP_JS
    assert 'data-word-export="false"' in APP_JS
    assert "word-multi-preview" in STYLES


def test_accroche_accepte_un_lien_video_et_seances_ont_une_valise() -> None:
    assert "function setSequenceHookVideoLink(sequenceId)" in APP_JS
    assert "Vidéo d’accroche" in APP_JS
    assert "function lessonSuitcase(lesson)" in APP_JS
    for field in ("cultural", "lexicon", "conjugation", "grammar", "lifeSkills"):
        assert field in APP_JS


def test_enregistrement_du_studio_conserve_la_position() -> None:
    assert "const pageScroll = { x: window.scrollX, y: window.scrollY };" in APP_JS
    assert "window.scrollTo(pageScroll.x, pageScroll.y);" in APP_JS
    assert "thumbnails.scrollTop = stripScroll;" in APP_JS


def test_apercu_word_permet_demi_page_portrait_ou_page_paysage() -> None:
    assert "½ page · A4 portrait" in APP_JS
    assert "Page entière · paysage" in APP_JS
    assert "aspect-ratio:297 / 210" in STYLES
    assert ".printable-lesson .print-slide-page" in STYLES
    assert '[data-word-layout="half"]' in STYLES


def test_url_youtube_se_lit_directement_dans_la_diapositive() -> None:
    assert "https://www.youtube-nocookie.com/embed/" in APP_JS
    assert 'title="Lecteur vidéo YouTube"' in APP_JS
    assert "allowfullscreen" in APP_JS
    assert ".youtube-card.youtube-player iframe" in STYLES


def test_recherche_globale_accepte_fragments_accents_et_tout_le_contenu() -> None:
    assert "function normalizeSearchText(value)" in APP_JS
    assert "function globalSearchEntries()" in APP_JS
    assert 'replace(/[\\u0300-\\u036f]/g, "")' in APP_JS
    assert "entry.searchable.includes(q)" in APP_JS
    assert "searchTextFrom(data)" in APP_JS
    for entity in ("Classe", "Séquence", "Séance", "Activité", "Ressource"):
        assert f'"{entity}"' in APP_JS
    assert 'button.closest(".sidebar")' in APP_JS
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


def test_export_impression_et_documents_libreoffice() -> None:
    assert "appendStoredFilesToExport(files)" in APP_JS
    assert '"application/pdf": "pdf"' in APP_JS
    assert '"application/vnd.oasis.opendocument.text": "odt"' in APP_JS
    assert 'extractZipEntry(arrayBuffer, "content.xml")' in APP_JS
    assert 'files = items.filter((item) => item.kind === "file")' in APP_JS
    assert "for (const file of files) await addFileElement" in APP_JS
    assert "function printOrientationControl()" in APP_JS
    assert 'value="portrait">Portrait' in APP_JS
    assert 'value="landscape">Paysage' in APP_JS
    assert "composePortraitWordSheet" in APP_JS
    assert "espace-prof-47" in INDEX


def test_diapos_affichent_classe_sequence_et_seance() -> None:
    assert "function activityLocationBreadcrumb(" in APP_JS
    assert 'aria-label="Emplacement de la présentation"' in APP_JS
    assert "Séquence ${sequenceNumber(classe, sequence)}" in APP_JS
    assert 'activityLocationBreadcrumb(result, "studio-location")' in APP_JS
    assert 'activityLocationBreadcrumb(result, "board-location")' in APP_JS
    assert ".activity-location" in STYLES
    assert ".board-location" in STYLES


def test_serveur_accepte_les_formats_opendocument_du_selecteur() -> None:
    storage = (ROOT / "backend" / "app" / "services" / "storage.py").read_text(encoding="utf-8")
    for extension, mime_type in (
        (".odt", "application/vnd.oasis.opendocument.text"),
        (".ods", "application/vnd.oasis.opendocument.spreadsheet"),
        (".odp", "application/vnd.oasis.opendocument.presentation"),
    ):
        assert f'"{extension}": "{mime_type}"' in storage
        assert f'"{mime_type}"' in storage
    assert "extension in OPENDOCUMENT_MIME_BY_EXTENSION" in storage
    assert "espace-prof-81" in INDEX
    assert "Précédent" in APP_JS
    assert "Suivant" in APP_JS
    assert "setTimeout(startFreeExampleTutorial, 250);" in APP_JS
    tutorial_block = APP_JS.split("const tutorialSteps = [", 1)[1].split("];", 1)[0]
    assert tutorial_block.count("{ view:") >= 20
    assert "mène à un autre site" in APP_JS
    assert 'id="pronoteExternalLink"' in INDEX
    assert 'id="messagingExternalLink"' in INDEX
    assert "window.innerHeight - panel.offsetHeight - 16" in APP_JS


def test_description_publique_ne_divulgue_aucun_identifiant() -> None:
    assert "Créez, organisez et projetez vos cours" in INDEX
    assert "rose / it" not in INDEX
    assert "root / root" not in INDEX


def test_diapos_reordonnables_avec_miniatures() -> None:
    assert 'class="slide-thumbnails"' in APP_JS
    assert "function reorderStudioSlide(" in APP_JS
    assert 'draggable="true"' in APP_JS
    assert "application/x-studio-slide" in APP_JS
    assert "function moveStudioSlideBy(" in APP_JS
    assert "Remonter cette diapo" in APP_JS
    assert "Descendre cette diapo" in APP_JS
    assert "function deduplicateSlideElements(" in APP_JS
    assert "deduplicateSlideElements(activity.slides)" in APP_JS


def test_barre_texte_propose_taille_et_couleurs() -> None:
    assert "function resizeStudioText(" in APP_JS
    assert 'aria-label="Réduire la taille du texte"' in APP_JS
    assert 'aria-label="Augmenter la taille du texte"' in APP_JS
    assert 'aria-label="Couleur du texte"' in APP_JS
    assert 'document.execCommand("styleWithCSS", false, true)' in APP_JS
    assert ".studio-color-select" in STYLES
    assert 'aria-label="Police"' in APP_JS
    assert 'aria-label="Taille des lettres"' in APP_JS
    assert "function setStudioTextFont(" in APP_JS
    assert "function setStudioTextSize(" in APP_JS
    assert "function applyStudioTextSelectionSize(" in APP_JS
    assert "span.style.fontSize = `${requestedSize}px`" in APP_JS
    assert "function studioTextOverflows(" in APP_JS
    assert "trop grande pour cette zone de texte" in APP_JS
    assert "appliquée à la place" in APP_JS
    assert 'toast("Sélectionnez le texte dont vous voulez changer la taille.")' in APP_JS
    assert "font-size:${node.style.fontSize}" in APP_JS
    assert "'subscript'" in APP_JS and "'superscript'" in APP_JS
    assert "'justifyLeft'" in APP_JS and "'justifyFull'" in APP_JS
    assert "'hiliteColor'" in APP_JS
    assert '"SUB", "SUP", "SPAN"' in APP_JS
    assert "background-color:" in APP_JS
    assert "fontFamily:" in APP_JS
    assert 'id="studioTextFormatToolbar"' in APP_JS
    assert "function rememberStudioTextSelection(" in APP_JS
    assert "function updateStudioTextToolbarVisibility(" in APP_JS
    assert 'document.addEventListener("selectionchange"' in APP_JS
    assert "Gris foncé" in APP_JS and "Bleu foncé" in APP_JS
    assert ".studio-text-format[hidden]" in STYLES
    assert 'id="studioGeneralActions"' in APP_JS
    assert "hasSelectedTextItem" in APP_JS
    assert "generalActions.hidden = showFormatting" in APP_JS
    assert "range.selectNodeContents(text)" in APP_JS
    assert ".studio-general-actions[hidden]" in STYLES


def test_consigne_de_diapo_est_modifiable_et_conservee() -> None:
    assert "function slideInstruction(" in APP_JS
    assert "function renameStudioSlideInstruction(" in APP_JS
    assert ">Consigne diapo</button>" in APP_JS
    assert 'instruction:saved?.instruction||""' in APP_JS
    assert 'instruction: previousSlides.find(item=>item.id===slide.dataset.slideId)?.instruction || ""' in APP_JS
    assert "escapeHtml(slideInstruction(slide,index))" in APP_JS
    assert 'class="board-slide-instruction"' in APP_JS
    assert ".board-slide-instruction" in STYLES


def test_objets_interdiapos_et_documents_manipulables() -> None:
    assert "const slideCount = document.querySelectorAll" in APP_JS
    assert "selectStudioSlide(destination)" in APP_JS
    assert "hydrateDocumentPreviews();" in APP_JS
    assert "Temps prévu" in APP_JS
    assert "Contenu de l’activité" in APP_JS
    assert "plain-document-preview" in APP_JS
    assert "sheet-preview" in APP_JS
    assert ".slide-frame.drop-target" in STYLES
    assert "function updateSlideDuration(" in APP_JS
    assert 'class="slide-duration"' in APP_JS
    assert 'data-kind="pdf"' in STYLES


def test_plan_de_classe_et_emploi_du_temps_sont_disponibles() -> None:
    assert "function openSeatingPlan(" in APP_JS
    assert "Maximum 40" in APP_JS
    assert 'data-view="schedule"' in INDEX
    assert "function renderSchedule()" in APP_JS
    assert 'id="currentCourseShortcut"' not in INDEX
    assert "function updateCurrentCourseShortcut()" not in APP_JS


def test_plan_de_classe_style_cinema_et_emploi_du_temps_lycee() -> None:
    assert 'class="cinema-room"' in APP_JS
    assert "Nombre de bureaux" in APP_JS
    assert ".desk::before" in STYLES
    assert "function renderTimetableGrid()" in APP_JS
    assert '["lundi", "mardi", "mercredi", "jeudi", "vendredi"]' in APP_JS
    assert 'aria-label="Emploi du temps du lundi au vendredi"' in APP_JS
    assert ".timetable-course" in STYLES
    assert "assets/styles.css?v=espace-prof-47" in INDEX
    assert "assets/app.js?v=espace-prof-81" in INDEX
    assert "assets/api-client.js?v=espace-prof-6" in INDEX


def test_les_videos_non_natives_sont_converties_pour_le_navigateur() -> None:
    storage = (ROOT / "backend" / "app" / "services" / "storage.py").read_text(encoding="utf-8")
    for extension in (".avi", ".mkv", ".wmv", ".flv", ".m4v", ".mpeg", ".3gp", ".m2ts"):
        assert f'"{extension}"' in storage
    assert "def _convert_video_for_browser" in storage
    assert "def convert_stored_video" in storage
    assert '"-c:v", "libx264"' in storage
    assert '"-pix_fmt", "yuv420p"' in storage
    assert 'mime_type = "video/mp4"' in storage
    assert "window.ServerAPI.convertVideo(fileId)" in APP_JS
    assert 'request(`/files/${encodeURIComponent(fileId)}/convert-video`' in (ROOT / "assets" / "api-client.js").read_text(encoding="utf-8")
    store_stream_block = storage.split("def store_stream(", 1)[1].split("def store_upload(", 1)[0]
    assert "_convert_video_for_browser(target)" not in store_stream_block
    assert "Le lecteur déclenche déjà convert_stored_video" in store_stream_block
    assert "function startDeskMove(" in APP_JS
    assert "function deleteDesk(" in APP_JS
    assert "function addDesk(" in APP_JS
    assert "function setDeskCount(" in APP_JS
    assert ".desk-delete" in STYLES


def test_emploi_du_temps_est_un_calendrier_interactif() -> None:
    assert 'class="calendar-only"' in APP_JS
    assert "function openScheduleEditor(" in APP_JS
    assert "function moveScheduleItem(" in APP_JS
    assert "application/x-schedule-item" in APP_JS
    assert "function selectScheduleItem(" in APP_JS
    assert "Cours associé" in APP_JS
    render_schedule = APP_JS.split("function renderSchedule()", 1)[1].split("function selectScheduleItem", 1)[0]
    assert "form-grid" not in render_schedule
    assert "Seuls les horaires sont obligatoires" in APP_JS
    assert 'class="schedule-group-list"' in APP_JS
    assert 'name="classId"><option' in APP_JS
    assert 'name="groupTitle" size="4"' in APP_JS
    assert ".schedule-editor-form" in STYLES
    schedule_editor = APP_JS.split("function openScheduleEditor", 1)[1].split("function saveScheduleEditor", 1)[0]
    assert 'name="classId" required' not in schedule_editor
    assert 'name="groupTitle" required' not in schedule_editor


def test_import_pptx_par_depot_et_historique_du_studio() -> None:
    assert "function importPptxIntoLesson(" in APP_JS
    assert 'class="page-head lesson-pptx-drop"' in APP_JS
    assert "await importPptxAsSiteSlides(file)" in APP_JS
    assert "function undoStudioChange(" in APP_JS
    assert "function redoStudioChange(" in APP_JS
    assert "function deleteStudioSlide(" in APP_JS
    assert "studioUndoStack" in APP_JS
    assert "Ctrl+Z" in APP_JS
    assert 'class="slide-thumbnail-delete"' in APP_JS
    assert ".slide-frame.file-drop-target" in STYLES


def test_acces_rapide_affiche_les_trois_prochains_cours() -> None:
    assert "function upcomingScheduleItemsToday(" in APP_JS
    assert "slice(0,3)" in APP_JS
    assert "Les 3 prochains cours" in APP_JS
    assert 'class="shortcut-card upcoming-courses-card"' in APP_JS
    assert "function openUpcomingCourse(" in APP_JS


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


def test_removed_wikimedia_photo_is_repaired_in_seed_and_saved_workspaces() -> None:
    removed_url = "https://upload.wikimedia.org/wikipedia/commons/4/4e/Leonardo_da_Vinci_-_study_of_hands.jpg"
    replacement_url = "https://upload.wikimedia.org/wikipedia/commons/9/99/Leonardo_da_Vinci_-_Study_of_hands_-_WGA12812.jpg"

    assert APP_JS.count(removed_url) == 1
    assert replacement_url in APP_JS
    assert "repairKnownBrokenImageUrls(data);" in APP_JS


def test_suppression_objet_studio_est_enregistree_immediatement() -> None:
    selected_delete = APP_JS.split("async function deleteSelectedElement()", 1)[1].split(
        "async function deleteStudioElement", 1
    )[0]
    direct_delete = APP_JS.split("async function deleteStudioElement", 1)[1].split(
        "async function saveEditor", 1
    )[0]
    assert "await saveStudio(activityId" in selected_delete
    assert "await saveStudio(activityId" in direct_delete
    assert "Objet supprimé et enregistré." in selected_delete


def test_schedule_precedes_pronote_in_sidebar() -> None:
    assert INDEX.index('data-view="schedule"') < INDEX.index('id="pronoteExternalLink"')


def test_broken_private_slide_images_are_retried_with_session_cookie() -> None:
    assert 'onerror="recoverSlideImage(this)"' in APP_JS
    assert 'fetch(source, { credentials: "include", cache: "no-store" })' in APP_JS
    assert "Photo introuvable" in APP_JS
    assert ".slide-image-error" in STYLES


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


def test_homepage_has_canonical_search_metadata() -> None:
    assert '<link rel="canonical" href="https://monespaceprof.com/"' in INDEX
    assert 'name="robots" content="index, follow, max-snippet:-1, max-image-preview:large"' in INDEX
