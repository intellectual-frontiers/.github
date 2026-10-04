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
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { make } = require('./fixture');

const need = (name) => { if (!process.env[name]) { console.error(`${name} is not set`); process.exit(2); } return process.env[name]; };
const code = need('IF_CONSOLE_VSCODE');
const cli = need('IF_CONSOLE_VSCODE_CLI');
const vsix = need('IF_CONSOLE_VSIX');
const testElectron = need('IF_CONSOLE_TEST_ELECTRON');
const realRoot = need('IF_CONSOLE_REAL_ROOT');
const reportFile = need('IF_CONSOLE_VSCODE_REPORT');
const extension = path.resolve(__dirname, '..', '..');
const suite = path.join(__dirname, 'suite', 'index.js');

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

async function trusted(base, workspace, env) {
  const { runTests } = require(testElectron);
  const p = profile(base, 'trusted');
  await runTests({
    vscodeExecutablePath: code, extensionDevelopmentPath: extension, extensionTestsPath: suite,
    launchArgs: [workspace, `--user-data-dir=${p.data}`, `--extensions-dir=${p.extensions}`, '--disable-gpu'],
    extensionTestsEnv: { ...env, IF_CONSOLE_VSCODE_SCENARIO: 'trusted' },
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

(async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'if-console-vscode-'));
  const reports = path.join(base, 'reports');
  fs.mkdirSync(reports);
  const fixtures = [];
  const failures = [];
  // Each scenario has its own fixture command line, so that what one launches cannot be mistaken for what another did.
  for (const [name, run] of [['trusted', trusted], ['untrusted', untrusted]]) {
    const fixture = make();
    fixtures.push(fixture);
    const workspace = path.join(base, `${name}.code-workspace`);
    fs.writeFileSync(workspace, JSON.stringify({ folders: [{ name: 'real', path: realRoot }, { name: 'fixture', path: fixture.root }], settings: {} }));
    const env = { IF_CONSOLE_VSCODE_REPORT_DIR: reports, IF_CONSOLE_FIXTURE_ROOT: fixture.root, IF_CONSOLE_REAL_ROOT: realRoot,
      DBUS_SESSION_BUS_ADDRESS: '/dev/null', ELECTRON_DISABLE_SECURITY_WARNINGS: '1' };
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
