'use strict';
// The extension in a real VS Code, in a trusted workspace that holds this clone and a fixture second command line (0043-if-console FR-032).
const assert = require('assert');
const path = require('path');
const vscode = require('vscode');
const { test } = require('./harness');
const { hook, sleep, waitFor, nextQuickPick, choose, reference, fixtureLog, manifest } = require('./support');

const ID = 'intellectual-frontiers.if-console';
const FIXTURE = 'other';   // the fixture command line's own name, as its documents state it
const realList = () => reference('command', 'list').data;
const editorNouns = () => [...new Set(realList().commands.filter((c) => c.surfaces.includes('editor') && c.noun).map((c) => c.noun))];
const entry = (view, folder) => view.find((e) => e.description.startsWith(folder));
const labels = (e) => e.children.map((c) => c.label);

test('activates in a trusted workspace holding this clone and a fixture command line', async () => {
  assert.strictEqual(vscode.workspace.isTrusted, true, 'the workspace is trusted');
  const ext = vscode.extensions.getExtension(ID);
  assert.ok(ext, 'VS Code loaded the extension');
  await ext.activate();
  assert.strictEqual(ext.isActive, true);
  assert.strictEqual(ext.exports, undefined, 'the extension exports no API (0043 FR-015)');
  assert.ok(hook(), 'the test hook exists in the extension host\'s test mode');
  const snap = await hook().describe();
  const real = snap.repositories.find((r) => r.folder === 'real');
  const fixture = snap.repositories.find((r) => r.folder === 'fixture');
  assert.ok(real && fixture, `two repositories: ${JSON.stringify(snap.repositories)}`);
  assert.strictEqual(real.state, 'ready');
  assert.strictEqual(real.audience, 'public');
  assert.strictEqual(real.name, reference('command', 'list').schema.split('/')[0], 'its name is the one its documents state');
  assert.strictEqual(fixture.state, 'ready');
  assert.strictEqual(fixture.name, FIXTURE);
  assert.ok(fixtureLog().length > 0 && fixtureLog().every((l) => l.IF_CONSOLE === '1'), 'every invocation said it came from the editor');
});

test('Home, the views each command line declares, Checks and All commands are populated from the command lines', async () => {
  const snap = await hook().describe({ rows: true });
  const home = entry(snap.views.home, 'real');
  assert.ok(home, 'Home has one group for each command line');
  assert.ok(labels(home).includes('Get help'));
  assert.ok(home.children.find((g) => g.label === 'Get help').children.some((c) => c.label === 'Learn how this works'), 'Learn is in Get help');
  const fixtureHome = labels(entry(snap.views.home, 'fixture'));
  for (const want of ['Nothing checked yet', 'Generated files not proved yet', 'Get help']) assert.ok(fixtureHome.includes(want), want);
  const row = entry(snap.views.home, 'fixture').children.find((c) => c.label === 'Nothing checked yet');
  assert.strictEqual(row.description, './other check --changed', 'the exact command line is the muted description');

  const declared = realList().presentation.views.map((v) => v.title);
  const slots = snap.views.slots.map((v) => v.title);
  for (const t of declared) assert.ok(slots.includes(t), `the view ${t} is planned`);
  assert.ok(slots.includes('Widgets'), 'and the fixture\'s');
  assert.strictEqual(slots.length, new Set([...declared, 'Widgets']).size, 'a slot is planned only for a view some command line declares: no unused slot is shown');
  assert.ok(!slots.some((t) => /^Section \d+$/.test(t) || t === 'Things'), 'and none is titled by its number');
  assert.deepStrictEqual(slots, [...slots].sort((a, b) => snap.views.slots.find((v) => v.title === a).order - snap.views.slots.find((v) => v.title === b).order), 'in the order they ask for');
  const specs = snap.views.slots.find((v) => v.title === 'Specs');
  assert.deepStrictEqual(specs.entries.map((n) => n.label), ['Requirement', 'Spec', 'Term'], 'the nouns whose view it is');
  const spec = specs.entries.find((n) => n.label === 'Spec');
  const all = reference('spec', 'list').data.specs;
  assert.strictEqual(spec.children.length, Math.min(all.length, 200) + (all.length > 200 ? 1 : 0));
  assert.strictEqual(spec.children[0].label, all[0].name);
  assert.strictEqual(spec.children[0].description, all[0].title, 'the muted description is the declared field');
  const draft = spec.children.find((r, i) => all[i] && all[i].status === 'Draft');
  assert.strictEqual(draft.status, 'testing.iconQueued', 'a Draft is waiting');
  const things = snap.views.slots.find((v) => v.title === 'Widgets');
  assert.deepStrictEqual(things.entries.map((n) => n.label), ['Widget', 'Release', 'Site']);
  assert.deepStrictEqual(things.entries[0].children.map((r) => [r.label, r.description, r.status]), [['First widget', 'blue', 'testing.iconPassed'], ['Second widget', 'red', 'testing.iconFailed'],
    ['Third widget', 'green', 'testing.iconQueued']]);
  assert.deepStrictEqual(things.entries[2].children.map((r) => r.label), ['Generate Site\u2026'], 'a noun with no list shows its commands, titled by the command line');

  const commands = entry(snap.views.commands, 'real');
  assert.ok(commands, 'the first command line is in All commands');
  assert.ok(labels(commands).includes('Repository-wide'));
  for (const noun of editorNouns()) assert.ok(labels(commands).includes(noun), `the noun ${noun} is listed`);
  const wide = commands.children.find((c) => c.label === 'Repository-wide').children.map((c) => c.label);
  for (const want of ['check', 'doctor', 'fresh', 'test']) assert.ok(wide.includes(want), `${want} is a repository-wide command`);
  assert.deepStrictEqual(labels(entry(snap.views.commands, 'fixture')), ['Repository-wide', 'site', 'period', 'widget', 'release']);

  const sections = reference('command', 'show', 'check').data.arguments.find((a) => a.name === 'sections').choices;
  assert.deepStrictEqual(labels(entry(snap.views.checks, 'real')), sections, 'the Checks view lists the check sections');
  assert.deepStrictEqual(labels(entry(snap.views.checks, 'fixture')), ['docs', 'links']);
  assert.strictEqual(typeof snap.badges.home, 'number');
  const real = snap.repositories.find((r) => r.folder === 'real');
  assert.ok(snap.status.text.includes(real.name), 'the status bar has the orchestrator');
  assert.match(snap.status.tooltip, /audience public/);
  assert.deepStrictEqual(snap.tests.profiles, ['Run', 'Run with --changed']);
  const roots = snap.tests.items.map((t) => t.label);
  assert.ok(roots.some((l) => l.startsWith(real.name)) && roots.some((l) => l.startsWith('other')), `a test for each repository: ${roots}`);
});

test('every command of the manifest is registered', async () => {
  const want = manifest().contributes.commands.map((c) => c.command).sort();
  const have = (await vscode.commands.getCommands(true)).filter((c) => c.startsWith('if-console.'));
  const forViews = /^if-console\.(home|view\.\d+|checks|commands)\.(focus|open|removeView|resetViewLocation|toggleVisibility)$/;   // VS Code's own, for each view
  assert.deepStrictEqual(have.filter((c) => !forViews.test(c)).sort(), want, 'the commands VS Code has are exactly the manifest\'s');
  const palette = manifest().contributes.menus.commandPalette.filter((m) => m.when !== 'false').map((m) => m.command);
  for (const id of ['if-console.showHome', 'if-console.runCommand', 'if-console.check', 'if-console.fresh', 'if-console.test', 'if-console.doctor', 'if-console.showCommandLine',
    'if-console.getHelp', 'if-console.learn', 'if-console.copyContext', 'if-console.openView', 'if-console.findResource']) assert.ok(palette.includes(id), `${id} is in the palette`);
  const titles = Object.fromEntries(manifest().contributes.commands.map((c) => [c.command, `${c.category}: ${c.title}`]));
  assert.strictEqual(titles['if-console.showHome'], 'IF Console: Show Home');
  assert.ok((await vscode.commands.getCommands(true)).includes('workbench.view.extension.if-console'), 'the activity-bar container is VS Code\'s');
});

test('a check produces Problems diagnostics at the finding\'s file and line', async () => {
  const file = vscode.Uri.file(path.join(process.env.IF_CONSOLE_FIXTURE_ROOT, 'docs', 'guide.md'));
  const doc = await vscode.workspace.openTextDocument(file);
  const editor = await vscode.window.showTextDocument(doc);
  await editor.edit((b) => b.insert(new vscode.Position(0, 0), ' '));
  assert.strictEqual(await doc.save(), true);
  const found = await waitFor(() => { const d = vscode.languages.getDiagnostics(file); return d.length ? d : null; }, 'the diagnostics of the saved file\'s check');
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].range.start.line, 2, 'the finding says docs/guide.md:3');
  assert.strictEqual(found[0].severity, vscode.DiagnosticSeverity.Error);
  assert.ok(found[0].message.includes('broken link'));
  assert.strictEqual(found[0].source, `${FIXTURE} check docs`);
  assert.ok(fixtureLog().some((l) => l.argv.join(' ') === 'check --changed --json'), 'it ran `check --changed`');
});

async function throughForm(command) {
  const mark = hook().shown.length;
  const done = vscode.commands.executeCommand('if-console.runCommand');
  await choose(await nextQuickPick(mark, (s) => /repository/i.test(s.placeholder), 'the repository choice'), FIXTURE);
  await choose(await nextQuickPick(mark, (s) => s.placeholder === 'Which command?', 'the command choice'), command);
  await choose(await nextQuickPick(mark, (s) => s.title === `${command}: ready`, 'the whole command line'), 'Show what it would change');
  return { mark, done };
}

// The change summary is in the resource panel: the page draws it (the page itself says what it drew), a file opens as a diff, and Apply is the
// person's choice, which a test makes through the hook as the click it cannot make inside a webview.
async function reviewThenApply(command, mark) {
  const previews = () => hook().shown.slice(mark).filter((s) => s.kind === 'webview' && s.model.built.mode === 'preview');
  const first = await waitFor(() => previews()[0], 'the changes in the panel');
  assert.ok(first.model.built.sections[0].changes.some((c) => c.path === 'site/index.txt'), 'the change names its file');
  assert.ok(first.model.built.header.title.length > 0 && first.model.built.preview.apply);
  const drawn = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'rendered' && s.summary && s.summary.mode === 'preview'), 'the page drawing the summary');
  assert.ok(drawn.summary.changes >= 1 && drawn.summary.icons > 0, 'the real page drew a row for the changed file, with its icons');
  await hook().send({ type: 'diff', index: 0 });
  await waitFor(() => vscode.window.tabGroups.all.flatMap((g) => g.tabs).some((t) => t.input instanceof vscode.TabInputTextDiff
    && t.input.original.scheme === 'if-console-diff' && t.input.modified.scheme === 'if-console-diff'), 'the diff editor');
  await hook().send({ type: 'apply' });
}

const calls = (command) => fixtureLog().filter((l) => l.argv.slice(0, command.split(' ').length).join(' ') === command);

test('a dry-run write opens a diff, then applies', async () => {
  const before = calls('site generate').length;
  const { mark } = await throughForm('site generate');
  await reviewThenApply('site generate', mark);
  const made = await waitFor(() => { const c = calls('site generate').slice(before); return c.some((l) => !l.dry) ? c : null; }, 'the real run');
  assert.deepStrictEqual(made.map((l) => l.dry), [true, false], 'the dry run came first and the real run after it was accepted');
  assert.ok(made.every((l) => l.IF_CONSOLE === '1'));
});

test('a decision shows a modal, and runs only when it is given', async () => {
  const before = calls('period advance').length;
  hook().answers.push(true);
  const { mark } = await throughForm('period advance');
  await reviewThenApply('period advance', mark);
  const modal = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'modal'), 'the modal');
  assert.strictEqual(modal.modal, true, 'the dialog is modal');
  assert.ok(modal.message.includes('period advance') && modal.message.includes('only you can make'));
  assert.ok(modal.detail.includes('Command:') && modal.detail.includes('period advance'));
  assert.deepStrictEqual(modal.buttons, ['Make this decision']);
  const made = await waitFor(() => { const c = calls('period advance').slice(before); return c.some((l) => !l.dry) ? c : null; }, 'the real run after the answer');
  assert.deepStrictEqual(made.map((l) => l.dry), [true, false]);
});

test('a decision whose modal is not given does not run', async () => {
  const before = calls('period advance').length;
  const { mark } = await throughForm('period advance');
  await reviewThenApply('period advance', mark);
  await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'modal'), 'the modal');
  await sleep(2500);
  const made = calls('period advance').slice(before);
  assert.deepStrictEqual(made.map((l) => l.dry), [true], 'only the dry run happened');
});

test('Learn lists the repository\'s help topics and shows one in the panel with its steps, each with its command line and a Run', async () => {
  const mark = hook().shown.length;
  vscode.commands.executeCommand('if-console.learn');
  const pick = await nextQuickPick(mark, (s) => s.title === 'Learn', 'the Learn quick pick');
  const topics = reference('help').data.topics.map((t) => t.topic);
  assert.deepStrictEqual(pick.items, topics.map((t) => `$(book) ${t}`), 'the quick pick is the topics `help` lists, each with a codicon');
  assert.ok(['start', 'check', 'specs', 'design-systems', 'brands', 'toolchain', 'editor', 'ai', 'extend', 'recover'].every((t) => topics.includes(t)));
  await choose(pick, 'start');
  const page = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'webview' && s.model.built.mode === 'topic'), 'the topic page');
  const steps = reference('help', 'start').data.steps;
  const lesson = page.model.built.sections.find((x) => x.type === 'lesson');
  assert.strictEqual(lesson.steps.length, steps.length, 'a numbered step for each step the topic has');
  assert.ok(lesson.steps.some((x) => x.run !== undefined) && lesson.steps.some((x) => x.run === undefined && x.reason), 'a step the editor runs has a Run, one that runs in a terminal says so');
  assert.ok(lesson.steps.every((x) => /^\S+ \S+/.test(x.line)), 'each step\'s command line is shown to copy');
  assert.strictEqual(page.model.built.next.topic, topics[topics.indexOf('start') + 1], 'it leads on to the next topic');
  const drawn = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'rendered' && s.summary && s.summary.mode === 'topic'), 'the page drawing the topic');
  assert.strictEqual(drawn.summary.steps, steps.length, 'the real page drew each step');
  assert.ok(drawn.summary.runs >= 1 && drawn.summary.codeLines >= steps.length, 'with its command lines and Run buttons');
});

test('a resource opens in the one panel: a table whose rows open, a stage ladder, findings, and a decision apart from the other actions', async () => {
  const open = async (command, argvWords) => {
    const mark = hook().shown.length;
    const done = vscode.commands.executeCommand('if-console.openView');
    await choose(await nextQuickPick(mark, (s) => /repository/i.test(s.placeholder), 'the repository choice'), FIXTURE);
    await choose(await nextQuickPick(mark, (s) => s.placeholder === 'Which command?', 'the command choice'), command);
    for (const word of argvWords) await choose(await nextQuickPick(mark, (s) => (s.title || '').startsWith(`${command}: `), `the ${word[0]} step`), word[1]);
    await done;
    return mark;
  };
  let mark = await open('widget list', []);
  let page = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'webview'), 'the table page');
  const table = page.model.built.sections.find((x) => x.type === 'table');
  assert.strictEqual(table.rows.length, 3);
  assert.ok(table.rows.every((r) => r.open !== undefined), 'each row opens its widget');
  let drawn = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'rendered' && s.summary.tables === 1), 'the page drawing the table');
  assert.strictEqual(drawn.summary.rows, 3, 'the three rows, drawn by VS Code Elements');
  const tabs = () => vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.input instanceof vscode.TabInputWebview);
  assert.strictEqual(tabs().length, 1, 'one webview tab');
  // the person chooses a row: it opens in the same panel
  mark = hook().shown.length;
  await hook().send({ type: 'open', ref: table.rows[0].open });
  page = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'webview' && s.model.built.header.title === 'w1'), 'the row\'s page');
  assert.strictEqual(tabs().length, 1, 'still one webview tab: the panel was revealed, not duplicated');
  assert.deepStrictEqual(page.model.nav.crumbs.map((c) => c.label), ['Widget list', 'w1']);
  assert.ok(page.model.built.actions.some((a) => a.decision) && page.model.built.actions.some((a) => a.primary), 'a primary action and a decision');
  drawn = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'rendered' && s.summary.title === 'w1'), 'the page drawing the resource');
  assert.strictEqual(drawn.summary.decisions, 1, 'the decision is drawn apart');
  await hook().send({ type: 'back' });
  assert.strictEqual((await waitFor(() => hook().shown.slice(mark).filter((s) => s.kind === 'webview').pop(), 'back')).model.built.header.title, 'Widget list');
  // a stage ladder, and findings
  mark = await open('release show', [['release', 'r1']]);
  page = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'webview'), 'the release page');
  assert.ok(page.model.built.sections.some((x) => x.type === 'stages' && x.stages.length === 4), 'the ladder is a stepper');
  assert.ok(page.model.built.sections.some((x) => x.type === 'findings'), 'what needs a person is findings');
  drawn = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'rendered' && s.summary.stages === 4), 'the page drawing the stages');
  assert.ok(drawn.summary.findings >= 2 && drawn.summary.kv > 3 && drawn.summary.tables >= 1);
  // hidden behind another editor and shown again: VS Code keeps nothing of the page alive (retainContextWhenHidden is off), and the page comes back
  // from the state it saved, then from the model the extension sends it
  const hidden = hook().shown.length;
  await vscode.window.showTextDocument(vscode.Uri.file(path.join(process.env.IF_CONSOLE_FIXTURE_ROOT, 'docs', 'guide.md')), { viewColumn: vscode.ViewColumn.Active, preview: false });
  await sleep(1200);
  await vscode.commands.executeCommand('workbench.action.previousEditor');
  await waitFor(() => hook().shown.slice(hidden).find((s) => s.kind === 'rendered' && s.summary.stages === 4 && s.summary.title === 'Spring guide'), 'the page drawn again after it was hidden');
  assert.strictEqual(tabs().length, 1, 'still the one panel');
});

test('the files a reference names have a hover, a definition, a CodeLens and links, from the command line\'s own `show`', async () => {
  const file = vscode.Uri.file(path.join(process.env.IF_CONSOLE_FIXTURE_ROOT, 'docs', 'guide.md'));
  const doc = await vscode.workspace.openTextDocument(file);
  await vscode.window.showTextDocument(doc);
  const at = new vscode.Position(4, 10);   // "The widget w1 is blue, and widget/w2 is red."
  const hovers = await waitFor(async () => { const h = await vscode.commands.executeCommand('vscode.executeHoverProvider', file, at); return h.length ? h : null; }, 'the hover');
  const md = hovers.flatMap((h) => h.contents).map((c) => c.value).join('\n').replace(/\\/g, '');
  assert.match(md, /The first one\./, 'the resource\'s words');
  assert.match(md, /kind:\*\* blue/);
  assert.match(md, /command:if-console\.followLink/, 'its actions are links');
  const defs = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', file, at);
  assert.strictEqual(defs.length, 1);
  assert.strictEqual(defs[0].range.start.line, 4, 'the line the resource says, 5');
  const lenses = await vscode.commands.executeCommand('vscode.executeCodeLensProvider', file, 10);
  assert.strictEqual(lenses.length, 2, 'one for each reference');
  assert.ok(lenses.some((l) => l.command && /blue \u00b7 ready \u00b7 \$\(play\) Run/.test(l.command.title)), JSON.stringify(lenses.map((l) => l.command && l.command.title)));
  const links = await vscode.commands.executeCommand('vscode.executeLinkProvider', file, 10);
  assert.ok(links.filter((l) => String(l.target).startsWith('command:if-console.followLink')).length === 2);
  const snap = await hook().describe();
  const guide = snap.tests.items.find((t) => t.label === 'guide.md' || t.id.startsWith('file:'));
  assert.ok(guide && guide.children.length === 2 && guide.children[0].line === 4, 'each reference whose resource has a check is a test at its line');
  // a real spec: the requirement a row of the register names
  const realFile = vscode.Uri.file(path.join(process.env.IF_CONSOLE_REAL_ROOT, 'spec-kit', 'enforcement.tsv'));
  const text = (await vscode.workspace.openTextDocument(realFile)).getText().split('\n');
  const line = text.findIndex((l) => l.startsWith('0043-if-console FR-001\t'));
  assert.ok(line > 0);
  const realHover = await waitFor(async () => { const h = await vscode.commands.executeCommand('vscode.executeHoverProvider', realFile, new vscode.Position(line, 5)); return h.length ? h : null; }, 'the requirement\'s hover', 90000);
  const realMd = realHover.flatMap((h) => h.contents).map((c) => c.value).join('\n').replace(/\\/g, '');
  assert.match(realMd, /The extension MUST be one extension named/, 'the requirement\'s own text');
  const realDefs = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', realFile, new vscode.Position(line, 5));
  assert.ok(realDefs[0].uri.fsPath.endsWith(path.join('0043-if-console', 'spec.md')), 'its definition is the spec');
});

test('Find Resource lists every row of every view, the command line\'s own labels and descriptions', async () => {
  const mark = hook().shown.length;
  vscode.commands.executeCommand('if-console.findResource');
  const pick = await nextQuickPick(mark, (s) => s.title === 'Find a resource', 'the Find Resource quick pick');
  assert.ok(pick.items.some((l) => l.includes('First widget')), 'a row of the fixture\'s view');
  assert.ok(pick.items.some((l) => l.includes('0043-if-console')), 'a spec of this repository\'s own');
  assert.ok(pick.items.length > 1000, `all the rows, not the first few: ${pick.items.length}`);
  await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
});

test('the status bar says what needs a person and a click on it opens Home with that in view', async () => {
  const snap = await hook().describe();
  assert.match(snap.status.tooltip, /Show all/);
  await vscode.commands.executeCommand('if-console.showHome', 'suggestions');
  const after = await waitFor(async () => (await hook().describe()).revealed, 'the suggestion Home revealed');
  const labels = (await hook().describe()).needs.flatMap((n) => n.items.map((i) => i.label));
  assert.ok(labels.includes(after), `Home revealed ${after}, one of ${labels}`);
});

test('the MCP server is registered for the repository whose command list has it', async () => {
  const snap = await hook().describe();
  assert.strictEqual(snap.mcp.supported, true, 'this VS Code can register an MCP server from an extension');
  assert.strictEqual(snap.mcp.registered, true);
  const real = snap.repositories.find((r) => r.folder === 'real');
  assert.deepStrictEqual(snap.mcp.servers.map((s) => s.label), [`${real.name} (real)`], 'one server, for the command line that offers `mcp serve`');
  assert.deepStrictEqual(snap.mcp.servers[0].args, ['mcp', 'serve']);
  assert.ok(snap.mcp.servers[0].command.startsWith(real.root), 'its command is the clone\'s own launcher');
});
