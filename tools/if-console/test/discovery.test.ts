import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseEnv } from '../src/model/envfile';
import * as discovery from '../src/services/discovery';
import { SRC_DIR } from './support/paths';

const realFs = {
  readFile: async (p: Loose) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } },
  isExecutable: async (p: Loose) => { try { fs.accessSync(p, fs.constants.X_OK); return fs.statSync(p).isFile(); } catch { return false; } },
};
const walk = (dir: string): string[] => fs.readdirSync(dir).flatMap((n) => (fs.statSync(path.join(dir, n)).isDirectory() ? walk(path.join(dir, n)) : n.endsWith('.ts') ? [path.join(dir, n)] : []));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ifc-disc-'));
const launcher = (root: Loose, name: Loose) => { fs.writeFileSync(path.join(root, name), '#!/bin/sh\n', { mode: 0o755 }); };

test('FR-004: the environment file follows os-release syntax', () => {
  const env = parseEnv('# a comment\nIF_CONSOLE_LAUNCHER=./agora\nQUOTED="a b"\nSINGLE=\'c d\'\n\nNOEQUALS\nBAD KEY=1\nEMPTY=\n');
  assert.deepEqual(env, { IF_CONSOLE_LAUNCHER: './agora', QUOTED: 'a b', SINGLE: 'c d', EMPTY: '' });
});

test('FR-004: a folder is found by its own declaration, with no list of launcher names in the extension', async () => {
  const root = tmp();
  launcher(root, 'tool');
  fs.writeFileSync(path.join(root, '.if-console.env'), 'IF_CONSOLE_LAUNCHER=./tool\n');
  const found = await discovery.discover({ folders: [{ name: 'a', root, raw: null }], personLaunchers: [], fs: realFs });
  assert.equal(found.length, 1);
  assert.equal(found[0].status, 'candidate');
  assert.equal(found[0]?.file, path.join(root, 'tool'));
  assert.equal(found[0].program, './tool');
  assert.equal(found[0].source, 'declared');
});

test('FR-004: a launcher with no declaration is not found, unless the person names it in their own settings', async () => {
  const root = tmp();
  launcher(root, 'tool');
  assert.deepEqual(await discovery.discover({ folders: [{ name: 'a', root, raw: null }], personLaunchers: [], fs: realFs }), []);
  const found = await discovery.discover({ folders: [{ name: 'a', root, raw: null }], personLaunchers: ['tool'], fs: realFs });
  assert.equal(found[0].status, 'candidate');
  assert.equal(found[0].source, 'setting');
});

test('FR-004: a declaration that tries to name something else than its own launcher is rejected', async () => {
  for (const name of ['/usr/bin/env', '../elsewhere/tool', 'sub/tool', '']) {
    const root = tmp();
    fs.writeFileSync(path.join(root, '.if-console.env'), `IF_CONSOLE_LAUNCHER=${name}\nOTHER=./tool\n`);
    const found = await discovery.discover({ folders: [{ name: 'a', root, raw: null }], personLaunchers: [], fs: realFs });
    assert.ok(found.every((f) => f.status === 'rejected'), `${name} must not be accepted: ${JSON.stringify(found)}`);
  }
});

test('FR-004: a declared name that is not an executable file is rejected with the reason', async () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, '.if-console.env'), 'IF_CONSOLE_LAUNCHER=./missing\n');
  const found = await discovery.discover({ folders: [{ name: 'a', root, raw: null }], personLaunchers: [], fs: realFs });
  assert.equal(found[0]?.status, 'rejected');
  assert.match(found[0]?.reason ?? '', /not an executable file/);
});

test('FR-007: each folder is its own repository, even when two launchers share a name', async () => {
  const a = tmp(); const b = tmp();
  for (const r of [a, b]) { launcher(r, 'tool'); fs.writeFileSync(path.join(r, '.if-console.env'), 'IF_CONSOLE_LAUNCHER=tool\n'); }
  const found = await discovery.discover({ folders: [{ name: 'a', root: a, raw: null }, { name: 'b', root: b, raw: null }], personLaunchers: [], fs: realFs });
  assert.equal(found.length, 2);
  assert.notEqual(found[0]?.file, found[1]?.file);
  assert.deepEqual(found.map((f) => f.folder.name), ['a', 'b']);
});

test('FR-004: the extension carries no launcher name: its sources name no repository and no orchestrator', () => {
  const text = walk(SRC_DIR).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(text, /\bagora\b/i);
  assert.doesNotMatch(text, /\beid(olon)?\b/i);
});
