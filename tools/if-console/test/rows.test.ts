// A noun's `list` rows, read by the command line's own declaration (0041-command-line FR-064, 0043-if-console FR-036, FR-038).
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import { badgeText, display, rowsOf } from '../src/model/rows';
import { presentationOf, rowStatus, checkStatus } from '../src/model/presentation';
import { STATUS_LOOK, lookOf } from '../src/model/status';

const decl = (extra: Loose = {}) => presentationOf({ presentation: { nouns: [{ noun: 'widget', title: 'Widget', icon: 'x', list: { command: 'widget list', rows: 'widgets', id: 'id', label: 'name', ...extra } }] } }).nouns[0]?.list as Loose;
const doc = (rows: Loose[]): Loose => ({ data: { widgets: rows }, links: [], actions: [] });

test('FR-038: each row shows its label, its muted description, its status as a mapped word, its badge and its tooltip facts, by the declaration', () => {
  const rows = rowsOf('widget', decl({ description: 'kind', status: 'state', status_map: { ready: 'ok', broken: 'error' }, badge: 'parts', tooltip: ['kind', 'note', 'absent'] }),
    doc([{ id: 'w1', name: 'First', kind: 'blue', state: 'ready', parts: 3, note: 'n' }, { id: 'w2', name: '', kind: ['a', 'b'], state: 'odd', parts: 0 }, { name: 'no id' }, 'not a row']));
  assert.equal(rows.length, 2, 'a row with no id and a value that is not a row are left out');
  assert.deepEqual([rows[0]?.label, rows[0]?.description, rows[0]?.status, rows[0]?.statusValue, rows[0]?.badge], ['First', 'blue', 'ok', 'ready', '3']);
  assert.deepEqual(rows[0]?.facts, [{ key: 'kind', value: 'blue' }, { key: 'note', value: 'n' }], 'a field the row lacks is not a fact');
  assert.equal(rows[1]?.label, 'w2', 'with no label field the id is the label');
  assert.equal(rows[1]?.description, 'a, b');
  assert.equal(rows[1]?.status, 'muted', 'a value nothing maps is muted, never an invented status');
});

test('FR-038: a status in the fixed vocabulary needs no map, and each maps to the codicon and the theme color of the requirement', () => {
  const d = decl({ status: 'state' });
  for (const s of ['ok', 'warning', 'error', 'pending', 'skipped', 'info', 'muted']) assert.equal(rowStatus(d, { state: s }), s);
  const want: Record<string, [string, string]> = { ok: ['pass', 'testing.iconPassed'], warning: ['warning', 'list.warningForeground'], error: ['error', 'testing.iconFailed'],
    pending: ['circle-outline', 'testing.iconQueued'], skipped: ['circle-slash', 'testing.iconSkipped'], info: ['info', 'notificationsInfoIcon.foreground'], muted: ['circle-small-filled', 'disabledForeground'] };
  for (const [status, [icon, color]] of Object.entries(want)) { const look = STATUS_LOOK[status as 'ok']; assert.deepEqual([look.icon, look.color], [icon, color]); }
  assert.equal(lookOf('error').word, 'needs fixing');
  assert.deepEqual(['passed', 'failed', 'skipped', 'error', 'warning', 'info', 'weird'].map(checkStatus), ['ok', 'error', 'skipped', 'error', 'warning', 'info', 'muted']);
});

test('a row with no status field has no status; display reads lists, drops objects and cuts what is long', () => {
  assert.equal(rowsOf('widget', decl(), doc([{ id: 'a', name: 'A' }]))[0]?.status, undefined);
  assert.equal(display(['a', { x: 1 }, 'b']), 'a, b');
  assert.equal(display({ x: 1 }), '');
  assert.equal(display(null), '');
  assert.equal(display(7), '7');
  assert.equal(display('x'.repeat(500), 10), 'xxxxxxxxx…');
  assert.equal(display('a\n  b'), 'a b');
});

test('a badge is at most the two characters a decoration can hold: a count up to 99', () => {
  assert.deepEqual(['3', '99', '120', 'abc', ''].map(badgeText), ['3', '99', '99', 'ab', '']);
});

test('FR-038, FR-049: a row\'s own icon is the declared field\'s value where it is a codicon id; a status still wins in the view', () => {
  const d = decl({ icon: 'glyph', search: 'match' });
  assert.equal(d.search, 'match');
  const rows = rowsOf('widget', d, doc([{ id: 'a', name: 'A', glyph: 'symbol-class' }, { id: 'b', name: 'B', glyph: 'Not An Icon' }, { id: 'c', name: 'C' }]));
  assert.deepEqual(rows.map((r) => r.icon), ['symbol-class', '', '']);
  assert.equal(rowsOf('widget', decl(), doc([{ id: 'a', name: 'A', glyph: 'symbol-class' }]))[0]?.icon, '', 'a list that declares no icon field has none');
});
