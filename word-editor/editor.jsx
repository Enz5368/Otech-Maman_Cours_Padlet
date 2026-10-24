import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocxEditor } from '@docx-editor.dev/react';
import { packagedFonts } from '@docx-editor.dev/fonts';
import fr from '@docx-editor.dev/i18n/fr';
import { blankDocumentBytes } from '@docx-editor.dev/core/editor';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import '@docx-editor.dev/core/styles/editor.css';

const fonts = packagedFonts();

function blankA4() {
  const files = unzipSync(blankDocumentBytes());
  files['word/document.xml'] = strToU8(strFromU8(files['word/document.xml'])
    .replace(/<w:pgSz\b[^>]*\/>/, '<w:pgSz w:w="11906" w:h="16838"/>'));
  return zipSync(files);
}

// The component mounts once per document. Save never replaces its document prop.
export function mount(element, options) {
  const root = createRoot(element);
  let editor = null;
  let destroyed = false;
  root.render(<DocxEditor
    document={options.bytes ? new Uint8Array(options.bytes) : blankA4()}
    title={options.title} locale="fr-FR" i18n={fr} fonts={fonts} rulers
    mode={options.readOnly ? 'view' : 'edit'} colorMode="light"
    onSave={options.onSave} onOpen={options.onOpen}
    menu={{ preset: false, children: <><DocxEditor.Menu.Format /><DocxEditor.Menu.Insert /></> }}
    onReady={instance => {
      if (destroyed) return;
      editor = instance;
      instance.on('error', error => options.onError?.(error));
      options.onReady?.();
    }}
    onChange={() => { if (editor && !destroyed) options.onChange?.(); }}
  />);
  return {
    async save() {
      if (!editor || destroyed) throw new Error('Le document est encore en cours de chargement.');
      return editor.save();
    },
    destroy() { destroyed = true; editor = null; root.unmount(); },
  };
}
