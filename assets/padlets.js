/* Padlets use the existing teacher session; public readers receive scoped server grants. */
window.Padlets = (() => {
  'use strict';
  let board = null, publicSlug = null, drawVersion = 0, dragId = null;
  const names = { text: 'Texte', image: 'Image', video: 'Vidéo', docx: 'Word', pdf: 'PDF', link: 'Lien', file: 'Fichier' };
  const api = (path, method = 'GET', body) => ServerAPI.request(path, {
    method, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
  });
  const base = id => `/padlets/${encodeURIComponent(id)}`;
  const publicBase = () => `/public/padlets/${encodeURIComponent(publicSlug)}`;
  const node = (tag, text, cls) => {
    const element = document.createElement(tag);
    if (text !== null && text !== undefined) element.textContent = text;
    if (cls) element.className = cls;
    return element;
  };
  const button = (text, action, cls = 'btn') => {
    const result = node('button', text, cls); result.type = 'button';
    result.addEventListener('click', () => Promise.resolve().then(() => action(result)).catch(error => toast(message(error))));
    return result;
  };
  const row = (...children) => { const result = node('div', null, 'row wrap'); result.append(...children); return result; };
  const message = error => Array.isArray(error?.payload?.detail)
    ? error.payload.detail.map(item => item.msg?.replace(/^Value error, /, '') || 'Vérifiez les champs du formulaire.').join(' ')
    : error instanceof TypeError ? 'Connexion impossible. Vérifiez votre accès Internet et réessayez.'
    : typeof error?.message === 'string' ? error.message : 'Connexion impossible. Réessayez.';
  const link = b => new URL(`/padlet/${b.slug}`, location.origin).href;
  const safeUrl = (value, local = false) => {
    if (!value) return '';
    try { const url = new URL(value, location.origin); return ['http:', 'https:'].includes(url.protocol) &&
      !url.username && !url.password && (!local || url.origin === location.origin) ? url.href : ''; } catch { return ''; }
  };
  async function busy(trigger, action) {
    trigger.disabled = true;
    try { return await action(); } finally { trigger.disabled = false; }
  }
  function errorBox(parent, error, retry) {
    const box = node('section', null, 'padlet-state'); box.setAttribute('role', 'alert');
    box.append(node('h2', 'Impossible de charger le Padlet'), node('p', message(error)));
    if (retry) box.append(button('Réessayer', retry));
    if (parent.id === 'padletPublic') box.append(button('Quitter', () => location.assign('/')));
    parent.replaceChildren(box);
  }
  async function home() {
    const version = ++drawVersion;
    const content = document.querySelector('#content');
    content.replaceChildren(node('p', 'Chargement des Padlets…', 'padlet-state'));
    if (!usesServerStorage()) {
      content.replaceChildren(node('section', 'Connectez-vous à votre espace professeur pour créer et partager vos Padlets.', 'padlet-state'));
      return;
    }
    try {
      const items = await api('/padlets');
      if (version !== drawVersion || currentView !== 'padlets') return;
      const selected = new URLSearchParams(location.search).get('padlet');
      if (selected && items.some(item => item.id === selected)) return edit(selected);
      const head = node('section', null, 'padlet-heading');
      head.append(node('div', null), button('Créer un Padlet', () => settings(), 'btn primary'));
      head.firstChild.append(node('h2', 'Des ressources à retrouver à tout moment'),
        node('p', 'Créez un mur, ajoutez vos documents et partagez un seul lien avec vos élèves.'));
      const grid = node('div', null, 'padlet-library');
      for (const item of items) {
        const card = node('article', null, 'padlet-library-card'); card.dataset.background = item.background;
        card.append(node('span', item.is_archived ? 'Archivé' : item.is_published ? 'Publié' : 'Brouillon', 'padlet-status'),
          node('h3', item.title), node('p', item.description || 'Votre mur de ressources'),
          node('p', `${item.layout === 'horizontal' ? 'Mur horizontal' : 'Fil vertical'} · ${item.visibility === 'password' ? 'Avec mot de passe' : 'Public avec lien'}`, 'small'));
        card.append(row(button('Modifier', () => edit(item.id), 'btn primary'),
          button('Partager', () => share(item)), button('Dupliquer', trigger => busy(trigger, async () => {
            const duplicate = await api(`${base(item.id)}/duplicate`, 'POST'); await edit(duplicate.id);
          }))));
        grid.append(card);
      }
      if (!items.length) grid.append(node('p', 'Votre premier Padlet commence ici. Cliquez sur « Créer un Padlet ».', 'padlet-state'));
      content.replaceChildren(head, grid);
    } catch (error) { if (version === drawVersion) errorBox(content, error, home); }
  }
  function field(form, labelText, name, value = '', type = 'text', required = false, maxLength = 200) {
    const label = node('label', null, 'padlet-field'); label.append(node('span', labelText));
    const input = node(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.name = name; input.value = value || ''; input.required = required; input.maxLength = maxLength;
    if (type === 'textarea') input.rows = 4;
    label.append(input); form.append(label); return input;
  }
  function select(form, labelText, name, choices, value) {
    const label = node('label', null, 'padlet-field'); label.append(node('span', labelText));
    const input = node('select'); input.name = name;
    for (const [val, title] of choices) { const option = node('option', title); option.value = val; input.append(option); }
    input.value = value; label.append(input); form.append(label); return input;
  }
  function dialog(title) {
    const result = node('dialog', null, 'padlet-dialog'); result.append(node('h2', title));
    const form = node('form', null, 'padlet-form'); result.append(form);
    let dirty = false;
    form.addEventListener('input', () => { dirty = true; result.dataset.dirty = 'true'; });
    result.addEventListener('cancel', event => {
      if (dirty && !confirm('Fermer sans enregistrer vos modifications ?')) event.preventDefault();
    });
    result.addEventListener('close', () => result.remove(), { once: true });
    document.body.append(result); result.showModal(); return { dialog: result, form };
  }
  function boardPayload(item, extra = {}) {
    const keys = ['title', 'slug', 'description', 'layout', 'visibility', 'background', 'is_published', 'is_archived', 'lesson_id', 'revision'];
    return { ...Object.fromEntries(keys.map(key => [key, item[key]])), ...extra };
  }
  function settings(item = null, lessonId = null) {
    if (!requireLogin()) return;
    if (!usesServerStorage()) return toast('Connectez-vous à votre compte pour partager un Padlet.');
    const ui = dialog(item ? 'Réglages du Padlet' : 'Créer un Padlet');
    const title = field(ui.form, 'Titre', 'title', item?.title, 'text', true);
    const slug = field(ui.form, 'Lien du Padlet', 'slug', item?.slug, 'text', true, 100);
    slug.minLength = 6; slug.pattern = '[a-z0-9]+(-[a-z0-9]+)*';
    let customSlug = Boolean(item); const suffix = crypto.randomUUID().slice(0, 8);
    slug.addEventListener('input', () => { customSlug = true; });
    title.addEventListener('input', () => { if (!customSlug) slug.value = `${slugify(title.value).slice(0, 70) || 'padlet'}-${suffix}`; });
    field(ui.form, 'Description (facultatif)', 'description', item?.description, 'textarea', false, 5000);
    select(ui.form, 'Défilement', 'layout', [['vertical', 'Fil vertical'], ['horizontal', 'Mur horizontal']], item?.layout || 'vertical');
    const visibility = select(ui.form, 'Accès des élèves', 'visibility', [['public', 'Public avec lien'], ['password', 'Protégé par mot de passe']], item?.visibility || 'public');
    const password = field(ui.form, item?.has_password ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe (6 caractères minimum)', 'password', '', 'password', false, 128);
    password.minLength = 6; password.autocomplete = 'new-password';
    const sync = () => { password.parentElement.hidden = visibility.value !== 'password'; password.required = visibility.value === 'password' && !item?.has_password; };
    visibility.addEventListener('change', sync); sync();
    select(ui.form, 'Fond du mur', 'background', [['paper', 'Papier clair'], ['wine', 'Bordeaux'], ['sea', 'Bleu lagon'], ['sage', 'Vert sauge']], item?.background || 'paper');
    const error = node('p', '', 'padlet-error'); error.setAttribute('role', 'alert');
    const save = node('button', item ? 'Enregistrer' : 'Créer le Padlet', 'btn primary'); save.type = 'submit';
    ui.form.append(error, row(save, button('Annuler', () => ui.dialog.close())));
    ui.form.addEventListener('submit', async event => {
      event.preventDefault(); error.textContent = '';
      await busy(save, async () => {
        try {
          const values = Object.fromEntries(new FormData(ui.form));
          if (!values.password || values.visibility !== 'password') delete values.password;
          const payload = { ...(item ? boardPayload(item) : { lesson_id: lessonId }), ...values };
          const saved = await api(item ? base(item.id) : '/padlets', item ? 'PUT' : 'POST', payload);
          ui.dialog.close(); currentView = 'padlets'; await edit(saved.id);
        } catch (cause) { error.textContent = message(cause); }
      });
    });
  }
  async function edit(id, restore = null) {
    const version = ++drawVersion;
    const loaded = await api(base(id));
    if (version !== drawVersion) return;
    board = loaded; currentView = 'padlets';
    document.title = `${loaded.title} · Padlets · Mon Espace Prof`;
    document.querySelector('#openBoardBtn').hidden = true;
    document.querySelector('#pageTitle').textContent = 'Padlets';
    document.querySelector('#pageSubtitle').textContent = 'Préparer et partager vos ressources.';
    document.querySelectorAll('.nav-button[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === 'padlets'));
    const url = new URL(location.href); url.search = ''; url.searchParams.set('view', 'padlets'); url.searchParams.set('padlet', id);
    history.replaceState(null, '', url);
    const content = document.querySelector('#content');
    const toolbar = node('section', null, 'padlet-editor-toolbar');
    const back = button('Tous mes Padlets', () => { history.replaceState(null, '', '/?view=padlets'); setView('padlets'); });
    toolbar.append(row(back, node('span', loaded.is_archived ? 'Archivé' : loaded.is_published ? 'Publié' : 'Brouillon', 'padlet-status')),
      row(button('Réglages', () => settings(board)), button('Partager', () => share(board)),
        button(loaded.is_published ? 'Dépublier' : 'Publier', trigger => busy(trigger, async () => {
          await api(base(id), 'PUT', boardPayload(board, { is_published: !board.is_published })); await refresh();
        }), 'btn primary'), button(loaded.is_archived ? 'Désarchiver' : 'Archiver', trigger => busy(trigger, async () => {
          if (!confirm(loaded.is_archived ? 'Désarchiver ce Padlet ?' : 'Archiver ce Padlet ? Les élèves ne pourront plus le consulter.')) return;
          await api(base(id), 'PUT', boardPayload(board, { is_archived: !board.is_archived })); await refresh();
        })), button('Supprimer', async () => {
          if (!confirm('Supprimer définitivement ce Padlet et ses publications ? Les fichiers de votre cartable seront conservés.')) return;
          await api(base(id), 'DELETE'); history.replaceState(null, '', '/?view=padlets'); setView('padlets');
        }, 'btn danger')));
    const add = node('section', null, 'padlet-add'); add.append(node('strong', 'Ajouter une ressource'));
    for (const [type, name] of Object.entries(names)) add.append(button(`Ajouter ${['image', 'video'].includes(type) ? 'une' : 'un'} ${['docx', 'pdf'].includes(type) ? name : name.toLowerCase()}`, () => resourceForm(type)));
    add.append(button('Créer un Word', () => word(), 'btn create-word-button'));
    const wall = wallNode(loaded, false);
    content.replaceChildren(toolbar, add, wall);
    const deleted = loaded.posts.filter(post => post.is_deleted);
    if (deleted.length) {
      const trash = node('details', null, 'padlet-trash'); trash.append(node('summary', `Corbeille (${deleted.length})`));
      for (const post of deleted) trash.append(row(node('span', post.title), button('Restaurer', async () => {
        await api(`${base(id)}/posts/${post.id}/restore`, 'POST'); await refresh();
      }), button('Supprimer définitivement', async () => {
        if (!confirm('Supprimer définitivement cette publication de la corbeille ?')) return;
        await api(`${base(id)}/posts/${post.id}?permanent=true`, 'DELETE'); await refresh();
      }, 'btn danger')));
      content.append(trash);
    }
    if (restore) { window.scrollTo(restore.x, restore.y); const lane = content.querySelector('.padlet-cards'); lane.scrollLeft = restore.left; }
  }
  function position() { return { x: scrollX, y: scrollY, left: document.querySelector('.padlet-cards')?.scrollLeft || 0 }; }
  const refresh = () => edit(board.id, position());
  async function share(item) {
    const ui = dialog('Partager le Padlet');
    ui.form.append(node('p', item.is_archived ? 'Ce Padlet est archivé. Désarchivez-le pour rendre le lien accessible.' :
      !item.is_published ? 'Ce Padlet est en brouillon. Publiez-le pour que les élèves puissent le consulter.' :
      item.visibility === 'password' ? 'Envoyez le lien et le mot de passe à vos élèves.' : 'Toute personne avec ce lien peut consulter les ressources.'));
    const input = field(ui.form, 'Lien à partager', 'share', link(item)); input.readOnly = true;
    ui.form.append(row(button('Copier le lien', async trigger => {
      try { await navigator.clipboard.writeText(link(item)); trigger.textContent = 'Lien copié'; }
      catch { input.select(); toast('Sélectionnez et copiez le lien.'); }
    }), button('Ouvrir', () => { location.assign(link(item)); }), button('Fermer', () => ui.dialog.close())));
    ui.form.addEventListener('submit', e => e.preventDefault());
  }
  function wallNode(item, publicView) {
    const wall = node('section', null, 'padlet-wall'); wall.dataset.background = item.background;
    const head = node('header', null, 'padlet-wall-head'); head.append(node('h1', item.title));
    if (item.description) head.append(node('p', item.description)); wall.append(head);
    if (item.layout === 'horizontal') wall.append(node('p', 'Faites défiler le mur vers la droite pour découvrir les ressources.', 'padlet-scroll-hint'));
    const cards = node('div', null, `padlet-cards ${item.layout}`); cards.setAttribute('aria-label', 'Ressources du Padlet');
    cards.tabIndex = 0;
    for (const post of item.posts.filter(post => !post.is_deleted)) cards.append(postCard(post, publicView));
    if (!cards.children.length) cards.append(node('p', publicView ? 'Les ressources arrivent bientôt.' : 'Ajoutez votre première ressource avec les boutons ci-dessus.', 'padlet-state'));
    wall.append(cards); return wall;
  }
  function postCard(post, publicView) {
    const card = node('article', null, 'padlet-post'); card.dataset.postId = post.id;
    if (!publicView && !post.is_visible) card.classList.add('padlet-hidden');
    card.append(node('span', `${names[post.type]}${!publicView && !post.is_visible ? ' · Masqué' : ''}`, 'padlet-kind'), node('h2', post.title));
    if (post.instruction) card.append(node('p', post.instruction, 'padlet-instruction'));
    if (post.description) card.append(node('p', post.description));
    if (post.body) card.append(node('div', post.body, 'padlet-text'));
    const source = safeUrl(post.content_url, true);
    if (post.type === 'image' && source) {
      const image = node('img'); image.src = source; image.alt = post.description || post.title; image.loading = 'lazy';
      image.addEventListener('error', () => { image.replaceWith(node('p', 'Image indisponible. Rechargez la page.', 'padlet-error')); });
      card.append(image);
    } else if (post.type === 'video' && source) {
      const video = node('video'); video.controls = true; video.preload = 'metadata'; video.src = source;
      video.setAttribute('aria-label', post.title); video.playsInline = true;
      video.append(node('p', 'Votre navigateur ne peut pas lire cette vidéo. Utilisez Télécharger.'));
      video.addEventListener('error', () => card.append(node('p', 'Cette vidéo ne peut pas être lue dans ce navigateur. Téléchargez-la pour la consulter.', 'padlet-error')));
      card.append(video);
    } else if (post.type === 'video' && post.external_url) {
      const url = safeUrl(post.external_url);
      if (/^https:\/\/(www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}|player\.vimeo\.com\/video\/[0-9]+)$/.test(url)) {
        card.append(button('Lire la vidéo', trigger => {
          const frame = node('iframe'); frame.title = post.title; frame.src = url;
          frame.setAttribute('allow', 'fullscreen; picture-in-picture'); frame.allowFullscreen = true;
          frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation'); trigger.replaceWith(frame);
        }));
      }
    } else if (post.type === 'link') {
      const url = safeUrl(post.external_url);
      if (url) { const a = node('a', 'Ouvrir le lien', 'btn'); a.href = url; a.rel = 'noreferrer'; card.append(a); }
    } else if (source && ['docx', 'pdf'].includes(post.type)) {
      card.append(button(`Ouvrir le ${names[post.type]}`, () => post.type === 'docx' ? word(post, publicView) : previewPdf(post)));
      if (!publicView && post.type === 'docx') card.append(button('Modifier le Word', () => word(post)));
    }
    if (source) {
      const download = node('a', 'Télécharger', 'btn'); download.href = `${source}${source.includes('?') ? '&' : '?'}download=true`;
      download.download = post.file_name || post.title; card.append(download);
    } else if (['image', 'pdf', 'docx', 'file'].includes(post.type)) card.append(node('p', 'Fichier indisponible. Contactez votre professeur.', 'padlet-error'));
    if (!publicView) {
      card.draggable = true;
      card.addEventListener('dragstart', event => { dragId = post.id; event.dataTransfer.setData('text/plain', post.id); });
      card.addEventListener('dragover', event => { if (dragId) event.preventDefault(); });
      card.addEventListener('dragend', () => { dragId = null; });
      card.addEventListener('drop', event => { event.preventDefault(); if (dragId && dragId !== post.id) reorder(dragId, post.id).catch(error => toast(message(error))); dragId = null; });
      const active = board.posts.filter(p => !p.is_deleted);
      const index = active.findIndex(p => p.id === post.id);
      const before = button('← Avant', () => reorder(post.id, active[index - 1]?.id)); before.disabled = index === 0;
      const after = button('Après →', () => reorder(post.id, active[index + 1]?.id)); after.disabled = index === active.length - 1;
      card.append(row(button('Modifier', () => resourceForm(post.type, post)), before, after,
        button(post.is_visible ? 'Masquer' : 'Afficher', async () => {
          await api(`${base(board.id)}/posts/${post.id}`, 'PUT', postPayload(post, { is_visible: !post.is_visible })); await refresh();
        }), button('Supprimer', async () => {
          if (!confirm('Mettre cette ressource dans la corbeille du Padlet ?')) return;
          await api(`${base(board.id)}/posts/${post.id}`, 'DELETE'); await refresh();
        }, 'btn danger')));
    }
    return card;
  }
  function postPayload(post, extra = {}) {
    const keys = ['id', 'type', 'title', 'description', 'instruction', 'body', 'external_url', 'file_id', 'is_visible'];
    return { ...Object.fromEntries(keys.map(key => [key, post[key]])), ...extra };
  }
  async function reorder(id, target) {
    if (!target) return;
    const ids = board.posts.filter(p => !p.is_deleted).map(p => p.id);
    const from = ids.indexOf(id), to = ids.indexOf(target); ids.splice(from, 1); ids.splice(to, 0, id);
    await api(`${base(board.id)}/order`, 'PUT', { ids }); await refresh();
  }
  function resourceForm(type, post = null) {
    const ui = dialog(`${post ? 'Modifier' : 'Ajouter'} : ${names[type]}`);
    field(ui.form, 'Titre', 'title', post?.title, 'text', true);
    field(ui.form, 'Description (facultatif)', 'description', post?.description, 'textarea', false, 5000);
    field(ui.form, 'Consigne (facultatif)', 'instruction', post?.instruction, 'textarea', false, 5000);
    if (type === 'text') field(ui.form, 'Texte', 'body', post?.body, 'textarea', true, 30000);
    if (type === 'video' || type === 'link') field(ui.form, type === 'video' ? 'Lien YouTube ou Vimeo (ou importez une vidéo ci-dessous)' : 'Adresse du lien', 'external_url', post?.external_url, 'url', type === 'link', 2000);
    let upload;
    if (!['text', 'link'].includes(type)) {
      upload = field(ui.form, post?.file_id ? 'Remplacer le fichier (facultatif)' : 'Importer le fichier', 'upload', '', 'file');
      upload.removeAttribute('maxlength');
      upload.accept = ({ image: '.png,.jpg,.jpeg,.gif,.webp', video: 'video/*', docx: '.docx', pdf: '.pdf', file: '.docx,.pdf,.pptx,.odt,.ods,.odp,.png,.jpg,.mp4,.mp3,.txt,.csv,.zip' })[type];
      ui.form.append(node('p', type === 'docx' ? 'Word : 30 Mo maximum.' : 'Fichier : 250 Mo maximum, dans la limite de votre espace.', 'small'));
    }
    let uploadedId = post?.file_id || null, uploadedFile = null;
    const postId = post?.id || crypto.randomUUID();
    const error = node('p', '', 'padlet-error'); error.setAttribute('role', 'alert');
    const save = node('button', 'Enregistrer la ressource', 'btn primary'); save.type = 'submit';
    ui.form.append(error, row(save, button('Annuler', () => ui.dialog.close())));
    ui.form.addEventListener('submit', async event => {
      event.preventDefault(); error.textContent = '';
      await busy(save, async () => {
        try {
          const values = Object.fromEntries(new FormData(ui.form)); delete values.upload;
          if (upload?.files[0] && upload.files[0] !== uploadedFile) {
            const response = await uploadFile(board.id, upload.files[0]);
            uploadedId = response.id; uploadedFile = upload.files[0];
          }
          const payload = { ...(post ? postPayload(post) : {}), ...values, type, id: postId, file_id: uploadedId };
          if (uploadedFile) payload.external_url = '';
          else if (values.external_url) payload.file_id = null;
          await api(post ? `${base(board.id)}/posts/${post.id}` : `${base(board.id)}/posts`, post ? 'PUT' : 'POST', payload);
          ui.dialog.close(); await refresh();
        } catch (cause) { error.textContent = message(cause); }
      });
    });
  }
  function uploadFile(id, file) {
    const form = new FormData(); form.append('upload', file); return api(`${base(id)}/files`, 'POST', form);
  }
  async function word(post = null, publicView = false) {
    const savedPosition = position(), id = board?.id, postId = post?.id || crypto.randomUUID();
    return WordDocuments.openExternal({
      title: post?.title || 'Nouveau document Word', url: post?.content_url,
      readOnly: publicView,
      external: publicView ? {} : {
        upload: file => uploadFile(id, file),
        async save(file) {
          const payload = { ...(post ? postPayload(post) : {}), id: postId, type: 'docx', title: file.title, file_id: file.id };
          const saved = await api(post ? `${base(id)}/posts/${post.id}` : `${base(id)}/posts`, post ? 'PUT' : 'POST', payload);
          board = saved; post = saved.posts.find(p => p.id === postId);
        },
      },
      onClose: () => publicView ? undefined : edit(id, savedPosition),
    });
  }
  function previewPdf(post) {
    const ui = dialog(post.title); ui.dialog.classList.add('padlet-pdf-dialog');
    const frame = node('iframe'); frame.title = post.title; frame.src = safeUrl(post.content_url, true);
    ui.form.append(frame, button('Fermer', () => ui.dialog.close()));
  }
  async function openPublic() {
    document.querySelector('#appPage').hidden = true; document.querySelector('#loginPage').hidden = true;
    document.querySelector('#boardPage').hidden = true;
    const robots = document.querySelector('meta[name=robots]'); if (robots) robots.content = 'noindex, nofollow, noarchive';
    document.querySelector('link[rel=canonical]')?.remove();
    let root = document.querySelector('#padletPublic');
    if (!root) { root = node('main'); root.id = 'padletPublic'; document.body.append(root); }
    try { publicSlug = decodeURIComponent(location.pathname.split('/')[2] || ''); } catch { publicSlug = ''; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSlug)) return errorBox(root, new Error('Ce lien Padlet est invalide.'));
    root.replaceChildren(node('p', 'Chargement du Padlet…', 'padlet-state'));
    try {
      const item = await api(publicBase());
      document.title = `${item.title} · Padlet · Mon Espace Prof`;
      const nav = node('nav', null, 'padlet-public-nav');
      nav.append(node('span', 'Mon Espace Prof · Padlet'), button('Quitter', async () => {
        await api(`${publicBase()}/lock`, 'POST'); location.assign('/');
      }));
      root.replaceChildren(nav, wallNode(item, true));
    } catch (error) {
      if (error.status !== 401) return errorBox(root, error, openPublic);
      const gate = node('section', null, 'padlet-gate');
      gate.append(node('p', 'Mon Espace Prof'), node('h1', 'Votre Padlet est protégé'), node('p', 'Saisissez le mot de passe transmis par votre professeur. Aucun compte n’est nécessaire.'));
      const form = node('form'); const password = field(form, 'Mot de passe du Padlet', 'password', '', 'password', true, 128); password.autocomplete = 'current-password';
      const status = node('p', '', 'padlet-error'); status.setAttribute('role', 'alert');
      const submit = node('button', 'Accéder au Padlet', 'btn primary'); submit.type = 'submit';
      form.append(status, submit); gate.append(form, button('Quitter', () => location.assign('/'))); root.replaceChildren(gate);
      form.addEventListener('submit', async event => {
        event.preventDefault(); status.textContent = '';
        await busy(submit, async () => {
          try { await api(`${publicBase()}/unlock`, 'POST', { password: password.value }); password.value = ''; await openPublic(); }
          catch (cause) { status.textContent = message(cause); password.value = ''; password.focus(); }
        });
      });
    }
  }
  function dashboardShortcut() {
    const actions = document.querySelector('.welcome-actions');
    if (actions && !actions.querySelector('[data-padlet-shortcut]')) {
      const shortcut = button('Mes Padlets', () => setView('padlets')); shortcut.dataset.padletShortcut = ''; actions.append(shortcut);
    }
  }
  function openLinkDialog() {
    const ui = dialog('Ouvrir un Padlet');
    ui.form.append(node('p', 'Collez le lien ou le nom du Padlet transmis par votre professeur.'));
    const input = field(ui.form, 'Lien ou nom du Padlet', 'address', '', 'text', true, 2000);
    const error = node('p', '', 'padlet-error'); error.setAttribute('role', 'alert');
    const go = node('button', 'Ouvrir le Padlet', 'btn primary'); go.type = 'submit';
    ui.form.append(error, row(go, button('Annuler', () => ui.dialog.close())));
    ui.form.addEventListener('submit', event => {
      event.preventDefault();
      const raw = input.value.trim();
      const address = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw) ? `/padlet/${raw}` : raw;
      const url = safeUrl(address, true);
      if (!url || !/^\/padlet\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(new URL(url).pathname)) {
        error.textContent = 'Collez un lien Padlet de Mon Espace Prof ou le nom fourni par votre professeur.'; return;
      }
      ui.dialog.close(); location.assign(url);
    });
  }
  return { home, openPublic, openLinkDialog, createFromLesson: id => settings(null, id), dashboardShortcut,
    hasChanges: () => Boolean(document.querySelector('.padlet-dialog[data-dirty="true"]')) };
})();
