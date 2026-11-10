import { chromium } from '../word-editor/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import assert from 'node:assert/strict';
import { unzipSync, zipSync, strToU8, strFromU8 } from '../word-editor/node_modules/fflate/esm/browser.js';

const portFinder = createServer();
await new Promise(resolve => portFinder.listen(0, '127.0.0.1', resolve));
const port = portFinder.address().port;
await new Promise(resolve => portFinder.close(resolve));
const temp = await mkdtemp(path.join(tmpdir(), 'mep-padlet-browser-'));
const password = `Test-${crypto.randomUUID()}`;
const python = spawn(process.env.PYTHON || 'python', ['tests/padlet_server.py'], {
  env: { ...process.env, PYTHONPATH: path.resolve('backend'), MEP_ENVIRONMENT: 'test', MEP_DATABASE_URL: `sqlite:///${path.join(temp, 'test.db').replaceAll('\\', '/')}`,
    MEP_USERS_ROOT: path.join(temp, 'users'), MEP_BACKUPS_ROOT: path.join(temp, 'backups'), MEP_LOGS_ROOT: path.join(temp, 'logs'),
    MEP_COOKIE_SECURE: 'false', MEP_ALLOWED_ORIGINS: JSON.stringify([`http://127.0.0.1:${port}`]),
    PADLET_TEST_PASSWORD: password, PADLET_TEST_PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'],
});
let serverErrors = ''; python.stderr.on('data', data => { serverErrors += data; });
const origin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XcAAAAASUVORK5CYII=', 'base64');
let downloads = 0;
page.on('download', () => { downloads += 1; });
const resourceCard = title => page.locator('.padlet-post').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
async function addFile(title, name, mimeType, buffer) {
  await page.getByRole('button', { name: 'Ajouter un fichier', exact: true }).click();
  await page.getByLabel('Titre', { exact: true }).fill(title);
  await page.getByLabel('Importer le fichier').setInputFiles({ name, mimeType, buffer: Buffer.from(buffer) });
  await page.getByRole('button', { name: 'Enregistrer la ressource', exact: true }).click();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
}
function testPdf() {
  const stream = 'BT /F1 18 Tf 50 750 Td (Ciao - Padlet PDF) Tj ET';
  const second = 'BT /F1 18 Tf 50 750 Td (Seconda pagina PDF) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    `<< /Length ${second.length} >>\nstream\n${second}\nendstream`];
  let pdf = '%PDF-1.4\n', offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  return Buffer.from(pdf + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
async function waitServer() {
  for (let i = 0; i < 100; i++) {
    if (python.exitCode !== null) throw new Error(serverErrors);
    try { if ((await fetch(origin + '/health')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Test server did not start: ' + serverErrors);
}
try {
  await waitServer();
  await page.goto(origin);
  await page.getByLabel('Identifiant', { exact: true }).fill('padlet-browser-test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.getByRole('button', { name: 'Ouvrir mes cours', exact: true }).click();
  await page.evaluate(() => openLessonPage('class', 'seq', 'lesson'));
  await page.getByRole('button', { name: 'Créer un Padlet', exact: true }).click();
  await page.getByLabel('Titre', { exact: true }).fill('Italien — ressources de la semaine');
  await page.getByLabel('Défilement').selectOption('horizontal');
  await page.getByLabel('Accès des élèves').selectOption('password');
  await page.getByLabel('Mot de passe (6 caractères minimum)', { exact: true }).fill('Classe-Italie-2026');
  await page.getByRole('button', { name: 'Créer le Padlet', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter un texte', exact: true }).click();
  await page.getByLabel('Titre', { exact: true }).fill('À faire avant mardi');
  await page.getByLabel('Texte', { exact: true }).fill('Lis la consigne, puis regarde les documents. <script>alert(1)</script>');
  await page.getByRole('button', { name: 'Enregistrer la ressource', exact: true }).click();
  await page.getByRole('heading', { name: 'À faire avant mardi', exact: true }).waitFor();
  await addFile('Image du cours', 'cours.png', 'image/png', png);
  await page.getByRole('button', { name: 'Créer un Word', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[data-word-action]').disabled);
  await page.getByLabel('Titre du document', { exact: true }).fill('Consignes Word du Padlet');
  await page.locator('[contenteditable=true]').focus(); await page.keyboard.type('Ciao, les eleves !');
  assert.equal(await page.evaluate(() => WordDocuments.hasChanges()), true);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#wordDocumentStatus').textContent === 'Document enregistré.');
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByRole('heading', { name: 'Consignes Word du Padlet', exact: true }).waitFor();
  const wordSource = await resourceCard('Consignes Word du Padlet').getByRole('link', { name: 'Télécharger', exact: true }).getAttribute('href');
  const originalWord = await (await context.request.get(wordSource)).body();
  await addFile('Word importé comme fichier', 'consignes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', originalWord);
  await addFile('Fiche PDF', 'fiche.pdf', 'application/pdf', testPdf());
  await addFile('Vidéo du cours', 'clip.mp4', 'video/mp4', await readFile('uploads/demo-leonardo.mp4'));
  await addFile('Notes à lire', 'notes.txt', 'text/plain', Buffer.from('Ciao dans le fichier. <script>alert(1)</script>'));
  const pptx = zipSync(Object.fromEntries([1, 2].map(i => [`ppt/slides/slide${i}.xml`, strToU8(`<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:t>Diapo ${i} à lire &lt;img src=x onerror=alert(1)&gt;</a:t></a:p></p:sld>`)])));
  await addFile('PowerPoint à consulter', 'cours.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', pptx);
  const odt = zipSync({ 'content.xml': strToU8('<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><text:p>Bonjour depuis LibreOffice</text:p></office:document-content>') });
  await addFile('Document LibreOffice', 'cours.odt', 'application/vnd.oasis.opendocument.text', odt);
  const audio = Buffer.alloc(1644); audio.write('RIFF'); audio.writeUInt32LE(1636, 4); audio.write('WAVEfmt ', 8);
  audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22); audio.writeUInt32LE(8000, 24);
  audio.writeUInt32LE(16000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(1600, 40);
  await addFile('Écouter le cours', 'cours.wav', 'audio/wav', audio);
  await addFile('Archive du cours', 'cours.zip', 'application/zip', zipSync({ 'notes.txt': strToU8('Ciao') }));
  await page.getByRole('button', { name: 'Ajouter un lien', exact: true }).click();
  await page.getByLabel('Titre', { exact: true }).fill('Dictionnaire');
  await page.getByLabel('Adresse du lien', { exact: true }).fill('https://www.wordreference.com/itfr/ciao');
  await page.getByRole('button', { name: 'Enregistrer la ressource', exact: true }).click();
  await page.getByRole('heading', { name: 'Dictionnaire' }).waitFor();
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByLabel('Défilement').selectOption('vertical');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.locator('.padlet-cards.vertical').waitFor();
  await page.screenshot({ path: 'tests/visual/current-padlet-owner-vertical.png', fullPage: true });
  const first = page.locator('.padlet-post').filter({ has: page.getByRole('heading', { name: 'À faire avant mardi', exact: true }) });
  await first.getByRole('button', { name: 'Masquer', exact: true }).click();
  await first.getByRole('button', { name: 'Afficher', exact: true }).click();
  await first.getByRole('button', { name: 'Après →', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.padlet-post h2')?.textContent === 'Image du cours');
  await page.getByRole('button', { name: 'Réglages', exact: true }).click();
  await page.getByLabel('Défilement').selectOption('horizontal');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.locator('.padlet-cards.horizontal').waitFor();
  await page.getByRole('button', { name: 'Publier', exact: true }).click();
  await page.getByRole('button', { name: 'Dépublier', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Consignes Word du Padlet', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Partager', exact: true }).click();
  const shared = await page.getByLabel('Lien à partager').inputValue();
  await page.getByRole('button', { name: 'Copier le lien', exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), shared);
  await page.getByRole('button', { name: 'Ouvrir', exact: true }).click();
  await page.getByRole('heading', { name: 'Votre Padlet est protégé' }).waitFor();
  assert.equal(context.pages().length, 1);
  // Remove the teacher session: only the visitor grant must authorize the public page and files.
  await context.clearCookies();
  await page.getByLabel('Mot de passe du Padlet').fill('mauvais');
  await page.getByRole('button', { name: 'Accéder au Padlet' }).click();
  await page.getByRole('alert').filter({ hasText: 'Lien ou mot de passe incorrect.' }).waitFor();
  await page.getByLabel('Mot de passe du Padlet').fill('Classe-Italie-2026');
  await page.getByRole('button', { name: 'Accéder au Padlet' }).click();
  await page.getByRole('heading', { name: 'Italien — ressources de la semaine' }).waitFor();
  assert.equal(await page.locator('.padlet-post').count(), 12);
  assert.equal(await page.locator('.padlet-text script').count(), 0);
  await page.waitForFunction(() => {
    const image = document.querySelector('.padlet-post img'); return image?.complete && image.naturalWidth > 0;
  });
  assert.equal(await page.getByRole('button', { name: 'Modifier', exact: true }).count(), 0);
  await page.waitForFunction(() => document.querySelector('.padlet-post video').readyState >= 1);
  assert.equal(await page.getByRole('link', { name: 'Ouvrir le lien', exact: true }).getAttribute('href'), 'https://www.wordreference.com/itfr/ciao');
  await page.getByRole('button', { name: 'Ouvrir le PDF', exact: true }).click();
  await page.locator('.padlet-pdf-dialog canvas[data-rendered=true]').waitFor();
  assert.ok(await page.locator('.padlet-pdf-dialog canvas').evaluate(canvas =>
    canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, i) => i % 4 < 3 && value < 180)));
  await page.getByText('Page 1 sur 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Agrandir le PDF' }).click();
  await page.locator('.padlet-pdf-dialog canvas[data-rendered=true]').waitFor();
  await page.getByRole('button', { name: 'Suivante', exact: true }).click();
  await page.getByText('Page 2 sur 2', { exact: true }).waitFor();
  await page.getByText('Lire le texte de cette page', { exact: true }).click();
  await page.getByText('Seconda pagina PDF', { exact: true }).waitFor();
  await page.screenshot({ path: 'tests/visual/current-padlet-pdf-preview.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'tests/visual/current-padlet-pdf-mobile.png' });
  assert.equal(await page.locator('.padlet-pdf-dialog').evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [title, text] of [['Notes à lire', 'Ciao dans le fichier. <script>alert(1)</script>'],
    ['Document LibreOffice', 'Bonjour depuis LibreOffice'], ['Archive du cours', 'notes.txt']]) {
    const open = resourceCard(title).getByRole('button', { name: 'Voir le fichier', exact: true });
    await open.scrollIntoViewIfNeeded();
    const before = await page.locator('.padlet-cards').evaluate(el => el.scrollLeft);
    await open.click();
    await page.locator('.padlet-file-content').getByText(text, { exact: false }).waitFor();
    assert.equal(await page.locator('.padlet-file-content script').count(), 0);
    await page.getByRole('button', { name: 'Fermer', exact: true }).click();
    assert.ok(Math.abs(await page.locator('.padlet-cards').evaluate(el => el.scrollLeft) - before) < 2, 'Closing a preview must keep the wall position');
  }
  await resourceCard('PowerPoint à consulter').getByRole('button', { name: 'Voir le fichier', exact: true }).click();
  await page.locator('.pptx-preview-slide:visible').getByText('Diapo 1 à lire', { exact: false }).waitFor();
  assert.equal(await page.locator('.padlet-file-content img').count(), 0);
  await page.getByRole('button', { name: 'Suivante', exact: true }).click();
  await page.locator('.pptx-preview-slide:visible').getByText('Diapo 2 à lire', { exact: false }).waitFor();
  await page.screenshot({ path: 'tests/visual/current-padlet-file-preview.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.padlet-file-dialog').evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resourceCard('Word importé comme fichier').getByRole('button', { name: 'Ouvrir le Word', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[data-word-action]').disabled);
  await page.locator('.word-document-shell').getByText('Ciao, les eleves !', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  assert.equal(downloads, 0, 'Reading resources must never start a download');
  assert.equal(context.pages().length, 1);
  const imageUrl = await page.locator('.padlet-post img').getAttribute('src');
  assert.equal((await context.request.get(imageUrl, { headers: { Range: 'bytes=0-7' } })).status(), 206);
  await resourceCard('Consignes Word du Padlet').getByRole('button', { name: 'Ouvrir le Word', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[data-word-action]').disabled);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger .docx' }).click();
  const downloaded = await downloadPromise;
  const bytes = await readFile(await downloaded.path());
  assert.ok(strFromU8(unzipSync(bytes)['word/document.xml']).includes('Ciao, les eleves !'));
  await page.getByRole('button', { name: 'Présenter', exact: true }).click();
  await page.locator('.word-presentation .docx-page-content').waitFor();
  await page.getByRole('button', { name: 'Quitter la présentation' }).click();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.reload();
  await page.getByRole('heading', { name: 'Italien — ressources de la semaine' }).waitFor();
  await mkdir('tests/visual', { recursive: true });
  await page.screenshot({ path: 'tests/visual/current-padlet-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'tests/visual/current-padlet-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Quitter', exact: true }).click();
  await page.getByRole('button', { name: 'Se connecter', exact: true }).waitFor();
  assert.equal((await context.request.get(imageUrl)).status(), 401);
  await page.getByRole('button', { name: 'Ouvrir un Padlet', exact: true }).click();
  await page.getByLabel('Lien ou nom du Padlet', { exact: true }).fill(shared);
  await page.getByRole('button', { name: 'Ouvrir le Padlet', exact: true }).click();
  await page.getByRole('heading', { name: 'Votre Padlet est protégé' }).waitFor();
  assert.equal(context.pages().length, 1);
  assert.deepEqual(errors, []);
  console.log('Padlet real API/browser: generic file previews, PDF pages/zoom, no automatic downloads, scroll preservation, lesson creation, password, image, native Word save/reopen/download/present, publish, anonymous access, XSS, grant persistence/revocation and mobile passed.');
} catch (error) {
  await page.screenshot({ path: 'tests/visual/current-padlet-error.png', fullPage: true });
  console.error(await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close(); python.kill();
}
