import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(root, '../assets/word-editor');
await mkdir(output, { recursive: true });
await build({
  absWorkingDir: root, entryPoints: ['editor.jsx'], outdir: output,
  bundle: true, format: 'esm', splitting: true, minify: true,
  target: 'es2022', define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'linked', sourcemap: false,
  plugins: [{ name: 'local-font-assets', setup(builder) {
    builder.onLoad({ filter: /@docx-editor.dev[\\/]fonts[\\/]dist[\\/].*\.js$/ }, async args => ({
      contents: (await readFile(args.path, 'utf8')).replaceAll('../assets/', './fonts/'), loader: 'js',
    }));
  } }],
});
await cp(path.join(root, 'node_modules/@docx-editor.dev/fonts/assets'), path.join(output, 'fonts'), { recursive: true });
await cp(path.join(root, 'node_modules/@docx-editor.dev/fonts/licenses'), path.join(output, 'fonts/licenses'), { recursive: true });
await cp(path.join(root, 'node_modules/@docx-editor.dev/fonts/THIRD_PARTY_NOTICES.md'), path.join(output, 'fonts/THIRD_PARTY_NOTICES.md'));
await cp(path.join(root, 'node_modules/@docx-editor.dev/core/dist/harfbuzz.wasm'), path.join(output, 'harfbuzz.wasm'));
// Ship the licenses of every dependency with the locally hosted editor.
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
let notices = 'MonEspaceProf — Word editor third-party notices\n\n';
for (const [dir, info] of Object.entries(lock.packages)) {
  if (!dir || info.dev) continue;
  notices += `\n${dir} ${info.version} (${info.license || 'see package'})\n`;
  for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT']) {
    try { notices += await readFile(path.join(root, dir, file), 'utf8'); break; } catch {}
  }
}
await writeFile(path.join(output, 'THIRD-PARTY-LICENSES.txt'), notices);
