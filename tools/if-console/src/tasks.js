'use strict';
// The task type `if-console` (0043-if-console FR-010): a repository's repository-wide commands (`check`, `test`, `fresh`,
// `doctor`) and, for `check`, a section or a suite, under Run Task, bindable to a keybinding. A task runs the launcher with
// `--json` and writes a summary to its terminal; the findings of a check go straight to the Problems panel (direct
// diagnostics), so no problem matcher is needed.
const vscode = require('vscode');
const wire = require('./wire');

const COMMANDS = ['check', 'test', 'fresh', 'doctor'];

function argvOf(def) {
  const argv = [def.command];
  if (def.command === 'check') {
    if (def.suite) argv.push('--suite', def.suite);
    if (def.section) argv.push(def.section);
    if (def.changed) argv.push('--changed');
  }
  return argv;
}

function labelOf(repo, def) {
  return [repo.name, def.command, def.section || (def.suite ? `--suite ${def.suite}` : '')].filter(Boolean).join(' ');
}

// What a task writes to its terminal for a result: plain lines, \r\n as a terminal needs.
function summaryLines(doc) {
  const out = [];
  if (doc.kind === 'check') {
    const r = wire.checkResult(doc);
    for (const s of r.sections) {
      out.push(`${s.status === 'passed' ? 'passed' : s.status === 'skipped' ? 'skipped' : 'FAILED'}  ${s.name}${s.reason ? ` (${s.reason})` : ''}`);
      for (const f of s.findings) out.push(`  ${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}`);
    }
    out.push(`check: ${r.summary.passed || 0} passed, ${r.summary.failed || 0} failed, ${r.summary.skipped || 0} skipped`);
  } else {
    const d = doc.data || {};
    out.push(`${doc.kind}: ${d.status || 'done'}`);
  }
  return out;
}

class TaskTerminal {
  constructor(app, repo, def) {
    this.app = app; this.repo = repo; this.def = def;
    this.writeEmitter = new vscode.EventEmitter();
    this.closeEmitter = new vscode.EventEmitter();
    this.onDidWrite = this.writeEmitter.event;
    this.onDidClose = this.closeEmitter.event;
    this.controller = new AbortController();
  }
  write(line) { this.writeEmitter.fire(`${line}\r\n`); }
  async open() {
    const argv = argvOf(this.def);
    this.write(`$ ${this.repo.launcher.line(argv, 'json')}`);
    if (!this.app.trusted()) { this.write('IF Console runs nothing in a workspace that is not trusted.'); this.closeEmitter.fire(1); return; }
    const r = await this.repo.launcher.run(argv, { signal: this.controller.signal, onDocument: (d) => this.write(String((d.data && (d.data.message || d.data.step)) || d.id)) });
    if (r.cancelled) { this.write('Cancelled.'); this.closeEmitter.fire(1); return; }
    if (!r.doc || r.error) { this.write(r.error ? r.error.message : `${this.repo.program} gave no result (${r.failed || `exit ${r.exit}`}).`); this.closeEmitter.fire(r.exit || 1); return; }
    const ok = wire.checkSchema(r.doc);
    if (!ok.ok) { this.write(ok.message); this.closeEmitter.fire(1); return; }
    if (r.doc.kind === 'check') await this.app.handleCheck(this.repo, r.doc);
    if (r.doc.kind === 'doctor') { this.repo.doctor = r.doc; this.app.refreshViews(); }
    if (r.doc.kind === 'fresh') { this.repo.fresh = r.doc; this.app.refreshViews(); }
    for (const l of summaryLines(r.doc)) this.write(l);
    this.closeEmitter.fire(r.exit || 0);
  }
  close() { this.controller.abort(); }
}

class TaskProvider {
  constructor(app) { this.app = app; }

  make(repo, def) {
    const task = new vscode.Task({ ...def, folder: repo.folder.name }, repo.folder, labelOf(repo, def), 'if-console',
      new vscode.CustomExecution(async () => new TaskTerminal(this.app, repo, def)));
    task.detail = `${repo.launcher.line(argvOf(def), 'json')}`;
    if (def.command === 'test') task.group = vscode.TaskGroup.Test;
    if (def.command === 'check') task.group = vscode.TaskGroup.Build;
    return task;
  }

  async provideTasks() {
    const tasks = [];
    for (const repo of this.app.repos) {
      if (repo.state !== 'ready') continue;
      for (const command of COMMANDS) {
        const c = repo.command(command);
        if (!c || !wire.exposed(c)) continue;
        tasks.push(this.make(repo, { type: 'if-console', command }));
        if (command === 'check') {
          try {
            const d = await repo.detail('check');
            const suite = d.options.find((o) => o.flag === '--suite');
            for (const s of (suite && suite.choices) || []) tasks.push(this.make(repo, { type: 'if-console', command, suite: s }));
          } catch (e) { /* the plain check task is still there */ }
        }
      }
    }
    return tasks;
  }

  resolveTask(task) {
    const def = task.definition;
    if (!def || def.type !== 'if-console' || !COMMANDS.includes(def.command)) return undefined;
    const repo = this.app.repos.find((r) => (def.folder ? r.folder.name === def.folder : true) && r.state === 'ready' && r.has(def.command));
    return repo ? this.make(repo, def) : undefined;
  }
}

module.exports = { TaskProvider, TaskTerminal, argvOf, summaryLines, COMMANDS };
