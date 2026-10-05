// Where the extension's own files are, from a test compiled into out/test or out/test/support (the stage the tests run in).
import * as fs from 'fs';
import * as path from 'path';

/** The extension's directory in the stage: package.json, src/ (TypeScript) and out/ (what the tests run). */
export const EXT_ROOT = path.resolve(__dirname, __dirname.includes(`${path.sep}support`) ? '../../..' : '../..');
export const SRC_DIR = path.join(EXT_ROOT, 'src');

/** package.json with its `%key%` strings read from package.nls.json, as VS Code shows them (0043 FR-044). */
export function readManifest(): Record<string, any> {
  const raw = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, 'package.json'), 'utf8')) as unknown;
  const nlsFile = path.join(EXT_ROOT, 'package.nls.json');
  const nls = fs.existsSync(nlsFile) ? JSON.parse(fs.readFileSync(nlsFile, 'utf8')) as Record<string, string> : {};
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') { const m = /^%(.+)%$/.exec(v); return m ? nls[m[1] as string] ?? v : v; }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(raw) as Record<string, any>;
}
