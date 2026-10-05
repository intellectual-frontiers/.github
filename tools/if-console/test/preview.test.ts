import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import * as preview from '../src/model/preview';
import { readDoc } from '../src/model/wire';

// The diff a launcher's dry run carries: a unified diff per file, made as difflib writes it (no line endings).
const before = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'].join('\n') + '\n';
const after = ['one', 'TWO', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'].join('\n') + '\n';
const diff = ['--- before', '+++ after', '@@ -1,3 +1,3 @@', ' one', '-two', '+TWO', ' three', '@@ -11,2 +11,3 @@', ' eleven', ' twelve', '+thirteen'];

test('FR-014: the diff of a dry run is rebuilt into the two sides the diff editor shows', () => {
  assert.equal(preview.applyUnified(before, diff), after);
  const s = preview.sides({ change: 'modify', diff } as Loose, before);
  assert.equal(s.before, before);
  assert.equal(s.after, after);
});

test('FR-014: a created file has an empty left side; a deleted file an empty right side', () => {
  const created = preview.sides({ change: 'create', diff: ['--- before', '+++ after', '@@ -0,0 +1,2 @@', '+a', '+b'] } as Loose, null);
  assert.deepEqual([created.before, created.after], ['', 'a\nb\n']);
  const deleted = preview.sides({ change: 'delete', diff: ['--- before', '+++ after', '@@ -1,2 +0,0 @@', '-a', '-b'] } as Loose, 'a\nb\n');
  assert.deepEqual([deleted.before, deleted.after], ['a\nb\n', '']);
});

test('FR-014: changes are read from the dry run\'s resource, one for each file', () => {
  const changes = preview.changesOf(readDoc({ data: { changes: [{ path: 'a.txt', change: 'modify', added: 2, removed: 1, diff }, { path: 'b.bin', change: 'create', added: 0, removed: 0, diff: [] }] } }));
  assert.equal(changes.length, 2);
  assert.match(preview.summaryOf(changes), /2 files would change: 2 lines added, 1 removed/);
  assert.deepEqual(preview.changesOf(readDoc({ data: {} })), []);
  assert.equal(preview.summaryOf([]), 'Nothing would change.');
});
