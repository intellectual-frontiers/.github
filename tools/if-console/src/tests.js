'use strict';
// Each `check` section as a test in the Test Explorer (0043-if-console FR-010), run by `check SECTION --json`. A section the
// launcher reports as skipped is shown as skipped, never as passed (0041-command-line FR-033).
const vscode = require('vscode');

class CheckTests {
  constructor(app) {
    this.app = app;
    this.controller = vscode.tests.createTestController('if-console.checks', 'IF Console checks');
    this.controller.refreshHandler = () => this.app.refresh();
    this.profile = this.controller.createRunProfile('Run check', vscode.TestRunProfileKind.Run, (request, token) => this.run(request, token), true);
    this.items = new Map();   // test item id -> {repo, section}
  }

  async rebuild() {
    this.controller.items.replace([]);
    this.items.clear();
    for (const repo of this.app.repos) {
      if (repo.state !== 'ready' || !repo.has('check')) continue;
      const root = this.controller.createTestItem(`repo:${repo.key}`, `${repo.name} (${repo.folder.name})`);
      this.items.set(root.id, { repo, section: null });
      for (const name of await this.app.sectionNames(repo)) {
        const t = this.controller.createTestItem(`section:${repo.key}:${name}`, name);
        root.children.add(t);
        this.items.set(t.id, { repo, section: name });
      }
      this.controller.items.add(root);
    }
  }

  // The leaves a request names: a chosen section, or every section of a chosen repository.
  leavesOf(request) {
    const chosen = request.include && request.include.length ? request.include : [...this.controller.items].map(([, t]) => t);
    const leaves = [];
    const excluded = new Set((request.exclude || []).map((t) => t.id));
    const walk = (t) => {
      if (excluded.has(t.id)) return;
      const meta = this.items.get(t.id);
      if (meta && meta.section) { leaves.push({ item: t, ...meta }); return; }
      t.children.forEach((c) => walk(c));
    };
    chosen.forEach(walk);
    return leaves;
  }

  async run(request, token) {
    const run = this.controller.createTestRun(request);
    const controller = new AbortController();
    token.onCancellationRequested(() => controller.abort());
    const leaves = this.leavesOf(request);
    for (const { item, repo, section } of leaves) run.enqueued(item);
    for (const { item, repo, section } of leaves) {
      if (token.isCancellationRequested) break;
      run.started(item);
      const started = Date.now();
      const results = await this.app.runSections(repo, [section], { signal: controller.signal });
      const r = results.find((x) => x.name === section) || results[0];
      if (!r) { run.skipped(item); continue; }
      if (r.failed) { run.errored(item, new vscode.TestMessage(r.message)); continue; }
      if (r.status === 'skipped') { run.appendOutput(`${section}: skipped${r.reason ? `: ${r.reason}` : ''}\r\n`, undefined, item); run.skipped(item); continue; }
      if (r.status === 'passed') { run.passed(item, Date.now() - started); continue; }
      const messages = [];
      for (const f of r.findings) {
        const m = new vscode.TestMessage(`${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}${f.next ? `\nNext: ${f.next}` : ''}`);
        const loc = require('./diagnostics').locate(f.where);
        const uri = loc ? await this.app.resolveFile(repo.folder, loc.file) : null;
        if (uri) m.location = new vscode.Location(uri, new vscode.Position(Math.max(0, loc.line - 1), 0));
        messages.push(m);
        run.appendOutput(`${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}\r\n`, undefined, item);
      }
      run.failed(item, messages.length ? messages : new vscode.TestMessage('The section failed.'), Date.now() - started);
    }
    run.end();
  }

  dispose() { this.controller.dispose(); }
}

module.exports = { CheckTests };
