'use strict';
// A small test runner for inside the extension host: tests run one after another, each with a timeout, and a report of every test
// (its name, status, seconds and, if it failed, why) is written for the caller.
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const tests = [];
const test = (name, fn, timeout = 120000) => tests.push({ name, fn, timeout });

async function tidy() {
  for (const id of ['workbench.action.closeQuickOpen', 'notifications.clearAll', 'workbench.action.closeAllEditors']) {
    try { await vscode.commands.executeCommand(id); } catch (e) { /* not available now */ }
  }
}

async function runAll(scenario, reportDir) {
  const report = [];
  for (const t of tests) {
    const began = Date.now();
    const row = { name: `${scenario}: ${t.name}`, status: 'passed', seconds: 0 };
    let timer;
    try {
      await Promise.race([t.fn(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${t.timeout / 1000}s`)), t.timeout); })]);
    } catch (e) {
      row.status = 'failed';
      row.reason = String(e && e.stack ? e.stack : e).split('\n').slice(0, 40).join('\n');
    }
    clearTimeout(timer);
    row.seconds = Math.round((Date.now() - began) / 100) / 10;
    report.push(row);
    await tidy();
  }
  fs.writeFileSync(path.join(reportDir, `${scenario}.json`), JSON.stringify({ tests: report }, null, 2));
  const failed = report.filter((r) => r.status !== 'passed');
  if (failed.length) throw new Error(`${failed.length} of ${report.length} failed: ${failed.map((f) => f.name).join('; ')}`);
}

module.exports = { test, runAll };
