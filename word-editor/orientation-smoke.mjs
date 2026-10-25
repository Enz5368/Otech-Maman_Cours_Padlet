import assert from 'node:assert/strict';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

export async function testPageOrientation(page, template) {
  const files = unzipSync(new Uint8Array(template));
  const original = strFromU8(files['word/document.xml']);
  async function open(body) {
    files['word/document.xml'] = strToU8(original.replace(/<w:body>[\s\S]*<\/w:body>/,
      `<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>`));
    await page.evaluate(async bytes => {
      window.orientationMount?.destroy();
      document.querySelector('#orientationHost')?.remove();
      const element = document.createElement('div');
      element.id = 'orientationHost';
      element.style.height = '850px';
      document.body.append(element);
      window.orientationErrors = [];
      window.orientationEngine = null;
      const module = await import('/assets/word-editor/editor.js');
      window.orientationMount = module.mount(element, { bytes, title: 'Orientation',
        onReady: editor => { window.orientationEngine = editor; },
        onError: error => orientationErrors.push(error.message) });
    }, Array.from(zipSync(files)));
    await page.waitForFunction(()=>!!window.orientationEngine);
  }
  async function currentText() {
    const bytes = await page.evaluate(async()=>Array.from(new Uint8Array(await orientationEngine.save())));
    return strFromU8(unzipSync(new Uint8Array(bytes))['word/document.xml']);
  }
  const paragraph = text => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  // Natural pagination through the middle of ONE paragraph, both boundaries
  // split it. Text must survive, neighbours retain portrait, Undo is atomic.
  const text = Array.from({length:2200},(_,i)=>`mot${i} `).join('');
  await open(paragraph(text));
  const before = await currentText();
  const count = await page.evaluate(()=>orientationEngine.getTotalPages());
  assert.ok(count >= 3);
  await page.evaluate(()=>{
    const fragment = orientationEngine.surface.layout().pages[1].fragments[0];
    const position = {paragraphId:fragment.paragraphId,offset:fragment.range.start+2};
    orientationEngine.exec({type:'setSelection',range:{anchor:position,head:position}});
    orientationEngine.scrollToPage(2);
  });
  await page.getByRole('button',{name:'Paysage',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>orientationErrors),[]);
  const after = await currentText();
  const renderedText = await page.evaluate(xml => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return [...doc.getElementsByTagName('w:t')].map(n=>n.textContent).join('');
  },after);
  assert.equal(renderedText,text);
  assert.equal((after.match(/w:orient="landscape"/g)||[]).length,1);
  assert.equal((after.match(/<w:sectPr[ >]/g)||[]).length,3);
  assert.ok(await page.evaluate(()=>orientationEngine.getCurrentPage('caret')>=2),'Orientation must not return the caret to page 1');
  await page.evaluate(()=>orientationEngine.exec({type:'undo'}));
  assert.equal(await currentText(),before,'One Undo restores the entire orientation change');
  // A native hard page break must not leave a phantom blank page.
  await open('<w:p><w:r><w:t>Premiere</w:t><w:br w:type="page"/><w:t>Deuxieme</w:t><w:br w:type="page"/><w:t>Troisieme</w:t></w:r></w:p>');
  await page.evaluate(()=>{
    const match = orientationEngine.findMatches('Deuxieme')[0];
    orientationEngine.selectMatch(match);
  });
  await page.getByRole('button',{name:'Paysage',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>orientationErrors),[]);
  assert.equal(await page.evaluate(()=>orientationEngine.getTotalPages()),3,'No extra blank page at hard page breaks');
  // Whole-document option and return to portrait.
  await page.getByRole('combobox',{name:'Portée de l’orientation'}).selectOption('document');
  await page.getByRole('button',{name:'Paysage',exact:true}).click();
  assert.ok(await page.evaluate(()=>orientationEngine.getPageGeometry().every(p=>p.box.width>p.box.height)));
  await page.getByRole('button',{name:'Portrait',exact:true}).click();
  assert.ok(await page.evaluate(()=>orientationEngine.getPageGeometry().every(p=>p.box.width<p.box.height)));
  assert.deepEqual(await page.evaluate(()=>orientationErrors),[]);
  await page.evaluate(()=>{orientationMount.destroy();document.querySelector('#orientationHost').remove();});
  console.log('Per-page orientation: natural pagination, text preservation, atomic undo, manual breaks and whole-document orientation passed.');
}
