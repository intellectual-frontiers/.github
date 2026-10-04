'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStub, install, folderOf, Uri } = require('./support/vscode-stub');

function setup() {
  const stub = createStub({ folders: [folderOf('repo', '/clone')] });
  const restore = install(stub);
  const { Diagnostics, locate } = require('../src/diagnostics');
  const resolve = async (folder, file) => (file.endsWith('.md') || file.endsWith('.tsv') ? Uri.file(`/clone/${file}`) : null);
  return { stub, restore, Diagnostics, locate, d: new Diagnostics(resolve), folder: stub.vscode.workspace.workspaceFolders[0] };
}

test('FR-009: a finding\'s `where` that names a file is a location, with its line', () => {
  const { restore, locate } = setup();
  assert.deepEqual(locate('docs/guide.md:12'), { file: 'docs/guide.md', line: 12, column: 1 });
  assert.deepEqual(locate('docs/guide.md:12:5'), { file: 'docs/guide.md', line: 12, column: 5 });
  assert.deepEqual(locate('README.md'), { file: 'README.md', line: 1, column: 1 });
  assert.equal(locate('ontology/x.ttl (design system)').file, 'ontology/x.ttl');
  restore();
});

test('FR-009: a finding with no location is not placed at a file it does not name', () => {
  const { restore, locate } = setup();
  for (const w of ['', 'commands', 'spec 0020 FR-001', 'a section name', '(none)']) assert.equal(locate(w), null, w);
  restore();
});

test('FR-009: one diagnostic per located finding, with severity, message and the section as the source', async () => {
  const { restore, d, folder, stub } = setup();
  const unplaced = await d.setSection(folder, 'other', 'docs', [
    { level: 'error', where: 'docs/guide.md:3', message: 'broken link', next: '' },
    { level: 'warning', where: 'docs/guide.md:9', message: 'long line', next: '' },
    { level: 'error', where: 'tools', message: 'a directory, not a file', next: '' },
    { level: 'error', where: 'general', message: 'no location', next: '' }]);
  const got = stub.diagnostics.get(Uri.file('/clone/docs/guide.md').toString());
  assert.equal(got.length, 2);
  assert.equal(got[0].range.start.line, 2);
  assert.equal(got[0].severity, stub.vscode.DiagnosticSeverity.Error);
  assert.equal(got[1].severity, stub.vscode.DiagnosticSeverity.Warning);
  assert.equal(got[0].source, 'other check docs');
  assert.deepEqual(unplaced.map((f) => f.message), ['a directory, not a file', 'no location']);
  restore();
});

test('FR-009: a section\'s diagnostics are cleared when that section runs again, and only that section\'s', async () => {
  const { restore, d, folder, stub } = setup();
  await d.setSection(folder, 'other', 'docs', [{ level: 'error', where: 'a.md:1', message: 'one', next: '' }]);
  await d.setSection(folder, 'other', 'ledger', [{ level: 'error', where: 'a.md:2', message: 'two', next: '' }]);
  assert.equal(d.count(), 2);
  await d.setSection(folder, 'other', 'docs', []);
  assert.equal(d.count(), 1);
  assert.equal(stub.diagnostics.get(Uri.file('/clone/a.md').toString())[0].message, 'two');
  restore();
});
