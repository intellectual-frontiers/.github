'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { Launcher } = require('../src/launcher');
const { makeRepo, secondCommandLine } = require('./support/fake-launcher');

const k = secondCommandLine('other');

function launcherFor(repo, log) {
  return new Launcher({ root: repo.root, file: repo.file, program: './other', log: (l) => log.push(l) });
}

test('FR-003, FR-017: a call is `<launcher> ... --json` in the repository root with IF_CONSOLE=1, and the one-line command is logged', async () => {
  const repo = makeRepo({ docs: { 'command list': { doc: k.list } } });
  const log = [];
  const r = await launcherFor(repo, log).run(['command', 'list']);
  assert.equal(r.exit, 0);
  assert.equal(r.doc.kind, 'command-list');
  const [seen] = repo.invocations();
  assert.deepEqual(seen.argv, ['command', 'list', '--json']);
  assert.equal(fs.realpathSync(seen.cwd), fs.realpathSync(repo.root));
  assert.equal(seen.IF_CONSOLE, '1');
  assert.equal(log[0], '$ ./other command list --json');
  assert.ok(log.includes('exit 0'));
  repo.cleanup();
});

test('FR-017: standard error and the exit status are logged; standard output (file contents) is not', async () => {
  const repo = makeRepo({ docs: { 'doctor': { doc: k.doc('doctor', 'x', { status: 'failed', secret: 'DO-NOT-LOG' }), exit: 1, stderr: 'a warning on stderr\n' } } });
  const log = [];
  const r = await launcherFor(repo, log).run(['doctor']);
  assert.equal(r.exit, 1);
  assert.ok(log.includes('a warning on stderr'));
  assert.ok(log.includes('exit 1'));
  assert.ok(!log.join('\n').includes('DO-NOT-LOG'));
  repo.cleanup();
});

test('FR-017: a value with a space or a quote is shown quoted, so the logged line pastes into a terminal', async () => {
  const repo = makeRepo({ docs: { '*': { doc: k.doc('x', 'y', {}) } } });
  const log = [];
  await launcherFor(repo, log).run(['spec', 'show', "a b's"]);
  assert.equal(log[0], "$ ./other spec show 'a b'\\''s' --json");
  repo.cleanup();
});

test('FR-020: a stream is shown as it arrives, one document per line, and the last is the result', async () => {
  const lines = [k.doc('progress', 'a', { message: 'step one' }), k.doc('progress', 'b', { message: 'step two' }), k.doc('result', 'done', { status: 'ok' })];
  const repo = makeRepo({ docs: { 'fresh': { lines, delayMs: 20 } } });
  const seen = [];
  const log = [];
  const r = await launcherFor(repo, log).run(['fresh'], { onDocument: (d) => seen.push(d.data.message || d.data.status) });
  assert.deepEqual(seen, ['step one', 'step two', 'ok']);
  assert.equal(r.docs.length, 3);
  assert.equal(r.doc.id, 'done');
  repo.cleanup();
});

test('FR-020: cancelling ends the launcher\'s process and the output says so', async () => {
  const repo = makeRepo({ docs: { 'test': { hang: true } } });
  const log = [];
  const ac = new AbortController();
  const p = launcherFor(repo, log).run(['test'], { signal: ac.signal });
  setTimeout(() => ac.abort(), 100);
  const r = await p;
  assert.equal(r.cancelled, true);
  assert.ok(log.some((l) => /^cancelled/.test(l)));
  repo.cleanup();
});

test('FR-005: a launcher that does not exist or prints no document is reported, never thrown', async () => {
  const log = [];
  const gone = await new Launcher({ root: '/tmp', file: '/nonexistent/launcher', program: './x', log: (l) => log.push(l) }).run(['command', 'list']);
  assert.ok(gone.failed);
  assert.equal(gone.doc, null);
  const repo = makeRepo({ docs: { '*': { doc: 'this is not json' } } });
  const bad = await launcherFor(repo, []).run(['command', 'list']);
  assert.ok(bad.failed);
  repo.cleanup();
});

test('FR-003: --html is asked for only as a rendering, and the text is returned as is', async () => {
  const repo = makeRepo({ docs: { 'widget show w1': { doc: k.doc('widget', 'w1', {}), html: '<p>w1</p>' } } });
  const r = await launcherFor(repo, []).run(['widget', 'show', 'w1'], { format: 'html' });
  assert.equal(r.stdout, '<p>w1</p>');
  assert.deepEqual(repo.invocations()[0].argv, ['widget', 'show', 'w1', '--html']);
  repo.cleanup();
});
