// The native surfaces (0043-if-console FR-020, FR-038, FR-040): file decorations, progress in the view that started the work, the Stop action
// that ends it, and the output channel.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import type { Loose } from './support/fake-launcher';
import { boot, defaultDocs } from './support/boot';
import { Uri } from './support/vscode-stub';

const waitFor = async (fn: () => boolean): Promise<void> => { for (let i = 0; i < 100 && !fn(); i += 1) await new Promise((r) => setTimeout(r, 50)); assert.ok(fn(), 'timed out'); };
const view = (b: Loose, id: string): Loose => b.stub.calls.treeViews.get(id).o.treeDataProvider;

test('FR-040: a file with findings is badged with their count and colored by the worst, its folders carry the color, and a file without has none', async () => {
  const b = await boot();
  fs.mkdirSync(path.join(b.first.root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(b.first.root, 'docs', 'guide.md'), 'x\ny\nz\n');
  const provider = b.stub.calls.decorationProvider;
  const guide = Uri.file(path.join(b.first.root, 'docs', 'guide.md'));
  assert.equal(provider.provideFileDecoration(guide), undefined, 'before a check there is nothing');
  await b.command('runSection', (await view(b, 'if-console.checks').getChildren())[0]);
  const d = provider.provideFileDecoration(guide);
  assert.equal(d.badge, '1');
  assert.equal(d.color.id, 'list.errorForeground');
  assert.equal(d.propagate, true, 'the folders above are colored too');
  assert.match(d.tooltip, /1 error from IF Console checks/);
  assert.equal(provider.provideFileDecoration(Uri.file(path.join(b.first.root, 'other.md'))), undefined);
  assert.equal(provider.provideFileDecoration(Uri.parse('untitled:x')), undefined);
  let fired = 0;
  provider.onDidChangeFileDecorations(() => { fired += 1; });
  await b.command('runSection', (await view(b, 'if-console.checks').getChildren())[0]);
  assert.ok(fired > 0, 'a section that ran again redraws the files it touched');
  b.cleanup();
});

test('FR-038, FR-020: work a view started is progress in that view, and the Stop action ends it; work from the palette is a notification with its own Cancel', async () => {
  const b = await boot({ docs: defaultDocs({ 'check docs': { hang: true } }) });
  const section = (await view(b, 'if-console.checks').getChildren())[0];
  const done = b.command('runSection', section);
  await waitFor(() => b.stub.calls.contexts.get('if-console.running') === true && b.first.invocations().some((i: Loose) => i.argv.join(' ') === 'check docs --json'));
  assert.ok(b.stub.calls.progress.some((o: Loose) => o.location?.viewId === 'if-console.checks'), 'progress at the Checks view');
  await b.command('cancelRun');
  await done;
  assert.equal(b.stub.calls.contexts.get('if-console.running'), false);
  assert.ok(b.first.invocations().some((i: Loose) => i.argv.join(' ') === 'check docs --json'));
  b.cleanup();
  const p = await boot();
  await p.command('doctor');
  assert.ok(p.stub.calls.progress.some((o: Loose) => o.location === 15 && o.cancellable === true), 'a notification that can be cancelled');
  p.cleanup();
});

test('FR-038: a command run from a row shows its progress at the view of that row', async () => {
  const b = await boot();
  const home = view(b, 'if-console.home');
  const row = (await home.getChildren()).find((n: Loose) => n.data.suggestion?.id === 'check:none');
  await b.command('runSuggestion', row);
  assert.ok(b.stub.calls.progress.some((o: Loose) => o.location?.viewId === 'if-console.home'), JSON.stringify(b.stub.calls.progress));
  assert.equal(b.stub.calls.contexts.get('if-console.running'), false, 'and it is not running any more');
  b.cleanup();
});

test('FR-038: a forged node runs no suggestion', async () => {
  const b = await boot();
  const before = b.first.invocations().length;
  await b.command('runSuggestion', { kind: 'suggestion', data: { suggestion: { run: { kind: 'words', words: ['widget', 'approve', 'w1'] } } }, repo: {} });
  assert.equal(b.first.invocations().length, before);
  b.cleanup();
});

test('Stop with nothing running says so', async () => {
  const b = await boot();
  await b.command('cancelRun');
  assert.ok(b.stub.calls.messages.some((m: Loose) => m.kind === 'info' && m.text === 'Nothing is running.'));
  b.cleanup();
});

test('FR-040: the output channel is a log channel with levels', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'log.ts'), 'utf8');
  assert.match(src, /createOutputChannel\(name, \{ log: true \}\)/);
});
