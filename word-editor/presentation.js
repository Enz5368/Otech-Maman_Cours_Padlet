import { pageTools, createLiveTool } from './word-tools.js';

// Clone the engine's already-painted page: fonts, images and DOCX layout stay
// identical to the editor. Presentation never saves, reloads or edits the file.
export function presentWord(editor, element, groups, runtime, onClose) {
  const overlay = document.createElement('section');
  overlay.className = 'word-presentation'; overlay.tabIndex = -1;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Présentation du Word');
  overlay.innerHTML = `<div class="word-presentation-stage"><div class="word-presentation-page"></div></div><nav aria-label="Pages du Word"><button class="btn" data-prev>← Précédente</button><span data-count aria-live="polite"></span><button class="btn" data-next>Suivante →</button><button class="btn" data-fullscreen>Plein écran</button><button class="btn" data-close>Quitter la présentation</button></nav><p class="word-presentation-error" role="alert"></p>`;
  const parent = element.closest('.word-document-shell') || element.parentElement;
  parent.append(overlay);
  const priorInert = element.inert;
  element.inert = true;
  const scrolls = [...element.querySelectorAll('*')].filter(node => node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)
    .map(node => ({ node, top: node.scrollTop, left: node.scrollLeft }));
  let page = Math.max(1, editor.getCurrentPage('caret'));
  let closed = false, request = 0, lives = [];
  const stage = overlay.querySelector('.word-presentation-stage');
  const holder = overlay.querySelector('.word-presentation-page');
  function fit() {
    const sheet = holder.firstElementChild;
    if (!sheet) return;
    const width = Number(holder.dataset.width), height = Number(holder.dataset.height);
    const scale = Math.min((stage.clientWidth - 24) / width, (stage.clientHeight - 24) / height);
    holder.style.width = `${width}px`; holder.style.height = `${height}px`;
    holder.style.transform = `scale(${Math.max(.05, scale)})`;
  }
  async function show(target) {
    const token = ++request;
    page = Math.max(1, Math.min(editor.getTotalPages(), target));
    overlay.querySelector('[data-count]').textContent = `${page} / ${editor.getTotalPages()}`;
    overlay.querySelector('[data-prev]').disabled = page === 1;
    overlay.querySelector('[data-next]').disabled = page === editor.getTotalPages();
    editor.scrollToPage(page);
    // Materialization is queued by the engine's virtual viewport.
    let source;
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (closed || token !== request) return;
      source = element.querySelector(`[data-page-index="${page - 1}"]`);
      if (source?.querySelector('.docx-page-content')) break;
    }
    if (!source?.querySelector('.docx-page-content')) { overlay.querySelector('[role=alert]').textContent = 'Cette page n’a pas pu être affichée. Réessayez avec les flèches.'; return; }
    overlay.querySelector('[role=alert]').textContent = '';
    lives.forEach(live => live.destroy()); lives = [];
    const rect = source.getBoundingClientRect();
    const clone = source.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.position = 'relative'; clone.style.top = '0'; clone.style.left = '0';
    clone.style.margin = '0'; clone.style.transform = 'none';
    for (const child of clone.querySelectorAll('[contenteditable], [id], [tabindex]')) {
      child.removeAttribute('id'); child.removeAttribute('contenteditable'); child.removeAttribute('tabindex');
    }
    clone.removeAttribute('aria-hidden');
    holder.dataset.width = rect.width; holder.dataset.height = rect.height;
    holder.replaceChildren(clone);
    const tools = pageTools(editor.surface.layout().pages[page - 1]);
    for (const [id, config] of tools) {
      const drawing = [...clone.querySelectorAll('[data-drawing-node-id]')].find(node => node.dataset.drawingNodeId === id);
      if (!drawing) continue;
      const live = createLiveTool(config, groups, runtime); lives.push(live);
      const cover = document.createElement('div'); cover.className = 'word-presentation-tool';
      cover.append(live.node); drawing.append(cover);
      cover.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
    }
    fit();
  }
  function close() {
    if (closed) return;
    closed = true; request++;
    observer.disconnect(); lives.forEach(live => live.destroy());
    if (document.fullscreenElement === overlay) document.exitFullscreen().catch(() => {});
    overlay.remove(); element.inert = priorInert;
    for (const {node, top, left} of scrolls) { node.scrollTop = top; node.scrollLeft = left; }
    onClose?.();
  }
  overlay.querySelector('[data-prev]').onclick = () => show(page - 1);
  overlay.querySelector('[data-next]').onclick = () => show(page + 1);
  overlay.querySelector('[data-close]').onclick = close;
  overlay.querySelector('[data-fullscreen]').onclick = () => {
    if (document.fullscreenElement === overlay) document.exitFullscreen().catch(() => {});
    else overlay.requestFullscreen?.().catch(() => {});
  };
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (!event.target.closest('input, select, textarea') && ['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation(); show(page + (['ArrowRight','PageDown'].includes(event.key) ? 1 : -1));
    } else if (event.key === 'Tab') {
      const buttons = [...overlay.querySelectorAll('button:not(:disabled)')];
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
    }
  });
  const observer = new ResizeObserver(fit); observer.observe(stage);
  overlay.focus(); show(page);
  return { close };
}
