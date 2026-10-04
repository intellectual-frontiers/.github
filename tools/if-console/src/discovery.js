'use strict';
// Finding each repository's launcher by that repository's own declaration (0043-if-console FR-004): a workspace folder holds
// `.if-console.env`, whose IF_CONSOLE_LAUNCHER line names an executable file at the folder's root. The extension carries no
// list of launcher names; a person may add names, in their own settings only, for a folder that declares none. Reading the
// declaration needs no trust (0041-command-line FR-062); running the launcher does (FR-006).
const path = require('path');
const { parseEnv } = require('./envfile');

const DECLARATION = '.if-console.env';
const KEY = 'IF_CONSOLE_LAUNCHER';

// A launcher name is a file at the root: no directory above it, no absolute path, nothing that leaves the clone.
function rootRelative(root, name) {
  const clean = String(name || '').trim();
  if (clean === '') return { problem: 'names no launcher' };
  if (path.isAbsolute(clean)) return { problem: `names ${clean}, an absolute path; a launcher is a file at the repository's root` };
  const normal = path.normalize(clean);
  if (normal.startsWith('..') || normal.split(path.sep).includes('..')) {
    return { problem: `names ${clean}, which leaves the repository; a launcher is a file at the repository's root` };
  }
  if (normal.includes(path.sep)) return { problem: `names ${clean}, which is not at the repository's root` };
  return { file: path.join(root, normal), program: `./${normal}` };
}

// `fs` is {readFile(path) -> string|null, isExecutable(path) -> bool}. Returns one entry for each folder that has a candidate:
// {folder, root, status:'candidate'|'rejected', file, program, source:'declared'|'setting', reason}.
async function discover({ folders, personLaunchers, fs }) {
  const out = [];
  for (const folder of folders) {
    const root = folder.root;
    const text = await fs.readFile(path.join(root, DECLARATION));
    const declared = text === null ? null : parseEnv(text)[KEY];
    const names = declared ? [{ name: declared, source: 'declared' }]
      : (personLaunchers || []).map((name) => ({ name, source: 'setting' }));   // a folder that declares none
    for (const { name, source } of names) {
      const r = rootRelative(root, name);
      if (r.problem) { out.push({ folder, root, status: 'rejected', source, reason: `${DECLARATION} ${r.problem}.` }); continue; }
      if (!(await fs.isExecutable(r.file))) {
        out.push({ folder, root, status: 'rejected', source, program: r.program, reason: `${r.program} is not an executable file at the repository's root.` });
        continue;
      }
      out.push({ folder, root, status: 'candidate', source, file: r.file, program: r.program });
    }
  }
  return out;
}

module.exports = { discover, rootRelative, DECLARATION, KEY };
