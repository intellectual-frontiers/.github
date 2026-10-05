'use strict';
// The screenshots scenario (0043-if-console FR-045): open what the extension shows, in the theme the run chose, and capture each to a PNG.
// Every file is named <theme>-<what>.png. A scenario that fails to open a view fails, so a missing screenshot is never silent.
const assert = require('assert');
const path = require('path');
const vscode = require('vscode');
const { test } = require('./harness');
const { hook, sleep, waitFor, nextQuickPick, choose } = require('./support');
const { capture } = require('./screenshot');

const THEME = process.env.IF_CONSOLE_SHOT_THEME;
const shot = (what, settle) => capture(`${THEME}-${what}`, settle);
const exec = (id, ...args) => vscode.commands.executeCommand(id, ...args);

async function activate() {
  const ext = vscode.extensions.getExtension('intellectual-frontiers.if-console');
  await ext.activate();
  await waitFor(async () => (await hook().describe()).repositories.length === 2, 'both repositories');
  await waitFor(async () => { const s = await hook().describe(); return s.views.commands.length && s.views.checks.length; }, 'the views');
  await sleep(1500);
}

const IDS = ['if-console.home', ...Array.from({ length: 16 }, (_, i) => `if-console.view.${i}`), 'if-console.checks', 'if-console.commands'];

// Open one view and hide the others, so that the shot shows it alone; then open the groups at `expand` (their positions in the tree), by keyboard.
async function solo(id, expand = []) {
  await exec('workbench.view.extension.if-console');
  for (const other of IDS) if (other !== id) { try { await exec(`${other}.removeView`); } catch (e) { /* a slot nothing is planned into */ } }
  await exec(`${id}.focus`);
  await sleep(700);
  await exec('list.focusFirst');
  let at = 0;
  for (const to of expand) {
    for (; at < to; at += 1) await exec('list.focusDown');
    await exec('list.expand');
    await sleep(1500);
  }
  await sleep(600);
}

test('a check shows its findings in Problems', async () => {
  await activate();
  const file = vscode.Uri.file(path.join(process.env.IF_CONSOLE_FIXTURE_ROOT, 'docs', 'guide.md'));
  const doc = await vscode.workspace.openTextDocument(file);
  const editor = await vscode.window.showTextDocument(doc);
  await editor.edit((b) => b.insert(new vscode.Position(0, 0), ' '));
  await doc.save();
  await waitFor(() => vscode.languages.getDiagnostics(file).length, 'the diagnostics');
  await exec('workbench.actions.view.problems');
  await shot('problems', 2000);
  await exec('workbench.action.closePanel');
  await exec('workbench.action.closeAllEditors');
});

test('Home and the views', async () => {
  await activate();
  await exec('workbench.view.extension.if-console');
  await exec('if-console.home.focus');
  await sleep(1500);
  await shot('home');
  await exec('list.focusFirst');
  await exec('list.focusDown');
  await exec('list.focusDown');
  await exec('list.showHover');
  await sleep(1500);
  await shot('home-tooltip');
  const slots = (await hook().describe()).views.slots;
  const slot = (title) => { const s = slots.find((v) => v.title === title); if (!s) throw new Error(`the view ${title} is not planned: ${slots.map((v) => v.title)}`); return s.slot; };
  await solo(slot('Specs'), [1]);
  await shot('view-specs');
  await exec('list.focusDown');
  await exec('list.showHover');
  await sleep(1500);
  await shot('row-tooltip');
  await solo(slot('Widgets'), [0]);
  await shot('view-widgets');
  await solo(slot('Design systems'), [0]);
  await shot('view-design-systems');
  await solo(slot('Toolchain'), [1]);
  await shot('view-toolchain');
  await solo('if-console.checks', []);
  await shot('view-checks');
  await exec('if-console.toggleAllCommands');
  await sleep(500);
  await solo('if-console.commands', []);
  await shot('view-all-commands');
});

test('the Ontology view, a search in it, and a class page', async () => {
  await activate();
  const slots = (await hook().describe()).views.slots;
  const slot = slots.find((v) => v.title === 'Ontology');
  if (!slot) throw new Error(`the Ontology view is not planned: ${slots.map((v) => v.title)}`);
  await solo(slot.slot, [1]);
  await shot('view-ontology');
  await exec('list.focusDown');
  await exec('list.showHover');
  await sleep(1500);
  await shot('ontology-row-tooltip');
  await clear();
  const mark = hook().shown.length;
  exec('if-console.searchView', undefined, 'design system');
  const pick = await nextQuickPick(mark, (s) => s.title === 'Search Ontology: design system', 'the search results');
  await sleep(1000);
  await shot('ontology-search');
  await choose(pick, 'Design system');
  await drawn(mark, 'the class page', (m) => m.tables >= 2);
  await sleep(1800);
  await shot('resource-class');
  await hook().send({ type: 'scrollTo', section: 'statements' });
  await sleep(900);
  await shot('resource-class-statements');
});

test('the Test Explorer and the palette', async () => {
  await exec('workbench.view.testing.focus');
  await sleep(1500);
  await shot('testing');
  await exec('workbench.action.quickOpen', '>IF Console');
  await sleep(1200);
  await shot('palette');
  await exec('workbench.action.closeQuickOpen');
  await exec('workbench.action.quickOpen', '>Focus on');
  await sleep(1200);
  await shot('palette-focus');
  await exec('workbench.action.closeQuickOpen');
});

test('a hover, a CodeLens and a link in a spec', async () => {
  const realFile = vscode.Uri.file(path.join(process.env.IF_CONSOLE_REAL_ROOT, 'spec-kit', 'specs', '0043-if-console', 'spec.md'));
  const doc = await vscode.workspace.openTextDocument(realFile);
  const editor = await vscode.window.showTextDocument(doc);
  const text = doc.getText().split('\n');
  const line = text.findIndex((l) => /0041-command-line FR-064/.test(l));
  const col = text[line].indexOf('FR-064');
  editor.selection = new vscode.Selection(line, col, line, col);
  editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.InCenter);
  await exec('workbench.action.closeSidebar');
  await sleep(2500);
  await exec('editor.action.showHover');
  await waitFor(async () => (await vscode.commands.executeCommand('vscode.executeHoverProvider', realFile, new vscode.Position(line, col))).length > 0, 'the hover');
  await sleep(2500);
  await shot('spec-hover', 1500);
});

// A page the way a person opens it: Open Page… from the palette, the repository, the command, and each argument chosen in its quick pick.
async function openPage(folder, command, ...choices) {
  const mark = hook().shown.length;
  const name = folder === 'real' ? (await hook().describe()).repositories.find((r) => r.folder === 'real').name : 'other';
  const done = exec('if-console.openView');
  await choose(await nextQuickPick(mark, (s) => /repository/i.test(s.placeholder), 'the repository choice'), name);
  await choose(await nextQuickPick(mark, (s) => s.placeholder === 'Which command?', 'the command choice'), command);
  for (let i = 0; i < choices.length; i += 1) {
    const pick = await waitFor(() => hook().shown.slice(mark).filter((s) => s.kind === 'quickpick' && (s.title || '').startsWith(`${command}: `))[i], `the step ${i + 1} of ${command}`);
    await choose(pick, choices[i]);
  }
  await done;
  return mark;
}

// The page has drawn what the extension sent it: the page says so, through the extension, and a test waits for it.
const drawn = (mark, what, test) => waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'rendered' && s.summary && test(s.summary)), `the page drawing ${what}`);
const clear = async () => { await exec('workbench.action.closeAllEditors'); await sleep(400); };

test('a resource with a table', async () => {
  await clear();
  const mark = await openPage('fixture', 'widget list');
  await drawn(mark, 'the table', (m) => m.tables === 1);
  await sleep(1800);
  await shot('resource-table');
});

test('a resource of the real command line: a brand, with its palette and files', async () => {
  await clear();
  const mark = await openPage('real', 'brand show', 'frontiers-brand');
  await drawn(mark, 'the brand', (m) => m.kv > 3);
  await sleep(1800);
  await shot('resource-brand');
});

test('a resource with a stage ladder, a table, findings and a decision', async () => {
  await clear();
  const mark = await openPage('fixture', 'release show', 'r1');
  await drawn(mark, 'the stage ladder', (m) => m.stages === 4);
  await sleep(1800);
  await shot('resource-stages');
  await hook().send({ type: 'scrollTo', section: 'needs_a_person' });
  await sleep(900);
  await shot('resource-findings');
});

test('a check\'s result with its findings', async () => {
  await clear();
  const mark = await openPage('fixture', 'check', '(none)');
  await drawn(mark, 'the check result', (m) => m.findings >= 1);
  await sleep(1800);
  await shot('check-findings');
});

test('a decision: its dry run in the panel, before the modal', async () => {
  await clear();
  const mark = await openPage('fixture', 'widget show', 'w1');
  const page = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'webview'), 'the widget page');
  const decision = page.model.built.actions.find((a) => a.decision);
  assert.ok(decision, 'the page has a decision');
  await drawn(mark, 'the toolbar', (m) => m.decisions === 1);
  await sleep(1500);
  await shot('resource-decision');
  const before = hook().shown.length;
  const running = hook().send({ type: 'run', action: decision.id });
  await waitFor(() => hook().shown.slice(before).find((s) => s.kind === 'webview' && s.model.built.mode === 'preview'), 'the dry run in the panel');
  await drawn(before, 'the changes', (m) => m.mode === 'preview');
  await sleep(1800);
  await shot('dry-run-summary');
  await hook().send({ type: 'discard' });
  await running;
});

test('Learn', async () => {
  await clear();
  const mark = hook().shown.length;
  exec('if-console.learn');
  const pick = await nextQuickPick(mark, (s) => s.title === 'Learn', 'the Learn quick pick');
  await sleep(800);
  await shot('learn-topics');
  await choose(pick, 'start');
  await drawn(mark, 'the topic', (m) => m.mode === 'topic');
  await sleep(1800);
  await shot('learn-topic');
  await hook().send({ type: 'scrollTo', section: 'steps' });
  await sleep(1000);
  await shot('learn-steps');
});

test('a dry run opens the changes in the panel and the diff in the diff editor', async () => {
  await clear();
  const command = 'site generate';
  const mark = hook().shown.length;
  exec('if-console.runCommand');
  await choose(await nextQuickPick(mark, (s) => /repository/i.test(s.placeholder), 'the repository choice'), 'other');
  const pick = await nextQuickPick(mark, (s) => s.placeholder === 'Which command?', 'the command choice');
  await sleep(600);
  await shot('palette-commands');
  await choose(pick, command);
  const line = await nextQuickPick(mark, (s) => s.title === `${command}: ready`, 'the whole command line');
  await sleep(600);
  await shot('command-line');
  await choose(line, 'Show what it would change');
  await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'webview' && s.model.built.mode === 'preview'), 'the changes in the panel');
  await drawn(mark, 'the changes', (m) => m.mode === 'preview');
  await sleep(1800);
  await shot('dry-run-changes');
  await hook().send({ type: 'diff', index: 0 });
  await waitFor(() => vscode.window.tabGroups.all.flatMap((g) => g.tabs).some((t) => t.input instanceof vscode.TabInputTextDiff), 'the diff editor');
  await shot('dry-run-diff', 2000);
  await hook().send({ type: 'discard' });
});
