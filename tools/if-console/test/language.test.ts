// Language features in the files a command line's references name (0043-if-console FR-041): hover, Go to Definition, CodeLens and document links,
// each from the launcher's `show` command and only in a trusted workspace.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import type { Loose } from './support/fake-launcher';
import { boot } from './support/boot';
import { Uri } from './support/vscode-stub';

const GUIDE = '# Guide\n\nSee widget w1 here, and widget/w2 there.\n\nNothing on this line. widget w3 is not shown.\n';

async function withGuide(options: Loose = {}) {
  const b = await boot(options);
  fs.mkdirSync(path.join(b.first.root, 'docs'), { recursive: true });
  const file = path.join(b.first.root, 'docs', 'guide.md');
  fs.writeFileSync(file, GUIDE);
  const doc = (rel: string, text = GUIDE): Loose => ({ uri: Uri.file(path.join(b.first.root, rel)), version: 1, getText: () => text });
  const get = (kind: string): Loose => b.stub.calls.languages.find((l: Loose) => l.kind === kind);
  return { b, file, doc, get, guide: doc('docs/guide.md') };
}
const flat = (md: Loose): string => md.value.replace(/\\/g, '');

test('FR-041: the providers are registered for the globs the reference declares, in the repository\'s own folder, and for no other file', async () => {
  const { b, get } = await withGuide();
  for (const kind of ['hover', 'definition', 'codelens', 'links']) {
    const r = get(kind);
    assert.equal(r.selector.length, 1, kind);
    assert.equal(r.selector[0].pattern.pattern, 'docs/**/*.md');
    assert.equal(r.selector[0].pattern.base.name, 'first');
  }
  const { doc } = await withGuide();
  const hover = get('hover');
  assert.equal(await hover.p.provideHover(doc('src/other.md'), { line: 2, character: 8 }), undefined, 'a file the reference does not name has no hover');
  b.cleanup();
});

test('FR-041: the hover shows the resource\'s words, its key facts and its actions as links, from `show` and the declared fields', async () => {
  const { b, get, guide } = await withGuide();
  const hover = await get('hover').p.provideHover(guide, { line: 2, character: 10 });
  assert.ok(hover);
  const md = flat(hover.contents);
  assert.match(md, /\*\*w1\*\*/);
  assert.match(md, /The first one\./, 'the text field the declaration names');
  assert.match(md, /kind:\*\* blue/);
  assert.match(md, /state:\*\* ready/);
  assert.match(md, /\[\$\(go-to-file\) Open\]\(command:if-console\.followLink\?/);
  assert.match(md, /run its check/, 'the resource\'s actions are links');
  assert.deepEqual([hover.range.start.character, hover.range.end.character], [4, 13], 'on the reference');
  assert.ok(b.first.invocations().some((i: Loose) => i.argv.join(' ') === 'widget show w1 --json'), 'it ran only `show`');
  assert.equal(await get('hover').p.provideHover(guide, { line: 3, character: 3 }), undefined, 'off a reference there is nothing');
  b.cleanup();
});

test('FR-041: Go to Definition is the path and line the resource gives, inside the clone', async () => {
  const { b, get, guide } = await withGuide();
  const loc = await get('definition').p.provideDefinition(guide, { line: 2, character: 24 });
  assert.equal(loc.uri.fsPath, path.join(b.first.root, 'docs', 'guide.md'));
  assert.equal(loc.range.line, 2, 'line 3 of the file, as the resource says');
  b.cleanup();
});

test('FR-041: a path that leaves the clone is no definition', async () => {
  const { guide, get, b } = await withGuide({ docs: undefined });
  const repo = (b.stub.calls.treeViews.get('if-console.home').o.treeDataProvider.host.repos as Loose[])[0];
  const shown = await repo.show('widget', 'w1');
  shown.data.path = '../../etc/passwd';
  assert.equal(await get('definition').p.provideDefinition(guide, { line: 2, character: 10 }), undefined);
  b.cleanup();
});

test('FR-041: a CodeLens above each reference shows its `lens` fields and, where the resource has a check, a Run that runs it', async () => {
  const { b, get, guide } = await withGuide();
  const lenses = get('codelens').p.provideCodeLenses(guide);
  assert.deepEqual(lenses.map((l: Loose) => l.range.start.line), [2, 2, 4], 'one for each reference, at its line');
  const resolved = await get('codelens').p.resolveCodeLens(lenses[0]);
  assert.equal(resolved.command.title, '$(symbol-event) blue · ready · $(play) Run');
  assert.equal(resolved.command.command, 'if-console.followLink');
  const before = b.first.invocations().length;
  b.stub.script.quickPicks.push(() => undefined);
  await b.command('followLink', resolved.command.arguments[0]);
  assert.ok(b.first.invocations().slice(before).some((i: Loose) => i.argv.join(' ') === 'check docs --json'), 'the Run is the check the resource names, run through the one path');
  const third = await get('codelens').p.resolveCodeLens(lenses[2]);
  assert.equal(third, undefined, 'a reference the launcher does not show has no lens');
  b.cleanup();
});

test('FR-041: a document link opens the resource\'s page, by a handle', async () => {
  const { b, get, guide } = await withGuide();
  const links = get('links').p.provideDocumentLinks(guide);
  assert.equal(links.length, 3);
  assert.equal(links[0].target, undefined, 'a target is made only when the editor asks for it');
  get('links').p.resolveDocumentLink(links[0]);
  assert.match(links[0].target.toString(), /^command:if-console\.followLink\?/);
  const handle = JSON.parse(decodeURIComponent(links[0].target.toString().split('?')[1]))[0];
  await b.command('followLink', handle);
  assert.ok(b.first.invocations().some((i: Loose) => i.argv.join(' ') === 'widget show w1 --html'));
  assert.equal(b.stub.calls.webviews.length, 1);
  b.cleanup();
});

test('FR-041: in an untrusted workspace there are no references, no hover and no launcher run', async () => {
  const { b, get, guide } = await withGuide({ trusted: false });
  assert.deepEqual(b.stub.calls.languages, [], 'nothing is registered for a repository that is not ready');
  assert.deepEqual(b.first.invocations(), []);
  assert.ok(!get('hover'));
  void guide;
  b.cleanup();
});
