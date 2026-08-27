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
      const slideTools = {
        wheel: { title: "Roue de la fortune", description: "Tirer un élève au hasard dans un groupe classe." },
        timer: { title: "Chronomètre", description: "Afficher et piloter le minuteur de classe." }
      };
      const teacherToolLinks = [
        { group: "Télécharger des vidéos YouTube", title: "TurboScribe", description: "Télécharger une vidéo depuis son adresse YouTube.", url: "https://turboscribe.ai/fr/downloader/youtube/video" },
        { group: "Télécharger des vidéos YouTube", title: "Freemake", description: "Téléchargeur de vidéos en ligne.", url: "https://www.freemake.com/fr/free_video_downloader_choicest/" },
        { group: "Créer des contenus", title: "QuizWizard", description: "Créer des contenus et des questionnaires à partir d'une source.", url: "https://app.getquizwizard.com/create-content/source" },
        { group: "Créer des contenus", title: "Digistorm", description: "Créer des remue-méninges, nuages de mots, questionnaires et quiz.", url: "https://digistorm.app/" },
        { group: "Adapter et différencier", title: "Pictofacile", description: "Transformer une phrase en pictogrammes.", url: "https://www.pictofacile.com/fr" },
        { group: "Adapter et différencier", title: "DigiView", description: "Épurer une vidéo et retirer les distractions.", url: "https://ladigitale.dev/digiview/#/" },
        { group: "Adapter et différencier", title: "Cap'FALC", description: "Aider à transformer un texte en Facile à lire et à comprendre.", url: "https://falc.unapei.org/" },
        { group: "Adapter et différencier", title: "MyDys", description: "Adapter les contenus pour les élèves à besoins particuliers.", url: "https://mydys.app/fr/index.php" },
        { group: "Adapter et différencier", title: "DysFacile", description: "Faciliter la lecture sur ordinateur.", url: "https://dysfacile-ordinateur.lovable.app/" },
        { group: "Adapter et différencier", title: "DigiPad – différenciation", description: "Accéder au mur de ressources de différenciation.", url: "https://digipad.app/p/1739669/e48690b8789e3" }
      ];
      const workspaceShortcuts = [
        { title: "Cahier de texte", description: "Ouvrir Pronote professeur.", url: "https://0380035g.index-education.net/pronote/professeur.html" },
        { title: "Messagerie", description: "Ouvrir la messagerie de l'académie de Grenoble.", url: "https://extranet.ac-grenoble.fr/iwc_static/layout/main.html?lang=fr&3.0.1.3.0_16070513" }
      ];
      const localAccounts = {
        root: { password: "root", role: "admin" },
        rose: { password: "it", role: "teacher" }
      };
      const localSessionKey = "mep-local-session-v1";
      const slideSize = { width: 960, height: 540, gap: 36 };
      let authenticatedUser = null;
      let storageInfo = null;
      let adminUsers = [];
      let adminUsersLoaded = false;
      let adminUsersLoading = false;
      let adminUsersError = "";
      let state = ensureDemoData(seedData());
      let lastConfirmedState = JSON.parse(JSON.stringify(state));
      let currentView = "dashboard";
      let currentPage = { type: "classes" };
      let currentTableauPage = { type: "classes" };
      let currentStudioSlideIndex = 0;
      let studioHistoryActivityId = "";
      let studioUndoStack = [];
      let studioRedoStack = [];
      let studioTextSelectionRange = null;
      let studioTextSelectionListenerReady = false;
      let timerRemaining = 5 * 60;
      let timerTotal = 5 * 60;
      let timerInterval = null;
      let tourIndex = 0;
      let tourRunning = false;
      let activeTutorialSteps = null;
      let freeExampleOpen = false;
      let pendingWorkspaceSave = Promise.resolve(true);
      let activeSaveLocks = 0;

      function uid(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      }

      function slugify(text) {
        return String(text || "sans-titre").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
      }

      function markStateConfirmed(value = state) {
        lastConfirmedState = JSON.parse(JSON.stringify(value));
      }

      async function loginAccount(username, password) {
        const cleanUsername = String(username || "").trim();
        if (!cleanUsername || !password) return false;
        if (isLocalFileMode()) {
          const localUsername = slugify(cleanUsername);
          const account = localAccounts[localUsername];
          if (!account || account.password !== password) return false;
          authenticatedUser = localAuthenticatedUser(localUsername);
          sessionStorage.setItem(localSessionKey, localUsername);
          adminUsers = [];
          adminUsersLoaded = false;
          adminUsersError = "";
          state = ensureDemoData(loadData());
          storageInfo = null;
          markStateConfirmed();
          currentView = "dashboard";
          currentPage = { type: "classes" };
          currentTableauPage = { type: "classes" };
          return true;
        }
        try {
          authenticatedUser = await window.ServerAPI.login(cleanUsername, password);
          adminUsers = [];
          adminUsersLoaded = false;
          adminUsersError = "";
        } catch (error) {
          console.warn("Connexion serveur refusée", error);
          return false;
        }
        const workspace = await window.ServerAPI.loadWorkspace();
        const recoveredWorkspace = await window.ServerAPI.replayOfflineDraft(workspace).catch(() => null);
        const effectiveWorkspace = recoveredWorkspace || workspace;
        state = Object.keys(effectiveWorkspace.content || {}).length ? ensureDemoData(effectiveWorkspace.content) : ensureDemoData(seedData());
        storageInfo = await window.ServerAPI.storage().catch(() => null);
        markStateConfirmed();
        currentView = "dashboard";
        currentPage = { type: "classes" };
        currentTableauPage = { type: "classes" };
        return true;
      }

      function currentUsername() {
        return authenticatedUser?.username || "";
      }

      function isLocalFileMode() {
        return window.location.protocol === "file:";
      }

      function localAuthenticatedUser(username) {
        const account = localAccounts[username];
        return account ? { id: `local-${username}`, username, role: account.role, status: "active", local: true } : null;
      }

      function usesServerStorage() {
        return isLoggedIn() && !isLocalFileMode();
      }

      function canEdit() {
        return isLoggedIn() || freeExampleOpen;
      }

      function isLoggedIn() {
        return Boolean(currentUsername());
      }

      function editOnly(html) {
        return canEdit() ? html : "";
      }

      function requireLogin() {
        if (canEdit()) return true;
        toast("Connectez-vous pour modifier.");
        return false;
      }

      function showLogin() {
        freeExampleOpen = false;
        endTutorial();
        document.querySelector("#appPage").hidden = true;
        document.querySelector("#boardPage").hidden = true;
        document.querySelector("#loginPage").hidden = false;
        const localHint = document.querySelector("#localLoginHint");
        if (localHint) {
          localHint.hidden = !isLocalFileMode();
          localHint.innerHTML = isLocalFileMode() ? "Mode local : utilisez <strong>rose / it</strong> ou <strong>root / root</strong>." : "";
        }
        setTimeout(() => document.querySelector("input[name='username']")?.focus(), 50);
      }

      async function openFreeExample() {
        if (!isLocalFileMode()) window.ServerAPI.logout().catch(() => {});
        sessionStorage.removeItem(localSessionKey);
        authenticatedUser = null;
        storageInfo = null;
        freeExampleOpen = true;
        try {
          const response = await fetch("assets/free-example/data.json?v=2026-08-13-1", { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          state = ensureDemoData(await response.json());
          if (!state.schedule.length && state.classes[0]) {
            const demoGroup = state.studentClasses[0]?.title || "Groupe exemple";
            [["lundi", 480, 600], ["mardi", 630, 720], ["jeudi", 840, 960], ["vendredi", 540, 630]].forEach(([day, start, end], index) => state.schedule.push({ id: uid("schedule"), day, start, end, level: state.classes[0].title, groupTitle: demoGroup, description: ["Cours de démonstration", "Travail en groupe", "Activité à projeter", "Bilan de la semaine"][index], classId: state.classes[0].id }));
          }
          await convertFreePptxDocuments();
        } catch (error) {
          console.error("Chargement de l’exemple gratuit impossible", error);
          state = ensureDemoData(seedData());
          toast("Le fichier d’exemple n’a pas pu être chargé. L’exemple de secours est utilisé.");
        }
        markStateConfirmed();
        currentView = "dashboard";
        currentPage = { type: "classes" };
        currentTableauPage = { type: "classes" };
        render();
        toast("Mode gratuit : toutes les fonctions sont disponibles, sans aucun enregistrement sur le serveur.");
        setTimeout(startFreeExampleTutorial, 250);
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
                      makeActivity("Carte d’identité de Leonardo", "Activité courte pour découvrir Leonardo da Vinci.", "Comprendre une activité simple.", "Observe les images et retrouve les informations importantes.", 1, [
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
                        imageSlide("Lessico", "il pennello\nil quadro\nil disegno\nla macchina", "https://upload.wikimedia.org/wikipedia/commons/9/99/Leonardo_da_Vinci_-_Study_of_hands_-_WGA12812.jpg")
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
                      makeActivity("Lettre à Ludovico Sforza", "Simulation de candidature.", "Présenter ses compétences.", "Écris 5 lignes : Sono capace di..., posso..., vorrei...", 1, [
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
        data.studentClasses.forEach((group) => { group.seatingPlan = group.seatingPlan || { rows: 3, columns: 4, desks: [] }; });
        data.schedule = Array.isArray(data.schedule) ? data.schedule : [];
        data.tools = data.tools && typeof data.tools === "object" ? data.tools : {};
        data.tools.wheelHistory = data.tools.wheelHistory && typeof data.tools.wheelHistory === "object" ? data.tools.wheelHistory : {};
        data.tools.wheelCounts = data.tools.wheelCounts && typeof data.tools.wheelCounts === "object" ? data.tools.wheelCounts : {};
        data.tools.wheelLimits = data.tools.wheelLimits && typeof data.tools.wheelLimits === "object" ? data.tools.wheelLimits : {};
        data.tools.wheelAbsences = data.tools.wheelAbsences && typeof data.tools.wheelAbsences === "object" ? data.tools.wheelAbsences : {};
        repairKnownBrokenImageUrls(data);
        data.classes.forEach((classe) => (classe.sequences || []).forEach((sequence) => (sequence.lessons || []).forEach((lesson) => (lesson.activities || []).forEach(ensureActivitySlides))));
        data.classes.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
        return data;
      }

      function repairKnownBrokenImageUrls(data) {
        const replacements = new Map([
          [
            "https://upload.wikimedia.org/wikipedia/commons/4/4e/Leonardo_da_Vinci_-_study_of_hands.jpg",
            "https://upload.wikimedia.org/wikipedia/commons/9/99/Leonardo_da_Vinci_-_Study_of_hands_-_WGA12812.jpg"
          ]
        ]);
        const visit = (value) => {
          if (Array.isArray(value)) return value.forEach(visit);
          if (!value || typeof value !== "object") return;
          for (const [key, item] of Object.entries(value)) {
            if (typeof item === "string" && replacements.has(item)) value[key] = replacements.get(item);
            else visit(item);
          }
        };
        visit(data);
      }

      function ensureActivitySlides(activity) {
        if (Array.isArray(activity.slides) && activity.slides.length) {
          activity.slides.forEach(slide=>{ if(!slide.duration) slide.duration=activity.estimatedDuration||"5 min"; });
          deduplicateSlideElements(activity.slides);
          return activity;
        }
        activity.slides = [{
          id: uid("slide"),
          duration: activity.estimatedDuration || "5 min",
          elements: [
            { id: uid("el"), kind: "text", x: 70, y: 62, w: 820, h: 105, value: activity.title || "Activité", fontSize: 50 },
            { id: uid("el"), kind: "text", x: 70, y: 205, w: 820, h: 210, value: activity.instruction || activity.objective || activity.description || "Nouvelle diapo", fontSize: 34 }
          ]
        }];
        return activity;
      }

      function deduplicateSlideElements(slides) {
        const seen = new Set();
        for (let slideIndex = (slides || []).length - 1; slideIndex >= 0; slideIndex -= 1) {
          const elements = Array.isArray(slides[slideIndex].elements) ? slides[slideIndex].elements : [];
          const unique = [];
          for (let elementIndex = elements.length - 1; elementIndex >= 0; elementIndex -= 1) {
            const element = elements[elementIndex];
            const id = String(element?.id || "");
            if (id && seen.has(id)) continue;
            if (id) seen.add(id);
            unique.unshift(element);
          }
          slides[slideIndex].elements = unique;
        }
        return slides;
      }

      function loadData() {
        try {
          return JSON.parse(localStorage.getItem(currentCacheKey())) || seedData();
        } catch {
          return seedData();
        }
      }

      function beginSaveLock(triggerButton) {
        const button = triggerButton instanceof HTMLElement
          ? triggerButton.closest("button")
          : document.activeElement?.closest?.("button");
        if (button && !button.dataset.savingLabel) {
          button.dataset.savingLabel = button.innerHTML;
          button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span> Enregistrement…`;
          button.disabled = true;
          button.setAttribute("aria-busy", "true");
        }
        let blocker = document.querySelector("#saveBlocker");
        if (!blocker) {
          blocker = document.createElement("div");
          blocker.id = "saveBlocker";
          blocker.className = "save-blocker";
          blocker.innerHTML = `<div class="save-blocker-card"><span class="save-spinner" aria-hidden="true"></span><strong>Enregistrement sur le serveur…</strong><span>Veuillez patienter.</span></div>`;
          document.body.appendChild(blocker);
        }
        activeSaveLocks += 1;
        blocker.hidden = false;
        document.body.classList.add("saving-workspace");
        ["appPage", "editorModal", "boardPage"].forEach((id) => {
          const element = document.getElementById(id);
          if (element) element.inert = true;
        });
        return () => {
          if (button?.dataset.savingLabel) {
            button.innerHTML = button.dataset.savingLabel;
            delete button.dataset.savingLabel;
            button.disabled = false;
            button.removeAttribute("aria-busy");
          }
          activeSaveLocks = Math.max(0, activeSaveLocks - 1);
          if (activeSaveLocks > 0) return;
          blocker.hidden = true;
          document.body.classList.remove("saving-workspace");
          ["appPage", "editorModal", "boardPage"].forEach((id) => {
            const element = document.getElementById(id);
            if (element) element.inert = false;
          });
        };
      }

      async function saveData(message, triggerButton) {
        if (!freeExampleOpen) {
          localStorage.setItem(currentCacheKey(), JSON.stringify({ ...state, cachedAt: new Date().toISOString() }));
        }
        if (!usesServerStorage()) {
          markStateConfirmed();
          if (message) toast(freeExampleOpen ? "Modification appliquée pour cette visite uniquement." : message);
          render();
          return true;
        }
        const finishSaveLock = beginSaveLock(triggerButton);
        const snapshot = JSON.parse(JSON.stringify(state));
        const operation = pendingWorkspaceSave
          .then(() => window.ServerAPI.saveWorkspace(snapshot, true));
        pendingWorkspaceSave = operation.then(() => true, () => false);
        try {
          const savedWorkspace = await operation;
          const confirmedState = savedWorkspace?.content && typeof savedWorkspace.content === "object"
            ? ensureDemoData(savedWorkspace.content)
            : snapshot;
          state = confirmedState;
          markStateConfirmed(confirmedState);
          localStorage.setItem(currentCacheKey(), JSON.stringify({ ...confirmedState, cachedAt: new Date().toISOString() }));
          render();
          toast(message || "Enregistrement terminé.");
          return true;
        } catch (error) {
          console.error("Échec de la sauvegarde serveur", error);
          state = JSON.parse(JSON.stringify(lastConfirmedState));
          localStorage.setItem(currentCacheKey(), JSON.stringify({ ...state, cachedAt: new Date().toISOString() }));
          render();
          toast(`Enregistrement impossible : ${error.message || "erreur serveur"}. La modification n'a pas été appliquée.`);
          return false;
        } finally {
          finishSaveLock();
        }
      }

      function offerPasswordChange() {
        if (isLocalFileMode()) {
          toast("Les mots de passe du mode local sont fixes. Utilisez root/root ou rose/it.");
          return;
        }
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `
          <div class="drawer">
            <div class="drawer-head">
              <div><p class="small" style="font-weight:850;color:var(--wine-700)">Sécurité</p><h2 style="margin:0;color:var(--wine-900)">Changer le mot de passe</h2></div>
              <button class="btn icon" type="button" onclick="closeEditor()">X</button>
            </div>
            <form class="drawer-body password-form" id="passwordChangeForm">
              <div class="security-callout"><strong>Protégez votre espace</strong><span>Choisissez un mot de passe unique d'au moins 10 caractères. Les autres appareils connectés seront déconnectés.</span></div>
              ${passwordField("currentPassword", "Mot de passe actuel", "current-password", false)}
              ${passwordField("newPassword", "Nouveau mot de passe", "new-password", true)}
              <div class="password-strength" aria-live="polite"><span id="passwordStrengthBar"></span></div>
              <p class="password-guidance" id="passwordStrengthText">Utilisez une phrase longue avec des lettres, des chiffres et un symbole.</p>
              ${passwordField("newPasswordConfirmation", "Confirmer le nouveau mot de passe", "new-password", true)}
              <p class="form-error" id="passwordChangeError" role="alert" hidden></p>
              <div class="row form-actions"><button class="btn" type="button" onclick="closeEditor()">Annuler</button><button class="btn primary" type="submit">Mettre à jour le mot de passe</button></div>
            </form>
          </div>`;
        bindPasswordForm(document.querySelector("#passwordChangeForm"));
        document.querySelector("#passwordChangeForm").addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const newPassword = String(form.get("newPassword") || "");
          const errorBox = document.querySelector("#passwordChangeError");
          if (newPassword !== String(form.get("newPasswordConfirmation") || "")) {
            showPasswordError(errorBox, "Les deux nouveaux mots de passe ne correspondent pas.");
            return;
          }
          const finishSaveLock = beginSaveLock(event.submitter);
          try {
            await window.ServerAPI.changePassword(String(form.get("currentPassword") || ""), newPassword);
            authenticatedUser.must_change_password = false;
            closeEditor();
            render();
            toast("Mot de passe mis à jour.");
          } catch (error) {
            showPasswordError(errorBox, error.message || "Le mot de passe n'a pas pu être modifié.");
          } finally {
            finishSaveLock();
          }
        });
      }

      function passwordField(name, label, autocomplete, requiresMinimum) {
        return `<label class="label password-field"><span>${label}</span><span class="password-input"><input name="${name}" type="password" autocomplete="${autocomplete}" ${requiresMinimum ? 'minlength="10"' : ""} required><button type="button" class="password-toggle" aria-label="Afficher ${label.toLowerCase()}">Afficher</button></span></label>`;
      }

      function showPasswordError(target, message) {
        target.textContent = message;
        target.hidden = false;
      }

      function passwordScore(value) {
        return [value.length >= 10, value.length >= 14, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^\w\s]/.test(value)].filter(Boolean).length;
      }

      function bindPasswordForm(form) {
        form.querySelectorAll(".password-toggle").forEach((button) => button.addEventListener("click", () => {
          const input = button.previousElementSibling;
          const visible = input.type === "text";
          input.type = visible ? "password" : "text";
          button.textContent = visible ? "Afficher" : "Masquer";
        }));
        const password = form.elements.newPassword;
        if (!password) return;
        password.addEventListener("input", () => {
          const score = passwordScore(password.value);
          const labels = ["Trop court", "Faible", "Correct", "Bon", "Très bon", "Excellent"];
          const bar = form.querySelector("#passwordStrengthBar");
          const guidance = form.querySelector("#passwordStrengthText");
          if (bar) { bar.style.width = `${score * 20}%`; bar.dataset.score = String(score); }
          if (guidance) guidance.textContent = password.value ? `${labels[score]} — 10 caractères minimum, avec plusieurs types de caractères.` : "Utilisez une phrase longue avec des lettres, des chiffres et un symbole.";
          form.querySelector(".form-error")?.setAttribute("hidden", "");
        });
      }

      async function loadAdminUsers() {
        if (authenticatedUser?.role !== "admin" || adminUsersLoading) return;
        adminUsersLoading = true;
        try {
          adminUsers = await window.ServerAPI.adminUsers();
          adminUsersLoaded = true;
          adminUsersError = "";
        } catch (error) {
          console.error("Impossible de charger les comptes", error);
          adminUsersLoaded = true;
          adminUsersError = error.message || "erreur serveur";
          toast("Impossible de charger la liste des comptes.");
        } finally {
          adminUsersLoading = false;
          if (currentView === "settings") renderSettings();
        }
      }

      async function resetAccountPassword(userId, triggerButton) {
        const username = adminUsers.find((user) => user.id === userId)?.username || "ce compte";
        const newPassword = prompt(`Nouveau mot de passe pour ${username} (10 caractères minimum) :`);
        if (newPassword === null) return;
        if (newPassword.length < 10) {
          toast("Le nouveau mot de passe doit contenir au moins 10 caractères.");
          return;
        }
        if (!confirm(`Remplacer maintenant le mot de passe de ${username} ?`)) return;
        const finishSaveLock = beginSaveLock(triggerButton);
        try {
          await window.ServerAPI.adminResetPassword(userId, newPassword);
          adminUsersLoaded = false;
          toast(`Nouveau mot de passe défini pour ${username}.`);
          await loadAdminUsers();
        } catch (error) {
          toast(`Réinitialisation impossible : ${error.message || "erreur serveur"}.`);
        } finally {
          finishSaveLock();
        }
      }

      async function createAdminAccount(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const password = String(data.get("temporaryPassword") || "");
        const confirmation = String(data.get("passwordConfirmation") || "");
        const errorBox = form.querySelector(".form-error");
        if (password.length < 10) return showPasswordError(errorBox, "Le mot de passe doit contenir au moins 10 caractères.");
        if (password !== confirmation) return showPasswordError(errorBox, "Les deux mots de passe ne correspondent pas.");
        const finishSaveLock = beginSaveLock(event.submitter);
        try {
          const created = await window.ServerAPI.adminCreateUser({
            username: String(data.get("username") || "").trim(),
            display_name: String(data.get("displayName") || "").trim() || null,
            email: String(data.get("email") || "").trim() || null,
            temporary_password: password
          });
          form.reset();
          adminUsersLoaded = false;
          toast(`Compte ${created.username} créé.`);
          await loadAdminUsers();
        } catch (error) {
          showPasswordError(errorBox, error.message || "Création du compte impossible.");
        } finally {
          finishSaveLock();
        }
      }

      function retryAdminUsers() {
        adminUsersLoaded = false;
        adminUsersError = "";
        renderSettings();
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

      function cloneActivityForLesson(source, lessonId) {
        const activity = structuredClone(source);
        activity.id = uid("act");
        activity.lessonId = lessonId;
        activity.updatedAt = new Date().toISOString();
        activity.resources = (activity.resources || []).map((resource) => ({ ...resource, id: uid("res"), activityId: activity.id, updatedAt: activity.updatedAt }));
        activity.slides = (activity.slides || []).map((slide) => ({
          ...slide,
          id: uid("slide"),
          elements: (slide.elements || []).map((element) => ({ ...element, id: uid("el") }))
        }));
        return activity;
      }

      function cloneLessonForSequence(source, sequenceId) {
        const lesson = structuredClone(source);
        lesson.id = uid("lesson");
        lesson.sequenceId = sequenceId;
        lesson.updatedAt = new Date().toISOString();
        lesson.activities = (source.activities || []).map((activity) => cloneActivityForLesson(activity, lesson.id));
        return lesson;
      }

      function cloneSequenceForClass(source, classId) {
        const sequence = structuredClone(source);
        sequence.id = uid("seq");
        sequence.classId = classId;
        sequence.updatedAt = new Date().toISOString();
        sequence.lessons = (source.lessons || []).map((lesson) => cloneLessonForSequence(lesson, sequence.id));
        return sequence;
      }

      function openCopySequence(sequenceId) {
        if (!requireLogin()) return;
        const source = findItem("sequence", sequenceId);
        const sourceContext = state.classes.find((classe) => (classe.sequences || []).some((sequence) => sequence.id === sequenceId));
        const destinations = state.classes.filter((classe) => classe.id !== sourceContext?.id);
        if (!source || !destinations.length) return toast("Ajoutez une autre classe avant de copier cette séquence.");
        openCopyCourseDialog("sequence", source, destinations.map((classe) => ({ id: classe.id, label: classe.title })));
      }

      function openCopyLesson(lessonId) {
        if (!requireLogin()) return;
        const source = findItem("lesson", lessonId);
        const sourceClass = state.classes.find((classe) => (classe.sequences || []).some((sequence) => (sequence.lessons || []).some((lesson) => lesson.id === lessonId)));
        const destinations = state.classes.filter((classe) => classe.id !== sourceClass?.id).flatMap((classe) => (classe.sequences || []).map((sequence) => ({ id: sequence.id, label: `${classe.title} — ${sequence.title}` })));
        if (!source || !destinations.length) return toast("Ajoutez une séquence dans une autre classe avant de copier cette séance.");
        openCopyCourseDialog("lesson", source, destinations);
      }

      function openCopyCourseDialog(type, source, destinations) {
        const modal = document.querySelector("#editorModal");
        const label = type === "sequence" ? "séquence" : "séance";
        modal.hidden = false;
        modal.innerHTML = `<section class="editor-card copy-course-dialog">
          <header class="subtree-head"><div><p>Copier une ${label}</p><h2>${escapeHtml(source.title)}</h2></div><button class="btn icon" type="button" onclick="closeEditor()">X</button></header>
          <form class="copy-course-form" onsubmit="copyCourseItem(event,'${type}','${source.id}')">
            <label class="label">Destination<select name="destinationId" required>${destinations.map((destination) => `<option value="${escapeAttr(destination.id)}">${escapeHtml(destination.label)}</option>`).join("")}</select></label>
            <p class="muted small">La copie sera indépendante : ses activités, diapositives et ressources pourront être modifiées sans changer l’original.</p>
            <div class="row"><button class="btn primary" type="submit">Copier dans cette classe</button><button class="btn" type="button" onclick="closeEditor()">Annuler</button></div>
          </form>
        </section>`;
      }

      async function copyCourseItem(event, type, sourceId) {
        event.preventDefault();
        const destinationId = new FormData(event.currentTarget).get("destinationId");
        const source = findItem(type, sourceId);
        const destination = findItem(type === "sequence" ? "class" : "sequence", destinationId);
        if (!source || !destination) return toast("La destination n’existe plus.");
        if (type === "sequence") {
          const copy = cloneSequenceForClass(source, destination.id);
          copy.order = (destination.sequences || []).length + 1;
          destination.sequences.push(copy);
        } else {
          const copy = cloneLessonForSequence(source, destination.id);
          copy.order = (destination.lessons || []).length + 1;
          destination.lessons.push(copy);
        }
        const saved = await saveData(`${type === "sequence" ? "Séquence" : "Séance"} copiée dans la classe choisie.`, event.submitter);
        if (saved) { closeEditor(); render(); }
      }

      function activityLocationBreadcrumb({ classe, sequence, lesson }, variant = "") {
        if (!classe || !sequence || !lesson) return "";
        return `<nav class="activity-location ${escapeAttr(variant)}" aria-label="Emplacement de la présentation">
          <span><small>Classe</small><strong>${escapeHtml(classe.title)}</strong></span>
          <b aria-hidden="true">›</b>
          <span><small>Séquence ${sequenceNumber(classe, sequence)}</small><strong>${escapeHtml(sequence.title)}</strong></span>
          <b aria-hidden="true">›</b>
          <span><small>Séance</small><strong>${escapeHtml(lesson.title)}</strong></span>
        </nav>`;
      }

      function escapeHtml(value) {
        return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
      }

      function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, "&#096;");
      }

      function kindFromUrl(url) {
        if (youtubeId(url)) return "youtube";
        if (/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?|#|$)/i.test(url)) return "image";
        if (/\.(mp3|wav|ogg|oga|m4a|aac|flac|opus)(\?|#|$)/i.test(url)) return "audio";
        if (/\.(mp4|webm|mov|m4v|ogv|avi|mkv)(\?|#|$)/i.test(url)) return "video";
        if (/\.pdf(\?|#|$)/i.test(url)) return "pdf";
        if (/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|csv|json|xml|html?|zip)(\?|#|$)/i.test(url)) return "document";
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
        const embedUrl = `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`;
        return `<div class="youtube-card youtube-player"><iframe src="${escapeAttr(embedUrl)}" title="Lecteur vidéo YouTube" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
      }

      function toEmbedUrl(url) {
        const value = String(url || "");
        const youtube = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
        return escapeAttr(value);
      }

      function isStoredDocumentUrl(url) {
        return /^\/api\/v1\/files\/[^/]+\/content(?:\?|#|$)/i.test(String(url || ""));
      }

      const recoveredExportFiles = {
        "6eaac43f-3a48-482c-9152-1a18408e63c4": "assets/free-example/007-arole-italiane.pptx",
        "7142e77b-9600-4ccb-a24f-372998b826f3": "assets/free-example/017-ancais-italien.docx",
        "e15eab29-d8b6-4ebd-bd42-ab66cc08d02f": "assets/free-example/017-ancais-italien.docx",
        "6574efd1-b6d4-4070-84a2-9b11cca9bf73": "assets/free-example/001-nda-ninna-nann.mp4",
        "f445283c-1437-4f2d-916e-c99acb0797a9": "assets/free-example/020-ichier-importe.docx"
      };

      function recoverKnownExportFileUrls() {
        let changed = false;
        const recover = (value) => {
          if (value === "assets/free-example/019-banger6-1.mp4") {
            return "assets/free-example/001-nda-ninna-nann.mp4";
          }
          const match = /^\/api\/v1\/files\/([^/]+)\/content(?:\?|#|$)/i.exec(String(value || ""));
          return match && recoveredExportFiles[match[1]] ? recoveredExportFiles[match[1]] : value;
        };
        const visit = (node) => {
          if (!node || typeof node !== "object") return;
          if (Array.isArray(node)) {
            node.forEach(visit);
            return;
          }
          ["value", "url"].forEach((key) => {
            if (typeof node[key] !== "string") return;
            const recovered = recover(node[key]);
            if (recovered !== node[key]) {
              node[key] = recovered;
              changed = true;
            }
          });
          Object.values(node).forEach(visit);
        };
        visit(state);
        return changed;
      }

      async function classifyStoredSlideElements() {
        let changed = recoverKnownExportFileUrls();
        if (!window.ServerAPI?.files) return changed;
        const storedFiles = [];
        for (let offset = 0; ; offset += 200) {
          const page = await window.ServerAPI.files(offset, 200);
          storedFiles.push(...page);
          if (page.length < 200) break;
        }
        const mimeByUrl = new Map(storedFiles.map((file) => [file.content_url, file.mime_type || ""]));
        for (const classe of state.classes) for (const sequence of classe.sequences || []) {
          for (const lesson of sequence.lessons || []) for (const activity of lesson.activities || []) {
            for (const slide of activity.slides || []) for (const element of slide.elements || []) {
              if (element.kind !== "embed" || !mimeByUrl.has(element.value)) continue;
              const mimeType = mimeByUrl.get(element.value);
              element.kind = mimeType.startsWith("image/") ? "image"
                : mimeType.startsWith("audio/") ? "audio"
                : mimeType.startsWith("video/") ? "video"
                : mimeType === "application/pdf" ? "pdf"
                : "document";
              changed = true;
            }
          }
        }
        return (await convertStoredPptxElements(storedFiles)) || changed;
      }

      async function convertStoredPptxElements(storedFiles) {
        const officeByUrl = new Map(storedFiles.map((file) => [file.content_url, file]));
        let changed = false;
        for (const classe of state.classes) for (const sequence of classe.sequences || []) {
          for (const lesson of sequence.lessons || []) for (const activity of lesson.activities || []) {
            const rebuiltSlides = [];
            for (const slide of activity.slides || []) {
              const officeElements = (slide.elements || []).filter((element) =>
                element.kind === "document" && element.value
              );
              if (!officeElements.length) {
                rebuiltSlides.push(slide);
                continue;
              }
              const otherElements = (slide.elements || []).filter((element) => !officeElements.includes(element));
              const retainedOfficeElements = [];
              const importedGroups = [];
              for (const officeElement of officeElements) {
                try {
                  const response = await fetch(officeElement.value, { credentials: "include" });
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  const metadata = officeByUrl.get(officeElement.value) || {};
                  const bytes = await response.arrayBuffer();
                  const originalName = metadata.original_name || metadata.filename || "document";
                  const detectedExtension = officeExtensionFromArrayBuffer(bytes);
                  if (detectedExtension !== "pptx") {
                    retainedOfficeElements.push(officeElement);
                    continue;
                  }
                  const fileName = /\.pptx$/i.test(originalName) ? originalName : `${originalName}.pptx`;
                  const file = new File([bytes], fileName, { type: metadata.mime_type || "" });
                  const importedSlides = await importPptxAsSiteSlides(file);
                  if (!importedSlides.length) throw new Error("aucune diapositive convertible");
                  importedGroups.push(importedSlides);
                } catch (error) {
                  console.warn("Conversion Office ignorée pour ce fichier", officeElement.value, error);
                  retainedOfficeElements.push(officeElement);
                }
              }
              if (!importedGroups.length) {
                rebuiltSlides.push(slide);
                continue;
              }
              const retainedElements = [...otherElements, ...retainedOfficeElements];
              if (retainedElements.length) rebuiltSlides.push({ id: slide.id || uid("slide"), elements: retainedElements });
              importedGroups.forEach((group) => rebuiltSlides.push(...group));
              changed = true;
            }
            activity.slides = rebuiltSlides;
          }
        }
        return changed;
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
        const requestedTargetName = arguments[1] || "_blank";
        const targetName = requestedTargetName.startsWith("in-viaggio-") ? nextManagedTabName() : requestedTargetName;
        const target = window.open("", targetName);
        if (!target) {
          toast("Autorisez les fenêtres contextuelles pour ouvrir cette vue.");
          return;
        }
        let openedFresh = false;
        try {
          openedFresh = target.location.href === "about:blank";
          target.document.documentElement.style.visibility = "hidden";
        } catch {
          // Un onglet nommé peut avoir navigué hors du site : il reste réutilisable.
        }
        Promise.resolve(pendingWorkspaceSave).then((saved) => {
          if (saved || !isLoggedIn()) {
            target.location.replace(url);
            target.focus();
            return;
          }
          if (openedFresh) target.close();
          else {
            try { target.document.documentElement.style.visibility = ""; } catch {}
          }
          toast("La vue n'a pas été ouverte car l'enregistrement serveur a échoué.");
        });
      }

      function nextManagedTabName() {
        const key = "mep-managed-tab-slot-v1";
        const nextSlot = Number(localStorage.getItem(key) || 0) % 3;
        localStorage.setItem(key, String((nextSlot + 1) % 3));
        return `in-viaggio-slot-${nextSlot + 1}`;
      }

      function openViewInNewTab(view) {
        if (freeExampleOpen) {
          setView(view);
          return;
        }
        openUrlInNewTabAfterSave(appUrl({ view }), `in-viaggio-view-${slugify(view)}`);
      }

      function openBoardInNewTab(activityId, slideIndex = 0) {
        if (freeExampleOpen) {
          showBoard(activityId, slideIndex);
          return;
        }
        openUrlInNewTabAfterSave(appUrl({ board: activityId, slide: slideIndex }), `in-viaggio-board-${slugify(activityId)}`);
      }

      function applyInitialRoute() {
        const params = new URLSearchParams(window.location.search);
        const view = params.get("view");
        if (view && ["dashboard", "classes", "tree", "studentClasses", "tools", "schedule", "search", "tutorial", "settings"].includes(view)) {
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
          dashboard: ["Cours par niveau à projeter", "Naviguer jusqu'à l’activité à afficher."],
          classes: ["Cours par niveau modifiable", "Classe > Séquence > Séance > Activités."],
          tree: ["Arbre", "Vue complète des classes et de toutes leurs branches."],
          studentClasses: ["Groupes Classes", "Groupes réels et listes d'élèves."],
          tools: ["Roue de la fortune et chrono", "Tirages et minuteur de classe."],
          schedule: ["Emploi du temps", "Retrouver le cours prévu selon votre agenda."],
          search: ["Recherche ressource ou activité", "Retrouver rapidement une activité ou une ressource."],
          tutorial: ["Tutoriel", "Découvrir toutes les fonctions du site à son rythme."],
          settings: ["Réglages", "Configuration locale du site HTML."]
        };
        const selectedNavButton = document.querySelector(`.nav-button[data-view="${currentView}"]`);
        document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
          button.classList.toggle("active", button.dataset.view === currentView);
        });
        document.title = `${selectedNavButton?.textContent.trim() || titles[currentView][0]} · MON ESPACE PROF`;
        document.querySelector("#pageTitle").textContent = titles[currentView][0];
        document.querySelector("#pageSubtitle").textContent = titles[currentView][1];
        document.querySelector("#openBoardBtn").hidden = currentView === "dashboard";
        document.querySelector("#logoutBtn").hidden = !isLoggedIn();
        document.querySelector("#loginNavBtn").hidden = isLoggedIn();
        document.querySelector("#loginNavBtn").textContent = freeExampleOpen ? "Quitter la démo" : "Connexion";
        document.querySelector("#exampleAd").hidden = !freeExampleOpen || isLoggedIn();
        document.querySelector(".sidebar-mail").hidden = freeExampleOpen && !isLoggedIn();
        if (currentView === "dashboard") renderDashboard();
        if (currentView === "classes") renderClasses();
        if (currentView === "tree") renderTree();
        if (currentView === "studentClasses") renderStudentClasses();
        if (currentView === "tools") renderTools();
        if (currentView === "schedule") renderSchedule();
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
            <div class="breadcrumb">Cours par niveau à projeter / Classes</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">Choisir une classe</h2>
            <p class="muted">Cette vue sert uniquement à trouver et afficher une activité.</p>
          </section>
          <nav class="dashboard-shortcuts" aria-label="Accès rapides">
            ${workspaceShortcuts.map((shortcut) => `<a class="shortcut-card" data-shortcut-title="${escapeAttr(shortcut.title)}" href="${escapeAttr(shortcut.url)}" target="_blank" rel="noopener noreferrer"><span>Accès rapide</span><strong>${escapeHtml(shortcut.title)}</strong><small>${escapeHtml(shortcut.description)}</small></a>`).join("")}
            ${renderUpcomingCoursesShortcut()}
          </nav>
          <section class="page-grid">${state.classes.filter((classe) => classe.isVisible !== false).map(tableauClassCard).join("")}</section>
        `;
      }

      function metric(label, value) {
        return `<div class="card"><p class="muted">${label}</p><h2 style="font-size:42px">${value}</h2></div>`;
      }

      function sequenceNumber(classe, sequence) {
        const index = (classe?.sequences || []).findIndex((item) => item.id === sequence?.id);
        return index >= 0 ? index + 1 : Math.max(1, Number(sequence?.order) || 1);
      }

      function classCard(classe) {
        return `<article class="card entity-card class-grid-card">
          <div class="class-grid-card-body">
            <div><h3>${escapeHtml(classe.title)}</h3><p class="muted small">${classe.sequences.length} séquence(s)</p></div>
            ${classe.isVisible ? "" : "<span class='pill'>Masque</span>"}
          </div>
          <div class="class-grid-card-actions">
            <button class="btn" onclick="openEditableSubtree('${classe.id}')">Arbre</button>
            ${editOnly(moveButtons("class", classe.id))}
            <button class="btn primary" onclick="openClassPage('${classe.id}')">Ouvrir</button>
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
          <div class="row wrap">
            <button class="btn" onclick="openTableauSubtree('class','${classe.id}')">Arbre</button>
            <button class="btn primary" onclick="openTableauClass('${classe.id}')">Ouvrir</button>
          </div>
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
            <div class="breadcrumb"><button onclick="currentTableauPage={type:'classes'};render()">Cours par niveau à projeter</button> / ${escapeHtml(classe.title)}</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(classe.title)}</h2>
            <p class="muted">Choisir une séquence.</p>
          </section>
          <section class="list-table">${classe.sequences.filter((sequence) => sequence.isVisible !== false).map((sequence) => tableauSequenceCard(classe, sequence)).join("") || empty("Aucune séquence visible.")}</section>
        `;
      }

      function tableauSequenceCard(classe, sequence) {
        return `<article class="card entity-card">
          <div>
            <p class="small" style="font-weight:850;color:var(--wine-700)">Séquence n° ${sequenceNumber(classe, sequence)}</p>
            <h3 style="font-size:24px">${escapeHtml(sequence.title)}</h3>
            <p class="muted small">${sequence.lessons.length} séance(s)</p>
          </div>
          <div class="row wrap">
            ${sequenceHookDocumentControl(sequence)}
            <button class="btn" onclick="openTableauSubtree('sequence','${classe.id}','${sequence.id}')">Arbre</button>
            <button class="btn primary" onclick="openTableauSequence('${classe.id}','${sequence.id}')">Ouvrir</button>
          </div>
        </article>`;
      }

      function openManagedLink(url, event) {
        event?.preventDefault();
        event?.stopPropagation();
        openUrlInNewTabAfterSave(url, "in-viaggio-link");
        return false;
      }

      function sequenceHookDocumentControl(sequence) {
        const document = sequence?.hookDocument;
        const addVideoButton = canEdit() ? `<button type="button" class="btn sequence-hook-video" onclick="setSequenceHookVideoLink('${escapeAttr(sequence.id)}')">${document?.kind === "video-link" ? "Modifier la vidéo" : "+ Lien vidéo"}</button>` : "";
        if (document?.url) {
          return `<span class="sequence-hook-control">
            <a class="btn sequence-hook-document" href="${escapeAttr(document.url)}" target="_blank" rel="noopener noreferrer" onclick="return openManagedLink(this.href,event)" title="Ouvrir ${escapeAttr(document.name || "le document d’accroche")}">${document.kind === "video-link" ? "▶ Vidéo d’accroche" : "📎 Document d’accroche"}</a>
            ${canEdit() ? `<label class="sequence-hook-replace" title="Remplacer le document d’accroche" aria-label="Remplacer le document d’accroche">↻<input type="file" hidden onchange="setSequenceHookDocument('${escapeAttr(sequence.id)}',this.files[0],this);this.value=''" /></label>` : ""}
            ${addVideoButton}
          </span>`;
        }
        if (!canEdit()) return `<span class="btn sequence-hook-document empty" aria-disabled="true">📎 Document d’accroche</span>`;
        return `<span class="sequence-hook-control"><label class="btn sequence-hook-document empty">＋ Document d’accroche<input type="file" hidden onchange="setSequenceHookDocument('${escapeAttr(sequence.id)}',this.files[0],this);this.value=''" /></label>${addVideoButton}</span>`;
      }

      async function setSequenceHookVideoLink(sequenceId) {
        if (!requireLogin()) return;
        const sequence = findItem("sequence", sequenceId);
        if (!sequence) return;
        const value = prompt("Lien de la vidéo d’accroche (YouTube, Vimeo ou autre URL)", sequence.hookDocument?.kind === "video-link" ? sequence.hookDocument.url : "");
        if (value === null) return;
        let url;
        try { url = new URL(value.trim()); } catch (_) { return toast("Le lien vidéo n’est pas une URL valide."); }
        if (!/^https?:$/.test(url.protocol)) return toast("Le lien vidéo doit commencer par http:// ou https://.");
        sequence.hookDocument = { name: "Vidéo d’accroche", url: url.href, mimeType: "text/uri-list", kind: "video-link" };
        sequence.updatedAt = new Date().toISOString();
        if (await saveData("Lien vidéo d’accroche enregistré.")) render();
      }

      async function setSequenceHookDocument(sequenceId, file, control) {
        if (!file || !requireLogin()) return;
        const sequence = findItem("sequence", sequenceId);
        if (!sequence) return;
        const finishUploadLock = beginSaveLock(control);
        try {
          const uploaded = isLocalFileMode() || freeExampleOpen
            ? { mime_type: file.type || "", content_url: await readFileAsDataUrl(file) }
            : await window.ServerAPI.upload(file);
          sequence.hookDocument = {
            name: file.name || "Document d’accroche",
            url: uploaded.content_url,
            mimeType: uploaded.mime_type || file.type || ""
          };
          sequence.updatedAt = new Date().toISOString();
          if (await saveData("Document d’accroche enregistré.")) render();
        } catch (error) {
          toast(`Ajout du document impossible : ${error.message || "erreur serveur"}.`);
        } finally {
          finishUploadLock();
        }
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
            <div class="breadcrumb"><button onclick="currentTableauPage={type:'classes'};render()">Cours par niveau à projeter</button> / <button onclick="openTableauClass('${classe.id}')">${escapeHtml(classe.title)}</button> / ${escapeHtml(sequence.title)}</div>
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
          <div class="row wrap">
            <button class="btn" onclick="openTableauSubtree('lesson','${classe.id}','${sequence.id}','${lesson.id}')">Arbre</button>
            <button class="btn primary" onclick="openTableauLesson('${classe.id}','${sequence.id}','${lesson.id}')">Ouvrir</button>
          </div>
        </article>`;
      }

      function openTableauSubtree(type, classId, sequenceId = "", lessonId = "") {
        const classe = findItem("class", classId);
        const sequence = sequenceId ? findItem("sequence", sequenceId) : null;
        const lesson = lessonId ? findItem("lesson", lessonId) : null;
        let branch = "";
        let title = "Arbre";
        if (type === "class" && classe) {
          branch = projectTreeClassNode(classe);
          title = classe.title;
        }
        if (type === "sequence" && classe && sequence) {
          branch = projectTreeSequenceNode(classe, sequence);
          title = sequence.title;
        }
        if (type === "lesson" && classe && sequence && lesson) {
          branch = projectTreeLessonNode(classe, sequence, lesson);
          title = lesson.title;
        }
        if (!branch) return;
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `<section class="subtree-dialog">
          <header class="subtree-head">
            <div><p class="small">Arbre à partir de l'élément</p><h2>${escapeHtml(title)}</h2></div>
            <button class="btn icon" onclick="closeEditor()">X</button>
          </header>
          <div class="subtree-body course-tree-scroll" aria-label="Branche de ${escapeAttr(title)}">
            <div class="course-tree subtree-course-tree"><ul class="tree-level tree-classes">${branch}</ul></div>
          </div>
        </section>`;
      }

      function projectTreeClassNode(classe) {
        return `<li>
          <button class="tree-node tree-class" onclick="closeEditor();openTableauClass('${classe.id}')"><span>Classe</span><strong>${escapeHtml(classe.title)}</strong></button>
          ${treeChildren((classe.sequences || []).filter((sequence) => sequence.isVisible !== false).map((sequence) => projectTreeSequenceNode(classe, sequence)))}
        </li>`;
      }

      function projectTreeSequenceNode(classe, sequence) {
        return `<li>
          <div class="tree-node-stack"><button class="tree-node tree-sequence" onclick="closeEditor();openTableauSequence('${classe.id}','${sequence.id}')"><span>Séquence n° ${sequenceNumber(classe, sequence)}</span><strong>${escapeHtml(sequence.title)}</strong></button><button class="tree-node-action" onclick="openSequenceWordPreview('${sequence.id}')">Aperçu / exporter Word</button></div>
          ${treeChildren((sequence.lessons || []).filter((lesson) => lesson.isVisible !== false).map((lesson) => projectTreeLessonNode(classe, sequence, lesson)))}
        </li>`;
      }

      function projectTreeLessonNode(classe, sequence, lesson) {
        return `<li>
          <div class="tree-node-stack">
            <button class="tree-node tree-lesson" onclick="closeEditor();openTableauLesson('${classe.id}','${sequence.id}','${lesson.id}')"><span>Séance</span><strong>${escapeHtml(lesson.title)}</strong></button>
            <button class="tree-node-action" onclick="openLessonPrintPreview('${lesson.id}')">Aperçu / exporter Word</button>
          </div>
          ${treeChildren((lesson.activities || []).filter((activity) => activity.isVisible !== false).map(projectTreeActivityNode))}
        </li>`;
      }

      function projectTreeActivityNode(activity) {
        return `<li>
          <button class="tree-node tree-activity" onclick="closeEditor();openBoardInNewTab('${activity.id}',0)"><span>Activités</span><strong>${escapeHtml(activity.title)}</strong></button>
          ${treeChildren((activity.resources || []).filter((resource) => resource.isVisible !== false).map(projectTreeResourceNode))}
        </li>`;
      }

      function projectTreeResourceNode(resource) {
        return `<li><div class="tree-node tree-resource"><span>Ressource</span><strong>${escapeHtml(resource.title)}</strong></div></li>`;
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
            <div class="breadcrumb"><button onclick="currentTableauPage={type:'classes'};render()">Cours par niveau à projeter</button> / <button onclick="openTableauClass('${classe.id}')">${escapeHtml(classe.title)}</button> / <button onclick="openTableauSequence('${classe.id}','${sequence.id}')">${escapeHtml(sequence.title)}</button> / ${escapeHtml(lesson.title)}</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(lesson.title)}</h2>
            <p class="muted">Choisir l’activité à afficher.</p>
            ${lessonSuitcase(lesson)}
          </section>
          <section class="numbered-list">${lesson.activities.filter((activity) => activity.isVisible !== false).map(tableauActivityCard).join("") || empty("Aucune activité visible.")}</section>
        `;
      }

      function tableauActivityCard(activity) {
        return `<article class="card entity-card">
          <div>
            <p class="small" style="font-weight:850;color:var(--wine-700)">Activités</p>
            <h3 style="font-size:24px">${escapeHtml(activity.title)}</h3>
            <p class="muted small">${escapeHtml(activity.description || "Activité à projeter.")}</p>
          </div>
          <div class="row wrap">
            <button class="btn" onclick="openActivityPrintPreview('${activity.id}')">Aperçu / imprimer</button>
            <button class="btn primary" onclick="openBoardInNewTab('${activity.id}',0)">Présenter</button>
          </div>
        </article>`;
      }

      function dashboardActivityCard(activity) {
        return `<article class="card activity-card">
          <div class="activity-card-body">
            <div>
              <p class="small" style="font-weight:850;color:var(--wine-700)">${escapeHtml(activity.level || activity.classTitle || "Activité")}</p>
              <h3>${escapeHtml(activity.title)}</h3>
              <p class="muted small">${escapeHtml(activity.objective || activity.description || "Activité")}</p>
            </div>
            <div class="activity-actions">
              <button class="btn primary" onclick="openBoardInNewTab('${activity.id}',0)">Présenter</button>
              <button class="btn" onclick="openActivityPrintPreview('${activity.id}')">Aperçu / imprimer</button>
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
              <div class="row wrap">
                <button class="btn" onclick="setView('tree')">Arbre</button>
                ${editOnly(`<button class="btn" onclick="manageCategories()">Organiser les catégories</button><button class="btn primary" onclick="openEditor('class')">Ajouter une classe</button>`)}
              </div>
            </div>
          </section>
          <section>${state.categories.map((category) => `<div class="category-group"><h3 class="category-title" draggable="true" data-category="${escapeAttr(category)}">— ${escapeHtml(category)} —</h3><div class="page-grid">${state.classes.filter((classe) => classe.category === category).map(classCard).join("") || empty("Aucune classe dans cette catégorie.")}</div></div>`).join("")}${state.classes.some((classe) => !classe.category || !state.categories.includes(classe.category)) ? `<div class="category-group"><h3 class="category-title">— Sans catégorie —</h3><div class="page-grid">${state.classes.filter((classe) => !classe.category || !state.categories.includes(classe.category)).map(classCard).join("")}</div></div>` : ""}</section>
        `;
        document.querySelectorAll(".category-title").forEach((heading) => heading.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", heading.dataset.category)));
        document.querySelectorAll(".category-title").forEach((heading) => heading.addEventListener("dragover", (event) => event.preventDefault()));
        document.querySelectorAll(".category-title").forEach((heading) => heading.addEventListener("drop", (event) => reorderCategory(event, heading.dataset.category)));
      }

      function renderTree() {
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb">Arbre / Tous les cours</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">Arbre des cours</h2>
            <p class="muted">Classes → séquences → séances → activités → ressources. Cliquez sur un intitulé pour ouvrir l'élément.</p>
          </section>
          <section class="course-tree-scroll" aria-label="Arbre hiérarchique des cours">
            ${state.classes.length ? `<div class="course-tree">
              <div class="tree-node tree-heading"><span>Tout en haut</span><strong>Classes</strong></div>
              <ul class="tree-level tree-classes">${state.classes.map(treeClassNode).join("")}</ul>
            </div>` : empty("Aucune classe à afficher dans l'arbre.")}
          </section>
        `;
      }

      function treeClassNode(classe) {
        return `<li>
          <button class="tree-node tree-class" onclick="closeEditor();openClassPage('${classe.id}')">
            <span>Classe</span><strong>${escapeHtml(classe.title)}</strong>${classe.isVisible === false ? "<em>Masquée</em>" : ""}
          </button>
          ${treeChildren((classe.sequences || []).map((sequence) => treeSequenceNode(classe, sequence)))}
        </li>`;
      }

      function treeSequenceNode(classe, sequence) {
        return `<li>
          <div class="tree-node-stack"><button class="tree-node tree-sequence" onclick="closeEditor();openSequencePage('${classe.id}','${sequence.id}')">
            <span>Séquence n° ${sequenceNumber(classe, sequence)}</span><strong>${escapeHtml(sequence.title)}</strong>${sequence.isVisible === false ? "<em>Masquée</em>" : ""}
          </button><button class="tree-node-action" onclick="openSequenceWordPreview('${sequence.id}')">Aperçu / exporter Word</button></div>
          ${treeChildren((sequence.lessons || []).map((lesson) => treeLessonNode(classe, sequence, lesson)))}
        </li>`;
      }

      function treeLessonNode(classe, sequence, lesson) {
        return `<li>
          <div class="tree-node-stack">
            <button class="tree-node tree-lesson" onclick="closeEditor();openLessonPage('${classe.id}','${sequence.id}','${lesson.id}')">
              <span>Séance</span><strong>${escapeHtml(lesson.title)}</strong>${lesson.isVisible === false ? "<em>Masquée</em>" : ""}
            </button>
            <button class="tree-node-action" onclick="openLessonPrintPreview('${lesson.id}')">Aperçu / exporter Word</button>
          </div>
          ${treeChildren((lesson.activities || []).map(treeActivityNode))}
        </li>`;
      }

      function treeActivityNode(activity) {
        return `<li>
          <button class="tree-node tree-activity" onclick="openActivityStudio('${activity.id}')">
            <span>Activités</span><strong>${escapeHtml(activity.title)}</strong>${activity.isVisible === false ? "<em>Masquée</em>" : ""}
          </button>
          ${treeChildren((activity.resources || []).map(treeResourceNode))}
        </li>`;
      }

      function treeResourceNode(resource) {
        return `<li><button class="tree-node tree-resource" onclick="openEditor('resource','${resource.id}')"><span>Ressource</span><strong>${escapeHtml(resource.title)}</strong></button></li>`;
      }

      function treeChildren(children) {
        return children.length ? `<ul class="tree-level">${children.join("")}</ul>` : "";
      }

      function lessonSuitcase(lesson) {
        const entries = [["Culture",lesson.cultural],["Lexique",lesson.lexicon],["Conjugaison",lesson.conjugation],["Grammaire",lesson.grammar],["Je sais…",lesson.lifeSkills]].filter(([,value]) => String(value || "").trim());
        return `<aside class="lesson-suitcase" aria-label="Valise pédagogique de ${escapeAttr(lesson.title || "la séance")}"><strong>🧳 Ma valise</strong><div>${entries.map(([label,value]) => `<span><b>${label}</b>${escapeHtml(value)}</span>`).join("") || "<em>À compléter dans la modification de la séance.</em>"}</div></aside>`;
      }

      function openEditableSubtree(classId, sequenceId = "") {
        const classe = findItem("class", classId);
        if (!classe) return;
        const sequence = sequenceId ? findItem("sequence", sequenceId) : null;
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `<section class="subtree-dialog">
          <header class="subtree-head">
            <div><p class="small">Arbre des cours modifiables</p><h2>${escapeHtml(sequence?.title || classe.title)}</h2></div>
            <button class="btn icon" onclick="closeEditor()">X</button>
          </header>
          <div class="subtree-body course-tree-scroll" aria-label="Cours modifiables de ${escapeAttr(classe.title)}">
            <div class="course-tree subtree-course-tree"><ul class="tree-level tree-classes">${sequence ? treeSequenceNode(classe, sequence) : treeClassNode(classe)}</ul></div>
          </div>
        </section>`;
      }

      function manageCategories() {
        if (currentPage.type !== "classes") return manageCurrentPageItems();
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        const categoryRows = state.categories.map((category, index) => ({ key: `category-${index}`, name: category }));
        modal.innerHTML = `<div class="drawer category-drawer">
          <div class="drawer-head category-drawer-head">
            <div>
              <p class="category-eyebrow">Organisation des cours</p>
              <h2>Ranger les niveaux par catégorie</h2>
              <p class="muted small">Suivez simplement les étapes 1 et 2, puis enregistrez.</p>
            </div>
            <button class="btn icon" type="button" onclick="closeEditor()" aria-label="Fermer sans enregistrer">X</button>
          </div>
          <div class="drawer-body category-manager">
            <section class="category-step">
              <div class="category-step-title"><span>1</span><div><h3>Créer et ordonner les catégories</h3><p>Exemples : Collège, Lycée. Utilisez les flèches pour choisir l'ordre d'affichage.</p></div></div>
              <div id="categoryEditorList" class="category-editor-list">${categoryRows.map(categoryEditorRow).join("")}</div>
              <div class="category-add-box">
                <label class="label">Nom de la nouvelle catégorie<input id="newCategoryName" class="input" placeholder="Exemple : Primaire"></label>
                <button class="btn" type="button" onclick="addCategoryEditorRow()">+ Ajouter cette catégorie</button>
              </div>
            </section>
            <section class="category-step">
              <div class="category-step-title"><span>2</span><div><h3>Choisir la catégorie et l'ordre de chaque niveau</h3><p>Rangez chaque niveau, puis utilisez Monter ou Descendre pour choisir sa place dans la catégorie.</p></div></div>
              <div id="categoryItems" class="category-class-groups">${categoryClassGroups(categoryRows)}</div>
            </section>
          </div>
          <div class="category-manager-footer">
            <button class="btn" type="button" onclick="closeEditor()">Annuler</button>
            <button class="btn primary" type="button" onclick="saveCategoriesFromDrawer(this)">Enregistrer les changements</button>
          </div>
        </div>`;
        document.querySelector("#newCategoryName")?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") { event.preventDefault(); addCategoryEditorRow(); }
        });
        updateCategoryMoveButtons();
        updateCategoryCounts();
        updateClassMoveButtons();
      }

      function currentPageOrganization() {
        if (currentPage.type === "class") {
          const classe = findItem("class", currentPage.classId);
          return classe && { title: `Organiser les séquences de ${classe.title}`, label: "Séquence", items: classe.sequences };
        }
        if (currentPage.type === "sequence") {
          const sequence = findItem("sequence", currentPage.sequenceId);
          return sequence && { title: `Organiser les séances de ${sequence.title}`, label: "Séance", items: sequence.lessons };
        }
        if (currentPage.type === "lesson") {
          const lesson = findItem("lesson", currentPage.lessonId);
          return lesson && { title: `Organiser les activités de ${lesson.title}`, label: "Activités", items: lesson.activities };
        }
        return null;
      }

      function manageCurrentPageItems() {
        const organization = currentPageOrganization();
        if (!organization) return;
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `<div class="drawer category-drawer contextual-organizer">
          <div class="drawer-head category-drawer-head">
            <div>
              <p class="category-eyebrow">Organisation des cours</p>
              <h2>${escapeHtml(organization.title)}</h2>
              <p class="muted small">Utilisez les deux flèches de chaque élément pour modifier son ordre.</p>
            </div>
            <button class="btn icon" type="button" onclick="closeEditor()" aria-label="Fermer sans enregistrer">X</button>
          </div>
          <div class="drawer-body category-manager">
            <section class="category-step">
              <div class="category-step-title"><span>1</span><div><h3>Choisir l'ordre</h3><p>Seuls les éléments du niveau actuellement ouvert sont affichés.</p></div></div>
              <div id="contextOrderList" class="context-order-list">
                ${organization.items.map((item, index) => contextOrderRow(item, index, organization.label)).join("") || empty(`Aucun élément à organiser.`)}
              </div>
            </section>
          </div>
          <div class="category-manager-footer">
            <button class="btn" type="button" onclick="closeEditor()">Annuler</button>
            <button class="btn primary" type="button" onclick="saveCurrentPageOrder(this)">Enregistrer les changements</button>
          </div>
        </div>`;
        updateContextOrderButtons();
      }

      function contextOrderRow(item, index, label) {
        return `<article class="context-order-row" data-context-item="${escapeAttr(item.id)}">
          <span class="category-class-number">${index + 1}</span>
          <div class="category-class-name"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(label)} à déplacer</small></div>
          <div class="item-move-buttons" aria-label="Déplacer ${escapeAttr(item.title)}">
            <button class="btn icon" type="button" data-context-move="up" onclick="moveContextOrderRow('${escapeAttr(item.id)}',-1)" aria-label="Monter">↑</button>
            <button class="btn icon" type="button" data-context-move="down" onclick="moveContextOrderRow('${escapeAttr(item.id)}',1)" aria-label="Descendre">↓</button>
          </div>
        </article>`;
      }

      function moveContextOrderRow(id, direction) {
        const row = [...document.querySelectorAll(".context-order-row")].find((item) => item.dataset.contextItem === id);
        if (!row) return;
        const target = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
        if (!target?.classList.contains("context-order-row")) return;
        if (direction < 0) row.parentElement.insertBefore(row, target);
        else row.parentElement.insertBefore(row, target.nextElementSibling);
        updateContextOrderButtons();
      }

      function updateContextOrderButtons() {
        const rows = [...document.querySelectorAll(".context-order-row")];
        rows.forEach((row, index) => {
          row.querySelector(".category-class-number").textContent = index + 1;
          row.querySelector('[data-context-move="up"]').disabled = index === 0;
          row.querySelector('[data-context-move="down"]').disabled = index === rows.length - 1;
        });
      }

      async function saveCurrentPageOrder(triggerButton) {
        const organization = currentPageOrganization();
        if (!organization) return closeEditor();
        const byId = new Map(organization.items.map((item) => [item.id, item]));
        organization.items.splice(0, organization.items.length, ...[...document.querySelectorAll(".context-order-row")]
          .map((row) => byId.get(row.dataset.contextItem)).filter(Boolean));
        organization.items.forEach((item, index) => { item.order = index + 1; });
        const saved = await saveData("Ordre mis à jour.", triggerButton);
        if (saved) closeEditor();
      }

      function categoryEditorRow(category) {
        return `<article class="category-editor-item" data-category-key="${escapeAttr(category.key)}">
          <div class="category-order-buttons">
            <button class="btn" type="button" data-move="up" onclick="moveCategoryEditorRow('${escapeAttr(category.key)}',-1)">↑ Monter</button>
            <button class="btn" type="button" data-move="down" onclick="moveCategoryEditorRow('${escapeAttr(category.key)}',1)">↓ Descendre</button>
          </div>
          <label class="label category-name-field">Nom de la catégorie<input class="input" value="${escapeAttr(category.name)}" oninput="refreshCategoryAssignmentOptions()"></label>
          <span class="pill category-count" data-category-count="${escapeAttr(category.key)}">0 niveau</span>
          <button class="btn danger" type="button" onclick="removeCategory('${escapeAttr(category.key)}')">Supprimer</button>
        </article>`;
      }

      function categoryClassGroups(categories, drafts) {
        const validKeys = new Set(categories.map((category) => category.key));
        const rows = drafts || state.classes.map((classe) => ({
          id: classe.id,
          categoryKey: categories.find((category) => category.name === classe.category)?.key || ""
        }));
        const groups = [...categories, { key: "", name: "Sans catégorie" }];
        return groups.map((group) => {
          const groupRows = rows.filter((row) => (validKeys.has(row.categoryKey) ? row.categoryKey : "") === group.key);
          return `<section class="category-class-group" data-class-group="${escapeAttr(group.key)}">
            <div class="category-class-group-head"><h4>${escapeHtml(group.name || "Sans catégorie")}</h4><span>${groupRows.length} niveau${groupRows.length > 1 ? "x" : ""}</span></div>
            <div class="category-class-list">${groupRows.map((row, index) => {
              const classe = state.classes.find((item) => item.id === row.id);
              return classe ? categoryClassRow(classe, index, categories, group.key) : "";
            }).join("") || `<p class="category-class-empty">Aucun niveau dans cette catégorie.</p>`}</div>
          </section>`;
        }).join("");
      }

      function categoryClassRow(classe, index, categories, selectedKey) {
        return `<article class="category-class-row" data-class-row="${escapeAttr(classe.id)}">
          <span class="category-class-number">${index + 1}</span>
          <div class="category-class-name"><strong>${escapeHtml(classe.title)}</strong><small>Niveau à ranger</small></div>
          <label class="label">Ranger dans
            <select data-class-category="${escapeAttr(classe.id)}" onchange="changeClassCategory(this)">
              <option value="">Sans catégorie</option>
              ${categories.map((category) => `<option value="${escapeAttr(category.key)}" ${selectedKey === category.key ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}
            </select>
          </label>
          <div class="category-class-order" aria-label="Changer la place de ${escapeAttr(classe.title)}">
            <span>Place dans la catégorie</span>
            <div>
              <button class="btn" type="button" data-class-move="up" onclick="moveCategoryClassRow('${escapeAttr(classe.id)}',-1)">↑ Monter</button>
              <button class="btn" type="button" data-class-move="down" onclick="moveCategoryClassRow('${escapeAttr(classe.id)}',1)">↓ Descendre</button>
            </div>
          </div>
        </article>`;
      }

      function categoryClassDraftRows() {
        return [...document.querySelectorAll(".category-class-row")].map((row) => ({
          id: row.dataset.classRow,
          categoryKey: row.querySelector("[data-class-category]")?.value || ""
        }));
      }

      function renderCategoryClassGroups(drafts = categoryClassDraftRows()) {
        const container = document.querySelector("#categoryItems");
        if (!container) return;
        container.innerHTML = state.classes.length ? categoryClassGroups(categoryDraftRows(), drafts) : empty("Aucun niveau à classer.");
        updateCategoryCounts();
        updateClassMoveButtons();
      }

      function changeClassCategory(select) {
        const classId = select.dataset.classCategory;
        const categoryKey = select.value;
        const drafts = categoryClassDraftRows();
        const moved = drafts.find((draft) => draft.id === classId);
        if (!moved) return renderCategoryClassGroups(drafts);
        const reordered = drafts.filter((draft) => draft.id !== classId);
        const lastPeerIndex = reordered.reduce((last, draft, index) => draft.categoryKey === categoryKey ? index : last, -1);
        reordered.splice(lastPeerIndex + 1, 0, moved);
        renderCategoryClassGroups(reordered);
      }

      function moveCategoryClassRow(classId, direction) {
        const row = [...document.querySelectorAll(".category-class-row")].find((item) => item.dataset.classRow === classId);
        if (!row) return;
        const target = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
        if (!target?.classList.contains("category-class-row")) return;
        if (direction < 0) row.parentElement.insertBefore(row, target);
        else row.parentElement.insertBefore(row, target.nextElementSibling);
        updateClassMoveButtons();
      }

      function updateClassMoveButtons() {
        document.querySelectorAll(".category-class-list").forEach((list) => {
          const rows = [...list.querySelectorAll(".category-class-row")];
          rows.forEach((row, index) => {
            const number = row.querySelector(".category-class-number");
            const up = row.querySelector('[data-class-move="up"]');
            const down = row.querySelector('[data-class-move="down"]');
            if (number) number.textContent = index + 1;
            if (up) up.disabled = index === 0;
            if (down) down.disabled = index === rows.length - 1;
          });
        });
      }

      function categoryDraftRows() {
        return [...document.querySelectorAll(".category-editor-item")].map((row) => ({
          key: row.dataset.categoryKey,
          name: row.querySelector(".category-name-field input")?.value.trim() || ""
        }));
      }

      function addCategoryEditorRow() {
        const input = document.querySelector("#newCategoryName");
        const name = input?.value.trim() || "";
        if (!name) {
          input?.focus();
          toast("Écrivez d'abord le nom de la catégorie.");
          return;
        }
        const duplicate = categoryDraftRows().some((category) => category.name.toLowerCase() === name.toLowerCase());
        if (duplicate) return toast("Cette catégorie existe déjà.");
        const category = { key: uid("category"), name };
        document.querySelector("#categoryEditorList")?.insertAdjacentHTML("beforeend", categoryEditorRow(category));
        input.value = "";
        updateCategoryMoveButtons();
        refreshCategoryAssignmentOptions();
        input.focus();
      }

      function moveCategoryEditorRow(key, direction) {
        const row = document.querySelector(`.category-editor-item[data-category-key="${key}"]`);
        if (!row) return;
        if (direction < 0 && row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
        if (direction > 0 && row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row);
        updateCategoryMoveButtons();
        refreshCategoryAssignmentOptions();
      }

      function updateCategoryMoveButtons() {
        const rows = [...document.querySelectorAll(".category-editor-item")];
        rows.forEach((row, index) => {
          const up = row.querySelector('[data-move="up"]');
          const down = row.querySelector('[data-move="down"]');
          if (up) up.disabled = index === 0;
          if (down) down.disabled = index === rows.length - 1;
        });
      }

      function removeCategory(key) {
        const row = document.querySelector(`.category-editor-item[data-category-key="${key}"]`);
        if (!row) return;
        const assigned = [...document.querySelectorAll("[data-class-category]")].filter((select) => select.value === key);
        const name = row.querySelector("input")?.value.trim() || "cette catégorie";
        if (assigned.length && !confirm(`Supprimer « ${name} » ? ${assigned.length} niveau(x) passeront dans « Sans catégorie ».`)) return;
        assigned.forEach((select) => { select.value = ""; });
        row.remove();
        updateCategoryMoveButtons();
        refreshCategoryAssignmentOptions();
      }

      function refreshCategoryAssignmentOptions() {
        const categories = categoryDraftRows();
        const validKeys = new Set(categories.map((category) => category.key));
        const drafts = categoryClassDraftRows().map((row) => ({ ...row, categoryKey: validKeys.has(row.categoryKey) ? row.categoryKey : "" }));
        renderCategoryClassGroups(drafts);
      }

      function updateCategoryCounts() {
        const counts = {};
        document.querySelectorAll("[data-class-category]").forEach((select) => { if (select.value) counts[select.value] = Number(counts[select.value] || 0) + 1; });
        document.querySelectorAll("[data-category-count]").forEach((badge) => {
          const count = Number(counts[badge.dataset.categoryCount] || 0);
          badge.textContent = `${count} niveau${count > 1 ? "x" : ""}`;
        });
      }

      async function saveCategoriesFromDrawer(triggerButton) {
        const categories = categoryDraftRows();
        if (categories.some((category) => !category.name)) return toast("Chaque catégorie doit avoir un nom.");
        const normalized = categories.map((category) => category.name.toLowerCase());
        if (new Set(normalized).size !== normalized.length) return toast("Deux catégories portent le même nom.");
        const namesByKey = Object.fromEntries(categories.map((category) => [category.key, category.name]));
        const classDrafts = categoryClassDraftRows();
        const classesById = new Map(state.classes.map((classe) => [classe.id, classe]));
        classDrafts.forEach((draft, index) => {
          const classe = classesById.get(draft.id);
          if (classe) {
            classe.category = namesByKey[draft.categoryKey] || "";
            classe.order = index + 1;
          }
        });
        const orderedIds = new Set(classDrafts.map((draft) => draft.id));
        state.classes = [...classDrafts.map((draft) => classesById.get(draft.id)).filter(Boolean), ...state.classes.filter((classe) => !orderedIds.has(classe.id))];
        state.categories = categories.map((category) => category.name);
        const saved = await saveData("Catégories mises à jour.", triggerButton);
        if (saved) closeEditor();
      }

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
            <button class="btn primary" onclick="openSeatingPlan('${classe.id}')">Plan de classe</button>
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
          ${renderTeacherToolLinks()}
        `;
        updateTimerDisplay();
      }

      function scheduleMinutes(value) { const [h,m]=String(value).split(":").map(Number); return h*60+m; }
      function scheduleTime(value) { return `${String(Math.floor(Number(value)/60)).padStart(2,"0")}:${String(Number(value)%60).padStart(2,"0")}`; }
      function upcomingScheduleItemsToday(){ const now=new Date(),days=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"],minute=now.getHours()*60+now.getMinutes(); return (state.schedule||[]).filter(item=>item.day===days[now.getDay()]&&Number(item.start)>=minute).sort((a,b)=>Number(a.start)-Number(b.start)).slice(0,3); }
      function renderUpcomingCoursesShortcut(){ const items=upcomingScheduleItemsToday(); return `<section class="shortcut-card upcoming-courses-card"><span>Accès rapide</span><strong>Les 3 prochains cours</strong><div class="upcoming-course-list">${items.map(item=>{const linked=findItem("class",item.classId);return `<button type="button" onclick="openUpcomingCourse('${item.id}')"><b>${scheduleTime(item.start)}</b><span>${escapeHtml(linked?.title||item.level||"Cours")}</span><small>${escapeHtml(item.groupTitle||"Sans groupe")}</small></button>`;}).join("")||`<small>Aucun autre cours prévu aujourd’hui.</small>`}</div></section>`; }
      function openUpcomingCourse(itemId){ const item=(state.schedule||[]).find(entry=>entry.id===itemId);if(!item)return;sessionStorage.setItem("mep-selected-schedule",item.id);if(item.classId)return openTableauClass(item.classId);setView("schedule"); }
      function currentScheduleItem() { const now=new Date(), days=["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"], day=days[now.getDay()], minute=now.getHours()*60+now.getMinutes(); return (state.schedule||[]).find(item=>item.day===day&&minute>=item.start&&minute<item.end)||(state.schedule||[]).find(item=>item.day===day); }
      function selectedScheduleItem() { const id=sessionStorage.getItem("mep-selected-schedule"); return (state.schedule||[]).find(item=>item.id===id)||null; }
      function renderTimetableGrid() {
        const days = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
        const startMinute = 8 * 60;
        const endMinute = 18 * 60;
        const slots = Array.from({ length: (endMinute - startMinute) / 30 }, (_, index) => startMinute + index * 30);
        const headers = `<div class="timetable-corner">Heures</div>${days.map(day => `<div class="timetable-day">${day}</div>`).join("")}`;
        const cells = slots.map((minute, row) => `${minute % 60 === 0 ? `<div class="timetable-hour" style="grid-row:${row + 2} / span 2">${scheduleTime(minute)}</div>` : ""}${days.map((day, column) => `<button class="timetable-cell ${minute % 60 ? "half-hour" : ""}" style="grid-column:${column + 2};grid-row:${row + 2}" aria-label="Ajouter un cours ${day} à ${scheduleTime(minute)}" onclick="openScheduleEditor('${day}',${minute})" ondragover="event.preventDefault();this.classList.add('drop-target')" ondragleave="this.classList.remove('drop-target')" ondrop="moveScheduleItem('${day}',${minute},event)"></button>`).join("")}`).join("");
        const courses = (state.schedule || []).map((item, index) => {
          const column = days.indexOf(String(item.day).toLowerCase()) + 2;
          const courseStart = Math.max(startMinute, Number(item.start));
          const courseEnd = Math.min(endMinute, Number(item.end));
          if (column < 2 || courseEnd <= courseStart) return "";
          const row = Math.floor((courseStart - startMinute) / 30) + 2;
          const span = Math.max(1, Math.ceil((courseEnd - courseStart) / 30));
          const selected=selectedScheduleItem()?.id===item.id;
          return `<article class="timetable-course ${selected?"selected":""}" draggable="${canEdit()?"true":"false"}" data-schedule-index="${index}" style="grid-column:${column};grid-row:${row} / span ${span}" title="Cliquer pour choisir le cours associé · Double-cliquer pour modifier" onclick="selectScheduleItem(${index},event)" ondblclick="openScheduleEditor('${escapeAttr(item.day)}',${Number(item.start)},${index},event)" ondragstart="startScheduleDrag(${index},event)"><strong>${scheduleTime(item.start)}–${scheduleTime(item.end)}</strong><span>${escapeHtml(item.level)} · ${escapeHtml(item.groupTitle)}</span><small>${escapeHtml(item.description)}</small></article>`;
        }).join("");
        return `<div class="timetable-scroll"><div class="timetable" aria-label="Emploi du temps du lundi au vendredi">${headers}${cells}${courses}</div></div>`;
      }

      function renderSchedule() { document.querySelector("#content").innerHTML=`<section class="calendar-only">${renderTimetableGrid()}</section>`; }
      function selectScheduleItem(index,event){ event?.stopPropagation(); const item=state.schedule[index]; if(!item)return; sessionStorage.setItem("mep-selected-schedule",item.id); document.querySelectorAll(".timetable-course").forEach(node=>node.classList.toggle("selected",Number(node.dataset.scheduleIndex)===index)); }
      function startScheduleDrag(index,event){ if(!canEdit()){event.preventDefault();return;} event.dataTransfer.effectAllowed="move"; event.dataTransfer.setData("application/x-schedule-item",String(index)); }
      async function moveScheduleItem(day,start,event){ event.preventDefault(); event.currentTarget.classList.remove("drop-target"); const index=Number(event.dataTransfer.getData("application/x-schedule-item")), item=state.schedule[index]; if(!item)return; const duration=Math.max(30,Number(item.end)-Number(item.start)); item.day=day; item.start=start; item.end=Math.min(1080,start+duration); if(await saveData("Cours déplacé dans l’emploi du temps."))renderSchedule(); }
      function openScheduleEditor(day,start,index=null,event=null){ event?.stopPropagation(); if(!requireLogin())return; const existing=Number.isInteger(index)?state.schedule[index]:null, end=Math.min(1080,Number(existing?.end||start+60)); const modal=document.querySelector("#editorModal"); modal.hidden=false; modal.innerHTML=`<section class="editor-card schedule-editor"><header class="subtree-head"><div><p>Emploi du temps</p><h2>${existing?"Modifier":"Ajouter"} un cours</h2><span class="muted">Seuls les horaires sont obligatoires.</span></div><button class="btn" type="button" onclick="closeEditor()">Fermer</button></header><form class="form-grid schedule-editor-form" onsubmit="saveScheduleEditor(event,${existing?index:"null"})"><label>Jour<select name="day">${["lundi","mardi","mercredi","jeudi","vendredi"].map(value=>`<option ${value===(existing?.day||day)?"selected":""}>${value}</option>`).join("")}</select></label><label>Début *<input name="start" type="time" min="08:00" max="18:00" step="1800" value="${scheduleTime(existing?.start??start)}" required></label><label>Fin *<input name="end" type="time" min="08:00" max="18:00" step="1800" value="${scheduleTime(end)}" required></label><label>Cours associé <span class="optional">facultatif</span><select name="classId"><option value="">Aucun cours associé</option>${state.classes.map(item=>`<option value="${item.id}" ${item.id===existing?.classId?"selected":""}>${escapeHtml(item.title)}</option>`).join("")}</select></label><label class="wide">Groupe classe <span class="optional">facultatif · faites défiler la liste</span><select class="schedule-group-list" name="groupTitle" size="4"><option value="">Aucun groupe</option>${(state.studentClasses||[]).map(item=>`<option value="${escapeAttr(item.title)}" ${item.title===existing?.groupTitle?"selected":""}>${escapeHtml(item.title)}</option>`).join("")}</select></label><label class="wide">Description <span class="optional">facultatif</span><textarea name="description" rows="3">${escapeHtml(existing?.description||"")}</textarea></label><div class="wide editor-actions">${existing?`<button class="btn danger" type="button" onclick="deleteScheduleFromEditor(${index})">Supprimer</button>`:""}<button class="btn primary" type="submit">Enregistrer</button></div></form></section>`; }
      async function saveScheduleEditor(event,index){ event.preventDefault(); const form=new FormData(event.currentTarget), start=scheduleMinutes(form.get("start")), end=scheduleMinutes(form.get("end")); if(end<=start){toast("L’heure de fin doit être après le début.");return;} const linked=findItem("class",String(form.get("classId"))), item={id:Number.isInteger(index)?state.schedule[index].id:uid("schedule"),day:String(form.get("day")),start,end,level:linked?.title||"Cours",groupTitle:String(form.get("groupTitle")),description:String(form.get("description")),classId:String(form.get("classId"))}; if(Number.isInteger(index))state.schedule[index]=item;else state.schedule.push(item); sessionStorage.setItem("mep-selected-schedule",item.id); if(await saveData("Emploi du temps enregistré.",event.submitter)){closeEditor();renderSchedule();} }
      async function deleteScheduleFromEditor(index){ const item=state.schedule[index]; if(!item||!confirm("Supprimer ce cours de l’emploi du temps ?"))return; state.schedule.splice(index,1); if(sessionStorage.getItem("mep-selected-schedule")===item.id)sessionStorage.removeItem("mep-selected-schedule"); if(await saveData("Cours supprimé.")){closeEditor();renderSchedule();} }
      async function removeScheduleItem(index) { state.schedule.splice(index,1); if(await saveData("Cours supprimé."))renderSchedule(); }

      function renderTeacherToolLinks() {
        const groups = [...new Set(teacherToolLinks.map((link) => link.group))];
        return `<section class="tool-directory" aria-labelledby="toolDirectoryTitle">
          <div class="tool-directory-head">
            <div><p class="small">Boîte à outils du professeur</p><h2 id="toolDirectoryTitle">Liens utiles</h2></div>
            <p class="muted small">Chaque service s'ouvre dans un nouvel onglet.</p>
          </div>
          ${groups.map((group) => `<section class="tool-link-group"><h3>${escapeHtml(group)}</h3><div class="tool-link-grid">${teacherToolLinks.filter((link) => link.group === group).map((link) => `<a class="tool-link-card" href="${escapeAttr(link.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(link.title)}</strong><span>${escapeHtml(link.description)}</span><small>Ouvrir l'outil ↗</small></a>`).join("")}</div></section>`).join("")}
        </section>`;
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
              <div class="wheel" id="studentWheel">
                <div class="wheel-result"><span class="wheel-help">La roue choisit au hasard un élève présent qui n'a pas atteint sa limite.</span><strong>${escapeHtml(last)}</strong></div>
              </div>
              <label class="label" style="margin:18px auto 0;max-width:330px">Nombre maximum de tirages par élève
                <input type="number" min="1" max="20" value="${limit}" ${canEdit() ? "" : "disabled"} onchange="setWheelLimit('${classe.id}', this.value)">
              </label>
              <div class="row wrap" style="justify-content:center;margin-top:18px">
                ${canEdit() ? `
                  <button class="btn primary" ${availableCount ? "" : "disabled"} onclick="spinStudentWheel('${classe.id}')">Lancer la roue</button>
                  <button class="btn" onclick="resetWheelCounts('${classe.id}')">Remettre les compteurs à 0</button>
                  <button class="btn" onclick="resetWheelAbsences('${classe.id}')">Tout le monde présent</button>
                  <button class="btn" onclick="clearWheelHistory('${classe.id}')">Vider l'historique</button>
                ` : `<span class="pill">Ouvrez la démo gratuite pour utiliser la roue</span>`}
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
          <h2>Chrono analogique / numérique</h2>
          <div class="timer-face" id="timerFace" role="timer" aria-label="Temps restant : 5 minutes">
            <span class="timer-hand" aria-hidden="true"></span>
            <div class="timer-face-inner"><div class="timer-display" id="timerDisplay">05:00</div><span>Temps restant</span></div>
          </div>
          <p class="timer-legend"><span>Les deux premiers tiers</span><strong>verts</strong><span>· le dernier tiers</span><strong>rouge</strong></p>
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
        const progress = timerTotal > 0 ? Math.max(0, Math.min(1, (timerTotal - timerRemaining) / timerTotal)) : 0;
        document.querySelectorAll("#timerDisplay, .embedded-timer-display").forEach((display) => {
          display.textContent = formatTimer(timerRemaining);
        });
        document.querySelectorAll(".timer-face").forEach((face) => {
          face.style.setProperty("--timer-angle", `${progress * 360}deg`);
          face.style.setProperty("--timer-green-angle", `${Math.min(progress, 2 / 3) * 360}deg`);
          face.dataset.phase = progress >= 2 / 3 ? "urgent" : "normal";
          face.setAttribute("aria-label", `Temps restant : ${formatTimer(timerRemaining)}`);
        });
      }

      function setTimerMinutes(value) {
        timerTotal = Math.max(1, Math.min(120, Number(value) || 5)) * 60;
        timerRemaining = timerTotal;
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
        timerTotal = Math.max(1, Math.min(120, Number(input?.value) || 5)) * 60;
        timerRemaining = timerTotal;
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
            <div class="breadcrumb"><button onclick="currentPage={type:'classes'};render()">Cours modifiables</button> / <button onclick="openClassPage('${classe.id}')">${escapeHtml(classe.title)}</button></div>
            <div class="row wrap">
              <div>
                <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(classe.title)}</h2>
                <p class="muted">${escapeHtml(classe.description)}</p>
              </div>
              ${editOnly(`<div class="row wrap">

                <button class="btn" onclick="manageCategories()">Organiser les séquences</button>
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
            <p class="small" style="font-weight:850;color:var(--wine-700)">Séquence n° ${sequenceNumber(classe, sequence)}</p>
            <h3 style="font-size:24px">${escapeHtml(sequence.title)} ${sequence.isVisible ? "" : "<span class='pill'>Masque</span>"}</h3>
            <p class="muted small">${escapeHtml(sequence.description)}</p>
          </div>
          <div class="row wrap">
            ${sequenceHookDocumentControl(sequence)}
            <button class="btn" onclick="openEditableSubtree('${classe.id}','${sequence.id}')">Arbre</button>
            <span class="pill">${sequence.lessons.length} séance(s)</span>
            <span class="pill">Tâche finale${sequence.finalTask ? ` : ${escapeHtml(sequence.finalTask)}` : ""}</span>
            <span class="pill">${activityCount} activité(s)</span>
            ${editOnly(moveButtons("sequence", sequence.id))}
            ${editOnly(`<button class="btn" onclick="openCopySequence('${sequence.id}')">Copier vers une classe</button>`)}
            <button class="btn primary" onclick="openSequencePage('${classe.id}','${sequence.id}')">${canEdit() ? "Modifier" : "Voir"}</button>
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
            <div class="breadcrumb"><button onclick="currentPage={type:'classes'};render()">Cours modifiables</button> / <button onclick="openClassPage('${classe.id}')">${escapeHtml(classe.title)}</button> / <button onclick="openSequencePage('${classe.id}','${sequence.id}')">${escapeHtml(sequence.title)}</button></div>
            <div class="row wrap">
              <div>
                <p class="small" style="margin:0 0 4px;font-weight:850;color:var(--wine-700)">Séquence n° ${sequenceNumber(classe, sequence)}</p>
                <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(sequence.title)}</h2>
                <p class="muted">${escapeHtml(sequence.description)}</p>
              </div>
              ${editOnly(`<div class="row wrap">
                <button class="btn" onclick="manageCategories()">Organiser les séances</button>
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
            ${editOnly(`<button class="btn" onclick="openCopyLesson('${lesson.id}')">Copier vers une classe</button>`)}
            <button class="btn primary" onclick="openLessonPage('${classe.id}','${sequence.id}','${lesson.id}')">${canEdit() ? "Modifier" : "Voir"}</button>
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
          <section class="page-head lesson-pptx-drop" ondragover="prepareLessonPptxDrop(event)" ondragleave="this.classList.remove('drop-target')" ondrop="importPptxIntoLesson('${lesson.id}',event)">
            <div class="breadcrumb"><button onclick="currentPage={type:'classes'};render()">Cours modifiables</button> / <button onclick="openClassPage('${classe.id}')">${escapeHtml(classe.title)}</button> / <button onclick="openSequencePage('${classe.id}','${sequence.id}')">${escapeHtml(sequence.title)}</button> / <button onclick="openLessonPage('${classe.id}','${sequence.id}','${lesson.id}')">${escapeHtml(lesson.title)}</button></div>
            <div class="row wrap">
              <div>
                <h2 style="margin:0;color:var(--wine-900);font-size:34px">${escapeHtml(lesson.title)}</h2>
                <p class="muted">${escapeHtml(lesson.description)}</p>
                ${lessonSuitcase(lesson)}
              </div>
              ${editOnly(`<div class="row wrap">

                <button class="btn" onclick="manageCategories()">Organiser les activités</button>
                <button class="btn" onclick="openEditor('lesson','${lesson.id}')">Modification</button>
                <button class="btn primary" onclick="createActivityInLesson('${lesson.id}')">Ajouter une activité</button>
                <button class="btn danger" onclick="removeItem('lesson','${lesson.id}')">Supprimer la séance</button>
              </div>`)}
            </div>
            ${editOnly(`<div class="pptx-drop-hint">Déposez un fichier PowerPoint (.pptx) ici pour créer automatiquement une activité.</div>`)}
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
              <button class="btn" onclick="createActivityInLesson('${lesson.id}')">+ Activité</button>
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
              <p class="small" style="font-weight:850;color:var(--wine-700)">${escapeHtml(activity.level || activity.classTitle || "Activité")}</p>
              <h3>${escapeHtml(activity.title)} ${activity.isVisible ? "" : "<span class='pill'>Masque</span>"}</h3>
              <p class="muted small">${escapeHtml(activity.objective || activity.description)}</p>
            </div>
            <div class="activity-actions">
              ${editOnly(moveButtons("activity", activity.id))}
              <button class="btn primary" onclick="openBoardInNewTab('${activity.id}')">Présenter</button>
              <button class="btn" onclick="openActivityPrintPreview('${activity.id}')">Aperçu / imprimer</button>
              ${editOnly(`<button class="btn" onclick="openActivityStudio('${activity.id}')">Modifier</button>
              <button class="btn danger" onclick="removeItem('activity','${activity.id}')">Supprimer</button>`)}
            </div>
          </div>
        </article>`;
      }

      function moveButtons(type, id) {
        return `<span class="item-move-buttons" aria-label="Déplacer cet élément">
          <button class="btn icon" type="button" onclick="moveItem('${type}','${id}',-1)" aria-label="Monter">↑</button>
          <button class="btn icon" type="button" onclick="moveItem('${type}','${id}',1)" aria-label="Descendre">↓</button>
        </span>`;
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

      let currentGlobalSearchEntries = [];

      function renderSearch() {
        document.querySelector("#content").innerHTML = `
          <section class="card search-hero">
            <h2>Recherche globale</h2>
            <p class="muted">Retrouvez un cours, une séance, une activité, une consigne, le texte d’une diapositive ou une ressource avec un mot ou quelques lettres.</p>
            <input id="globalSearch" type="search" autocomplete="off" autofocus placeholder="Ex. vacan, Italie, conjugaison, vidéo…" oninput="renderSearchResults(this.value)" />
          </section>
          <section id="searchResults" class="search-results"></section>
        `;
        currentGlobalSearchEntries = globalSearchEntries();
        renderSearchResults("");
      }

      function normalizeSearchText(value) {
        return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").toLowerCase().replace(/\s+/g, " ").trim();
      }

      function searchTextFrom(value) {
        if (Array.isArray(value)) return value.map(searchTextFrom).join(" ");
        if (value && typeof value === "object") return Object.entries(value).filter(([key]) => !["id","updatedAt","order"].includes(key)).map(([,item]) => searchTextFrom(item)).join(" ");
        if (typeof value === "string" && /^(?:data:|blob:)/i.test(value)) return "";
        return typeof value === "string" || typeof value === "number" ? String(value) : "";
      }

      function globalSearchEntries() {
        const entries = [];
        const add = (type,title,path,data,action,subtitle="") => entries.push({ type,title,path,subtitle,action,searchable:normalizeSearchText([title,path,subtitle,searchTextFrom(data)].join(" ")) });
        (state.classes || []).forEach((classe) => {
          add("Classe",classe.title,classe.title,classe,`openTableauClass('${classe.id}')`,classe.description);
          (classe.sequences || []).forEach((sequence) => {
            const sequencePath = `${classe.title} › ${sequence.title}`;
            add("Séquence",sequence.title,sequencePath,sequence,`openTableauSequence('${classe.id}','${sequence.id}')`,sequence.description || sequence.finalTask);
            (sequence.lessons || []).forEach((lesson) => {
              const lessonPath = `${sequencePath} › ${lesson.title}`;
              add("Séance",lesson.title,lessonPath,lesson,`openTableauLesson('${classe.id}','${sequence.id}','${lesson.id}')`,lesson.description);
              (lesson.activities || []).forEach((activity) => {
                const activityPath = `${lessonPath} › ${activity.title}`;
                add("Activité",activity.title,activityPath,activity,`openBoardInNewTab('${activity.id}',0)`,activity.objective || activity.instruction || activity.description);
                (activity.resources || []).forEach((resource) => add("Ressource",resource.title,`${activityPath} › ${resource.title}`,resource,`openSearchResource('${resource.id}','${activity.id}',event)`,resource.description || resource.category || resource.type));
              });
            });
          });
        });
        (state.resources || []).forEach((resource) => add("Ressource",resource.title,`Ressources générales › ${resource.title}`,resource,`openSearchResource('${resource.id}','',event)`,resource.description || resource.category || resource.type));
        return entries;
      }

      function openSearchResource(resourceId, activityId, event) {
        const resource = findItem("resource",resourceId) || (state.resources || []).find((item) => item.id === resourceId);
        if (resource?.url) return openManagedLink(resource.url,event);
        if (activityId) return openActivityStudio(activityId);
        setView("classes");
      }

      function renderSearchResults(query) {
        const target=document.querySelector("#searchResults");
        if(!target)return;
        const q=normalizeSearchText(query);
        if(!q){target.innerHTML=`<div class="search-empty"><strong>Tapez un mot ou quelques lettres</strong><span>La recherche parcourt tout le contenu de votre espace.</span></div>`;return;}
        const terms=q.split(" ").filter(Boolean);
        const results=currentGlobalSearchEntries.filter(entry=>entry.searchable.includes(q)||terms.every(term=>entry.searchable.includes(term))).map(entry=>({...entry,score:normalizeSearchText(entry.title).includes(q)?3:normalizeSearchText(entry.path).includes(q)?2:1})).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path,"fr"));
        target.innerHTML=`<div class="search-summary"><strong>${results.length} résultat${results.length>1?"s":""}</strong><span>pour « ${escapeHtml(String(query).trim())} »</span></div>${results.length?`<div class="search-result-list">${results.slice(0,200).map(entry=>`<article class="search-result-card"><button type="button" onclick="${entry.action}"><span class="search-result-type">${escapeHtml(entry.type)}</span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.path)}</small>${entry.subtitle?`<p>${escapeHtml(entry.subtitle)}</p>`:""}</button></article>`).join("")}</div>`:`<div class="search-empty"><strong>Aucun résultat</strong><span>Essayez une suite de lettres plus courte.</span></div>`}`;
      }

      const tutorialSteps = [
        { view: "dashboard", selector: "[data-view='dashboard']", title: "Cours à projeter", text: "Cette partie sert à retrouver rapidement une classe, une séquence, une séance puis l’activité à présenter devant les élèves. Elle ne modifie pas le contenu." },
        { view: "dashboard", selector: ".upcoming-courses-card", title: "Trois prochains cours", text: "Cette carte affiche les trois prochains cours prévus aujourd’hui. Cliquez sur un cours pour ouvrir directement le cours associé dans votre espace." },
        { view: "dashboard", selector: "[data-shortcut-title='Cahier de texte']", title: "Cahier de texte externe", text: "Ce raccourci quitte MON ESPACE PROF et ouvre le site Pronote professeur dans un nouvel onglet. Vos données Pronote ne sont pas stockées ici." },
        { view: "dashboard", selector: "[data-shortcut-title='Messagerie']", title: "Messagerie externe", text: "Ce raccourci ouvre la messagerie de l’académie de Grenoble sur un autre site, dans un nouvel onglet." },
        { view: "classes", selector: "[data-view='classes']", title: "Cours modifiables", text: "C’est ici que vous préparez la structure complète : classes, séquences, séances, activités et ressources. Les modifications sont enregistrées dans votre espace." },
        { view: "classes", selector: "#content", title: "Créer et organiser", text: "Ouvrez chaque niveau successivement. Vous pouvez ajouter, renommer, réordonner ou supprimer les éléments, puis organiser les activités d’une séance." },
        { view: "classes", selector: "#content", title: "Éditeur des activités", text: "Dans une activité, ajoutez des diapos, du texte, des URL, PDF, ODT, images, vidéos ou MP3. Les formats AVI, MOV, MKV, WMV, FLV, MPEG, M4V, 3GP et TS sont convertis automatiquement en MP4 compatible. Les objets et les diapos se déplacent par glisser-déposer ; Annuler permet de récupérer une suppression accidentelle." },
        { view: "classes", selector: "#content", title: "Impression et export", text: "L’aperçu d’impression permet de choisir Portrait ou Paysage et place chaque diapo sur une page. Le ZIP conserve aussi les PDF, documents LibreOffice et médias." },
        { view: "tree", selector: "[data-view='tree']", title: "Arbre", text: "L’arbre présente toute la hiérarchie du cours sur une seule page et fournit un accès direct à chaque classe, séquence, séance ou activité." },
        { view: "studentClasses", selector: "[data-view='studentClasses']", title: "Groupes Classes", text: "Créez vos groupes et renseignez les élèves. Ces listes alimentent le plan de classe, la roue de la fortune et le suivi des absences." },
        { view: "studentClasses", selector: "#content", title: "Plan de classe", text: "Choisissez jusqu’à 40 bureaux, nommez-les, supprimez ceux qui sont inutiles et déplacez librement les sièges dans ou hors de la grille." },
        { view: "tools", selector: "[data-view='tools']", title: "Outils de classe", text: "Utilisez la roue de la fortune, la liste des absents, les compteurs, l’historique et le chronomètre avec le groupe sélectionné." },
        { view: "schedule", selector: "[data-view='schedule']", title: "Emploi du temps", text: "Cliquez dans le calendrier pour ajouter un cours. Seuls les horaires sont obligatoires ; le groupe, la description et le cours associé restent facultatifs." },
        { view: "schedule", selector: "#content", title: "Déplacer un cours", text: "Faites glisser un cours vers une autre case pour modifier son jour ou son heure. Cliquez dessus pour le modifier, le supprimer ou ouvrir son cours associé." },
        { view: "search", selector: "[data-view='search']", title: "Recherche", text: "Saisissez un mot du titre, de la consigne, du niveau ou d’une ressource pour retrouver rapidement un contenu dans tout votre espace." },
        { view: "settings", selector: "[data-view='settings']", title: "Réglages et sauvegardes", text: "Vérifiez le stockage, exportez une sauvegarde ZIP complète et consultez les sauvegardes disponibles avant toute opération importante." },
        { view: "dashboard", selector: "#openBoardBtn", title: "Mode tableau", text: "Le mode tableau présente l’activité en plein écran. Utilisez les commandes pour passer d’une diapo à l’autre pendant le cours." },
        { view: "dashboard", selector: "#pronoteExternalLink", title: "Lien vers Pronote", text: "Le bouton « Cahier de texte » mène à un autre site : Pronote s’ouvre dans un nouvel onglet afin de ne pas fermer MON ESPACE PROF." },
        { view: "dashboard", selector: "#messagingExternalLink", title: "Lien vers la messagerie", text: "Le bouton « Messagerie » mène lui aussi à un autre site et s’ouvre dans un nouvel onglet." },
        { view: "tutorial", selector: ".sidebar-mail", title: "OrellanaTech et assistance", text: "Le nom « OrellanaTech » mène au site externe d’OrellanaTech dans un nouvel onglet. Un clic sur le téléphone ou l’adresse e-mail copie simplement l’information pour pouvoir la réutiliser." }
      ];

      function renderTutorial() {
        document.querySelector("#content").innerHTML = `
          <section class="page-head">
            <div class="breadcrumb">Tutoriel</div>
            <h2 style="margin:0;color:var(--wine-900);font-size:34px">Visite guidée</h2>
            <p class="muted">Lancez le tutoriel pour parcourir toutes les parties du site. Vous pouvez le passer ou le quitter à tout moment.</p>
          </section>
          <section class="card">
            <h2>Comprendre tout le site en quelques clics</h2>
            <p class="muted">La visite change de page automatiquement, encadre chaque fonction importante et explique son utilisation.</p>
            <div class="row wrap" style="margin-top:18px">
              <button class="btn primary" onclick="startTutorial()">Lancer le tutoriel</button>
              <button class="btn" onclick="setView('dashboard')">Passer le tutoriel</button>
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
          { view: "dashboard", selector: "#content", title: "Démo gratuite complète", text: "La démo reprend les fonctions du véritable espace avec un cours sur Leonardo da Vinci. Vos essais restent uniquement en mémoire pendant cette visite." },
          { view: "classes", selector: "#content", title: "Cours modifiables", text: "Créez, modifiez, déplacez et supprimez les classes, séquences, séances, activités et ressources comme dans le véritable espace." },
          { view: "tree", selector: "#content", title: "Arbre", text: "Explorez toute l’organisation du cours depuis une vue unique." },
          { view: "studentClasses", selector: "#content", title: "Groupes Classes", text: "Ajoutez des groupes et des élèves pour tester les outils de classe." },
          { view: "studentClasses", selector: "#content", title: "Plan de classe", text: "Choisissez directement de 1 à 40 bureaux, puis ajoutez, supprimez et déplacez-les librement dans toute la salle." },
          { view: "tools", selector: "#content", title: "Outils", text: "Testez la roue, les absences, les compteurs et le chronomètre exactement comme dans le véritable espace." },
          { view: "schedule", selector: "#content", title: "Emploi du temps", text: "Cliquez sur une case : seules les heures sont obligatoires. Le cours, la description et le groupe choisi dans la liste déroulante restent facultatifs." },
          { view: "search", selector: "#content", title: "Recherche", text: "Retrouvez rapidement une activité ou une ressource dans toutes les données de démonstration." },
          { view: "tutorial", selector: "#content", title: "Tutoriel", text: "Relancez cette visite complète à tout moment ou passez-la avec le bouton prévu." },
          { view: "dashboard", selector: "[data-shortcut-title='Cahier de texte']", title: "Cahier de texte externe", text: "Ce raccourci mène à Pronote, un autre site, qui s’ouvre dans un nouvel onglet." },
          { view: "dashboard", selector: "[data-shortcut-title='Messagerie']", title: "Messagerie externe", text: "Ce raccourci mène à la messagerie académique, sur un autre site ouvert dans un nouvel onglet." },
          { view: "tutorial", selector: "#exampleAd", title: "OrellanaTech et contact", text: "Le nom « OrellanaTech » mène au site externe d’OrellanaTech dans un nouvel onglet. Le téléphone et l’adresse e-mail se copient au clic." },
          { view: "settings", selector: "#content", title: "Réglages", text: "Exportez un ZIP complet : les PDF, documents LibreOffice, MP3 et autres médias sont inclus pour rester consultables hors ligne." },
          { view: "dashboard", selector: "#content", title: "Classe 5eme", text: "On commence par la classe 5eme.", enter: () => firstClass && openTableauClass(firstClass.id) },
          { view: "dashboard", selector: "#content", title: "Séquence", text: "Le tutoriel ouvre la première séquence de l'exemple.", enter: () => firstClass && firstSequence && openTableauSequence(firstClass.id, firstSequence.id) },
          { view: "dashboard", selector: "#content", title: "Séance", text: "Puis la visite ouvre la première séance pour trouver ses activités.", enter: () => firstClass && firstSequence && firstLesson && openTableauLesson(firstClass.id, firstSequence.id, firstLesson.id) },
          { view: "dashboard", selector: "#content", title: "Activité", text: "Le tutoriel ouvre maintenant l’activité exemple." },
          { view: "classes", selector: "#content", title: "Éditeur des activités", text: "Déposez un PPTX pour importer ses diapos. Ajoutez ou collez aussi des PDF, documents LibreOffice/ODT, MP3 et vidéos. Sur le véritable espace, les formats AVI, MOV, MKV, WMV, FLV, MPEG, M4V, 3GP et TS sont convertis automatiquement en MP4 compatible. Supprimez depuis une miniature, puis utilisez Annuler/Rétablir ou Ctrl+Z pour récupérer une diapo ou un objet supprimé." },
          { view: "dashboard", selector: "#boardPage", title: "Diapo (activité) exemple", text: "Cette activité contient un titre, une image et la vidéo déposée localement.", enter: () => firstActivity && showBoard(firstActivity.id, 0) }
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
        const panelTop = top + height + 18 + 230 < window.innerHeight ? top + height + 18 : Math.max(16, Math.min(window.innerHeight - 246, top - 18));
        overlay.hidden = false;
        overlay.innerHTML = `
          <div class="tour-highlight" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px"></div>
          <section class="tour-panel" style="left:${panelLeft}px;top:${panelTop}px">
            <span class="tour-step-count">Étape ${tourIndex + 1} / ${steps.length}</span>
            <h3>${escapeHtml(step.title)}</h3>
            <p>${escapeHtml(step.text)}</p>
            <div class="row wrap" style="margin-top:16px;justify-content:flex-end">
              <button class="btn" onclick="endTutorial()">Passer le tutoriel</button>
              <button class="btn" ${tourIndex === 0 ? "disabled" : ""} onclick="previousTutorialStep()">Précédent</button>
              <button class="btn primary" onclick="nextTutorialStep()">${tourIndex === steps.length - 1 ? "Finir" : "Suivant"}</button>
            </div>
          </section>
        `;
        requestAnimationFrame(() => {
          const panel = overlay.querySelector(".tour-panel");
          if (!panel) return;
          const safeTop = Math.max(16, Math.min(Number.parseFloat(panel.style.top) || 16, window.innerHeight - panel.offsetHeight - 16));
          panel.style.top = `${safeTop}px`;
        });
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
        if (!overlay) return;
        overlay.hidden = true;
        overlay.innerHTML = "";
      }

      function renderSettings() {
        const formatBytes = (value) => `${(Number(value || 0) / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
        const localMode = isLoggedIn() && isLocalFileMode();
        const freeMode = freeExampleOpen && !isLoggedIn();
        const isAdmin = authenticatedUser?.role === "admin" && !localMode;
        document.querySelector("#content").innerHTML = `
          <div class="grid two">
            <section class="card">
              <h2>Compte et sécurité</h2>
              <p class="muted">Compte connecté : <strong>${isLoggedIn() ? escapeHtml(currentUsername()) : "visiteur public"}</strong></p>
              <p class="small muted">${freeMode ? "Version gratuite : vous pouvez tout essayer. Les changements restent seulement en mémoire pendant cette visite et rien n’est envoyé au serveur." : localMode ? "Mode local autonome : les données restent dans ce navigateur et ne sont pas envoyées au serveur." : isLoggedIn() ? "Votre mot de passe protège vos cours et vos données enregistrées sur le serveur." : "Ouvrez l’exemple gratuit pour essayer toutes les fonctions sans sauvegarde serveur."}</p>
              ${isLoggedIn() && !localMode ? '<button class="btn primary" onclick="offerPasswordChange()">Changer mon mot de passe</button>' : ""}
            </section>
            <section class="card">
              <h2>Données</h2>
              <p class="muted">${freeMode ? "Fichier d’exemple temporaire : toutes les fonctions sont actives, mais aucune modification ne sera enregistrée sur le serveur ni conservée après fermeture." : localMode ? "Mode local activé : vos modifications sont enregistrées uniquement dans le stockage de ce navigateur. Pensez à utiliser Exporter ZIP pour conserver une sauvegarde." : isLoggedIn() ? "Mode serveur activé : vos données sont enregistrées sur le NAS et disponibles depuis tous vos appareils. Utilisez Exporter ZIP ou Exporter pour conserver une copie supplémentaire." : "Ouvrez l’exemple gratuit pour tester le site."}</p>
              ${isLoggedIn() && storageInfo ? `<p class="small muted">Espace serveur : ${formatBytes(storageInfo.used_bytes)} utilisés sur ${formatBytes(storageInfo.quota_bytes)}. Images : ${formatBytes(storageInfo.categories?.images)} · Vidéos : ${formatBytes(storageInfo.categories?.videos)} · Documents : ${formatBytes(storageInfo.categories?.documents)} · Sauvegardes : ${formatBytes(storageInfo.categories?.backups)}</p>` : ""}
              ${canEdit() ? `<div class="row wrap" style="margin-top:12px">
                <button class="btn" onclick="exportData()">Exporter</button>
                <button class="btn primary" onclick="exportZip(this)">Exporter ZIP</button>
                <button class="btn" id="importDataBtn" type="button" onclick="document.querySelector('#importDataInput').click()">Importer ZIP ou JSON</button>
                <input id="importDataInput" type="file" accept=".zip,.json,application/zip,application/json" hidden onchange="importData(this.files[0],document.querySelector('#importDataBtn'));this.value=''">
                <button class="btn danger" onclick="resetData()">Réinitialiser</button>
              </div>
              <p class="small muted">Le ZIP contient toutes les classes, séquences, séances, présentations et données complètes.</p>` : `<button class="btn primary" onclick="showLogin()">Se connecter</button>`}
            </section>
            ${isAdmin ? `<section class="card" style="grid-column:1/-1">
              <h2>Gestion des comptes</h2>
              <p class="small muted">Les mots de passe sont protégés et ne peuvent pas être affichés. En tant qu'administrateur, vous pouvez remplacer le mot de passe d'un compte par un nouveau mot de passe que vous connaissez.</p>
              <form class="form-grid admin-create-account" style="margin-top:16px" onsubmit="createAdminAccount(event)">
                <label class="label">Identifiant *<input class="input" name="username" maxlength="80" autocomplete="off" required></label>
                <label class="label">Nom affiché<input class="input" name="displayName" maxlength="160" autocomplete="off"></label>
                <label class="label">Adresse e-mail<input class="input" name="email" type="email" maxlength="320" autocomplete="off"></label>
                <label class="label">Mot de passe initial *<input class="input" name="temporaryPassword" type="password" minlength="10" autocomplete="new-password" required></label>
                <label class="label">Confirmer le mot de passe *<input class="input" name="passwordConfirmation" type="password" minlength="10" autocomplete="new-password" required></label>
                <div class="wide"><p class="form-error" role="alert" hidden></p><button class="btn primary" type="submit">Créer le compte enseignant</button></div>
              </form>
              <div class="list-table" style="margin-top:12px">
                ${adminUsersError ? `<p class="muted">Chargement impossible : ${escapeHtml(adminUsersError)}. <button class="btn" onclick="retryAdminUsers()">Réessayer</button></p>` : adminUsersLoaded ? adminUsers.map((user) => `<article class="list-row">
                  <div><strong>${escapeHtml(user.username)}</strong><p class="small muted">${escapeHtml(user.role)} · ${escapeHtml(user.status)}</p></div>
                  ${user.id === authenticatedUser.id ? '<span class="pill">Votre compte</span>' : `<button class="btn" onclick="resetAccountPassword('${user.id}',this)">Remplacer le mot de passe</button>`}
                </article>`).join("") || empty("Aucun compte.") : '<p class="muted">Chargement des comptes…</p>'}
              </div>
            </section>` : ""}
          </div>
        `;
        if (isAdmin && !adminUsersLoaded && !adminUsersLoading) setTimeout(loadAdminUsers, 0);
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
        const descriptionLabel = type === "lesson" ? "Objectif" : "Description";
        const base = `
          <div class="form-grid">
            ${field("title", "Titre", item.title, true)}
            ${textarea("description", descriptionLabel, item.description, "wide")}
            ${field("order", "Ordre", item.order, false, "number")}
            <label class="label">Visible <select name="isVisible"><option value="true" ${item.isVisible !== false ? "selected" : ""}>Oui</option><option value="false" ${item.isVisible === false ? "selected" : ""}>Non</option></select></label>
          </div>`;
        if (type === "class") return base + `<label class="label">Catégorie <select name="category">${state.categories.map((category) => `<option ${((item.category || "Collège") === category) ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></label>`;
        if (type === "sequence") return base + textarea("finalTask", "Tâche finale", item.finalTask || "", "wide") + selectField("classId", "Classe", item.classId || "", flat.classes);
        if (type === "lesson") return base + selectField("sequenceId", "Séquence", item.sequenceId || "", flat.sequences) + `<fieldset class="lesson-suitcase-fields"><legend>🧳 Ma valise pédagogique</legend><p class="small muted wide">Indiquez ce qui est travaillé pendant cette séance.</p><div class="form-grid">${textarea("cultural", "Culture", item.cultural || "", "wide")}${textarea("lexicon", "Lexique", item.lexicon || "")}${textarea("conjugation", "Conjugaison", item.conjugation || "")}${textarea("grammar", "Grammaire", item.grammar || "")}${textarea("lifeSkills", "Je sais… (vie quotidienne)", item.lifeSkills || "", "wide")}</div></fieldset>`;
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
        const field = document.querySelector("input[name='url']");
        if (isLocalFileMode() || freeExampleOpen) {
          field.value = await readFileAsDataUrl(file);
          toast("Fichier chargé localement. Enregistrez la ressource.");
          return;
        }
        try {
          const uploaded = await window.ServerAPI.upload(file);
          field.value = uploaded.content_url;
          toast("Fichier charge. Enregistrez la ressource.");
        } catch {
          field.value = await readFileAsDataUrl(file);
          toast("Fichier charge. Enregistrez la ressource.");
        }
      }

      function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(reader.error || new Error("Lecture locale impossible"));
          reader.readAsDataURL(file);
        });
      }

      async function createActivityInLesson(lessonId) {
        if (!requireLogin()) return;
        const lesson = findItem("lesson", lessonId);
        if (!lesson) return;
        const activity = {
          ...createBlank("activity", { lessonId }),
          id: uid("act"),
          title: "Nouvelle activité",
          slug: slugify("nouvelle-presentation"),
          description: "Activité à projeter.",
          objective: "",
          instruction: "",
          level: "",
          resources: [],
          slides: [{ id: uid("slide"), elements: [] }]
        };
        lesson.activities.push(activity);
        if (await saveData("Activité créée sur le serveur.")) openActivityStudio(activity.id);
      }

      function prepareLessonPptxDrop(event){ if(!canEdit()||![...(event.dataTransfer?.items||[])].some(item=>item.kind==="file"))return; event.preventDefault(); event.currentTarget.classList.add("drop-target"); }
      async function importPptxIntoLesson(lessonId,event){ event.preventDefault(); event.currentTarget.classList.remove("drop-target"); if(!requireLogin())return; const files=[...(event.dataTransfer?.files||[])].filter(file=>/\.pptx$/i.test(file.name||"")||file.type==="application/vnd.openxmlformats-officedocument.presentationml.presentation"); if(!files.length){toast("Déposez un fichier PowerPoint au format .pptx.");return;} const lesson=findItem("lesson",lessonId), finishUploadLock=beginSaveLock(null); try { for(const file of files){ const slides=await importPptxAsSiteSlides(file); const title=String(file.name||"PowerPoint").replace(/\.pptx$/i,""); lesson.activities.push({...createBlank("activity",{lessonId}),id:uid("act"),title,slug:slugify(title),description:"Activité créée depuis un PowerPoint.",objective:"",instruction:"",level:"",resources:[],slides:slides.map(slide=>({...slide,duration:slide.duration||"5 min"}))}); } if(await saveData(`${files.length} activité(s) créée(s) depuis PowerPoint.`))render(); } catch(error){toast(`Import PowerPoint impossible : ${error.message||"erreur"}.`);} finally {finishUploadLock();} }

      function openActivityStudio(id) {
        if (!requireLogin()) return;
        const result = findActivity(id);
        if (!result) return;
        const activity = ensureActivitySlides(result.activity);
        if(studioHistoryActivityId!==id){studioHistoryActivityId=id;studioUndoStack=[];studioRedoStack=[];}
        currentStudioSlideIndex = 0;
        const stripHeight = activity.slides.length * slideSize.height + Math.max(0, activity.slides.length - 1) * slideSize.gap;
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `
          <section class="studio" data-activity-id="${activity.id}">
            <header class="studio-toolbar">
              <div>
                ${activityLocationBreadcrumb(result, "studio-location")}
                <strong>${escapeHtml(activity.title)}</strong>
                <div class="studio-note">Diapos (activités) horizontales. Les cadres pointillés indiquent ce qui sera visible au tableau.</div>
                <div class="studio-save-status" id="studioSaveStatus" role="status" hidden></div>
              </div>
              <div class="studio-actions">
                <div id="studioTextFormatToolbar" class="studio-text-format" role="toolbar" aria-label="Mise en forme du texte" hidden>
                  <select class="studio-format-select studio-font-family" aria-label="Police" title="Police" onmousedown="rememberStudioTextSelection()" onchange="setStudioTextFont(this.value,event)"><option>Calibri</option><option>Arial</option><option>Aptos</option><option>Verdana</option><option>Georgia</option><option>Times New Roman</option><option>Trebuchet MS</option></select>
                  <select class="studio-format-select studio-font-size" aria-label="Taille des lettres" title="Taille des lettres" onmousedown="rememberStudioTextSelection()" onchange="setStudioTextSize(this.value,event)">${[10,12,14,16,18,20,24,28,32,36,40,48,54,60,72,84,96].map(size=>`<option value="${size}" ${size===32?"selected":""}>${size}</option>`).join("")}</select>
                  <button class="btn format-button" type="button" title="Réduire la taille" aria-label="Réduire la taille du texte" onmousedown="resizeStudioText(-2,event)">A−</button>
                  <button class="btn format-button" type="button" title="Augmenter la taille" aria-label="Augmenter la taille du texte" onmousedown="resizeStudioText(2,event)">A+</button>
                  <button class="btn format-button" type="button" title="Gras (Ctrl+B)" aria-label="Gras" onmousedown="formatStudioText('bold',event)"><strong>G</strong></button>
                  <button class="btn format-button" type="button" title="Italique (Ctrl+I)" aria-label="Italique" onmousedown="formatStudioText('italic',event)"><em>I</em></button>
                  <button class="btn format-button" type="button" title="Souligné (Ctrl+U)" aria-label="Souligné" onmousedown="formatStudioText('underline',event)"><u>S</u></button>
                  <button class="btn format-button" type="button" title="Barré" aria-label="Barré" onmousedown="formatStudioText('strikeThrough',event)"><s>abc</s></button>
                  <button class="btn format-button" type="button" title="Indice" aria-label="Indice" onmousedown="formatStudioText('subscript',event)">x₂</button>
                  <button class="btn format-button" type="button" title="Exposant" aria-label="Exposant" onmousedown="formatStudioText('superscript',event)">x²</button>
                  <button class="btn format-button" type="button" title="Liste à puces" aria-label="Liste à puces" onmousedown="formatStudioText('insertUnorderedList',event)">• Liste</button>
                  <button class="btn format-button" type="button" title="Liste numérotée" aria-label="Liste numérotée" onmousedown="formatStudioText('insertOrderedList',event)">1. Liste</button>
                  <button class="btn format-button" type="button" title="Diminuer le retrait" aria-label="Diminuer le retrait" onmousedown="formatStudioText('outdent',event)">⇤</button>
                  <button class="btn format-button" type="button" title="Augmenter le retrait" aria-label="Augmenter le retrait" onmousedown="formatStudioText('indent',event)">⇥</button>
                  <button class="btn format-button" type="button" title="Aligner à gauche" aria-label="Aligner à gauche" onmousedown="formatStudioText('justifyLeft',event)">☰</button>
                  <button class="btn format-button" type="button" title="Centrer" aria-label="Centrer" onmousedown="formatStudioText('justifyCenter',event)">≡</button>
                  <button class="btn format-button" type="button" title="Aligner à droite" aria-label="Aligner à droite" onmousedown="formatStudioText('justifyRight',event)">☷</button>
                  <button class="btn format-button" type="button" title="Justifier" aria-label="Justifier" onmousedown="formatStudioText('justifyFull',event)">▤</button>
                  <button class="btn format-button" type="button" title="Effacer la mise en forme" aria-label="Effacer la mise en forme" onmousedown="formatStudioText('removeFormat',event)">× Style</button>
                  <button class="btn format-button studio-highlight-button" type="button" title="Surligner en jaune" aria-label="Surligner en jaune" onmousedown="formatStudioText('hiliteColor',event,'#fff176')">ab</button>
                  <select class="studio-format-select studio-color-select" aria-label="Couleur du texte" title="Couleur du texte" onmousedown="rememberStudioTextSelection()" onchange="formatStudioText('foreColor',event,this.value);this.selectedIndex=0"><option value="">Couleur du texte…</option>${[["#24171a","Noir"],["#555555","Gris foncé"],["#888888","Gris"],["#b21f3d","Rouge"],["#7b1830","Bordeaux"],["#d06b16","Orange"],["#d4a400","Jaune foncé"],["#187b51","Vert"],["#16877d","Turquoise"],["#2457b2","Bleu"],["#173b7a","Bleu foncé"],["#713c9b","Violet"],["#c04b91","Rose"],["#ffffff","Blanc"]].map(([color,label])=>`<option value="${color}">${label}</option>`).join("")}</select>
                </div>
                <div id="studioGeneralActions" class="studio-general-actions">
                <button class="btn" onclick="renameActivity('${activity.id}')">Titre</button>
                <button class="btn" onclick="renameStudioSlideInstruction('${activity.id}')">Consigne diapo</button>
                <button class="btn" onclick="addSlide('${activity.id}')">+ Diapo (activité)</button>
                <button class="btn" id="studioUndoBtn" onclick="undoStudioChange('${activity.id}')" ${studioUndoStack.length?"":"disabled"}>↶ Annuler</button>
                <button class="btn" id="studioRedoBtn" onclick="redoStudioChange('${activity.id}')" ${studioRedoStack.length?"":"disabled"}>↷ Rétablir</button>
                <button class="btn danger" onclick="deleteStudioSlide('${activity.id}',currentStudioSlideIndex,event)" ${activity.slides.length>1?"":"disabled"}>Suppr. diapo</button>
                <button class="btn" onclick="addTextElement('${activity.id}')">+ Texte</button>
                <button class="btn" onclick="addUrlElement('${activity.id}')">+ URL</button>
                <label class="btn">+ Fichier <input type="file" accept="image/*,audio/*,video/*,.avi,.mkv,.wmv,.flv,.m4v,.mpeg,.mpg,.3gp,.ts,.m2ts,.pdf,.doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.txt,.rtf,.csv,.json,.xml,.html,.htm,.zip" hidden onchange="addFileElement('${activity.id}',this.files[0],this);this.value=''"></label>
                <div class="studio-tool-actions">
                  <label class="studio-tool-picker">Groupe pour la roue
                    <select id="studioToolClass">${(state.studentClasses || []).map((classe) => `<option value="${escapeAttr(classe.id)}">${escapeHtml(classe.title)}</option>`).join("") || '<option value="">Aucun groupe</option>'}</select>
                  </label>
                  <button class="btn studio-tool-button studio-wheel-button" onclick="addToolElement('${activity.id}','wheel')">+ Roue</button>
                  <button class="btn studio-tool-button studio-timer-button" onclick="addToolElement('${activity.id}','timer')">+ Chrono</button>
                </div>
                <button class="btn danger" onclick="deleteSelectedElement()">Suppr. objet</button>
                <button class="btn primary" onclick="saveStudio('${activity.id}',false,this)">Enregistrer</button>
                <button class="btn" onclick="showBoard('${activity.id}',0)">Présenter</button>
                <button class="btn" onclick="previewStudioActivity('${activity.id}',this)">Imprimer / Word</button>
                <button class="btn" onclick="closeEditor()">Fermer</button>
                </div>
              </div>
            </header>
            <div class="studio-workspace">
              <div class="studio-sidebar"><aside class="slide-thumbnails" aria-label="Miniatures des diapos">${activity.slides.map((slide, index) => renderSlideThumbnail(slide, index)).join("")}</aside><div class="studio-activity-content"><span>Contenu de l’activité</span><strong>${escapeHtml(activity.instruction || activity.objective || activity.description || "Aucun contenu renseigné")}</strong></div></div>
              <div class="slide-world">
              <div class="slide-strip" id="slideStrip" style="height:${stripHeight}px">
                ${activity.slides.map((slide, index) => renderStudioSlide(slide, index)).join("")}
                ${activity.slides.map((slide, index) => (slide.elements || []).map((element) => renderStudioElement(element, index)).join("")).join("")}
              </div>
              </div>
            </div>
          </section>
        `;
        initStudioDrag();
        initStudioCanvasInput();
        initStudioTextToolbarVisibility();
        hydrateDocumentPreviews();
      }

      function renderStudioSlide(slide, index) {
        const top = index * (slideSize.height + slideSize.gap);
        return `<article class="slide-frame ${index === currentStudioSlideIndex ? "current" : ""}" data-slide-id="${slide.id}" data-slide-index="${index}" data-label="${escapeAttr(slideInstruction(slide,index))}" tabindex="0" onclick="selectStudioSlide(${index})" style="position:absolute;left:0;top:${top}px"></article>`;
      }

      function slideInstruction(slide, index) {
        return String(slide?.instruction || "").trim() || `Consigne de l’activité ${index + 1}`;
      }

      function seatingPlanFor(group) {
        const source = group.seatingPlan || {};
        const rows = Math.max(1, Math.min(8, Number(source.rows) || 3));
        const columns = Math.max(1, Math.min(10, Number(source.columns) || 4));
        const count = Array.isArray(source.desks) ? Math.min(40, source.desks.length) : Math.min(40, rows * columns);
        const positions = Array.from({ length: count }, (_, index) => source.positions?.[index] || { x: ((index % columns) + .5) / columns * 100, y: 150 + Math.floor(index / columns) * 140 });
        return { rows, columns, desks: Array.from({ length: count }, (_, index) => source.desks?.[index] || ""), positions };
      }

      function openSeatingPlan(groupId) {
        if (!requireLogin()) return;
        const group = findItem("studentClass", groupId);
        if (!group) return;
        group.seatingPlan = seatingPlanFor(group);
        const plan = group.seatingPlan;
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        const roomHeight = Math.max(620, ...plan.positions.map(position => Number(position.y) + 150));
        modal.innerHTML = `<section class="seating-dialog" data-group-id="${escapeAttr(group.id)}"><header class="subtree-head"><div><p>Groupe classe</p><h2>Plan de classe · ${escapeHtml(group.title)}</h2><span class="muted">Choisissez directement le nombre de bureaux, puis déplacez-les librement dans la salle.</span></div><button class="btn" onclick="closeEditor()">Fermer</button></header><div class="seating-controls"><label>Nombre de bureaux <input type="number" min="1" max="40" value="${plan.desks.length}" onchange="setDeskCount('${group.id}',this.value)"></label><span class="pill">Maximum 40 bureaux</span><button class="btn" onclick="addDesk('${group.id}')" ${plan.desks.length >= 40 ? "disabled" : ""}>Ajouter un bureau</button><button class="btn primary" onclick="saveSeatingPlan('${group.id}',this)">Enregistrer</button></div><div class="cinema-room" style="min-height:${roomHeight}px"><div class="classroom-board"><span>TABLEAU</span><small>AVANT DE LA CLASSE</small></div><div class="seating-grid">${plan.desks.map((name,index)=>`<div class="desk ${name ? "assigned" : ""}" role="button" tabindex="0" data-index="${index}" style="left:${Number(plan.positions[index].x)}%;top:${Number(plan.positions[index].y)}px" onclick="selectDesk(this,event)" ondblclick="editDeskName('${group.id}',${index},this,event)" onpointerdown="startDeskMove('${group.id}',${index},this,event)"><button class="desk-delete" type="button" aria-label="Supprimer le bureau ${index+1}" title="Supprimer ce bureau" onclick="deleteDesk('${group.id}',${index},event)">×</button><span>Bureau ${index+1}</span><strong>${escapeHtml(name || "Libre")}</strong><small>Double-cliquez pour nommer</small></div>`).join("")}</div></div><datalist id="studentNames">${(group.students||[]).map(name=>`<option value="${escapeAttr(name)}"></option>`).join("")}</datalist></section>`;
        modal.onclick = (event) => { if (!event.target.closest(".desk")) modal.querySelectorAll(".desk.selected").forEach((node) => node.classList.remove("selected")); };
      }
      function selectDesk(node,event){ event.stopPropagation(); document.querySelectorAll(".desk.selected").forEach((item)=>item.classList.remove("selected")); node.classList.add("selected"); }
      function editDeskName(groupId,index,node,event){ event.stopPropagation(); const group=findItem("studentClass",groupId); const input=document.createElement("input"); input.setAttribute("list","studentNames"); input.value=group.seatingPlan.desks[index]||""; node.replaceChildren(input); input.focus(); let done=false; const finish=()=>{if(done)return;done=true;group.seatingPlan.desks[index]=input.value.trim();openSeatingPlan(groupId);}; input.onkeydown=(key)=>{if(key.key==="Enter")finish();}; input.onblur=finish; }
      function startDeskMove(groupId,index,node,event){ if(event.target.closest(".desk-delete")||event.detail>1)return; event.preventDefault(); const room=node.closest(".cinema-room"), rect=room.getBoundingClientRect(), group=findItem("studentClass",groupId); node.setPointerCapture(event.pointerId); node.classList.add("moving"); const move=(pointer)=>{ const x=Math.max(75,Math.min(rect.width-75,pointer.clientX-rect.left)); const y=Math.max(105,Math.min(room.scrollHeight-105,pointer.clientY-rect.top+room.scrollTop)); node.style.left=`${x/rect.width*100}%`; node.style.top=`${y}px`; group.seatingPlan.positions[index]={x:x/rect.width*100,y}; }; const finish=()=>{node.classList.remove("moving");node.removeEventListener("pointermove",move);node.removeEventListener("pointerup",finish);node.removeEventListener("pointercancel",finish);}; node.addEventListener("pointermove",move);node.addEventListener("pointerup",finish);node.addEventListener("pointercancel",finish); }
      function deleteDesk(groupId,index,event){ event.stopPropagation(); const group=findItem("studentClass",groupId); group.seatingPlan.desks.splice(index,1); group.seatingPlan.positions.splice(index,1); openSeatingPlan(groupId); }
      function addDesk(groupId){ const group=findItem("studentClass",groupId), plan=seatingPlanFor(group); if(plan.desks.length>=40)return; plan.desks.push(""); plan.positions.push({x:50,y:Math.max(150,...plan.positions.map(position=>Number(position.y)+125))}); group.seatingPlan=plan; openSeatingPlan(groupId); }
      function setDeskCount(groupId,value){ const group=findItem("studentClass",groupId), old=seatingPlanFor(group), count=Math.max(1,Math.min(40,Number(value)||1)), columns=Math.min(6,Math.max(1,Math.ceil(Math.sqrt(count)))); group.seatingPlan={rows:Math.ceil(count/columns),columns,desks:Array.from({length:count},(_,index)=>old.desks[index]||""),positions:Array.from({length:count},(_,index)=>old.positions[index]||{x:((index%columns)+.5)/columns*100,y:150+Math.floor(index/columns)*140})}; openSeatingPlan(groupId); }
      function resizeSeatingPlan(groupId,rows,columns){ const group=findItem("studentClass",groupId); const old=seatingPlanFor(group); let r=Math.max(1,Math.min(8,Number(rows)||old.rows)); let c=Math.max(1,Math.min(10,Number(columns)||old.columns)); while(r*c>40)c--; const count=r*c; group.seatingPlan={rows:r,columns:c,desks:Array.from({length:count},(_,i)=>old.desks[i]||""),positions:Array.from({length:count},(_,i)=>old.positions[i]||{x:((i%c)+.5)/c*100,y:150+Math.floor(i/c)*140})}; openSeatingPlan(groupId); }
      async function saveSeatingPlan(groupId,button){ if(await saveData("Plan de classe enregistré.",button)) openSeatingPlan(groupId); }

      function renderSlideThumbnail(slide, index) {
        const preview = (slide.elements || []).filter((element) => element.kind === "text").map((element) => element.value || "").join(" ").slice(0, 70);
        const slideCount = findItem("activity", studioHistoryActivityId)?.slides?.length || 0;
        return `<div class="slide-thumbnail ${index === currentStudioSlideIndex ? "current" : ""}" role="button" tabindex="0" draggable="true" data-index="${index}" onclick="if(!event.target.closest('input,button')){selectStudioSlide(${index});selectedSlide()?.scrollIntoView({behavior:'smooth',block:'center'})}" ondragstart="startStudioSlideReorder(${index},event)" ondragover="event.preventDefault();this.classList.add('drop-target')" ondragleave="this.classList.remove('drop-target')" ondragend="clearStudioSlideDropTargets()" ondrop="reorderStudioSlide(${index},event)"><div class="slide-thumbnail-actions"><button type="button" title="Remonter cette diapo" aria-label="Remonter la diapo ${index+1}" onclick="moveStudioSlideBy(${index},-1,event)" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" title="Descendre cette diapo" aria-label="Descendre la diapo ${index+1}" onclick="moveStudioSlideBy(${index},1,event)" ${index >= slideCount - 1 ? "disabled" : ""}>↓</button><button class="slide-thumbnail-delete" type="button" title="Supprimer cette diapo" aria-label="Supprimer la diapo ${index+1}" onclick="deleteStudioSlide('${studioHistoryActivityId}',${index},event)">×</button></div><span>${index + 1}</span><strong>${escapeHtml(slideInstruction(slide,index))}</strong><small>${escapeHtml(preview || "Sans texte")}</small><label class="slide-duration">Temps prévu <input draggable="false" value="${escapeAttr(slide.duration || "5 min")}" aria-label="Temps prévu pour la diapo ${index+1}" onclick="event.stopPropagation()" onpointerdown="event.stopPropagation()" oninput="updateSlideDuration(${index},this.value)"></label></div>`;
      }

      function updateSlideDuration(index,value){ const activity=findItem("activity",document.querySelector(".studio")?.dataset.activityId); if(activity?.slides[index]) activity.slides[index].duration=String(value||"").trim()||"5 min"; }

      function cloneStudioSlides(slides){ return JSON.parse(JSON.stringify(slides||[])); }
      function captureStudioSlides(activityId){ const activity=findItem("activity",activityId); const frames=[...document.querySelectorAll(`.studio[data-activity-id="${activityId}"] .slide-frame`)]; if(!frames.length)return deduplicateSlideElements(cloneStudioSlides(activity?.slides)); const previous=activity?.slides||[], slides=frames.map(frame=>{const saved=previous.find(slide=>slide.id===frame.dataset.slideId);return {id:frame.dataset.slideId||uid("slide"),duration:saved?.duration||"5 min",instruction:saved?.instruction||"",elements:[]};}); [...document.querySelectorAll(`.studio[data-activity-id="${activityId}"] .slide-el`)].map(readSlideElement).forEach(element=>{const target=slides[element.slideIndex]||slides[0],clean={...element};delete clean.slideIndex;target.elements.push(clean);}); return deduplicateSlideElements(slides); }
      function updateStudioHistoryButtons(){ const undo=document.querySelector("#studioUndoBtn"),redo=document.querySelector("#studioRedoBtn");if(undo)undo.disabled=!studioUndoStack.length;if(redo)redo.disabled=!studioRedoStack.length; }
      function recordStudioHistory(activityId){ const snapshot=captureStudioSlides(activityId); if(!snapshot?.length)return; studioUndoStack.push(snapshot); if(studioUndoStack.length>30)studioUndoStack.shift(); studioRedoStack=[]; updateStudioHistoryButtons(); }
      async function undoStudioChange(activityId){ if(!studioUndoStack.length)return; const activity=findItem("activity",activityId);studioRedoStack.push(captureStudioSlides(activityId));activity.slides=cloneStudioSlides(studioUndoStack.pop());const selected=Math.min(currentStudioSlideIndex,activity.slides.length-1);await saveData("Modification annulée.");openActivityStudio(activityId);currentStudioSlideIndex=selected;selectStudioSlide(selected);updateStudioHistoryButtons(); }
      async function redoStudioChange(activityId){ if(!studioRedoStack.length)return; const activity=findItem("activity",activityId);studioUndoStack.push(captureStudioSlides(activityId));activity.slides=cloneStudioSlides(studioRedoStack.pop());const selected=Math.min(currentStudioSlideIndex,activity.slides.length-1);await saveData("Modification rétablie.");openActivityStudio(activityId);currentStudioSlideIndex=selected;selectStudioSlide(selected);updateStudioHistoryButtons(); }
      function deleteStudioSlide(activityId,index,event){ event?.stopPropagation(); const activity=findItem("activity",activityId),slides=captureStudioSlides(activityId);if(!activity||slides.length<=1){toast("Une activité doit garder au moins une diapo.");return;}recordStudioHistory(activityId);slides.splice(index,1);activity.slides=slides;const selected=Math.max(0,Math.min(index,slides.length-1));openActivityStudio(activityId);currentStudioSlideIndex=selected;selectStudioSlide(selected);updateStudioHistoryButtons(); }

      function startStudioSlideReorder(index,event){ event.dataTransfer.effectAllowed="move"; event.dataTransfer.setData("application/x-studio-slide",String(index)); event.currentTarget.classList.add("dragging"); }
      function clearStudioSlideDropTargets(){ document.querySelectorAll(".slide-thumbnail").forEach(node=>node.classList.remove("dragging","drop-target")); }

      async function moveStudioSlideBy(sourceIndex, offset, event) {
        event?.stopPropagation();
        const activity = findItem("activity", document.querySelector(".studio")?.dataset.activityId);
        if (!activity) return;
        const slides = captureStudioSlides(activity.id);
        const targetIndex = sourceIndex + offset;
        if (targetIndex < 0 || targetIndex >= slides.length) return;
        recordStudioHistory(activity.id);
        const [slide] = slides.splice(sourceIndex, 1);
        slides.splice(targetIndex, 0, slide);
        activity.slides = slides;
        if (!await saveData("Ordre des diapos mis à jour.")) return;
        openActivityStudio(activity.id);
        currentStudioSlideIndex = targetIndex;
        selectStudioSlide(targetIndex);
        document.querySelector(`.slide-thumbnail[data-index="${targetIndex}"]`)?.scrollIntoView({block:"nearest"});
      }

      async function reorderStudioSlide(targetIndex, event) {
        event.preventDefault();
        const sourceIndex = Number(event.dataTransfer.getData("application/x-studio-slide"));
        clearStudioSlideDropTargets();
        if (!Number.isInteger(sourceIndex) || sourceIndex === targetIndex) return;
        const activity = findItem("activity", document.querySelector(".studio")?.dataset.activityId);
        recordStudioHistory(activity?.id);
        if (!activity || !await saveStudio(activity.id, false, null, false)) return;
        const [slide] = activity.slides.splice(sourceIndex, 1);
        activity.slides.splice(targetIndex, 0, slide);
        await saveData("Ordre des diapos mis à jour.");
        openActivityStudio(activity.id);
        currentStudioSlideIndex = targetIndex;
        selectStudioSlide(targetIndex);
      }

      function renderStudioElement(element, slideIndex = 0) {
        const globalTop = slideIndex * (slideSize.height + slideSize.gap) + Number(element.y || 80);
        return `<div class="slide-el" data-el-id="${element.id}" data-kind="${element.kind}" data-value="${escapeAttr(element.value || "")}" data-max-font-size="${Number(element.fontSize || 34)}" style="left:${Number(element.x || 80)}px;top:${globalTop}px;width:${Number(element.w || 320)}px;height:${Number(element.h || 160)}px">
          <button class="slide-move-handle" type="button" aria-label="Déplacer l’objet" title="Déplacer l’objet">✥</button>
          <button class="slide-delete-handle" type="button" aria-label="Supprimer l’objet" title="Supprimer l’objet" onclick="deleteStudioElement(this,event)">×</button>
          <span class="slide-size-indicator" aria-hidden="true"></span>
          <div class="slide-element-content">${renderElementContent(element, true)}</div>
          ${["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((direction) => `<span class="slide-resize-handle ${direction}" data-resize="${direction}" role="button" aria-label="Redimensionner vers ${direction}"></span>`).join("")}
        </div>`;
      }

      function renderElementContent(element, editable) {
        if (element.kind === "text") return `<div class="slide-text" contenteditable="${editable ? "true" : "false"}" ${editable ? 'data-placeholder="Écrivez ici…"' : ""} style="font-size:${Number(element.fontSize || 34)}px;font-family:${escapeAttr(element.fontFamily || "Calibri, Arial, sans-serif")}">${element.html ? sanitizeRichText(element.html) : escapeHtml(element.value || "")}</div>`;
        if (element.kind === "tool") return renderSlideTool(element.value, editable, element.id);
        if (element.kind === "youtube" || youtubeId(element.value)) return youtubeCard(element.value);
        if (element.kind === "image") return `<img src="${escapeAttr(element.value)}" alt="" referrerpolicy="no-referrer" onerror="recoverSlideImage(this)">`;
        if (element.kind === "audio") return `<audio controls preload="metadata" src="${escapeAttr(element.value)}" onerror="reportMediaError(this)"></audio>`;
        if (element.kind === "video") return `<video controls preload="metadata" src="${escapeAttr(element.value)}" onerror="reportMediaError(this)"></video>`;
        if (element.kind === "document" || (element.kind === "embed" && isStoredDocumentUrl(element.value))) {
          return `<div class="slide-document-card" data-document-preview="${escapeAttr(element.value)}"><span class="document-preview-status">Chargement du document…</span><div class="document-preview-content"></div><div class="document-preview-fallback" hidden><strong>Document joint</strong><span>L’aperçu de ce format n’est pas disponible.</span><a class="btn primary" href="${escapeAttr(element.value)}" target="_blank" rel="noreferrer" onclick="return openManagedLink(this.href,event)">Ouvrir le document</a></div></div>`;
        }
        if (element.kind === "pdf") return `<iframe src="${toEmbedUrl(element.value)}" title="Document PDF"></iframe>`;
        return `<iframe src="${toEmbedUrl(element.value)}"></iframe>`;
      }

      async function recoverSlideImage(image) {
        if (!image || image.dataset.recoveryAttempted === "true") {
          showBrokenSlideImage(image);
          return;
        }
        image.dataset.recoveryAttempted = "true";
        const source = image.getAttribute("src") || "";
        try {
          const response = await fetch(source, { credentials: "include", cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          if (!blob.type.startsWith("image/")) throw new Error("format non reconnu");
          const objectUrl = URL.createObjectURL(blob);
          image.onload = () => setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
          image.onerror = () => showBrokenSlideImage(image);
          image.src = objectUrl;
        } catch (error) {
          console.warn("Photo de diapositive inaccessible", source, error);
          showBrokenSlideImage(image);
        }
      }

      function showBrokenSlideImage(image) {
        const container = image?.parentElement;
        if (!container || container.querySelector(".slide-image-error")) return;
        image.hidden = true;
        container.insertAdjacentHTML("beforeend", `<div class="slide-image-error"><strong>Photo introuvable</strong><span>Le fichier a été déplacé ou supprimé. Sélectionnez cet objet puis remplacez la photo.</span></div>`);
      }

      function studioPointOnSlide(event, slide) {
        const rect = slide.getBoundingClientRect();
        return {
          x: Math.max(0, Math.min(slideSize.width - 60, event.clientX - rect.left)),
          y: Math.max(0, Math.min(slideSize.height - 40, event.clientY - rect.top))
        };
      }

      function insertStudioText(text, slideIndex, x = 90, y = 90) {
        recordStudioHistory(document.querySelector(".studio")?.dataset.activityId);
        const value = String(text ?? "").replace(/\r\n/g, "\n");
        document.querySelector("#slideStrip")?.insertAdjacentHTML("beforeend", renderStudioElement({
          id: uid("el"), kind: "text", x, y, w: Math.min(520, slideSize.width - x), h: 150, value, fontSize: 38
        }, slideIndex));
        initStudioDrag();
        const node = [...document.querySelectorAll(".studio .slide-el")].at(-1);
        document.querySelectorAll(".studio .slide-el.selected").forEach((item) => item.classList.remove("selected"));
        node?.classList.add("selected");
        fitStudioText(node);
        node?.querySelector(".slide-text")?.focus();
      }

      async function insertStudioClipboardImage(file, slideIndex, x = 100, y = 90) {
        const finishUploadLock = beginSaveLock(null);
        try {
          const uploaded = isLocalFileMode() || freeExampleOpen
            ? { content_url: await readFileAsDataUrl(file) }
            : await window.ServerAPI.upload(file);
          recordStudioHistory(document.querySelector(".studio")?.dataset.activityId);
          document.querySelector("#slideStrip")?.insertAdjacentHTML("beforeend", renderStudioElement({
            id: uid("el"), kind: "image", x, y, w: Math.min(520, slideSize.width - x), h: 300, value: uploaded.content_url
          }, slideIndex));
          initStudioDrag();
          toast("Image collée dans la diapo. Pensez à enregistrer.");
        } catch (error) {
          toast(`Collage de l’image impossible : ${error.message || "erreur serveur"}.`);
        } finally {
          finishUploadLock();
        }
      }

      function initStudioCanvasInput() {
        const studio = document.querySelector(".studio");
        if (!studio || studio.dataset.canvasInputReady === "true") return;
        studio.dataset.canvasInputReady = "true";
        studio.addEventListener("keydown",event=>{if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=="z"||event.target.closest("input,textarea,[contenteditable=true]"))return;event.preventDefault();if(event.shiftKey)redoStudioChange(studio.dataset.activityId);else undoStudioChange(studio.dataset.activityId);});
        studio.addEventListener("dragover",event=>{if([...(event.dataTransfer?.items||[])].some(item=>item.kind==="file")){event.preventDefault();event.dataTransfer.dropEffect="copy";event.target.closest(".slide-frame")?.classList.add("file-drop-target");}});
        studio.addEventListener("dragleave",event=>event.target.closest(".slide-frame")?.classList.remove("file-drop-target"));
        studio.addEventListener("drop",async event=>{const files=[...(event.dataTransfer?.files||[])];if(!files.length)return;event.preventDefault();document.querySelectorAll(".slide-frame.file-drop-target").forEach(frame=>frame.classList.remove("file-drop-target"));const target=event.target.closest(".slide-frame");if(target)selectStudioSlide(Number(target.dataset.slideIndex||0));for(const file of files)await addFileElement(studio.dataset.activityId,file);});
        studio.addEventListener("pointerdown", (event) => {
          if (event.target.closest(".slide-el,.studio-text-format")) return;
          document.querySelectorAll(".studio .slide-el.selected").forEach((item) => item.classList.remove("selected"));
          updateStudioTextToolbarVisibility();
        });
        studio.addEventListener("dblclick", (event) => {
          if (event.target.closest(".slide-el,button,input,select,label,a")) return;
          const slide = event.target.closest(".slide-frame");
          if (!slide) return;
          const point = studioPointOnSlide(event, slide);
          insertStudioText("", Number(slide.dataset.slideIndex || 0), point.x, point.y);
        });
        studio.addEventListener("paste", async (event) => {
          if (event.target.closest(".slide-text,input,textarea,[contenteditable=true]")) return;
          const slide = selectedSlide();
          if (!slide) return;
          const items = [...(event.clipboardData?.items || [])];
          const files = items.filter((item) => item.kind === "file").map((item) => item.getAsFile()).filter(Boolean);
          const text = event.clipboardData?.getData("text/plain") || "";
          if (!files.length && !text) return;
          event.preventDefault();
          const slideIndex = Number(slide.dataset.slideIndex || 0);
          if (files.length) {
            selectStudioSlide(slideIndex);
            for (const file of files) await addFileElement(studio.dataset.activityId, file);
          }
          else insertStudioText(text, slideIndex);
        });
        document.querySelectorAll(".studio .slide-text").forEach((text) => text.addEventListener("input", () => fitStudioText(text.closest(".slide-el"))));
        document.querySelectorAll(".studio .slide-el[data-kind='text']").forEach(fitStudioText);
      }

      function sanitizeRichText(html) {
        const template = document.createElement("template");
        template.innerHTML = String(html || "");
        const allowed = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SUB", "SUP", "SPAN", "BR", "DIV", "P", "UL", "OL", "LI"]);
        [...template.content.querySelectorAll("*")].forEach((node) => {
          if (!allowed.has(node.tagName)) node.replaceWith(...node.childNodes);
          else {
            const safeStyles = [];
            if (node.style.color) safeStyles.push(`color:${node.style.color}`);
            if (node.style.backgroundColor) safeStyles.push(`background-color:${node.style.backgroundColor}`);
            if (node.style.fontFamily) safeStyles.push(`font-family:${node.style.fontFamily}`);
            if (/^\d+(?:\.\d+)?px$/.test(node.style.fontSize)) safeStyles.push(`font-size:${node.style.fontSize}`);
            if (/^(left|right|center|justify)$/.test(node.style.textAlign)) safeStyles.push(`text-align:${node.style.textAlign}`);
            [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
            if (safeStyles.length) node.setAttribute("style", safeStyles.join(";"));
          }
        });
        return template.innerHTML;
      }

      function rememberStudioTextSelection() {
        const selection = window.getSelection();
        if (!selection?.rangeCount || selection.isCollapsed) return false;
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
        const text = container?.closest?.(".studio .slide-text");
        if (!text) return false;
        studioTextSelectionRange = range.cloneRange();
        document.querySelectorAll(".studio .slide-el").forEach(node=>node.classList.toggle("selected",node===text.closest(".slide-el")));
        return true;
      }

      function restoreStudioTextSelection() {
        if (!studioTextSelectionRange) return false;
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(studioTextSelectionRange);
        return true;
      }

      function updateStudioTextToolbarVisibility() {
        const toolbar = document.querySelector("#studioTextFormatToolbar");
        const generalActions = document.querySelector("#studioGeneralActions");
        if (!toolbar) return;
        rememberStudioTextSelection();
        const hasSelectedTextItem = Boolean(document.querySelector(".studio .slide-el.selected[data-kind='text']"));
        const usingToolbar = toolbar.contains(document.activeElement) || toolbar.matches(":hover");
        const showFormatting = hasSelectedTextItem || usingToolbar;
        toolbar.hidden = !showFormatting;
        if (generalActions) generalActions.hidden = showFormatting;
        if (!showFormatting) studioTextSelectionRange = null;
      }

      function initStudioTextToolbarVisibility() {
        studioTextSelectionRange = null;
        const toolbar = document.querySelector("#studioTextFormatToolbar");
        if (toolbar) toolbar.hidden = true;
        const generalActions = document.querySelector("#studioGeneralActions");
        if (generalActions) generalActions.hidden = false;
        if (studioTextSelectionListenerReady) return;
        studioTextSelectionListenerReady = true;
        document.addEventListener("selectionchange", updateStudioTextToolbarVisibility);
      }

      function formatStudioText(command, event, value = null) {
        event?.preventDefault();
        event?.stopPropagation();
        rememberStudioTextSelection();
        const text = document.querySelector(".studio .slide-el.selected .slide-text");
        if (!text) {
          toast("Sélectionnez d'abord une zone de texte.");
          return;
        }
        text.focus({ preventScroll: true });
        if (!restoreStudioTextSelection()) {
          const range = document.createRange();
          range.selectNodeContents(text);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          studioTextSelectionRange = range.cloneRange();
        }
        if (command === "foreColor" || command === "hiliteColor" || command.startsWith("justify")) document.execCommand("styleWithCSS", false, true);
        document.execCommand(command, false, value);
        rememberStudioTextSelection();
        fitStudioText(text.closest(".slide-el"));
      }

      function setStudioTextFont(fontFamily, event) {
        event?.stopPropagation();
        const node = document.querySelector(".studio .slide-el.selected[data-kind='text']");
        const text = node?.querySelector(".slide-text");
        if (!node || !text) return toast("Sélectionnez d'abord une zone de texte.");
        text.style.fontFamily = String(fontFamily || "Calibri");
        fitStudioText(node);
      }

      function setStudioTextSize(value, event) {
        event?.stopPropagation();
        const node = document.querySelector(".studio .slide-el.selected[data-kind='text']");
        const text = node?.querySelector(".slide-text");
        if (!node || !text) return toast("Sélectionnez d'abord une zone de texte.");
        const size = Math.max(8, Math.min(96, Number(value) || 32));
        if (applyStudioTextSelectionSize(text, size)) return;
        toast("Sélectionnez le texte dont vous voulez changer la taille.");
      }

      function resizeStudioText(delta, event) {
        event?.preventDefault();
        event?.stopPropagation();
        const node = document.querySelector(".studio .slide-el.selected[data-kind='text']");
        const text = node?.querySelector(".slide-text");
        if (!node || !text) return toast("Sélectionnez d'abord une zone de texte.");
        restoreStudioTextSelection();
        const selection = window.getSelection();
        const selectedNode = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
        const selectedElement = selectedNode?.nodeType === Node.ELEMENT_NODE ? selectedNode : selectedNode?.parentElement;
        const current = studioTextSelectionRange && !studioTextSelectionRange.collapsed
          ? parseFloat(getComputedStyle(selectedElement || text).fontSize) || 34
          : Number(node.dataset.maxFontSize || parseFloat(text.style.fontSize) || 34);
        const size = Math.max(8, Math.min(96, current + Number(delta || 0)));
        if (applyStudioTextSelectionSize(text, size)) return;
        toast("Sélectionnez le texte dont vous voulez changer la taille.");
      }

      function applyStudioTextSelectionSize(text, size) {
        if (!studioTextSelectionRange || studioTextSelectionRange.collapsed || !restoreStudioTextSelection()) return false;
        const range = window.getSelection().getRangeAt(0);
        if (!text.contains(range.commonAncestorContainer)) return false;
        const requestedSize = Math.max(8, Math.min(96, Number(size) || 32));
        const span = document.createElement("span");
        span.style.fontSize = `${requestedSize}px`;
        span.append(range.extractContents());
        range.insertNode(span);
        range.selectNodeContents(span);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        studioTextSelectionRange = range.cloneRange();
        text.normalize();
        let appliedSize = requestedSize;
        while (appliedSize > 8 && studioTextOverflows(text)) {
          appliedSize -= 1;
          span.style.fontSize = `${appliedSize}px`;
        }
        text.style.overflow = studioTextOverflows(text) ? "auto" : "hidden";
        if (appliedSize < requestedSize) {
          toast(`La taille ${requestedSize} px est trop grande pour cette zone de texte. Taille ${appliedSize} px appliquée à la place.`);
        }
        return true;
      }

      function studioTextOverflows(text) {
        return text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1;
      }

      function fitStudioText(node) {
        const text = node?.querySelector(".slide-text");
        if (!text) return;
        const maximum = Math.max(8, Number(node.dataset.maxFontSize || parseFloat(text.style.fontSize) || 34));
        let size = maximum;
        text.style.fontSize = `${size}px`;
        text.style.overflow = "hidden";
        while (size > 8 && (text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1)) {
          size -= 1;
          text.style.fontSize = `${size}px`;
        }
        const stillOverflows = text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1;
        text.style.overflow = size <= 8 && stillOverflows ? "auto" : "hidden";
      }

      function renderSlideTool(value, editable, elementId) {
        const [toolId, configuredValue] = String(value || "timer|5").split("|");
        if (toolId === "wheel") {
          const classes = state.studentClasses || [];
          const classe = classes.find((item) => item.id === configuredValue) || classes[0];
          if (!classe) return `<div class="slide-tool"><strong>Roue de la fortune</strong><p>Le groupe associé n'existe plus.</p></div>`;
          const history = state.tools.wheelHistory[classe.id] || [];
          const counts = wheelCountsForClass(classe.id);
          const absences = wheelAbsencesForClass(classe.id);
          const limit = wheelLimitForClass(classe.id);
          const students = classe.students || [];
          const available = students.filter((student) => !absences.includes(student) && Number(counts[student] || 0) < limit).length;
          return `<div class="slide-tool slide-wheel" onclick="event.stopPropagation()">
            <div class="slide-tool-head">
              <span class="slide-tool-kicker">Roue de la fortune</span>
              ${editable ? `<div class="slide-tool-settings">
                <label>Groupe <select onchange="configureSlideWheel(this,event)">${classes.map((item) => `<option value="${escapeAttr(item.id)}" ${item.id === classe.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}</select></label>
                <label>Maximum <input class="slide-wheel-limit" type="number" min="1" max="20" value="${limit}" onchange="configureSlideWheel(this,event)"></label>
              </div>` : `<strong class="slide-tool-class-name">${escapeHtml(classe.title)}</strong>`}
            </div>
            <div class="slide-wheel-visual"><strong id="slideToolResult-${escapeAttr(elementId)}" class="slide-tool-result">${escapeHtml(history[0]?.student || "Prêt ?")}</strong></div>
            <div class="slide-tool-summary"><span>${available} disponible(s)</span><span>${students.length - absences.length} présent(s)</span><span>max. ${limit}</span></div>
            ${editable ? `<div class="slide-student-list">${students.map((student, index) => {
              const absent = absences.includes(student);
              return `<button type="button" class="slide-student ${absent ? "absent" : ""}" onclick="toggleSlideWheelAbsence('${escapeAttr(elementId)}','${escapeAttr(classe.id)}',${index},event)"><span>${escapeHtml(student)}</span><small>${absent ? "Absent" : `${Number(counts[student] || 0)} / ${limit}`}</small></button>`;
            }).join("") || '<span class="muted small">Aucun élève.</span>'}</div>` : ""}
            <div class="slide-tool-buttons">
              <button class="btn primary" ${available ? "" : "disabled"} onclick="spinSlideWheel('${escapeAttr(classe.id)}','${escapeAttr(elementId)}',event)">Lancer</button>
              ${editable ? `<button class="btn" onclick="resetSlideWheelCounts('${escapeAttr(elementId)}','${escapeAttr(classe.id)}',event)">Compteurs à 0</button>` : ""}
            </div>
          </div>`;
        }
        const minutes = Math.max(1, Math.min(120, Number(configuredValue) || 5));
        return `<div class="slide-tool slide-timer" onclick="event.stopPropagation()">
          <div class="slide-tool-head"><span class="slide-tool-kicker">Chronomètre analogique / numérique</span></div>
          <div class="timer-face timer-face-small" role="timer" aria-label="Temps restant : ${minutes} minutes"><span class="timer-hand" aria-hidden="true"></span><div class="timer-face-inner"><strong class="embedded-timer-display">${formatTimer(minutes * 60)}</strong></div></div>
          <label class="slide-timer-setting">Minutes <input class="slide-timer-minutes" type="number" min="1" max="120" value="${minutes}" onchange="setSlideTimerMinutes(this.value,event)"></label>
          <div class="slide-tool-buttons">
            <button class="btn primary" onclick="startSlideTimer(this,event)">Démarrer</button>
            <button class="btn" onclick="event.stopPropagation();pauseClassTimer()">Pause</button>
            <button class="btn" onclick="resetSlideTimer(this,event)">Réinitialiser</button>
          </div>
        </div>`;
      }

      function refreshStudioTool(elementId) {
        const node = document.querySelector(`.studio .slide-el[data-el-id="${elementId}"]`);
        const content = node?.querySelector(".slide-element-content");
        if (content) content.innerHTML = renderSlideTool(node.dataset.value, true, elementId);
      }

      function configureSlideWheel(control, event) {
        event?.stopPropagation();
        const node = control.closest(".slide-el");
        if (!node) return;
        const classId = node.querySelector(".slide-tool-settings select")?.value || "";
        const limit = control.matches("select")
          ? wheelLimitForClass(classId)
          : Math.max(1, Math.min(20, Number(node.querySelector(".slide-wheel-limit")?.value) || 2));
        state.tools.wheelLimits[classId] = limit;
        node.dataset.value = `wheel|${classId}`;
        refreshStudioTool(node.dataset.elId);
      }

      function toggleSlideWheelAbsence(elementId, classId, studentIndex, event) {
        event?.stopPropagation();
        const classe = (state.studentClasses || []).find((item) => item.id === classId);
        const student = classe?.students?.[studentIndex];
        if (!student) return;
        const absences = wheelAbsencesForClass(classId);
        const index = absences.indexOf(student);
        if (index >= 0) absences.splice(index, 1);
        else absences.push(student);
        refreshStudioTool(elementId);
      }

      function resetSlideWheelCounts(elementId, classId, event) {
        event?.stopPropagation();
        state.tools.wheelCounts[classId] = {};
        refreshStudioTool(elementId);
      }

      async function spinSlideWheel(classId, elementId, event) {
        event?.stopPropagation();
        if (!requireLogin()) return;
        const classe = (state.studentClasses || []).find((item) => item.id === classId);
        const students = classe?.students || [];
        const limit = wheelLimitForClass(classId);
        const counts = wheelCountsForClass(classId);
        const absences = wheelAbsencesForClass(classId);
        const availableStudents = students.filter((student) => !absences.includes(student) && Number(counts[student] || 0) < limit);
        if (!availableStudents.length) return toast("Aucun élève disponible pour cette roue.");
        const resultNode = document.getElementById(`slideToolResult-${elementId}`);
        const studioToolNode = resultNode?.closest(".studio .slide-el");
        resultNode?.closest(".slide-wheel")?.classList.add("spinning");
        const student = availableStudents[Math.floor(Math.random() * availableStudents.length)];
        await new Promise((resolve) => setTimeout(resolve, 450));
        counts[student] = Number(counts[student] || 0) + 1;
        state.tools.wheelHistory[classId] = state.tools.wheelHistory[classId] || [];
        state.tools.wheelHistory[classId].unshift({ student, count: counts[student], limit, date: new Date().toISOString() });
        state.tools.wheelHistory[classId] = state.tools.wheelHistory[classId].slice(0, 100);
        if (resultNode) resultNode.textContent = student;
        const board = document.querySelector("#boardPage");
        const activityId = board?.dataset.activityId;
        const slideIndex = Number(board?.dataset.slideIndex || 0);
        const saved = await saveData();
        if (saved && activityId) showBoard(activityId, slideIndex);
        else if (saved && studioToolNode?.isConnected) refreshStudioTool(elementId);
        toast(`${student} est tombé.`);
      }

      function setSlideTimerMinutes(value, event) {
        event?.stopPropagation();
        const minutes = Math.max(1, Math.min(120, Number(value) || 5));
        const node = event?.target?.closest(".slide-el");
        if (node) node.dataset.value = `timer|${minutes}`;
        timerTotal = minutes * 60;
        timerRemaining = timerTotal;
        pauseClassTimer();
        updateTimerDisplay();
      }

      function startSlideTimer(button, event) {
        event?.stopPropagation();
        const value = button?.closest(".slide-timer")?.querySelector(".slide-timer-minutes")?.value || 5;
        setSlideTimerMinutes(value, event);
        startClassTimer();
      }

      function resetSlideTimer(button, event) {
        event?.stopPropagation();
        const value = button?.closest(".slide-timer")?.querySelector(".slide-timer-minutes")?.value;
        setSlideTimerMinutes(value || 5, event);
      }

      async function reportMediaError(video) {
        if (video?.dataset.conversionAttempted === "true") return;
        const fileId = /^\/api\/v1\/files\/([^/]+)\/content/i.exec(video?.getAttribute("src") || "")?.[1];
        if (fileId && window.ServerAPI?.convertVideo && !isLocalFileMode() && !freeExampleOpen) {
          video.dataset.conversionAttempted = "true";
          const progress = "Conversion de la vidéo en MP4 compatible…";
          const status = document.querySelector("#studioSaveStatus");
          if (status) { status.textContent = progress; status.className = "studio-save-status pending"; status.hidden = false; }
          toast(progress);
          try {
            const converted = await window.ServerAPI.convertVideo(fileId);
            video.src = `${converted.content_url}?converted=${Date.now()}`;
            video.load();
            if (status) { status.textContent = "Vidéo convertie et prête à être lue."; status.className = "studio-save-status success"; }
            toast("Vidéo convertie en MP4 compatible.");
            return;
          } catch (error) {
            console.warn("Conversion vidéo impossible", error);
          }
        }
        const message = freeExampleOpen
          ? "La démo locale ne peut pas convertir cette vidéo. Dans l’espace connecté, ce format sera converti automatiquement en MP4 compatible."
          : "Cette vidéo ne peut pas être lue ni convertie automatiquement. Essayez de l’ajouter de nouveau.";
        const status = document.querySelector("#studioSaveStatus");
        if (status) {
          status.textContent = message;
          status.className = "studio-save-status error";
          status.hidden = false;
        }
        toast(message);
      }

      function selectedSlide() {
        return document.querySelector(`.slide-frame[data-slide-index="${currentStudioSlideIndex}"]`) || document.querySelector(".slide-frame");
      }

      function selectStudioSlide(index) {
        currentStudioSlideIndex = Number(index || 0);
        document.querySelectorAll(".slide-frame").forEach((frame) => frame.classList.toggle("current", Number(frame.dataset.slideIndex) === currentStudioSlideIndex));
        document.querySelectorAll(".slide-thumbnail").forEach((node) => node.classList.toggle("current", Number(node.dataset.index) === currentStudioSlideIndex));
      }

      async function renameStudioSlideInstruction(activityId) {
        const activity = findItem("activity", activityId);
        if (!activity) return;
        activity.slides = captureStudioSlides(activityId);
        const index = Math.max(0, Math.min(currentStudioSlideIndex, activity.slides.length - 1));
        const slide = activity.slides[index];
        const instruction = prompt("Consigne de cette diapo", slide.instruction || slideInstruction(slide, index));
        if (instruction === null) return;
        slide.instruction = instruction.trim();
        if (!await saveData("Consigne de la diapo enregistrée.")) return;
        openActivityStudio(activityId);
        currentStudioSlideIndex = index;
        selectStudioSlide(index);
      }

      function addSlide(activityId) {
        const activity = findItem("activity", activityId);
        recordStudioHistory(activityId);
        activity.slides = captureStudioSlides(activityId);
        activity.slides.push({ id: uid("slide"), duration: "5 min", instruction: "", elements: [] });
        openActivityStudio(activityId);
        currentStudioSlideIndex = activity.slides.length - 1;
        selectStudioSlide(currentStudioSlideIndex);
      }

      function addTextElement(activityId) {
        const slide = selectedSlide();
        if (!slide) return;
        insertStudioText("", Number(slide.dataset.slideIndex || 0));
      }

      function addUrlElement(activityId) {
        const url = prompt("Collez une URL à afficher");
        if (!url) return;
        const kind = kindFromUrl(url);
        recordStudioHistory(activityId);
        const slide = selectedSlide();
        document.querySelector("#slideStrip").insertAdjacentHTML("beforeend", renderStudioElement({ id: uid("el"), kind, x: 100, y: 90, w: 520, h: 300, value: url }, Number(slide.dataset.slideIndex || 0)));
        initStudioDrag();
      }

      function addToolElement(activityId, toolId = "timer") {
        toolId = toolId === "wheel" ? "wheel" : "timer";
        const classId = document.querySelector("#studioToolClass")?.value || "";
        if (toolId === "wheel" && !classId) {
          toast("Ajoutez d'abord un groupe dans Groupes Classes pour utiliser la roue.");
          return;
        }
        const slide = selectedSlide();
        if (!slide) return;
        recordStudioHistory(activityId);
        const slideIndex = Number(slide.dataset.slideIndex || 0);
        const slideTop = slideIndex * (slideSize.height + slideSize.gap);
        const toolCount = [...document.querySelectorAll('.slide-el[data-kind="tool"]')].filter((node) => {
          const top = parseFloat(node.style.top) || 0;
          return top >= slideTop && top < slideTop + slideSize.height;
        }).length;
        const value = toolId === "wheel" ? `${toolId}|${classId}` : "timer|5";
        const x = toolCount % 2 === 0 ? 40 : 500;
        document.querySelector("#slideStrip").insertAdjacentHTML("beforeend", renderStudioElement({
          id: uid("el"), kind: "tool", x, y: 60, w: 420, h: 420, value
        }, slideIndex));
        initStudioDrag();
        toast(`${slideTools[toolId]?.title || "Outil"} ajouté à la diapo.`);
      }

      async function previewStudioActivity(activityId, triggerButton) {
        if (await saveStudio(activityId, false, triggerButton, false)) openActivityPrintPreview(activityId);
      }

      function pptxNodeNumber(node, localName, attribute) {
        const target = [...node.getElementsByTagNameNS("*", localName)][0];
        return Number(target?.getAttribute(attribute) || 0);
      }

      function pptxShapeBounds(node, scaleX, scaleY) {
        const transform = [...node.getElementsByTagNameNS("*", "xfrm")][0];
        if (!transform) return { x: 40, y: 40, w: 400, h: 120 };
        return {
          x: Math.round(pptxNodeNumber(transform, "off", "x") * scaleX),
          y: Math.round(pptxNodeNumber(transform, "off", "y") * scaleY),
          w: Math.max(20, Math.round(pptxNodeNumber(transform, "ext", "cx") * scaleX)),
          h: Math.max(20, Math.round(pptxNodeNumber(transform, "ext", "cy") * scaleY))
        };
      }

      function paginateImportedElements(elements) {
        const pages = [[]];
        const add = (pageIndex, element) => {
          while (!pages[pageIndex]) pages.push([]);
          pages[pageIndex].push({ id: uid("el"), ...element });
        };
        elements.forEach((element) => {
          const basePage = Math.max(0, Math.floor(Number(element.y || 0) / slideSize.height));
          const localY = Math.max(0, Number(element.y || 0) % slideSize.height);
          if (element.kind !== "text") {
            add(basePage, { ...element, y: localY, h: Math.min(Number(element.h || 160), slideSize.height - localY) });
            return;
          }
          const fontSize = Math.max(12, Number(element.fontSize || 28));
          const lineHeight = Math.ceil(fontSize * 1.25);
          const sourceLines = String(element.value || "").split(/\r?\n/);
          const charactersPerLine = Math.max(8, Math.floor(Number(element.w || 320) / (fontSize * 0.55)));
          const visualLines = sourceLines.flatMap((line) => {
            if (!line) return [""];
            const chunks = [];
            for (let cursor = 0; cursor < line.length; cursor += charactersPerLine) chunks.push(line.slice(cursor, cursor + charactersPerLine));
            return chunks;
          });
          let pageIndex = basePage;
          let y = localY;
          let cursor = 0;
          while (cursor < visualLines.length || (cursor === 0 && !visualLines.length)) {
            const availableLines = Math.max(1, Math.floor((slideSize.height - y - 18) / lineHeight));
            const chunk = visualLines.slice(cursor, cursor + availableLines);
            add(pageIndex, { ...element, y, h: Math.max(lineHeight, chunk.length * lineHeight + 8), value: chunk.join("\n") });
            cursor += Math.max(1, chunk.length);
            pageIndex += 1;
            y = 24;
          }
        });
        return pages.filter((page) => page.length);
      }

      async function pptxRelationshipMap(arrayBuffer, slideName) {
        const fileName = slideName.split("/").pop();
        try {
          const bytes = await extractZipEntry(arrayBuffer, `ppt/slides/_rels/${fileName}.rels`);
          const xml = new DOMParser().parseFromString(new TextDecoder("utf-8").decode(bytes), "application/xml");
          return new Map([...xml.getElementsByTagNameNS("*", "Relationship")]
            .map((node) => [node.getAttribute("Id"), node.getAttribute("Target") || ""]));
        } catch {
          return new Map();
        }
      }

      async function pptxImportedMedia(arrayBuffer, slideName, target) {
        const normalized = normalizeZipPath(`ppt/slides/${target}`);
        const bytes = await extractZipEntry(arrayBuffer, normalized);
        const extension = (normalized.split(".").pop() || "png").toLowerCase();
        const mimeTypes = {
          jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
          mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
          mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg"
        };
        const mimeType = mimeTypes[extension] || "application/octet-stream";
        if (usesServerStorage()) {
          const upload = new File([bytes], `media-importe.${extension}`, { type: mimeType });
          return (await window.ServerAPI.upload(upload)).content_url;
        }
        return bytesToDataUrl(bytes, mimeType);
      }

      function pptxMediaContainer(node) {
        let current = node;
        while (current && !["pic", "sp"].includes(current.localName)) current = current.parentElement;
        return current;
      }

      async function importPptxAsSiteSlides(file) {
        const arrayBuffer = await file.arrayBuffer();
        const presentationBytes = await extractZipEntry(arrayBuffer, "ppt/presentation.xml");
        const presentationXml = new DOMParser().parseFromString(new TextDecoder("utf-8").decode(presentationBytes), "application/xml");
        const slideSizeNode = [...presentationXml.getElementsByTagNameNS("*", "sldSz")][0];
        const sourceWidth = Number(slideSizeNode?.getAttribute("cx") || 12192000);
        const sourceHeight = Number(slideSizeNode?.getAttribute("cy") || 6858000);
        const scaleX = slideSize.width / sourceWidth;
        const scaleY = slideSize.height / sourceHeight;
        const slideNames = listZipEntryNames(arrayBuffer)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
          .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
        if (!slideNames.length) throw new Error("ce PowerPoint ne contient aucune diapositive");
        const imported = [];
        for (const slideName of slideNames) {
          const bytes = await extractZipEntry(arrayBuffer, slideName);
          const xml = new DOMParser().parseFromString(new TextDecoder("utf-8").decode(bytes), "application/xml");
          if (xml.querySelector("parsererror")) throw new Error("une diapositive PowerPoint est invalide");
          const relations = await pptxRelationshipMap(arrayBuffer, slideName);
          const elements = [];
          for (const shape of [...xml.getElementsByTagNameNS("*", "sp")]) {
            const value = [...shape.getElementsByTagNameNS("*", "p")]
              .map((paragraph) => [...paragraph.getElementsByTagNameNS("*", "t")].map((node) => node.textContent || "").join(""))
              .filter(Boolean)
              .join("\n");
            if (!value) continue;
            const runProperties = [...shape.getElementsByTagNameNS("*", "rPr"), ...shape.getElementsByTagNameNS("*", "defRPr")][0];
            const fontSize = Math.max(12, Math.round(Number(runProperties?.getAttribute("sz") || 2800) / 100));
            elements.push({ kind: "text", ...pptxShapeBounds(shape, scaleX, scaleY), value, fontSize });
          }
          const mediaContainers = new Set();
          for (const mediaNode of [...xml.getElementsByTagNameNS("*", "videoFile"), ...xml.getElementsByTagNameNS("*", "audioFile")]) {
            const relationId = mediaNode.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "link")
              || mediaNode.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
            const target = relations.get(relationId);
            const container = pptxMediaContainer(mediaNode);
            if (!target || !container) continue;
            mediaContainers.add(container);
            elements.push({
              kind: mediaNode.localName === "videoFile" ? "video" : "audio",
              ...pptxShapeBounds(container, scaleX, scaleY),
              value: await pptxImportedMedia(arrayBuffer, slideName, target)
            });
          }
          for (const picture of [...xml.getElementsByTagNameNS("*", "pic")]) {
            if (mediaContainers.has(picture)) continue;
            const blip = [...picture.getElementsByTagNameNS("*", "blip")][0];
            const relationId = blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
            const target = relations.get(relationId);
            if (!target || !/\.(png|jpe?g|gif|webp)$/i.test(target)) continue;
            elements.push({ kind: "image", ...pptxShapeBounds(picture, scaleX, scaleY), value: await pptxImportedMedia(arrayBuffer, slideName, target) });
          }
          paginateImportedElements(elements).forEach((page) => imported.push({ id: uid("slide"), elements: page }));
        }
        return imported;
      }

      function officeExtensionFromArrayBuffer(arrayBuffer) {
        try {
          const names = listZipEntryNames(arrayBuffer);
          if (names.includes("ppt/presentation.xml")) return "pptx";
          if (names.includes("word/document.xml")) return "docx";
        } catch {
          // Ce n’est pas une archive Office lisible.
        }
        return "";
      }

      async function convertFreePptxDocuments() {
        for (const classe of state.classes || []) for (const sequence of classe.sequences || []) {
          for (const lesson of sequence.lessons || []) for (const activity of lesson.activities || []) {
            const convertedSlides = [];
            for (const slide of activity.slides || []) {
              const officeElements = (slide.elements || []).filter((element) =>
                element.kind === "document" && /\.pptx(?:\?|#|$)/i.test(element.value || "")
              );
              if (!officeElements.length) {
                convertedSlides.push(slide);
                continue;
              }
              const otherElements = (slide.elements || []).filter((element) => !officeElements.includes(element));
              let firstImported = true;
              for (const element of officeElements) {
                try {
                  const response = await fetch(element.value, { cache: "force-cache" });
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  const fileName = decodeURIComponent(new URL(element.value, window.location.href).pathname.split("/").pop());
                  const file = new File([await response.arrayBuffer()], fileName);
                  const imported = await importPptxAsSiteSlides(file);
                  if (!imported.length) throw new Error("format non convertible");
                  if (firstImported) imported[0].elements.unshift(...otherElements);
                  convertedSlides.push(...imported);
                  firstImported = false;
                } catch (error) {
                  console.warn("Document de l’exemple non convertible", element.value, error);
                  convertedSlides.push({ id: uid("slide"), elements: [element] });
                }
              }
            }
            activity.slides = convertedSlides;
          }
        }
      }

      async function addFileElement(activityId, file) {
        if (!file) return;
        const finishUploadLock = beginSaveLock(null);
        try {
          if (/\.pptx$/i.test(file.name || "") || file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
            recordStudioHistory(activityId);
            if (!await saveStudio(activityId, false, null, false)) return;
            const activity = findItem("activity", activityId);
            const importedSlides = await importPptxAsSiteSlides(file);
            const onlyBlankSlide = activity.slides.length === 1 && !(activity.slides[0]?.elements || []).length;
            activity.slides = onlyBlankSlide ? importedSlides : [...activity.slides, ...importedSlides];
            activity.updatedAt = new Date().toISOString();
            await saveData(`${importedSlides.length} diapositive(s) importée(s).`);
            openActivityStudio(activityId);
            currentStudioSlideIndex = onlyBlankSlide ? 0 : activity.slides.length - importedSlides.length;
            selectStudioSlide(currentStudioSlideIndex);
            toast(`${importedSlides.length} diapositive(s) du document convertie(s) en diapos du site.`);
            return;
          }
          const uploaded = isLocalFileMode() || freeExampleOpen
            ? { mime_type: file.type || "", content_url: await readFileAsDataUrl(file) }
            : await window.ServerAPI.upload(file);
          const mimeType = uploaded.mime_type || file.type || "";
          const extensionKind = kindFromUrl(file.name || "");
          const kind = mimeType.startsWith("image/") ? "image"
            : mimeType.startsWith("audio/") ? "audio"
            : mimeType.startsWith("video/") ? "video"
            : mimeType === "application/pdf" ? "pdf"
            : extensionKind === "embed" ? "document" : extensionKind;
          recordStudioHistory(activityId);
          const slide = selectedSlide();
          document.querySelector("#slideStrip").insertAdjacentHTML("beforeend", renderStudioElement({ id: uid("el"), kind, x: 100, y: 90, w: 520, h: 300, value: uploaded.content_url }, Number(slide.dataset.slideIndex || 0)));
          initStudioDrag();
          const status = document.querySelector("#studioSaveStatus");
          if (status) {
            status.textContent = isLocalFileMode()
              ? "Fichier ajouté localement. Cliquez sur Enregistrer pour valider la présentation."
              : "Fichier envoyé au NAS. Cliquez sur Enregistrer pour valider la présentation.";
            status.className = "studio-save-status pending";
            status.hidden = false;
          }
          toast(isLocalFileMode() ? "Fichier ajouté. Enregistrez maintenant la présentation." : kind === "video" ? "Vidéo prête dans un format compatible. Enregistrez maintenant la présentation." : "Fichier envoyé. Enregistrez maintenant la présentation.");
        } catch (error) {
          toast(`Envoi du fichier impossible : ${error.message || "erreur serveur"}.`);
        } finally {
          finishUploadLock();
        }
      }

      async function renameActivity(activityId) {
        const activity = findItem("activity", activityId);
        const title = prompt("Titre de l’activité", activity.title);
        if (!title) return;
        activity.title = title.trim();
        activity.slug = slugify(activity.title);
        activity.updatedAt = new Date().toISOString();
        if (await saveData("Titre enregistré sur le serveur.")) openActivityStudio(activityId);
      }

      async function saveStudio(activityId, close = false, triggerButton = null, refreshStudio = true, successMessage = "Activité enregistrée sur le serveur.") {
        const selectedIndex = currentStudioSlideIndex;
        const pageScroll = { x: window.scrollX, y: window.scrollY };
        const studioScroll = document.querySelector(".studio")?.scrollTop || 0;
        const stripScroll = document.querySelector(".slide-thumbnails")?.scrollTop || 0;
        const activity = findItem("activity", activityId);
        const previousSlides = activity.slides || [];
        activity.slides = Array.from(document.querySelectorAll(".slide-frame")).map((slide) => ({
          id: slide.dataset.slideId || uid("slide"),
          duration: previousSlides.find(item=>item.id===slide.dataset.slideId)?.duration || "5 min",
          instruction: previousSlides.find(item=>item.id===slide.dataset.slideId)?.instruction || "",
          elements: []
        }));
        Array.from(document.querySelectorAll(".slide-el")).map(readSlideElement).forEach((element) => {
          const slide = activity.slides[element.slideIndex] || activity.slides[0];
          slide.elements.push(element);
          delete element.slideIndex;
        });
        deduplicateSlideElements(activity.slides);
        activity.updatedAt = new Date().toISOString();
        const saved = await saveData(successMessage, triggerButton);
        if (saved && close) {
          closeEditor();
          render();
        }
        if (saved && !close && refreshStudio) {
          openActivityStudio(activityId);
          const refreshedActivity = findItem("activity", activityId);
          currentStudioSlideIndex = Math.min(selectedIndex, Math.max(0, (refreshedActivity?.slides?.length || 1) - 1));
          selectStudioSlide(currentStudioSlideIndex);
          requestAnimationFrame(() => {
            window.scrollTo(pageScroll.x, pageScroll.y);
            const studio = document.querySelector(".studio");
            const thumbnails = document.querySelector(".slide-thumbnails");
            if (studio) studio.scrollTop = studioScroll;
            if (thumbnails) thumbnails.scrollTop = stripScroll;
            document.querySelector(`.slide-frame[data-slide-index="${currentStudioSlideIndex}"]`)?.scrollIntoView({ block: "nearest" });
          });
          const status = document.querySelector("#studioSaveStatus");
          if (status) {
            status.textContent = "Activité enregistrée sur le serveur.";
            status.className = "studio-save-status success";
            status.hidden = false;
          }
        }
        if (!saved) {
          const status = document.querySelector("#studioSaveStatus");
          if (status) {
            status.textContent = "Échec de l'enregistrement. Les modifications n'ont pas été appliquées.";
            status.className = "studio-save-status error";
            status.hidden = false;
          }
        }
        return saved;
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
          html: kind === "text" ? sanitizeRichText(textNode?.innerHTML || "") : undefined,
          fontSize: kind === "text" ? parseFloat(textNode?.style.fontSize || "34") || 34 : undefined,
          fontFamily: kind === "text" ? textNode?.style.fontFamily || "Calibri, Arial, sans-serif" : undefined,
          slideIndex
        };
      }

      function initResponsiveSlideTool(node) {
        if (!node || node.dataset.kind !== "tool" || node.dataset.toolResizeReady === "true") return;
        node.dataset.toolResizeReady = "true";
        const update = () => {
          const width = node.clientWidth;
          const height = node.clientHeight;
          node.classList.toggle("tool-compact", width < 350 || height < 350);
          node.classList.toggle("tool-tiny", width < 250 || height < 250);
        };
        update();
        if (window.ResizeObserver) new ResizeObserver(update).observe(node);
      }

      function initStudioDrag() {
        document.querySelectorAll(".slide-el").forEach((node) => {
          initResponsiveSlideTool(node);
          if (node.dataset.interactionsReady === "true") return;
          node.dataset.interactionsReady = "true";
          node.tabIndex = 0;
          const editableText = node.querySelector(".slide-text");
          editableText?.addEventListener("input", () => fitStudioText(node));
          const select = () => {
            document.querySelectorAll(".slide-el").forEach((item) => item.classList.remove("selected"));
            node.classList.add("selected");
            const slideStep = slideSize.height + slideSize.gap;
            const elementTop = parseFloat(node.style.top) || 0;
            selectStudioSlide(Math.max(0, Math.floor(elementTop / slideStep)));
            updateStudioTextToolbarVisibility();
          };
          node.addEventListener("pointerdown", (event) => {
            select();
            const handle = event.target.closest(".slide-move-handle, .slide-resize-handle");
            if (!handle) return;
            event.preventDefault();
            event.stopPropagation();
            recordStudioHistory(document.querySelector(".studio")?.dataset.activityId);
            const startX = event.clientX;
            const startY = event.clientY;
            const left = parseFloat(node.style.left) || 0;
            const top = parseFloat(node.style.top) || 0;
            const width = node.offsetWidth;
            const height = node.offsetHeight;
            const slideStep = slideSize.height + slideSize.gap;
            const slideCount = document.querySelectorAll(".slide-frame").length;
            const slideIndex = Math.max(0, Math.min(document.querySelectorAll(".slide-frame").length - 1, Math.floor((top + height / 2) / slideStep)));
            const slideTop = slideIndex * slideStep;
            const direction = handle.dataset.resize || "";
            const moving = handle.classList.contains("slide-move-handle");
            const minimumWidth = 60;
            const minimumHeight = 40;
            node.classList.add(moving ? "dragging" : "resizing");
            handle.setPointerCapture(event.pointerId);
            const showSize = () => {
              const indicator = node.querySelector(".slide-size-indicator");
              if (indicator) indicator.textContent = `${Math.round(node.offsetWidth)} × ${Math.round(node.offsetHeight)}`;
            };
            const onMove = (move) => {
              const dx = move.clientX - startX;
              const dy = move.clientY - startY;
              if (moving) {
                node.style.left = `${Math.min(slideSize.width - width, Math.max(0, left + dx))}px`;
                node.style.top = `${Math.min((slideCount - 1) * slideStep + slideSize.height - height, Math.max(0, top + dy))}px`;
                const destination = Math.max(0, Math.min(slideCount - 1, Math.floor(((parseFloat(node.style.top) || 0) + height / 2) / slideStep)));
                document.querySelectorAll(".slide-frame").forEach(frame=>frame.classList.toggle("drop-target",Number(frame.dataset.slideIndex)===destination));
                return;
              }
              let nextLeft = left;
              let nextTop = top;
              let nextWidth = width;
              let nextHeight = height;
              if (direction.includes("e")) nextWidth = Math.min(slideSize.width - left, Math.max(minimumWidth, width + dx));
              if (direction.includes("s")) nextHeight = Math.min(slideTop + slideSize.height - top, Math.max(minimumHeight, height + dy));
              if (direction.includes("w")) {
                nextLeft = Math.min(left + width - minimumWidth, Math.max(0, left + dx));
                nextWidth = width + left - nextLeft;
              }
              if (direction.includes("n")) {
                nextTop = Math.min(top + height - minimumHeight, Math.max(slideTop, top + dy));
                nextHeight = height + top - nextTop;
              }
              node.style.left = `${nextLeft}px`;
              node.style.top = `${nextTop}px`;
              node.style.width = `${nextWidth}px`;
              node.style.height = `${nextHeight}px`;
              fitStudioText(node);
              showSize();
            };
            const finish = () => {
              if (moving) {
                const rawTop = parseFloat(node.style.top) || 0;
                const destination = Math.max(0, Math.min(slideCount - 1, Math.floor((rawTop + height / 2) / slideStep)));
                const destinationTop = destination * slideStep;
                node.style.top = `${Math.min(destinationTop + slideSize.height - height, Math.max(destinationTop, rawTop))}px`;
                selectStudioSlide(destination);
                document.querySelectorAll(".slide-frame").forEach(frame=>frame.classList.remove("drop-target"));
              }
              node.classList.remove("dragging", "resizing");
              fitStudioText(node);
              handle.removeEventListener("pointermove", onMove);
              handle.removeEventListener("pointerup", finish);
              handle.removeEventListener("pointercancel", finish);
            };
            handle.addEventListener("pointermove", onMove);
            handle.addEventListener("pointerup", finish);
            handle.addEventListener("pointercancel", finish);
          });
          node.addEventListener("keydown", (event) => {
            if (!node.classList.contains("selected") || event.target.closest("input,select,[contenteditable=true]")) return;
            if (event.key === "Delete" || event.key === "Backspace") {
              event.preventDefault();
              recordStudioHistory(document.querySelector(".studio")?.dataset.activityId);
              node.remove();
              return;
            }
            const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            if (!directions[event.key]) return;
            event.preventDefault();
            const amount = event.shiftKey ? 10 : 1;
            const [dx, dy] = directions[event.key];
            const slideStep = slideSize.height + slideSize.gap;
            const top = parseFloat(node.style.top) || 0;
            const slideIndex = Math.floor((top + node.offsetHeight / 2) / slideStep);
            const slideTop = slideIndex * slideStep;
            node.style.left = `${Math.min(slideSize.width - node.offsetWidth, Math.max(0, (parseFloat(node.style.left) || 0) + dx * amount))}px`;
            node.style.top = `${Math.min(slideTop + slideSize.height - node.offsetHeight, Math.max(slideTop, top + dy * amount))}px`;
          });
        });
      }

      async function deleteSelectedElement() {
        const selected = document.querySelector(".slide-el.selected");
        const activityId = document.querySelector(".studio")?.dataset.activityId;
        if (!selected || !activityId) return;
        recordStudioHistory(activityId);
        selected.remove();
        await saveStudio(activityId, false, null, true, "Objet supprimé et enregistré.");
      }

      async function deleteStudioElement(button, event) {
        event?.preventDefault();
        event?.stopPropagation();
        const activityId = document.querySelector(".studio")?.dataset.activityId;
        if (!activityId) return;
        recordStudioHistory(activityId);
        button.closest(".slide-el")?.remove();
        await saveStudio(activityId, false, null, true, "Objet supprimé et enregistré.");
      }

      async function saveEditor(event, type, id) {
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
        const saved = await saveData("Enregistré sur le serveur.", event.submitter);
        if (saved) {
          closeEditor();
          render();
        }
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
        return { class: "Classe", studentClass: "Groupes Classes", sequence: "Séquence", lesson: "Séance", activity: "Activités", resource: "Ressource" }[type] || type;
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
        document.querySelector("#boardPage").dataset.activityId = activity.id;
        document.querySelector("#boardPage").dataset.slideIndex = String(index);
        document.querySelector("#boardPage").innerHTML = `
          <main class="board-wrap">
            ${activityLocationBreadcrumb(result, "board-location")}
            <section class="board-slide-stage">
              <div class="board-slide-inner" style="transform:scale(var(--board-scale,1))">
                <div class="board-slide-instruction" role="heading" aria-level="1">${escapeHtml(slideInstruction(slides[index],index))}</div>
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
        updateTimerDisplay();
        hydrateDocumentPreviews();
      }

      async function hydrateDocumentPreviews() {
        const previews = [...document.querySelectorAll("[data-document-preview]:not([data-preview-loaded])")];
        await Promise.all(previews.map(async (preview) => {
          preview.dataset.previewLoaded = "true";
          const status = preview.querySelector(".document-preview-status");
          const content = preview.querySelector(".document-preview-content");
          const fallback = preview.querySelector(".document-preview-fallback");
          try {
            const response = await fetch(preview.dataset.documentPreview, { credentials: "include" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            content.innerHTML = await officeDocumentToHtml(await response.arrayBuffer());
            preview.classList.add("loaded");
            status.hidden = true;
          } catch (error) {
            console.warn("Aperçu du document indisponible", error);
            status.hidden = true;
            fallback.hidden = false;
          }
        }));
      }

      function docxXmlToHtml(xmlText) {
        const xml = new DOMParser().parseFromString(xmlText, "application/xml");
        if (xml.querySelector("parsererror")) throw new Error("document Word invalide");
        const paragraphs = [...xml.getElementsByTagNameNS("*", "p")];
        const html = paragraphs.map((paragraph) => {
          const parts = [];
          [...paragraph.querySelectorAll("*")].filter((node) => ["t", "tab", "br"].includes(node.localName)).forEach((node) => {
            if (node.localName === "tab") parts.push("&emsp;");
            else if (node.localName === "br") parts.push("<br>");
            else parts.push(escapeHtml(node.textContent || ""));
          });
          return `<p>${parts.join("") || "&nbsp;"}</p>`;
        }).join("");
        return html || "<p>Ce document ne contient aucun texte affichable.</p>";
      }

      async function officeDocumentToHtml(arrayBuffer) {
        try {
          const contentXml = await extractZipEntry(arrayBuffer, "content.xml");
          const xml = new DOMParser().parseFromString(new TextDecoder("utf-8").decode(contentXml), "application/xml");
          if (xml.querySelector("parsererror")) throw new Error("document LibreOffice invalide");
          const blocks = [...xml.querySelectorAll("text\\:h, text\\:p, h, p")];
          const html = blocks.slice(0, 1000).map((block) => {
            const text = escapeHtml(block.textContent || "");
            return block.localName === "h" ? `<h3>${text || "&nbsp;"}</h3>` : `<p>${text || "&nbsp;"}</p>`;
          }).join("");
          return html || "<p>Ce document LibreOffice ne contient aucun texte affichable.</p>";
        } catch {}
        try {
          const documentXml = await extractZipEntry(arrayBuffer, "word/document.xml");
          return docxXmlToHtml(new TextDecoder("utf-8").decode(documentXml));
        } catch {}
        try {
          const worksheetNames = listZipEntryNames(arrayBuffer).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort();
          if (worksheetNames.length) {
            let shared=[];
            try { const bytes=await extractZipEntry(arrayBuffer,"xl/sharedStrings.xml"), xml=new DOMParser().parseFromString(new TextDecoder("utf-8").decode(bytes),"application/xml"); shared=[...xml.getElementsByTagNameNS("*","si")].map(node=>[...node.getElementsByTagNameNS("*","t")].map(text=>text.textContent||"").join("")); } catch {}
            const sheets=await Promise.all(worksheetNames.map(async(name,index)=>{ const bytes=await extractZipEntry(arrayBuffer,name), xml=new DOMParser().parseFromString(new TextDecoder("utf-8").decode(bytes),"application/xml"); const rows=[...xml.getElementsByTagNameNS("*","row")].slice(0,100).map(row=>`<tr>${[...row.getElementsByTagNameNS("*","c")].map(cell=>{ const value=cell.getElementsByTagNameNS("*","v")[0]?.textContent||""; return `<td>${escapeHtml(cell.getAttribute("t")==="s" ? shared[Number(value)]||"" : value)}</td>`; }).join("")}</tr>`).join(""); return `<section class="sheet-preview"><strong>Feuille ${index+1}</strong><table>${rows}</table></section>`; }));
            return sheets.join("");
          }
        } catch {}
        try {
          const slideNames = listZipEntryNames(arrayBuffer)
            .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
            .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
          if (!slideNames.length) throw new Error("format Office non prévisualisable");
          const slides = await Promise.all(slideNames.map(async (name, index) => {
            const bytes = await extractZipEntry(arrayBuffer, name);
            const xml = new DOMParser().parseFromString(new TextDecoder("utf-8").decode(bytes), "application/xml");
            if (xml.querySelector("parsererror")) throw new Error("diapositive PowerPoint invalide");
            const text = [...xml.getElementsByTagNameNS("*", "t")].map((node) => node.textContent || "").filter(Boolean);
            const images = await pptxSlidePreviewImages(arrayBuffer, name, xml);
            return `<section class="pptx-preview-slide" data-pptx-slide="${index}" ${index ? "hidden" : ""}><strong>Diapositive ${index + 1}</strong>${images.map((src) => `<img class="pptx-preview-image" src="${src}" alt="">`).join("")}${text.map((value) => `<p>${escapeHtml(value)}</p>`).join("") || "<p>Aucun texte sur cette diapositive.</p>"}</section>`;
          }));
          const controls = slides.length > 1
            ? `<div class="pptx-preview-controls"><button class="btn" disabled onclick="changePptxPreviewSlide(this,-1,event)">Précédente</button><span>1 / ${slides.length}</span><button class="btn" onclick="changePptxPreviewSlide(this,1,event)">Suivante</button></div>`
            : "";
          return `<div class="pptx-preview" data-pptx-index="0">${slides.join("")}${controls}</div>`;
        } catch {}
        const decoded = new TextDecoder("utf-8",{fatal:false}).decode(arrayBuffer).replace(/^\uFEFF/,"");
        const printable = [...decoded.slice(0,20000)].filter(char=>char==="\n"||char==="\r"||char==="\t"||char>=" ").length;
        if (decoded && printable / Math.max(1,Math.min(decoded.length,20000)) > .9) return `<pre class="plain-document-preview">${escapeHtml(decoded.slice(0,200000))}</pre>`;
        throw new Error("format non prévisualisable dans le navigateur");
      }

      function changePptxPreviewSlide(button, direction, event) {
        event?.stopPropagation();
        const preview = button.closest(".pptx-preview");
        if (!preview) return;
        const slides = [...preview.querySelectorAll(".pptx-preview-slide")];
        const current = Number(preview.dataset.pptxIndex || 0);
        const next = Math.max(0, Math.min(slides.length - 1, current + direction));
        preview.dataset.pptxIndex = String(next);
        slides.forEach((slide, index) => slide.hidden = index !== next);
        const buttons = preview.querySelectorAll(".pptx-preview-controls button");
        if (buttons[0]) buttons[0].disabled = next === 0;
        if (buttons[1]) buttons[1].disabled = next === slides.length - 1;
        const counter = preview.querySelector(".pptx-preview-controls span");
        if (counter) counter.textContent = `${next + 1} / ${slides.length}`;
        const scroller = preview.closest(".slide-document-card");
        if (scroller) scroller.scrollTop = 0;
      }

      async function pptxSlidePreviewImages(arrayBuffer, slideName, slideXml) {
        const fileName = slideName.split("/").pop();
        const relsName = `ppt/slides/_rels/${fileName}.rels`;
        let relsBytes;
        try {
          relsBytes = await extractZipEntry(arrayBuffer, relsName);
        } catch {
          return [];
        }
        const relsXml = new DOMParser().parseFromString(new TextDecoder("utf-8").decode(relsBytes), "application/xml");
        const targets = new Map([...relsXml.getElementsByTagNameNS("*", "Relationship")]
          .map((node) => [node.getAttribute("Id"), node.getAttribute("Target") || ""]));
        const relationIds = [...slideXml.getElementsByTagNameNS("*", "blip")]
          .map((node) => node.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed"))
          .filter(Boolean);
        return Promise.all(relationIds.map(async (relationId) => {
          const target = targets.get(relationId);
          if (!target || !/\.(png|jpe?g|gif|webp)$/i.test(target)) return "";
          const normalized = normalizeZipPath(`ppt/slides/${target}`);
          const bytes = await extractZipEntry(arrayBuffer, normalized);
          const extension = normalized.split(".").pop().toLowerCase();
          const mimeType = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
          return bytesToDataUrl(bytes, mimeType);
        })).then((sources) => sources.filter(Boolean));
      }

      function normalizeZipPath(path) {
        const parts = [];
        String(path).split("/").forEach((part) => {
          if (!part || part === ".") return;
          if (part === "..") parts.pop();
          else parts.push(part);
        });
        return parts.join("/");
      }

      function bytesToDataUrl(bytes, mimeType) {
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 8192) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        }
        return `data:${mimeType};base64,${btoa(binary)}`;
      }

      function listZipEntryNames(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);
        const minimumEocdOffset = Math.max(0, bytes.length - 65_557);
        let eocdOffset = -1;
        for (let offset = bytes.length - 22; offset >= minimumEocdOffset; offset--) {
          if (view.getUint32(offset, true) === 0x06054b50) {
            eocdOffset = offset;
            break;
          }
        }
        if (eocdOffset < 0) throw new Error("archive Office invalide");
        const entryCount = view.getUint16(eocdOffset + 10, true);
        let cursor = view.getUint32(eocdOffset + 16, true);
        const decoder = new TextDecoder("utf-8");
        const names = [];
        for (let index = 0; index < entryCount; index++) {
          if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) throw new Error("archive Office invalide");
          const nameLength = view.getUint16(cursor + 28, true);
          const extraLength = view.getUint16(cursor + 30, true);
          const commentLength = view.getUint16(cursor + 32, true);
          names.push(decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)).replace(/\\/g, "/"));
          cursor += 46 + nameLength + extraLength + commentLength;
        }
        return names;
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
        const toolSizeClass = element.kind === "tool" ? (Number(element.w || 0) < 250 || Number(element.h || 0) < 250 ? " tool-compact tool-tiny" : Number(element.w || 0) < 350 || Number(element.h || 0) < 350 ? " tool-compact" : "") : "";
        return `<div class="slide-el${toolSizeClass}" data-el-id="${escapeAttr(element.id || "")}" data-kind="${escapeAttr(element.kind || "text")}" data-value="${escapeAttr(element.value || "")}" style="left:${Number(element.x || 0)}px;top:${Number(element.y || 0)}px;width:${Number(element.w || 320)}px;height:${Number(element.h || 160)}px">${renderElementContent(element, false)}</div>`;
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
        const activityId = document.querySelector("#boardPage").dataset.activityId;
        const result = activityId ? findActivity(activityId) : null;
        document.querySelector("#boardPage").hidden = true;
        document.querySelector("#appPage").hidden = false;
        if (result) openLessonPage(result.classe.id, result.sequence.id, result.lesson.id);
      }

      function findLessonContext(lessonId) {
        for (const classe of state.classes) {
          for (const sequence of classe.sequences || []) {
            const lesson = (sequence.lessons || []).find((item) => item.id === lessonId);
            if (lesson) return { lesson, sequence, classe };
          }
        }
        return null;
      }

      function openLessonPrintPreview(lessonId) {
        const result = findLessonContext(lessonId);
        if (!result) return;
        const { lesson, sequence, classe } = result;
        const activities = lesson.activities || [];
        activities.forEach(ensureActivitySlides);
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `<section class="print-preview-shell">
          <header class="print-preview-toolbar">
            <div><strong>Aperçu avant export Word</strong><p class="small muted">Deux diapos par feuille A4 portrait par défaut. Chaque diapo peut passer en page entière paysage.</p></div>
            <div class="row wrap"><button class="btn primary" onclick="exportLessonWord('${lesson.id}',this)">Exporter Word (.docx)</button><button class="btn" onclick="closeEditor()">Fermer</button></div>
          </header>
          <div class="print-preview-scroll">
            <article class="printable-lesson" id="lessonPrintPreview">
              ${activities.map((activity, activityIndex) => `<section class="print-lesson-activity">
                ${(activity.slides || []).map((slide, index) => renderPrintableSlide(activity, slide, index, true)).join("")}
              </section>`).join("") || empty("Cette séance ne contient aucune activité.")}
            </article>
          </div>
        </section>`;
      }

      function openSequenceWordPreview(sequenceId) {
        const result = findSequenceContext(sequenceId);
        if (!result) return;
        const { sequence, classe } = result;
        const lessons = sequence.lessons || [];
        lessons.forEach((lesson) => (lesson.activities || []).forEach(ensureActivitySlides));
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `<section class="print-preview-shell"><header class="print-preview-toolbar"><div><strong>Aperçu de la séquence complète</strong><p class="small muted">Deux diapos par feuille A4 portrait par défaut. Chaque diapo peut passer en page entière paysage.</p></div><div class="row wrap"><button class="btn primary" onclick="exportSequenceWord('${sequence.id}',this)">Exporter Word (.docx)</button><button class="btn" onclick="closeEditor()">Fermer</button></div></header><div class="print-preview-scroll"><article class="printable-lesson" id="sequencePrintPreview">${lessons.map((lesson) => `<section class="print-lesson-activity">${(lesson.activities || []).map((activity) => `<section class="print-lesson-activity">${(activity.slides || []).map((slide,slideIndex) => renderPrintableSlide(activity,slide,slideIndex,true)).join("")}</section>`).join("")}</section>`).join("")}</article></div></section>`;
      }

      function openActivityPrintPreview(activityId) {
        const result = findActivity(activityId);
        if (!result) return;
        const { activity, lesson, sequence, classe } = result;
        ensureActivitySlides(activity);
        const modal = document.querySelector("#editorModal");
        modal.hidden = false;
        modal.innerHTML = `<section class="print-preview-shell">
          <header class="print-preview-toolbar">
            <div>
              <strong>Aperçu avant impression</strong>
              <p class="small muted">Choisissez l’orientation. Chaque diapo sera imprimée sur une page distincte.</p>
            </div>
            <div class="row wrap">
              ${printOrientationControl()}<button class="btn primary" onclick="printActivity()">Imprimer</button>
              <button class="btn" onclick="exportActivityWord('${activity.id}')">Exporter Word (.docx)</button>
              <button class="btn" onclick="closeEditor()">Fermer</button>
            </div>
          </header>
          <div class="print-preview-scroll">
            <article class="printable-activity" id="activityPrintPreview">
              <header class="print-activity-head">
                <p class="print-breadcrumb">${escapeHtml(classe.title)} · ${escapeHtml(sequence.title)} · ${escapeHtml(lesson.title)}</p>
                <h1>${escapeHtml(activity.title)}</h1>
                ${activity.description ? `<p>${escapeHtml(activity.description)}</p>` : ""}
                <dl class="print-activity-meta">
                  ${printMeta("Objectif", activity.objective)}
                  ${printMeta("Consigne", activity.instruction)}
                  ${printMeta("Durée", activity.estimatedDuration)}
                  ${printMeta("Modalité", activity.modality)}
                  ${printMeta("Niveau", activity.level)}
                </dl>
              </header>
              ${(activity.slides || []).map((slide, index) => renderPrintableSlide(activity, slide, index)).join("")}
              ${(activity.resources || []).length ? `<section class="print-resources"><h2>Ressources</h2><ul>${activity.resources.map((resource) => `<li><strong>${escapeHtml(resource.title)}</strong>${resource.url ? ` — ${escapeHtml(resource.url)}` : ""}</li>`).join("")}</ul></section>` : ""}
            </article>
          </div>
        </section>`;
      }

      function printMeta(label, value) {
        return value ? `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>` : "";
      }

      function renderPrintableSlide(activity, slide, index, wordOptions = false) {
        const context = findActivity(activity.id);
        const breadcrumb = context ? `${context.classe.title} › Séquence ${sequenceNumber(context.classe, context.sequence)} ${context.sequence.title} › Séance ${context.lesson.title} › ${activity.title}` : activity.title;
        const wordLayout = slide.wordLayout === "landscape" ? "landscape" : "half";
        return `<section class="print-slide-page" data-word-layout="${wordLayout}">
          ${wordOptions ? `<label class="word-slide-layout-control">Mise en page Word
            <select onchange="setWordSlideLayout('${activity.id}','${slide.id}',this.value,this)">
              <option value="half"${wordLayout === "half" ? " selected" : ""}>½ page · A4 portrait</option>
              <option value="landscape"${wordLayout === "landscape" ? " selected" : ""}>Page entière · paysage</option>
            </select>
          </label>` : ""}
          <p class="print-slide-path">${escapeHtml(breadcrumb)}</p>
          <h2>${escapeHtml(slideInstruction(slide,index))}</h2>
          <div class="print-slide-canvas">
            ${elementsForBoardSlide(activity, index).filter((element) => element.kind !== "tool").map(renderPrintableElement).join("")}
          </div>
        </section>`;
      }

      function setWordSlideLayout(activityId, slideId, value, select) {
        const result = findActivity(activityId);
        const slide = (result?.activity.slides || []).find((item) => item.id === slideId);
        if (!slide) return;
        slide.wordLayout = value === "landscape" ? "landscape" : "half";
        const page = select.closest(".print-slide-page");
        if (page) page.dataset.wordLayout = slide.wordLayout;
      }

      function renderPrintableElement(element) {
        const style = `left:${Number(element.x || 0) / slideSize.width * 100}%;top:${Number(element.y || 0) / slideSize.height * 100}%;width:${Number(element.w || 320) / slideSize.width * 100}%;height:${Number(element.h || 160) / slideSize.height * 100}%`;
        if (element.kind === "text") return `<div class="print-slide-element print-slide-text" style="${style};font-size:${Math.max(10, Number(element.fontSize || 34) * 0.75)}px">${element.html ? sanitizeRichText(element.html) : escapeHtml(element.value || "")}</div>`;
        if (element.kind === "image") return `<div class="print-slide-element" style="${style}"><img src="${escapeAttr(element.value)}" alt=""></div>`;
        if (element.kind === "video") return `<div class="print-slide-element" style="${style}"><video class="print-video-frame" src="${escapeAttr(element.value)}" muted preload="auto" onloadeddata="this.currentTime=.01"></video></div>`;
        return `<div class="print-slide-element print-slide-placeholder" style="${style}"><strong>${escapeHtml(labelTypeForPptx(element.kind))}</strong><span>${escapeHtml(element.value || "")}</span></div>`;
      }

      function printOrientationControl() {
        return `<label class="print-orientation-control">Orientation
          <select id="printOrientation" onchange="setPrintOrientation(this.value)">
            <option value="landscape">Paysage</option>
            <option value="portrait">Portrait</option>
          </select>
        </label>`;
      }

      function setPrintOrientation(value) {
        const orientation = value === "portrait" ? "portrait" : "landscape";
        let style = document.querySelector("#dynamicPrintPageStyle");
        if (!style) {
          style = document.createElement("style");
          style.id = "dynamicPrintPageStyle";
          document.head.appendChild(style);
        }
        style.textContent = `@media print { @page { size: A4 ${orientation}; margin: 10mm; } }`;
        document.body.dataset.printOrientation = orientation;
      }

      function printActivity() {
        setPrintOrientation(document.querySelector("#printOrientation")?.value || "landscape");
        window.print();
      }

      async function exportActivityWord(activityId, button = null) {
        const result = findActivity(activityId);
        if (!result) return;
        const unlock = beginSaveLock(button);
        try { downloadCourseWord(await makePreviewPagesDocx("activityPrintPreview"), result.activity.title); }
        catch (error) { toast(`Export Word impossible : ${error.message || "capture de l’aperçu impossible"}.`); }
        finally { unlock(); }
      }

      async function exportLessonWord(lessonId, button = null) {
        const result = findLessonContext(lessonId);
        if (!result) return;
        const unlock = beginSaveLock(button);
        try { downloadCourseWord(await makePreviewPagesDocx("lessonPrintPreview"), result.lesson.title); }
        catch (error) { toast(`Export Word impossible : ${error.message || "média inaccessible"}.`); }
        finally { unlock(); }
      }

      async function exportSequenceWord(sequenceId, button = null) {
        const result = findSequenceContext(sequenceId);
        if (!result) return;
        const unlock = beginSaveLock(button);
        try { downloadCourseWord(await makePreviewPagesDocx("sequencePrintPreview"), result.sequence.title); }
        catch (error) { toast(`Export Word impossible : ${error.message || "média inaccessible"}.`); }
        finally { unlock(); }
      }

      function findSequenceContext(sequenceId) {
        for (const classe of state.classes) {
          const sequence = (classe.sequences || []).find((item) => item.id === sequenceId);
          if (sequence) return { sequence, classe };
        }
        return null;
      }

      function downloadCourseWord(content, title) {
        const blob = new Blob([content], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${slugify(title || "cours")}.docx`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 0);
        toast("Document Word paysage exporté.");
      }

      async function makePreviewPagesDocx(previewId) {
        const preview = document.getElementById(previewId);
        if (!preview) throw new Error("ouvrez d’abord l’aperçu");
        await document.fonts?.ready;
        if (previewId === "lessonPrintPreview" || previewId === "sequencePrintPreview") {
          return makeWordHandoutDocx([...preview.querySelectorAll(".print-slide-page")]);
        }
        const pages = [...preview.querySelectorAll(":scope > .print-lesson-head, :scope > .print-activity-head, .print-lesson-activity > .print-activity-head, .print-slide-page, .print-resources")];
        if (!pages.length) throw new Error("aucune page à exporter");
        const media = [];
        const paragraphs = [];
        for (const [index, page] of pages.entries()) {
          const bytes = await rasterizePreviewPage(page);
          const asset = { bytes, relId: `rId${index + 1}`, fileName: `page-${index + 1}.png` };
          media.push(asset);
          paragraphs.push(docxPreviewPageParagraph(asset.relId, index > 0, index + 1));
        }
        return makeLandscapeDocx(paragraphs, media);
      }

      async function makeWordHandoutDocx(slides) {
        if (!slides.length) throw new Error("aucune diapo à exporter");
        const sheets = [];
        let halfSlides = [];
        const flushHalfSlides = async () => {
          if (!halfSlides.length) return;
          sheets.push({ orientation: "portrait", bytes: await composePortraitWordSheet(halfSlides) });
          halfSlides = [];
        };
        for (const slide of slides) {
          const bytes = await rasterizePreviewPage(slide);
          if (slide.dataset.wordLayout === "landscape") {
            await flushHalfSlides();
            sheets.push({ orientation: "landscape", bytes });
          } else {
            halfSlides.push(bytes);
            if (halfSlides.length === 2) await flushHalfSlides();
          }
        }
        await flushHalfSlides();
        return makeMixedOrientationDocx(sheets);
      }

      async function composePortraitWordSheet(slides) {
        const width = 1120, height = 1584, margin = 20, gap = 20;
        const slotHeight = (height - margin * 2 - gap) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = width * 2;
        canvas.height = height * 2;
        const context = canvas.getContext("2d");
        context.scale(2, 2);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        for (const [index, bytes] of slides.entries()) {
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
          try { context.drawImage(bitmap, margin, margin + index * (slotHeight + gap), width - margin * 2, slotHeight); }
          finally { bitmap.close(); }
        }
        const png = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("création de la feuille portrait impossible")), "image/png"));
        return new Uint8Array(await png.arrayBuffer());
      }

      function makeMixedOrientationDocx(sheets) {
        const media = sheets.map((sheet, index) => ({ ...sheet, relId: `rId${index + 1}`, fileName: `page-${index + 1}.png` }));
        const paragraphs = media.map((sheet, index) => docxMixedPageParagraph(sheet.relId, sheet.orientation, index + 1, index < media.length - 1));
        const lastOrientation = media.at(-1)?.orientation || "portrait";
        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${paragraphs.join("")}${docxSectionProperties(lastOrientation, false)}</w:body></w:document>`;
        const rels = media.map((item) => `<Relationship Id="${item.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${item.fileName}"/>`).join("");
        return makeZip([{ path:"[Content_Types].xml", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` }, { path:"_rels/.rels", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` }, { path:"word/_rels/document.xml.rels", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>` }, { path:"word/document.xml", content:documentXml }, ...media.map((item) => ({ path:`word/media/${item.fileName}`, content:item.bytes, binary:true }))]);
      }

      function docxSectionProperties(orientation, nextPage) {
        const landscape = orientation === "landscape";
        return `<w:sectPr>${nextPage ? '<w:type w:val="nextPage"/>' : ""}<w:pgSz w:w="${landscape ? 16838 : 11906}" w:h="${landscape ? 11906 : 16838}"${landscape ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="360" w:right="360" w:bottom="360" w:left="360"/></w:sectPr>`;
      }

      function docxMixedPageParagraph(relId, orientation, pageNumber, sectionBreak) {
        const landscape = orientation === "landscape";
        const cx = Math.round((landscape ? 10.75 : 7.4) * 914400);
        const cy = Math.round(cx * (landscape ? 210 / 297 : 297 / 210));
        return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/>${sectionBreak ? docxSectionProperties(orientation, true) : ""}</w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${pageNumber}" name="Page ${pageNumber}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${pageNumber}" name="Page ${pageNumber}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
      }

      async function rasterizePreviewPage(page) {
        const width = 1120;
        const height = Math.round(width * 210 / 297);
        const canvas = document.createElement("canvas");
        canvas.width = width * 2;
        canvas.height = height * 2;
        const context = canvas.getContext("2d");
        context.scale(2, 2);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        const pageRect = page.getBoundingClientRect();
        const scaleX = width / Math.max(1, pageRect.width);
        const scaleY = height / Math.max(1, pageRect.height);
        context.save();
        context.scale(scaleX, scaleY);
        for (const element of [page, ...page.querySelectorAll("*")]) {
          if (element.closest?.(".word-slide-layout-control")) continue;
          await paintPreviewElement(context, element, pageRect);
        }
        context.restore();
        const png = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("création de l’image impossible")), "image/png"));
        return new Uint8Array(await png.arrayBuffer());
      }

      async function paintPreviewElement(context, element, pageRect) {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return;
        const rect = element.getBoundingClientRect();
        const x = rect.left - pageRect.left, y = rect.top - pageRect.top;
        if (rect.width <= 0 || rect.height <= 0 || x >= pageRect.width || y >= pageRect.height || x + rect.width <= 0 || y + rect.height <= 0) return;
        if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent") {
          context.fillStyle = style.backgroundColor;
          context.fillRect(x, y, rect.width, rect.height);
        }
        const borderWidth = parseFloat(style.borderTopWidth) || 0;
        if (borderWidth && style.borderTopStyle !== "none") {
          context.strokeStyle = style.borderTopColor;
          context.lineWidth = borderWidth;
          context.strokeRect(x + borderWidth / 2, y + borderWidth / 2, Math.max(0, rect.width - borderWidth), Math.max(0, rect.height - borderWidth));
        }
        if (element instanceof HTMLImageElement && (element.currentSrc || element.src)) {
          await paintPreviewMedia(context, element.currentSrc || element.src, x, y, rect.width, rect.height, style.objectFit);
          return;
        }
        if (element instanceof HTMLVideoElement && element.currentSrc) {
          try {
            const raster = await docxRasterMedia({ kind: "video", value: element.currentSrc, w: rect.width, h: rect.height });
            await paintPreviewBytes(context, raster.bytes, x, y, rect.width, rect.height, "contain");
          } catch (_) {}
          return;
        }
        for (const node of element.childNodes) if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) paintPreviewTextNode(context, node, pageRect, style);
      }

      async function paintPreviewMedia(context, url, x, y, width, height, objectFit) {
        try {
          const media = await fetchExportMedia(url);
          await paintPreviewBytes(context, media.bytes, x, y, width, height, objectFit);
        } catch (_) {}
      }

      async function paintPreviewBytes(context, bytes, x, y, width, height, objectFit = "contain") {
        const bitmap = await createImageBitmap(new Blob([bytes]));
        try {
          const contain = objectFit !== "cover";
          const ratio = contain ? Math.min(width / bitmap.width, height / bitmap.height) : Math.max(width / bitmap.width, height / bitmap.height);
          const drawWidth = bitmap.width * ratio, drawHeight = bitmap.height * ratio;
          context.save();
          context.beginPath();
          context.rect(x, y, width, height);
          context.clip();
          context.drawImage(bitmap, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
          context.restore();
        } finally { bitmap.close(); }
      }

      function paintPreviewTextNode(context, node, pageRect, style) {
        const text = node.textContent || "";
        const lines = [];
        for (let index = 0; index < text.length; index += 1) {
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const rect = range.getBoundingClientRect();
          if (!rect.width && !rect.height) continue;
          let line = lines.at(-1);
          if (!line || Math.abs(line.top - rect.top) > 1) {
            line = { text: "", left: rect.left - pageRect.left, top: rect.top - pageRect.top, bottom: rect.bottom - pageRect.top };
            lines.push(line);
          }
          line.text += text[index];
          line.bottom = Math.max(line.bottom, rect.bottom - pageRect.top);
        }
        context.fillStyle = style.color || "#000";
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        context.textBaseline = "alphabetic";
        lines.forEach((line) => context.fillText(line.text, line.left, line.bottom - Math.max(0, parseFloat(style.fontSize) * .12)));
      }

      function docxPreviewPageParagraph(relId, pageBreakBefore, pageNumber) {
        const cx = Math.round(9.95 * 914400), cy = Math.round(cx * 210 / 297);
        return `<w:p><w:pPr>${pageBreakBefore ? '<w:pageBreakBefore/>' : ''}<w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${pageNumber}" name="Page ${pageNumber}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${pageNumber}" name="Page ${pageNumber}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
      }

      async function lessonDocxParagraphs({ lesson, sequence, classe }, lessonIndex = 0, media = [], embedMedia = true) {
        const paragraphs = [docxParagraph(lesson.title || `Séance ${lessonIndex + 1}`, true, 34, lessonIndex > 0), docxParagraph(`${classe.title} · ${sequence.title}`, false, 20), docxParagraph(lesson.description ? `Objectif : ${lesson.description}` : "", false, 22), docxParagraph("Ma valise pédagogique", true, 26), ...[["Culture",lesson.cultural],["Lexique",lesson.lexicon],["Conjugaison",lesson.conjugation],["Grammaire",lesson.grammar],["Je sais…",lesson.lifeSkills]].map(([label,value]) => docxParagraph(value ? `${label} : ${value}` : "", false, 20))];
        for (const [index, activity] of (lesson.activities || []).entries()) paragraphs.push(...await activityDocxParagraphs(activity,index,media,embedMedia));
        return paragraphs;
      }

      async function activityDocxParagraphs(activity, activityIndex = 0, media = [], embedMedia = true) {
        const paragraphs = [docxParagraph(`Activité ${activityIndex + 1} — ${activity.title || "Sans titre"}`, true, 28), docxParagraph(activity.description || "", false, 20), docxParagraph(activity.objective ? `Objectif : ${activity.objective}` : "", true, 20), docxParagraph(activity.instruction ? `Consigne : ${activity.instruction}` : "", false, 20)];
        for (const [index, slide] of (activity.slides || []).entries()) {
          paragraphs.push(docxParagraph(slideInstruction(slide,index), true, 24));
          for (const element of elementsForBoardSlide(activity,index).sort((a,b) => Number(a.y||0)-Number(b.y||0))) {
            if (element.kind === "text") paragraphs.push(docxParagraph(element.value || "", false, 18));
            else if (embedMedia && (element.kind === "image" || element.kind === "video")) {
              try {
                const asset = await docxRasterMedia(element);
                asset.relId = `rId${media.length + 1}`;
                asset.fileName = `media-${media.length + 1}.png`;
                media.push(asset);
                paragraphs.push(docxImageParagraph(asset.relId, element.w, element.h, element.kind === "video" ? "Première image de la vidéo" : "Image"));
              } catch (error) { paragraphs.push(docxParagraph(`${labelTypeForPptx(element.kind)} inaccessible`, false, 18)); }
            } else if (element.kind !== "tool") paragraphs.push(docxParagraph(`${labelTypeForPptx(element.kind)} : ${element.value || ""}`, false, 18));
          }
        }
        if ((activity.resources || []).length) {
          paragraphs.push(docxParagraph("Ressources", true, 22));
          activity.resources.forEach((resource) => paragraphs.push(docxParagraph(`• ${resource.title || "Ressource"}${resource.url ? ` — ${resource.url}` : ""}`, false, 18)));
        }
        return paragraphs;
      }

      async function makeLessonDocx(result) { const media=[]; return makeLandscapeDocx(await lessonDocxParagraphs(result,0,media),media); }
      async function makeSequenceDocx({ sequence, classe }, embedMedia = true) {
        const media = [];
        const paragraphs = [docxParagraph(sequence.title || "Séquence", true, 38), docxParagraph(classe.title, false, 22), docxParagraph(sequence.description || "", false, 22), docxParagraph(sequence.finalTask ? `Tâche finale : ${sequence.finalTask}` : "", true, 22)];
        for (const [index, lesson] of (sequence.lessons || []).entries()) paragraphs.push(...await lessonDocxParagraphs({ lesson, sequence, classe },index,media,embedMedia));
        return makeLandscapeDocx(paragraphs,media);
      }

      function makeLandscapeDocx(paragraphs, media = []) {
        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/></w:sectPr></w:body></w:document>`;
        const rels = media.map((item) => `<Relationship Id="${item.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${item.fileName}"/>`).join("");
        return makeZip([{ path:"[Content_Types].xml", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` }, { path:"_rels/.rels", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` }, { path:"word/_rels/document.xml.rels", content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>` }, { path:"word/document.xml", content:documentXml }, ...media.map((item) => ({ path:`word/media/${item.fileName}`, content:item.bytes, binary:true }))]);
      }

      function docxImageParagraph(relId, width, height, description) {
        const ratio = Math.max(.25, Math.min(4, Number(width || 16) / Math.max(1,Number(height || 9))));
        const cx = Math.round(Math.min(9, 5.2 * ratio) * 914400), cy = Math.round(cx / ratio), id = Number(String(relId).replace(/\D/g,"")) || 1;
        return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="180"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${xmlEscape(description)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${xmlEscape(description)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
      }

      async function docxRasterMedia(element) {
        const downloaded = await fetchExportMedia(element.value);
        const blob = new Blob([downloaded.bytes], { type: downloaded.mimeType || defaultMediaMime(element.kind) });
        const url = URL.createObjectURL(blob);
        try {
          const source = element.kind === "video" ? document.createElement("video") : new Image();
          source.muted = true; source.preload = "auto";
          await new Promise((resolve,reject) => { source.onload = resolve; source.onloadeddata = resolve; source.onerror = () => reject(new Error("aperçu du média impossible")); source.src = url; });
          if (element.kind === "video") { try { source.currentTime = Math.min(.1, Math.max(0, source.duration || .1)); await new Promise((resolve) => { source.onseeked=resolve; setTimeout(resolve,800); }); } catch (_) {} }
          const naturalWidth = source.videoWidth || source.naturalWidth || Number(element.w) || 960, naturalHeight = source.videoHeight || source.naturalHeight || Number(element.h) || 540;
          const scale = Math.min(1, 1400 / naturalWidth, 900 / naturalHeight), canvas = document.createElement("canvas");
          canvas.width = Math.max(1,Math.round(naturalWidth*scale)); canvas.height = Math.max(1,Math.round(naturalHeight*scale));
          canvas.getContext("2d").drawImage(source,0,0,canvas.width,canvas.height);
          const png = await new Promise((resolve,reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("conversion de l’image impossible")),"image/png"));
          return { bytes:new Uint8Array(await png.arrayBuffer()) };
        } finally { URL.revokeObjectURL(url); }
      }

      function makeActivityDocx({ activity, lesson, sequence, classe }) {
        const paragraphs = [
          docxParagraph(activity.title || "Activité", true, 36),
          docxParagraph(`${classe.title} · ${sequence.title} · ${lesson.title}`, false, 20),
          docxParagraph(activity.description || "", false, 22),
          docxParagraph(activity.objective ? `Objectif : ${activity.objective}` : "", true, 22),
          docxParagraph(activity.instruction ? `Consigne : ${activity.instruction}` : "", true, 22),
          docxParagraph([activity.estimatedDuration && `Durée : ${activity.estimatedDuration}`, activity.modality && `Modalité : ${activity.modality}`, activity.level && `Niveau : ${activity.level}`].filter(Boolean).join(" · "), false, 20)
        ];
        (activity.slides || []).forEach((slide, index) => {
          paragraphs.push(docxParagraph(slideInstruction(slide,index), true, 28, index > 0));
          elementsForBoardSlide(activity, index)
            .sort((a, b) => Number(a.y || 0) - Number(b.y || 0) || Number(a.x || 0) - Number(b.x || 0))
            .forEach((element) => {
              if (element.kind === "text") paragraphs.push(docxParagraph(element.value || "", false, Math.min(28, Math.max(18, Number(element.fontSize || 24)))));
              else if (element.kind === "tool") paragraphs.push(docxParagraph(`Outil interactif : ${slideTools[String(element.value || "timer").split("|")[0]]?.title || "Outil"}`, true, 20));
              else paragraphs.push(docxParagraph(`${labelTypeForPptx(element.kind)} : ${element.value || ""}`, false, 18));
            });
        });
        if ((activity.resources || []).length) {
          paragraphs.push(docxParagraph("Ressources", true, 28, true));
          activity.resources.forEach((resource) => paragraphs.push(docxParagraph(`• ${resource.title}${resource.url ? ` — ${resource.url}` : ""}`, false, 20)));
        }
        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
        return makeZip([
          { path: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
          { path: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
          { path: "word/document.xml", content: documentXml }
        ]);
      }

      function docxParagraph(value, bold = false, fontSize = 22, pageBreakBefore = false) {
        if (!value) return "";
        const lines = String(value).split(/\r?\n/);
        const runs = lines.map((line, index) => `${index ? "<w:r><w:br/></w:r>" : ""}<w:r><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${Math.round(fontSize * 2)}"/><w:szCs w:val="${Math.round(fontSize * 2)}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line || " ")}</w:t></w:r>`).join("");
        return `<w:p><w:pPr>${pageBreakBefore ? '<w:pageBreakBefore/>' : ""}<w:spacing w:after="160"/></w:pPr>${runs}</w:p>`;
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

      async function exportZip(button = null) {
        if (!requireLogin()) return;
        const unlock = beginSaveLock(button);
        exportMediaFetchCache = new Map();
        exportWarnings = [];
        try {
          toast("Préparation du ZIP en cours… Cela peut prendre quelques minutes.");
          const files = await buildExportFiles();
          const blob = new Blob(makeZipParts(files), { type: "application/zip" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `in-viaggio-export-${new Date().toISOString().slice(0, 10)}.zip`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(link.href), 1000);
          toast(exportWarnings.length
            ? `ZIP exporté. ${exportWarnings.length} média(s) introuvable(s) sont indiqués dans le rapport.`
            : "ZIP exporté avec les présentations et leurs médias.");
        } catch (error) {
          console.error("Export ZIP impossible", error);
          toast(`Export impossible : ${error.message || "un média n'a pas pu être intégré"}.`);
        } finally {
          exportMediaFetchCache.clear();
          unlock();
        }
      }

      async function buildExportFiles() {
        const files = [{
          path: "donnees-completes.json",
          content: JSON.stringify(state, null, 2)
        }, {
          path: "README.txt",
          content: "Export local In viaggio per l'Italia\n\nLe fichier donnees-completes.json contient toute la sauvegarde importable.\nDans le dossier classes, chaque classe possède son propre dossier avec un document Word par séquence.\nLes médias sont conservés séparément dans le dossier medias.\n"
        }];

        state.classes.forEach((classe, classIndex) => {
          const classFolder = `classes/${String(classIndex + 1).padStart(2, "0")}-${exportSlug(classe.title, 14)}`;
          files.push({ path: `${classFolder}/classe.json`, content: JSON.stringify(classe, null, 2) });
          (classe.sequences || []).forEach((sequence, sequenceIndex) => {
            files.push({
              path: `${classFolder}/${String(sequenceIndex + 1).padStart(2, "0")}-${exportSlug(sequence.title, 40)}.docx`,
              content: makeSequenceDocx({ sequence, classe }, false),
              binary: true
            });
          });
        });
        (state.studentClasses || []).forEach((classe, index) => {
          const folder = `mes-classes/${String(index + 1).padStart(2, "0")}-${exportSlug(classe.title, 14)}`;
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
        await appendStoredFilesToExport(files);
        await Promise.all(files.map(async (file) => {
          if (file.content instanceof Promise) file.content = await file.content;
        }));
        if (exportWarnings.length) {
          files.push({
            path: "RAPPORT-MEDIAS-MANQUANTS.txt",
            content: [
              "Certains médias référencés par les données n’étaient plus accessibles lors de l’export.",
              "Le reste de la sauvegarde a bien été exporté.",
              "",
              ...exportWarnings
            ].join("\n")
          });
        }
        return files;
      }

      function exportSlug(value, maxLength = 14) {
        return (slugify(value) || "sans-titre").slice(-maxLength).replace(/^-+|-+$/g, "") || "sans-titre";
      }

      async function appendStoredFilesToExport(files) {
        if (isLocalFileMode() || !window.ServerAPI?.files) return;
        const storedFiles = [];
        for (let offset = 0; ; offset += 200) {
          const page = await window.ServerAPI.files(offset, 200);
          storedFiles.push(...page);
          if (page.length < 200) break;
        }
        const downloads = await Promise.all(storedFiles.map(async (item, index) => {
          try {
            const downloaded = await fetchExportMedia(item.content_url);
            const extension = safeFileExtension(item.original_name);
            const baseName = exportSlug(String(item.original_name || `fichier-${index + 1}`).replace(/\.[^.]+$/, ""));
            return {
              path: `medias/${String(index + 1).padStart(3, "0")}-${baseName}${extension}`,
              content: downloaded.bytes,
              binary: true
            };
          } catch (error) {
            recordExportWarning(`Fichier stocké « ${item.original_name || item.id} »`, item.content_url, error);
            return null;
          }
        }));
        files.push(...downloads.filter(Boolean));
      }

      function safeFileExtension(fileName) {
        const match = /\.([a-z0-9]{1,10})$/i.exec(String(fileName || ""));
        return match ? `.${match[1].toLowerCase()}` : "";
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

      async function makePptx(activity) {
        const slides = (activity.slides || []).length ? activity.slides : [{ elements: [] }];
        const slideMedia = await Promise.all(slides.map((slide, slideIndex) => collectSlideMedia(slide, slideIndex)));
        const media = slideMedia.flat();
        const templateFiles = await loadPptxTemplateFiles();
        const preservedTemplatePaths = /^(ppt\/slideMasters\/|ppt\/slideLayouts\/|ppt\/theme\/|ppt\/presProps\.xml$|ppt\/viewProps\.xml$|ppt\/tableStyles\.xml$)/;
        const files = templateFiles.filter((file) => preservedTemplatePaths.test(file.path));
        files.push(
          { path: "[Content_Types].xml", content: pptxContentTypes(slides.length, media) },
          { path: "_rels/.rels", content: pptxRootRels() },
          { path: "docProps/app.xml", content: pptxAppProperties(slides.length) },
          { path: "docProps/core.xml", content: pptxCoreProperties(activity.title) },
          { path: "ppt/presentation.xml", content: pptxPresentation(slides.length) },
          { path: "ppt/_rels/presentation.xml.rels", content: pptxPresentationRels(slides.length) },
          { path: "ppt/media/media-placeholder.png", content: mediaPlaceholderPng(), binary: true }
        );
        slides.forEach((slide, index) => {
          files.push({ path: `ppt/slides/slide${index + 1}.xml`, content: pptxSlide(activity, slide, index, slideMedia[index]) });
          files.push({ path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: pptxSlideRels(slideMedia[index]) });
        });
        media.forEach((item) => files.push({ path: `ppt/media/${item.fileName}`, content: item.bytes, binary: true }));
        return makeZip(files);
      }

      function pptxContentTypes(count, media) {
        const mediaTypes = new Map([["png", "image/png"]]);
        media.forEach((item) => mediaTypes.set(item.extension, item.mimeType));
        const defaults = [...mediaTypes].map(([extension, mimeType]) => `<Default Extension="${xmlEscape(extension)}" ContentType="${xmlEscape(mimeType)}"/>`).join("");
        const layouts = Array.from({ length: 11 }, (_, i) => `<Override PartName="/ppt/slideLayouts/slideLayout${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`).join("");
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${defaults}<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>${layouts}<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${Array.from({ length: count }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`;
      }

      let pptxTemplateFilesPromise = null;

      function loadPptxTemplateFiles() {
        if (!pptxTemplateFilesPromise) {
          pptxTemplateFilesPromise = fetch("assets/pptx-template.pptx?v=1")
            .then((response) => {
              if (!response.ok) throw new Error(`modèle PowerPoint inaccessible (HTTP ${response.status})`);
              return response.arrayBuffer();
            })
            .then((buffer) => readStoredZipFiles(new Uint8Array(buffer)));
        }
        return pptxTemplateFilesPromise.then((files) => files.map((file) => ({ ...file, content: file.content.slice() })));
      }

      function readStoredZipFiles(bytes) {
        const decoder = new TextDecoder();
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const files = [];
        let cursor = 0;
        while (cursor + 30 <= bytes.length && view.getUint32(cursor, true) === 0x04034b50) {
          const method = view.getUint16(cursor + 8, true);
          const compressedSize = view.getUint32(cursor + 18, true);
          const nameLength = view.getUint16(cursor + 26, true);
          const extraLength = view.getUint16(cursor + 28, true);
          if (method !== 0) throw new Error("le modèle PowerPoint doit utiliser des entrées ZIP non compressées");
          const nameStart = cursor + 30;
          const dataStart = nameStart + nameLength + extraLength;
          const dataEnd = dataStart + compressedSize;
          if (dataEnd > bytes.length) throw new Error("modèle PowerPoint tronqué");
          files.push({
            path: decoder.decode(bytes.subarray(nameStart, nameStart + nameLength)),
            content: bytes.slice(dataStart, dataEnd),
            binary: true
          });
          cursor = dataEnd;
        }
        if (!files.length) throw new Error("modèle PowerPoint invalide");
        return files;
      }

      function pptxPresentation(count) {
        const ids = Array.from({ length: count }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("");
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="fr-FR"/></a:defPPr></p:defaultTextStyle></p:presentation>`;
      }

      function pptxPresentationRels(count) {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${Array.from({ length: count }, (_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}<Relationship Id="rId${count + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId${count + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId${count + 4}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`;
      }

      function pptxRootRels() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
      }

      function pptxAppProperties(count) {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Mon Espace Prof</Application><PresentationFormat>Écran 16:9</PresentationFormat><Slides>${count}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips><ScaleCrop>false</ScaleCrop><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion></Properties>`;
      }

      function pptxCoreProperties(title) {
        const now = new Date().toISOString();
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title || "Présentation")}</dc:title><dc:creator>Mon Espace Prof</dc:creator><cp:lastModifiedBy>Mon Espace Prof</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
      }

      function pptxPresProps() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`;
      }

      function pptxViewProps() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" lastView="sldView"><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:slideViewPr><p:cSldViewPr><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr><p:guideLst/></p:cSldViewPr></p:slideViewPr><p:notesTextViewPr><p:cViewPr><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:notesTextViewPr><p:gridSpacing cx="72008" cy="72008"/></p:viewPr>`;
      }

      function pptxTableStyles() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`;
      }

      function pptxSlideMaster() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Masque"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2400"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:defPPr><a:defRPr lang="fr-FR"/></a:defPPr></p:otherStyle></p:txStyles></p:sldMaster>`;
      }

      function pptxSlideMasterRels() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;
      }

      function pptxSlideLayout() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Vide"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
      }

      function pptxSlideLayoutRels() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;
      }

      function pptxTheme() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Mon Espace Prof"><a:themeElements><a:clrScheme name="Mon Espace Prof"><a:dk1><a:srgbClr val="1F1F1F"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="404040"/></a:dk2><a:lt2><a:srgbClr val="FFFDF9"/></a:lt2><a:accent1><a:srgbClr val="8E354A"/></a:accent1><a:accent2><a:srgbClr val="41945F"/></a:accent2><a:accent3><a:srgbClr val="D89B3C"/></a:accent3><a:accent4><a:srgbClr val="527AA3"/></a:accent4><a:accent5><a:srgbClr val="9C6ADE"/></a:accent5><a:accent6><a:srgbClr val="4B9DA9"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Standard"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:solidFill><a:schemeClr val="lt2"/></a:solidFill><a:solidFill><a:schemeClr val="dk1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
      }

      function pptxSlide(activity, slide, index, media) {
        const shapes = [
          pptxTextShape(`title-${index}`, activity.title || "Presentation", 50, 24, 860, 54, 28, true),
          ...(slide.elements || []).map((element, elementIndex) => {
            const asset = media.find((item) => item.elementIndex === elementIndex);
            return asset ? pptxMediaShape(element, `${index}-${elementIndex}`, asset) : pptxElementShape(element, `${index}-${elementIndex}`);
          })
        ].join("");
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFDF9"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
      }

      async function collectSlideMedia(slide, slideIndex) {
        const supported = new Set(["image", "audio", "video"]);
        const results = await Promise.all((slide.elements || []).map(async (element, elementIndex) => {
          if (!supported.has(element.kind) || !element.value) return null;
          try {
            const downloaded = await fetchExportMedia(element.value);
            const mimeType = downloaded.mimeType || mimeFromDataUrl(element.value) || defaultMediaMime(element.kind);
            const extension = mediaExtension(mimeType, element.kind);
            return {
              elementIndex,
              kind: element.kind,
              bytes: downloaded.bytes,
              mimeType,
              extension,
              fileName: `media-${slideIndex + 1}-${elementIndex + 1}.${extension}`
            };
          } catch (error) {
            recordExportWarning(`Média ${elementIndex + 1} de la diapositive ${slideIndex + 1}`, element.value, error);
            return null;
          }
        }));
        return results.filter(Boolean).map((item, index) => ({
          ...item,
          mediaRelId: `rId${index * 3 + 2}`,
          playbackRelId: `rId${index * 3 + 3}`,
          previewRelId: `rId${index * 3 + 4}`
        }));
      }

      let exportMediaFetchCache = new Map();
      let exportWarnings = [];

      function recordExportWarning(context, url, error) {
        const warning = `${context} : ${url || "adresse inconnue"} — ${error?.message || "média inaccessible"}`;
        if (!exportWarnings.includes(warning)) exportWarnings.push(warning);
      }

      function fetchExportMedia(url) {
        if (!exportMediaFetchCache.has(url)) {
          exportMediaFetchCache.set(url, fetch(url, { credentials: "include" }).then(async (response) => {
            if (!response.ok) throw new Error(`média inaccessible (HTTP ${response.status})`);
            const blob = await response.blob();
            return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type || "" };
          }));
        }
        return exportMediaFetchCache.get(url);
      }

      function pptxSlideRels(media) {
        const relationships = media.map((item) => {
          const playbackType = item.kind === "video" ? "video" : item.kind === "audio" ? "audio" : "image";
          if (item.kind === "image") {
            return `<Relationship Id="${item.mediaRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${xmlEscape(item.fileName)}"/>`;
          }
          return `<Relationship Id="${item.mediaRelId}" Type="http://schemas.microsoft.com/office/2007/relationships/media" Target="../media/${xmlEscape(item.fileName)}"/><Relationship Id="${item.playbackRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${playbackType}" Target="../media/${xmlEscape(item.fileName)}"/><Relationship Id="${item.previewRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/media-placeholder.png"/>`;
        }).join("");
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>${relationships}</Relationships>`;
      }

      function pptxMediaShape(element, id, asset) {
        const shapeId = 1000 + Math.abs(String(id).split("").reduce((sum, char) => sum + char.charCodeAt(0), 10));
        const px = 12700;
        const x = Math.round(Number(element.x || 0) * px);
        const y = Math.round(Number(element.y || 0) * px);
        const w = Math.round(Number(element.w || 320) * px);
        const h = Math.round(Number(element.h || 180) * px);
        if (asset.kind === "image") {
          return `<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="Image ${shapeId}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${asset.mediaRelId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
        }
        const mediaTag = asset.kind === "video" ? "videoFile" : "audioFile";
        return `<p:pic><p:nvPicPr><p:cNvPr id="${shapeId}" name="${asset.kind === "video" ? "Vidéo" : "Audio"} ${shapeId}"/><p:cNvPicPr/><p:nvPr><a:${mediaTag} r:link="${asset.playbackRelId}"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FC82D49A}"><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="${asset.mediaRelId}"/></p:ext></p:extLst></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${asset.previewRelId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
      }

      function mimeFromDataUrl(value) {
        return /^data:([^;,]+)/i.exec(String(value || ""))?.[1] || "";
      }

      function defaultMediaMime(kind) {
        return kind === "image" ? "image/png" : kind === "audio" ? "audio/mpeg" : kind === "pdf" ? "application/pdf" : kind === "document" ? "application/vnd.oasis.opendocument.text" : "video/mp4";
      }

      function mediaExtension(mimeType, kind) {
        const extensions = {
          "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
          "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/ogg": "ogg",
          "video/mp4": "mp4", "video/webm": "webm", "video/ogg": "ogv", "video/quicktime": "mov",
          "application/pdf": "pdf", "application/vnd.oasis.opendocument.text": "odt",
          "application/vnd.oasis.opendocument.spreadsheet": "ods", "application/vnd.oasis.opendocument.presentation": "odp"
        };
        return extensions[String(mimeType || "").split(";")[0].toLowerCase()] || (kind === "image" ? "png" : kind === "audio" ? "mp3" : kind === "pdf" ? "pdf" : kind === "document" ? "odt" : "mp4");
      }

      function mediaPlaceholderPng() {
        const binary = atob("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAgElEQVR4nOXOQQEAIBCAMKSTJQxnZY1xD5Zg6+7zCJM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iZM4iXM6MO0D1gsCjEiXvU4AAAAASUVORK5CYII=");
        return Uint8Array.from(binary, (char) => char.charCodeAt(0));
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
        return concatUint8(makeZipParts(files));
      }

      function makeZipParts(files) {
        const encoder = new TextEncoder();
        const localParts = [];
        const centralParts = [];
        const { dosTime, dosDate } = zipDosDateTime(new Date());
        let offset = 0;
        files.forEach((file) => {
          const name = encoder.encode(file.path.replace(/\\/g, "/"));
          const data = file.binary ? file.content : encoder.encode(file.content);
          const crc = crc32(data);
          const local = zipHeader(0x04034b50, [
            [2, 20], [2, 0], [2, 0], [2, dosTime], [2, dosDate],
            [4, crc], [4, data.length], [4, data.length],
            [2, name.length], [2, 0]
          ]);
          localParts.push(local, name, data);
          const central = zipHeader(0x02014b50, [
            [2, 20], [2, 20], [2, 0], [2, 0], [2, dosTime], [2, dosDate],
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
        return [...localParts, ...centralParts, end];
      }

      function zipDosDateTime(date) {
        const year = Math.max(1980, date.getFullYear());
        return {
          dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
          dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
        };
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

      async function importData(file, triggerButton) {
        if (!requireLogin()) return;
        if (!file) return;
        const originalLabel = triggerButton?.textContent;
        if (triggerButton) {
          triggerButton.disabled = true;
          triggerButton.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Lecture du fichier…';
        }
        try {
          const payload = await readImportFile(file);
          const importedState = payload?.content && typeof payload.content === "object" ? payload.content : payload;
          if (!importedState || typeof importedState !== "object" || !Array.isArray(importedState.classes)) {
            throw new Error("la sauvegarde ne contient pas de liste de classes valide");
          }
          const classCount = importedState.classes.length;
          const sequenceCount = importedState.classes.reduce((total, classe) => total + (Array.isArray(classe.sequences) ? classe.sequences.length : 0), 0);
          const lessonCount = importedState.classes.reduce((total, classe) => total + (classe.sequences || []).reduce((sum, sequence) => sum + (Array.isArray(sequence.lessons) ? sequence.lessons.length : 0), 0), 0);
          if (!confirm(`Cette sauvegarde contient ${classCount} classe(s), ${sequenceCount} séquence(s) et ${lessonCount} séance(s). Elle remplacera les données actuelles de ce compte. Continuer ?`)) return;
          state = ensureDemoData(importedState);
          await saveData("Sauvegarde importée et enregistrée sur le serveur.", triggerButton);
        } catch (error) {
          console.error("Import impossible", error);
          toast(`Import impossible : ${error.message || "fichier invalide"}.`);
        } finally {
          if (triggerButton) {
            triggerButton.disabled = false;
            triggerButton.textContent = originalLabel || "Importer ZIP ou JSON";
          }
        }
      }

      async function readImportFile(file) {
        const fileName = String(file.name || "").toLowerCase();
        if (fileName.endsWith(".json") || file.type === "application/json") {
          return JSON.parse(await file.text());
        }
        if (fileName.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed") {
          const jsonBytes = await extractZipEntry(await file.arrayBuffer(), "donnees-completes.json");
          return JSON.parse(new TextDecoder("utf-8").decode(jsonBytes));
        }
        throw new Error("choisissez un fichier ZIP ou JSON");
      }

      async function extractZipEntry(arrayBuffer, expectedName) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);
        const minimumEocdOffset = Math.max(0, bytes.length - 65_557);
        let eocdOffset = -1;
        for (let offset = bytes.length - 22; offset >= minimumEocdOffset; offset--) {
          if (view.getUint32(offset, true) === 0x06054b50) {
            eocdOffset = offset;
            break;
          }
        }
        if (eocdOffset < 0) throw new Error("archive ZIP invalide");
        const entryCount = view.getUint16(eocdOffset + 10, true);
        let cursor = view.getUint32(eocdOffset + 16, true);
        const decoder = new TextDecoder("utf-8");
        for (let index = 0; index < entryCount; index++) {
          if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
            throw new Error("table des fichiers ZIP invalide");
          }
          const method = view.getUint16(cursor + 10, true);
          const compressedSize = view.getUint32(cursor + 20, true);
          const uncompressedSize = view.getUint32(cursor + 24, true);
          const nameLength = view.getUint16(cursor + 28, true);
          const extraLength = view.getUint16(cursor + 30, true);
          const commentLength = view.getUint16(cursor + 32, true);
          const localOffset = view.getUint32(cursor + 42, true);
          const entryName = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)).replace(/\\/g, "/");
          if (entryName === expectedName || entryName.endsWith(`/${expectedName}`)) {
            if (uncompressedSize > 100 * 1024 * 1024) throw new Error("sauvegarde trop volumineuse");
            if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) {
              throw new Error("fichier ZIP interne invalide");
            }
            const localNameLength = view.getUint16(localOffset + 26, true);
            const localExtraLength = view.getUint16(localOffset + 28, true);
            const dataStart = localOffset + 30 + localNameLength + localExtraLength;
            if (dataStart + compressedSize > bytes.length) throw new Error("fichier ZIP tronqué");
            const compressed = bytes.slice(dataStart, dataStart + compressedSize);
            if (method === 0) return compressed;
            if (method === 8 && typeof DecompressionStream !== "undefined") {
              const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
              const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
              if (inflated.length !== uncompressedSize) throw new Error("contenu ZIP incomplet");
              return inflated;
            }
            throw new Error("compression ZIP non prise en charge par ce navigateur");
          }
          cursor += 46 + nameLength + extraLength + commentLength;
        }
        throw new Error(`le fichier ${expectedName} est absent du ZIP`);
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

      let buttonHelpTimer = null;
      let buttonHelpTarget = null;

      function buttonHelpText(button) {
        if (button.dataset.help) return button.dataset.help;
        const label = (button.getAttribute("aria-label") || button.title || button.textContent || "").replace(/\s+/g, " ").trim();
        const normalized = label.toLowerCase();
        const explanations = [
          [/^retour$/, "Revenir à la séance associée à cette présentation."],
          [/pr[ée]c[ée]dent/, "Afficher la diapositive précédente."],
          [/suivant/, "Afficher la diapositive suivante."],
          [/plein [ée]cran/, "Afficher la présentation sur tout l’écran."],
          [/enregistrer/, "Valider les modifications en cours."],
          [/annuler|fermer|^x$/, "Fermer cette fenêtre sans continuer."],
          [/ajouter une classe/, "Créer un nouveau niveau ou groupe de cours."],
          [/ajouter une s[ée]quence/, "Créer une séquence dans cette classe."],
          [/ajouter une s[ée]ance/, "Créer une séance dans cette séquence."],
          [/ajouter une (activit[ée]|pr[ée]sentation)/, "Créer une nouvelle présentation dans cette séance."],
          [/\+ fichier/, "Importer images, sons, vidéos, PDF, documents Word, tableaux Excel, textes et PowerPoint. Tous les objets peuvent être déplacés et redimensionnés."],
          [/\+ texte/, "Ajouter une zone de texte à la diapositive."],
          [/\+ url/, "Ajouter un média ou un lien depuis une adresse internet."],
          [/exporter zip/, "Télécharger une sauvegarde complète avec les présentations et leurs médias."],
          [/^exporter$/, "Télécharger les données de l’espace au format JSON."],
          [/importer/, "Restaurer un export ZIP ou JSON."],
          [/r[ée]initialiser/, "Repartir du fichier d’exemple initial."],
          [/mode tableau/, "Ouvrir une présentation en mode projection."],
          [/modifier/, "Modifier cet élément."],
          [/supprimer/, "Supprimer définitivement cet élément après confirmation."],
          [/connexion|se connecter/, "Ouvrir la connexion à un espace professeur enregistré."],
          [/d[ée]connexion/, "Fermer la session professeur actuelle."]
        ];
        return explanations.find(([pattern]) => pattern.test(normalized))?.[1] || (label ? `Action : ${label}.` : "Utiliser cette commande.");
      }

      function hideButtonHelp() {
        clearTimeout(buttonHelpTimer);
        buttonHelpTimer = null;
        buttonHelpTarget = null;
        const tooltip = document.querySelector("#buttonHelpTooltip");
        if (tooltip) tooltip.hidden = true;
      }

      function scheduleButtonHelp(button) {
        hideButtonHelp();
        if (!button || button.disabled || button.closest(".sidebar") || button.classList.contains("nav-button")) return;
        buttonHelpTarget = button;
        buttonHelpTimer = setTimeout(() => {
          if (buttonHelpTarget !== button || !button.isConnected) return;
          const tooltip = document.querySelector("#buttonHelpTooltip");
          if (!tooltip) return;
          tooltip.textContent = buttonHelpText(button);
          tooltip.hidden = false;
          const rect = button.getBoundingClientRect();
          const left = Math.max(12, Math.min(window.innerWidth - tooltip.offsetWidth - 12, rect.left + rect.width / 2 - tooltip.offsetWidth / 2));
          const above = rect.top - tooltip.offsetHeight - 10;
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${above >= 12 ? above : Math.min(window.innerHeight - tooltip.offsetHeight - 12, rect.bottom + 10)}px`;
        }, 1500);
      }

      document.addEventListener("mouseover", (event) => {
        const button = event.target.closest("button, label.btn");
        if (button && !button.contains(event.relatedTarget)) scheduleButtonHelp(button);
      });
      document.addEventListener("mouseout", (event) => {
        const button = event.target.closest("button, label.btn");
        if (button && !button.contains(event.relatedTarget)) hideButtonHelp();
      });
      document.addEventListener("mousedown", hideButtonHelp);
      document.addEventListener("scroll", hideButtonHelp, true);
      document.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest("a[target='_blank']");
        if (!link || link.hasAttribute("download")) return;
        openManagedLink(link.href, event);
      });

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
        if (!isLocalFileMode()) await window.ServerAPI.logout().catch(() => {});
        sessionStorage.removeItem(localSessionKey);
        authenticatedUser = null;
        storageInfo = null;
        adminUsers = [];
        adminUsersLoaded = false;
        adminUsersError = "";
        state = ensureDemoData(seedData());
        markStateConfirmed();
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
        hideButtonHelp();
      });
      window.addEventListener("beforeunload", (event) => {
        if (activeSaveLocks === 0) return;
        event.preventDefault();
        event.returnValue = "";
      });

      async function bootstrapApplication() {
        applyInitialRoute();
        if (isLocalFileMode()) {
          const localUsername = sessionStorage.getItem(localSessionKey) || "";
          authenticatedUser = localAuthenticatedUser(localUsername);
          if (authenticatedUser) {
            state = ensureDemoData(loadData());
            markStateConfirmed();
          }
          render();
          const localParams = new URLSearchParams(window.location.search);
          if (localParams.get("board") && isLoggedIn()) {
            setTimeout(() => showBoard(localParams.get("board"), Number(localParams.get("slide") || 0)), 0);
          }
          return;
        }
        try {
          authenticatedUser = await window.ServerAPI.me();
          const workspace = await window.ServerAPI.loadWorkspace();
          const recoveredWorkspace = await window.ServerAPI.replayOfflineDraft(workspace).catch(() => null);
          const effectiveWorkspace = recoveredWorkspace || workspace;
          state = Object.keys(effectiveWorkspace.content || {}).length ? ensureDemoData(effectiveWorkspace.content) : ensureDemoData(seedData());
          const migratedOfficeDocuments = await classifyStoredSlideElements().catch(() => false);
          if (migratedOfficeDocuments) {
            const savedWorkspace = await window.ServerAPI.saveWorkspace(state, true);
            if (savedWorkspace?.content) state = ensureDemoData(savedWorkspace.content);
          }
          storageInfo = await window.ServerAPI.storage().catch(() => null);
          markStateConfirmed();
        } catch {
          authenticatedUser = null;
        }
        render();
        const initialParams = new URLSearchParams(window.location.search);
        if (initialParams.get("board") && isLoggedIn()) {
          setTimeout(() => showBoard(initialParams.get("board"), Number(initialParams.get("slide") || 0)), 0);
        }
      }

      bootstrapApplication();
