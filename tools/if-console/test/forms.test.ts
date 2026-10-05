import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import * as forms from '../src/model/forms';
import * as wire from '../src/model/wire';
import { secondCommandLine } from './support/fake-launcher';

const k = secondCommandLine('other');
const detail = (id: string, category: string, args: Loose[], opts?: Loose[]) => wire.commandDetail(k.detail(id, category, args, opts));

/** collect, with its answer typed loosely: a test reads `values` where it knows the form was not cancelled. */
const collect = (...a: Parameters<typeof forms.collect>): Promise<Loose> => forms.collect(...a);

// A scripted interface: answers each prompt in turn.
function scripted(answers: Loose) {
  const asked: Loose[] = [];
  return { asked, pick: async (o: Loose) => { asked.push(['pick', o]); const a = answers.shift(); return typeof a === 'function' ? a(o) : a; },
    input: async (o: Loose) => { asked.push(['input', o]); const a = answers.shift(); return typeof a === 'function' ? a(o) : a; } };
}

test('FR-013: a command line is one line, quoted only where needed, with no placeholder', () => {
  assert.equal(forms.commandLine('./tool', ['widget', 'show', 'w1']), './tool widget show w1');
  assert.equal(forms.commandLine('./tool', ['spec', 'show', "it's here"]), "./tool spec show 'it'\\''s here'");
  assert.doesNotMatch(forms.commandLine('./tool', ['a', 'b']), /[<>{}]|\bTYPE\b/);
});

test('FR-013: argv is built from typed values: arguments in order, then options; flags only when set; --dry-run is never the form\'s', () => {
  const d = detail('widget new', 'record', [k.arg('name', 'TEXT'), k.arg('tags', 'TAG', { many: true, required: false })],
    [{ flag: '--owner', type: 'USER', help: 'x', multiple: false, required: false }, { flag: '--force', type: 'flag', help: 'x', multiple: false, required: false },
      { flag: '--label', type: 'TEXT', help: 'x', multiple: true, required: false }]);
  assert.deepEqual(forms.argvFromFields(d, { name: 'w9', tags: ['a', 'b'], owner: 'me', force: true, label: ['x', 'y'], dry_run: true }),
    ['widget', 'new', 'w9', 'a', 'b', '--owner', 'me', '--force', '--label', 'x', '--label', 'y']);
  assert.deepEqual(forms.argvFromFields(d, { name: 'w9', force: false }), ['widget', 'new', 'w9']);
});

test('FR-013: one step per argument; a quick pick where the type lists values, an input where it does not', async () => {
  const d = detail('widget approve', 'decision', [k.arg('widget', 'WIDGET', { choices: ['w1', 'w2'] }), k.arg('reason', 'TEXT')]);
  const ui = scripted(['w2', 'because']);
  const got = await collect(ui, d, null, null);
  assert.deepEqual(got.values, { widget: 'w2', reason: 'because' });
  assert.equal(ui.asked[0][0], 'pick');
  assert.deepEqual(ui.asked[0][1].items.map((i: Loose) => i.value), ['w1', 'w2']);
  assert.equal(ui.asked[1][0], 'input');
  assert.match(ui.asked[0][1].title, /widget approve/);
});

test('FR-013: where the noun has a list command, the quick pick takes the values from it', async () => {
  const d = detail('widget show', 'read', [k.arg('widget', 'WIDGET')]);
  const ui = scripted(['w7']);
  const got = await collect(ui, d, async () => ['w7', 'w8'], null);
  assert.deepEqual(got.values, { widget: 'w7' });
  assert.equal(ui.asked[0][0], 'pick');
});

test('FR-013: the values come out of a list document\'s links, and the noun is named by the type or the argument', () => {
  const list = k.doc('widget-list', 'all', {}, { links: [
    { rel: 'widget', command: 'widget show', fields: { widget: 'w1' }, cli: 'x' }, { rel: 'widget', command: 'widget show', fields: { widget: 'w2' }, cli: 'x' },
    { rel: 'other', command: 'gadget show', fields: { gadget: 'g1' }, cli: 'x' }] });
  assert.deepEqual(forms.valuesFromList(list, 'widget'), ['w1', 'w2']);
  const nouns = new Map([['design-system', []], ['widget', []]]);
  assert.equal(forms.nounForArgument({ type: 'DESIGN_SYSTEM', key: 'ds' }, nouns), 'design-system');
  assert.equal(forms.nounForArgument({ type: 'TEXT', key: 'widget' }, nouns), 'widget');
  assert.equal(forms.nounForArgument({ type: 'TEXT', key: 'zzz' }, nouns), null);
});

test('FR-013: a person who cancels any step cancels the form', async () => {
  const d = detail('widget approve', 'decision', [k.arg('widget', 'WIDGET', { choices: ['w1'] }), k.arg('reason', 'TEXT')]);
  assert.deepEqual(await collect(scripted(['w1', undefined]), d, null, null), { cancelled: true });
});

test('FR-013: a refused value takes the person back to that step, with the message', async () => {
  const d = detail('widget approve', 'decision', [k.arg('widget', 'WIDGET'), k.arg('reason', 'TEXT')]);
  const ui = scripted(['fixed']);
  const got = await collect(ui, d, null, { key: 'widget', message: 'w0 is not a widget. For example: w1', values: { widget: 'w0', reason: 'r' } });
  assert.deepEqual(got.values, { widget: 'fixed', reason: 'r' });
  assert.match(ui.asked[0][1].prompt, /w0 is not a widget/);
});

test('FR-013: required options are steps; optional ones come from one multi-pick; a flag asks nothing more', async () => {
  const d = detail('widget new', 'record', [k.arg('name', 'TEXT')],
    [{ flag: '--owner', type: 'USER', help: 'who', multiple: false, required: true }, { flag: '--force', type: 'flag', help: 'force', multiple: false, required: false }]);
  const ui = scripted(['w1', 'me', (o: Loose) => o.items.filter((i: Loose) => i.label === '--force').map((i: Loose) => i.value)]);
  const got = await collect(ui, d, null, null);
  assert.deepEqual(got.values, { name: 'w1', owner: 'me', force: true });
});

test('FR-013: an action\'s needs ask only for what is missing', async () => {
  const d = detail('widget new', 'record', [k.arg('name', 'TEXT'), k.arg('kind', 'TEXT')]);
  const ui = scripted(['k1']);
  const got = await collect(ui, d, null, { values: { name: 'w1' }, only: ['kind'] });
  assert.deepEqual(got.values, { name: 'w1', kind: 'k1' });
  assert.equal(ui.asked.length, 1);
});
