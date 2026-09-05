const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
function functionSource(name) {
  const start = source.search(new RegExp(`^      (?:async )?function ${name}\\(`, 'm'));
  assert.notEqual(start, -1, name);
  const rest = source.slice(start);
  const next = rest.slice(1).search(/^      (?:async )?function /m);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

function setup() {
  const activity = {id: 'activity', title: 'Draft', slides: [
    {id: 'slide', wordLayout: 'landscape', elements: []},
  ]};
  const frames = [{dataset: {slideId: 'slide'}}];
  const elements = [];
  const status = {hidden: true};
  const modal = {hidden: false};
  const counters = {requests: 0, renders: 0, locks: 0, prompts: 0};
  let response = async snapshot => ({content: structuredClone(snapshot)});
  const context = vm.createContext({
    state: {activities: [activity]}, lastConfirmedState: {activities: [structuredClone(activity)]},
    studioSavedSnapshot: {id: activity.id, content: ''}, studioSavePending: false,
    pendingWorkspaceSave: Promise.resolve(), freeExampleOpen: false,
    document: {
      querySelector: selector => selector === '#studioSaveStatus' ? status : modal,
      querySelectorAll: selector => selector.endsWith('.slide-frame') ? frames : elements,
    },
    window: {ServerAPI: {saveWorkspace: async snapshot => {counters.requests++; return response(snapshot);}}},
    localStorage: {setItem() {}}, currentCacheKey: () => 'test', usesServerStorage: () => true,
    beginSaveLock: () => {counters.locks++; return () => counters.locks--;},
    markStateConfirmed: snapshot => {context.lastConfirmedState = structuredClone(snapshot || context.state);},
    ensureDemoData: state => state, render: () => counters.renders++, toast() {},
    console: {error() {}}, confirm: () => {counters.prompts++; return true;},
    readSlideElement: element => ({...element}), deduplicateSlideElements: slides => slides,
    uid: () => 'new',
  });
  context.findItem = (_, id) => context.state.activities.find(item => item.id === id);
  for (const name of ['cloneStudioSlides', 'captureStudioSlides', 'studioSnapshot', 'studioHasChanges',
    'stageStudioChanges', 'saveData', 'saveStudio', 'closeEditor']) {
    vm.runInContext(functionSource(name), context);
  }
  context.studioSavedSnapshot.content = context.studioSnapshot();
  return {context, frames, elements, modal, status, counters, respond: fn => {response = fn;}};
}

test('staging stays local; explicit save persists once, preserves layout and does not rerender', async () => {
  const h = setup();
  h.elements.push({id: 'text', slideIndex: 0, value: 'Modified'});
  assert.equal(h.context.studioHasChanges(), true);
  assert.equal(h.context.stageStudioChanges('activity'), true);
  assert.equal(h.counters.requests, 0);
  assert.equal(await h.context.saveStudio('activity'), true);
  assert.equal(h.counters.requests, 1);
  assert.equal(h.counters.renders, 0);
  assert.equal(h.context.lastConfirmedState.activities[0].slides[0].wordLayout, 'landscape');
  assert.equal(h.context.lastConfirmedState.activities[0].slides[0].elements[0].value, 'Modified');
  assert.equal(h.context.studioHasChanges(), false);
  assert.equal(h.status.hidden, false);
  await h.context.closeEditor();
  assert.equal(h.counters.prompts, 0);
  assert.equal(h.modal.hidden, true);
});

test('failed save retains draft and releases lock; retry then close succeeds', async () => {
  const h = setup();
  h.context.state.activities[0].title = 'Keep this title';
  h.elements.push({id: 'text', slideIndex: 0, value: 'Keep this text'});
  h.respond(async () => {throw new Error('offline');});
  await h.context.closeEditor();
  assert.equal(h.modal.hidden, false);
  assert.equal(h.context.state.activities[0].title, 'Keep this title');
  assert.equal(h.context.studioHasChanges(), true);
  assert.equal(h.counters.locks, 0);
  assert.equal(h.context.studioSavePending, false);
  assert.equal(h.status.className, 'studio-save-status error');
  h.respond(async snapshot => ({content: structuredClone(snapshot)}));
  await h.context.closeEditor();
  assert.equal(h.modal.hidden, true);
  assert.equal(h.counters.requests, 2);
});

test('cancel close keeps draft and does not send a request', async () => {
  const h = setup();
  h.elements.push({id: 'text', slideIndex: 0, value: 'Draft'});
  h.context.confirm = () => false;
  await h.context.closeEditor();
  assert.equal(h.modal.hidden, false);
  assert.equal(h.counters.requests, 0);
  assert.equal(h.context.studioHasChanges(), true);
});

test('repeated clicks cannot queue duplicate saves', async () => {
  const h = setup();
  let release;
  const waiting = new Promise(resolve => {release = resolve;});
  h.respond(async snapshot => {await waiting; return {content: snapshot};});
  const first = h.context.saveStudio('activity');
  assert.equal(await h.context.saveStudio('activity'), false);
  release();
  assert.equal(await first, true);
  assert.equal(h.counters.requests, 1);
  assert.equal(h.counters.locks, 0);
});

test('saving after preview captures stored slides without erasing them', async () => {
  const h = setup();
  h.elements.push({id: 'text', slideIndex: 0, value: 'Preview content'});
  h.context.stageStudioChanges('activity');
  h.frames.length = 0;
  h.elements.length = 0;
  await h.context.closeEditor();
  assert.equal(h.context.lastConfirmedState.activities[0].slides[0].elements[0].value, 'Preview content');
  assert.equal(h.modal.hidden, true);
});

test('other explicit workspace saves are not silently suppressed by a studio session', async () => {
  const h = setup();
  assert.equal(await h.context.saveData('Save'), true);
  assert.equal(h.counters.requests, 1);
});

function setupViewport() {
  const h = setup();
  const c = h.context;
  c.state.activities[0].slides = Array.from({length: 6}, (_, i) => ({id: `s${i}`, elements: []}));
  h.frames.splice(0, h.frames.length, ...c.state.activities[0].slides.map(slide => ({dataset: {slideId: slide.id}})));
  const selectors = ['#editorModal', '.studio', '.studio-workspace', '.slide-world', '.slide-thumbnails'];
  const nodes = Object.fromEntries(selectors.map(selector => [selector, {
    scrollTop: 0, scrollLeft: 0,
    scrollTo({top, left}) {this.scrollTop = top; this.scrollLeft = left;},
  }]));
  Object.assign(h.modal, nodes['#editorModal']);
  nodes['#editorModal'] = h.modal;
  nodes['.studio'].dataset = {activityId: 'activity'};
  h.modal.querySelector = () => nodes['.studio'];
  Object.defineProperty(h.modal, 'innerHTML', {set() {
    Object.values(nodes).forEach(node => {node.scrollTop = 0; node.scrollLeft = 0;});
  }});
  c.document.querySelector = selector => nodes[selector] || null;
  c.window.scrollX = 12;
  c.window.scrollY = 200;
  c.window.scrollTo = ({left, top}) => {c.window.scrollX = left; c.window.scrollY = top;};
  Object.assign(c, {
    currentStudioSlideIndex: 3, studioHistoryActivityId: 'activity', studioUndoStack: [], studioRedoStack: [],
    slideSize: {width: 960, height: 540, gap: 36}, requireLogin: () => true,
    findActivity: () => ({activity: c.state.activities[0]}), ensureActivitySlides: activity => activity,
    activityLocationBreadcrumb: () => '', escapeHtml: value => value, escapeAttr: value => value,
    renderSlideThumbnail: () => '', renderStudioSlide: () => '', renderStudioElement: () => '',
    initStudioDrag() {}, initStudioCanvasInput() {}, initStudioTextToolbarVisibility() {},
    hydrateDocumentPreviews() {}, updateStudioHistoryButtons() {},
    selectStudioSlide: index => {c.currentStudioSlideIndex = index;},
    prompt: () => 'Updated', slugify: value => value,
    slideInstruction: () => '', clearStudioSlideDropTargets() {},
  });
  for (const name of ['captureStudioViewport', 'restoreStudioViewport', 'openActivityStudio', 'recordStudioHistory',
    'toggleStudioSlideInstruction', 'renameStudioSlideInstruction', 'renameActivity', 'undoStudioChange',
    'redoStudioChange', 'addSlide', 'deleteStudioSlide', 'moveStudioSlideBy', 'reorderStudioSlide']) {
    vm.runInContext(functionSource(name), c);
  }
  nodes['.slide-world'].scrollTop = 1734;
  nodes['.slide-world'].scrollLeft = 85;
  nodes['.slide-thumbnails'].scrollTop = 250;
  return {...h, nodes};
}

test('show/hide instruction and renaming preserve active slide and exact viewport', async () => {
  const h = setupViewport();
  for (const action of ['toggleStudioSlideInstruction', 'toggleStudioSlideInstruction', 'renameStudioSlideInstruction', 'renameActivity']) {
    await h.context[action]('activity');
    assert.equal(h.context.currentStudioSlideIndex, 3, action);
    assert.equal(h.nodes['.slide-world'].scrollTop, 1734, action);
    assert.equal(h.nodes['.slide-world'].scrollLeft, 85, action);
    assert.equal(h.nodes['.slide-thumbnails'].scrollTop, 250, action);
    assert.equal(h.context.window.scrollY, 200, action);
  }
  assert.equal(h.counters.requests, 0);
});

test('history, add, delete and reorder actions preserve viewport after rebuilding', async () => {
  for (const action of ['undo', 'redo', 'add', 'delete', 'move', 'drag']) {
    const h = setupViewport();
    const c = h.context;
    c.studioUndoStack.push(c.captureStudioSlides('activity'));
    c.studioRedoStack.push(c.captureStudioSlides('activity'));
    if (action === 'undo') await c.undoStudioChange('activity');
    if (action === 'redo') await c.redoStudioChange('activity');
    if (action === 'add') c.addSlide('activity');
    if (action === 'delete') c.deleteStudioSlide('activity', 3);
    if (action === 'move') await c.moveStudioSlideBy(3, 1);
    if (action === 'drag') await c.reorderStudioSlide(4, {preventDefault() {}, dataTransfer: {getData: () => '3'}});
    assert.equal(h.nodes['.slide-world'].scrollTop, 1734, action);
    assert.equal(h.nodes['.slide-world'].scrollLeft, 85, action);
    assert.equal(h.nodes['.slide-thumbnails'].scrollTop, 250, action);
    assert.equal(h.counters.requests, 0, action);
  }
});

test('opening a different activity or a closed editor does not reuse another viewport', () => {
  const h = setupViewport();
  assert.equal(h.context.captureStudioViewport('another'), null);
  h.modal.hidden = true;
  assert.equal(h.context.captureStudioViewport('activity'), null);
});
