      const cachePrefix = "mep-local-draft-v1";
      const resourceTypes = {
        TEXT: "Texte",
        IMAGE: "Image / affiche",
        AUDIO: "Audio",
        VIDEO: "Video",
        PDF: "PDF",
        DOCUMENT: "Document",
        LINK: "Lien externe",
        VOCABULARY: "Fiche vocabulaire",
        DICTATION: "Dictée",
        QUIZ: "Quiz",
        HOMEWORK: "Devoir",
        CORRECTION: "Correction"
      };
      const categories = ["Audios", "Vidéos", "Affiches", "Documents", "Fiches vocabulaire", "Quiz", "Corrections", "Liens utiles"];
      const modalities = ["seul", "par deux", "groupe", "classe entière"];
      const slideSize = { width: 960, height: 540, gap: 36 };
      let authenticatedUser = null;
      let storageInfo = null;
      let state = ensureDemoData(seedData());
      let currentView = "dashboard";
      let currentPage = { type: "classes" };
      let currentTableauPage = { type: "classes" };
      let currentStudioSlideIndex = 0;
      let timerRemaining = 5 * 60;
      let timerInterval = null;
      let tourIndex = 0;
      let tourRunning = false;
      let activeTutorialSteps = null;
      let freeExampleOpen = false;
      let pendingWorkspaceSave = Promise.resolve(true);

      function uid(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      }

      function slugify(text) {
        return String(text || "sans-titre").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
      }

      async function loginAccount(username, password) {
        const cleanUsername = slugify(username);
        if (!cleanUsername || !password) return false;
        try {
          authenticatedUser = await window.ServerAPI.login(cleanUsername, password);
        } catch (error) {
          console.warn("Connexion serveur refusée", error);
          return false;
        }
        if (authenticatedUser.must_change_password) {
          state = ensureDemoData(seedData());
        } else {
          const workspace = await window.ServerAPI.loadWorkspace();
          state = Object.keys(workspace.content || {}).length ? ensureDemoData(workspace.content) : ensureDemoData(seedData());
          storageInfo = await window.ServerAPI.storage().catch(() => null);
        }
        currentView = "dashboard";
        currentPage = { type: "classes" };
        currentTableauPage = { type: "classes" };
        if (authenticatedUser.must_change_password) setTimeout(() => offerPasswordChange(), 120);
        return true;
      }

      function currentUsername() {
        return authenticatedUser?.username || "";
      }

      function isLoggedIn() {
        return Boolean(currentUsername());
      }

      function editOnly(html) {
        return isLoggedIn() ? html : "";
      }

      function requireLogin() {
        if (isLoggedIn()) return true;
        toast("Connectez-vous pour modifier.");
        return false;
      }

      function showLogin() {
        freeExampleOpen = false;
        endTutorial();
        document.querySelector("#appPage").hidden = true;
        document.querySelector("#boardPage").hidden = true;
        document.querySelector("#loginPage").hidden = false;
        setTimeout(() => document.querySelector("input[name='username']")?.focus(), 50);
      }

      function openFreeExample() {
        window.ServerAPI.logout().catch(() => {});
        authenticatedUser = null;
        storageInfo = null;
        freeExampleOpen = true;
        state = ensureDemoData(seedData());
        currentView = "dashboard";
        currentPage = { type: "classes" };
        currentTableauPage = { type: "classes" };
        render();
        setTimeout(startFreeExampleTutorial, 180);
      }

      function currentCacheKey() {
        return `${cachePrefix}-${currentUsername() || "public"}`;
      }

      function defaultStudentClass() {
        const now = new Date().toISOString();
        return {
          id: uid("student-class"),
          title: "5emeA",
          description: "Exemple de classe réelle avec élèves.",
          order: 1,
          isVisible: true,
          updatedAt: now,
          students: ["Giulia Rossi", "Luca Moretti", "Emma Bernard"]
        };
      }

      function seedData() {
        const now = new Date().toISOString();
        const makeActivity = (title, description, objective, instruction, order, slides) => ({
          id: uid("act"),
          title,
          slug: slugify(title),
          description,
          objective,
          instruction,
          estimatedDuration: "20 min",
          modality: "classe entiere",
          level: "",
          privateNotes: "Notes privees exemple : adapter le rythme selon la classe.",
          order,
          isVisible: true,
          updatedAt: now,
          slides: slides.map((slide) => ({
            id: uid("slide"),
            elements: slide.map((element) => ({ id: uid("el"), ...element }))
          })),
          resources: []
        });
        const titleSlide = (title, subtitle) => [
          { kind: "text", x: 70, y: 70, w: 820, h: 120, value: title, fontSize: 54 },
          { kind: "text", x: 70, y: 220, w: 820, h: 170, value: subtitle, fontSize: 34 }
        ];
        const imageSlide = (title, text, url) => [
          { kind: "text", x: 55, y: 40, w: 470, h: 110, value: title, fontSize: 42 },
          { kind: "text", x: 55, y: 175, w: 390, h: 250, value: text, fontSize: 30 },
          { kind: "image", x: 500, y: 60, w: 380, h: 380, value: url }
        ];
        const demoPresentationSlide = [
          { kind: "text", x: 60, y: 30, w: 780, h: 68, value: "Leonardo da Vinci", fontSize: 42 },
          { kind: "image", x: 70, y: 130, w: 270, h: 340, value: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Leonardo_self.jpg" },
          { kind: "video", x: 390, y: 130, w: 500, h: 280, value: "uploads/demo-leonardo.mp4" },
          { kind: "text", x: 390, y: 430, w: 500, h: 56, value: "Observe l'image, lis le titre, puis lance la video.", fontSize: 20 }
        ];
        const classes = [
          {
            title: "5eme",
            description: "Decouvrir Leonardo da Vinci par l'observation, les mots simples et les images.",
            sequences: [
              {
                title: "Leonardo, un genio italiano",
                description: "Premiere approche du personnage et de la Renaissance.",
                lessons: [
                  {
                    title: "Chi e Leonardo?",
                    description: "Identifier Leonardo et presenter une personne.",
                    activities: [
                      makeActivity("Carte d'identite de Leonardo", "Presentation courte pour decouvrir Leonardo da Vinci.", "Comprendre une presentation simple.", "Observe les images et retrouve les informations importantes.", 1, [
                        demoPresentationSlide,
                        imageSlide("Osserva", "Nome: Leonardo\nCitta: Vinci\nPaese: Italia\nEpoca: Rinascimento", "https://upload.wikimedia.org/wikipedia/commons/b/ba/Leonardo_self.jpg")
                      ]),
                      makeActivity("Vero o falso?", "Petite activite orale sur Leonardo.", "Reagir a des phrases simples.", "Dis si la phrase est vera o falsa, puis corrige avec la classe.", 2, [
                        titleSlide("Vero o falso?", "Leonardo era solo un pittore.\nLeonardo viveva in Italia.\nLa Gioconda e un quadro famoso."),
                        titleSlide("Correzione", "Leonardo non era solo pittore: era anche inventore, scienziato e ingegnere.")
                      ])
                    ]
                  },
                  {
                    title: "La bottega dell'artista",
                    description: "Vocabulaire de l'atelier et des objets.",
                    activities: [
                      makeActivity("Dans l'atelier", "Associer des mots italiens a des objets.", "Acquerir du vocabulaire culturel.", "Observe l'atelier et associe : pennello, quadro, disegno, macchina.", 1, [
                        titleSlide("La bottega", "Un artista lavora con idee, strumenti e pazienza."),
                        imageSlide("Lessico", "il pennello\nil quadro\nil disegno\nla macchina", "https://upload.wikimedia.org/wikipedia/commons/4/4e/Leonardo_da_Vinci_-_study_of_hands.jpg")
                      ])
                    ]
                  }
                ]
              },
              {
                title: "La Gioconda sorride",
                description: "Decrire une oeuvre celebre avec des adjectifs simples.",
                lessons: [
                  {
                    title: "Descrivere un ritratto",
                    description: "Observer et decrire.",
                    activities: [
                      makeActivity("La Gioconda", "Lecture d'image autour de Mona Lisa.", "Decrire une image avec des adjectifs.", "Observe il ritratto. Scegli tre parole per descriverlo.", 1, [
                        imageSlide("La Gioconda", "misteriosa\ncalma\nfamosa\nitaliana", "https://upload.wikimedia.org/wikipedia/commons/6/6a/Mona_Lisa.jpg"),
                        titleSlide("Parla", "Secondo te, perche sorride?\nFormula una frase semplice in italiano.")
                      ])
                    ]
                  }
                ]
              }
            ]
          },
          {
            title: "Seconde",
            description: "Analyser l'artiste dans les cours italiennes.",
            sequences: [
              {
                title: "Artista di corte",
                description: "Leonardo au service des puissants.",
                lessons: [
                  {
                    title: "Scrivere a un mecenate",
                    description: "Comprendre et produire une lettre de candidature.",
                    activities: [
                      makeActivity("Lettre a Ludovico Sforza", "Simulation de candidature.", "Presenter ses competences.", "Ecris 5 lignes : Sono capace di..., posso..., vorrei...", 1, [
                        titleSlide("Caro Ludovico Sforza", "Leonardo propose ses talents : peinture, architecture, machines, spectacles."),
                        titleSlide("A toi", "Choisis 3 competences et convaincs ton mecenate.")
                      ])
                    ]
                  }
                ]
              }
            ]
          }
        ];
        const builtClasses = classes.map((classe, classIndex) => ({
          id: uid("class"),
          title: classe.title,
          slug: slugify(classe.title),
          description: classe.description,
          order: classIndex + 1,
          isVisible: true,
          updatedAt: now,
          sequences: classe.sequences.map((sequence, sequenceIndex) => ({
            id: uid("seq"),
            title: sequence.title,
            slug: slugify(sequence.title),
            description: sequence.description,
            order: sequenceIndex + 1,
            isVisible: true,
            updatedAt: now,
            lessons: sequence.lessons.map((lesson, lessonIndex) => ({
              id: uid("lesson"),
              title: lesson.title,
              slug: slugify(lesson.title),
              description: lesson.description,
              order: lessonIndex + 1,
              isVisible: true,
              updatedAt: now,
              activities: lesson.activities
            }))
          }))
        }));
        return {
          demoVersion: 2,
          classes: builtClasses,
          studentClasses: [defaultStudentClass()],
          tools: {
            wheelHistory: {},
            wheelCounts: {},
            wheelLimits: {},
            wheelAbsences: {}
          },
          resources: []
        };
      }

      function ensureDemoData(data) {
        const looksLikeOldPublicExample = !isLoggedIn() && Array.isArray(data?.classes) && data.classes.length === 1 && data.classes[0]?.title === "Classe exemple";
        if (!data || typeof data !== "object" || !Array.isArray(data.classes) || looksLikeOldPublicExample) {
          data = seedData();
        }
        data.demoVersion = 2;
        data.categories = Array.isArray(data.categories) ? data.categories : ["Collège", "Lycée"];
        data.categories = data.categories.filter((category) => !/séquence\(s\)|ModifierSupprimer|Analyser l'artiste/i.test(category));
        data.resources = Array.isArray(data.resources) ? data.resources : [];
        data.studentClasses = Array.isArray(data.studentClasses) ? data.studentClasses : [];
        data.tools = data.tools && typeof data.tools === "object" ? data.tools : {};
        data.tools.wheelHistory = data.tools.wheelHistory && typeof data.tools.wheelHistory === "object" ? data.tools.wheelHistory : {};
        data.tools.wheelCounts = data.tools.wheelCounts && typeof data.tools.wheelCounts === "object" ? data.tools.wheelCounts : {};
        data.tools.wheelLimits = data.tools.wheelLimits && typeof data.tools.wheelLimits === "object" ? data.tools.wheelLimits : {};
        data.tools.wheelAbsences = data.tools.wheelAbsences && typeof data.tools.wheelAbsences === "object" ? data.tools.wheelAbsences : {};
        data.classes.forEach((classe) => (classe.sequences || []).forEach((sequence) => (sequence.lessons || []).forEach((lesson) => (lesson.activities || []).forEach(ensureActivitySlides))));
        data.classes.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
        return data;
      }

      function ensureActivitySlides(activity) {
        if (Array.isArray(activity.slides) && activity.slides.length) return activity;
        activity.slides = [{
          id: uid("slide"),
          elements: [
            { id: uid("el"), kind: "text", x: 70, y: 62, w: 820, h: 105, value: activity.title || "Activité", fontSize: 50 },
            { id: uid("el"), kind: "text", x: 70, y: 205, w: 820, h: 210, value: activity.instruction || activity.objective || activity.description || "Nouvelle diapo", fontSize: 34 }
          ]
        }];
        return activity;
      }

      function loadData() {
        try {
          return JSON.parse(localStorage.getItem(currentCacheKey())) || seedData();
        } catch {
          return seedData();
        }
      }

      function saveData(message) {
        localStorage.setItem(currentCacheKey(), JSON.stringify({ ...state, cachedAt: new Date().toISOString() }));
        if (isLoggedIn()) {
          const snapshot = JSON.parse(JSON.stringify(state));
          pendingWorkspaceSave = pendingWorkspaceSave
            .then(() => window.ServerAPI.saveWorkspace(snapshot, true))
            .then(() => true)
            .catch((error) => {
              console.warn("Sauvegarde serveur différée", error);
              toast("Sauvegarde en attente de connexion.");
              return false;
            });
        }
        if (message) toast(message);
        render();
      }

      function offerPasswordChange() {
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `
          <div class="drawer">
            <div class="drawer-head"><div><p class="small" style="font-weight:850;color:var(--wine-700)">Sécurité</p><h2 style="margin:0;color:var(--wine-900)">Changer le mot de passe</h2></div></div>
            <form class="drawer-body" id="passwordChangeForm">
              <p class="small muted">Le mot de passe initial doit être remplacé avant de continuer.</p>
              <label class="label">Mot de passe actuel <input name="currentPassword" type="password" required></label>
              <label class="label">Nouveau mot de passe <input name="newPassword" type="password" minlength="10" required></label>
              <div class="row"><button class="btn primary" type="submit">Enregistrer</button></div>
            </form>
          </div>`;
        document.querySelector("#passwordChangeForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          try {
            await window.ServerAPI.changePassword(String(form.get("currentPassword") || ""), String(form.get("newPassword") || ""));
            authenticatedUser.must_change_password = false;
            const workspace = await window.ServerAPI.loadWorkspace();
            state = Object.keys(workspace.content || {}).length ? ensureDemoData(workspace.content) : ensureDemoData(seedData());
            storageInfo = await window.ServerAPI.storage().catch(() => null);
            closeEditor();
            toast("Mot de passe mis à jour.");
          } catch (error) {
            toast("Le mot de passe n'a pas pu être modifié.");
          }
        });
      }

      function toast(message) {
        const notice = document.querySelector("#notice");
        notice.textContent = message;
        notice.hidden = false;
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => notice.hidden = true, 2200);
      }

      function copyContact(value) {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(value).then(() => toast("Copie."));
          return;
        }
        const field = document.createElement("textarea");
        field.value = value;
        field.style.position = "fixed";
        field.style.left = "-999px";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        field.remove();
        toast("Copie.");
      }

      function flatten() {
        const sequences = [];
        const lessons = [];
        const activities = [];
        state.classes.forEach((classe) => {
          (classe.sequences || []).forEach((sequence) => {
            sequences.push({ ...sequence, classId: classe.id, classTitle: classe.title });
            (sequence.lessons || []).forEach((lesson) => {
              lessons.push({ ...lesson, classId: classe.id, sequenceId: sequence.id, classTitle: classe.title, sequenceTitle: sequence.title });
              (lesson.activities || []).forEach((activity) => {
                activities.push({ ...activity, classId: classe.id, sequenceId: sequence.id, lessonId: lesson.id, classTitle: classe.title, sequenceTitle: sequence.title, lessonTitle: lesson.title });
              });
            });
          });
        });
        return { classes: state.classes, sequences, lessons, activities, resources: allResources() };
      }

      function allResources() {
        const attached = [];
        state.classes.forEach((classe) => (classe.sequences || []).forEach((sequence) => (sequence.lessons || []).forEach((lesson) => (lesson.activities || []).forEach((activity) => {
          (activity.resources || []).forEach((resource) => attached.push({ ...resource, activityId: activity.id, activityTitle: activity.title }));
        }))));
        return [...state.resources, ...attached];
      }

      function findActivity(id) {
        for (const classe of state.classes) for (const sequence of classe.sequences) for (const lesson of sequence.lessons) {
          const index = lesson.activities.findIndex((activity) => activity.id === id);
          if (index >= 0) return { activity: lesson.activities[index], lesson, sequence, classe, index };
        }
        return null;
      }

      function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
      }

      function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
      }

      function kindFromUrl(url) {
        if (youtubeId(url)) return "youtube";
        if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)) return "image";
        if (/\.(mp3|wav|ogg)(\?|#|$)/i.test(url)) return "audio";
        if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) return "video";
        return "embed";
      }

      function youtubeId(url) {
        const value = String(url || "");
        const match = value.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
        return match ? match[1] : "";
      }

      function youtubeCard(url) {
        const id = youtubeId(url);
        if (!id) return "";
        const watchUrl = `https://www.youtube.com/watch?v=${id}`;
        const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
        return `<div class="youtube-card"><img src="${thumb}" alt=""><div><a href="${watchUrl}" target="_blank" rel="noreferrer">Lire la video sur YouTube</a><span>YouTube bloque parfois la lecture integree depuis un fichier HTML local.</span></div></div>`;
      }

      function toEmbedUrl(url) {
        const value = String(url || "");
        const youtube = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
        return escapeAttr(value);
      }

      function setView(view) {
        if (tourRunning) endTutorial();
        currentView = view;
        if (view === "classes") currentPage = { type: "classes" };
        if (view === "dashboard") currentTableauPage = { type: "classes" };
        document.querySelectorAll(".nav-button[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
        render();
      }

      function appUrl(params = {}) {
        const url = new URL(window.location.href);
        url.search = "";
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
        });
        return url.toString();
      }

      function openUrlInNewTabAfterSave(url) {
        const target = window.open("about:blank", "_blank");
        if (!target) {
          toast("Autorisez les fenêtres contextuelles pour ouvrir cette vue.");
          return;
        }
        target.opener = null;
        Promise.resolve(pendingWorkspaceSave).then((saved) => {
          if (saved || !isLoggedIn()) {
            target.location.replace(url);
            return;
          }
          target.close();
          toast("La vue n'a pas été ouverte car l'enregistrement serveur a échoué.");
        });
      }

      function openViewInNewTab(view) {
        openUrlInNewTabAfterSave(appUrl({ view }));
      }

      function openBoardInNewTab(activityId, slideIndex = 0) {
        openUrlInNewTabAfterSave(appUrl({ board: activityId, slide: slideIndex }));
      }

      function applyInitialRoute() {
        const params = new URLSearchParams(window.location.search);
        const view = params.get("view");
        if (view && ["dashboard", "classes", "studentClasses", "tools", "search", "tutorial", "settings"].includes(view)) {
          currentView = view;
        }
      }

      function openTableauClass(id) {
        currentView = "dashboard";
        currentTableauPage = { type: "class", classId: id };
        render();
      }

      function openTableauSequence(classId, sequenceId) {
        currentView = "dashboard";
        currentTableauPage = { type: "sequence", classId, sequenceId };
        render();
      }

      function openTableauLesson(classId, sequenceId, lessonId) {
        currentView = "dashboard";
        currentTableauPage = { type: "lesson", classId, sequenceId, lessonId };
        render();
      }

      function openClassPage(id) {
        currentView = "classes";
        currentPage = { type: "class", classId: id };
        render();
      }

      function openSequencePage(classId, sequenceId) {
        currentView = "classes";
        currentPage = { type: "sequence", classId, sequenceId };
        render();
      }

      function openLessonPage(classId, sequenceId, lessonId) {
        currentView = "classes";
        currentPage = { type: "lesson", classId, sequenceId, lessonId };
        render();
      }

      function render() {
        if (!isLoggedIn() && !freeExampleOpen) {
          showLogin();
          return;
        }
        document.querySelector("#loginPage").hidden = true;
        document.querySelector("#appPage").hidden = false;
        document.querySelector("#boardPage").hidden = true;
        const titles = {
          dashboard: ["Cours par niveau à projeter", "Naviguer jusqu'à la présentation à afficher."],
          classes: ["Cours par niveau modifiable", "Classe > Séquence > Séance > Activité."],
          studentClasses: ["Groupes Classes", "Groupes réels et listes d'élèves."],
          tools: ["Roue de la fortune et chrono", "Tirages et minuteur de classe."],
          search: ["Recherche ressource ou activité", "Retrouver rapidement une activité ou une ressource."],
          tutorial: ["Tutoriel", "Visite guidée de toutes les parties du site."],
          settings: ["Réglages", "Configuration locale du site HTML."]
        };
        const selectedNavButton = document.querySelector(`.nav-button[data-view="${currentView}"]`);
        document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
          button.classList.toggle("active", button.dataset.view === currentView);
        });
        document.title = selectedNavButton?.textContent.trim() || titles[currentView][0];
        document.querySelector("#pageTitle").textContent = titles[currentView][0];
        document.querySelector("#pageSubtitle").textContent = titles[currentView][1];
        document.querySelector("#openBoardBtn").hidden = currentView === "dashboard";
        document.querySelector("#logoutBtn").hidden = !isLoggedIn();
        document.querySelector("#loginNavBtn").hidden = isLoggedIn();
        document.querySelector("#exampleAd").hidden = !freeExampleOpen || isLoggedIn();
        document.querySelector(".sidebar-mail").hidden = freeExampleOpen && !isLoggedIn();
        if (currentView === "dashboard") renderDashboard();
        if (currentView === "classes") renderClasses();
        if (currentView === "studentClasses") renderStudentClasses();
        if (currentView === "tools") renderTools();
        if (currentView === "search") renderSearch();
        if (currentView === "tutorial") renderTutorial();
        if (currentView === "settings") renderSettings();
      }

      function renderDashboard() {
        if (currentTableauPage.type === "class") return renderTableauClass(currentTableauPage.classId);
        if (currentTableauPage.type === "sequence") return renderTableauSequence(currentTableauPage.classId, currentTableauPage.sequenceId);
        if (currentTableauPage.type === "lesson") return renderTableauLesson(currentTableauPage.classId, currentTableauPage.sequenceId, currentTableauPage.lessonId);
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb">Cours à projeter / Classes</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">Choisir une classe</h2>
            <p class="muted">Cette vue sert uniquement à trouver et afficher une présentation.</p>
          </section>
          <section class="page-grid">${state.classes.filter((classe) => classe.isVisible !== false).map(tableauClassCard).join("")}</section>
        `;
      }

      function metric(label, value) {
        return `<div class="card"><p class="muted">${label}</p><h2 style="font-size:42px">${value}</h2></div>`;
      }

      function classCard(classe, number) {
        return `<article class="card entity-card">
          <div class="row">
            <div><p class="small" style="font-weight:850;color:var(--wine-700)">N° ${number || classe.order || ""}</p><h3 style="font-size:28px">${escapeHtml(classe.title)}</h3><p class="muted small">${escapeHtml(classe.description)}</p></div>
            ${classe.isVisible ? "" : "<span class='pill'>Masque</span>"}
          </div>
          <div class="row wrap">
            <p class="pill">${classe.sequences.length} séquence(s)</p>
            ${editOnly(moveButtons("class", classe.id))}
            <button class="btn primary" onclick="openClassPage('${classe.id}')">${isLoggedIn() ? "Modifier" : "Voir"}</button>
            ${editOnly(`<button class="btn danger" onclick="removeItem('class','${classe.id}')">Supprimer</button>`)}
          </div>
        </article>`;
      }

      function dashboardClassCard(classe) {
        return `<article class="card entity-card">
          <div>
            <h3 style="font-size:26px">${escapeHtml(classe.title)}</h3>
            <p class="muted small">${escapeHtml(classe.description)}</p>
          </div>
          <div class="row wrap">
            <p class="pill">${classe.sequences.length} sequence(s)</p>
            <button class="btn primary" onclick="openClassPage('${classe.id}')">Ouvrir</button>
          </div>
        </article>`;
      }

      function tableauClassCard(classe) {
        return `<article class="card entity-card">
          <div>
            <h3 style="font-size:28px">${escapeHtml(classe.title)}</h3>
            <p class="muted small">${classe.sequences.length} séquence(s)</p>
          </div>
          <button class="btn primary" onclick="openTableauClass('${classe.id}')">Ouvrir</button>
        </article>`;
      }

      function renderTableauClass(classId) {
        const classe = findItem("class", classId);
        if (!classe) {
          currentTableauPage = { type: "classes" };
          return renderDashboard();
        }
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb"><button onclick="currentTableauPage={type:'classes'};render()">Cours à projeter</button> / ${escapeHtml(classe.title)}</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(classe.title)}</h2>
            <p class="muted">Choisir une séquence.</p>
          </section>
          <section class="list-table">${classe.sequences.filter((sequence) => sequence.isVisible !== false).map((sequence) => tableauSequenceCard(classe, sequence)).join("") || empty("Aucune séquence visible.")}</section>
        `;
      }

      function tableauSequenceCard(classe, sequence) {
        return `<article class="card entity-card">
          <div>
            <p class="small" style="font-weight:850;color:var(--wine-700)">Séquence</p>
            <h3 style="font-size:24px">${escapeHtml(sequence.title)}</h3>
            <p class="muted small">${sequence.lessons.length} séance(s)</p>
          </div>
          <button class="btn primary" onclick="openTableauSequence('${classe.id}','${sequence.id}')">Ouvrir</button>
        </article>`;
      }

      function renderTableauSequence(classId, sequenceId) {
        const classe = findItem("class", classId);
        const sequence = findItem("sequence", sequenceId);
        if (!classe || !sequence) {
          currentTableauPage = { type: "classes" };
          return renderDashboard();
        }
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb"><button onclick="currentTableauPage={type:'classes'};render()">Cours à projeter</button> / <button onclick="openTableauClass('${classe.id}')">${escapeHtml(classe.title)}</button> / ${escapeHtml(sequence.title)}</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(sequence.title)}</h2>
            <p class="muted">Choisir une séance.</p>
          </section>
          <section class="list-table">${sequence.lessons.filter((lesson) => lesson.isVisible !== false).map((lesson) => tableauLessonRow(classe, sequence, lesson)).join("") || empty("Aucune séance visible.")}</section>
        `;
      }

      function tableauLessonRow(classe, sequence, lesson) {
        return `<article class="list-row">
          <div>
            <p class="small" style="font-weight:850;color:var(--wine-700)">Séance</p>
            <h3>${escapeHtml(lesson.title)}</h3>
            <p class="muted small">${lesson.activities.length} activité(s)</p>
          </div>
          <button class="btn primary" onclick="openTableauLesson('${classe.id}','${sequence.id}','${lesson.id}')">Ouvrir</button>
        </article>`;
      }

      function renderTableauLesson(classId, sequenceId, lessonId) {
        const classe = findItem("class", classId);
        const sequence = findItem("sequence", sequenceId);
        const lesson = findItem("lesson", lessonId);
        if (!classe || !sequence || !lesson) {
          currentTableauPage = { type: "classes" };
          return renderDashboard();
        }
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb"><button onclick="currentTableauPage={type:'classes'};render()">Cours à projeter</button> / <button onclick="openTableauClass('${classe.id}')">${escapeHtml(classe.title)}</button> / <button onclick="openTableauSequence('${classe.id}','${sequence.id}')">${escapeHtml(sequence.title)}</button> / ${escapeHtml(lesson.title)}</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(lesson.title)}</h2>
            <p class="muted">Choisir la présentation à afficher.</p>
          </section>
          <section class="numbered-list">${lesson.activities.filter((activity) => activity.isVisible !== false).map(tableauActivityCard).join("") || empty("Aucune activité visible.")}</section>
        `;
      }

      function tableauActivityCard(activity) {
        return `<article class="card entity-card">
          <div>
            <p class="small" style="font-weight:850;color:var(--wine-700)">Présentation</p>
            <h3 style="font-size:24px">${escapeHtml(activity.title)}</h3>
            <p class="muted small">${escapeHtml(activity.description || "Activité à projeter.")}</p>
          </div>
          <button class="btn primary" onclick="openBoardInNewTab('${activity.id}',0)">Présenter</button>
        </article>`;
      }

      function dashboardActivityCard(activity) {
        return `<article class="card activity-card">
          <div class="activity-card-body">
            <div>
              <p class="small" style="font-weight:850;color:var(--wine-700)">${escapeHtml(activity.level || activity.classTitle || "Activité")}</p>
              <h3>${escapeHtml(activity.title)}</h3>
              <p class="muted small">${escapeHtml(activity.objective || activity.description || "Présentation")}</p>
            </div>
            <div class="activity-actions">
              <button class="btn primary" onclick="openBoardInNewTab('${activity.id}',0)">Présenter</button>
              <button class="btn" onclick="setView('classes')">Retrouver dans les classes</button>
            </div>
          </div>
        </article>`;
      }

      function renderClasses() {
        if (currentPage.type === "class") return renderClassPage(currentPage.classId);
        if (currentPage.type === "sequence") return renderSequencePage(currentPage.classId, currentPage.sequenceId);
        if (currentPage.type === "lesson") return renderLessonPage(currentPage.classId, currentPage.sequenceId, currentPage.lessonId);
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="row wrap">
              <div>
                <div class="breadcrumb">Accueil / Cours par niveau modifiable</div>
                <h2 style="margin:0;color:var(--wine-900);font-size:34px">Toutes les classes</h2>
                <p class="muted">Clique sur Modifier pour entrer dans une classe et gérer ses séquences sur une page dédiée.</p>
              </div>
              ${editOnly(`<div class="row wrap"><button class="btn" onclick="manageCategories()">Catégorie</button><button class="btn primary" onclick="openEditor('class')">Ajouter une classe</button></div>`)}
            </div>
          </section>
          <section>${state.categories.map((category) => `<div class="category-group"><h3 class="category-title" draggable="true" data-category="${escapeAttr(category)}">— ${escapeHtml(category)} —</h3><div class="page-grid">${state.classes.filter((classe) => classe.category === category).map(classCard).join("") || empty("Aucune classe dans cette catégorie.")}</div></div>`).join("")}${state.classes.some((classe) => !classe.category || !state.categories.includes(classe.category)) ? `<div class="category-group"><h3 class="category-title">— Sans catégorie —</h3><div class="page-grid">${state.classes.filter((classe) => !classe.category || !state.categories.includes(classe.category)).map(classCard).join("")}</div></div>` : ""}</section>
        `;
        document.querySelectorAll(".category-title").forEach((heading) => heading.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", heading.dataset.category)));
        document.querySelectorAll(".category-title").forEach((heading) => heading.addEventListener("dragover", (event) => event.preventDefault()));
        document.querySelectorAll(".category-title").forEach((heading) => heading.addEventListener("drop", (event) => reorderCategory(event, heading.dataset.category)));
      }

      function manageCategories() {
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `<div class="drawer"><div class="drawer-head"><strong>Catégories</strong><button class="btn" type="button" onclick="closeEditor()">Fermer</button></div><div class="drawer-body"><p class="muted small">Glissez une catégorie pour changer son ordre.</p><div id="categoryEditorList">${state.categories.map((category) => `<div class="row wrap category-editor-item" draggable="true" data-category="${escapeAttr(category)}"><input class="input" value="${escapeAttr(category)}"><button class="btn danger" type="button" onclick="removeCategory('${escapeAttr(category)}')">Supprimer</button></div>`).join("")}</div><button class="btn" type="button" onclick="addCategoryEditorRow()">Ajouter une catégorie</button><hr><p class="muted small">Items</p><div id="categoryItems">${state.classes.map((classe) => `<label class="label">${escapeHtml(classe.title)}<select data-class-category="${escapeAttr(classe.id)}"><option value="">Sans catégorie</option>${state.categories.map((category) => `<option value="${escapeAttr(category)}" ${classe.category === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></label>`).join("")}</div><button class="btn primary" type="button" onclick="saveCategoriesFromDrawer()">Enregistrer</button></div></div>`;
        document.querySelectorAll(".category-editor-item").forEach((item) => item.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", item.dataset.category)));
        document.querySelectorAll(".category-editor-item").forEach((item) => item.addEventListener("dragover", (event) => event.preventDefault()));
        document.querySelectorAll(".category-editor-item").forEach((item) => item.addEventListener("drop", (event) => { event.preventDefault(); const source = event.dataTransfer.getData("text/plain"); const node = [...document.querySelectorAll(".category-editor-item")].find((entry) => entry.dataset.category === source); if (node && node !== item) item.parentNode.insertBefore(node, item); }));
        document.querySelectorAll("[data-class-category]").forEach((select) => select.closest(".label").setAttribute("draggable", "true"));
        organizeCategoryDrawerItems();
      }

      function organizeCategoryDrawerItems() {
        const list = document.querySelector("#categoryItems");
        if (!list) return;
        const labels = [...list.querySelectorAll(".label")];
        const groups = new Map();
        state.categories.forEach((category) => { const group = document.createElement("div"); group.className = "category-items-group"; group.innerHTML = `<h3>${escapeHtml(category)}</h3>`; list.appendChild(group); groups.set(category, group); });
        const uncategorized = document.createElement("div"); uncategorized.className = "category-items-group"; uncategorized.innerHTML = "<h3>Sans catégorie</h3>"; list.appendChild(uncategorized);
        labels.forEach((label) => { const select = label.querySelector("select"); const group = groups.get(select.value) || uncategorized; group.appendChild(label); });
      }

      function addCategoryEditorRow() { const list = document.querySelector("#categoryEditorList"); list.insertAdjacentHTML("beforeend", `<div class="row wrap category-editor-item"><input class="input" placeholder="Nouvelle catégorie"><button class="btn danger" type="button" onclick="this.parentElement.remove()">Supprimer</button></div>`); }
      function renderCategoryGroups() { return state.categories.map((category) => `<div class="category-preview"><h3>${escapeHtml(category)}</h3>${state.classes.filter((classe) => classe.category === category).map((classe) => `<div class="category-preview-item">${escapeHtml(classe.title)}</div>`).join("") || `<p class="muted small">Aucun item</p>`}</div>`).join("") + `<div class="category-preview"><h3>Sans catégorie</h3>${state.classes.filter((classe) => !classe.category || !state.categories.includes(classe.category)).map((classe) => `<div class="category-preview-item">${escapeHtml(classe.title)}</div>`).join("")}</div>`; }
      function removeCategory(category) { const item = [...document.querySelectorAll(".category-editor-item")].find((entry) => entry.dataset.category === category); if (item) item.remove(); }
      function saveCategoriesFromDrawer() { const next = [...document.querySelectorAll("#categoryEditorList input")].map((input) => input.value.trim()).filter(Boolean); state.categories = [...new Set(next)]; document.querySelectorAll("[data-class-category]").forEach((select) => { const classe = state.classes.find((item) => item.id === select.dataset.classCategory); if (classe) classe.category = select.value || ""; }); saveData("Catégories mises à jour."); }

      function reorderCategory(event, target) {
        const source = event.dataTransfer.getData("text/plain");
        if (!source || source === target) return;
        const next = state.categories.filter((item) => item !== source);
        next.splice(next.indexOf(target), 0, source);
        state.categories = next;
        saveData("Ordre des catégories mis à jour.");
      }

      function renderStudentClasses() {
        const studentClasses = state.studentClasses || [];
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="row wrap">
              <div>
                <div class="breadcrumb">Groupes Classes</div>
                <h2 style="margin:0;color:var(--wine-900);font-size:34px">Groupes Classes</h2>
                <p class="muted">Ici, on gère les groupes avec les noms des élèves. C'est séparé des cours par niveau.</p>
              </div>
              ${editOnly(`<button class="btn primary" onclick="openEditor('studentClass')">Ajouter un groupe</button>`)}
            </div>
          </section>
          <section class="page-grid">${studentClasses.map(studentClassCard).join("") || empty("Aucun groupe classe.")}</section>
        `;
      }

      function studentClassCard(classe) {
        const students = Array.isArray(classe.students) ? classe.students : [];
        return `<article class="card entity-card">
          <div>
            <h3 style="font-size:28px">${escapeHtml(classe.title)}</h3>
            <p class="muted small">${escapeHtml(classe.description || "")}</p>
            <p class="pill" style="margin-top:10px">${students.length} élève(s)</p>
            <div class="small muted" style="margin-top:12px;line-height:1.7">${students.slice(0, 6).map(escapeHtml).join("<br>")}${students.length > 6 ? "<br>..." : ""}</div>
          </div>
          ${editOnly(`<div class="row wrap">
            <button class="btn" onclick="openEditor('studentClass','${classe.id}')">Modifier</button>
            <button class="btn danger" onclick="removeItem('studentClass','${classe.id}')">Supprimer</button>
          </div>`)}
        </article>`;
      }

      function renderTools() {
        const studentClasses = state.studentClasses || [];
        const selectedId = state.tools.selectedWheelClassId || studentClasses[0]?.id || "";
        const selectedClass = studentClasses.find((classe) => classe.id === selectedId) || studentClasses[0];
        if (selectedClass) state.tools.selectedWheelClassId = selectedClass.id;
        const history = selectedClass ? (state.tools.wheelHistory[selectedClass.id] || []) : [];
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb">Outils / Roue de la fortune et chrono</div>
            <div class="row wrap">
              <div>
                <h2 style="margin:0;color:var(--wine-900);font-size:34px">Roue de la fortune et chrono</h2>
                <p class="muted">Tire un élève au hasard et lance un minuteur sur la même page.</p>
              </div>
              <label class="label" style="min-width:260px">Classe
                <select onchange="selectWheelClass(this.value)">
                  ${studentClasses.map((classe) => `<option value="${classe.id}" ${selectedClass?.id === classe.id ? "selected" : ""}>${escapeHtml(classe.title)}</option>`).join("")}
                </select>
              </label>
            </div>
          </section>
          <div class="tools-grid">
            ${selectedClass ? renderWheelTool(selectedClass, history) : empty("Ajoutez d'abord un groupe dans Groupes Classes.")}
            ${renderTimerTool()}
          </div>
        `;
        updateTimerDisplay();
      }

      function renderWheelTool(classe, history) {
        const students = Array.isArray(classe.students) ? classe.students : [];
        const last = history[0]?.student || "Pret ?";
        const counts = wheelCountsForClass(classe.id);
        const limit = wheelLimitForClass(classe.id);
        const absences = wheelAbsencesForClass(classe.id);
        const availableCount = students.filter((student) => !absences.includes(student) && Number(counts[student] || 0) < limit).length;
        const presentCount = students.length - absences.length;
        return `
            <section class="card">
              <div class="wheel" id="studentWheel"><div class="wheel-result">${escapeHtml(last)}</div></div>
              <label class="label" style="margin:18px auto 0;max-width:330px">Nombre maximum de tirages par élève
                <input type="number" min="1" max="20" value="${limit}" ${isLoggedIn() ? "" : "disabled"} onchange="setWheelLimit('${classe.id}', this.value)">
              </label>
              <div class="row wrap" style="justify-content:center;margin-top:18px">
                ${isLoggedIn() ? `
                  <button class="btn primary" ${availableCount ? "" : "disabled"} onclick="spinStudentWheel('${classe.id}')">Lancer la roue</button>
                  <button class="btn" onclick="resetWheelCounts('${classe.id}')">Remettre les compteurs à 0</button>
                  <button class="btn" onclick="resetWheelAbsences('${classe.id}')">Tout le monde présent</button>
                  <button class="btn" onclick="clearWheelHistory('${classe.id}')">Vider l'historique</button>
                ` : `<span class="pill">Connectez-vous pour utiliser la roue</span>`}
              </div>
              <p class="small muted" style="text-align:center;margin-top:12px">${availableCount} élève(s) encore disponible(s), ${presentCount} présent(s) sur ${students.length}. Limite actuelle : ${limit} tirage(s) par élève.</p>
            </section>
            <aside class="card">
              <h2>Élèves</h2>
              <div class="history-list" style="margin-top:12px">
                ${students.map((student, index) => {
                  const absent = absences.includes(student);
                  return `<div class="row">
                    <strong style="${absent ? "opacity:.48;text-decoration:line-through" : ""}">${escapeHtml(student)}</strong>
                    <div class="row" style="gap:8px">
                      <span class="small muted">${Number(counts[student] || 0)} / ${limit}</span>
                      ${editOnly(`<button class="btn ${absent ? "danger" : ""}" style="padding:8px 10px" onclick="toggleWheelAbsence('${classe.id}', ${index})">${absent ? "Absent" : "Present"}</button>`)}
                    </div>
                  </div>`;
                }).join("") || empty("Aucun élève.")}
              </div>
              <h2 style="margin-top:24px">Historique</h2>
              <div class="history-list" style="margin-top:12px">
                ${history.map((item, index) => `<div class="row"><strong>${index + 1}. ${escapeHtml(item.student)}</strong><span class="small muted">${new Date(item.date).toLocaleString("fr-FR")}</span></div>`).join("") || empty("Aucun tirage.")}
              </div>
            </aside>
        `;
      }

      function renderTimerTool() {
        return `<section class="card">
          <h2>Chrono</h2>
          <div class="timer-display" id="timerDisplay">05:00</div>
          <div class="form-grid" style="margin-top:12px">
            <label class="label">Minutes
              <input id="timerMinutes" type="number" min="1" max="120" value="${Math.max(1, Math.ceil(timerRemaining / 60))}" onchange="setTimerMinutes(this.value)">
            </label>
          </div>
          <div class="row wrap" style="justify-content:center;margin-top:16px">
            <button class="btn primary" onclick="startClassTimer()">Démarrer</button>
            <button class="btn" onclick="pauseClassTimer()">Pause</button>
            <button class="btn" onclick="resetClassTimer()">Réinitialiser</button>
          </div>
        </section>`;
      }

      function formatTimer(seconds) {
        const safeSeconds = Math.max(0, Number(seconds) || 0);
        const minutes = Math.floor(safeSeconds / 60);
        const rest = safeSeconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
      }

      function updateTimerDisplay() {
        const display = document.querySelector("#timerDisplay");
        if (display) display.textContent = formatTimer(timerRemaining);
      }

      function setTimerMinutes(value) {
        timerRemaining = Math.max(1, Math.min(120, Number(value) || 5)) * 60;
        pauseClassTimer();
        updateTimerDisplay();
      }

      function startClassTimer() {
        if (timerInterval) return;
        timerInterval = setInterval(() => {
          timerRemaining = Math.max(0, timerRemaining - 1);
          updateTimerDisplay();
          if (!timerRemaining) pauseClassTimer();
        }, 1000);
      }

      function pauseClassTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
      }

      function resetClassTimer() {
        const input = document.querySelector("#timerMinutes");
        timerRemaining = Math.max(1, Math.min(120, Number(input?.value) || 5)) * 60;
        pauseClassTimer();
        updateTimerDisplay();
      }

      function wheelLimitForClass(classId) {
        state.tools.wheelLimits = state.tools.wheelLimits || {};
        const limit = Number(state.tools.wheelLimits[classId] || 2);
        return Math.max(1, Math.min(20, Number.isFinite(limit) ? limit : 2));
      }

      function wheelCountsForClass(classId) {
        state.tools.wheelCounts = state.tools.wheelCounts || {};
        state.tools.wheelCounts[classId] = state.tools.wheelCounts[classId] && typeof state.tools.wheelCounts[classId] === "object" ? state.tools.wheelCounts[classId] : {};
        return state.tools.wheelCounts[classId];
      }

      function wheelAbsencesForClass(classId) {
        state.tools.wheelAbsences = state.tools.wheelAbsences || {};
        state.tools.wheelAbsences[classId] = Array.isArray(state.tools.wheelAbsences[classId]) ? state.tools.wheelAbsences[classId] : [];
        return state.tools.wheelAbsences[classId];
      }

      function setWheelLimit(classId, value) {
        if (!requireLogin()) return;
        state.tools.wheelLimits = state.tools.wheelLimits || {};
        const limit = Math.max(1, Math.min(20, Number(value) || 1));
        state.tools.wheelLimits[classId] = limit;
        saveData("Limite mise à jour.");
      }

      function toggleWheelAbsence(classId, studentIndex) {
        if (!requireLogin()) return;
        const classe = (state.studentClasses || []).find((item) => item.id === classId);
        const student = classe?.students?.[studentIndex];
        if (!student) return;
        const absences = wheelAbsencesForClass(classId);
        const index = absences.indexOf(student);
        if (index >= 0) {
          absences.splice(index, 1);
          saveData(`${student} est marqué présent.`);
          return;
        }
        absences.push(student);
        saveData(`${student} est marque absent.`);
      }

      function resetWheelAbsences(classId) {
        if (!requireLogin()) return;
        state.tools.wheelAbsences = state.tools.wheelAbsences || {};
        state.tools.wheelAbsences[classId] = [];
        saveData("Tous les élèves sont marqués présents.");
      }

      function selectWheelClass(id) {
        state.tools.selectedWheelClassId = id;
        saveData();
      }

      function spinStudentWheel(classId) {
        if (!requireLogin()) return;
        const classe = (state.studentClasses || []).find((item) => item.id === classId);
        const students = classe?.students || [];
        if (!students.length) return toast("Aucun élève dans cette classe.");
        const limit = wheelLimitForClass(classId);
        const counts = wheelCountsForClass(classId);
        const absences = wheelAbsencesForClass(classId);
        const availableStudents = students.filter((student) => !absences.includes(student) && Number(counts[student] || 0) < limit);
        if (!availableStudents.length) return toast("Aucun élève disponible. Vérifie les absents ou remets les compteurs à 0.");
        const wheel = document.querySelector("#studentWheel");
        wheel?.classList.add("spinning");
        const student = availableStudents[Math.floor(Math.random() * availableStudents.length)];
        setTimeout(() => {
          counts[student] = Number(counts[student] || 0) + 1;
          state.tools.wheelHistory[classId] = state.tools.wheelHistory[classId] || [];
          state.tools.wheelHistory[classId].unshift({ student, count: counts[student], limit, date: new Date().toISOString() });
          state.tools.wheelHistory[classId] = state.tools.wheelHistory[classId].slice(0, 100);
          saveData();
          toast(`${student} est tombe.`);
          renderTools();
        }, 450);
      }

      function resetWheelCounts(classId) {
        if (!requireLogin()) return;
        if (!confirm("Remettre tous les compteurs de cette roue à 0 ?")) return;
        state.tools.wheelCounts = state.tools.wheelCounts || {};
        state.tools.wheelCounts[classId] = {};
        saveData("Compteurs remis à 0.");
      }

      function clearWheelHistory(classId) {
        if (!requireLogin()) return;
        if (!confirm("Vider l'historique de cette roue ?")) return;
        state.tools.wheelHistory[classId] = [];
        saveData("Historique vide.");
      }

      function renderClassPage(classId) {
        const classe = findItem("class", classId);
        if (!classe) {
          currentPage = { type: "classes" };
          return renderClasses();
        }
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb"><button onclick="currentPage={type:'classes'};render()">Cours modifiables</button> / Classe</div>
            <div class="row wrap">
              <div>
                <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(classe.title)}</h2>
                <p class="muted">${escapeHtml(classe.description)}</p>
              </div>
              ${editOnly(`<div class="row wrap">

                <button class="btn" onclick="manageCategories()">Catégorie</button>
                <button class="btn" onclick="openEditor('class','${classe.id}')">Modification</button>
                <button class="btn primary" onclick="openEditor('sequence',null,{classId:'${classe.id}'})">Ajouter une séquence</button>
                <button class="btn danger" onclick="removeItem('class','${classe.id}')">Supprimer la classe</button>
              </div>`)}
            </div>
          </section>
          <section class="list-table">${classe.sequences.map((sequence) => sequenceCard(classe, sequence)).join("") || empty("Aucune séquence.")}</section>
        `;
      }

      function sequenceCard(classe, sequence) {
        const activityCount = sequence.lessons.reduce((total, lesson) => total + lesson.activities.length, 0);
        return `<article class="card entity-card">
          <div>
            <p class="small" style="font-weight:850;color:var(--wine-700)">Séquence</p>
            <h3 style="font-size:24px">${escapeHtml(sequence.title)} ${sequence.isVisible ? "" : "<span class='pill'>Masque</span>"}</h3>
            <p class="muted small">${escapeHtml(sequence.description)}</p>
          </div>
          <div class="row wrap">
            <span class="pill">${sequence.lessons.length} séance(s)</span>
            <span class="pill">Tâche finale${sequence.finalTask ? ` : ${escapeHtml(sequence.finalTask)}` : ""}</span>
            <span class="pill">${activityCount} activité(s)</span>
            ${editOnly(moveButtons("sequence", sequence.id))}
            <button class="btn primary" onclick="openSequencePage('${classe.id}','${sequence.id}')">${isLoggedIn() ? "Modifier" : "Voir"}</button>
            ${editOnly(`<button class="btn danger" onclick="removeItem('sequence','${sequence.id}')">Supprimer</button>`)}
          </div>
        </article>`;
      }

      function renderSequencePage(classId, sequenceId) {
        const classe = findItem("class", classId);
        const sequence = findItem("sequence", sequenceId);
        if (!classe || !sequence) {
          currentPage = { type: "classes" };
          return renderClasses();
        }
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb"><button onclick="currentPage={type:'classes'};render()">Cours modifiables</button> / Classe / Séquence</div>
            <div class="row wrap">
              <div>
                <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(sequence.title)}</h2>
                <p class="muted">${escapeHtml(sequence.description)}</p>
              </div>
              ${editOnly(`<div class="row wrap">
                <button class="btn" onclick="manageCategories()">Catégorie</button>
                <button class="btn" onclick="openEditor('sequence','${sequence.id}')">Modification</button>
                <button class="btn primary" onclick="openEditor('lesson',null,{classId:'${classe.id}',sequenceId:'${sequence.id}'})">Ajouter une séance</button>
                <button class="btn danger" onclick="removeItem('sequence','${sequence.id}')">Supprimer la séquence</button>
              </div>`)}
            </div>
          </section>
          <section class="list-table">${sequence.lessons.map((lesson) => lessonRow(classe, sequence, lesson)).join("") || empty("Aucune séance.")}</section>
        `;
      }

      function lessonRow(classe, sequence, lesson) {
        return `<article class="list-row">
          <div>
            <p class="small" style="font-weight:850;color:var(--wine-700)">Séance</p>
            <h3>${escapeHtml(lesson.title)} ${lesson.isVisible ? "" : "<span class='pill'>Masque</span>"}</h3>
            <p class="muted small">${escapeHtml(lesson.description)}</p>
          </div>
          <div class="row wrap">
            <span class="pill">${lesson.activities.length} activité(s)</span>
            ${editOnly(moveButtons("lesson", lesson.id))}
            <button class="btn primary" onclick="openLessonPage('${classe.id}','${sequence.id}','${lesson.id}')">${isLoggedIn() ? "Modifier" : "Voir"}</button>
            ${editOnly(`<button class="btn danger" onclick="removeItem('lesson','${lesson.id}')">Supprimer</button>`)}
          </div>
        </article>`;
      }

      function renderLessonPage(classId, sequenceId, lessonId) {
        const classe = findItem("class", classId);
        const sequence = findItem("sequence", sequenceId);
        const lesson = findItem("lesson", lessonId);
        if (!classe || !sequence || !lesson) {
          currentPage = { type: "classes" };
          return renderClasses();
        }
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb"><button onclick="currentPage={type:'classes'};render()">Cours modifiables</button> / Classe / Séquence / Séance</div>
            <div class="row wrap">
              <div>
                <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(lesson.title)}</h2>
                <p class="muted">${escapeHtml(lesson.description)}</p>
              </div>
              ${editOnly(`<div class="row wrap">

                <button class="btn" onclick="manageCategories()">Catégorie</button>
                <button class="btn" onclick="openEditor('lesson','${lesson.id}')">Modification</button>
                <button class="btn primary" onclick="createActivityInLesson('${lesson.id}')">Ajouter une activité</button>
                <button class="btn danger" onclick="removeItem('lesson','${lesson.id}')">Supprimer la séance</button>
              </div>`)}
            </div>
          </section>
          <section class="numbered-list">${lesson.activities.map(activityCard).join("") || empty("Aucune activité.")}</section>
        `;
      }

      function renderClassTree(classe) {
        return `<article class="tree-item">
          <div class="row wrap">
            <div><h3>${escapeHtml(classe.title)} ${classe.isVisible ? "" : "<span class='pill'>Masque</span>"}</h3><p class="muted small">${escapeHtml(classe.description)}</p></div>
            ${editOnly(`<div class="row">
              ${moveButtons("class", classe.id)}
              <button class="btn" onclick="openEditor('sequence',null,{classId:'${classe.id}'})">+ Séquence</button>
              <button class="btn" onclick="openEditor('class','${classe.id}')">Modifier</button>
              <button class="btn danger" onclick="removeItem('class','${classe.id}')">Supprimer</button>
            </div>`)}
          </div>
          <div class="tree-child">${classe.sequences.map((sequence) => renderSequenceTree(classe, sequence)).join("") || empty("Aucune séquence.")}</div>
        </article>`;
      }

      function renderSequenceTree(classe, sequence) {
        return `<div class="tree-item">
          <div class="row wrap">
            <strong>${escapeHtml(sequence.title)} ${sequence.isVisible ? "" : "<span class='pill'>Masque</span>"}</strong>
            ${editOnly(`<div class="row">
              ${moveButtons("sequence", sequence.id)}
              <button class="btn" onclick="openEditor('lesson',null,{classId:'${classe.id}',sequenceId:'${sequence.id}'})">+ Séance</button>
              <button class="btn" onclick="openEditor('sequence','${sequence.id}')">Modifier</button>
              <button class="btn danger" onclick="removeItem('sequence','${sequence.id}')">Supprimer</button>
            </div>`)}
          </div>
          <div class="tree-child">${sequence.lessons.map((lesson) => renderLessonTree(classe, sequence, lesson)).join("") || empty("Aucune seance.")}</div>
        </div>`;
      }

      function renderLessonTree(classe, sequence, lesson) {
        return `<div class="tree-item">
          <div class="row wrap">
            <strong>${escapeHtml(lesson.title)} ${lesson.isVisible ? "" : "<span class='pill'>Masque</span>"}</strong>
            ${editOnly(`<div class="row">
              ${moveButtons("lesson", lesson.id)}
              <button class="btn" onclick="createActivityInLesson('${lesson.id}')">+ Activite</button>
              <button class="btn" onclick="openEditor('lesson','${lesson.id}')">Modifier</button>
              <button class="btn danger" onclick="removeItem('lesson','${lesson.id}')">Supprimer</button>
            </div>`)}
          </div>
          <div class="tree-child">${lesson.activities.map(activityCard).join("") || empty("Aucune activité.")}</div>
        </div>`;
      }

      function activityCard(activity) {
        return `<article class="card activity-card">
          <div class="activity-card-body">
            <div>
              <p class="small" style="font-weight:850;color:var(--wine-700)">${escapeHtml(activity.level || activity.classTitle || "Activite")}</p>
              <h3>${escapeHtml(activity.title)} ${activity.isVisible ? "" : "<span class='pill'>Masque</span>"}</h3>
              <p class="muted small">${escapeHtml(activity.objective || activity.description)}</p>
            </div>
            <div class="activity-actions">
              ${editOnly(moveButtons("activity", activity.id))}
              <button class="btn primary" onclick="openBoardInNewTab('${activity.id}')">Présenter</button>
              ${editOnly(`<button class="btn" onclick="openActivityStudio('${activity.id}')">Modifier</button>
              <button class="btn danger" onclick="removeItem('activity','${activity.id}')">Supprimer</button>`)}
            </div>
          </div>
        </article>`;
      }

      function moveButtons(type, id) {
        return "";
      }

      function resourceRow(resource) {
        return `<article class="card" style="box-shadow:none">
          <div class="row wrap">
            <div>
              <p class="small" style="font-weight:850;color:var(--wine-700)">${resourceTypes[resource.type] || resource.type} / ${escapeHtml(resource.category || "Sans catégorie")}</p>
              <h3>${escapeHtml(resource.title)} ${resource.isVisible ? "" : "<span class='pill'>Masque</span>"}</h3>
              <p class="muted small">${escapeHtml(resource.description)}</p>
            </div>
            <div class="row">
              ${resource.url ? `<a class="btn" href="${resource.url}" target="_blank">Ouvrir</a>` : ""}
              ${editOnly(`<button class="btn" onclick="openEditor('resource','${resource.id}')">Modifier</button>
              <button class="btn danger" onclick="removeItem('resource','${resource.id}')">Supprimer</button>`)}
            </div>
          </div>
          <div class="resource-preview" style="margin-top:10px">${previewResource(resource)}</div>
        </article>`;
      }

      function previewResource(resource) {
        if (!resource.url) return "";
        if (resource.type === "IMAGE" || /\.(png|jpe?g|gif|webp|svg)$/i.test(resource.url)) return `<img src="${resource.url}" alt="">`;
        if (resource.type === "AUDIO" || /\.(mp3|wav|ogg)$/i.test(resource.url)) return `<audio controls src="${resource.url}" style="width:100%"></audio>`;
        if (resource.type === "VIDEO" || /\.(mp4|webm)$/i.test(resource.url)) return `<video controls src="${resource.url}" style="width:100%;max-height:320px;background:#111"></video>`;
        if (resource.type === "PDF" || /\.pdf$/i.test(resource.url)) return `<iframe src="${resource.url}" height="260"></iframe>`;
        if (resource.type === "TEXT") return `<p>${escapeHtml(resource.description || resource.title)}</p>`;
        return "";
      }

      function renderSearch() {
        document.querySelector("#content").innerHTML = `
          <section class="card">
            <h2>Recherche ressource ou activité</h2>
            <input id="globalSearch" style="margin-top:12px" placeholder="Rechercher une activité, une consigne, une ressource..." oninput="renderSearchResults(this.value)" />
          </section>
          <section id="searchResults" class="grid two" style="margin-top:16px"></section>
        `;
        renderSearchResults("");
      }

      function renderSearchResults(query) {
        const flat = flatten();
        const q = String(query || "").toLowerCase();
        const activities = flat.activities.filter((a) => !q || `${a.title} ${a.objective} ${a.instruction} ${a.level}`.toLowerCase().includes(q));
        const resources = flat.resources.filter((r) => !q || `${r.title} ${r.description} ${r.type} ${r.category}`.toLowerCase().includes(q));
        document.querySelector("#searchResults").innerHTML = `
          <div class="card"><h2>Activités</h2><div class="grid" style="margin-top:12px">${activities.slice(0, 20).map(activityCard).join("") || empty("Aucune activité.")}</div></div>
          <div class="card"><h2>Ressources</h2><div class="grid" style="margin-top:12px">${resources.slice(0, 20).map(resourceRow).join("") || empty("Aucune ressource.")}</div></div>
        `;
      }

      const tutorialSteps = [
        { view: "dashboard", selector: "[data-view='dashboard']", title: "Cours à projeter", text: "Ici, on navigue jusqu'à la présentation à montrer aux élèves. Cette partie ne sert pas à modifier." },
        { view: "classes", selector: "[data-view='classes']", title: "Cours modifiables", text: "C'est l'espace de préparation : classes pédagogiques, séquences, séances et présentations." },
        { view: "classes", selector: "#content", title: "Préparation", text: "Depuis une classe, tu ouvres une séquence, puis une séance. Les activités se créent uniquement dans une séance." },
        { view: "studentClasses", selector: "[data-view='studentClasses']", title: "Groupes Classes", text: "Ici, tu gères les vrais groupes avec les noms des élèves, par exemple 5emeA et 5emeB." },
        { view: "tools", selector: "[data-view='tools']", title: "Outils", text: "Cette entrée contient la roue de la fortune, les absents, les compteurs, l'historique et le chrono." },
        { view: "search", selector: "[data-view='search']", title: "Recherche", text: "La recherche retrouve rapidement une présentation ou une ressource sans parcourir toute l'arborescence." },
        { view: "settings", selector: "[data-view='settings']", title: "Réglages", text: "Dans les réglages, tu peux exporter le ZIP, importer des données, ou réinitialiser l'espace du compte." },
        { view: "settings", selector: "#openBoardBtn", title: "Mode tableau", text: "Ce bouton ouvre directement une présentation au tableau. Dans les séances, chaque activité a aussi son bouton de présentation." },
        { view: "tutorial", selector: ".sidebar-mail", title: "Contact", text: "En bas à gauche, le téléphone et le mail restent discrets et se copient au clic." }
      ];

      function renderTutorial() {
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb">Tutoriel</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">Visite guidée</h2>
            <p class="muted">Lance le tutoriel pour parcourir les parties du site une par une.</p>
          </section>
          <section class="card">
            <h2>Comprendre le site en quelques clics</h2>
            <p class="muted">Le tutoriel change de page automatiquement, encadre la zone importante et explique à quoi elle sert.</p>
            <div class="row wrap" style="margin-top:18px">
              <button class="btn primary" onclick="startTutorial()">Lancer le tutoriel</button>
              <button class="btn" onclick="setView('dashboard')">Aller aux cours à projeter</button>
            </div>
          </section>
        `;
      }

      function startTutorial() {
        tourIndex = 0;
        tourRunning = true;
        activeTutorialSteps = tutorialSteps;
        showTutorialStep();
      }

      function startFreeExampleTutorial() {
        const firstClass = state.classes[0];
        const firstSequence = firstClass?.sequences?.[0];
        const firstLesson = firstSequence?.lessons?.[0];
        const firstActivity = firstLesson?.activities?.[0];
        activeTutorialSteps = [
          { view: "dashboard", selector: "#content", title: "Exemple gratuit", text: "Voici l'exemple gratuit sur Leonardo da Vinci. Tu vas être guidé jusqu'à une présentation complète." },
          { view: "classes", selector: "#content", title: "Cours modifiables", text: "Dans cette partie, on voit les cours organisés par niveau. En gratuit, tu peux consulter sans modifier." },
          { view: "studentClasses", selector: "#content", title: "Groupes Classes", text: "Groupes Classes montre les groupes d'élèves. Les actions restent bloquées sans connexion." },
          { view: "tools", selector: "#content", title: "Outils", text: "Les outils, comme la roue et le chrono, sont visibles mais utilisables seulement avec un compte connecté." },
          { view: "search", selector: "#content", title: "Recherche", text: "La recherche permet de retrouver rapidement une présentation ou une ressource." },
          { view: "tutorial", selector: "#content", title: "Tutoriel", text: "Cette entrée permet de relancer la visite guidée du portail." },
          { view: "tutorial", selector: "#exampleAd", title: "Contact OrellanaTech", text: "Dans l'exemple gratuit, la pub est visible ici. Le téléphone et le mail se copient au clic." },
          { view: "settings", selector: "#content", title: "Réglages", text: "Les réglages expliquent le mode public. Les exports et imports demandent une connexion." },
          { view: "dashboard", selector: "#content", title: "Classe 5eme", text: "On commence par la classe 5eme.", enter: () => firstClass && openTableauClass(firstClass.id) },
          { view: "dashboard", selector: "#content", title: "Séquence", text: "Le tutoriel ouvre la première séquence de l'exemple.", enter: () => firstClass && firstSequence && openTableauSequence(firstClass.id, firstSequence.id) },
          { view: "dashboard", selector: "#content", title: "Séance", text: "Puis il ouvre la première séance pour trouver la présentation.", enter: () => firstClass && firstSequence && firstLesson && openTableauLesson(firstClass.id, firstSequence.id, firstLesson.id) },
          { view: "dashboard", selector: "#content", title: "Présentation", text: "Le tutoriel ouvre maintenant la présentation exemple." },
          { view: "dashboard", selector: "#boardPage", title: "Diapo exemple", text: "Cette présentation contient un titre, une image et la vidéo déposée localement.", enter: () => firstActivity && showBoard(firstActivity.id, 0) }
        ];
        tourIndex = 0;
        tourRunning = true;
        showTutorialStep();
      }

      function showTutorialStep() {
        const steps = activeTutorialSteps || tutorialSteps;
        const step = steps[tourIndex];
        if (!step) return endTutorial();
        if (step.enter) step.enter();
        if (currentView !== step.view) {
          currentView = step.view;
          if (step.view === "dashboard") currentTableauPage = { type: "classes" };
          if (step.view === "classes") currentPage = { type: "classes" };
          document.querySelectorAll(".nav-button[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === step.view));
          render();
        }
        setTimeout(() => renderTutorialOverlay(step), 80);
      }

      function renderTutorialOverlay(step) {
        const steps = activeTutorialSteps || tutorialSteps;
        const forcedTour = activeTutorialSteps && activeTutorialSteps !== tutorialSteps;
        const overlay = document.querySelector("#tourOverlay");
        const target = document.querySelector(step.selector);
        if (!target) return endTutorial();
        const rect = target.getBoundingClientRect();
        const padding = 8;
        const left = Math.max(8, rect.left - padding);
        const top = Math.max(8, rect.top - padding);
        const width = Math.min(window.innerWidth - left - 8, rect.width + padding * 2);
        const height = Math.min(window.innerHeight - top - 8, rect.height + padding * 2);
        const panelLeft = left + width + 18 + 360 < window.innerWidth ? left + width + 18 : Math.max(16, Math.min(window.innerWidth - 376, left));
        const panelTop = top + height + 18 + 230 < window.innerHeight ? top + height + 18 : Math.max(16, top - 18);
        overlay.hidden = false;
        overlay.innerHTML = `
          <div class="tour-highlight" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px"></div>
          <section class="tour-panel" style="left:${panelLeft}px;top:${panelTop}px">
            <span class="tour-step-count">Etape ${tourIndex + 1} / ${steps.length}</span>
            <h3>${escapeHtml(step.title)}</h3>
            <p>${escapeHtml(step.text)}</p>
            <div class="row wrap" style="margin-top:16px;justify-content:flex-end">
              ${forcedTour ? "" : `<button class="btn" onclick="endTutorial()">Terminer</button>`}
              <button class="btn" ${tourIndex === 0 ? "disabled" : ""} onclick="previousTutorialStep()">Precedent</button>
              <button class="btn primary" onclick="nextTutorialStep()">${tourIndex === steps.length - 1 ? "Finir" : "Suivant"}</button>
            </div>
          </section>
        `;
      }

      function nextTutorialStep() {
        const steps = activeTutorialSteps || tutorialSteps;
        if (tourIndex >= steps.length - 1) return endTutorial();
        tourIndex += 1;
        showTutorialStep();
      }

      function previousTutorialStep() {
        tourIndex = Math.max(0, tourIndex - 1);
        showTutorialStep();
      }

      function endTutorial() {
        tourRunning = false;
        activeTutorialSteps = null;
        const overlay = document.querySelector("#tourOverlay");
        overlay.hidden = true;
        overlay.innerHTML = "";
      }

      function renderSettings() {
        const formatBytes = (value) => `${(Number(value || 0) / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
        document.querySelector("#content").innerHTML = `
          <div class="grid two">
            <section class="card">
              <h2>Connexion locale</h2>
              <p class="muted">Compte connecté : <strong>${isLoggedIn() ? escapeHtml(currentUsername()) : "visiteur public"}</strong></p>
              <p class="small muted">${isLoggedIn() ? "Chaque identifiant a ses propres données locales sur ce PC. En attendant le NAS, les comptes et les sauvegardes restent stockés dans ce navigateur." : "Vous pouvez consulter les exemples sans identifiant. Connectez-vous pour modifier, exporter ou importer des données."}</p>
            </section>
            <section class="card">
              <h2>Données</h2>
              <p class="muted">${isLoggedIn() ? "Mode local activé : les données sont stockées dans ce navigateur avec localStorage. Utilisez Exporter ZIP ou Exporter pour faire une copie de sauvegarde." : "Mode consultation uniquement."}</p>
              ${isLoggedIn() && storageInfo ? `<p class="small muted">Espace serveur : ${formatBytes(storageInfo.used_bytes)} utilisés sur ${formatBytes(storageInfo.quota_bytes)}. Images : ${formatBytes(storageInfo.categories?.images)} · Vidéos : ${formatBytes(storageInfo.categories?.videos)} · Documents : ${formatBytes(storageInfo.categories?.documents)} · Sauvegardes : ${formatBytes(storageInfo.categories?.backups)}</p>` : ""}
              ${isLoggedIn() ? `<div class="row wrap" style="margin-top:12px">
                <button class="btn" onclick="exportData()">Exporter</button>
                <button class="btn primary" onclick="exportZip()">Exporter ZIP</button>
                <label class="btn">Importer <input type="file" accept="application/json" hidden onchange="importData(this.files[0])"></label>
                <button class="btn danger" onclick="resetData()">Réinitialiser</button>
              </div>
              <p class="small muted">Le ZIP contient toutes les classes, séquences, séances, présentations et données complètes.</p>` : `<button class="btn primary" onclick="showLogin()">Se connecter</button>`}
            </section>
          </div>
        `;
      }

      function openEditor(type, id, defaults = {}) {
        if (!requireLogin()) return;
        const item = id ? findItem(type, id) : null;
        const editing = item ? structuredClone(item) : createBlank(type, defaults);
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `
          <div class="drawer">
            <div class="drawer-head">
              <div><p class="small" style="font-weight:850;color:var(--wine-700)">${id ? "Modification" : "Création"}</p><h2 style="margin:0;color:var(--wine-900)">${labelType(type)}</h2></div>
              <button class="btn icon" onclick="closeEditor()">X</button>
            </div>
            <form class="drawer-body" id="editForm">
              ${editorFields(type, editing)}
              <div class="row">
                <button class="btn primary" type="submit">Enregistrer</button>
                <button class="btn" type="button" onclick="closeEditor()">Annuler</button>
              </div>
            </form>
          </div>
        `;
        document.querySelector("#editForm").addEventListener("submit", (event) => saveEditor(event, type, id));
      }

      function closeEditor() {
        document.querySelector("#editorModal").hidden = true;
      }

      function createBlank(type, defaults) {
        const base = { id: "", title: "", slug: "", description: "", order: 0, isVisible: true, updatedAt: new Date().toISOString(), ...defaults };
        if (type === "activity") return { ...base, objective: "", instruction: "", estimatedDuration: "20 min", modality: "classe entière", level: "", privateNotes: "", resources: [], slides: [{ id: uid("slide"), elements: [] }] };
        if (type === "sequence") return { ...base, finalTask: "", lessons: [] };
        if (type === "resource") return { ...base, type: "DOCUMENT", category: "Documents", url: "", activityId: defaults.activityId || "" };
        if (type === "studentClass") return { ...base, students: [] };
        return base;
      }

      function editorFields(type, item) {
        const flat = flatten();
        const base = `
          <div class="form-grid">
            ${field("title", "Titre", item.title, true)}
            ${textarea("description", "Description", item.description, "wide")}
            ${field("order", "Ordre", item.order, false, "number")}
            <label class="label">Visible <select name="isVisible"><option value="true" ${item.isVisible !== false ? "selected" : ""}>Oui</option><option value="false" ${item.isVisible === false ? "selected" : ""}>Non</option></select></label>
          </div>`;
        if (type === "class") return base + `<label class="label">Catégorie <select name="category">${state.categories.map((category) => `<option ${((item.category || "Collège") === category) ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></label>`;
        if (type === "sequence") return base + textarea("finalTask", "Tâche finale", item.finalTask || "", "wide") + selectField("classId", "Classe", item.classId || "", flat.classes);
        if (type === "lesson") return base + selectField("sequenceId", "Séquence", item.sequenceId || "", flat.sequences);
        if (type === "studentClass") return base + textarea("students", "Élèves (un nom par ligne)", Array.isArray(item.students) ? item.students.join("\n") : "", "wide");
        if (type === "activity") return base + `
          ${selectField("lessonId", "Séance", item.lessonId || "", flat.lessons)}
          <div class="form-grid">
            ${field("objective", "Objectif", item.objective, false, "text", "wide")}
            ${textarea("instruction", "Consigne", item.instruction, "wide")}
            ${field("estimatedDuration", "Durée estimée", item.estimatedDuration)}
            <label class="label">Modalité <select name="modality">${modalities.map((m) => `<option ${item.modality === m ? "selected" : ""}>${m}</option>`).join("")}</select></label>
            ${field("level", "Niveau", item.level)}
            ${textarea("privateNotes", "Notes privées prof", item.privateNotes, "wide")}
          </div>`;
        if (type === "resource") return base + `
          <div class="form-grid">
            <label class="label">Type <select name="type">${Object.entries(resourceTypes).map(([value, label]) => `<option value="${value}" ${item.type === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
            <label class="label">Catégorie <select name="category">${categories.map((cat) => `<option ${item.category === cat ? "selected" : ""}>${cat}</option>`).join("")}</select></label>
            ${field("url", "URL ou fichier", item.url, false, "text", "wide")}
            ${selectField("activityId", "Lier à une activité", item.activityId || "", flat.activities, true)}
            <label class="label wide">Ajouter un fichier local <input type="file" onchange="fileToDataUrl(this.files[0])"></label>
          </div>
          <p class="small muted">Les fichiers ajoutés en HTML sont stockés dans le navigateur sous forme de données locales. Pour les gros fichiers, préférez une URL.</p>`;
        return base;
      }

      function field(name, label, value, required, type = "text", cls = "") {
        return `<label class="label ${cls}">${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""}></label>`;
      }

      function textarea(name, label, value, cls = "") {
        return `<label class="label ${cls}">${label}<textarea name="${name}">${escapeHtml(value)}</textarea></label>`;
      }

      function selectField(name, label, value, options, optional) {
        return `<label class="label">${label}<select name="${name}">${optional ? "<option value=''>Aucun</option>" : ""}${options.map((option) => `<option value="${option.id}" ${value === option.id ? "selected" : ""}>${escapeHtml(option.title)}</option>`).join("")}</select></label>`;
      }

      async function fileToDataUrl(file) {
        if (!file) return;
        try {
          const uploaded = await window.ServerAPI.upload(file);
          document.querySelector("input[name='url']").value = uploaded.content_url;
          toast("Fichier charge. Enregistrez la ressource.");
        } catch {
          const reader = new FileReader();
          reader.onload = () => {
            document.querySelector("input[name='url']").value = reader.result;
            toast("Fichier charge. Enregistrez la ressource.");
          };
          reader.readAsDataURL(file);
        }
      }

      function createActivityInLesson(lessonId) {
        if (!requireLogin()) return;
        const lesson = findItem("lesson", lessonId);
        if (!lesson) return;
        const activity = {
          ...createBlank("activity", { lessonId }),
          id: uid("act"),
          title: "Nouvelle présentation",
          slug: slugify("nouvelle-presentation"),
          description: "Présentation à projeter.",
          objective: "",
          instruction: "",
          level: "",
          resources: [],
          slides: [{ id: uid("slide"), elements: [] }]
        };
        lesson.activities.push(activity);
        saveData("Activite creee.");
        openActivityStudio(activity.id);
      }

      function openActivityStudio(id) {
        if (!requireLogin()) return;
        const activity = ensureActivitySlides(findItem("activity", id));
        if (!activity) return;
        currentStudioSlideIndex = 0;
        const stripHeight = activity.slides.length * slideSize.height + Math.max(0, activity.slides.length - 1) * slideSize.gap;
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `
          <section class="studio" data-activity-id="${activity.id}">
            <header class="studio-toolbar">
              <div>
                <strong>${escapeHtml(activity.title)}</strong>
                <div class="studio-note">Diapos horizontales. Les cadres pointilles indiquent ce qui sera visible au tableau.</div>
              </div>
              <div class="studio-actions">
                <button class="btn" onclick="renameActivity('${activity.id}')">Titre</button>
                <button class="btn" onclick="addSlide('${activity.id}')">+ Diapo</button>
                <button class="btn" onclick="addTextElement('${activity.id}')">+ Texte</button>
                <button class="btn" onclick="addUrlElement('${activity.id}')">+ URL</button>
                <label class="btn">+ Fichier <input type="file" hidden onchange="addFileElement('${activity.id}', this.files[0])"></label>
                <button class="btn danger" onclick="deleteSelectedElement()">Suppr. objet</button>
                <button class="btn primary" onclick="saveStudio('${activity.id}')">Enregistrer</button>
                <button class="btn" onclick="showBoard('${activity.id}',0)">Presenter</button>
                <button class="btn" onclick="closeEditor()">Fermer</button>
              </div>
            </header>
            <div class="slide-world">
              <div class="slide-strip" id="slideStrip" style="height:${stripHeight}px">
                ${activity.slides.map((slide, index) => renderStudioSlide(slide, index)).join("")}
                ${activity.slides.map((slide, index) => (slide.elements || []).map((element) => renderStudioElement(element, index)).join("")).join("")}
              </div>
            </div>
          </section>
        `;
        initStudioDrag();
      }

      function renderStudioSlide(slide, index) {
        const top = index * (slideSize.height + slideSize.gap);
        return `<article class="slide-frame ${index === currentStudioSlideIndex ? "current" : ""}" data-slide-id="${slide.id}" data-slide-index="${index}" data-label="Diapo ${index + 1}" onclick="selectStudioSlide(${index})" style="position:absolute;left:0;top:${top}px"></article>`;
      }

      function renderStudioElement(element, slideIndex = 0) {
        const globalTop = slideIndex * (slideSize.height + slideSize.gap) + Number(element.y || 80);
        return `<div class="slide-el" data-el-id="${element.id}" data-kind="${element.kind}" data-value="${escapeAttr(element.value || "")}" style="left:${Number(element.x || 80)}px;top:${globalTop}px;width:${Number(element.w || 320)}px;height:${Number(element.h || 160)}px">
          ${renderElementContent(element, true)}
        </div>`;
      }

      function renderElementContent(element, editable) {
        if (element.kind === "text") return `<div class="slide-text" contenteditable="${editable ? "true" : "false"}" style="font-size:${Number(element.fontSize || 34)}px">${escapeHtml(element.value || "Texte")}</div>`;
        if (element.kind === "youtube" || youtubeId(element.value)) return youtubeCard(element.value);
        if (element.kind === "image") return `<img src="${escapeAttr(element.value)}" alt="">`;
        if (element.kind === "audio") return `<audio controls src="${escapeAttr(element.value)}"></audio>`;
        if (element.kind === "video") return `<video controls src="${escapeAttr(element.value)}"></video>`;
        return `<iframe src="${toEmbedUrl(element.value)}"></iframe>`;
      }

      function selectedSlide() {
        return document.querySelector(`.slide-frame[data-slide-index="${currentStudioSlideIndex}"]`) || document.querySelector(".slide-frame");
      }

      function selectStudioSlide(index) {
        currentStudioSlideIndex = Number(index || 0);
        document.querySelectorAll(".slide-frame").forEach((frame) => frame.classList.toggle("current", Number(frame.dataset.slideIndex) === currentStudioSlideIndex));
      }

      function addSlide(activityId) {
        saveStudio(activityId, false);
        const activity = findItem("activity", activityId);
        activity.slides.push({ id: uid("slide"), elements: [] });
        openActivityStudio(activityId);
        currentStudioSlideIndex = activity.slides.length - 1;
        selectStudioSlide(currentStudioSlideIndex);
      }

      function addTextElement(activityId) {
        const slide = selectedSlide();
        if (!slide) return;
        document.querySelector("#slideStrip").insertAdjacentHTML("beforeend", renderStudioElement({ id: uid("el"), kind: "text", x: 90, y: 90, w: 420, h: 150, value: "Nouveau texte", fontSize: 38 }, Number(slide.dataset.slideIndex || 0)));
        initStudioDrag();
      }

      function addUrlElement(activityId) {
        const url = prompt("Collez une URL à afficher");
        if (!url) return;
        const kind = kindFromUrl(url);
        const slide = selectedSlide();
        document.querySelector("#slideStrip").insertAdjacentHTML("beforeend", renderStudioElement({ id: uid("el"), kind, x: 100, y: 90, w: 520, h: 300, value: url }, Number(slide.dataset.slideIndex || 0)));
        initStudioDrag();
      }

      function addFileElement(activityId, file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : "embed";
          const slide = selectedSlide();
          document.querySelector("#slideStrip").insertAdjacentHTML("beforeend", renderStudioElement({ id: uid("el"), kind, x: 100, y: 90, w: 520, h: 300, value: reader.result }, Number(slide.dataset.slideIndex || 0)));
          initStudioDrag();
        };
        reader.readAsDataURL(file);
      }

      function renameActivity(activityId) {
        const activity = findItem("activity", activityId);
        const title = prompt("Titre de l'activite", activity.title);
        if (!title) return;
        activity.title = title.trim();
        activity.slug = slugify(activity.title);
        activity.updatedAt = new Date().toISOString();
        saveData("Titre mis à jour.");
        openActivityStudio(activityId);
      }

      function saveStudio(activityId, close = false) {
        const activity = findItem("activity", activityId);
        activity.slides = Array.from(document.querySelectorAll(".slide-frame")).map((slide) => ({
          id: slide.dataset.slideId || uid("slide"),
          elements: []
        }));
        Array.from(document.querySelectorAll(".slide-el")).map(readSlideElement).forEach((element) => {
          const slide = activity.slides[element.slideIndex] || activity.slides[0];
          slide.elements.push(element);
          delete element.slideIndex;
        });
        activity.updatedAt = new Date().toISOString();
        saveData();
        toast("Presentation enregistree.");
        if (close) {
          closeEditor();
          render();
        }
      }

      function readSlideElement(node) {
        const kind = node.dataset.kind || "text";
        const textNode = node.querySelector(".slide-text");
        const globalY = parseFloat(node.style.top) || 0;
        const slideStep = slideSize.height + slideSize.gap;
        const slideIndex = Math.max(0, Math.min(document.querySelectorAll(".slide-frame").length - 1, Math.floor(globalY / slideStep)));
        return {
          id: node.dataset.elId || uid("el"),
          kind,
          x: parseFloat(node.style.left) || 0,
          y: globalY - slideIndex * slideStep,
          w: node.offsetWidth,
          h: node.offsetHeight,
          value: kind === "text" ? textNode?.innerText || "" : node.dataset.value || "",
          fontSize: kind === "text" ? parseFloat(textNode?.style.fontSize || "34") || 34 : undefined,
          slideIndex
        };
      }

      function initStudioDrag() {
        document.querySelectorAll(".slide-el").forEach((node) => {
          node.onpointerdown = (event) => {
            if (event.target.closest(".slide-text") && event.detail > 1) return;
            document.querySelectorAll(".slide-el").forEach((item) => item.classList.remove("selected"));
            node.classList.add("selected", "dragging");
            const startX = event.clientX;
            const startY = event.clientY;
            const left = parseFloat(node.style.left) || 0;
            const top = parseFloat(node.style.top) || 0;
            node.setPointerCapture(event.pointerId);
            node.onpointermove = (move) => {
              node.style.left = `${Math.max(0, left + move.clientX - startX)}px`;
              node.style.top = `${Math.max(0, top + move.clientY - startY)}px`;
            };
            node.onpointerup = () => {
              node.classList.remove("dragging");
              node.onpointermove = null;
              node.onpointerup = null;
            };
          };
        });
      }

      function deleteSelectedElement() {
        const selected = document.querySelector(".slide-el.selected");
        if (selected) selected.remove();
      }

      function saveEditor(event, type, id) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const item = {};
        form.forEach((value, key) => item[key] = String(value));
        item.isVisible = item.isVisible === "true";
        item.title = item.title.trim() || "Sans titre";
        item.slug = String(item.slug || "").trim() || slugify(item.title);
        item.order = Number(item.order || 0);
        item.updatedAt = new Date().toISOString();
        if (type === "studentClass") {
          item.students = String(item.students || "").split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
        }
        upsertItem(type, id, item);
        closeEditor();
        saveData("Enregistre.");
      }

      function upsertItem(type, id, item) {
        if (type === "studentClass") {
          state.studentClasses = Array.isArray(state.studentClasses) ? state.studentClasses : [];
          if (id) Object.assign(findItem("studentClass", id), item);
          else state.studentClasses.push({ ...createBlank("studentClass", {}), ...item, id: uid("student-class") });
        }
        if (type === "class") {
          if (id) Object.assign(findItem("class", id), item);
          else state.classes.push({ ...createBlank("class", {}), ...item, id: uid("class"), sequences: [] });
        }
        if (type === "sequence") {
          if (id) Object.assign(findItem("sequence", id), item);
          else findItem("class", item.classId).sequences.push({ ...createBlank("sequence", {}), ...item, id: uid("seq"), lessons: [] });
        }
        if (type === "lesson") {
          if (id) Object.assign(findItem("lesson", id), item);
          else findItem("sequence", item.sequenceId).lessons.push({ ...createBlank("lesson", {}), ...item, id: uid("lesson"), activities: [] });
        }
        if (type === "activity") {
          if (id) Object.assign(findItem("activity", id), item);
          else findItem("lesson", item.lessonId).activities.push({ ...createBlank("activity", {}), ...item, id: uid("act"), resources: [] });
        }
        if (type === "resource") {
          if (id) {
            Object.assign(findItem("resource", id), item);
            return;
          }
          const resource = { ...createBlank("resource", {}), ...item, id: uid("res") };
          if (resource.activityId) findItem("activity", resource.activityId).resources.push(resource);
          else state.resources.push(resource);
        }
      }

      function findItem(type, id) {
        if (type === "studentClass") return (state.studentClasses || []).find((item) => item.id === id);
        if (type === "class") return state.classes.find((item) => item.id === id);
        for (const classe of state.classes) {
          if (type === "sequence") {
            const found = classe.sequences.find((item) => item.id === id);
            if (found) return found;
          }
          for (const sequence of classe.sequences) {
            if (type === "lesson") {
              const found = sequence.lessons.find((item) => item.id === id);
              if (found) return found;
            }
            for (const lesson of sequence.lessons) {
              if (type === "activity") {
                const found = lesson.activities.find((item) => item.id === id);
                if (found) return found;
              }
              for (const activity of lesson.activities) {
                if (type === "resource") {
                  const found = activity.resources.find((item) => item.id === id);
                  if (found) return found;
                }
              }
            }
          }
        }
        if (type === "resource") return state.resources.find((item) => item.id === id);
        return null;
      }

      function removeItem(type, id) {
        if (!requireLogin()) return;
        if (!confirm("Supprimer cet element ?")) return;
        updatePageAfterRemove(type, id);
        removeFromCollections(type, id);
        saveData("Element supprime.");
      }

      function updatePageAfterRemove(type, id) {
        if (type === "class" && currentPage.classId === id) {
          currentPage = { type: "classes" };
        }
        if (type === "sequence" && currentPage.sequenceId === id) {
          currentPage = { type: "class", classId: currentPage.classId };
        }
        if (type === "lesson" && currentPage.lessonId === id) {
          currentPage = { type: "sequence", classId: currentPage.classId, sequenceId: currentPage.sequenceId };
        }
      }

      function removeFromCollections(type, id) {
        if (type === "studentClass") state.studentClasses = (state.studentClasses || []).filter((item) => item.id !== id);
        if (type === "class") state.classes = state.classes.filter((item) => item.id !== id);
        state.classes.forEach((classe) => {
          if (type === "sequence") classe.sequences = classe.sequences.filter((item) => item.id !== id);
          classe.sequences.forEach((sequence) => {
            if (type === "lesson") sequence.lessons = sequence.lessons.filter((item) => item.id !== id);
            sequence.lessons.forEach((lesson) => {
              if (type === "activity") lesson.activities = lesson.activities.filter((item) => item.id !== id);
              lesson.activities.forEach((activity) => {
                if (type === "resource") activity.resources = activity.resources.filter((item) => item.id !== id);
              });
            });
          });
        });
        if (type === "resource") state.resources = state.resources.filter((item) => item.id !== id);
      }

      function moveItem(type, id, direction) {
        if (!requireLogin()) return;
        const list = findList(type, id);
        if (!list) return;
        const index = list.findIndex((item) => item.id === id);
        const target = index + direction;
        if (target < 0 || target >= list.length) return;
        [list[index], list[target]] = [list[target], list[index]];
        list.forEach((item, order) => item.order = order + 1);
        saveData("Ordre mis à jour.");
      }

      function findList(type, id) {
        if (type === "class") return state.classes;
        for (const classe of state.classes) {
          if (type === "sequence" && classe.sequences.some((item) => item.id === id)) return classe.sequences;
          for (const sequence of classe.sequences) {
            if (type === "lesson" && sequence.lessons.some((item) => item.id === id)) return sequence.lessons;
            for (const lesson of sequence.lessons) {
              if (type === "activity" && lesson.activities.some((item) => item.id === id)) return lesson.activities;
            }
          }
        }
        return null;
      }

      function labelType(type) {
        return { class: "Classe", studentClass: "Groupes Classes", sequence: "Séquence", lesson: "Séance", activity: "Activité", resource: "Ressource" }[type] || type;
      }

      function showBoard(id, slideIndex = 0) {
        const result = findActivity(id);
        if (!result) return;
        document.querySelector("#editorModal").hidden = true;
        const { activity, lesson, sequence, classe } = result;
        ensureActivitySlides(activity);
        const slides = activity.slides || [];
        const index = Math.max(0, Math.min(Number(slideIndex || 0), slides.length - 1));
        const slideElements = elementsForBoardSlide(activity, index);
        const previousIndex = index > 0 ? index - 1 : null;
        const nextIndex = index < slides.length - 1 ? index + 1 : null;
        document.querySelector("#appPage").hidden = true;
        document.querySelector("#boardPage").hidden = false;
        document.querySelector("#boardPage").innerHTML = `
          <main class="board-wrap">
            <section class="board-slide-stage">
              <div class="board-slide-inner" style="transform:scale(var(--board-scale,1))">
                ${slideElements.map(renderBoardSlideElement).join("")}
              </div>
            </section>
          </main>
          <div class="board-controls">
            <button class="btn" onclick="hideBoard()">Retour</button>
            <button class="btn primary" ${previousIndex !== null ? `onclick="showBoard('${activity.id}',${previousIndex})"` : "disabled"}>Precedent</button>
            <button class="btn primary" ${nextIndex !== null ? `onclick="showBoard('${activity.id}',${nextIndex})"` : "disabled"}>Suivant</button>
            <button class="btn" onclick="document.documentElement.requestFullscreen && document.documentElement.requestFullscreen()">Plein ecran</button>
          </div>
        `;
        fitBoardSlide();
      }

      function elementsForBoardSlide(activity, slideIndex) {
        const slideStep = slideSize.height + slideSize.gap;
        const windowTop = slideIndex * slideStep;
        const windowBottom = windowTop + slideSize.height;
        const output = [];
        (activity.slides || []).forEach((slide, index) => {
          (slide.elements || []).forEach((element) => {
            const globalTop = index * slideStep + Number(element.y || 0);
            const globalBottom = globalTop + Number(element.h || 0);
            if (globalBottom > windowTop && globalTop < windowBottom) {
              output.push({ ...element, y: globalTop - windowTop });
            }
          });
        });
        return output;
      }

      function renderBoardSlideElement(element) {
        return `<div class="slide-el" style="left:${Number(element.x || 0)}px;top:${Number(element.y || 0)}px;width:${Number(element.w || 320)}px;height:${Number(element.h || 160)}px">${renderElementContent(element, false)}</div>`;
      }

      function fitBoardSlide() {
        const stage = document.querySelector(".board-slide-stage");
        const inner = document.querySelector(".board-slide-inner");
        if (!stage || !inner) return;
        const scale = Math.min(stage.clientWidth / slideSize.width, stage.clientHeight / slideSize.height);
        const left = (stage.clientWidth - slideSize.width * scale) / 2;
        const top = (stage.clientHeight - slideSize.height * scale) / 2;
        inner.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
      }

      function hideBoard() {
        document.querySelector("#boardPage").hidden = true;
        document.querySelector("#appPage").hidden = false;
      }

      function exportData() {
        if (!requireLogin()) return;
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "in-viaggio-data.json";
        link.click();
        URL.revokeObjectURL(link.href);
      }

      async function exportZip() {
        if (!requireLogin()) return;
        const files = buildExportFiles();
        const blob = new Blob([makeZip(files)], { type: "application/zip" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `in-viaggio-export-${new Date().toISOString().slice(0, 10)}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast("ZIP exporte.");
      }

      function buildExportFiles() {
        const files = [{
          path: "donnees-completes.json",
          content: JSON.stringify(state, null, 2)
        }, {
          path: "README.txt",
          content: "Export local In viaggio per l'Italia\n\nLe fichier donnees-completes.json contient toute la sauvegarde importable.\nLes dossiers classes/ contiennent une copie lisible classe par classe.\n"
        }];

        state.classes.forEach((classe, classIndex) => {
          const classFolder = `classes/${String(classIndex + 1).padStart(2, "0")}-${slugify(classe.title)}`;
          files.push({ path: `${classFolder}/classe.json`, content: JSON.stringify(classe, null, 2) });
          (classe.sequences || []).forEach((sequence, sequenceIndex) => {
            const sequenceFolder = `${classFolder}/sequences/${String(sequenceIndex + 1).padStart(2, "0")}-${slugify(sequence.title)}`;
            files.push({ path: `${sequenceFolder}/sequence.json`, content: JSON.stringify(sequence, null, 2) });
            (sequence.lessons || []).forEach((lesson, lessonIndex) => {
              const lessonFolder = `${sequenceFolder}/seances/${String(lessonIndex + 1).padStart(2, "0")}-${slugify(lesson.title)}`;
              files.push({ path: `${lessonFolder}/seance.json`, content: JSON.stringify(lesson, null, 2) });
              (lesson.activities || []).forEach((activity, activityIndex) => {
                const activityFolder = `${lessonFolder}/presentations/${String(activityIndex + 1).padStart(2, "0")}-${slugify(activity.title)}`;
                files.push({ path: `${activityFolder}/presentation.json`, content: JSON.stringify(activity, null, 2) });
                files.push({ path: `${activityFolder}/resume.txt`, content: presentationSummary(classe, sequence, lesson, activity) });
                files.push({ path: `${activityFolder}/${slugify(activity.title)}.pptx`, content: makePptx(activity), binary: true });
              });
            });
          });
        });
        (state.studentClasses || []).forEach((classe, index) => {
          const folder = `mes-classes/${String(index + 1).padStart(2, "0")}-${slugify(classe.title)}`;
          files.push({ path: `${folder}/classe.json`, content: JSON.stringify(classe, null, 2) });
          files.push({ path: `${folder}/eleves.txt`, content: (classe.students || []).join("\n") });
          files.push({ path: `${folder}/historique-roue.json`, content: JSON.stringify((state.tools?.wheelHistory || {})[classe.id] || [], null, 2) });
          files.push({ path: `${folder}/compteurs-roue.json`, content: JSON.stringify((state.tools?.wheelCounts || {})[classe.id] || {}, null, 2) });
          files.push({ path: `${folder}/reglages-roue.json`, content: JSON.stringify({ limite: (state.tools?.wheelLimits || {})[classe.id] || 2 }, null, 2) });
          files.push({ path: `${folder}/absents-roue.json`, content: JSON.stringify((state.tools?.wheelAbsences || {})[classe.id] || [], null, 2) });
        });
        files.push({ path: "outils/roue-historiques.json", content: JSON.stringify(state.tools?.wheelHistory || {}, null, 2) });
        files.push({ path: "outils/roue-compteurs.json", content: JSON.stringify(state.tools?.wheelCounts || {}, null, 2) });
        files.push({ path: "outils/roue-reglages.json", content: JSON.stringify(state.tools?.wheelLimits || {}, null, 2) });
        files.push({ path: "outils/roue-absents.json", content: JSON.stringify(state.tools?.wheelAbsences || {}, null, 2) });
        return files;
      }

      function presentationSummary(classe, sequence, lesson, activity) {
        return [
          `Classe: ${classe.title}`,
          `Séquence: ${sequence.title}`,
          `Séance: ${lesson.title}`,
          `Presentation: ${activity.title}`,
          `Description: ${activity.description || ""}`,
          `Diapos: ${(activity.slides || []).length}`,
          "",
          "Ce fichier est une copie lisible. La version complète est dans presentation.json et donnees-completes.json."
        ].join("\n");
      }

      function makePptx(activity) {
        const slides = (activity.slides || []).length ? activity.slides : [{ elements: [] }];
        const files = [
          { path: "[Content_Types].xml", content: pptxContentTypes(slides.length) },
          { path: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>` },
          { path: "ppt/presentation.xml", content: pptxPresentation(slides.length) },
          { path: "ppt/_rels/presentation.xml.rels", content: pptxPresentationRels(slides.length) }
        ];
        slides.forEach((slide, index) => {
          files.push({ path: `ppt/slides/slide${index + 1}.xml`, content: pptxSlide(activity, slide, index) });
        });
        return makeZip(files);
      }

      function pptxContentTypes(count) {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${Array.from({ length: count }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`;
      }

      function pptxPresentation(count) {
        const ids = Array.from({ length: count }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("");
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
      }

      function pptxPresentationRels(count) {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from({ length: count }, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>`;
      }

      function pptxSlide(activity, slide, index) {
        const shapes = [
          pptxTextShape(`title-${index}`, activity.title || "Presentation", 50, 24, 860, 54, 28, true),
          ...(slide.elements || []).map((element, elementIndex) => pptxElementShape(element, `${index}-${elementIndex}`))
        ].join("");
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFDF9"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
      }

      function pptxElementShape(element, id) {
        const text = element.kind === "text" ? element.value || "" : `${labelTypeForPptx(element.kind)}\n${element.value || ""}`;
        return pptxTextShape(id, text, Number(element.x || 0), Number(element.y || 0), Number(element.w || 320), Number(element.h || 120), Number(element.fontSize || 24), element.kind === "text");
      }

      function pptxTextShape(id, text, x, y, w, h, fontSize, plain) {
        const shapeId = Math.abs(String(id).split("").reduce((sum, char) => sum + char.charCodeAt(0), 10));
        const px = 12700;
        const paragraphs = String(text || "").split(/\r?\n/).map((line) => `<a:p><a:r><a:rPr lang="fr-FR" sz="${Math.max(900, Math.round(fontSize * 100))}" b="${plain ? 0 : 1}"/><a:t>${xmlEscape(line || " ")}</a:t></a:r></a:p>`).join("");
        return `<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="Zone ${shapeId}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(x * px)}" y="${Math.round(y * px)}"/><a:ext cx="${Math.round(w * px)}" cy="${Math.round(h * px)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${plain ? "FFFFFF" : "F8F1E8"}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="E8D6D9"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
      }

      function labelTypeForPptx(kind) {
        if (kind === "youtube") return "Video YouTube";
        if (kind === "image") return "Image";
        if (kind === "audio") return "Audio";
        if (kind === "video") return "Video";
        return "Ressource";
      }

      function xmlEscape(value) {
        return String(value || "").replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char]));
      }

      function makeZip(files) {
        const encoder = new TextEncoder();
        const localParts = [];
        const centralParts = [];
        let offset = 0;
        files.forEach((file) => {
          const name = encoder.encode(file.path.replace(/\\/g, "/"));
          const data = file.binary ? file.content : encoder.encode(file.content);
          const crc = crc32(data);
          const local = zipHeader(0x04034b50, [
            [2, 20], [2, 0], [2, 0], [2, 0], [2, 0],
            [4, crc], [4, data.length], [4, data.length],
            [2, name.length], [2, 0]
          ]);
          localParts.push(local, name, data);
          const central = zipHeader(0x02014b50, [
            [2, 20], [2, 20], [2, 0], [2, 0], [2, 0], [2, 0],
            [4, crc], [4, data.length], [4, data.length],
            [2, name.length], [2, 0], [2, 0], [2, 0], [2, 0],
            [4, 0], [4, offset]
          ]);
          centralParts.push(central, name);
          offset += local.length + name.length + data.length;
        });
        const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
        const end = zipHeader(0x06054b50, [
          [2, 0], [2, 0], [2, files.length], [2, files.length],
          [4, centralSize], [4, offset], [2, 0]
        ]);
        return concatUint8([...localParts, ...centralParts, end]);
      }

      function zipHeader(signature, fields) {
        const size = 4 + fields.reduce((total, field) => total + field[0], 0);
        const bytes = new Uint8Array(size);
        const view = new DataView(bytes.buffer);
        view.setUint32(0, signature, true);
        let cursor = 4;
        fields.forEach(([length, value]) => {
          if (length === 2) view.setUint16(cursor, value, true);
          else view.setUint32(cursor, value >>> 0, true);
          cursor += length;
        });
        return bytes;
      }

      function concatUint8(parts) {
        const total = parts.reduce((sum, part) => sum + part.length, 0);
        const output = new Uint8Array(total);
        let offset = 0;
        parts.forEach((part) => {
          output.set(part, offset);
          offset += part.length;
        });
        return output;
      }

      function crc32(bytes) {
        let crc = -1;
        for (let i = 0; i < bytes.length; i++) {
          crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
        }
        return (crc ^ -1) >>> 0;
      }

      const crcTable = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          table[i] = c >>> 0;
        }
        return table;
      })();

      function importData(file) {
        if (!requireLogin()) return;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          state = JSON.parse(reader.result);
          saveData("Données importées.");
        };
        reader.readAsText(file);
      }

      function resetData() {
        if (!requireLogin()) return;
        if (!confirm("Reinitialiser toutes les donnees locales ?")) return;
        state = seedData();
        saveData("Données réinitialisées.");
      }

      function empty(text) {
        return `<p class="empty">${text}</p>`;
      }

      document.querySelector("#loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (await loginAccount(String(form.get("username") || ""), String(form.get("password") || ""))) {
          document.querySelector("#loginError").hidden = true;
          render();
        } else {
          document.querySelector("#loginError").hidden = false;
        }
      });

      document.querySelectorAll(".nav-button[data-view]").forEach((button) => button.addEventListener("click", () => openViewInNewTab(button.dataset.view)));
      document.querySelector("#loginNavBtn").addEventListener("click", showLogin);
      document.querySelector("#logoutBtn").addEventListener("click", async () => {
        await window.ServerAPI.logout().catch(() => {});
        authenticatedUser = null;
        storageInfo = null;
        state = ensureDemoData(seedData());
        currentView = "dashboard";
        currentPage = { type: "classes" };
        currentTableauPage = { type: "classes" };
        render();
      });
      document.querySelector("#openBoardBtn").addEventListener("click", () => {
        const first = flatten().activities[0];
        if (first) openBoardInNewTab(first.id);
      });
      window.addEventListener("resize", () => {
        fitBoardSlide();
        if (tourRunning) renderTutorialOverlay(tutorialSteps[tourIndex]);
      });

      async function bootstrapApplication() {
        applyInitialRoute();
        try {
          authenticatedUser = await window.ServerAPI.me();
          if (authenticatedUser.must_change_password) {
            state = ensureDemoData(seedData());
          } else {
            const workspace = await window.ServerAPI.loadWorkspace();
            state = Object.keys(workspace.content || {}).length ? ensureDemoData(workspace.content) : ensureDemoData(seedData());
            storageInfo = await window.ServerAPI.storage().catch(() => null);
            window.ServerAPI.replayOfflineDraft().catch(() => {});
          }
        } catch {
          authenticatedUser = null;
        }
        render();
        if (authenticatedUser?.must_change_password) {
          setTimeout(() => offerPasswordChange(), 120);
        }
        const initialParams = new URLSearchParams(window.location.search);
        if (initialParams.get("board") && isLoggedIn()) {
          setTimeout(() => showBoard(initialParams.get("board"), Number(initialParams.get("slide") || 0)), 0);
        }
      }

      bootstrapApplication();
