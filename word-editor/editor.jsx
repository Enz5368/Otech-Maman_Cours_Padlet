import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocxEditor } from '@docx-editor.dev/react';
import { packagedFonts } from '@docx-editor.dev/fonts';
import fr from '@docx-editor.dev/i18n/fr';
import { blankDocumentBytes } from '@docx-editor.dev/core/editor';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import '@docx-editor.dev/core/styles/editor.css';
import { mountOrientationToolbar } from './page-orientation.js';
import { chooseWordTool } from './word-tools.js';
import { presentWord } from './presentation.js';
export { decodeTool, showLiveTool } from './word-tools.js';

const fonts = packagedFonts();

function blankA4() {
  const files = unzipSync(blankDocumentBytes());
  files['word/document.xml'] = strToU8(strFromU8(files['word/document.xml'])
    .replace(/<w:pgSz\b[^>]*\/>/, '<w:pgSz w:w="11906" w:h="16838"/>')
    // Zero twip margins: let the document use the full A4 sheet.
    .replace(/<w:pgMar\b[^>]*\/>/, '<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/>'));
  return zipSync(files);
}

// The component mounts once per document. Save never replaces its document prop.
export function mount(element, options) {
  element.classList.add('word-document-editor');
  const canvas = document.createElement('div');
  canvas.className = 'word-document-canvas';
  element.append(canvas);
  const root = createRoot(canvas);
  let editor = null;
  let destroyed = false;
  const orientation = options.readOnly ? null : mountOrientationToolbar(canvas, () => editor, options.onError);
  orientation?.update();
  const subscriptions = [];
  const runtime = new Map();
  let presentation = null;
  root.render(<DocxEditor
    document={options.bytes ? new Uint8Array(options.bytes) : blankA4()}
    title={options.title} locale="fr-FR" i18n={fr} fonts={fonts} rulers
    mode={options.readOnly ? 'view' : 'edit'} colorMode="light"
    onSave={options.onSave} onOpen={options.onOpen}
    menu={{ preset: false, children: <><DocxEditor.Menu.Format /><DocxEditor.Menu.Insert /></> }}
    onReady={instance => {
      if (destroyed) return;
      editor = instance;
      orientation?.update();
      subscriptions.push(instance.on('selectionChange', () => orientation?.update()));
      subscriptions.push(instance.on('change', () => orientation?.update()));
      instance.on('error', error => options.onError?.(error));
      options.onReady?.(instance);
    }}
    onChange={() => { if (editor && !destroyed) options.onChange?.(); }}
  />);
  return {
    tools() { if (editor && !destroyed) chooseWordTool(editor, options.groups || (() => []), runtime, element.closest('.word-document-shell') || element); },
    present() {
      if (!editor || destroyed || presentation) return;
      presentation = presentWord(editor, element, options.groups || (() => []), runtime, () => { presentation = null; });
    },
    async save() {
      if (!editor || destroyed) throw new Error('Le document est encore en cours de chargement.');
      return editor.save();
    },
    destroy() { destroyed = true; presentation?.close(); subscriptions.forEach(unsubscribe => unsubscribe()); orientation?.destroy(); editor = null; root.unmount(); canvas.remove(); },
  };
}
