// The Testing API (0043-if-console FR-010, FR-040): the run profiles, the test items for sections, the findings as children with a range at their
// line, and the tests for the references a spec names whose enforcing action is a check.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import type { Loose } from './support/fake-launcher';
import { boot } from './support/boot';
import { Uri } from './support/vscode-stub';

const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() { /* none */ } }) };
const leaves = (item: Loose): Loose[] => { const out: Loose[] = []; item.children.forEach((c: Loose) => out.push(c)); return out; };

test('FR-040: there are two run profiles, Run (the default) and Run with --changed, of the Run kind', async () => {
  const b = await boot();
  const ctl = b.stub.calls.testController;
  assert.deepEqual(ctl.profiles.map((p: Loose) => [p.label, p.kind, p.isDefault]), [['Run', 1, true], ['Run with --changed', 1, false]]);
  b.cleanup();
});

test('FR-040: Run with --changed runs `check --changed` once and marks each section it reported; one it did not run is skipped, not passed', async () => {
  const b = await boot();
  const ctl = b.stub.calls.testController;
  const before = b.first.invocations().length;
  await ctl.profiles[1].handler({ include: undefined, exclude: [] }, token);
  const calls = b.first.invocations().slice(before).map((i: Loose) => i.argv.join(' '));
  assert.deepEqual(calls, ['check --changed --json']);
  const log = ctl.runs[0].log.filter((e: Loose) => ['passed', 'failed', 'skipped', 'errored'].includes(e[0])).map((e: Loose) => `${e[0]}:${e[1].split(':').pop()}`);
  assert.ok(log.includes('failed:docs') && log.includes('passed:links') && log.includes('skipped:slow'), log.join(','));
  b.cleanup();
});

test('FR-040: a failed section gets a child test for each finding that names a file, with its range at that line', async () => {
  const b = await boot();
  fs.mkdirSync(path.join(b.first.root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(b.first.root, 'docs', 'guide.md'), 'a\nb\nc\n');
  const ctl = b.stub.calls.testController;
  const root = [...ctl.items][0][1];
  const docs = leaves(root).find((t) => t.label === 'docs');
  await ctl.handler({ include: [docs], exclude: [] }, token);
  const children = leaves(docs);
  assert.equal(children.length, 1, 'the finding with no file has none');
  assert.equal(children[0].range.start.line, 2);
  assert.equal(children[0].uri.fsPath, path.join(b.first.root, 'docs', 'guide.md'));
  assert.equal(children[0].description, 'docs/guide.md:3');
  assert.ok(ctl.runs[0].log.some((e: Loose) => e[0] === 'failed' && e[1] === children[0].id));
  await ctl.handler({ include: [docs], exclude: [] }, token);
  assert.equal(leaves(docs).length, 1, 'a section that runs again replaces its findings');
  b.cleanup();
});

test('FR-040: a reference in an open document whose resource has a check is a test with a range at its line, run by that check', async () => {
  const b = await boot();
  fs.mkdirSync(path.join(b.first.root, 'docs'), { recursive: true });
  const text = '# Guide\n\nSee widget w1 here, and widget/w2 there.\n\nwidget w3 has no answer.\n';
  const document = { uri: Uri.file(path.join(b.first.root, 'docs', 'guide.md')), version: 1, getText: () => text };
  await b.stub.calls.onOpen(document);
  const ctl = b.stub.calls.testController;
  const file = ctl.items.get(`file:${document.uri.toString()}`);
  assert.ok(file, 'a test for the file');
  const refs = leaves(file);
  assert.deepEqual(refs.map((t) => t.label), ['widget w1', 'widget/w2'], 'w3 has no resource, so no test');
  assert.deepEqual(refs.map((t) => [t.range.start.line, t.range.start.character, t.range.end.character]), [[2, 4, 13], [2, 24, 33]]);
  assert.equal(refs[0].description, 'run its check');
  const before = b.first.invocations().length;
  await ctl.handler({ include: [refs[0]], exclude: [] }, token);
  assert.ok(b.first.invocations().slice(before).some((i: Loose) => i.argv.join(' ') === 'check docs --json'), 'it ran the resource\'s own check action');
  const results = ctl.runs[0].log.filter((e: Loose) => ['passed', 'failed', 'errored'].includes(e[0]));
  assert.equal(results[0][0], 'failed', 'the check\'s own result, as a test result');
  b.cleanup();
});

test('FR-040: a request that names nothing runs every section of every repository, and cancelling stops the run', async () => {
  const b = await boot();
  const ctl = b.stub.calls.testController;
  await ctl.handler({ include: undefined, exclude: [] }, { isCancellationRequested: true, onCancellationRequested: () => ({ dispose() { /* none */ } }) });
  const log = ctl.runs[0].log.map((e: Loose) => e[0]);
  assert.ok(log.includes('enqueued') && !log.includes('started'), 'cancelled before it began');
  assert.ok(log.includes('end'));
  b.cleanup();
});
