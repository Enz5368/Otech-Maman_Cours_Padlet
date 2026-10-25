// Use the engine's layout and guarded transaction lane, never painted DOM or a
// save/reload cycle. Section marks are the native DOCX representation of mixed
// page orientations. The entire change is one undo step.
export function orientPage(editor, orientation, scope = 'page') {
  if (!['portrait', 'landscape'].includes(orientation)) throw new Error('Orientation invalide.');
  if (scope === 'document') {
    const result = editor.exec({ type: 'setPageSetup', orientation, scope: 'document' });
    if (!result.ok) throw new Error('Impossible de modifier l’orientation de ce document.');
    return;
  }
  const surface = editor.surface;
  if (!surface || !editor.snapshot().editable) throw new Error('Le document n’est pas modifiable.');
  const layout = surface.layout();
  const selection = surface.state().selection;
  const index = editor.getCurrentPage('caret') - 1;
  const page = layout.pages[index];
  if (page && (page.box.width > page.box.height) === (orientation === 'landscape')) return;
  // A one-page document, including a table-only page, needs no section cuts.
  if (layout.pages.length === 1) return orientPage(editor, orientation, 'document');
  const fragments = page?.fragments.filter(fragment => !fragment.outOfFlow) || [];
  const first = fragments[0];
  const last = fragments.at(-1);
  if (!first || !last) throw new Error('Cliquez dans le texte de la page à modifier.');
  const previous = layout.pages[index - 1]?.fragments.filter(fragment => !fragment.outOfFlow).at(-1);
  const next = layout.pages[index + 1]?.fragments.filter(fragment => !fragment.outOfFlow)[0];
  if (last.kind !== 'paragraph' || (previous && previous.kind !== 'paragraph')) {
    throw new Error('Pour isoler cette page, ajoutez un paragraphe avant et après le tableau, ou choisissez « Tout le document ».');
  }
  const marks = new Set((layout.sectionBreaks || []).map(mark => mark.paragraphId));
  const ops = [];
  // End first: its stable paragraph id remains valid if the start also splits
  // the same long paragraph. No extra blank paragraph is inserted at a boundary.
  if (next && !(last.paragraphEnd && marks.has(last.paragraphId))) {
    if (!last.paragraphEnd) ops.push({ op: 'splitParagraph', paragraphId: last.paragraphId, offset: last.range.end });
    ops.push({ op: 'setSectionMark', paragraphId: last.paragraphId, breakType: 'nextPage' });
  }
  const original = previous && surface.sectionPropertiesAt(previous.paragraphId);
  for (const paragraphId of new Set(fragments.filter(fragment => fragment.kind === 'paragraph').map(fragment => fragment.paragraphId))) {
    ops.push({ op: 'setSectionProperties', anchorParagraphId: paragraphId, orientation });
  }
  if (previous && !(previous.paragraphEnd && marks.has(previous.paragraphId))) {
    if (!previous.paragraphEnd) ops.push({ op: 'splitParagraph', paragraphId: previous.paragraphId, offset: previous.range.end });
    ops.push({ op: 'setSectionMark', paragraphId: previous.paragraphId, breakType: 'nextPage' });
    ops.push({ op: 'setSectionProperties', anchorParagraphId: previous.paragraphId,
      pageWidthTwips: original.pageSize.widthTwips, pageHeightTwips: original.pageSize.heightTwips,
      orientation: original.landscape ? 'landscape' : 'portrait' });
  }
  const result = surface.applyAutomationOps(() => ops);
  if (result.rejected) throw new Error('Cette page ne peut pas être isolée dans ce document. Aucune modification n’a été appliquée.');
  // The automation lane preserves ids but clamps a caret in a split paragraph
  // to its old head. Map it to the new tail instead of jumping to page one.
  const splits = ops.filter(op => op.op === 'splitParagraph');
  if (result.committed && splits.length) {
    const ids = [...new Set(surface.layout().pages.flatMap(p => p.fragments)
      .filter(fragment => fragment.kind === 'paragraph').map(fragment => fragment.paragraphId))];
    const remap = position => {
      const cuts = splits.filter(op => op.paragraphId === position.paragraphId && op.offset <= position.offset)
        .map(op => op.offset).sort((a,b) => a-b);
      if (!cuts.length) return position;
      return { paragraphId: ids[ids.indexOf(position.paragraphId) + cuts.length], offset: position.offset - cuts.at(-1) };
    };
    editor.exec({ type: 'setSelection', range: { anchor: remap(selection.anchor), head: remap(selection.head) } });
    editor.scrollToPage(index + 1);
  }
}

export function mountOrientationToolbar(element, getEditor, onError) {
  const toolbar = document.createElement('div');
  toolbar.className = 'word-page-orientation';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Orientation des pages');
  toolbar.innerHTML = `<span data-page-label>Orientation</span><label>Appliquer à <select aria-label="Portée de l’orientation"><option value="page">Cette page</option><option value="document">Tout le document</option></select></label><button type="button" data-orientation="portrait">Portrait</button><button type="button" data-orientation="landscape">Paysage</button>`;
  toolbar.addEventListener('mousedown', event => {
    if (event.target.closest('button')) event.preventDefault();
  });
  toolbar.addEventListener('click', event => {
    const button = event.target.closest('[data-orientation]');
    if (!button) return;
    try { orientPage(getEditor(), button.dataset.orientation, toolbar.querySelector('select').value); }
    catch (error) { onError?.(error); }
  });
  element.before(toolbar);
  return {
    update() {
      const editor = getEditor();
      toolbar.querySelector('[data-page-label]').textContent = `Page ${editor?.getCurrentPage('caret') || 1}`;
      const orientation = editor?.snapshot().pageSetup?.orientation;
      for (const button of toolbar.querySelectorAll('button')) {
        button.disabled = !editor?.snapshot().editable;
        button.setAttribute('aria-pressed', String(button.dataset.orientation === orientation));
      }
    },
    destroy() { toolbar.remove(); },
  };
}
