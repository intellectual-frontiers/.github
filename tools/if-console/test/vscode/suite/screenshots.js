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

test('the views', async () => {
  await activate();
  await exec('workbench.action.closePanel');
  await exec('workbench.view.extension.if-console');
  await shot('views');
  for (const view of ['commands', 'chores', 'checks']) {
    await exec(`if-console.${view}.focus`);
    try { await exec(`workbench.actions.treeView.if-console.${view}.expandAll`); } catch (e) { /* an older VS Code has no expandAll */ }
    await shot(`view-${view}`);
  }
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

test('a check shows its findings in Problems', async () => {
  const file = vscode.Uri.file(path.join(process.env.IF_CONSOLE_FIXTURE_ROOT, 'docs', 'guide.md'));
  const doc = await vscode.workspace.openTextDocument(file);
  const editor = await vscode.window.showTextDocument(doc);
  await editor.edit((b) => b.insert(new vscode.Position(0, 0), ' '));
  await doc.save();
  await waitFor(() => vscode.languages.getDiagnostics(file).length, 'the diagnostics');
  await exec('workbench.actions.view.problems');
  await shot('problems', 2000);
});
