'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const executor = require('../src/executor');
const forms = require('../src/forms');
const { Repository } = require('../src/repository');
const { makeRepo, secondCommandLine } = require('./support/fake-launcher');

const k = secondCommandLine('other');
const folder = (root) => ({ name: 'repo', uri: { toString: () => `file://${root}`, fsPath: root } });

const change = { path: 'widgets/w1.txt', change: 'modify', added: 1, removed: 1, diff: ['--- before', '+++ after', '@@ -1 +1 @@', '-old', '+new'] };
const dryDoc = k.doc('widget', 'w1', { dry_run: true, changes: [change] });
const realDoc = k.doc('widget', 'w1', { dry_run: false, changes: [change] }, { actions: [{ label: 'show it', command: 'widget show', fields: { widget: 'w1' }, category: 'read', surfaces: ['editor'], cli: 'other widget show w1', enabled: true }] });
const invalid = { schema: 'other/error@1', audience: 'private', kind: 'error', id: 'invalid-argument', links: [], actions: [],
  data: { code: 'invalid-argument', message: "name: 'bad' is not a valid name", type: 'TEXT', value: 'bad', examples: ['w1', 'w2'] } };

const docs = {
  'command list': { doc: k.list },
  'command show widget approve': { doc: k.detail('widget approve', 'decision', [k.arg('widget', 'WIDGET', { choices: ['w1', 'w2'] })]) },
  'command show widget new': { doc: k.detail('widget new', 'record', [k.arg('name', 'TEXT')]) },
  'command show widget show': { doc: k.detail('widget show', 'read', [k.arg('widget', 'WIDGET')]) },
  'widget approve w1 --dry-run': { doc: dryDoc },
  'widget approve w1': { doc: realDoc },
  'widget new w9 --dry-run': { doc: dryDoc },
  'widget new w9': { doc: realDoc },
  'widget new bad --dry-run': { doc: invalid, exit: 2 },
  'widget new fixed --dry-run': { doc: dryDoc },
  'widget new fixed': { doc: realDoc },
  'widget new boom --dry-run': { doc: k.doc('error', 'boom', { code: 'internal', message: 'it broke' }, { kind: 'error' }), exit: 1 },
  'widget show w1': { doc: k.doc('widget', 'w1', { name: 'w1' }) },
};

async function fixture(answers) {
  const fake = makeRepo({ docs });
  const repo = new Repository({ folder: folder(fake.root), root: fake.root, file: fake.file, program: './other', trusted: () => true });
  await repo.load();
  const events = [];
  const ui = {
    events,
    reviewChanges: async (o) => { events.push(['review', o.changes.length]); return answers.accept !== false; },
    reviewWithoutFiles: async () => { events.push(['review-nofiles']); return answers.accept !== false; },
    confirmDecision: async (o) => { events.push(['confirm', o.detail.id, o.line]); return answers.confirm === true; },
    showFailure: async (r, d, res) => { events.push(['failure', res.error ? res.error.message : res.failed]); },
    showResult: async (r, d) => { events.push(['result', d.id]); },
    progress: async (title, fn) => fn(new AbortController().signal, () => {}),
    pick: async (o) => answers.picks.shift()(o), input: async (o) => answers.inputs.shift()(o), copy: async () => {},
  };
  return { fake, repo, ui, events };
}
const runs = (fake) => fake.invocations().map((i) => i.argv.filter((a) => a !== '--json').join(' '));

test('FR-014: a write is run with --dry-run first, its changes are shown, and it runs for real only after they are accepted', async () => {
  const { fake, repo, ui, events } = await fixture({ accept: true });
  const detail = await repo.detail('widget new');
  const out = await executor.runArgv(ui, repo, detail, ['widget', 'new', 'w9']);
  assert.equal(out.ran, true);
  const calls = runs(fake).filter((c) => c.startsWith('widget new'));
  assert.deepEqual(calls, ['widget new w9 --dry-run', 'widget new w9']);
  assert.deepEqual(events.slice(0, 1), [['review', 1]]);
  fake.cleanup();
});

test('FR-014: a person who does not accept the diff leaves the write unrun', async () => {
  const { fake, repo, ui } = await fixture({ accept: false });
  const out = await executor.runArgv(ui, repo, await repo.detail('widget new'), ['widget', 'new', 'w9']);
  assert.equal(out.ran, false);
  assert.deepEqual(runs(fake).filter((c) => c.startsWith('widget new')), ['widget new w9 --dry-run']);
  fake.cleanup();
});

test('FR-014: a dry run that fails stops the write, and its error is shown', async () => {
  const { fake, repo, ui, events } = await fixture({ accept: true });
  const out = await executor.runArgv(ui, repo, await repo.detail('widget new'), ['widget', 'new', 'boom']);
  assert.equal(out.ran, false);
  assert.deepEqual(runs(fake).filter((c) => c.startsWith('widget new')), ['widget new boom --dry-run']);
  assert.deepEqual(events.find((e) => e[0] === 'failure'), ['failure', 'it broke']);
  fake.cleanup();
});

test('FR-014: a read or a check runs without a dry run', async () => {
  const { fake, repo, ui } = await fixture({});
  await executor.runArgv(ui, repo, await repo.detail('widget show'), ['widget', 'show', 'w1']);
  assert.deepEqual(runs(fake).filter((c) => c.startsWith('widget show')), ['widget show w1']);
  fake.cleanup();
});

test('FR-015: a decision runs only after the dry run, the diff and a modal confirmation; refused, it is never run for real', async () => {
  const refused = await fixture({ accept: true, confirm: false });
  const out = await executor.runArgv(refused.ui, refused.repo, await refused.repo.detail('widget approve'), ['widget', 'approve', 'w1']);
  assert.equal(out.ran, false);
  assert.equal(out.reason, 'decision not confirmed');
  assert.deepEqual(runs(refused.fake).filter((c) => c.startsWith('widget approve')), ['widget approve w1 --dry-run']);
  assert.deepEqual(refused.events.map((e) => e[0]).slice(0, 2), ['review', 'confirm']);
  assert.equal(refused.events.find((e) => e[0] === 'confirm')[2], './other widget approve w1');
  refused.fake.cleanup();

  const given = await fixture({ accept: true, confirm: true });
  const ran = await executor.runArgv(given.ui, given.repo, await given.repo.detail('widget approve'), ['widget', 'approve', 'w1']);
  assert.equal(ran.ran, true);
  assert.deepEqual(runs(given.fake).filter((c) => c.startsWith('widget approve')), ['widget approve w1 --dry-run', 'widget approve w1']);
  given.fake.cleanup();
});

test('FR-015: confirmation must be exactly true; nothing else a caller passes confirms', async () => {
  for (const wrong of ['yes', 1, {}, null]) {
    const f = await fixture({ accept: true });
    f.ui.confirmDecision = async () => wrong;
    const out = await executor.runArgv(f.ui, f.repo, await f.repo.detail('widget approve'), ['widget', 'approve', 'w1']);
    assert.equal(out.ran, false, `${JSON.stringify(wrong)} must not confirm`);
    f.fake.cleanup();
  }
});

test('FR-015: the module exports no way to run a write or a decision without that path', () => {
  assert.deepEqual(Object.keys(executor).sort(), ['refusedValue', 'runArgv', 'runForm', 'runRead', 'runWrite']);
  // runRead is for reads and checks: a write category routed to it is still not run for real without a dry run, because
  // runArgv chooses by category; the exported runRead is not reachable from any command handler (see never.test.js).
});

test('FR-013: a value the launcher refuses puts the person back at that step with the type\'s message and examples', async () => {
  const prompts = [];
  const picks = [async () => 'run', async () => 'run'];
  const inputs = [async () => 'bad', async (o) => { prompts.push(o.prompt); return 'fixed'; }];
  const { fake, repo, ui } = await fixture({ accept: true, picks, inputs });
  const out = await executor.runForm(ui, repo, 'widget new');
  assert.equal(out.ran, true);
  assert.match(prompts[0], /not a valid name/);
  assert.match(prompts[0], /For example: w1, w2/);
  assert.deepEqual(runs(fake).filter((c) => c.startsWith('widget new')), ['widget new bad --dry-run', 'widget new fixed --dry-run', 'widget new fixed']);
  fake.cleanup();
});

test('FR-013: refusedValue maps an invalid-argument error to the argument of that type', () => {
  const d = { words: ['widget', 'show'], arguments: [{ name: 'widget', type: 'WIDGET' }], options: [{ flag: '--owner', type: 'USER' }] };
  const r = executor.refusedValue(d, { code: 'invalid-argument', type: 'WIDGET', message: 'nope', examples: ['w1'] });
  assert.deepEqual(r, { key: 'widget', message: 'nope For example: w1.' });
  assert.equal(executor.refusedValue(d, { code: 'other', type: 'WIDGET', message: 'x' }), null);
  assert.equal(executor.refusedValue(d, { code: 'invalid-argument', type: 'NOPE', message: 'x' }), null);
});

test('FR-013: the form ends with the whole command line, one line with no placeholder, before anything runs', async () => {
  const seen = [];
  const picks = [async (o) => { seen.push(o.placeholder); return 'copy'; }];
  const inputs = [async () => 'w9'];
  const { fake, repo, ui } = await fixture({ picks, inputs });
  const copied = [];
  ui.copy = async (t) => copied.push(t);
  const out = await executor.runForm(ui, repo, 'widget new');
  assert.equal(out.reason, 'copied');
  assert.deepEqual(seen, ['./other widget new w9']);
  assert.deepEqual(copied, ['./other widget new w9']);
  assert.deepEqual(runs(fake).filter((c) => c.startsWith('widget new')), []);
  fake.cleanup();
});
