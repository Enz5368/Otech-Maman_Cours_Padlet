/* Native DOCX documents; persistence is only triggered by an explicit save. */
window.WordDocuments = (() => {
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  let session = null;
  let editorModule = null;
  let linkedToolShown = false;

  function groups() {
    return (state.studentClasses || []).map(group => ({ ...group,
      absences: state.tools?.wheelAbsences?.[group.id] || [],
      limit: state.tools?.wheelLimits?.[group.id] || 2,
    }));
  }

  async function openLinkedTool() {
    if (linkedToolShown || !new URLSearchParams(location.search).has('mepTool')) return;
    linkedToolShown = true;
    try {
      const module = await loadModule();
      const config = module.decodeTool(location.href);
      if (config) module.showLiveTool(config, groups, new Map());
    } catch { toast('Impossible d’ouvrir cet outil. Réessayez.'); }
  }

  function setStatus(text, error = false) {
    const node = document.querySelector('#wordDocumentStatus');
    if (node) { node.textContent = text; node.classList.toggle('error', error); }
  }

  function updateButtons() {
    document.querySelectorAll('[data-word-action]').forEach(button => {
      button.disabled = !session?.ready || session.busy;
    });
    const title = document.querySelector('#wordDocumentTitle');
    if (title) title.disabled = Boolean(session?.busy || session?.readOnly);
  }

  async function loadModule() {
    if (!document.querySelector('#wordEditorStyles')) {
      const style = document.createElement('link');
      style.id = 'wordEditorStyles'; style.rel = 'stylesheet';
      style.href = 'assets/word-editor/editor.css?v=1';
      document.head.appendChild(style);
    }
    editorModule ||= import('./word-editor/editor.js?v=4').catch(error => { editorModule = null; throw error; });
    return editorModule;
  }

  async function open(activityId, options = {}) {
    if (!options.readOnly && !requireLogin()) return;
    if (session && !await requestClose()) return;
    const modal = document.querySelector('#editorModal');
    if (!modal.hidden) {
      await closeEditor();
      if (!modal.hidden) return;
    }
    const activity = activityId ? findItem('activity', activityId) : null;
    if (activityId && !activity) return;
    const current = {
      id: activityId || uid('act'), lessonId: options.lessonId || activity?.lessonId,
      title: activity?.title || options.file?.name.replace(/\.docx$/i, '') || 'Nouveau document Word',
      isNew: !activity, dirty: !activity, generation: 0, busy: false, ready: false,
      readOnly: Boolean(options.readOnly), editor: null, pendingUpload: null,
    };
    session = current;
    modal.hidden = false;
    modal.innerHTML = `<section class="word-document-shell">
      <header class="word-document-header">
        <div><label for="wordDocumentTitle">Document Word</label><input id="wordDocumentTitle" aria-label="Titre du document" value="${escapeAttr(current.title)}" ${current.readOnly ? 'disabled' : ''}>
        <p id="wordDocumentStatus" role="status">Chargement du document…</p></div>
        <div class="row wrap">
          ${current.readOnly ? '' : '<button class="btn primary" data-word-action onclick="WordDocuments.save()" disabled>Enregistrer</button>'}
          ${current.readOnly ? '' : '<button class="btn" data-word-action onclick="WordDocuments.tools()" disabled>Outils</button>'}
          <button class="btn primary" data-word-action onclick="WordDocuments.present()" disabled>Présenter</button>
          <button class="btn" data-word-action onclick="WordDocuments.download()" disabled>Télécharger .docx</button>
          <button class="btn" id="wordDocumentClose" onclick="closeEditor()">Fermer</button>
        </div>
      </header>
      <div class="word-document-editor" id="wordDocumentEditor"></div>
      <div class="word-close-prompt" id="wordClosePrompt" hidden role="dialog" aria-modal="true" aria-labelledby="wordCloseTitle">
        <div><h2 id="wordCloseTitle">Enregistrer avant de fermer ?</h2><p>Ce document contient des modifications non enregistrées.</p>
        <div class="row wrap"><button class="btn primary" data-word-close="save">Enregistrer et fermer</button><button class="btn" data-word-close="discard">Fermer sans enregistrer</button><button class="btn" data-word-close="cancel">Continuer à modifier</button></div></div>
      </div>
    </section>`;
    document.querySelector('#wordDocumentTitle').addEventListener('input', event => {
      current.title = event.target.value;
      current.dirty = true;
      setStatus('Modifications non enregistrées.');
    });
    document.querySelector('.word-document-shell').addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault(); event.stopPropagation();
        if (!current.closing) save();
      }
    }, true);
    try {
      const module = await loadModule();
      let bytes;
      if (options.file) bytes = await options.file.arrayBuffer();
      else if (activity?.document?.url) {
        const url = new URL(activity.document.url, location.href);
        if (url.origin !== location.origin && url.protocol !== 'data:') throw new Error('Adresse de document non autorisée.');
        if (url.protocol === 'data:') {
          const encoded = url.href.match(/^data:application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document;base64,([A-Za-z0-9+/=]+)$/);
          if (!encoded) throw new Error('Document local invalide.');
          bytes = Uint8Array.from(atob(encoded[1]), character => character.charCodeAt(0)).buffer;
        } else {
          const response = await fetch(url, { credentials: 'same-origin' });
          if (!response.ok) throw new Error('Impossible de récupérer ce document.');
          bytes = await response.arrayBuffer();
        }
      }
      if (session !== current) return;
      current.editor = module.mount(document.querySelector('#wordDocumentEditor'), {
        bytes, title: current.title, readOnly: current.readOnly, groups,
        onReady() {
          if (session !== current) return;
          current.ready = true;
          setStatus(current.dirty ? 'Document non enregistré. Cliquez sur Enregistrer pour le garder dans la séance.' : 'Document ouvert.');
          updateButtons();
          if (options.present) requestAnimationFrame(() => { if (session === current) current.editor?.present(); });
        },
        onChange() {
          if (session !== current || current.readOnly) return;
          current.dirty = true; current.generation++;
          setStatus('Modifications non enregistrées.');
        },
        onSave: () => save(),
        onOpen: () => setStatus('Pour ajouter un autre document, utilisez « Importer un Word » dans la séance.'),
        onError: error => { if (session === current) setStatus(error.message || 'Impossible de lire ce document.', true); },
      });
    } catch (error) {
      if (session === current) setStatus(`Ouverture impossible : ${error.message}`, true);
    }
  }

  async function save() {
    const current = session;
    if (!current?.ready || current.busy || current.readOnly) return false;
    const title = current.title.trim();
    if (!title) { setStatus('Donnez un titre au document.', true); return false; }
    current.busy = true;
    updateButtons();
    document.querySelector('#wordDocumentEditor').inert = true;
    setStatus('Enregistrement en cours…');
    let generation = current.generation;
    let lesson, previous, added = false;
    try {
      if (!current.pendingUpload || current.pendingUpload.generation !== generation) {
        const bytes = await current.editor.save();
        // Serialization can commit pending editor input before producing the DOCX.
        generation = current.generation;
        const file = new File([bytes], `${slugify(title) || 'document'}.docx`, { type: mime });
        const uploaded = usesServerStorage()
          ? await window.ServerAPI.upload(file)
          : { content_url: await readFileAsDataUrl(file) };
        current.pendingUpload = { generation, url: uploaded.content_url, fileName: file.name };
      }
      let activity = findItem('activity', current.id);
      if (current.isNew && !activity) {
        lesson = findItem('lesson', current.lessonId);
        if (!lesson) throw new Error('La séance a été supprimée. Téléchargez le document pour le conserver.');
        activity = { ...createBlank('activity', { lessonId: current.lessonId }), id: current.id, slides: [] };
        lesson.activities.push(activity);
        added = true;
      }
      if (!activity) throw new Error('Ce contenu a été supprimé.');
      previous = { ...activity };
      Object.assign(activity, {
        title, slug: slugify(title), contentType: 'word', description: 'Document Word modifiable',
        document: { url: current.pendingUpload.url, fileName: current.pendingUpload.fileName },
        updatedAt: new Date().toISOString(),
      });
      if (!await saveData('Document Word enregistré.', null, true)) throw new Error('Le serveur n’a pas confirmé l’enregistrement. Réessayez : votre document reste ouvert.');
      current.isNew = false;
      current.dirty = current.generation !== generation;
      setStatus(current.dirty ? 'Document enregistré. De nouvelles modifications restent à enregistrer.' : 'Document enregistré.');
      return true;
    } catch (error) {
      if (added && lesson) lesson.activities = lesson.activities.filter(item => item.id !== current.id);
      else if (previous) {
        const activity = findItem('activity', current.id);
        if (activity) { for (const key of Object.keys(activity)) delete activity[key]; Object.assign(activity, previous); }
      }
      setStatus(error.message || 'Enregistrement impossible. Réessayez.', true);
      return false;
    } finally {
      current.busy = false;
      if (session === current) {
        document.querySelector('#wordDocumentEditor').inert = false;
        updateButtons();
      }
    }
  }

  async function download() {
    if (!session?.ready || session.busy) return;
    try {
      const bytes = await session.editor.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const link = document.createElement('a');
      link.href = url; link.download = `${slugify(session.title) || 'document'}.docx`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setStatus(`Téléchargement impossible : ${error.message}`, true); }
  }

  async function requestClose() {
    const current = session;
    if (!current) return true;
    if (current.busy || current.closing) return false;
    if (current.dirty) {
      current.closing = true;
      const prompt = document.querySelector('#wordClosePrompt');
      const editor = document.querySelector('#wordDocumentEditor');
      prompt.hidden = false; editor.inert = true;
      const choice = await new Promise(resolve => {
        prompt.querySelectorAll('[data-word-close]').forEach(button => {
          button.onclick = () => resolve(button.dataset.wordClose);
          button.disabled = button.dataset.wordClose === 'save' && !current.ready;
        });
        prompt.querySelector('[data-word-close="cancel"]').focus({ preventScroll: true });
      });
      prompt.hidden = true; editor.inert = false; current.closing = false;
      if (choice === 'cancel') return false;
      if (choice === 'save' && (!await save() || current.dirty)) return false;
    }
    current.editor?.destroy();
    session = null;
    document.querySelector('#editorModal').hidden = true;
    render();
    return true;
  }

  async function importFile(lessonId, file) {
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) { toast('Choisissez un fichier .docx. Pour un .doc ou .odt, enregistrez-le au format .docx dans Word ou LibreOffice.'); return; }
    if (file.size > 30 * 1024 * 1024) { toast('Ce document dépasse la limite de 30 Mo de l’éditeur.'); return; }
    await open(null, { lessonId, file });
  }

  return {
    create: lessonId => open(null, { lessonId }), importFile, open, save, download, requestClose,
    tools: () => { if (session?.ready && !session.busy && !session.readOnly && !session.closing) session.editor.tools(); },
    present: activityId => activityId ? open(activityId, { readOnly: true, present: true }) : (session?.ready && !session.busy && !session.closing ? session.editor.present() : undefined),
    openLinkedTool,
    isOpen: () => Boolean(session), hasChanges: () => Boolean(session?.dirty || session?.busy),
  };
})();
