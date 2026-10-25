const toolOrigin = 'https://monespaceprof.com';

export function decodeTool(href) {
  try {
    const url = new URL(href);
    if (url.origin !== toolOrigin) return null;
    const value = JSON.parse(url.searchParams.get('mepTool'));
    if (!value || !['timer', 'wheel'].includes(value.type) || typeof value.id !== 'string' || value.id.length > 100) return null;
    if (value.type === 'timer' && (!Number.isInteger(value.minutes) || value.minutes < 1 || value.minutes > 120)) return null;
    if (value.type === 'wheel' && (typeof value.classId !== 'string' || value.classId.length > 200)) return null;
    return value;
  } catch { return null; }
}

export function pageTools(page) {
  const found = new Map();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value.kind === 'inlineDrawing' || value.kind === 'anchoredDrawing') {
      const tool = decodeTool(value.hyperlinkHref);
      if (tool) found.set(value.drawingNodeId, tool);
      return;
    }
    for (const key of ['fragments', 'rows', 'cells', 'lines', 'drawings', 'anchoredDrawings', 'header', 'footer']) visit(value[key]);
  };
  visit(page);
  return found;
}

function button(label, action) {
  const node = document.createElement('button');
  node.type = 'button'; node.className = 'btn'; node.textContent = label;
  node.addEventListener('click', action);
  return node;
}

export function createLiveTool(config, groups, runtime) {
  const node = document.createElement('section');
  node.className = 'word-live-tool';
  node.setAttribute('aria-label', config.type === 'timer' ? 'Chronomètre' : 'Roue des élèves');
  const title = document.createElement('strong');
  title.textContent = config.type === 'timer' ? 'Chronomètre' : 'Roue des élèves';
  const display = document.createElement('output');
  display.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div'); actions.className = 'row wrap';
  node.append(title, display, actions);
  let interval;
  if (config.type === 'timer') {
    const state = runtime.get(config.id) || { remaining: config.minutes * 60, deadline: null };
    runtime.set(config.id, state);
    const tick = () => {
      if (state.deadline) state.remaining = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
      if (!state.remaining) state.deadline = null;
      const text = `${String(Math.floor(state.remaining / 60)).padStart(2, '0')}:${String(state.remaining % 60).padStart(2, '0')}`;
      if (display.textContent !== text) display.textContent = text;
    };
    actions.append(button('Démarrer', () => { if (!state.deadline && state.remaining) state.deadline = Date.now() + state.remaining * 1000; tick(); }),
      button('Pause', () => { tick(); state.deadline = null; }),
      button('Réinitialiser', () => { state.deadline = null; state.remaining = config.minutes * 60; tick(); }));
    tick(); interval = setInterval(tick, 250);
  } else {
    const state = runtime.get(config.id) || { counts: {}, last: 'Prêt ?' };
    runtime.set(config.id, state);
    const group = () => groups().find(item => item.id === config.classId);
    title.textContent = `Roue · ${group()?.title || 'Groupe introuvable'}`;
    display.textContent = state.last;
    const launch = button('Lancer', () => {
      const current = group();
      const available = (current?.students || []).filter(name => !current.absences?.includes(name) && (state.counts[name] || 0) < (current.limit || 2));
      if (!available.length) { display.textContent = 'Aucun élève disponible'; return; }
      const name = available[Math.floor(Math.random() * available.length)];
      state.counts[name] = (state.counts[name] || 0) + 1;
      state.last = name; display.textContent = name;
    });
    launch.disabled = !group()?.students?.length;
    actions.append(launch, button('Compteurs à 0', () => { state.counts = {}; state.last = 'Prêt ?'; display.textContent = state.last; }));
  }
  return { node, destroy() { clearInterval(interval); node.remove(); } };
}

export function showLiveTool(config, groups, runtime, parent = document.body) {
  const dialog = document.createElement('dialog'); dialog.className = 'word-tool-dialog';
  dialog.setAttribute('aria-label', 'Outil du document');
  const live = createLiveTool(config, groups, runtime);
  dialog.append(live.node, button('Fermer l’outil', () => dialog.close()));
  dialog.addEventListener('close', () => { live.destroy(); dialog.remove(); }, { once: true });
  parent.append(dialog); dialog.showModal();
  return () => dialog.close();
}

export function chooseWordTool(editor, groups, runtime, parent) {
  const pin = editor.retainSelection();
  const dialog = document.createElement('dialog'); dialog.className = 'word-tool-dialog';
  dialog.setAttribute('aria-label', 'Outils du document Word');
  dialog.innerHTML = `<form><h2>Outils du Word</h2><label>Outil <select name="type"><option value="timer">Chronomètre</option><option value="wheel">Roue des élèves</option></select></label><label data-minutes>Durée en minutes <input name="minutes" type="number" min="1" max="120" value="5" required></label><label data-group hidden>Groupe <select name="classId"></select></label><p class="small">L’outil est utilisable ici et pendant la présentation. Dans le fichier Word téléchargé, sa carte contient un lien pour l’ouvrir sur le site.</p><p role="alert"></p><div class="row wrap"><button class="btn primary" type="submit">Insérer dans le Word</button><button class="btn" type="button" data-cancel>Annuler</button></div></form><div data-existing></div>`;
  const form = dialog.querySelector('form');
  const select = form.elements.classId;
  for (const group of groups()) { const option = document.createElement('option'); option.value = group.id; option.textContent = group.title; select.append(option); }
  form.elements.type.onchange = () => {
    const wheel = form.elements.type.value === 'wheel';
    form.querySelector('[data-minutes]').hidden = wheel;
    form.querySelector('[data-group]').hidden = !wheel;
    form.elements.minutes.disabled = wheel;
  };
  dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
  const tools = pageTools(editor.surface.layout().pages[editor.getCurrentPage('caret') - 1]);
  if (tools.size) {
    const heading = document.createElement('h3'); heading.textContent = 'Utiliser les outils de cette page';
    const existing = dialog.querySelector('[data-existing]'); existing.append(heading);
    for (const config of tools.values()) existing.append(button(config.type === 'timer' ? `Chronomètre · ${config.minutes} min` : 'Roue des élèves', () => showLiveTool(config, groups, runtime, parent)));
  }
  form.onsubmit = async event => {
    event.preventDefault();
    const type = form.elements.type.value;
    if (type === 'wheel' && !select.value) { form.querySelector('[role=alert]').textContent = 'Ajoutez d’abord un groupe dans Groupes Classes.'; return; }
    const config = { id: crypto.randomUUID(), type, ...(type === 'timer' ? { minutes: Number(form.elements.minutes.value) } : { classId: select.value }) };
    const label = type === 'timer' ? `Chronomètre · ${config.minutes} min` : `Roue · ${groups().find(g => g.id === config.classId)?.title || ''}`;
    const canvas = document.createElement('canvas'); canvas.width = 840; canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff6e5'; ctx.fillRect(0, 0, 840, 360);
    ctx.strokeStyle = '#8b243c'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 834, 354);
    ctx.fillStyle = '#711a30'; ctx.font = 'bold 36px Arial'; ctx.fillText(label, 30, 70, 780);
    ctx.font = 'bold 80px Arial'; ctx.fillText(type === 'timer' ? `${String(config.minutes).padStart(2, '0')}:00` : 'À qui le tour ?', 30, 190, 780);
    ctx.font = '24px Arial'; ctx.fillText('Outil interactif · Mon Espace Prof', 30, 285);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const submit = form.querySelector('[type=submit]'); submit.disabled = true;
    try {
      const result = await editor.executeImageCommand({ type: 'insertImage', data: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png', widthPoints: 280, heightPoints: 120,
        title: label, description: label, hyperlink: `${toolOrigin}/?mepTool=${encodeURIComponent(JSON.stringify(config))}` });
      if (!result.ok) throw new Error('Insertion impossible à cet emplacement. Cliquez dans un paragraphe du document.');
      dialog.close();
    } catch (error) { form.querySelector('[role=alert]').textContent = error.message; submit.disabled = false; }
  };
  dialog.addEventListener('close', () => { if (pin) editor.releaseSelection(pin); dialog.remove(); editor.focus(); }, { once: true });
  parent.append(dialog); dialog.showModal();
}
