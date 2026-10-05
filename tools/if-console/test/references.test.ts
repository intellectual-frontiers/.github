// The patterns in files that name a resource (0041-command-line FR-064 `references`, 0043-if-console FR-041): found by the command line's own
// declaration, in the files its globs name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appliesTo, fill, findReferences, globRegex } from '../src/model/references';
import type { ReferenceDecl } from '../src/model/presentation';

const decl: ReferenceDecl = { id: 'requirement', noun: 'requirement', pattern: '\\b(\\d{4})(?:-[a-z0-9-]+)?[ /](FR-\\d{3})\\b', value: '$1/$2',
  files: ['spec-kit/specs/**/*.md', 'spec-kit/enforcement.tsv', 'docs/*.md'], text: 'text', facts: ['mechanism'], lens: ['mechanism', 'by'], definition: ['path', 'line'] };

test('a glob has `**` crossing directories, `*` and `?` staying in one, and braces as a choice', () => {
  const g = (p: string, path: string) => globRegex(p).test(path);
  assert.ok(g('spec-kit/specs/**/*.md', 'spec-kit/specs/0043-if-console/spec.md'));
  assert.ok(g('spec-kit/specs/**/*.md', 'spec-kit/specs/spec.md'));
  assert.ok(!g('docs/*.md', 'docs/a/b.md'));
  assert.ok(g('docs/*.md', 'docs/b.md'));
  assert.ok(g('a/{b,c}.md', 'a/c.md') && !g('a/{b,c}.md', 'a/d.md'));
  assert.ok(g('f?.md', 'fa.md') && !g('f?.md', 'fab.md'));
  assert.ok(!g('a.md', 'aXmd'), 'a dot is a dot');
  assert.equal(appliesTo(decl, 'spec-kit/enforcement.tsv'), true);
  assert.equal(appliesTo(decl, 'src/x.py'), false);
});

test('the template is filled from the pattern\'s groups; $$ is a dollar', () => {
  assert.equal(fill('$1/$2', ['all', '0043', 'FR-036']), '0043/FR-036');
  assert.equal(fill('$$1 costs $1', ['x', '5']), '$1 costs 5');
  assert.equal(fill('$3', ['x']), '');
});

test('references are found with their line and columns, by the declared pattern, in the order of the text', () => {
  const text = 'See 0043-if-console FR-036 and 0041 FR-064.\nnothing here\nAlso 0043/FR-041, twice 0043 FR-041.\n';
  const found = findReferences([decl], text);
  assert.deepEqual(found.map((m) => [m.line, m.start, m.end, m.value, m.text]), [
    [0, 4, 26, '0043/FR-036', '0043-if-console FR-036'], [0, 31, 42, '0041/FR-064', '0041 FR-064'], [2, 5, 16, '0043/FR-041', '0043/FR-041'], [2, 24, 35, '0043/FR-041', '0043 FR-041']]);
  assert.deepEqual(findReferences([{ ...decl, pattern: '(' }], text), [], 'a pattern that is not a regular expression finds nothing');
  assert.deepEqual(findReferences([{ ...decl, pattern: 'x*' }], 'abc'), [], 'an empty match is not a reference');
});
