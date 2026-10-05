// The resource panel (0043-if-console FR-042, FR-011, FR-014): one webview, drawn from the resource's JSON, with a strict policy, history, and
// messages from its page that name only what the extension itself put in the model.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import type { Loose } from './support/fake-launcher';
import { action, boot, change, defaultDocs, k } from './support/boot';
import { buildResource, humanize } from '../src/model/panel';
import { buildPreview } from '../src/model/preview';
import { NO_PRESENTATION } from '../src/model/presentation';
import { readDoc } from '../src/model/wire';

const tick = () => new Promise((r) => setImmediate(r));
const last = (panel: Loose) => panel.posted.filter((m: Loose) => m.type === 'model').at(-1).view;
const ctx = (extra?: Loose) => ({ presentation: NO_PRESENTATION, isFile: (p: string) => p === 'docs/guide.md', ...(extra ?? {}) });
const doc = (kind: string, id: string, data: Loose, extra?: Loose) => readDoc(k.doc(kind, id, data, extra)) as Loose;

async function openRow(b: Loose, label = 'w1') {
  const tree = b.context.subscriptions.find((s: Loose) => s.id === 'if-console.commands').o.treeDataProvider;
  const roots = await tree.getChildren();
  const noun = (await tree.getChildren(roots[0])).find((n: Loose) => n.kind === 'noun');
  const row = (await tree.getChildren(noun)).find((n: Loose) => n.kind === 'resource' && n.data.label === label);
  await b.command('activateNode', row);
  await tick();
  return b.stub.calls.webviews[0];
}

test('FR-011, FR-042: a resource opens in a webview whose policy allows no remote source and no script but its own, from the extension\'s own files', async () => {
  const b = await boot();
  const panel = await openRow(b);
  assert.ok(panel, 'a panel opened');
  const html = panel.webview.html;
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|http:|https:/);
  const nonce = /script-src 'nonce-([0-9a-f]+)'/.exec(html)?.[1];
  assert.equal([...html.matchAll(/<script/g)].length, 1, 'one script: this extension\'s own');
  assert.ok(html.includes(`<script nonce="${nonce}" src="vscode-resource:`), 'which the nonce allows');
  assert.match(html, /vscode-resource:[^"]*dist[/\\]webview\.js/);
  assert.match(html, /id="vscode-codicon-stylesheet"/, 'the font of the codicons, from the extension\'s own files');
  assert.doesNotMatch(html, /<style|style="/, 'no inline style');
  assert.equal(panel.opts.enableCommandUris, false);
  assert.equal(panel.opts.enableScripts, true);
  assert.equal(panel.opts.retainContextWhenHidden, false);
  assert.equal(panel.opts.localResourceRoots.length, 1);
  assert.match(panel.opts.localResourceRoots[0].path, /dist$/, 'only the extension\'s own bundle, never the clone');
  assert.deepEqual(b.first.invocations().filter((i: Loose) => i.argv.includes('--html')), [], 'a page rendered by the launcher is never asked for');
  assert.ok(b.first.invocations().some((i: Loose) => i.argv.join(' ') === 'widget show w1 --json'));
  b.cleanup();
});

test('FR-042: the page is drawn from the JSON: its model has the header, the actions and the sections of the resource, and the page holds no string of its own', async () => {
  const b = await boot();
  const panel = await openRow(b);
  const view = last(panel);
  assert.equal(view.built.header.title, 'w1');
  assert.equal(view.built.header.kind, 'Widget');
  assert.equal(view.built.header.icon, 'symbol-event', 'the noun\'s codicon, from the presentation');
  assert.equal(view.built.header.audience, 'private', 'the audience as the launcher states it');
  assert.ok(view.built.header.pills.some((p: Loose) => p.text === 'ready' && p.status === 'ok'), 'the status in the fixed vocabulary');
  assert.deepEqual(view.built.actions.map((a: Loose) => [a.label, a.primary, a.decision, a.enabled]),
    [['approve it', false, true, true], ['rename', true, false, true], ['blocked', false, false, false], ['run its check', false, false, true]]);
  assert.match(view.built.actions[2].reason, /nothing left to do/, 'a disabled action says why');
  assert.equal(view.built.actions[0].icon, 'law', 'a decision is styled apart');
  assert.equal(view.labels.decision, 'Decision');
  assert.equal(view.nav.canBack, false);
  assert.deepEqual(view.nav.crumbs, [{ label: 'w1', current: true }]);
  assert.equal(view.context, false, 'this command line has no context command');
  assert.equal(panel.posted.at(-1).type, 'model');
  b.cleanup();
});

test('FR-042: one panel for the window: another resource reveals it, history goes back and forward, and a crumb returns to an earlier one', async () => {
  const b = await boot();
  const panel = await openRow(b, 'w1');
  const tree = b.context.subscriptions.find((s: Loose) => s.id === 'if-console.commands').o.treeDataProvider;
  const noun = (await tree.getChildren((await tree.getChildren())[0])).find((n: Loose) => n.kind === 'noun');
  const w2 = (await tree.getChildren(noun)).find((n: Loose) => n.kind === 'resource' && n.data.label === 'w2');
  const revealed = panel.revealed.length;
  await b.command('activateNode', w2);
  await tick();
  assert.equal(b.stub.calls.webviews.length, 1, 'no second panel');
  assert.ok(panel.revealed.length > revealed, 'the one panel was revealed');
  assert.equal(panel.title, 'w2');
  assert.deepEqual(last(panel).nav.crumbs.map((c: Loose) => c.label), ['w1', 'w2']);
  assert.equal(last(panel).nav.canBack, true);
  await panel.onMessage({ type: 'back' });
  assert.equal(last(panel).built.header.title, 'w1');
  assert.equal(last(panel).nav.canForward, true);
  await panel.onMessage({ type: 'forward' });
  assert.equal(last(panel).built.header.title, 'w2');
  await panel.onMessage({ type: 'crumb', index: 0 });
  assert.equal(last(panel).built.header.title, 'w1');
  await panel.onMessage({ type: 'crumb', index: 7 });   // not an entry: nothing
  assert.equal(last(panel).built.header.title, 'w1');
  await panel.onMessage({ type: 'side' });
  assert.deepEqual(panel.revealed.at(-1), [-2, false], 'Open to the Side moves it beside');
  panel.dispose();
  await openRow(b, 'w1');
  assert.equal(b.stub.calls.webviews.length, 2, 'once it is closed, the next one opens a panel again, with no history');
  assert.deepEqual(last(b.stub.calls.webviews[1]).nav.crumbs.length, 1);
  b.cleanup();
});

test('FR-042: a page can ask only for what the model holds: an index it was not given, a text it was not shown or an unknown message does nothing', async () => {
  const b = await boot();
  const panel = await openRow(b);
  const before = b.first.invocations().length;
  await panel.onMessage({ type: 'run', action: 42 });
  await panel.onMessage({ type: 'run', action: -1 });
  await panel.onMessage({ type: 'run', action: 'check' });
  await panel.onMessage({ type: 'open', ref: 9 });
  await panel.onMessage({ type: 'copy', text: 'rm -rf /' });
  await panel.onMessage({ type: 'file', path: '/etc/passwd', line: 1 });
  await panel.onMessage({ type: 'command', words: ['widget', 'approve'] });
  await panel.onMessage('not even an object');
  assert.equal(b.first.invocations().length, before, 'nothing was run');
  assert.deepEqual(b.stub.calls.clipboard, []);
  assert.deepEqual(b.stub.calls.opened, []);
  await panel.onMessage({ type: 'copy', text: 'other check' });
  assert.deepEqual(b.stub.calls.clipboard, ['other check'], 'a command line the model carries may be copied');
  b.cleanup();
});

test('FR-042, FR-015: an action runs through the one path: the primary as it is, a decision only after its dry run, its changes and its modal', async () => {
  const b = await boot();
  const panel = await openRow(b);
  const view = last(panel);
  const approve = view.built.actions.findIndex((a: Loose) => a.decision);
  b.stub.script.reviews.push('apply');
  b.stub.script.warnings.push(undefined);   // the modal is dismissed
  await panel.onMessage({ type: 'run', action: approve });
  const ran = b.first.invocations().filter((i: Loose) => i.argv[1] === 'approve').map((i: Loose) => i.argv.join(' '));
  assert.deepEqual(ran, ['widget approve w1 --dry-run --json'], 'the dry run, then the modal stopped it');
  assert.ok(b.stub.calls.messages.some((m: Loose) => m.kind === 'warning' && /decision only you can make/.test(m.text)));
  const blocked = view.built.actions.findIndex((a: Loose) => !a.enabled);
  const n = b.first.invocations().length;
  await panel.onMessage({ type: 'run', action: blocked });
  assert.equal(b.first.invocations().length, n, 'a disabled action does not run');
  assert.match(b.stub.calls.messages.at(-1).text, /cannot run now: nothing left to do/);
  b.cleanup();
});

test('FR-014, FR-042: a dry run is shown in the panel as a change summary with Apply and Discard, each file opens as a diff, and closing the panel discards', async () => {
  const b = await boot();
  fs.mkdirSync(path.join(b.first.root, 'widgets'));
  fs.writeFileSync(path.join(b.first.root, 'widgets', 'w1.txt'), 'old\n');
  const panel = await openRow(b);
  const approve = last(panel).built.actions.findIndex((a: Loose) => a.decision);
  b.stub.script.reviews.push([{ type: 'diff', index: 0 }, { type: 'diff', index: 5 }, 'discard']);
  await panel.onMessage({ type: 'run', action: approve });
  const model = panel.posted.map((m: Loose) => m.view).filter((v: Loose) => v?.built.mode === 'preview');
  assert.ok(model.length >= 1, 'the preview was shown in the panel');
  const preview = model[0];
  assert.equal(preview.built.header.kind, 'Decision, dry run');
  assert.deepEqual(preview.built.sections[0].changes.map((c: Loose) => [c.path, c.change, c.added, c.removed]), [['widgets/w1.txt', 'modify', 1, 1]]);
  assert.match(preview.built.sections[0].summary, /1 file would change: 1 lines added, 1 removed/);
  assert.equal(preview.built.preview.apply, 'Continue to the decision', 'a decision\'s Apply leads on to its modal');
  assert.equal(preview.nav.canBack, false, 'a preview has no history to leave by');
  assert.equal(b.stub.calls.diffs.length, 1, 'one diff: the file named; an index not in the model opens nothing');
  const [left, right] = b.stub.calls.diffs[0];
  assert.equal(b.stub.calls.contentProvider.p.provideTextDocumentContent(left), 'old\n');
  assert.equal(b.stub.calls.contentProvider.p.provideTextDocumentContent(right), 'new\n');
  assert.deepEqual(b.first.invocations().filter((i: Loose) => i.argv[1] === 'approve').map((i: Loose) => i.dry), [true], 'discarded: nothing ran for real');
  assert.equal(panel.posted.map((m: Loose) => m.view).at(-1).built.mode, 'resource', 'the preview gave way to the resource the person came from');
  b.cleanup();
});

test('FR-014: a closed panel resolves a waiting preview as discarded', async () => {
  const b = await boot();
  const panel = await openRow(b);
  const approve = last(panel).built.actions.findIndex((a: Loose) => a.decision);
  const run = panel.onMessage({ type: 'run', action: approve });
  for (let i = 0; i < 250 && !panel.posted.some((m: Loose) => m.view?.built.mode === 'preview'); i += 1) await new Promise((r) => setTimeout(r, 20));
  assert.ok(panel.posted.some((m: Loose) => m.view?.built.mode === 'preview'), 'the preview is waiting');
  panel.dispose();
  await run;
  assert.deepEqual(b.first.invocations().filter((i: Loose) => i.argv[1] === 'approve').map((i: Loose) => i.dry), [true]);
  b.cleanup();
});

// ---- the sections, chosen by the data's shape ----------------------------------------------------------------------------------

const work = doc('work', 'book/x', {
  work: 'book/x', title: 'Book X', kind: 'book', kind_label: 'Book', stage: 'Review', public: false, owner: 'Press', path: 'docs/guide.md', line: 3,
  description: 'A short description of the book.',
  note: 'This is a long note. '.repeat(12),
  audiences: ['VaultCircle', 'Press'],
  stages: [{ stage: 'Intake', label: 'Intake', order: 1, state: 'reached', decided: null }, { stage: 'Review', label: 'Review', order: 2, state: 'current', decided: { date: '2026-10-02', by: 'Ann' } },
    { stage: 'Prep', label: 'Prep', order: 3, state: 'ahead', decided: null }],
  decisions: [{ date: '2026-10-02', change: 'Entered at Review', by: 'Ann', why: 'Because.' }, { date: '2026-10-04', change: 'Decision', by: 'Ann', why: 'Another.' }],
  palette: { ink: '#121820', paper: '#f3f0e8' },
  needs: [{ level: 'attention', category: 'unsorted', text: 'Needs sorting: one', work: 'book/x', command: 'widget show', fields: { widget: 'w2' } }, { level: 'info', category: 'unsorted', text: 'Two', work: 'book/x' }],
  empty: [],
}, { links: [{ rel: 'owner', command: 'widget show', fields: { widget: 'w9' }, cli: 'other widget show w9' }], actions: [action('Advance', 'widget approve', 'decision', {}), action('Check', 'check', 'check', {})] });

test('FR-042: a key-value grid for scalars, with a file as a link, a color as a swatch and a list of words as tags; long text as paragraphs', () => {
  const built = buildResource(work, ctx());
  const kv = built.sections[0] as Loose;
  assert.equal(kv.type, 'kv');
  const item = (key: string) => kv.items.find((i: Loose) => i.key === key);
  assert.deepEqual([item('kind').value, item('kind').kind], ['book', 'text']);
  assert.deepEqual([item('public').value, item('public').kind], ['No', 'bool']);
  assert.deepEqual([item('path').value, item('path').kind, item('path').file], ['docs/guide.md:3', 'file', { path: 'docs/guide.md', line: 3 }], 'a file in the clone is a link to its line');
  assert.deepEqual(item('audiences').items, ['VaultCircle', 'Press']);
  assert.equal(item('title'), undefined, 'the title is the header\'s');
  assert.equal(built.header.subtitle, 'A short description of the book.');
  const note = built.sections.find((s: Loose) => s.id === 'note') as Loose;
  assert.equal(note.type, 'text', 'long text is read as paragraphs');
  assert.equal(note.blocks[0].kind, 'p');
  const palette = built.sections.find((s: Loose) => s.id === 'palette') as Loose;
  assert.deepEqual(palette.items.map((i: Loose) => [i.key, i.kind]), [['ink', 'color'], ['paper', 'color']]);
});

test('FR-042: a list of stages is a stepper, a list of findings is grouped with severity and jump-to-file, a list of objects is a table, an empty list is guidance', () => {
  const built = buildResource(work, ctx());
  const stages = built.sections.find((s: Loose) => s.type === 'stages') as Loose;
  assert.deepEqual(stages.stages.map((s: Loose) => [s.label, s.state, s.note]), [['Intake', 'done', ''], ['Review', 'current', 'decided 2026-10-02 by Ann'], ['Prep', 'todo', '']]);
  const findings = built.sections.find((s: Loose) => s.type === 'findings') as Loose;
  assert.equal(findings.groups.length, 1);
  assert.equal(findings.groups[0].name, 'Unsorted');
  assert.deepEqual(findings.groups[0].findings.map((f: Loose) => [f.status, f.message]), [['warning', 'Needs sorting: one'], ['info', 'Two']]);
  assert.equal(typeof findings.groups[0].findings[0].open, 'number', 'a finding that names a command opens it');
  const table = built.sections.find((s: Loose) => s.type === 'table') as Loose;
  assert.equal(table.id, 'decisions');
  assert.deepEqual(table.columns.map((c: Loose) => c.label), ['Date', 'Change', 'By', 'Why']);
  assert.equal(table.rows.length, 2);
  const empty = built.sections.find((s: Loose) => s.id === 'empty') as Loose;
  assert.equal(empty.type, 'empty');
  assert.match(empty.guidance, /Use “Check” above/, 'an empty section says what to do');
  const chips = built.sections.find((s: Loose) => s.type === 'chips') as Loose;
  assert.deepEqual(chips.chips.map((c: Loose) => c.label), ['Owner: w9'], 'the links that open nothing else are chips');
  assert.equal(built.held.refs[chips.chips[0].open].kind, 'link');
});

test('FR-042: a table\'s rows open the resource their command line shows: by the list\'s own declaration, or by a `show` link that carries the row\'s value', () => {
  const presentation = { views: [], references: [], nouns: [{ noun: 'widget', title: 'Widget', icon: 'symbol-event', view: 'widgets', list: { command: 'widget list', rows: 'widgets', id: 'id', label: 'name', statusMap: {}, tooltip: [] } }] };
  const rows = doc('widget-list', 'all', { count: 2, widgets: [{ id: 'w1', name: 'First', parts: 3, state: 'ready' }, { id: 'w2', name: 'Second', parts: 12, state: 'broken' }], other: [{ name: 'p', size: 1 }, { name: 'q', size: 2 }] },
    { links: [{ rel: 'x', command: 'thing show', fields: { thing: 'q' }, cli: 'o thing show q' }] });
  const built = buildResource(rows, ctx({ presentation }));
  const table = built.sections.find((s: Loose) => s.id === 'widgets') as Loose;
  assert.deepEqual(table.rows.map((r: Loose) => built.held.refs[r.open]), [{ kind: 'row', noun: 'widget', id: 'w1' }, { kind: 'row', noun: 'widget', id: 'w2' }]);
  assert.deepEqual(table.columns.filter((c: Loose) => c.numeric).map((c: Loose) => c.key), ['parts']);
  assert.equal(table.rows[1].cells[3].status, 'error', 'a status column is colored by the vocabulary');
  const other = built.sections.find((s: Loose) => s.id === 'other') as Loose;
  assert.deepEqual(other.rows.map((r: Loose) => r.open === undefined ? null : (built.held.refs[r.open] as Loose).link.command), [null, 'thing show']);
  assert.equal(built.header.title, 'Widget list');
});

test('FR-042: a check\'s findings are grouped by section with the section\'s status, each at its file:line when the file is in the clone', () => {
  const checks = readDoc(k.check([{ name: 'docs', status: 'failed', findings: [k.finding, { level: 'warning', where: 'general', message: 'no file', next: 'say more' }], notes: [], data: {} },
    { name: 'links', status: 'passed', findings: [], notes: [], data: {} }, { name: 'slow', status: 'skipped', findings: [], notes: [], data: {}, reason: 'not fetched' }])) as Loose;
  const built = buildResource(checks, ctx());
  assert.equal(built.header.title, 'Check results');
  assert.equal(built.header.icon, 'checklist');
  assert.deepEqual(built.header.pills.map((p: Loose) => p.text).filter((t: string) => /^\d/.test(t)).sort(), ['1 failed', '1 passed', '1 skipped']);
  const groups = (built.sections.find((x: Loose) => x.type === 'findings') as Loose).groups;
  assert.deepEqual(groups.map((g: Loose) => [g.name, g.status]), [['docs', 'error'], ['links', 'ok'], ['slow', 'skipped']]);
  assert.equal(groups[2].note, 'not fetched');
  assert.deepEqual(groups[0].findings.map((f: Loose) => [f.status, f.file ?? null]), [['error', k.finding.where.endsWith('3') ? { path: 'docs/guide.md', line: 3 } : null], ['warning', null]]);
  assert.equal(groups[0].findings[1].next, 'say more');
});

test('FR-042: Copy as JSON puts the resource on the clipboard with secrets removed, and Copy Context runs the context command only where there is one', async () => {
  const docs = defaultDocs({ 'widget show w1': { doc: k.doc('widget', 'w1', { name: 'w1', kind: 'blue', state: 'ready', token: 'ghp_abcdefghijklmnopqrstuvwxyz0123456789' }) } });
  const b = await boot({ docs });
  const panel = await openRow(b);
  await panel.onMessage({ type: 'copyJson' });
  assert.match(b.stub.calls.clipboard[0], /"id": "w1"/);
  assert.doesNotMatch(b.stub.calls.clipboard[0], /ghp_abcdef/);
  const n = b.first.invocations().length;
  await panel.onMessage({ type: 'copyContext' });
  assert.equal(b.first.invocations().length, n, 'no context command: nothing is asked');
  await panel.onMessage({ type: 'refresh' });
  assert.ok(b.first.invocations().length > n, 'Refresh asks the launcher again');
  assert.equal(b.stub.calls.webviews.length, 1);
  b.cleanup();
});

test('FR-042: the panel\'s own style names no color: only VS Code\'s theme variables', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src', 'webview', 'panel.css'), 'utf8');
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, 'no hex color');
  assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\(/, 'no functional color');
  assert.doesNotMatch(css, /@import|url\(|http/, 'nothing is loaded from the style');
  assert.ok(css.includes('var(--vscode-foreground)') && css.includes('var(--vscode-focusBorder)'));
});

test('FR-042: the preview and the words are model data: a dry run of two files summarizes them and a decision says so', () => {
  const built = buildPreview({ id: 'x do', title: 'Do X…', category: 'decision', help: 'It does X' }, [{ ...change }, { ...change, path: 'b.txt', change: 'create', added: 4, removed: 0 }], 'other');
  assert.equal(built.header.title, 'Do X');
  assert.deepEqual(built.header.pills.map((p: Loose) => p.text), ['2 files', '+5', '−1', 'Decision']);
  assert.equal(humanize('kind_label'), 'Kind label');
});

test('FR-014: opening another resource while a dry run waits is Discard, so that nothing waits for ever and nothing is written', async () => {
  const b = await boot();
  const panel = await openRow(b);
  const approve = last(panel).built.actions.findIndex((a: Loose) => a.decision);
  const run = panel.onMessage({ type: 'run', action: approve });
  for (let i = 0; i < 250 && !panel.posted.some((m: Loose) => m.view?.built.mode === 'preview'); i += 1) await new Promise((r) => setTimeout(r, 20));
  const tree = b.context.subscriptions.find((s: Loose) => s.id === 'if-console.commands').o.treeDataProvider;
  const noun = (await tree.getChildren((await tree.getChildren())[0])).find((n: Loose) => n.kind === 'noun');
  const w2 = (await tree.getChildren(noun)).find((n: Loose) => n.kind === 'resource' && n.data.label === 'w2');
  await b.command('activateNode', w2);
  await run;
  assert.deepEqual(b.first.invocations().filter((i: Loose) => i.argv[1] === 'approve').map((i: Loose) => i.dry), [true], 'only the dry run ran');
  assert.equal(last(panel).built.header.title, 'w2');
  assert.deepEqual(last(panel).nav.crumbs.map((c: Loose) => c.label), ['w1', 'w2'], 'the preview is not in the history');
  b.cleanup();
});
