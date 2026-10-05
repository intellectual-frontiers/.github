import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import { boot, defaultDocs, k } from './support/boot';

test('FR-012, FR-013: Run Command lists every editor command grouped by repository and noun, and builds the form from the typed arguments', async () => {
  const b = await boot();
  let listed: Loose;
  b.stub.script.quickPicks.push((items: Loose) => { listed = items; return 'widget new'; });          // which command
  b.stub.script.inputs.push(() => 'w9');                                                    // the name
  b.stub.script.quickPicks.push(() => undefined);                                           // the last step: person walks away
  await b.command('runCommand');
  const seps = listed.filter((i: Loose) => i.kind === -1).map((i: Loose) => i.label);
  assert.deepEqual(seps, ['other: repository-wide', 'other: widget']);
  const ids = listed.filter((i: Loose) => i.kind !== -1).map((i: Loose) => i.id);
  assert.deepEqual(ids, ['check', 'doctor', 'fresh', 'widget list', 'widget show', 'widget new', 'widget approve']);
  const withTitle = listed.find((i: Loose) => i.id === 'widget show');
  assert.match(withTitle.description, /^Show Widget\u2026 \u00b7 read$/, 'the command line\'s own palette title is beside the command');
  assert.equal(withTitle.iconPath.id, 'eye', 'with its own icon');
  assert.ok(!ids.includes('secret tool') && !ids.includes('mcp serve'));
  const last = b.stub.calls.messages.filter((m: Loose) => m.kind === 'quickpick').at(-1);
  assert.equal(last.items[0].description, './other widget new w9', 'the last step shows the whole command line');
  assert.ok(!b.first.invocations().some((i) => i.argv[0] === 'widget' && i.argv[1] === 'new'), 'nothing ran: the person left at the last step');
  b.cleanup();
});

test('FR-013: a typed argument\'s choices come from the noun\'s list command when the type lists none', async () => {
  const b = await boot();
  let choices;
  b.stub.script.quickPicks.push('widget show');
  b.stub.script.quickPicks.push((items: Loose) => { choices = items.map((i: Loose) => i.value); return 'w2'; });
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

test('FR-021: a document in a newer form than the extension knows is never shown; an update is offered', async () => {
  const newer = { ...k.doc('widget', 'w1', {}), schema: 'other/widget@9' };
  const b = await boot({ docs: defaultDocs({ 'widget show w1': { doc: newer } }) });
  b.stub.script.quickPicks.push('widget show');
  b.stub.script.quickPicks.push('w1');
  b.stub.script.quickPicks.push('run');
  await b.command('runCommand');
  const warn = b.stub.calls.messages.find((m: Loose) => m.kind === 'warning');
  assert.match(warn.text, /Update the IF Console extension/);
  assert.deepEqual(warn.rest, ['Show Extensions']);
  assert.equal(b.stub.calls.webviews.length, 0, 'nothing unreadable is shown');
  b.cleanup();
});
