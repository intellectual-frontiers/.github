import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import * as wire from '../src/model/wire';
import { secondCommandLine } from './support/fake-launcher';

const k = secondCommandLine('other');

test('FR-005: command list yields the orchestrator, audience, commands, nouns and surfaces', () => {
  const list = wire.commandList(k.list);
  assert.equal(list.orchestrator, 'other');
  assert.equal(list.audience, 'private');
  const widget = list.commands.find((c) => c.id === 'widget new');
  assert.equal(widget?.noun, 'widget');
  assert.equal(widget?.verb, 'new');
  assert.equal(list.commands.find((c) => c.id === 'check')?.noun, null);
  const { nouns, repoWide } = wire.nounsOf(list);
  assert.deepEqual([...nouns.keys()], ['widget']);
  assert.deepEqual(repoWide.map((c) => c.id), ['check', 'doctor', 'fresh']);
});

test('FR-012: a command the editor surface does not expose is never listed', () => {
  const list = wire.commandList(k.list);
  const { nouns, repoWide } = wire.nounsOf(list);
  const ids = [...repoWide, ...[...nouns.values()].flat()].map((c) => c.id);
  assert.ok(!ids.includes('secret tool'));
  assert.ok(!ids.includes('mcp serve'));
});

test('FR-021: a newer schema is "update needed" and is never read', () => {
  const doc = { ...k.list, schema: 'other/command-list@2' };
  const r = wire.checkSchema(doc);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'update');
  assert.match(r.message, /Update the IF Console extension/);
  assert.throws(() => wire.commandList(doc), (e: Loose) => e.code === 'update');
  assert.equal(wire.checkSchema({ schema: 'nonsense' } as Loose).ok, false);
});

test('FR-064: command show carries arguments with choices, options, usage, surfaces and programs', () => {
  const d = wire.commandDetail(k.detail('widget show', 'read', [k.arg('widget', 'WIDGET', { choices: ['w1', 'w2'] })]));
  assert.equal(d.arguments[0].name, 'widget');
  assert.deepEqual(d.arguments[0].choices, ['w1', 'w2']);
  assert.equal(d.category, 'read');
  assert.deepEqual(d.programs, []);
});

test('FR-064: actions and links are read by their wire fields; a disabled action keeps its reason', () => {
  const doc = k.doc('widget', 'w1', {}, {
    links: [{ rel: 'owner', command: 'widget show', fields: { widget: 'w2' }, cli: 'other widget show w2' }],
    actions: [
      { label: 'approve', command: 'widget approve', fields: { widget: 'w1' }, category: 'decision', surfaces: ['editor'], cli: 'other widget approve w1', enabled: true },
      { label: 'rename', command: 'widget new', fields: {}, category: 'record', surfaces: ['editor', 'mcp'], cli: null, enabled: true, needs: ['name'] },
      { label: 'blocked', command: 'widget new', fields: {}, category: 'record', surfaces: ['editor'], cli: null, enabled: false, reason: 'nothing to do' },
      { label: 'terminal only', command: 'x y', fields: {}, category: 'setup', surfaces: [], cli: 'other x y', enabled: true }] });
  const actions = wire.actionsOf(doc);
  assert.deepEqual(actions.map((a) => a.label), ['approve', 'rename', 'blocked']);
  assert.deepEqual(actions[1].needs, ['name']);
  assert.equal(actions[1].cli, null);
  assert.equal(actions[2].enabled, false);
  assert.equal(actions[2].reason, 'nothing to do');
  assert.equal(wire.linksOf(doc)[0].rel, 'owner');
});

test('FR-064: a check result has status, summary and sections with findings', () => {
  const doc = k.check([{ name: 'docs', status: 'failed', findings: [k.finding] }, { name: 'slow', status: 'skipped', findings: [], reason: 'not fetched' }]);
  const r = wire.checkResult(doc);
  assert.equal(r.status, 'failed');
  assert.deepEqual([r.summary.run, r.summary.failed, r.summary.skipped], [2, 1, 1]);
  assert.equal(r.sections[0].findings[0].where, 'docs/guide.md:3');
  assert.equal(r.sections[1].reason, 'not fetched');
});

test('FR-019 of 0041: one document or NDJSON are both read', () => {
  assert.equal(wire.parseDocuments(JSON.stringify(k.list, null, 2)).length, 1);
  assert.equal(wire.parseDocuments('{"schema":"o/x@1","id":"a"}\n{"schema":"o/x@1","id":"b"}\n').length, 2);
  assert.throws(() => wire.parseDocuments('not json'), (e: Loose) => e.code === 'json');
});

test('FR-016: the plain-words state of doctor', () => {
  const d = (status: Loose) => k.doc('doctor', 'x', { status });
  assert.equal(wire.doctorState(d('ok')), 'well');
  assert.equal(wire.doctorState(d('missing')), 'something missing');
  assert.equal(wire.doctorState(d('failed')), 'needs attention');
});
