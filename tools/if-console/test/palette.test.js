'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, defaultDocs, k, action } = require('./support/boot');

test('FR-012, FR-013: Run Command lists every editor command grouped by repository and noun, and builds the form from the typed arguments', async () => {
  const b = await boot();
  let listed;
  b.stub.script.quickPicks.push((items) => { listed = items; return 'widget new'; });          // which command
  b.stub.script.inputs.push(() => 'w9');                                                    // the name
  b.stub.script.quickPicks.push(() => undefined);                                           // the last step: person walks away
  await b.command('runCommand');
  const seps = listed.filter((i) => i.kind === -1).map((i) => i.label);
  assert.deepEqual(seps, ['other: repository-wide', 'other: widget']);
  const ids = listed.filter((i) => i.kind !== -1).map((i) => i.id);
  assert.deepEqual(ids, ['check', 'doctor', 'fresh', 'widget list', 'widget show', 'widget new', 'widget approve']);
  assert.ok(!ids.includes('secret tool') && !ids.includes('mcp serve'));
  const last = b.stub.calls.messages.filter((m) => m.kind === 'quickpick').at(-1);
  assert.equal(last.items[0].description, './other widget new w9', 'the last step shows the whole command line');
  assert.ok(!b.first.invocations().some((i) => i.argv[0] === 'widget' && i.argv[1] === 'new'), 'nothing ran: the person left at the last step');
  b.cleanup();
});

test('FR-013: a typed argument\'s choices come from the noun\'s list command when the type lists none', async () => {
  const b = await boot();
  let choices;
  b.stub.script.quickPicks.push('widget show');
  b.stub.script.quickPicks.push((items) => { choices = items.map((i) => i.value); return 'w2'; });
  b.stub.script.quickPicks.push('run');
  await b.command('runCommand');
  assert.deepEqual(choices, ['w1', 'w2']);
  assert.ok(b.first.invocations().some((i) => i.argv.join(' ') === 'widget show w2 --json'));
  b.cleanup();
});

test('FR-013: Show Command Line gives one pasteable line and runs nothing', async () => {
  const b = await boot();
  b.stub.script.quickPicks.push('widget show');
  b.stub.script.quickPicks.push('w1');
  b.stub.script.infos.push('Copy');
  await b.command('showCommandLine');
  assert.deepEqual(b.stub.calls.clipboard, ['./other widget show w1']);
  assert.ok(!b.first.invocations().some((i) => i.argv.join(' ') === 'widget show w1 --json' && !i.dry));
  b.cleanup();
});

test('FR-024: with checkOnSave on, saving a file runs `check --changed` for its repository; with it off, nothing runs', async () => {
  const b = await boot({ config: { checkOnSave: true } });
  const file = { uri: { fsPath: `${b.first.root}/docs/guide.md` } };
  const before = b.first.invocations().length;
  await b.stub.calls.onSave(file);
  assert.deepEqual(b.first.invocations().slice(before).map((i) => i.argv.join(' ')), ['check --changed --json']);
  b.cleanup();
  const off = await boot({ config: { checkOnSave: false } });
  const n = off.first.invocations().length;
  await off.stub.calls.onSave({ uri: { fsPath: `${off.first.root}/a.md` } });
  assert.equal(off.first.invocations().length, n);
  off.cleanup();
});

test('FR-019: the generators `fresh` reports stale are chores, each with its rewriting action, run through the dry-run diff', async () => {
  const fresh = k.doc('fresh', 'all', { status: 'stale', generators: [] }, { actions: [action('rewrite what theme writes', 'widget approve', 'decision', { widget: 'w1' })] });
  const b = await boot({ docs: defaultDocs({ 'fresh': { doc: fresh, exit: 1 }, 'command show fresh': { doc: k.detail('fresh', 'check', []) } }) });
  b.stub.script.warnings.push(undefined);
  await b.command('fresh');
  const view = b.context.subscriptions.find((s) => s.id === 'if-console.chores').o.treeDataProvider;
  const groups = await view.getChildren((await view.getChildren())[0]);
  const attention = await view.getChildren(groups.find((g) => view.getTreeItem(g).label === 'Needs attention'));
  assert.ok((await Promise.all(attention.map((n) => view.getTreeItem(n).label))).includes('rewrite what theme writes'));
  b.cleanup();
});

test('FR-021: a document in a newer form than the extension knows is never shown; an update is offered', async () => {
  const newer = { ...k.doc('widget', 'w1', {}), schema: 'other/widget@9' };
  const b = await boot({ docs: defaultDocs({ 'widget show w1': { doc: newer } }) });
  b.stub.script.quickPicks.push('widget show');
  b.stub.script.quickPicks.push('w1');
  b.stub.script.quickPicks.push('run');
  await b.command('runCommand');
  const warn = b.stub.calls.messages.find((m) => m.kind === 'warning');
  assert.match(warn.text, /Update the IF Console extension/);
  assert.deepEqual(warn.rest, ['Show Extensions']);
  assert.equal(b.stub.calls.webviews.length, 0, 'nothing unreadable is shown');
  b.cleanup();
});
