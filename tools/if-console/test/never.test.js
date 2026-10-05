'use strict';
// What the extension never does (0043-if-console FR-023, FR-024, FR-026, FR-003): no telemetry, no network, no setting beyond two,
// no file written, and no program run but a repository's launcher.
const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('child_process');
const net = require('net');
const dns = require('dns');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { boot, defaultDocs } = require('./support/boot');

const srcDir = path.join(__dirname, '..', 'src');
const sources = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).map((f) => ({ f, text: fs.readFileSync(path.join(srcDir, f), 'utf8') }));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('FR-023: no source uses a network module, an HTTP or socket call, a remote resource or VS Code\'s telemetry', () => {
  const forbidden = [/require\(['"](?:node:)?(?:https?|net|tls|dgram|dns|http2|ws|node-fetch|axios|undici|request)['"]\)/, /\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/,
    /createTelemetryLogger/, /isTelemetryEnabled/, /onDidChangeTelemetryEnabled/, /TelemetryReporter/, /applicationinsights/i, /https?:\/\/(?!github\.com\/intellectual-frontiers)/];
  for (const { f, text } of sources) for (const re of forbidden) assert.doesNotMatch(strip(text), re, `${f} matches ${re}`);
});

test('FR-003: the only program the extension runs is a launcher, through child_process.spawn in one place', () => {
  const users = sources.filter(({ text }) => /child_process/.test(text)).map((s) => s.f);
  assert.deepEqual(users, ['launcher.js']);
  const text = strip(sources.find((s) => s.f === 'launcher.js').text);
  assert.doesNotMatch(text, /\b(exec|execSync|execFile|execFileSync|spawnSync|fork)\b\s*\(/);
  assert.doesNotMatch(text, /shell\s*:\s*true/);
});

test('FR-026: no source writes a file, an ignore rule or anything in .vscode', () => {
  const forbidden = [/\bwriteFile(Sync)?\b/, /\bappendFile(Sync)?\b/, /\bmkdir(Sync)?\b/, /\bunlink(Sync)?\b/, /\brename(Sync)?\b/, /\brmSync?\b/, /\bcreateWriteStream\b/,
    /\bcopyFile(Sync)?\b/, /workspace\.fs\.(writeFile|delete|createDirectory|copy|rename)/, /\.update\s*\(/, /globalState|workspaceState|secrets\b/];
  for (const { f, text } of sources) for (const re of forbidden) assert.doesNotMatch(strip(text), re, `${f} matches ${re}`);
});

test('FR-003: sources require only VS Code, Node\'s built-ins the extension needs, and its own files: no runtime npm package', () => {
  const allowed = new Set(['vscode', 'path', 'fs', 'crypto', 'child_process']);
  for (const { f, text } of sources) {
    for (const m of strip(text).matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      assert.ok(m[1].startsWith('./') || allowed.has(m[1]), `${f} requires ${m[1]}`);
    }
  }
  assert.equal(manifest.dependencies, undefined);
  for (const [name, version] of Object.entries(manifest.devDependencies || {})) assert.match(version, /^\d+\.\d+\.\d+$/, `${name} is pinned to one exact version`);
});

test('FR-024: the settings are only if-console.launchers and if-console.checkOnSave, and neither can be set by a workspace', () => {
  const props = manifest.contributes.configuration.properties;
  assert.deepEqual(Object.keys(props).sort(), ['if-console.checkOnSave', 'if-console.launchers']);
  for (const p of Object.values(props)) assert.equal(p.scope, 'application');
  assert.equal(props['if-console.checkOnSave'].default, false);
});

test('FR-001, FR-006, FR-030: the manifest names the extension, declares no support for untrusted or virtual workspaces, and states a VS Code version', () => {
  assert.equal(manifest.name, 'if-console');
  assert.equal(manifest.displayName, 'Intellectual Frontiers Console');
  assert.equal(manifest.capabilities.untrustedWorkspaces.supported, false);
  assert.equal(manifest.capabilities.virtualWorkspaces.supported, false);
  assert.match(manifest.engines.vscode, /^\^1\.\d+\.\d+$/);
  assert.ok(manifest.activationEvents.includes('workspaceContains:.if-console.env'));
  const ids = [...manifest.contributes.commands.map((c) => c.command), ...manifest.contributes.views['if-console'].map((v) => v.id), manifest.contributes.taskDefinitions[0].type,
    ...Object.keys(manifest.contributes.configuration.properties)];
  assert.ok(ids.every((i) => i === 'if-console' || i.startsWith('if-console.')), 'every contribution carries the prefix');
});

test('FR-012, FR-015: the palette offers the repository-wide commands and Run Command; no command, keybinding or task runs a decision directly', () => {
  const titles = manifest.contributes.commands.filter((c) => !/activateNode|runSection/.test(c.command)).map((c) => c.title);
  for (const want of ['Run Command', 'Check', 'Fresh', 'Test', 'Doctor', 'Show Command Line', 'Get Help', 'Copy Context', 'Open View']) assert.ok(titles.includes(want), want);
  assert.equal(manifest.contributes.keybindings, undefined, 'the extension binds no key; a person binds a task or a command themselves');
  const defs = manifest.contributes.taskDefinitions[0].properties.command.enum;
  assert.deepEqual(defs, ['check', 'test', 'fresh', 'doctor']);
  const hidden = manifest.contributes.menus.commandPalette.filter((m) => m.when === 'false').map((m) => m.command).sort();
  assert.deepEqual(hidden, ['if-console.activateNode', 'if-console.runSection']);
});

test('FR-023, FR-003, FR-026: a whole session opens no connection and runs no program but the launcher', async () => {
  const connects = [];
  const spawns = [];
  const realConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...a) { connects.push(a); return realConnect.apply(this, a); };
  const realLookup = dns.lookup; dns.lookup = function (...a) { connects.push(['dns', a[0]]); return realLookup.apply(this, a); };
  const realHttp = http.request; http.request = function (...a) { connects.push(['http']); return realHttp.apply(this, a); };
  const realHttps = https.request; https.request = function (...a) { connects.push(['https']); return realHttps.apply(this, a); };
  const realSpawn = childProcess.spawn;
  childProcess.spawn = function (file, ...rest) { spawns.push(file); return realSpawn.call(this, file, ...rest); };
  try {
    const b = await boot();
    const tree = b.context.subscriptions.find((s) => s.id === 'if-console.commands').o.treeDataProvider;
    const roots = await tree.getChildren();
    await tree.getChildren(roots[0]);
    await b.command('doctor');
    await b.command('refresh');
    const before = fs.readdirSync(b.first.root).sort();
    b.stub.script.quickPicks.push('docs');
    await b.stub.calls.testController.handler({ include: undefined, exclude: [] }, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) });
    assert.deepEqual(fs.readdirSync(b.first.root).sort(), before.filter((f) => f !== '.fake-log.ndjson').concat(before.includes('.fake-log.ndjson') ? ['.fake-log.ndjson'] : []).sort(), 'no file appeared in the clone');
    assert.ok(spawns.length > 0);
    assert.ok(spawns.every((f) => f === b.first.file), `only the launcher was run: ${spawns.join(', ')}`);
    b.cleanup();
  } finally {
    childProcess.spawn = realSpawn; net.Socket.prototype.connect = realConnect; dns.lookup = realLookup; http.request = realHttp; https.request = realHttps;
  }
  assert.deepEqual(connects, []);
});
