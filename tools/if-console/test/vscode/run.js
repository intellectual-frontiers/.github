'use strict';
// Runs the extension's tests inside a real VS Code (0043-if-console FR-032). It is run by Node, under a display server the caller has
// started (DISPLAY), with the VS Code program and @vscode/test-electron the caller names. It builds a workspace of two command lines (the
// clone at IF_CONSOLE_REAL_ROOT and a fixture), starts VS Code twice, once with the workspace trusted and once not, and writes a report
// of every test to IF_CONSOLE_VSCODE_REPORT as JSON. It exits 0 only when every test passed.
//   IF_CONSOLE_VSCODE         the VS Code program (the Electron binary at the root of the unpacked build)
//   IF_CONSOLE_VSCODE_CLI     its command-line program, which installs an extension
//   IF_CONSOLE_VSIX           the extension's package, as `extension build` writes it
//   IF_CONSOLE_TEST_ELECTRON  the @vscode/test-electron package
//   IF_CONSOLE_REAL_ROOT      the clone whose own command line is the first one of the workspace
//   IF_CONSOLE_VSCODE_REPORT  where the report is written
// A caller that has its own tests for the extension in a workspace of its own (for another command line, say) names them with two more,
// and then only that one suite runs, once, in a trusted workspace holding the clone and those folders (no fixture, no untrusted run):
//   IF_CONSOLE_VSCODE_FOLDERS a JSON array of {name, path}: the folders added to the workspace after the clone's
//   IF_CONSOLE_VSCODE_SUITE   a directory whose index.js exports run(), as suite/index.js does; it may load this directory's suite/harness
//                             and suite/support (the host's IF_CONSOLE_EXTENSION_DIR is this extension's directory) and calls
//                             runAll(its own name, IF_CONSOLE_VSCODE_REPORT_DIR) to write its report
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { make } = require('./fixture');

const need = (name) => { if (!process.env[name]) { console.error(`${name} is not set`); process.exit(2); } return process.env[name]; };
const code = need('IF_CONSOLE_VSCODE');
const cli = need('IF_CONSOLE_VSCODE_CLI');
const external = process.env.IF_CONSOLE_VSCODE_SUITE ? path.resolve(process.env.IF_CONSOLE_VSCODE_SUITE) : null;
const folders = JSON.parse(process.env.IF_CONSOLE_VSCODE_FOLDERS || '[]');
const vsix = external || process.env.IF_CONSOLE_SCREENSHOTS ? (process.env.IF_CONSOLE_VSIX || '') : need('IF_CONSOLE_VSIX');   // only the untrusted scenario installs the package
const testElectron = need('IF_CONSOLE_TEST_ELECTRON');
const realRoot = need('IF_CONSOLE_REAL_ROOT');
const reportFile = need('IF_CONSOLE_VSCODE_REPORT');
const extension = path.resolve(__dirname, '..', '..');
const suite = external ? path.join(external, 'index.js') : path.join(__dirname, 'suite', 'index.js');

function profile(base, name, extra) {
  const dir = path.join(base, name);
  const data = path.join(dir, 'user-data');
  fs.mkdirSync(path.join(data, 'User'), { recursive: true });
  fs.writeFileSync(path.join(data, 'User', 'settings.json'), JSON.stringify({
    'if-console.checkOnSave': true, 'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'workbench.startupEditor': 'none',
    'window.dialogStyle': 'custom', 'security.workspace.trust.startupPrompt': 'never', 'extensions.autoCheckUpdates': false,
    'extensions.autoUpdate': false, 'git.enabled': false, 'workbench.enableExperiments': false, ...(extra || {}) }, null, 2));
  return { dir, data, extensions: path.join(dir, 'extensions') };
}

async function trusted(base, workspace, env, name = 'trusted', settings = {}) {
  const { runTests } = require(testElectron);
  const p = profile(base, name, settings);
  await runTests({
    vscodeExecutablePath: code, extensionDevelopmentPath: extension, extensionTestsPath: suite,
    launchArgs: [workspace, `--user-data-dir=${p.data}`, `--extensions-dir=${p.extensions}`, '--disable-gpu'],
    extensionTestsEnv: { ...env, IF_CONSOLE_VSCODE_SCENARIO: name === 'trusted' ? 'trusted' : 'screenshots' },
  });
}

// This scenario needs the extension as a person has it, installed from its package, in a workspace VS Code does not trust. Two things
// differ from the trusted one. @vscode/test-electron always passes --disable-workspace-trust, which would trust the workspace, so VS Code is
// started here with the same arguments less that one. And VS Code leaves an extension under development enabled in Restricted Mode, so the
// extension is installed from its package, and a folder with only a manifest hosts the tests.
function untrusted(base, workspace, env) {
  const p = profile(base, 'untrusted');
  cp.execFileSync(cli, ['--install-extension', vsix, `--extensions-dir=${p.extensions}`, `--user-data-dir=${p.data}`, '--no-sandbox'],
    { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'inherit'] });
  const host = path.join(base, 'tests-host');
  fs.mkdirSync(host, { recursive: true });
  fs.writeFileSync(path.join(host, 'package.json'), JSON.stringify({ name: 'if-console-tests-host', publisher: 'tests', version: '0.0.0',
    engines: { vscode: '^1.101.0' }, capabilities: { untrustedWorkspaces: { supported: true } } }));
  const args = [workspace, `--user-data-dir=${p.data}`, `--extensions-dir=${p.extensions}`, '--no-sandbox', '--disable-gpu-sandbox', '--disable-gpu',
    '--disable-updates', '--skip-welcome', '--skip-release-notes', '--no-cached-data', `--extensionTestsPath=${suite}`,
    `--extensionDevelopmentPath=${host}`];
  return new Promise((resolve, reject) => {
    const child = cp.spawn(code, args, { env: { ...process.env, ...env, IF_CONSOLE_VSCODE_SCENARIO: 'untrusted', IF_CONSOLE_INSTALLED_DIR: p.extensions } });
    child.stdout.on('data', (d) => process.stdout.write(d));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('error', reject);
    child.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`VS Code exited ${c}`))));
  });
}

// The screenshots scenario (0043-if-console FR-045): the same fixture workspace as the trusted scenario, once for each of VS Code's own three
// kinds of theme, the display server's screen read to a PNG after each view is open. IF_CONSOLE_SCREENSHOTS names the folder it writes.
const THEMES = [['dark', 'Default Dark+'], ['light', 'Default Light+'], ['high-contrast', 'Default High Contrast']];

async function screenshots(base, reports, failures) {
  const out = path.resolve(process.env.IF_CONSOLE_SCREENSHOTS);
  fs.mkdirSync(out, { recursive: true });
  for (const [id, theme] of THEMES) {
    const fixture = make();
    const workspace = path.join(base, `${id}.code-workspace`);
    fs.writeFileSync(workspace, JSON.stringify({ folders: [{ name: 'real', path: realRoot }, { name: 'fixture', path: fixture.root }, ...folders], settings: {} }));
    const env = { IF_CONSOLE_VSCODE_REPORT_DIR: reports, IF_CONSOLE_REAL_ROOT: realRoot, IF_CONSOLE_EXTENSION_DIR: extension,
      DBUS_SESSION_BUS_ADDRESS: '/dev/null', ELECTRON_DISABLE_SECURITY_WARNINGS: '1', IF_CONSOLE_FIXTURE_ROOT: fixture.root,
      IF_CONSOLE_SCREENSHOTS: out, IF_CONSOLE_SCREEN_DUMP: need('IF_CONSOLE_SCREEN_DUMP'), IF_CONSOLE_SHOT_THEME: id };
    try { await trusted(base, workspace, env, `screenshots-${id}`, { 'workbench.colorTheme': theme, 'window.autoDetectColorScheme': false,
      'workbench.startupEditor': 'none', 'editor.minimap.enabled': false, 'window.commandCenter': false, 'workbench.tips.enabled': false,
      'workbench.secondarySideBar.defaultVisibility': 'hidden', 'chat.disableAIFeatures': true, 'workbench.layoutControl.enabled': false }); }
    catch (e) { failures.push(`${id}: ${e.message}`); }
    fixture.cleanup();
  }
}

(async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'if-console-vscode-'));
  const reports = path.join(base, 'reports');
  fs.mkdirSync(reports);
  const fixtures = [];
  const failures = [];
  if (process.env.IF_CONSOLE_SCREENSHOTS) {
    await screenshots(base, reports, failures);
    const shot = [];
    for (const f of fs.readdirSync(reports).sort()) shot.push(...JSON.parse(fs.readFileSync(path.join(reports, f), 'utf8')).tests);
    fs.writeFileSync(reportFile, JSON.stringify({ tests: shot, errors: failures }, null, 2));
    fs.rmSync(base, { recursive: true, force: true });
    process.exit(failures.length || shot.some((t) => t.status !== 'passed') || !shot.length ? 1 : 0);
  }
  // Each scenario has its own fixture command line, so that what one launches cannot be mistaken for what another did.
  for (const [name, run] of external ? [['trusted', trusted]] : [['trusted', trusted], ['untrusted', untrusted]]) {
    const fixture = external ? null : make();
    if (fixture) fixtures.push(fixture);
    const workspace = path.join(base, `${name}.code-workspace`);
    const held = [{ name: 'real', path: realRoot }, ...(fixture ? [{ name: 'fixture', path: fixture.root }] : []), ...folders];
    fs.writeFileSync(workspace, JSON.stringify({ folders: held, settings: {} }));
    const env = { IF_CONSOLE_VSCODE_REPORT_DIR: reports, IF_CONSOLE_REAL_ROOT: realRoot, IF_CONSOLE_EXTENSION_DIR: extension,
      DBUS_SESSION_BUS_ADDRESS: '/dev/null', ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      ...(fixture ? { IF_CONSOLE_FIXTURE_ROOT: fixture.root } : {}) };
    try { await run(base, workspace, env); } catch (e) { failures.push(`${name}: ${e.message}`); }
  }
  const results = [];
  for (const f of fs.readdirSync(reports).sort()) results.push(...JSON.parse(fs.readFileSync(path.join(reports, f), 'utf8')).tests);
  const failed = results.filter((t) => t.status !== 'passed');
  fs.writeFileSync(reportFile, JSON.stringify({ tests: results, errors: failures }, null, 2));
  fixtures.forEach((f) => f.cleanup());
  fs.rmSync(base, { recursive: true, force: true });
  if (failures.length || failed.length || !results.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
