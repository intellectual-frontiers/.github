// The extension's build, run by the repository's own build and check of the extension on the Node of the locked package. Never run by hand:
// the packages it imports come from the extension's own npm lock.
//   node esbuild.mjs bundle   dist/extension.js (the extension host's one file), dist/webview.js and dist/panel.css (the panel's own), minified, with their
//                             source maps beside them, which the .vsix leaves out (.vscodeignore); and the codicon font in dist/codicons/
//   node esbuild.mjs test     every file of src/ and test/ as its own CommonJS file in out/, so the unit tests load the code as separate modules
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2];

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'vscode' && dir === 'test' ? [] : sources(p);   // test/vscode is plain JavaScript that VS Code loads
    return p.endsWith('.ts') ? [p] : [];
  });
}

if (mode === 'bundle') {
  rmSync('dist', { recursive: true, force: true });
  const common = { bundle: true, minify: true, sourcemap: true, sourcesContent: false, legalComments: 'none', logLevel: 'warning' };
  await esbuild.build({ ...common, entryPoints: ['src/extension.ts'], outfile: 'dist/extension.js', platform: 'node', format: 'cjs', target: 'node22', external: ['vscode'] });
  await esbuild.build({ ...common, entryPoints: ['src/webview/main.ts'], outfile: 'dist/webview.js', platform: 'browser', format: 'iife', target: 'es2022', external: ['vscode'] });
  await esbuild.build({ ...common, entryPoints: ['src/webview/panel.css'], outfile: 'dist/panel.css', loader: { '.css': 'css' } });
  mkdirSync('dist/codicons', { recursive: true });
  for (const f of ['codicon.css', 'codicon.ttf']) cpSync(join('node_modules', '@vscode', 'codicons', 'dist', f), join('dist', 'codicons', f));
} else if (mode === 'test') {
  rmSync('out', { recursive: true, force: true });
  await esbuild.build({ entryPoints: [...sources('src').filter((f) => !f.includes(`${'src'}/webview/`)), ...sources('test')], outdir: 'out', outbase: '.',
    platform: 'node', format: 'cjs', target: 'node22', sourcemap: 'inline', logLevel: 'warning' });
} else {
  console.error('usage: node esbuild.mjs bundle|test');
  process.exit(2);
}
