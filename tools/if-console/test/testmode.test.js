'use strict';
// The one test hook (0043-if-console FR-033): present only in VS Code's test mode, it answers a decision's modal and reads what was shown.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createStub, install } = require('./support/vscode-stub');

const KEY = Symbol.for('if-console.test');

function load(extensionMode) {
  const stub = createStub({});
  const restore = install(stub);
  const testmode = require('../src/testmode');
  const { createUi, DiffDocuments } = require('../src/ui');
  const hook = testmode.install({ extensionMode }, async () => ({ described: true }));
  const ui = createUi({ docs: new DiffDocuments(), output: { appendLine() {} } });
  return { stub, hook, testmode, ui, done: () => { testmode.uninstall(); restore(); } };
}
const modalArgs = { repo: { name: 'other' }, detail: { id: 'widget approve', words: ['widget', 'approve'], help: 'Approve a widget' }, argv: ['widget', 'approve', 'w1'], changes: [], line: './other widget approve w1' };

test('FR-033: outside test mode there is no hook and the modal is VS Code\'s own', async () => {
  const t = load(1);   // ExtensionMode.Production
  assert.equal(t.hook, null);
  assert.equal(globalThis[KEY], undefined);
  t.stub.script.warnings.push('Make this decision');
  assert.equal(await t.ui.confirmDecision(modalArgs), true);
  const shown = t.stub.calls.messages.find((m) => m.kind === 'warning');
  assert.ok(shown, 'VS Code was asked for the modal');
  t.testmode.note('quickpick', { items: ['x'] });   // a note outside test mode records nothing
  t.done();
});

test('FR-033: in test mode a queued answer gives the modal\'s one button, once, and anything else refuses it', async () => {
  const t = load(3);   // ExtensionMode.Test
  assert.ok(globalThis[KEY]);
  assert.equal(globalThis[KEY], t.hook);
  t.hook.answers.push(true);
  assert.equal(await t.ui.confirmDecision(modalArgs), true);
  assert.equal(await t.ui.confirmDecision(modalArgs), false, 'an answer is used once; with none queued the modal is refused');
  t.hook.answers.push('yes please');
  assert.equal(await t.ui.confirmDecision(modalArgs), false, 'only true gives the button');
  assert.equal(t.stub.calls.messages.filter((m) => m.kind === 'warning').length, 0, 'VS Code\'s own dialog was not used');
  const modals = t.hook.shown.filter((s) => s.kind === 'modal');
  assert.equal(modals.length, 3);
  assert.equal(modals[0].modal, true);
  assert.match(modals[0].message, /widget approve is a decision only you can make/);
  assert.match(modals[0].detail, /Command: .\/other widget approve w1/);
  assert.deepEqual(modals[0].buttons, ['Make this decision']);
  t.done();
  assert.equal(globalThis[KEY], undefined, 'the hook goes when the extension does');
});

test('FR-033: the hook reads what was shown and a snapshot, and answers no other prompt', async () => {
  const t = load(3);
  t.stub.script.quickPicks.push('b');
  const got = await t.ui.pick({ title: 'T', placeholder: 'P', items: [{ label: 'a', value: 'a' }, { label: 'b', value: 'b' }] });
  assert.equal(got, 'b', 'a quick pick is answered by the person (the script here), not the hook');
  assert.deepEqual(t.hook.shown.map((s) => [s.kind, s.title, s.items]), [['quickpick', 'T', ['a', 'b']]]);
  assert.deepEqual(await t.hook.describe(), { described: true });
  t.done();
});

test('FR-033: the hook is the only test-mode path: nothing else in the source looks at the extension mode or the hook\'s key', () => {
  const dir = path.join(__dirname, '..', 'src');
  const users = fs.readdirSync(dir).filter((f) => /ExtensionMode|if-console\.test/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.deepEqual(users, ['testmode.js']);
});
