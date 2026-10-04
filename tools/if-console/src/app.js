'use strict';
// The extension's one object: the repositories found in the workspace folders, the views, the status bar, the Problems
// diagnostics, the tasks, the tests and the MCP registration, and the handlers of every command it contributes. It holds no
// rule of any orchestrator; a command's own result is whatever the launcher returned.
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const wire = require('./wire');
const forms = require('./forms');
const discovery = require('./discovery');
const { Repository } = require('./repository');
const executor = require('./executor');
const { createUi, DiffDocuments, SCHEME } = require('./ui');
const { Diagnostics } = require('./diagnostics');
const { StatusBar } = require('./status');
const { CommandsProvider, ChoresProvider, ChecksProvider, Node } = require('./tree');
const { McpRegistration } = require('./mcp');
const { openHtmlView } = require('./webview');
const context = require('./context');
const { TaskProvider } = require('./tasks');
const { CheckTests } = require('./tests');
const learn = require('./learn');
const testmode = require('./testmode');
const mcpmod = require('./mcp');

const nodeFs = {
  async readFile(p) { try { return await fs.promises.readFile(p, 'utf8'); } catch (e) { return null; } },
  async isExecutable(p) {
    try { const st = await fs.promises.stat(p); if (!st.isFile()) return false; await fs.promises.access(p, fs.constants.X_OK); return true; } catch (e) { return false; }
  },
};

class App {
  constructor(extensionContext, deps) {
    this.context = extensionContext;
    this.deps = deps || {};
    this.output = vscode.window.createOutputChannel('IF Console');
    this.repos = [];
    this.docs = new DiffDocuments();
    this.ui = createUi({ docs: this.docs, output: this.output });
    this.ui.showResult = (repo, detail, argv, real, opts) => this.showResult(repo, detail, argv, real, opts);
    this.diagnostics = new Diagnostics((folder, file) => this.resolveFile(folder, file));
    this.status = new StatusBar();
    this.commandsView = new CommandsProvider(this);
    this.choresView = new ChoresProvider(this);
    this.checksView = new ChecksProvider(this);
    this.mcp = new McpRegistration(this.output, () => this.repos);
    this.tests = new CheckTests(this);
    this.tasks = new TaskProvider(this);
    this.busy = false;
    this.sections = new Map();
  }

  log(line) { this.output.appendLine(line); }

  // --- discovery -------------------------------------------------------------------------------------------------------
  personLaunchers() {
    // Only the person's own settings (the user's), never a workspace's: no repository can name what the extension runs.
    const inspected = vscode.workspace.getConfiguration('if-console').inspect('launchers');
    const own = inspected && Array.isArray(inspected.globalValue) ? inspected.globalValue : [];
    return own.filter((x) => typeof x === 'string');
  }

  trusted() { return vscode.workspace.isTrusted !== false; }

  async refresh() {
    const folders = (vscode.workspace.workspaceFolders || []).map((f) => ({ name: f.name, uri: f.uri, root: f.uri.fsPath, raw: f }));
    const found = await discovery.discover({ folders, personLaunchers: this.personLaunchers(), fs: this.deps.fs || nodeFs });
    const repos = [];
    for (const c of found) {
      if (c.status === 'rejected') { this.log(`${c.folder.name}: ${c.reason}`); continue; }
      const repo = new Repository({ folder: c.folder.raw, root: c.root, file: c.file, program: c.program, source: c.source,
        spawn: this.deps.spawn, log: (l) => this.log(l), trusted: () => this.trusted(), env: this.deps.env });
      await repo.load();
      if (repo.state === 'unavailable') { this.log(`${c.folder.name}: not shown as an orchestrator. ${repo.reason}`); continue; }
      repos.push(repo);
    }
    this.repos = repos;
    vscode.commands.executeCommand('setContext', 'if-console.hasRepository', repos.length > 0);
    vscode.commands.executeCommand('setContext', 'if-console.untrusted', !this.trusted());
    this.refreshViews();
    this.mcp.changed();
    await this.tests.rebuild();
    // The health the status bar states comes from `doctor`; it is cheap, and runs only for a trusted repository.
    for (const repo of repos) if (repo.state === 'ready') { await repo.runDoctor(); await this.loadProposals(repo); }
    this.refreshViews();
    return repos;
  }

  async loadProposals(repo) {
    repo.proposals = null;
    if (!repo.has('proposal list')) return;
    try {
      const detail = await repo.detail('proposal list');
      const fields = detail.options.some((o) => o.flag === '--status') ? { status: 'open' } : {};
      const r = await repo.launcher.run(forms.argvFromFields(detail, fields));
      repo.proposals = r.doc && !r.error ? wire.linksOf(r.doc).filter((l) => l.command.split(/\s+/)[0] === 'proposal') : [];
    } catch (e) { repo.proposals = []; }
  }

  refreshViews() {
    this.commandsView.refresh();
    this.choresView.refresh();
    this.checksView.refresh();
    this.status.render(this.activeRepo());
  }

  activeRepo() {
    const ed = vscode.window.activeTextEditor;
    if (ed) { const f = vscode.workspace.getWorkspaceFolder(ed.document.uri); const r = f && this.repos.find((x) => x.key === f.uri.toString()); if (r) return r; }
    return this.repos[0] || null;
  }

  repoForUri(uri) {
    const f = vscode.workspace.getWorkspaceFolder(uri);
    return f ? this.repos.find((x) => x.key === f.uri.toString()) || null : null;
  }

  async chooseRepo(placeholder, filter) {
    const ready = this.repos.filter((r) => r.state === 'ready' && (!filter || filter(r)));
    if (!ready.length) {
      const why = this.repos.find((r) => r.state !== 'ready');
      vscode.window.showInformationMessage(why ? why.reason : 'No folder in this window declares a command line for IF Console (a .if-console.env file at its root).');
      return null;
    }
    if (ready.length === 1) return ready[0];
    testmode.note('quickpick', { title: '', placeholder: placeholder || 'Which repository?', items: ready.map((r) => r.name) });
    const pick = await vscode.window.showQuickPick(ready.map((r) => ({ label: r.name, description: r.folder.name, detail: r.root, repo: r })),
      { placeHolder: placeholder || 'Which repository?', ignoreFocusOut: true });
    return pick ? pick.repo : null;
  }

  async resolveFile(folder, file) {
    const abs = path.resolve(folder.uri.fsPath, file);
    const rel = path.relative(folder.uri.fsPath, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    try { const st = await fs.promises.stat(abs); return st.isFile() ? vscode.Uri.file(abs) : null; } catch (e) { return null; }
  }

  async sectionNames(repo) {
    if (this.sections.has(repo.key)) return this.sections.get(repo.key);
    let names = [];
    try {
      const d = await repo.detail('check');
      const a = d.arguments.find((x) => x.type === 'SECTION' || x.name === 'sections');
      names = (a && a.choices) || [];
    } catch (e) { names = []; }
    this.sections.set(repo.key, names);
    return names;
  }

  // --- results ---------------------------------------------------------------------------------------------------------
  // A check's findings into Problems, section by section; a section that runs again clears its earlier diagnostics (FR-009).
  async handleCheck(repo, doc) {
    const result = wire.checkResult(doc);
    for (const s of result.sections) {
      repo.checks.set(s.name, { status: s.status, findings: s.findings, reason: s.reason });
      const unplaced = await this.diagnostics.setSection(repo.folder, repo.name, s.name, s.status === 'skipped' ? [] : s.findings);
      for (const f of unplaced) this.log(`${s.name}: ${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}`);
      if (s.status === 'skipped') this.log(`${s.name}: skipped${s.reason ? `: ${s.reason}` : ''}`);
    }
    this.refreshViews();
    return result;
  }

  async showResult(repo, detail, argv, real) {
    const doc = real.doc;
    const ok = wire.checkSchema(doc);
    if (!ok.ok) { await this.updateNeeded(repo, ok.message); return; }
    if (doc.kind === 'check') {
      const r = await this.handleCheck(repo, doc);
      const s = r.summary;
      const text = `${repo.name} check: ${s.passed || 0} passed, ${s.failed || 0} failed, ${s.skipped || 0} skipped.`;
      const pick = await (s.failed ? vscode.window.showWarningMessage(text, 'Show Problems') : vscode.window.showInformationMessage(text));
      if (pick === 'Show Problems') vscode.commands.executeCommand('workbench.actions.view.problems');
      return;
    }
    if (doc.kind === 'doctor') { repo.doctor = doc; this.refreshViews(); }
    if (doc.kind === 'fresh') { repo.fresh = doc; this.refreshViews(); }
    if (wire.WRITES.includes(detail.category)) { await this.afterWrite(repo, detail, doc); return; }
    await this.openView(repo, detail, argv);
  }

  async afterWrite(repo, detail, doc) {
    const next = wire.actionsOf(doc).filter((a) => a.enabled).slice(0, 3);
    const text = `${repo.name}: ${detail.id} is done.`;
    const pick = await vscode.window.showInformationMessage(text, ...next.map((a) => a.label));
    const hit = next.find((a) => a.label === pick);
    if (hit) await this.runAction(repo, hit);
    this.refreshViews();
  }

  async updateNeeded(repo, message) {
    this.log(message);
    const pick = await vscode.window.showWarningMessage(message, 'Show Extensions');
    if (pick === 'Show Extensions') vscode.commands.executeCommand('workbench.extensions.action.checkForUpdates');
  }

  // A read command's HTML rendering in a webview (FR-011).
  async openView(repo, detail, argv) {
    const r = await repo.launcher.run(argv, { format: 'html' });
    if (r.failed || !r.stdout) { this.log(`${detail.id}: the command line gave no rendering (${r.failed || `exit ${r.exit}`}).`); return; }
    openHtmlView({ repo, title: `${repo.name}: ${argv.join(' ')}`, html: r.stdout, output: this.output,
      onCommand: (words) => this.runWords(repo, words) });
  }

  // A command named by words (from a link): run it through the one path, with its values already given.
  async runWords(repo, words) {
    const c = repo.list.commands.filter(wire.exposed).sort((a, b) => b.words.length - a.words.length)
      .find((x) => x.words.every((w, i) => words[i] === w));
    if (!c) { this.log(`A link named "${words.join(' ')}", which is not a command this repository exposes to the editor.`); return null; }
    const detail = await repo.detail(c.id);
    return executor.runArgv(this.ui, repo, detail, words);
  }

  // --- commands --------------------------------------------------------------------------------------------------------
  async pickCommand(repo, filter) {
    const { nouns, repoWide } = repo.nouns();
    const items = [];
    const add = (label, cmds) => {
      const kept = cmds.filter((c) => !filter || filter(c));
      if (!kept.length) return;
      items.push({ label, kind: vscode.QuickPickItemKind.Separator });
      for (const c of kept) items.push({ label: c.id, description: c.category, detail: c.help, id: c.id });
    };
    add(`${repo.name}: repository-wide`, repoWide);
    for (const [noun, cmds] of nouns) add(`${repo.name}: ${noun}`, cmds);
    testmode.note('quickpick', { title: '', placeholder: 'Which command?', items: items.filter((i) => i.kind !== vscode.QuickPickItemKind.Separator).map((i) => i.label) });
    const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Which command?', matchOnDescription: true, matchOnDetail: true, ignoreFocusOut: true });
    return pick ? pick.id : null;
  }

  async runCommandPalette() {
    const repo = await this.chooseRepo();
    if (!repo) return null;
    const id = await this.pickCommand(repo);
    return id ? this.runForm(repo, id) : null;
  }

  async runForm(repo, id, presets, only) {
    const c = repo.command(id);
    if (!c || !wire.exposed(c)) { this.log(`${id} is not a command this repository exposes to the editor.`); return null; }
    try { return await executor.runForm(this.ui, repo, id, presets, only); } catch (e) { this.fail(e); return null; }
  }

  fail(e) {
    const words = e instanceof wire.WireError ? e.message : `Something went wrong inside IF Console: ${e.message}`;
    this.log(words);
    vscode.window.showErrorMessage(words, 'Show Output').then((p) => { if (p) this.output.show(true); });
  }

  async runRepoWide(name, { form } = {}) {
    const repo = await this.chooseRepo();
    if (!repo) return null;
    if (!repo.has(name)) { vscode.window.showInformationMessage(`${repo.name} has no "${name}" command.`); return null; }
    if (form) return this.runForm(repo, name);
    try { const detail = await repo.detail(name); return await executor.runArgv(this.ui, repo, detail, [name]); } catch (e) { this.fail(e); return null; }
  }

  async runAction(repo, action) {
    if (!action.enabled) { vscode.window.showInformationMessage(`${action.label} cannot run now: ${action.reason || 'the command line says it is unavailable'}.`); return null; }
    try {
      const detail = await repo.detail(action.command);
      if (action.needs && action.needs.length) return await executor.runForm(this.ui, repo, detail, action.fields, action.needs);
      return await executor.runArgv(this.ui, repo, detail, forms.argvFromFields(detail, action.fields));
    } catch (e) { this.fail(e); return null; }
  }

  async activateNode(node) {
    if (!(node instanceof Node)) return null;      // only what the views hand over: nothing a caller can invent
    const repo = node.repo;
    const d = node.data;
    switch (node.kind) {
      case 'command': return this.runForm(repo, d.command.id);
      case 'resource': case 'link': return this.openResource(repo, d.link);
      case 'action': return this.runAction(repo, d.action);
      case 'section': return this.runSections(repo, [d.name]);
      case 'chore': {
        const c = d.chore;
        if (c.kind === 'command') return this.runForm(repo, c.command);
        if (c.kind === 'action') return this.runAction(repo, c.action);
        if (c.kind === 'section') return this.runSections(repo, [c.section]);
        if (c.kind === 'resource') return this.openResource(repo, c.link);
        if (c.kind === 'ext') return vscode.commands.executeCommand(c.command);
        return null;
      }
      default: return null;
    }
  }

  async openResource(repo, link) {
    try {
      const detail = await repo.detail(link.command);
      return await this.openView(repo, detail, forms.argvFromFields(detail, link.fields));
    } catch (e) { this.fail(e); return null; }
  }

  // `check SECTION --json` for each section; used by the views, the test controller and the tasks (FR-010).
  async runSections(repo, names, { signal, write } = {}) {
    const results = [];
    for (const name of names) {
      const r = await repo.launcher.run(['check', name], { signal });
      if (r.cancelled) break;
      if (!r.doc || r.error) { results.push({ name, failed: true, message: r.error ? r.error.message : (r.failed || `exit ${r.exit}`) }); continue; }
      const ok = wire.checkSchema(r.doc);
      if (!ok.ok) { await this.updateNeeded(repo, ok.message); break; }
      const result = await this.handleCheck(repo, r.doc);
      for (const s of result.sections) { results.push(s); if (write) write(s); }
    }
    return results;
  }

  async checkOnSave(document) {
    const on = vscode.workspace.getConfiguration('if-console').get('checkOnSave');
    if (!on || this.busy || !this.trusted()) return;
    const repo = this.repoForUri(document.uri);
    if (!repo || repo.state !== 'ready' || !repo.has('check')) return;
    this.busy = true;
    try {
      const r = await repo.launcher.run(['check', '--changed']);
      if (r.doc && !r.error && wire.checkSchema(r.doc).ok) await this.handleCheck(repo, r.doc);
    } finally { this.busy = false; }
  }

  async showCommandLine() {
    const repo = await this.chooseRepo();
    if (!repo) return;
    const id = await this.pickCommand(repo);
    if (!id) return;
    try {
      const detail = await repo.detail(id);
      const got = await forms.collect(this.ui, detail, (s, d) => repo.choicesFor(s, d), null);
      if (got.cancelled) return;
      const line = repo.launcher.line(forms.argvFromFields(detail, got.values));
      const pick = await vscode.window.showInformationMessage(line, 'Copy');
      if (pick === 'Copy') await this.ui.copy(line);
    } catch (e) { this.fail(e); }
  }

  async openViewCommand() {
    const repo = await this.chooseRepo();
    if (!repo) return;
    const id = await this.pickCommand(repo, (c) => c.category === 'read');
    if (!id) return;
    try {
      const detail = await repo.detail(id);
      const got = await forms.collect(this.ui, detail, (s, d) => repo.choicesFor(s, d), null);
      if (!got.cancelled) await this.openView(repo, detail, forms.argvFromFields(detail, got.values));
    } catch (e) { this.fail(e); }
  }

  // --- learning (FR-031) -----------------------------------------------------------------------------------------------
  // The topics the repository's `help` command lists, as a quick pick; a topic is shown as a resource with its steps as buttons.
  async learn() {
    const repo = await this.chooseRepo('Which repository do you want to learn about?', (r) => r.has('help'));
    if (!repo) return null;
    const listed = await repo.launcher.run(['help']);
    const ok = listed.doc && !listed.error ? wire.checkSchema(listed.doc) : { ok: false, message: listed.error ? listed.error.message : `${repo.program} gave no help topics.` };
    if (!ok.ok) { vscode.window.showInformationMessage(ok.message); return null; }
    const topics = learn.topicsOf(listed.doc);
    if (!topics.length) { vscode.window.showInformationMessage(`${repo.name} lists no help topics.`); return null; }
    const picked = await this.ui.pick({ title: 'Learn', placeholder: `${repo.name}: which topic?`,
      items: topics.map((t) => ({ label: t.topic, description: t.summary, value: t.topic })) });
    return picked === undefined ? null : this.openTopic(repo, picked);
  }

  async openTopic(repo, topic) {
    const r = await repo.launcher.run(['help', topic]);
    const ok = r.doc && !r.error ? wire.checkSchema(r.doc) : { ok: false, message: r.error ? r.error.message : `${repo.program} gave no help for ${topic}.` };
    if (!ok.ok) { vscode.window.showInformationMessage(ok.message); return null; }
    const steps = learn.stepsOf(r.doc);
    return openHtmlView({ repo, title: `${repo.name}: ${topic}`, html: learn.topicPage(r.doc), output: this.output,
      onCommand: (words) => this.runWords(repo, words),
      onStep: async (i) => { const step = steps[i]; if (step && step.runnable) await this.runAction(repo, step.action); } });
  }

  // What the test hook reads (FR-033): what this holds, read-only.
  async snapshot() {
    const open = ['repo', 'wide', 'group'];
    const labels = async (provider, node) => {
      const out = [];
      for (const k of await provider.getChildren(node)) {
        const item = provider.getTreeItem(k);
        const entry = { kind: k.kind, label: String(item.label), description: item.description ? String(item.description) : '' };
        if (open.includes(k.kind)) entry.children = await labels(provider, k);
        out.push(entry);
      }
      return out;
    };
    return {
      repositories: this.repos.map((r) => ({ name: r.name, audience: r.audience, state: r.state, folder: r.folder.name, root: r.root, health: r.health })),
      views: { commands: await labels(this.commandsView), chores: await labels(this.choresView), checks: await labels(this.checksView) },
      mcp: { supported: mcpmod.supported(), registered: this.mcp.disposable !== null,
        servers: mcpmod.definitions(this.repos).map((d) => ({ label: d.label, command: d.command, args: d.args })) },
    };
  }

  // --- context and help (FR-018) ---------------------------------------------------------------------------------------
  async pickResource(repo, node) {
    if (node && node.data && node.data.link) {
      const l = node.data.link;
      const kind = l.command.split(/\s+/)[0];
      const id = Object.values(l.fields || {})[0];
      if (id !== undefined) return `${kind}:${id}`;
    }
    if (!repo.has('context')) return null;
    const detail = await repo.detail('context');
    const arg = detail.arguments[0];
    const kinds = (arg && arg.choices || []).filter((c) => c.endsWith(':'));
    if (kinds.length) {
      const kind = await vscode.window.showQuickPick(kinds.map((k) => ({ label: k.slice(0, -1), value: k.slice(0, -1) })), { placeHolder: 'What kind of resource?', ignoreFocusOut: true });
      if (!kind) return null;
      const ids = await this.idsOfKind(repo, kind.value);
      if (ids.length) {
        const id = await vscode.window.showQuickPick(ids, { placeHolder: `Which ${kind.value}?`, ignoreFocusOut: true });
        return id ? `${kind.value}:${id}` : null;
      }
      const typed = await vscode.window.showInputBox({ prompt: `The ${kind.value}'s id`, ignoreFocusOut: true });
      return typed ? `${kind.value}:${typed}` : null;
    }
    const typed = await vscode.window.showInputBox({ prompt: arg ? arg.help || arg.type : 'The resource', ignoreFocusOut: true });
    return typed || null;
  }

  async idsOfKind(repo, kind) {
    const noun = kind.replace(/_/g, '-');
    if (!repo.nouns().nouns.has(noun) && !repo.has(`${noun} list`)) return [];
    const links = await repo.resources(noun, 500);
    return links.map((l) => String(Object.values(l.fields)[0]));
  }

  async deliver(text, language) {
    const where = await vscode.window.showQuickPick([{ label: 'Copy to the clipboard', value: 'clip' }, { label: 'Open in an untitled editor', value: 'editor' }],
      { placeHolder: 'Where should it go? Nothing is sent anywhere.', ignoreFocusOut: true });
    if (!where) return;
    if (where.value === 'clip') { await vscode.env.clipboard.writeText(text); vscode.window.showInformationMessage('It is on the clipboard.'); return; }
    const doc = await vscode.workspace.openTextDocument({ language: language || 'markdown', content: text });
    await vscode.window.showTextDocument(doc);
  }

  async copyContext(node) {
    const repo = node instanceof Node ? node.repo : await this.chooseRepo('Which repository?');
    if (!repo) return;
    if (!repo.has('context')) { vscode.window.showInformationMessage(`${repo.name} has no "context" command.`); return; }
    const resource = await this.pickResource(repo, node instanceof Node ? node : null);
    if (!resource) return;
    const r = await repo.launcher.run(['context', resource]);
    if (!r.doc || r.error) { vscode.window.showErrorMessage(r.error ? r.error.message : `${repo.program} gave no context for ${resource}.`); return; }
    await this.deliver(context.redact(JSON.stringify(r.doc, null, 2), process.env.HOME), 'json');
  }

  async getHelp() {
    const repo = await this.chooseRepo();
    if (!repo) return;
    const doctor = (await repo.runDoctor()).doc;
    let contextDoc = null;
    if (repo.has('context') && (await vscode.window.showQuickPick(['Add a resource to the report', 'Only the health report'], { placeHolder: 'What is the help about?', ignoreFocusOut: true })) === 'Add a resource to the report') {
      const resource = await this.pickResource(repo, null);
      if (resource) contextDoc = (await repo.launcher.run(['context', resource])).doc;
    }
    const text = context.helpReport({ program: repo.program, orchestrator: repo.name, audience: repo.audience, contextDoc, doctorDoc: doctor, home: process.env.HOME });
    await this.deliver(text, 'markdown');
  }

  // --- registration ----------------------------------------------------------------------------------------------------
  register() {
    const ctx = this.context;
    const sub = (d) => ctx.subscriptions.push(d);
    const cmd = (id, fn) => sub(vscode.commands.registerCommand(`if-console.${id}`, (...a) => Promise.resolve(fn(...a)).catch((e) => this.fail(e))));
    sub(this.output); sub(this.status); sub(this.diagnostics); sub(this.docs); sub(this.mcp); sub(this.tests);
    sub(vscode.workspace.registerTextDocumentContentProvider(SCHEME, this.docs));
    sub(vscode.window.createTreeView('if-console.commands', { treeDataProvider: this.commandsView, showCollapseAll: true }));
    sub(vscode.window.createTreeView('if-console.chores', { treeDataProvider: this.choresView }));
    sub(vscode.window.createTreeView('if-console.checks', { treeDataProvider: this.checksView, showCollapseAll: true }));
    sub(vscode.tasks.registerTaskProvider('if-console', this.tasks));

    cmd('runCommand', () => this.runCommandPalette());
    cmd('check', () => this.runRepoWide('check', { form: true }));
    cmd('fresh', () => this.runRepoWide('fresh'));
    cmd('test', () => this.runRepoWide('test'));
    cmd('doctor', () => this.runRepoWide('doctor'));
    cmd('showCommandLine', () => this.showCommandLine());
    cmd('getHelp', () => this.getHelp());
    cmd('learn', () => this.learn());
    cmd('copyContext', (node) => this.copyContext(node));
    cmd('openView', () => this.openViewCommand());
    cmd('refresh', () => this.refresh());
    cmd('showOutput', () => this.output.show(true));
    cmd('trust', () => vscode.commands.executeCommand('workbench.trust.manage'));
    cmd('activateNode', (node) => this.activateNode(node));
    cmd('runSection', (node) => (node instanceof Node && node.kind === 'section' ? this.runSections(node.repo, [node.data.name]) : null));

    sub(vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()));
    sub(vscode.workspace.onDidGrantWorkspaceTrust(() => this.refresh()));
    sub(vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration('if-console.launchers')) this.refresh(); }));
    sub(vscode.workspace.onDidSaveTextDocument((d) => this.checkOnSave(d)));
    sub(vscode.window.onDidChangeActiveTextEditor(() => this.status.render(this.activeRepo())));
    const watcher = vscode.workspace.createFileSystemWatcher('**/.if-console.env');
    sub(watcher); sub(watcher.onDidChange(() => this.refresh())); sub(watcher.onDidCreate(() => this.refresh())); sub(watcher.onDidDelete(() => this.refresh()));
    this.mcp.start();
    testmode.install(this.context, () => this.snapshot());
    sub({ dispose: () => testmode.uninstall() });
  }
}

module.exports = { App };
