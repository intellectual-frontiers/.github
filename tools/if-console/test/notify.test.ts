// What the extension says when a result has something that needs a person (0043-if-console FR-048): the plain words, the exact command line, a
// button that runs the fix and a button that shows all of it; never "see below" and never a pointer to somewhere the person cannot see.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import { action, boot, defaultDocs, k } from './support/boot';

const warnings = (b: Loose): Loose[] => b.stub.calls.messages.filter((m: Loose) => m.kind === 'warning');
const executed = (b: Loose, id: string): Loose[] => b.stub.calls.commands.filter((c: Loose) => c.id === id);

test('FR-048: the notice after a failed check names what failed and the command line to run, and has a button that runs it and one that shows all', async () => {
  const b = await boot();
  b.stub.script.warnings.push('Run check docs again');
  const before = b.first.invocations().length;
  await b.command('checkChanged');
  const [notice] = warnings(b);
  assert.match(notice.text, /^other check: 1 passed, 1 failed, 1 skipped\. docs: 2 problems to fix\. Run \.\/other check docs\.$/);
  assert.deepEqual(notice.rest, ['Run check docs again', 'Show all']);
  assert.doesNotMatch(notice.text, /below|above|a suggestion/i);
  const ran = b.first.invocations().slice(before).map((i: Loose) => i.argv.join(' '));
  assert.deepEqual(ran, ['check --changed --json', 'check docs --json'], 'the button ran the fix\'s command line through the launcher');
  b.cleanup();
});

test('FR-048: Show all opens Home and reveals the row that most needs a person, instead of pointing at it', async () => {
  const b = await boot();
  b.stub.script.warnings.push('Show all');
  await b.command('checkChanged');
  assert.equal(executed(b, 'workbench.view.extension.if-console').length, 1);
  assert.equal(executed(b, 'if-console.home.focus').length, 1);
  const home = b.stub.calls.treeViews.get('if-console.home');
  assert.equal(home.revealed.length, 1);
  assert.equal(home.revealed[0][0].data.suggestion.label, 'docs: 2 problems to fix');
  assert.deepEqual(home.revealed[0][1], { select: true, focus: true, expand: true });
  b.cleanup();
});

test('FR-048: a check that found nothing is only said; no button is offered where nothing needs a person', async () => {
  const passing = k.check([{ name: 'docs', status: 'passed', findings: [], notes: [], data: {} }]);
  const b = await boot({ docs: defaultDocs({ 'check --changed': { doc: passing }, 'doctor': { doc: k.doc('doctor', 'other', { status: 'ok', toolchain: [], conflicts: [] }) } }) });
  await b.command('checkChanged');
  assert.equal(warnings(b).length, 0);
  const info = b.stub.calls.messages.filter((m: Loose) => m.kind === 'info').map((m: Loose) => m.text);
  assert.ok(info.includes('other check: 1 passed, 0 failed, 0 skipped.'));
  b.cleanup();
});

test('FR-048: generated files out of date come with the rewriting command and a button that runs it through the dry-run diff', async () => {
  const fresh = k.doc('fresh', 'all', { status: 'stale', generators: [{ name: 'theme', status: 'stale', stale: [{ path: 'a', why: 'differs' }] }] },
    { actions: [action('rewrite what theme writes', 'widget approve', 'decision', { widget: 'w1' })] });
  const b = await boot({ docs: defaultDocs({ fresh: { doc: fresh, exit: 1 }, 'command show fresh': { doc: k.detail('fresh', 'check', []) } }) });
  b.stub.script.warnings.push('Rewrite what theme writes');
  b.stub.script.reviews.push('apply');   // the review in the panel: apply
  b.stub.script.warnings.push(undefined);                             // the decision's modal is dismissed
  await b.command('fresh');
  const [notice] = warnings(b);
  assert.match(notice.text, /^other fresh: stale\. Rewrite what theme writes\. Run other widget approve\.$/);
  assert.deepEqual(notice.rest, ['Rewrite what theme writes', 'Show all']);
  const ran = b.first.invocations().filter((i: Loose) => i.argv[0] === 'widget').map((i: Loose) => i.argv.join(' '));
  assert.deepEqual(ran, ['widget approve w1 --dry-run --json'], 'the dry run first; the decision\'s modal was dismissed, so it stops there');
  b.cleanup();
});

test('FR-048: a doctor that finds a toolchain entry absent says which, gives its fetch command and runs it from a button', async () => {
  const b = await boot();
  b.stub.script.warnings.push(undefined);
  await b.command('doctor');
  const [notice] = warnings(b);
  assert.match(notice.text, /^other doctor: something missing\. big is not fetched yet\. Run other widget new\.$/);
  assert.deepEqual(notice.rest, ['Fetch big', 'Show all']);
  b.cleanup();
});
