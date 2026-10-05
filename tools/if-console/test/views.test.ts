// The views (0043-if-console FR-036, FR-037, FR-038), each provider driven under the stand-in: Home, the views a command line declares, Checks and
// All commands.
import test from 'node:test';
import { readManifest } from './support/paths';
import assert from 'node:assert/strict';
import type { Loose } from './support/fake-launcher';
import { boot, defaultDocs, k } from './support/boot';

const provider = (b: Loose, id: string): Loose => b.stub.calls.treeViews.get(id).o.treeDataProvider;
const labelOf = (v: Loose, n: Loose): string => v.getTreeItem(n).label;
const text = (md: Loose): string => md.value.replace(/\\/g, '');

test('FR-036: Home is first, then a view for each view the command line declares (titled at run time), then Checks, then All commands, hidden', async () => {
  const b = await boot();
  const manifest = readManifest() as Loose;
  const ids = manifest.contributes.views['if-console'].map((v: Loose) => v.id);
  assert.equal(ids[0], 'if-console.home');
  assert.deepEqual(ids.slice(-2), ['if-console.checks', 'if-console.commands']);
  assert.equal(ids.length, 2 + 16 + 1);
  const entries = manifest.contributes.views['if-console'];
  assert.match(entries.at(-1).when, /allCommands/, 'All commands is hidden until the setting or the toggle shows it');
  const first = b.stub.calls.treeViews.get('if-console.view.0');
  assert.equal(first.title, 'Widgets', 'the slot takes the declared title');
  assert.equal(first.description, undefined, 'a view\'s header carries its title only');
  assert.equal(b.stub.calls.treeViews.get('if-console.view.1').title, '', 'a view that holds no noun with something to show is not planned: the second slot is empty');
  assert.equal(b.stub.calls.contexts.get('if-console.slot.0'), true);
  assert.equal(b.stub.calls.contexts.get('if-console.slot.1'), false, 'and its slot is hidden');
  assert.equal(b.stub.calls.contexts.get('if-console.allCommands'), false);
  await b.command('toggleAllCommands');
  assert.equal(b.stub.calls.contexts.get('if-console.allCommands'), true, 'the title action shows it for this session');
  assert.deepEqual(b.stub.calls.commands.filter((c: Loose) => c.id === 'if-console.commands.focus').length, 1);
  b.cleanup();
});

test('FR-037, FR-038: Home lists what needs a person as rows with a colored status icon, the plain words, the exact command line as the muted description and a Run', async () => {
  const b = await boot();
  const home = provider(b, 'if-console.home');
  const nodes = await home.getChildren();
  const rows = nodes.filter((n: Loose) => n.kind === 'suggestion');
  assert.deepEqual(rows.map((n: Loose) => labelOf(home, n)), ['big is not fetched yet', 'Nothing checked yet', 'Generated files not proved yet']);
  const fetch = home.getTreeItem(rows[0]);
  assert.equal(fetch.iconPath.id, 'warning');
  assert.equal(fetch.iconPath.color.id, 'list.warningForeground');
  assert.equal(fetch.description, 'other widget new');
  assert.match(fetch.contextValue, /suggestion runnable copyable/);
  assert.equal(fetch.command.command, 'if-console.runSuggestion');
  assert.match(text(fetch.tooltip), /The exact command line:/);
  assert.match(text(fetch.tooltip), /other widget new/);
  assert.match(fetch.tooltip.value, /\]\(command:if-console\.followLink\?/, 'its actions are links');
  assert.equal(fetch.tooltip.supportThemeIcons, true);
  assert.deepEqual(fetch.tooltip.isTrusted.enabledCommands.sort(), ['if-console.followLink', 'if-console.showHome'], 'a tooltip may run these two commands and no other');
  const group = nodes.find((n: Loose) => n.kind === 'group');
  assert.equal(labelOf(home, group), 'Get help');
  assert.deepEqual((await home.getChildren(group)).map((n: Loose) => labelOf(home, n)), ['Copy a report to ask for help'], 'Learn and Copy context are offered only where the command line has help and context');
  assert.equal(b.stub.calls.treeViews.get('if-console.home').badge.value, 1, 'the count of what needs a person is the view\'s badge');
  assert.match(b.stub.calls.treeViews.get('if-console.home').badge.tooltip, /1 thing needs you/);
  b.cleanup();
});

test('FR-037: after a check, Home shows the failed section with its findings under it, and the badges count them', async () => {
  const b = await boot();
  const home = provider(b, 'if-console.home');
  await b.command('runSection', (await provider(b, 'if-console.checks').getChildren())[0]);
  const rows = await home.getChildren();
  const failed = rows.find((n: Loose) => labelOf(home, n) === 'docs: 2 problems to fix');
  assert.ok(failed);
  assert.equal(home.getTreeItem(failed).description, './other check docs');
  assert.equal(home.getTreeItem(failed).collapsibleState, 1);
  const findings = await home.getChildren(failed);
  assert.equal(findings.length, 2);
  assert.match(home.getTreeItem(findings[0]).description, /docs\/guide\.md:3/);
  assert.equal(b.stub.calls.treeViews.get('if-console.home').badge.value, 2);
  assert.equal(b.stub.calls.treeViews.get('if-console.checks').badge.value, 1, 'Checks counts the sections that failed');
  b.cleanup();
});

test('FR-036, FR-038: a declared view lists its noun, whose rows are drawn as the list declares: status icon, muted description, badge, tooltip, inline actions', async () => {
  const b = await boot();
  const view = provider(b, 'if-console.view.0');
  const nouns = await view.getChildren();
  assert.deepEqual(nouns.map((n: Loose) => labelOf(view, n)), ['Widget']);
  assert.equal(view.getTreeItem(nouns[0]).iconPath.id, 'symbol-event');
  const rows = await view.getChildren(nouns[0]);
  assert.deepEqual(rows.map((n: Loose) => labelOf(view, n)), ['First widget', 'Second widget']);
  const [one, two] = rows.map((n: Loose) => view.getTreeItem(n));
  assert.equal(one.description, 'blue');
  assert.deepEqual([one.iconPath.id, one.iconPath.color.id], ['pass', 'testing.iconPassed']);
  assert.deepEqual([two.iconPath.id, two.iconPath.color.id], ['error', 'testing.iconFailed']);
  assert.equal(two.resourceUri.scheme, 'if-console-row');
  assert.equal(two.resourceUri.query, '120', 'the badge rides on the row\'s decoration');
  assert.equal(b.stub.calls.decorationProvider.provideFileDecoration(two.resourceUri).badge, '99');
  assert.equal(one.contextValue, 'row openable', 'it has no context command here, so no Copy Context');
  assert.equal(one.command.command, 'if-console.openRow');
  const tip = text(one.tooltip);
  assert.match(tip, /First widget/);
  assert.match(tip, /kind:\*\* blue/);
  assert.match(tip, /note:\*\* The first one\./);
  assert.match(tip, /Open/);
  assert.equal((await view.getChildren(rows[0])).length, 0);
  assert.equal(view.getTreeItem(nouns[0]).description, '2', 'the group says how many it holds once they are loaded');
  b.cleanup();
});

test('a click on a row opens its resource through the one service; a forged node opens nothing', async () => {
  const b = await boot();
  const view = provider(b, 'if-console.view.0');
  const rows = await view.getChildren((await view.getChildren())[0]);
  const before = b.first.invocations().length;
  await b.command('openRow', { kind: 'row', data: { row: { noun: 'widget', id: 'w1' } }, repo: {} });
  assert.equal(b.first.invocations().length, before, 'a node the views did not make does nothing');
  await b.command('openRow', rows[0]);
  const calls = b.first.invocations().slice(before).map((i: Loose) => i.argv.join(' '));
  assert.ok(calls.includes('command show widget show --json'));
  assert.ok(calls.includes('widget show w1 --json'), 'the resource, as JSON, in one place');
  assert.equal(b.stub.calls.webviews.length, 1);
  b.cleanup();
});

test('a noun\'s rows are capped at the row limit with the count of the rest, and Find Resource offers every one', async () => {
  const many = Array.from({ length: 14 }, (_, i) => ({ id: `w${i + 10}`, name: `Widget ${i + 10}`, kind: 'k', state: 'ready', parts: 1, note: '' }));
  const docs = defaultDocs({ 'widget list': { doc: k.doc('widget-list', 'all', { count: 14, widgets: many }, { links: [] }) } });
  const b = await boot({ docs, config: { rowLimit: 10 } });
  const view = provider(b, 'if-console.view.0');
  const rows = await view.getChildren((await view.getChildren())[0]);
  assert.equal(rows.length, 11);
  assert.equal(rows[10].kind, 'more');
  assert.equal(view.getTreeItem(rows[10]).label, '4 more…');
  assert.equal(view.getTreeItem(rows[10]).command.command, 'if-console.findResource');
  let listed: Loose;
  b.stub.script.quickPicks.push((items: Loose) => { listed = items; return undefined; });
  await b.command('findResource', rows[10]);
  assert.equal(listed.length, 14, 'all of them, not the first ten');
  assert.match(listed[0].label, /Widget 10/);
  b.cleanup();
});

test('a noun with no list shows the commands the editor offers for it, titled and iconed as the command line gives', async () => {
  const list = k.list;
  list.data.presentation.nouns.push({ noun: 'site', title: 'Site', icon: 'globe', view: 'widgets' });
  list.data.commands.push({ id: 'site generate', category: 'generate', group: 'g', surfaces: ['terminal', 'editor'], help: 'Write the site', title: 'Generate Site…', icon: 'sync' });
  const b = await boot({ docs: defaultDocs({ 'command list': { doc: list } }) });
  const view = provider(b, 'if-console.view.0');
  const nouns = await view.getChildren();
  assert.deepEqual(nouns.map((n: Loose) => labelOf(view, n)), ['Widget', 'Site']);
  const cmds = await view.getChildren(nouns[1]);
  assert.equal(labelOf(view, cmds[0]), 'Generate Site…');
  assert.equal(view.getTreeItem(cmds[0]).iconPath.id, 'sync');
  assert.equal(view.getTreeItem(cmds[0]).description, 'generate');
  b.cleanup();
  list.data.presentation.nouns.pop();
  list.data.commands.pop();
});

test('a view two command lines declare is one view with a node for each repository; one that only one declares has none', async () => {
  const b = await boot({ second: defaultDocs() });
  const view = provider(b, 'if-console.view.0');
  const top = await view.getChildren();
  assert.deepEqual(top.map((n: Loose) => n.kind), ['repo', 'repo']);
  const nouns = await view.getChildren(top[1]);
  assert.deepEqual(nouns.map((n: Loose) => labelOf(view, n)), ['Widget']);
  const home = provider(b, 'if-console.home');
  assert.deepEqual((await home.getChildren()).map((n: Loose) => n.kind), ['repo', 'repo'], 'Home groups by repository too');
  const checks = provider(b, 'if-console.checks');
  assert.deepEqual((await checks.getChildren()).map((n: Loose) => n.kind), ['repo', 'repo']);
  b.cleanup();
});

test('FR-008: the tree of every command keeps its nouns, icons and the command line\'s titles, and its commands run on a click', async () => {
  const b = await boot();
  const tree = provider(b, 'if-console.commands');
  const top = await tree.getChildren(await tree.getChildren().then((r: Loose) => r[0]));
  const widget = top.find((n: Loose) => n.kind === 'noun');
  assert.equal(tree.getTreeItem(widget).iconPath.id, 'symbol-event');
  assert.equal(tree.getTreeItem(widget).description, 'Widget');
  const cmds = await tree.getChildren(widget);
  const show = cmds.find((n: Loose) => labelOf(tree, n) === 'widget show');
  assert.equal(tree.getTreeItem(show).iconPath.id, 'eye');
  assert.match(tree.getTreeItem(show).tooltip, /Show Widget/);
  b.cleanup();
});

test('an untrusted workspace has no rows: Home says why, with the action that trusts it, and no view lists anything', async () => {
  const b = await boot({ trusted: false });
  const home = provider(b, 'if-console.home');
  const rows = await home.getChildren();
  assert.equal(labelOf(home, rows[0]), 'Trust this workspace to use ./other');
  assert.equal(home.getTreeItem(rows[0]).tooltip.value.includes('followLink'), true);
  assert.equal(b.stub.calls.treeViews.get('if-console.home').badge.value, 1);
  assert.equal(b.stub.calls.treeViews.get('if-console.view.0').title, '');
  assert.deepEqual(b.first.invocations(), []);
  b.cleanup();
});

test('a launcher\'s own text never becomes a link: a tooltip escapes it, and its only links are the extension\'s', async () => {
  const evil = '](command:workbench.action.reloadWindow) [x](command:evil) `` ``` <b>';
  const docs = defaultDocs({ doctor: { doc: k.doc('doctor', 'other', { status: 'failed', toolchain: [], conflicts: [`bad ${evil}`] }) } });
  const b = await boot({ docs });
  const home = provider(b, 'if-console.home');
  const row = (await home.getChildren()).find((n: Loose) => n.data.suggestion?.group === 'health');
  const md = home.getTreeItem(row).tooltip.value as string;
  const targets = [...md.matchAll(/\]\(command:([^?)\s]+)/g)].map((m) => m[1]);
  assert.ok(targets.length >= 1 && targets.every((t) => t === 'if-console.followLink' || t === 'if-console.showHome'), targets.join(','));
  assert.ok(!md.includes('](command:evil') && !md.includes('](command:workbench'));
  b.cleanup();
});

test('FR-036: a handle is the only thing a link follows: one the extension did not issue runs nothing', async () => {
  const b = await boot();
  const home = provider(b, 'if-console.home');
  const row = (await home.getChildren())[0];
  const handle = /followLink\?%5B%22(h\d+)%22%5D/.exec(home.getTreeItem(row).tooltip.value)?.[1];
  assert.ok(handle);
  const before = b.first.invocations().length;
  await b.command('followLink', 'h99999');
  await b.command('followLink', { kind: 'run' });
  await b.command('followLink', ['h1']);
  assert.equal(b.first.invocations().length, before, 'nothing ran');
  b.stub.script.quickPicks.push(() => undefined);
  await b.command('followLink', handle);
  assert.ok(b.stub.calls.messages.length > 0 || b.first.invocations().length > before, 'a handle the extension issued does what it says');
  b.cleanup();
});

test('after a command has written, the rows and resources the views hold are asked for again', async () => {
  const b = await boot();
  const view = provider(b, 'if-console.view.0');
  await view.getChildren((await view.getChildren())[0]);
  const repo = view.host.repos[0];
  assert.equal(repo.registry.rows.size, 1, 'the rows were read');
  const lists = () => b.first.invocations().filter((i: Loose) => i.argv.join(' ') === 'widget list --json').length;
  assert.equal(lists(), 1);
  b.stub.script.reviews.push('apply');   // apply the changes
  b.stub.script.warnings.push('Make this decision');
  const detail = await repo.detail('widget approve');
  const executor = require('../src/services/executor') as Loose;
  await executor.runArgv(view.host.ui, repo, detail, ['widget', 'approve', 'w1']);
  assert.equal(repo.registry.rows.size, 0, 'a write forgets what the views read');
  await view.getChildren((await view.getChildren())[0]);
  assert.equal(lists(), 2);
  b.cleanup();
});

test('Show View lists Home, the views the command lines declared by their own titles, and Checks, and focuses the one chosen', async () => {
  const b = await boot();
  b.stub.script.quickPicks.push('if-console.view.0');
  await b.command('showView');
  const pick = b.stub.calls.messages.find((m: Loose) => m.kind === 'quickpick');
  assert.deepEqual(pick.items.map((i: Loose) => i.label), ['$(home) Home', '$(package) Widgets', '$(checklist) Checks'], 'the real titles, not the pool\'s numbers');
  assert.ok(b.stub.calls.commands.some((c: Loose) => c.id === 'if-console.view.0.focus'), 'the view was focused');
  const manifest = readManifest() as Loose;
  assert.ok(manifest.contributes.commands.some((c: Loose) => c.command === 'if-console.showView' && c.title === 'Show View…'));
  b.cleanup();
});
