'use strict';
// The extension, installed from the package `extension build` makes, in a workspace VS Code does not trust: VS Code does not load it, and
// no launcher runs (0043-if-console FR-006, FR-032).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { test } = require('./harness');
const { hook, sleep } = require('./support');

test('an untrusted workspace runs nothing', async () => {
  assert.strictEqual(vscode.workspace.isTrusted, false, 'VS Code does not trust this workspace');
  const installed = fs.readdirSync(process.env.IF_CONSOLE_INSTALLED_DIR).filter((n) => n.startsWith('intellectual-frontiers.if-console'));
  assert.strictEqual(installed.length, 1, `the package is installed: ${installed}`);
  await sleep(6000);   // long enough for the startup activation event to have fired
  const ext = vscode.extensions.getExtension('intellectual-frontiers.if-console');
  assert.ok(!ext || ext.isActive === false, 'VS Code did not activate it: it does not support untrusted workspaces');
  assert.strictEqual(hook(), undefined, 'and it has no test hook');
  const registered = (await vscode.commands.getCommands(true)).filter((c) => c.startsWith('if-console.'));
  assert.deepStrictEqual(registered, [], 'no command of its is registered');
  assert.strictEqual(fs.existsSync(path.join(process.env.IF_CONSOLE_FIXTURE_ROOT, '.fake-log.ndjson')), false, 'no launcher ran');
});
