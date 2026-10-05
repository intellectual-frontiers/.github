'use strict';
// What the tests in the extension host share: waiting, reading what the extension showed through the test hook, and driving VS Code's own
// quick pick with its own commands.
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const KEY = Symbol.for('if-console.test');
const hook = () => globalThis[KEY];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, what, timeout = 60000, interval = 100) {
  const end = Date.now() + timeout;
  for (;;) {
    const got = await fn();
    if (got) return got;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(interval);
  }
}

// The next quick pick the extension shows after `mark` (a length of hook().shown) that `match` accepts.
const nextQuickPick = (mark, match, what) => waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'quickpick' && match(s)), what);

// Choose the item whose label contains `label`, as a person would: arrow down to it and press Enter.
async function choose(pick, label) {
  const at = pick.items.findIndex((l) => l.includes(label));
  if (at < 0) throw new Error(`the quick pick has no "${label}": ${JSON.stringify(pick.items)}`);
  await sleep(500);
  for (let i = 0; i < at; i += 1) await vscode.commands.executeCommand('workbench.action.quickOpenSelectNext');
  await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
}

// The real command line of the first workspace folder, run as the test's own reference (never through the extension).
function reference(...argv) {
  const root = process.env.IF_CONSOLE_REAL_ROOT;
  const declared = fs.readFileSync(path.join(root, '.if-console.env'), 'utf8').match(/^IF_CONSOLE_LAUNCHER=(.+)$/m)[1].trim();
  const out = cp.execFileSync(path.resolve(root, declared), [...argv, '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

function fixtureLog() {
  const file = path.join(process.env.IF_CONSOLE_FIXTURE_ROOT, '.fake-log.ndjson');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

// package.json with its %key% strings read from package.nls.json, as VS Code shows them.
const manifest = () => {
  const dir = vscode.extensions.getExtension('intellectual-frontiers.if-console').extensionPath;
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const nls = JSON.parse(fs.readFileSync(path.join(dir, 'package.nls.json'), 'utf8'));
  const walk = (v) => {
    if (typeof v === 'string') { const m = /^%(.+)%$/.exec(v); return m ? nls[m[1]] ?? v : v; }
    if (Array.isArray(v)) return v.map(walk);
    return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;
  };
  return walk(raw);
};

module.exports = { KEY, hook, sleep, waitFor, nextQuickPick, choose, reference, fixtureLog, manifest };
