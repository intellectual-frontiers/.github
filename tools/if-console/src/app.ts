// The extension's one object: the repositories found in the workspace folders and the services around them (the log, the Problems
// diagnostics, the status bar, the views, the tests, the tasks and the MCP registration). It holds no rule of any orchestrator; a command's
// own result is whatever the launcher returned. The handlers of the commands the manifest contributes are in commands/.
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { TaskProvider } from './commands/tasks';
import { argvFromFields } from './model/forms';
import { asString } from './model/json';
import { checkResult, checkSchema, linksOf, WireError, type CheckResult, type Doc } from './model/wire';
import { Diagnostics } from './services/diagnostics';
import { discover, type DiscoveryFs } from './services/discovery';
import type { Ui } from './services/executor';
import type { Cancellation, SpawnFn } from './services/launcher';
import { createLog, type Log } from './services/log';
import { definitions, McpRegistration, supported as mcpSupported } from './services/mcp';
import { Repository } from './services/repository';
import { isTrusted, onDidGrantTrust } from './services/trust';
import { watchRepositories } from './services/watch';
import * as testMode from './test-mode';
import { ChecksProvider } from './views/checks-tree';
import { ChoresProvider } from './views/chores-tree';
import { CommandsProvider } from './views/commands-tree';
import type { Node } from './views/node';
import { StatusBar } from './views/status';
import { CheckTests, type SectionOutcome } from './views/test-controller';
import { createUi, DiffDocuments, SCHEME } from './views/ui';
import { openHtmlView } from './views/webview';

/** What the app needs of VS Code's extension context: where to put what it must dispose, and whether this is a test host. */
export type AppContext = { subscriptions: vscode.Disposable[] } & NonNullable<Parameters<typeof testMode.install>[0]>;

export interface AppDeps { fs?: DiscoveryFs; spawn?: SpawnFn; env?: NodeJS.ProcessEnv }

const nodeFs: DiscoveryFs = {
  async readFile(p: string): Promise<string | null> { try { return await fs.promises.readFile(p, 'utf8'); } catch { return null; } },
  async isExecutable(p: string): Promise<boolean> {
    try {
      const st = await fs.promises.stat(p);
      if (!st.isFile()) return false;
      await fs.promises.access(p, fs.constants.X_OK);
      return true;
    } catch { return false; }
  },
};

export class App {
  repos: Repository[] = [];
  readonly log: Log;
  readonly docs = new DiffDocuments();
  readonly ui: Ui;
  readonly diagnostics: Diagnostics;
  readonly status = new StatusBar();
  readonly commandsView: CommandsProvider;
  readonly choresView: ChoresProvider;
  readonly checksView: ChecksProvider;
  readonly mcp: McpRegistration;
  readonly tests: CheckTests;
  readonly tasks: TaskProvider;
  private busy = false;
  private readonly sections = new Map<string, string[]>();

  constructor(readonly context: AppContext, private readonly deps: AppDeps = {}) {
    this.log = createLog();
    this.ui = createUi({ docs: this.docs, log: this.log, showResult: (repo, detail, argv, real) => this.commands.showResult(repo, detail, argv, real) });
    this.diagnostics = new Diagnostics((folder, file) => this.resolveFile(folder, file));
    this.commandsView = new CommandsProvider(this);
    this.choresView = new ChoresProvider(this);
    this.checksView = new ChecksProvider(this);
    this.mcp = new McpRegistration(this.log, () => this.repos);
    this.tests = new CheckTests(this);
    this.tasks = new TaskProvider(this);
  }

  /** The command handlers, made once the app exists. */
  readonly commands = registerCommands(this);

  trusted(): boolean { return isTrusted(); }

  // --- discovery ---------------------------------------------------------------------------------------------------------
  /** Only the person's own settings (the user's), never a workspace's: no repository can name what the extension runs. */
  personLaunchers(): string[] {
    const inspected = vscode.workspace.getConfiguration('if-console').inspect<string[]>('launchers');
    const own = inspected && Array.isArray(inspected.globalValue) ? inspected.globalValue : [];
    return own.filter((x): x is string => typeof x === 'string');
  }

  async refresh(): Promise<Repository[]> {
    const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => ({ name: f.name, root: f.uri.fsPath, raw: f }));
    const found = await discover({ folders, personLaunchers: this.personLaunchers(), fs: this.deps.fs ?? nodeFs });
    const repos: Repository[] = [];
    for (const c of found) {
      if (c.status === 'rejected' || !c.file || !c.program) { this.log.info(`${c.folder.name}: ${c.reason ?? 'not a launcher'}`); continue; }
      const repo = new Repository({ folder: c.folder.raw, root: c.root, file: c.file, program: c.program, source: c.source,
        spawn: this.deps.spawn, log: (l) => this.log.info(l), trusted: () => this.trusted(), env: this.deps.env });
      await repo.load();
      if (repo.state === 'unavailable') { this.log.info(`${c.folder.name}: not shown as an orchestrator. ${repo.reason}`); continue; }
      repos.push(repo);
    }
    this.repos = repos;
    this.sections.clear();
    void vscode.commands.executeCommand('setContext', 'if-console.hasRepository', repos.length > 0);
    void vscode.commands.executeCommand('setContext', 'if-console.untrusted', !this.trusted());
    this.watchers.set(repos);
    this.refreshViews();
    this.mcp.changed();
    await this.tests.rebuild();
    // The health the status bar states comes from `doctor`; it is cheap, and runs only for a trusted repository.
    for (const repo of repos) if (repo.state === 'ready') { await repo.runDoctor(); await this.loadProposals(repo); }
    this.refreshViews();
    return repos;
  }

  /** The launcher or its declaration changed on disk: one repository is asked again, the others are left alone. */
  async reload(repo: Repository): Promise<void> {
    this.sections.delete(repo.key);
    await repo.load();
    if (repo.state === 'ready') { await repo.runDoctor(); await this.loadProposals(repo); }
    this.refreshViews();
    this.mcp.changed();
    await this.tests.rebuild();
  }

  private readonly watchers = watchRepositories((repo) => { repo.invalidate(); return this.reload(repo); });

  async loadProposals(repo: Repository): Promise<void> {
    repo.proposals = null;
    if (!repo.has('proposal list')) return;
    try {
      const detail = await repo.detail('proposal list');
      const fields = detail.options.some((o) => o.flag === '--status') ? { status: 'open' } : {};
      const r = await repo.launcher.run(argvFromFields(detail, fields));
      repo.proposals = r.doc && !r.error ? linksOf(r.doc).filter((l) => l.command.split(/\s+/)[0] === 'proposal') : [];
    } catch { repo.proposals = []; }
  }

  refreshViews(): void {
    this.commandsView.refresh();
    this.choresView.refresh();
    this.checksView.refresh();
    this.status.render(this.activeRepo());
  }

  activeRepo(): Repository | null {
    const ed = vscode.window.activeTextEditor;
    if (ed) {
      const f = vscode.workspace.getWorkspaceFolder(ed.document.uri);
      const r = f ? this.repos.find((x) => x.key === f.uri.toString()) : undefined;
      if (r) return r;
    }
    return this.repos[0] ?? null;
  }

  repoForUri(uri: vscode.Uri): Repository | null {
    const f = vscode.workspace.getWorkspaceFolder(uri);
    return f ? this.repos.find((x) => x.key === f.uri.toString()) ?? null : null;
  }

  async resolveFile(folder: vscode.WorkspaceFolder, file: string): Promise<vscode.Uri | null> {
    const abs = path.resolve(folder.uri.fsPath, file);
    const rel = path.relative(folder.uri.fsPath, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    try { const st = await fs.promises.stat(abs); return st.isFile() ? vscode.Uri.file(abs) : null; } catch { return null; }
  }

  async sectionNames(repo: Repository): Promise<string[]> {
    const held = this.sections.get(repo.key);
    if (held) return held;
    const names = await repo.detail('check').then((d) => d.arguments.find((x) => x.type === 'SECTION' || x.name === 'sections')?.choices ?? [], () => []);
    this.sections.set(repo.key, names);
    return names;
  }

  // --- results -----------------------------------------------------------------------------------------------------------
  /** A check's findings into Problems, section by section; a section that runs again clears its earlier diagnostics (FR-009). */
  async handleCheck(repo: Repository, doc: Doc): Promise<CheckResult> {
    const result = checkResult(doc);
    for (const s of result.sections) {
      repo.checks.set(s.name, { status: s.status, findings: s.findings, reason: s.reason });
      const unplaced = await this.diagnostics.setSection(repo.folder, repo.name, s.name, s.status === 'skipped' ? [] : s.findings);
      for (const f of unplaced) this.log.info(`${s.name}: ${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}`);
      if (s.status === 'skipped') this.log.info(`${s.name}: skipped${s.reason ? `: ${s.reason}` : ''}`);
    }
    this.refreshViews();
    return result;
  }

  async updateNeeded(message: string): Promise<void> {
    this.log.info(message);
    const pick = await vscode.window.showWarningMessage(message, 'Show Extensions');
    if (pick === 'Show Extensions') void vscode.commands.executeCommand('workbench.extensions.action.checkForUpdates');
  }

  /** `check SECTION --json` for each section; used by the views, the test controller and the tasks (FR-010). */
  async runSections(repo: Repository, names: string[], { token, write }: { token?: Cancellation; write?: (s: SectionOutcome) => void } = {}): Promise<SectionOutcome[]> {
    const results: SectionOutcome[] = [];
    for (const name of names) {
      const r = await repo.launcher.run(['check', name], { token });
      if (r.cancelled) break;
      if (!r.doc || r.error) { results.push({ name, failed: true, message: r.error ? r.error.message : (r.failed ?? `exit ${String(r.exit)}`) }); continue; }
      const ok = checkSchema(r.doc);
      if (!ok.ok) { await this.updateNeeded(ok.message); break; }
      const result = await this.handleCheck(repo, r.doc);
      for (const s of result.sections) { results.push(s); if (write) write(s); }
    }
    return results;
  }

  async checkOnSave(document: vscode.TextDocument): Promise<void> {
    const on = vscode.workspace.getConfiguration('if-console').get<boolean>('checkOnSave');
    if (!on || this.busy || !this.trusted()) return;
    const repo = this.repoForUri(document.uri);
    if (!repo || repo.state !== 'ready' || !repo.has('check')) return;
    this.busy = true;
    try {
      const r = await repo.launcher.run(['check', '--changed']);
      if (r.doc && !r.error && checkSchema(r.doc).ok) await this.handleCheck(repo, r.doc);
    } finally { this.busy = false; }
  }

  openHtml(repo: Repository, title: string, html: string, onStep?: (i: number) => Promise<unknown>): vscode.WebviewPanel {
    return openHtmlView({ repo, title, html, log: this.log, onCommand: (words) => this.commands.runWords(repo, words), onStep });
  }

  fail(e: unknown): void {
    const words = e instanceof WireError ? e.message : `Something went wrong inside IF Console: ${e instanceof Error ? e.message : asString(e)}`;
    this.log.error(words);
    void Promise.resolve(vscode.window.showErrorMessage(words, 'Show Output')).then((p) => { if (p) this.log.show(true); });
  }

  // --- the test hook's snapshot (FR-033): what this holds, read-only ---------------------------------------------------------
  async snapshot(): Promise<unknown> {
    const open = ['repo', 'wide', 'group'];
    interface Entry { kind: string; label: string; description: string; children?: Entry[] }
    const labels = async (provider: CommandsProvider | ChoresProvider | ChecksProvider, node?: Node): Promise<Entry[]> => {
      const out: Entry[] = [];
      for (const k of await provider.getChildren(node)) {
        const item = provider.getTreeItem(k);
        const label = typeof item.label === 'string' ? item.label : item.label?.label ?? '';
        const entry: Entry = { kind: k.kind, label, description: item.description ? String(item.description) : '' };
        if (open.includes(k.kind)) entry.children = await labels(provider, k);
        out.push(entry);
      }
      return out;
    };
    return {
      repositories: this.repos.map((r) => ({ name: r.name, audience: r.audience, state: r.state, folder: r.folder.name, root: r.root, health: r.health })),
      views: { commands: await labels(this.commandsView), chores: await labels(this.choresView), checks: await labels(this.checksView) },
      mcp: { supported: mcpSupported(), registered: this.mcp.disposable !== null,
        servers: definitions(this.repos).map((d) => ({ label: d.label, command: d.command, args: d.args })) },
    };
  }

  // --- registration ------------------------------------------------------------------------------------------------------
  register(): void {
    const sub = (d: vscode.Disposable): number => this.context.subscriptions.push(d);
    sub(this.log); sub(this.status); sub(this.diagnostics); sub(this.docs); sub(this.mcp); sub(this.tests); sub(this.watchers);
    sub(vscode.workspace.registerTextDocumentContentProvider(SCHEME, this.docs));
    sub(vscode.window.createTreeView('if-console.commands', { treeDataProvider: this.commandsView, showCollapseAll: true }));
    sub(vscode.window.createTreeView('if-console.chores', { treeDataProvider: this.choresView }));
    sub(vscode.window.createTreeView('if-console.checks', { treeDataProvider: this.checksView, showCollapseAll: true }));
    sub(vscode.tasks.registerTaskProvider('if-console', this.tasks));
    this.commands.register(sub);
    const again = (): void => { void this.refresh(); };
    sub(vscode.workspace.onDidChangeWorkspaceFolders(again));
    sub(onDidGrantTrust(again));
    sub(vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration('if-console.launchers')) again(); }));
    // VS Code ignores a listener's result; the promise is returned so that a test can wait for the check to end.
    sub(vscode.workspace.onDidSaveTextDocument((d) => this.checkOnSave(d)));
    sub(vscode.window.onDidChangeActiveTextEditor(() => this.status.render(this.activeRepo())));
    const declaration = vscode.workspace.createFileSystemWatcher('**/.if-console.env');
    sub(declaration); sub(declaration.onDidChange(again)); sub(declaration.onDidCreate(again)); sub(declaration.onDidDelete(again));
    this.mcp.start();
    testMode.install(this.context, () => this.snapshot());
    sub({ dispose: () => testMode.uninstall() });
  }
}
