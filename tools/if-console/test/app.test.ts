import test from 'node:test';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import * as fs from 'fs';
import * as path from 'path';
import { boot, defaultDocs, k } from './support/boot';
import { makeRepo } from './support/fake-launcher';
import { createStub, folderOf, install } from './support/vscode-stub';
import { EXT_ROOT } from './support/paths';

const manifest = JSON.parse(fs.readFileSync(path.join(EXT_ROOT, 'package.json'), 'utf8'));
const children = async (view: Loose, node?: Loose): Promise<Loose[]> => view.getChildren(node);
const labels = async (view: Loose, nodes: Loose) => nodes.map((n: Loose) => view.getTreeItem(n).label);

test('FR-001, FR-015: activating returns nothing, so the extension exports no API', async () => {
  const b = await boot();
  assert.equal(b.exported, undefined);
  b.cleanup();
});

test('FR-005, FR-016, SC-001: a trusted repository shows its orchestrator, audience and health in the status bar', async () => {
  const b = await boot();
  const bar = b.context.subscriptions.find((s) => s.item);
  assert.match(bar.item.text, /^\$\(warning\) other 1$/, 'the icon, the orchestrator and how many things need a person');
  assert.deepEqual(bar.item.command.arguments, ['suggestions']);
  assert.equal(bar.item.command.command, 'if-console.showHome', 'choosing it opens Home focused on the suggestions, never a silent refresh');
  const tip = bar.item.tooltip.value.replace(/\\/g, '');
  assert.match(tip, /audience private \(as the command line states it\); health: something missing/);
  assert.match(tip, /big is not fetched yet/, 'the tooltip says what needs a person, with its command line and a button that runs it');
  assert.match(tip, /Fetch big/);
  assert.ok(bar.item.visible);
  assert.deepEqual(b.first.invocations()[0].argv, ['command', 'list', '--json']);
  b.cleanup();
});

test('FR-006: in an untrusted workspace no launcher runs, and the reason is shown in plain words with the action that trusts it', async () => {
  const b = await boot({ trusted: false });
  assert.deepEqual(b.first.invocations(), []);
  const bar = b.context.subscriptions.find((s) => s.item);
  assert.match(bar.item.text, /not trusted/);
  assert.match(bar.item.tooltip.value, /does not trust this workspace/);
  const views = b.stub.calls.registered;
  await b.command('runCommand');
  assert.deepEqual(b.first.invocations(), [], 'the palette runs nothing either');
  const info = b.stub.calls.messages.filter((m: Loose) => m.kind === 'info').map((m: Loose) => m.text).join('\n');
  assert.match(info, /does not trust this workspace/);
  assert.ok(views.has('if-console.trust'));
  assert.ok(manifest.contributes.viewsWelcome.some((w: Loose) => /Trust this workspace/.test(w.contents)));
  b.cleanup();
});

test('FR-008: the tree lists nouns, then the editor\'s commands and the noun\'s resources, then a resource\'s links and actions', async () => {
  const b = await boot();
  const tree = b.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
  const roots = await children(tree);
  assert.deepEqual(await labels(tree, roots), ['other']);
  const top = await children(tree, roots[0]);
  assert.deepEqual(await labels(tree, top), ['Repository-wide', 'widget']);
  const wide = await children(tree, top[0]);
  assert.deepEqual(await labels(tree, wide), ['check', 'doctor', 'fresh']);
  const widget = await children(tree, top[1]);
  assert.deepEqual(await labels(tree, widget), ['widget list', 'widget show', 'widget new', 'widget approve', 'w1', 'w2']);
  const w1 = widget.find((n: Loose) => n.kind === 'resource' && n.data.label === 'w1');
  const under = await children(tree, w1);
  assert.deepEqual(await labels(tree, under), ['w2', 'approve it', 'rename', 'blocked', 'run its check']);
  const items = under.map((n: Loose) => tree.getTreeItem(n));
  assert.equal(items[0].description, 'owner');
  assert.equal(items[1].description, 'decision');
  assert.match(items[3].description, /unavailable: nothing left to do/);
  assert.equal(items[3].command, undefined, 'a disabled action cannot be run');
  const all = JSON.stringify(await labels(tree, [...top, ...wide, ...widget]));
  assert.ok(!all.includes('secret tool') && !all.includes('mcp serve'), 'a command the editor does not expose is not listed');
  b.cleanup();
});

test('FR-007: two folders whose launchers share a name are two repositories, each apart', async () => {
  const second = defaultDocs();
  const b = await boot({ second });
  const tree = b.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
  const roots = await children(tree);
  assert.equal(roots.length, 2);
  assert.deepEqual(roots.map((r: Loose) => tree.getTreeItem(r).description.split(' \u00b7 ')[0]), ['first', 'second']);
  assert.ok(b.repos[1].invocations().length > 0);
  b.cleanup();
});

test('FR-005, FR-021: a launcher that does not answer, or answers in a newer form, is not shown as an orchestrator, and the output says why', async () => {
  const b = await boot({ docs: { 'command list': { doc: { ...k.list, schema: 'other/command-list@2' } } } });
  const tree = b.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
  const roots = await children(tree);
  assert.equal(roots.length, 1);
  assert.equal(tree.getTreeItem(roots[0]).iconPath.id, 'warning');
  assert.match(b.stub.calls.output.join('\n'), /newer form/);
  assert.match((await children(tree, roots[0]))[0].data.text, /Update the IF Console extension/);
  b.cleanup();

  const c = await boot({ docs: { '*': { doc: 'nonsense' } } });
  assert.equal((await children(c.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider)).length, 0);
  assert.match(c.stub.calls.output.join('\n'), /not shown as an orchestrator/);
  c.cleanup();
});

test('FR-004: a workspace\'s own setting cannot name what the extension runs; only the person\'s own settings add a name', async () => {
  const fake = makeRepo({ docs: defaultDocs(), declare: false, launcherName: 'tool' });
  for (const [config, workspaceConfig, expected] of [[{}, { launchers: ['tool'] }, 0], [{ launchers: ['tool'] }, {}, 1]] as Array<[Loose, Loose, number]>) {
    const stub = createStub({ folders: [folderOf('f', fake.root)], config, workspaceConfig });
    const restore = install(stub);
    const ext = require('../src/extension') as Loose;
    const context: { subscriptions: Loose[] } = { subscriptions: [] };
    await ext.activate(context);
    const tree = context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
    assert.equal((await tree.getChildren()).length, expected);
    context.subscriptions.forEach((s) => { try { s.dispose(); } catch { /* */ } });
    restore();
  }
  fake.cleanup();
});

test('every contributed command is registered, and nothing unlisted is', async () => {
  const b = await boot();
  const declared = manifest.contributes.commands.map((c: Loose) => c.command).sort();
  assert.deepEqual([...b.stub.calls.registered.keys()].sort(), declared);
  assert.ok(declared.every((c: Loose) => c.startsWith('if-console.')));
  b.cleanup();
});

test('FR-009, FR-010: a check shows its findings in Problems and skipped sections as skipped, never as passed', async () => {
  const b = await boot();
  const ctl = b.stub.calls.testController;
  const repoItem = [...ctl.items][0][1];
  const leaves: Loose[] = [];
  repoItem.children.forEach((c: Loose) => leaves.push(c));
  assert.deepEqual(leaves.map((l) => l.label), ['docs', 'links', 'slow']);
  await ctl.handler({ include: undefined, exclude: [] }, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) });
  const log = ctl.runs[0].log.filter((e: Loose) => ['passed', 'failed', 'skipped', 'errored'].includes(e[0])).map((e: Loose) => `${e[0]}:${e[1].split(':').pop()}`);
  assert.deepEqual(log, ['failed:docs', 'passed:links', 'skipped:slow']);
  const failed = ctl.runs[0].log.find((e: Loose) => e[0] === 'failed');
  assert.match(failed[2][0].message, /broken link/);
  const calls = b.first.invocations().map((i) => i.argv.join(' '));
  assert.ok(calls.includes('check docs --json') && calls.includes('check links --json') && calls.includes('check slow --json'));
  b.cleanup();
});

test('FR-010: tasks of type if-console run check, test, fresh, doctor and a suite, and send findings to Problems', async () => {
  const b = await boot();
  const { provider, type } = b.stub.calls.tasks;
  assert.equal(type, 'if-console');
  assert.equal(manifest.contributes.taskDefinitions[0].type, 'if-console');
  const tasks = await provider.provideTasks();
  assert.deepEqual(tasks.map((t: Loose) => t.name), ['other check', 'other check --suite quick', 'other fresh', 'other doctor']);
  const check = tasks[0];
  const term = await check.execution.callback();
  const written: Loose[] = [];
  term.onDidWrite((l: Loose) => written.push(l));
  const closed = new Promise((res) => term.onDidClose(res));
  await term.open();
  assert.equal(await closed, 1);
  assert.match(written.join(''), /FAILED {2}docs/);
  assert.match(written.join(''), /skipped {2}slow \(its toolchain entry is not fetched\)/);
  const resolved = provider.resolveTask({ definition: { type: 'if-console', command: 'check', section: 'docs' } });
  assert.match(resolved.name, /docs/);
  assert.equal(provider.resolveTask({ definition: { type: 'if-console', command: 'spec set' } }), undefined, 'only repository-wide commands are tasks');
  b.cleanup();
});

test('FR-022: a trusted repository whose list has `mcp serve` is registered as a stdio server; a repository without it is not', async () => {
  const withMcp = defaultDocs({ 'command list': { doc: { ...k.list, data: { ...k.list.data, commands: [...k.list.data.commands.filter((c: Loose) => c.id !== 'mcp serve'), { id: 'mcp serve', category: 'setup', group: 'g', surfaces: ['terminal'], help: 'serve' }] } } } });
  const b = await boot({ docs: withMcp });
  const { provider, id } = b.stub.calls.mcp;
  assert.equal(id, 'if-console.servers');
  assert.equal(manifest.contributes.mcpServerDefinitionProviders[0].id, id);
  const defs = await provider.provideMcpServerDefinitions();
  assert.equal(defs.length, 1);
  assert.deepEqual(defs[0].args, ['mcp', 'serve']);
  assert.equal(defs[0].command, b.first.file);
  assert.equal(defs[0].cwd.fsPath, b.first.root);
  assert.match(defs[0].label, /^other/);
  b.cleanup();
  const none = await boot({ docs: defaultDocs({ 'command list': { doc: { ...k.list, data: { ...k.list.data, commands: k.list.data.commands.filter((c: Loose) => c.id !== 'mcp serve') } } } }) });
  assert.deepEqual(await none.stub.calls.mcp.provider.provideMcpServerDefinitions(), []);
  none.cleanup();
});

test('FR-022, FR-030: where VS Code cannot register an MCP server, the output channel says so and nothing else changes', async () => {
  const b = await boot({ mcp: false });
  assert.equal(b.stub.calls.mcp, null);
  assert.match(b.stub.calls.output.join('\n'), /cannot register an MCP server/);
  const tree = b.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
  assert.equal((await tree.getChildren()).length, 1);
  b.cleanup();
});

test('FR-015: only what the views hand over runs from a tree command; a caller cannot invent a node', async () => {
  const b = await boot();
  for (const forged of ['widget approve', { kind: 'action', data: { action: { command: 'widget approve', enabled: true, fields: { widget: 'w1' } } } }, null, 42]) {
    await b.command('activateNode', forged);
  }
  assert.ok(!b.first.invocations().some((i) => i.argv[0] === 'widget'), 'nothing ran');
  b.cleanup();
});

test('FR-015: a decision from the tree runs only after the dry run, the diff and the modal; "cancel" leaves the clone as it was', async () => {
  const b = await boot();
  const tree = b.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
  const roots = await tree.getChildren();
  const noun = (await tree.getChildren(roots[0])).find((n: Loose) => n.kind === 'noun');
  const w1 = (await tree.getChildren(noun)).find((n: Loose) => n.kind === 'resource' && n.data.label === 'w1');
  const approve = (await tree.getChildren(w1)).find((n: Loose) => n.kind === 'action' && n.data.action.command === 'widget approve');
  // the diff review: choose "Apply these changes"; the modal: dismiss it (undefined), as closing the dialog does
  b.stub.script.quickPicks.push((items: Loose) => items[0].value);
  b.stub.script.warnings.push(undefined);
  await b.command('activateNode', approve);
  const ran = b.first.invocations().filter((i) => i.argv[0] === 'widget' && i.argv[1] === 'approve').map((i) => i.argv.join(' '));
  assert.deepEqual(ran, ['widget approve w1 --dry-run --json']);
  const modal = b.stub.calls.messages.find((m: Loose) => m.kind === 'warning');
  assert.match(modal.text, /decision only you can make/);
  assert.match(modal.rest[0].detail, /Command: \.\/other widget approve w1/);
  assert.match(modal.rest[0].detail, /Resource: w1/);
  assert.equal(modal.rest[0].modal, true);
  // now confirm
  b.stub.script.quickPicks.push((items: Loose) => items[0].value);
  b.stub.script.warnings.push('Make this decision');
  await b.command('activateNode', approve);
  const ran2 = b.first.invocations().filter((i) => i.argv[1] === 'approve').map((i) => i.argv.join(' '));
  assert.equal(ran2.at(-1), 'widget approve w1 --json');
  b.cleanup();
});

test('FR-014: the dry run\'s change opens in the diff editor, from a virtual document and never from a file the extension writes', async () => {
  const b = await boot();
  const tree = b.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
  const roots = await tree.getChildren();
  const noun = (await tree.getChildren(roots[0])).find((n: Loose) => n.kind === 'noun');
  const w1 = (await tree.getChildren(noun)).find((n: Loose) => n.kind === 'resource' && n.data.label === 'w1');
  const approve = (await tree.getChildren(w1)).find((n: Loose) => n.kind === 'action' && n.data.action.command === 'widget approve');
  fs.mkdirSync(path.join(b.first.root, 'widgets'));
  fs.writeFileSync(path.join(b.first.root, 'widgets', 'w1.txt'), 'old\n');
  b.stub.script.quickPicks.push((items: Loose) => items[1].value);           // open the file's diff
  b.stub.script.quickPicks.push(() => 'cancel');                  // then leave it
  await b.command('activateNode', approve);
  const [left, right, title] = b.stub.calls.diffs[0];
  assert.equal(left.scheme, 'if-console-diff');
  const provider = b.stub.calls.contentProvider;
  assert.equal(provider.scheme, 'if-console-diff');
  assert.equal(provider.p.provideTextDocumentContent(left), 'old\n');
  assert.equal(provider.p.provideTextDocumentContent(right), 'new\n');
  assert.match(title, /w1\.txt/);
  assert.deepEqual(b.first.invocations().filter((i) => i.argv[1] === 'approve').map((i) => i.dry), [true], 'nothing ran for real');
  assert.deepEqual(fs.readdirSync(b.first.root).filter((f) => !f.startsWith('.') && f !== 'other' && f !== 'widgets'), []);
  b.cleanup();
});

test('FR-010: the Checks view shows each section\'s last state and, for a failed one, its findings', async () => {
  const b = await boot();
  const view = b.context.subscriptions.find((s) => s.id === 'if-console.checks').o.treeDataProvider;
  let sections = await view.getChildren();     // one repository in the window: its sections, with no repository above them
  assert.deepEqual(sections.map((s: Loose) => view.getTreeItem(s).description), ['not run yet', 'not run yet', 'not run yet']);
  await b.command('runSection', sections[0]);
  sections = await view.getChildren();
  const first = view.getTreeItem(sections[0]);
  assert.equal(first.description, '2 findings');
  assert.equal(first.iconPath.id, 'error');
  assert.equal(first.iconPath.color.id, 'testing.iconFailed');
  const findings = await view.getChildren(sections[0]);
  assert.equal(findings.length, 2);
  assert.match(view.getTreeItem(findings[0]).description, /docs\/guide\.md:3/);
  b.cleanup();
});

test('FR-018: Copy Context removes secrets and sends nothing anywhere; the result goes where the person chooses', async () => {
  const secretDoc = k.doc('context', 'widget:w1', { note: 'token = ghp_abcdefghijklmnopqrstuvwxyz0123456789 end', password: 'hunter2' });
  const docs = defaultDocs({ 'command list': { doc: { ...k.list, data: { ...k.list.data, commands: [...k.list.data.commands, { id: 'context', category: 'read', group: 'g', surfaces: ['terminal', 'editor'], help: 'ctx' }] } } },
    'command show context': { doc: k.detail('context', 'read', [k.arg('resource', 'RESOURCE', { choices: ['widget:'] })]) }, 'context widget:w1': { doc: secretDoc } });
  const b = await boot({ docs });
  const tree = b.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
  const roots = await tree.getChildren();
  const noun = (await tree.getChildren(roots[0])).find((n: Loose) => n.kind === 'noun');
  const w1 = (await tree.getChildren(noun)).find((n: Loose) => n.kind === 'resource' && n.data.label === 'w1');
  b.stub.script.quickPicks.push((items: Loose) => items[0].value);   // clipboard
  await b.command('copyContext', w1);
  assert.equal(b.stub.calls.clipboard.length, 1);
  assert.ok(!/ghp_|hunter2/.test(b.stub.calls.clipboard[0]));
  assert.match(b.stub.calls.clipboard[0], /\[removed\]/);
  b.cleanup();
});
