// How a command line presents itself (0041-command-line FR-064): views, nouns with their icons and lists, references and statuses are read from
// `command list`, and a list without them gives plainer views.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import { secondCommandLine } from './support/fake-launcher';
import * as presentation from '../src/model/presentation';
import * as wire from '../src/model/wire';

const k = secondCommandLine('other');

const declared = {
  views: [{ id: 'later', title: 'Later', icon: 'tools', order: 40 }, { id: 'works', title: 'Works', icon: 'book', order: 20, description: 'The works' }],
  nouns: [
    { noun: 'widget', title: 'Widget', icon: 'package', view: 'works',
      list: { command: 'widget list', rows: 'widgets', id: 'name', label: 'name', description: 'kind', status: 'state', badge: 'count', tooltip: ['owner'],
        status_map: { open: 'pending', closed: 'ok', weird: 'not-a-status' } } },
    { noun: 'gadget', title: 'Gadget', icon: 'tools' },
    { noun: '', title: 'nameless' }],
  references: [{ id: 'req', noun: 'widget', pattern: 'W-(\\d+)', value: '$1', files: ['**/*.md'], text: 'text', facts: ['a'], lens: ['b'], definition: ['path', 'line'] },
    { id: 'broken', noun: 'widget' }],
};

test('FR-064: the presentation is read from command list: views in their order, nouns with their icon, view and list, references', () => {
  const list = wire.commandList(wire.readDoc({ ...k.list, data: { ...k.list.data, presentation: declared } }) as wire.Doc);
  const p = list.presentation;
  assert.deepEqual(p.views.map((v) => v.id), ['works', 'later'], 'by order');
  assert.equal(p.views[0]?.description, 'The works');
  assert.deepEqual(p.nouns.map((n) => n.noun), ['widget', 'gadget'], 'a noun with no name is left out');
  const widget = p.nouns[0];
  assert.equal(widget?.icon, 'package');
  assert.equal(widget?.view, 'works');
  assert.deepEqual(widget?.list?.statusMap, { open: 'pending', closed: 'ok' }, 'a status outside the vocabulary is not kept');
  assert.deepEqual(widget?.list?.tooltip, ['owner']);
  assert.equal(p.nouns[1]?.view, undefined);
  assert.deepEqual(p.references.map((r) => r.id), ['req'], 'a reference with no pattern is left out');
  assert.deepEqual(p.references[0]?.definition, ['path', 'line']);
});

test('FR-064: a command list without presentation gives an empty one, and the commands carry their title and icon where they have them', () => {
  const bare: Loose = { ...k.list, data: { count: k.list.data.count, commands: k.list.data.commands } };
  const plain = wire.commandList(wire.readDoc(bare) as wire.Doc);
  assert.deepEqual(plain.presentation, presentation.NO_PRESENTATION);
  const titled: Loose = { ...k.list, data: { ...k.list.data, commands: [{ id: 'widget show', category: 'read', group: 'g', surfaces: ['editor'], help: 'x', title: 'Show Widget…', icon: 'eye' },
    { id: 'check', category: 'check', group: 'g', surfaces: ['editor'], help: 'y' }] } };
  const list = wire.commandList(wire.readDoc(titled) as wire.Doc);
  assert.deepEqual(list.commands.map((c) => [c.id, c.title, c.icon]), [['widget show', 'Show Widget…', 'eye'], ['check', null, null]]);
});

test('FR-064: a row\'s status is mapped by the list\'s own status_map, a vocabulary value stands for itself, and anything else is muted', () => {
  const list = wire.commandList(wire.readDoc({ ...k.list, data: { ...k.list.data, presentation: declared } }) as wire.Doc).presentation.nouns[0]?.list;
  assert.ok(list);
  assert.equal(presentation.rowStatus(list, { state: 'open' }), 'pending');
  assert.equal(presentation.rowStatus(list, { state: 'error' }), 'error');
  assert.equal(presentation.rowStatus(list, { state: 'who knows' }), 'muted');
  assert.equal(presentation.rowStatus({ ...list, status: undefined }, { state: 'open' }), undefined);
  assert.deepEqual(['passed', 'failed', 'skipped', 'warning', 'odd'].map(presentation.checkStatus), ['ok', 'error', 'skipped', 'warning', 'muted']);
  assert.ok(presentation.STATUSES.every((s) => presentation.isStatus(s)));
});
