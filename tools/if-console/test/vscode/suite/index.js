'use strict';
// The entry VS Code calls inside the extension host (the extension test path): it loads the scenario's tests and runs them.
const { runAll } = require('./harness');

async function run() {
  const scenario = process.env.IF_CONSOLE_VSCODE_SCENARIO;
  if (!['trusted', 'untrusted'].includes(scenario)) throw new Error(`unknown scenario ${scenario}`);
  require(`./${scenario}`);
  await runAll(scenario, process.env.IF_CONSOLE_VSCODE_REPORT_DIR);
}

module.exports = { run };
