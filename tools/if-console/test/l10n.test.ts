// Every user-facing string goes through vscode.l10n (0043-if-console FR-044): the code gives `t(...)` a literal message, the build reads them
// all from the source into l10n/bundle.l10n.json, and no message, placeholder, prompt or button is a bare literal.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { SRC_DIR } from './support/paths';
import { fill, t } from '../src/l10n';

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
}

test('FR-044: t fills {0} and {1} and gives the English where there is no translation', () => {
  assert.equal(t('{0} of {1} passed', 2, 3), '2 of 3 passed');
  assert.equal(fill('{0} {2}', ['a']), 'a {2}', 'a placeholder with no value is left as it is');
  assert.equal(t('No placeholder'), 'No placeholder');
});

test('FR-044: no message, button, prompt or placeholder the person reads is a bare literal in the code', () => {
  const bare: string[] = [];
  for (const file of sources(SRC_DIR)) {
    if (file.includes(`${path.sep}webview${path.sep}`)) continue;   // the page holds no string: the extension sends its labels
    const text = fs.readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (/show(?:Information|Warning|Error)Message\(\s*['`]/.test(line) || /\b(?:placeHolder|placeholder|prompt)\s*:\s*['`]/.test(line)) bare.push(`${path.relative(SRC_DIR, file)}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(bare, [], 'wrap each in t(...)');
});

test('FR-044: every message is a literal the build can read, and its placeholders are numbered from 0', () => {
  const found = new Set<string>();
  for (const file of sources(SRC_DIR)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bt\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/g)) found.add(m[1] ?? m[2] ?? '');
  }
  assert.ok(found.size > 80, `the code has ${found.size} messages`);
  for (const message of found) {
    const numbers = [...message.matchAll(/\{(\d+)\}/g)].map((x) => Number(x[1]));
    const distinct = [...new Set(numbers)].sort((a, b) => a - b);
    assert.deepEqual(distinct, distinct.map((_, k) => k), `${message}: the placeholders are numbered from 0 without a gap`);
    assert.ok(numbers.every((n) => n < 6), message);
  }
});

test('FR-044: the manifest\'s own strings are in package.nls.json, each used and each present', () => {
  const root = path.resolve(SRC_DIR, '..');
  const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const nls = JSON.parse(fs.readFileSync(path.join(root, 'package.nls.json'), 'utf8')) as Record<string, string>;
  const used = new Set([...pkg.matchAll(/"%([^%"]+)%"/g)].map((m) => m[1] as string));
  assert.deepEqual([...used].filter((k) => !(k in nls)), [], 'a key with no entry');
  assert.deepEqual(Object.keys(nls).filter((k) => !used.has(k)), [], 'an entry no key uses');
});
