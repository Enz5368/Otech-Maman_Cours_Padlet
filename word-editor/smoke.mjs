import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { testPageOrientation } from './orientation-smoke.mjs';
import { testWordPresentation } from './presentation-smoke.mjs';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const harness = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><link rel="stylesheet" href="/assets/styles.css"></head><body>
<div id="editorModal" class="modal" hidden></div><script>
window.state={lesson:{id:'lesson',activities:[]}}; window.uploads=0; window.saves=0; window.failSave=false;
window.requireLogin=()=>true; window.uid=()=>crypto.randomUUID(); window.slugify=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
window.findItem=(type,id)=>type==='lesson'?state.lesson:state.lesson.activities.find(a=>a.id===id);
window.escapeAttr=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
window.createBlank=(_,data)=>({...data,isVisible:true,resources:[]}); window.usesServerStorage=()=>true;
window.readFileAsDataUrl=f=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(f)});
window.ServerAPI={upload:async file=>{uploads++;window.lastBytes=Array.from(new Uint8Array(await file.arrayBuffer()));return {content_url:await readFileAsDataUrl(file)}}};
window.saveData=async()=>{saves++;return !failSave};window.render=()=>{};window.toast=console.log;
window.closeEditor=()=>WordDocuments.requestClose();
</script><script src="/assets/word-documents.js"></script></body></html>`;
const nginx = await readFile(path.join(root, 'nginx/nginx.conf'), 'utf8');
const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)[1];
const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', csp);
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (name === '/test-word') {res.setHeader('Content-Type', 'text/html; charset=utf-8');res.end(harness);return;}
  const file = path.resolve(root, `.${name}`);
  if (!file.startsWith(root + path.sep)) {res.writeHead(403);res.end();return;}
  try {
    const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.ttf':'font/ttf'};
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror', error=>errors.push(error.message));
page.on('console', msg=>{if(msg.type()==='error') console.error(msg.text());});
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/test-word`);
  await page.evaluate(()=>WordDocuments.create('lesson'));
  await page.waitForFunction(()=>!document.querySelector('[data-word-action]').disabled, {timeout:60000});
  await mkdir(path.join(root,'tests/visual'),{recursive:true});
  await page.screenshot({path:path.join(root,'tests/visual/current-word.png')});
  await page.locator('[contenteditable=true]').focus();
  await page.keyboard.type('Cours italien - document modifiable');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+b');
  await page.keyboard.type('Consigne en gras');
  await page.keyboard.press('Control+b');
  for (let i=0;i<38;i++) {await page.keyboard.press('Enter');await page.keyboard.type(`Ligne de cours ${i+1}`);}
  await page.waitForTimeout(300);
  const positions = () => [...document.querySelectorAll('#wordDocumentEditor *')].filter(n=>n.scrollHeight>n.clientHeight+10 && n.clientHeight>100).map(n=>({cls:n.className,top:n.scrollTop}));
  const before = await page.evaluate(positions);
  assert.equal(await page.evaluate(()=>uploads),0);
  assert.equal(await page.evaluate(()=>WordDocuments.save()),true);
  const bytes=await page.evaluate(()=>lastBytes);
  const xml=strFromU8(unzipSync(new Uint8Array(bytes))['word/document.xml']);
  assert.ok(xml.includes('w:document'));
  assert.ok(xml.includes('Cours italien - document modifiable'));
  assert.ok(xml.includes('Consigne en gras'));
  assert.ok(xml.includes('<w:b'));
  assert.ok(xml.includes('11906') && xml.includes('16838'), 'New documents use A4');
  assert.deepEqual(await page.evaluate(positions),before, 'Saving must not reset the viewport');
  assert.equal(await page.evaluate(()=>saves),1);
  assert.equal(await page.evaluate(()=>WordDocuments.hasChanges()),false);
  await page.evaluate(()=>WordDocuments.requestClose());
  await page.evaluate(()=>WordDocuments.open(state.lesson.activities[0].id));
  await page.waitForFunction(()=>!document.querySelector('[data-word-action]').disabled);
  assert.equal(await page.evaluate(()=>WordDocuments.hasChanges()),false,'Reopening without editing stays clean');
  await page.locator('[contenteditable=true]').focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' Texte ajoute apres reouverture');
  await page.evaluate(()=>{window.failSave=true;});
  assert.equal(await page.evaluate(()=>WordDocuments.save()),false);
  assert.equal(await page.evaluate(()=>WordDocuments.hasChanges()),true);
  await page.evaluate(()=>{window.failSave=false;});
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await page.getByRole('button',{name:'Continuer à modifier',exact:true}).click();
  assert.equal(await page.evaluate(()=>WordDocuments.isOpen()),true);
  const uploadsBeforeRetry = await page.evaluate(()=>uploads);
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await page.getByRole('button',{name:'Enregistrer et fermer',exact:true}).click();
  await page.waitForFunction(()=>!WordDocuments.isOpen());
  assert.equal(await page.evaluate(()=>uploads),uploadsBeforeRetry,'Retry reuses the uploaded document');
  const savedBytes = await page.evaluate(()=>lastBytes);
  const savedXml=strFromU8(unzipSync(new Uint8Array(savedBytes))['word/document.xml']);
  assert.ok(savedXml.includes('Texte ajoute apres reouverture'));
  // Import actual DOCX bytes into a new lesson content; do not persist on import.
  await page.evaluate(async bytes=>{
    await WordDocuments.importFile('lesson',new File([new Uint8Array(bytes)],'Cours importe.docx'));
  },savedBytes);
  await page.waitForFunction(()=>!document.querySelector('[data-word-action]').disabled);
  assert.equal(await page.evaluate(()=>uploads),uploadsBeforeRetry);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Télécharger .docx'}).click();
  const download=await downloadPromise;
  const downloaded=new Uint8Array(await readFile(await download.path()));
  assert.ok(strFromU8(unzipSync(downloaded)['word/document.xml']).includes('Texte ajoute apres reouverture'));
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await page.getByRole('button',{name:'Fermer sans enregistrer',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.lesson.activities.length),1);
  // Exercise the real page, API client, saveData and lesson cards as well.
  let workspace={classes:[{id:'class',title:'Italien',isVisible:true,sequences:[{id:'seq',title:'Sequence',isVisible:true,lessons:[{id:'lesson',title:'Seance',isVisible:true,activities:[]}]}]}]};
  let revision=0;
  await page.route('**/api/v1/**',async route=>{
    const req=route.request();const pathname=new URL(req.url()).pathname;
    let payload={};
    if(pathname.endsWith('/auth/me')) payload={id:'test-user',username:'Test',role:'teacher'};
    if(pathname.endsWith('/workspace')) {
      if(req.method()==='PUT') {workspace=req.postDataJSON().content;revision++;}
      payload={content:workspace,revision,schema_version:2};
    }
    if(pathname.endsWith('/files') && req.method()==='POST') {
      const body=req.postDataBuffer();
      const start=body.indexOf('\r\n\r\n')+4;
      const end=body.lastIndexOf('\r\n--');
      payload={content_url:'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,'+body.subarray(start,end).toString('base64')};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?view=classes`);
  await page.waitForFunction(()=>document.querySelector('#appPage').hidden===false);
  await page.evaluate(()=>openLessonPage('class','seq','lesson'));
  await page.getByRole('button',{name:'Créer un Word',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-word-action]').disabled);
  await page.getByRole('textbox',{name:'Titre du document',exact:true}).fill('Vrai document dans la seance');
  await page.locator('[contenteditable=true]').focus();
  await page.keyboard.type('Document lie a ma seance');
  await page.keyboard.press('Control+s');
  await page.waitForFunction(()=>document.querySelector('#wordDocumentStatus').textContent==='Document enregistré.');
  assert.equal(revision,1);
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await page.getByRole('button',{name:'Modifier',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-word-action]').disabled);
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#appPage').hidden===false);
  await page.evaluate(()=>openLessonPage('class','seq','lesson'));
  assert.equal(await page.getByRole('button',{name:'Modifier',exact:true}).count(),1);
  assert.equal(workspace.classes[0].sequences[0].lessons[0].activities[0].contentType,'word');
  await page.screenshot({path:path.join(root,'tests/visual/current-word-lesson.png')});
  assert.deepEqual(errors,[]);
  // Three pages in ONE section: rotating the middle page must isolate it in
  // native OOXML, survive reopen, and stay a manual, undoable edit.
  await page.goto(`http://127.0.0.1:${server.address().port}/test-word`);
  const orientationFiles = unzipSync(new Uint8Array(bytes));
  orientationFiles['word/document.xml'] = strToU8(xml.replace(/<w:body>[\s\S]*<\/w:body>/,
    '<w:body><w:p><w:r><w:t>Premiere page</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:t>Deuxieme page</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:t>Troisieme page</w:t></w:r></w:p>' +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>'));
  await page.evaluate(async data => WordDocuments.importFile('lesson', new File([new Uint8Array(data)], 'Orientations.docx')), Array.from(zipSync(orientationFiles)));
  await page.waitForFunction(()=>!document.querySelector('[data-word-action]').disabled);
  await page.getByText('Deuxieme page',{exact:true}).click();
  await page.getByRole('button',{name:'Paysage',exact:true}).click();
  assert.equal(await page.evaluate(()=>uploads),0, 'Orientation never saves automatically');
  assert.equal(await page.evaluate(()=>WordDocuments.save()),true);
  const mixed = await page.evaluate(()=>lastBytes);
  const mixedXml = strFromU8(unzipSync(new Uint8Array(mixed))['word/document.xml']);
  assert.equal((mixedXml.match(/w:orient="landscape"/g)||[]).length,1);
  assert.equal((mixedXml.match(/<w:sectPr[ >]/g)||[]).length,3);
  await page.evaluate(()=>WordDocuments.requestClose());
  await page.evaluate(()=>WordDocuments.open(state.lesson.activities[0].id));
  await page.waitForFunction(()=>!document.querySelector('[data-word-action]').disabled);
  await page.getByText('Deuxieme page',{exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Paysage',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByText('Premiere page',{exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Portrait',exact:true}).getAttribute('aria-pressed'),'true');
  await page.locator('[contenteditable=true]').focus();
  await page.keyboard.press('Control+End');
  assert.equal(await page.getByRole('button',{name:'Portrait',exact:true}).getAttribute('aria-pressed'),'true');
  await page.screenshot({path:path.join(root,'tests/visual/current-word-orientation.png')});
  await page.evaluate(()=>WordDocuments.requestClose());
  await testPageOrientation(page, bytes);
  await testWordPresentation(page, root);
  assert.deepEqual(errors,[]);
  console.log('DOCX creation, typing, bold formatting, scroll preservation, save/reopen, failed save/retry, close choices, import, native download and real lesson integration with Ctrl+S passed.');
} finally {await browser.close();server.close();}
