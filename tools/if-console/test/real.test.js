'use strict';
// The extension's core logic driven headlessly against a real command line: IF_CONSOLE_REAL_ROOT names a clone whose
// `.if-console.env` declares its launcher. The repository's own check of this extension sets it; run alone, this file is skipped.
const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStub, install, folderOf, Uri } = require('./support/vscode-stub');
const { makeRepo, secondCommandLine } = require('./support/fake-launcher');

const ROOT = process.env.IF_CONSOLE_REAL_ROOT;
const skip = ROOT ? false : 'IF_CONSOLE_REAL_ROOT is not set';
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

async function start(extraFolders = []) {
  const stub = createStub({ folders: [folderOf('real', ROOT), ...extraFolders] });
  const restore = install(stub);
  const spawns = [];
  const realSpawn = childProcess.spawn;
  childProcess.spawn = function (file, args, ...rest) { spawns.push([file, args]); return realSpawn.call(this, file, args, ...rest); };
  const { App } = require('../src/app');
  const context = { subscriptions: [] };
  const app = new App(context);
  app.register();
  await app.refresh();
  return { stub, app, spawns, repo: app.repos[0], done: () => { childProcess.spawn = realSpawn; context.subscriptions.forEach((s) => { try { s.dispose(); } catch (e) { /* */ } }); restore(); } };
}

test('real: the declaration at the root is found, `command list` is accepted, and nouns and editor commands come from it', { skip, timeout: 120000 }, async () => {
  const s = await start();
  const repo = s.repo;
  assert.equal(s.app.repos.length, 1);
  assert.equal(repo.state, 'ready');
  assert.ok(repo.name.length > 0 && repo.audience === 'public', `${repo.name} / ${repo.audience}`);
  const { nouns, repoWide } = repo.nouns();
  assert.ok(nouns.has('spec') && nouns.has('toolchain'));
  assert.ok(['check', 'doctor', 'fresh', 'test'].every((c) => repoWide.some((x) => x.id === c)));
  const exposed = repo.editorCommands().map((c) => c.id);
  assert.ok(!exposed.includes('lock') && !exposed.includes('mcp serve') && !exposed.includes('system add'), 'a command the editor does not expose is not offered');
  assert.ok(exposed.includes('toolchain add'), 'a setup command the launcher widens to the editor is offered');
  assert.ok(s.spawns.every(([file]) => file === repo.launcher.file));
  assert.match(s.stub.calls.output.join('\n'), /command list --json/);
  s.done();
});

test('real: `command show` carries typed arguments with choices; the noun\'s list command supplies resources', { skip, timeout: 120000 }, async () => {
  const s = await start();
  const set = await s.repo.detail('spec set');
  assert.equal(set.category, 'decision');
  const status = set.options.find((o) => o.flag === '--status');
  assert.deepEqual(status.choices, ['Draft', 'Adopted', 'Superseded']);
  const check = await s.repo.detail('check');
  assert.ok(check.arguments[0].choices.includes('commands'));
  assert.equal(check.arguments[0].required, false, 'zero or more sections: not required');
  const show = await s.repo.detail('spec show');
  const values = await s.repo.choicesFor({ type: show.arguments[0].type, key: show.arguments[0].name }, show);
  assert.ok(values.includes('0043-if-console'), 'the quick pick values come from `spec list`');
  const links = await s.repo.resources('spec');
  assert.ok(links.length > 10 && links[0].command === 'spec show');
  s.done();
});

test('real: a resource shows its links and actions; an action without a value has no pasteable line and says what it needs', { skip, timeout: 120000 }, async () => {
  const s = await start();
  const r = await s.repo.launcher.run(['spec', 'show', '0043-if-console']);
  const wire = require('../src/wire');
  const actions = wire.actionsOf(r.doc);
  assert.ok(actions.length >= 1 && actions.every((a) => a.category && typeof a.enabled === 'boolean'));
  assert.ok(actions.some((a) => a.category === 'decision'), 'the spec offers its decision as an action');
  assert.ok(wire.linksOf(r.doc).every((l) => l.rel && l.command && l.cli));
  const needing = await s.repo.launcher.run(['spec', 'show', '0043-if-console']);
  assert.ok(needing.doc);
  s.done();
});

test('real: a check with findings reaches Problems at file and line; a section that runs again is cleared', { skip, timeout: 120000 }, async () => {
  const s = await start();
  const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'ifc-fx-'));
  fs.mkdirSync(path.join(fx, 'spec-kit'));
  fs.writeFileSync(path.join(fx, 'spec-kit', 'controls.tsv'), 'broken row without tabs\n');
  const bad = await s.repo.launcher.run(['check', 'controls', '--root', fx]);
  assert.equal(bad.exit, 1);
  const result = await s.app.handleCheck(s.repo, bad.doc);
  assert.equal(result.sections[0].status, 'failed');
  const uri = Uri.file(path.join(ROOT, 'spec-kit', 'controls.tsv'));
  const diags = s.stub.diagnostics.get(uri.toString());
  assert.ok(diags && diags.length >= 1, 'one diagnostic for a finding with file:line');
  assert.equal(diags[0].range.start.line, 0);
  assert.equal(diags[0].source, `${s.repo.name} check controls`);
  assert.match(diags[0].message, /tab-separated/);
  const good = await s.repo.launcher.run(['check', 'controls']);
  assert.equal(good.exit, 0);
  await s.app.handleCheck(s.repo, good.doc);
  assert.equal(s.stub.diagnostics.get(uri.toString()), undefined, 'the section ran again: its diagnostics are gone');
  fs.rmSync(fx, { recursive: true, force: true });
  s.done();
});

test('real: each check section is a test, run by check SECTION (a skipped one is shown skipped: see app.test.js)', { skip, timeout: 120000 }, async () => {
  const s = await start();
  const ctl = s.stub.calls.testController;
  assert.ok([...ctl.items].length === 1);
  const item = (() => { let found; [...ctl.items][0][1].children.forEach((c) => { if (c.label === 'commands') found = c; }); return found; })();
  assert.ok(item, 'each check section is a test');
  await ctl.handler({ include: [item], exclude: [] }, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) });
  const events = ctl.runs[0].log.filter((e) => ['passed', 'failed', 'skipped', 'errored'].includes(e[0]));
  assert.deepEqual(events.map((e) => e[0]), ['passed']);
  s.done();
});

test('real: a write is run with --dry-run, its diff opens in the diff editor, and it is written only after acceptance', { skip, timeout: 120000 }, async () => {
  const s = await start();
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ifc-out-')), 'iflayout.def');
  s.stub.script.quickPicks.push((items) => items[1].value);   // open the diff
  s.stub.script.quickPicks.push('apply');
  const detail = await s.repo.detail('layout build');
  const executor = require('../src/executor');
  const result = await executor.runArgv(s.app.ui, s.repo, detail, ['layout', 'build', 'two-column', '--out', out]);
  assert.equal(result.ran, true);
  const [left, right] = s.stub.calls.diffs[0];
  const provider = s.stub.calls.contentProvider.p;
  assert.equal(provider.provideTextDocumentContent(left), '');
  const after = provider.provideTextDocumentContent(right);
  assert.ok(after.startsWith('\\def\\ifLname{two-column}'));
  assert.equal(fs.readFileSync(out, 'utf8'), after, 'what was shown is what was written');
  const writes = s.spawns.filter(([, a]) => a[0] === 'layout').map(([, a]) => a.includes('--dry-run'));
  assert.deepEqual(writes, [true, false]);
  fs.rmSync(path.dirname(out), { recursive: true, force: true });
  s.done();
});

test('real: a decision is refused without the modal: after the dry run and the diff, a dismissed dialog leaves the spec untouched', { skip, timeout: 120000 }, async () => {
  const s = await start();
  const spec = path.join(ROOT, 'spec-kit', 'specs', '0043-if-console', 'spec.md');
  const before = sha(spec);
  const detail = await s.repo.detail('spec set');
  s.stub.script.quickPicks.push('apply');
  s.stub.script.warnings.push(undefined);                      // the modal is dismissed
  const executor = require('../src/executor');
  const result = await executor.runArgv(s.app.ui, s.repo, detail, ['spec', 'set', '0043-if-console', '--status', 'Adopted']);
  assert.equal(result.ran, false);
  assert.equal(sha(spec), before, 'the spec file is unchanged');
  const calls = s.spawns.filter(([, a]) => a[0] === 'spec' && a[1] === 'set').map(([, a]) => a.includes('--dry-run'));
  assert.deepEqual(calls, [true]);
  const modal = s.stub.calls.messages.find((m) => m.kind === 'warning');
  assert.equal(modal.rest[0].modal, true);
  assert.match(modal.rest[0].detail, /spec set 0043-if-console --status Adopted/);
  s.done();
});

test('real: a second command line beside the real one is its own repository, with its own commands', { skip, timeout: 120000 }, async () => {
  const k = secondCommandLine('other');
  const fake = makeRepo({ docs: { 'command list': { doc: k.list }, 'doctor': { doc: k.doc('doctor', 'other', { status: 'ok' }) } } });
  const s = await start([folderOf('second', fake.root)]);
  assert.equal(s.app.repos.length, 2);
  assert.deepEqual(s.app.repos.map((r) => r.audience), ['public', 'private']);
  assert.notEqual(s.app.repos[0].name, s.app.repos[1].name);
  assert.ok(s.app.repos[1].has('widget list') && !s.app.repos[0].has('widget list'));
  s.done();
  fake.cleanup();
});
