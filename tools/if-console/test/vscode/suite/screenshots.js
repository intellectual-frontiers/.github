'use strict';
// The screenshots scenario (0043-if-console FR-045): open what the extension shows, in the theme the run chose, and capture each to a PNG.
// Every file is named <theme>-<what>.png. A scenario that fails to open a view fails, so a missing screenshot is never silent.
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
  await solo(slot('Things'), [0]);
  await shot('view-things');
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

test('the Test Explorer and the palette', async () => {
  await exec('workbench.view.testing.focus');
  await sleep(1500);
  await shot('testing');
  await exec('workbench.action.quickOpen', '>IF Console');
  await sleep(1200);
  await shot('palette');
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

test('a resource page', async () => {
  const mark = hook().shown.length;
  const done = exec('if-console.openView');
  await choose(await nextQuickPick(mark, (s) => /repository/i.test(s.placeholder), 'the repository choice'), (await hook().describe()).repositories.find((r) => r.folder === 'real').name);
  await choose(await nextQuickPick(mark, (s) => s.placeholder === 'Which command?', 'the command choice'), 'brand list');
  for (let i = 0; i < 4 && !hook().shown.slice(mark).some((s) => s.kind === 'webview'); i += 1) {
    const last = await waitFor(() => hook().shown.slice(mark).filter((s) => s.kind === 'quickpick').pop(), 'a step');
    if (hook().shown.slice(mark).some((s) => s.kind === 'webview')) break;
    await choose(last, last.items[0]);
    await sleep(800);
  }
  await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'webview'), 'the resource page');
  await shot('resource-page', 2500);
  await done;
});

test('Learn', async () => {
  const mark = hook().shown.length;
  exec('if-console.learn');
  const pick = await nextQuickPick(mark, (s) => s.title === 'Learn', 'the Learn quick pick');
  await sleep(800);
  await shot('learn-topics');
  await choose(pick, 'start');
  await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'webview'), 'the topic page');
  await shot('learn-topic', 2500);
});

test('a dry run opens a diff', async () => {
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
  const review = await waitFor(() => hook().shown.slice(mark).find((s) => s.kind === 'quickpick' && s.title === `${command}: what would change`), 'the changes');
  await sleep(600);
  await shot('dry-run-changes');
  await choose(review, 'site/index.txt');
  await waitFor(() => vscode.window.tabGroups.all.flatMap((g) => g.tabs).some((t) => t.input instanceof vscode.TabInputTextDiff), 'the diff editor');
  await shot('dry-run-diff', 2000);
});
