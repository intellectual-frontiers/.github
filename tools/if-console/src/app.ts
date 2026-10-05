// The extension's one object: the repositories found in the workspace folders and the services around them (the log, the Problems
// diagnostics, the status bar, the views, the tests, the tasks and the MCP registration). It holds no rule of any orchestrator; a command's
// own result is whatever the launcher returned. The handlers of the commands the manifest contributes are in commands/.
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { TaskProvider } from './commands/tasks';
import { argvFromFields } from './model/forms';
import { countOf, deriveHome } from './model/home';
import { asString } from './model/json';
import { planViews, SLOTS } from './model/viewplan';
import { checkResult, checkSchema, linksOf, WireError, type CheckResult, type Doc } from './model/wire';
import { Diagnostics } from './services/diagnostics';
import { discover, type DiscoveryFs } from './services/discovery';
import type { Ui } from './services/executor';
import { Handles } from './services/handles';
import type { Cancellation, SpawnFn } from './services/launcher';
import { createLog, type Log } from './services/log';
import { definitions, McpRegistration, supported as mcpSupported } from './services/mcp';
import { ResourceOpener } from './services/opener';
import { Repository } from './services/repository';
import { Running } from './services/running';
import { isTrusted, onDidGrantTrust } from './services/trust';
import { watchRepositories } from './services/watch';
import * as testMode from './test-mode';
import { ChecksProvider } from './views/checks-tree';
import { CommandsProvider } from './views/commands-tree';
import { FileDecorations } from './views/decorations';
import { HomeProvider } from './views/home-tree';
import { ReferenceLanguage } from './views/language';
import type { Node } from './views/node';
import { ResourceProvider } from './views/resource-tree';
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

const VIEW_IDS = { home: 'if-console.home', checks: 'if-console.checks', commands: 'if-console.commands' } as const;
export const slotId = (n: number): string => `if-console.view.${n}`;

export class App {
  repos: Repository[] = [];
  readonly log: Log;
  readonly docs = new DiffDocuments();
  readonly handles = new Handles();
  readonly running = new Running((n) => { void vscode.commands.executeCommand('setContext', 'if-console.running', n > 0); });
  readonly ui: Ui;
  readonly diagnostics: Diagnostics;
  readonly decorations: FileDecorations;
  readonly status: StatusBar;
  readonly homeView: HomeProvider;
  readonly commandsView: CommandsProvider;
  readonly checksView: ChecksProvider;
  readonly slots: ResourceProvider[] = [];
  readonly treeViews = new Map<string, vscode.TreeView<Node>>();
  readonly mcp: McpRegistration;
  readonly tests: CheckTests;
  readonly tasks: TaskProvider;
  readonly language: ReferenceLanguage;
  readonly opener: ResourceOpener;
  private busy = false;
  private readonly sections = new Map<string, string[]>();
  /** The view that started the work in hand, so that its progress is shown there (0043 FR-038). */
  private origin: string | null = null;
  private allCommands = false;
  private unavailable = 0;
  private unavailableMissing = false;
  /** The suggestion Home last revealed when the status bar or a notice asked for the suggestions, for the test hook's snapshot. */
  private revealed: string | null = null;

  constructor(readonly context: AppContext, private readonly deps: AppDeps = {}) {
    this.log = createLog();
    this.status = new StatusBar(this.handles);
    this.ui = createUi({ docs: this.docs, log: this.log, where: () => this.origin, running: this.running,
      showResult: (repo, detail, argv, real) => this.commands.showResult(repo, detail, argv, real) });
    this.diagnostics = new Diagnostics((folder, file) => this.resolveFile(folder, file));
    this.decorations = new FileDecorations(this.diagnostics);
    this.homeView = new HomeProvider(this);
    this.commandsView = new CommandsProvider(this);
    this.checksView = new ChecksProvider(this);
    for (let i = 0; i < SLOTS; i += 1) this.slots.push(new ResourceProvider(this, i));
    this.mcp = new McpRegistration(this.log, () => this.repos);
    this.tests = new CheckTests(this);
    this.tasks = new TaskProvider(this);
    this.language = new ReferenceLanguage(this);
    this.opener = new ResourceOpener({ render: (repo, title, argv) => this.renderHtml(repo, title, argv) }, this.log, (e) => this.fail(e));
  }

  /** The command handlers, made once the app exists. */
  readonly commands = registerCommands(this);

  trusted(): boolean { return isTrusted(); }

  /** The most rows of one noun a view lists: the setting `if-console.rowLimit`. */
  rowLimit(): number {
    const n = vscode.workspace.getConfiguration('if-console').get<number>('rowLimit');
    return typeof n === 'number' && n >= 10 ? Math.floor(n) : 200;
  }

  /** Run something started from a view, so that its progress is shown in that view. */
  async fromView<T>(view: string | undefined, fn: () => Promise<T>): Promise<T> {
    const was = this.origin;
    this.origin = view ?? null;
    try { return await fn(); } finally { this.origin = was; }
  }

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
    this.unavailable = 0;
    this.unavailableMissing = false;
    for (const c of found) {
      if (c.status === 'rejected' || !c.file || !c.program) { this.log.info(`${c.folder.name}: ${c.reason ?? 'not a launcher'}`); continue; }
      const repo = new Repository({ folder: c.folder.raw, root: c.root, file: c.file, program: c.program, source: c.source,
        spawn: this.deps.spawn, log: (l) => this.log.info(l), trusted: () => this.trusted(), env: this.deps.env });
      await repo.load();
      if (repo.state === 'unavailable') { this.unavailable += 1; this.unavailableMissing = this.unavailableMissing || repo.missing; this.log.info(`${c.folder.name}: not shown as an orchestrator. ${repo.reason}`); continue; }
      repos.push(repo);
    }
    this.repos = repos;
    this.sections.clear();
    this.handles.clear();
    void vscode.commands.executeCommand('setContext', 'if-console.hasRepository', repos.length > 0);
    void vscode.commands.executeCommand('setContext', 'if-console.untrusted', !this.trusted());
    this.watchers.set(repos);
    this.refreshViews();
    this.mcp.changed();
    this.language.register(repos);
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
    this.language.register(this.repos);
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

  /** Every view, the badges, the contexts the manifest's `when` clauses read, and the status bar are drawn again from what the repositories hold. */
  refreshViews(): void {
    this.applyPlan();
    this.homeView.refresh();
    this.commandsView.refresh();
    this.checksView.refresh();
    for (const slot of this.slots) slot.refresh();
    this.decorations.refreshRows();
    this.updateBadges();
    this.updateContexts();
    this.status.render(this.activeRepo(), this.activeRepo() ? deriveHome(this.activeRepo() as Repository).needs : []);
  }

  /** The views the command lines declare, merged by id, one in each slot of the manifest's pool. */
  private applyPlan(): void {
    const plan = planViews(this.repos, SLOTS);
    this.slots.forEach((slot, i) => {
      const p = plan[i] ?? null;
      slot.setPlan(p);
      const view = this.treeViews.get(slotId(i));
      if (view) { view.title = p?.title ?? ''; view.description = undefined; view.message = undefined; }
      void vscode.commands.executeCommand('setContext', `if-console.slot.${i}`, p !== null);
    });
  }

  private updateBadges(): void {
    const home = this.treeViews.get(VIEW_IDS.home);
    const n = this.homeView.count();
    if (home) home.badge = n ? { value: n, tooltip: `${n} ${n === 1 ? 'thing needs' : 'things need'} you` } : undefined;
    const checks = this.treeViews.get(VIEW_IDS.checks);
    const failed = this.checksView.failed();
    if (checks) checks.badge = failed ? { value: failed, tooltip: `${failed} check ${failed === 1 ? 'section' : 'sections'} failed` } : undefined;
  }

  private updateContexts(): void {
    const set = (k: string, v: boolean): void => { void vscode.commands.executeCommand('setContext', k, v); };
    set('if-console.unavailable', this.unavailable > 0);
    set('if-console.toolchainMissing', this.unavailableMissing);
    set('if-console.allCommands', this.allCommands || vscode.workspace.getConfiguration('if-console').get<boolean>('showAllCommands') === true);
  }

  /** The view-title toggle of the tree of every command: for this session only, since the extension writes no setting. */
  toggleAllCommands(): boolean {
    this.allCommands = !this.allCommands;
    this.updateContexts();
    return this.allCommands;
  }

  /** Open Home; with `suggestions`, the row that most needs a person is revealed and selected, never a silent refresh. */
  async showHome(suggestions: boolean): Promise<void> {
    await vscode.commands.executeCommand('workbench.view.extension.if-console');
    await vscode.commands.executeCommand(`${VIEW_IDS.home}.focus`);
    const view = this.treeViews.get(VIEW_IDS.home);
    if (!suggestions || !view) return;
    await this.homeView.prepare();
    const first = this.homeView.first();
    if (first) {
      this.revealed = first.data.suggestion?.label ?? null;
      try { await view.reveal(first, { select: true, focus: true, expand: true }); } catch { /* the row is gone: the view is open all the same */ }
    }
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

  repoByKey(key: unknown): Repository | null { return typeof key === 'string' ? this.repos.find((r) => r.key === key) ?? null : null; }

  referencesIn(document: vscode.TextDocument): ReturnType<ReferenceLanguage['find']> { return this.language.find(document); }

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

  handleCheckDoc(repo: Repository, doc: Doc): Promise<CheckResult> { return this.handleCheck(repo, doc); }

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

  /** The same, shown as progress where the person started it (in the view of the row they clicked, else a notification) and ended by Stop. */
  runSectionsShown(repo: Repository, names: string[]): Promise<SectionOutcome[]> {
    return this.ui.progress(`${repo.name} check ${names.join(' ')}`, (token) => this.runSections(repo, names, { token }));
  }

  /** `check --changed --json`: only the sections whose watched paths changed, and what they reported. */
  async runChanged(repo: Repository, { token }: { token?: Cancellation } = {}): Promise<SectionOutcome[]> {
    const r = await repo.launcher.run(['check', '--changed'], { token });
    if (r.cancelled) return [];
    if (!r.doc || r.error) return [{ name: 'check --changed', failed: true, message: r.error ? r.error.message : (r.failed ?? `exit ${String(r.exit)}`) }];
    const ok = checkSchema(r.doc);
    if (!ok.ok) { await this.updateNeeded(ok.message); return []; }
    return (await this.handleCheck(repo, r.doc)).sections;
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

  /** The page renderer of a resource: the launcher's own `--html` rendering in a webview (0043 FR-011). The resource panel replaces this. */
  private async renderHtml(repo: Repository, title: string, argv: string[]): Promise<void> {
    const r = await repo.launcher.run(argv, { format: 'html' });
    if (r.failed || !r.stdout) { this.log.info(`${argv.join(' ')}: the command line gave no rendering (${r.failed ?? `exit ${String(r.exit)}`}).`); return; }
    this.openHtml(repo, title, r.stdout);
  }

  fail(e: unknown): void {
    const words = e instanceof WireError ? e.message : `Something went wrong inside IF Console: ${e instanceof Error ? e.message : asString(e)}`;
    this.log.error(words);
    void Promise.resolve(vscode.window.showErrorMessage(words, 'Show Output')).then((p) => { if (p) this.log.show(true); });
  }

  // --- the test hook's snapshot (FR-033): what this holds, read-only ---------------------------------------------------------
  async snapshot(options: Record<string, unknown> = {}): Promise<unknown> {
    const open = ['repo', 'wide', 'group', ...(options.rows === true ? ['nounGroup'] : [])];
    interface Entry { kind: string; label: string; description: string; status?: string; children?: Entry[] }
    const labels = async (provider: { getChildren(n?: Node): Promise<Node[]> | Node[]; getTreeItem(n: Node): vscode.TreeItem }, node?: Node): Promise<Entry[]> => {
      const out: Entry[] = [];
      for (const k of await provider.getChildren(node)) {
        const item = provider.getTreeItem(k);
        const label = typeof item.label === 'string' ? item.label : item.label?.label ?? '';
        const icon = item.iconPath as { id?: string; color?: { id?: string } } | undefined;
        const entry: Entry = { kind: k.kind, label, description: item.description ? String(item.description) : '', status: icon?.color?.id };
        if (open.includes(k.kind)) entry.children = await labels(provider, k);
        out.push(entry);
      }
      return out;
    };
    const slots = [];
    for (const slot of this.slots) if (slot.plan) slots.push({ id: slot.plan.id, slot: slot.viewId, title: slot.plan.title, description: slot.plan.description, entries: await labels(slot) });
    return {
      repositories: this.repos.map((r) => ({ name: r.name, audience: r.audience, state: r.state, folder: r.folder.name, root: r.root, health: r.health })),
      views: { home: await labels(this.homeView), commands: await labels(this.commandsView), checks: await labels(this.checksView), slots },
      badges: { home: this.homeView.count(), checks: this.checksView.failed() },
      status: this.status.last,
      revealed: this.revealed,
      tests: this.tests.describe(),
      needs: this.repos.map((r) => ({ folder: r.folder.name, count: countOf(deriveHome(r).needs), items: deriveHome(r).needs.map((s) => ({ id: s.id, status: s.status, label: s.label, commandLine: s.commandLine, runnable: s.run !== null, yourself: s.yourself })) })),
      mcp: { supported: mcpSupported(), registered: this.mcp.disposable !== null,
        servers: definitions(this.repos).map((d) => ({ label: d.label, command: d.command, args: d.args })) },
    };
  }

  // --- registration ------------------------------------------------------------------------------------------------------
  register(): void {
    const sub = (d: vscode.Disposable): number => this.context.subscriptions.push(d);
    sub(this.log); sub(this.status); sub(this.diagnostics); sub(this.docs); sub(this.mcp); sub(this.tests); sub(this.watchers); sub(this.decorations); sub(this.language);
    sub(vscode.workspace.registerTextDocumentContentProvider(SCHEME, this.docs));
    sub(vscode.window.registerFileDecorationProvider(this.decorations));
    const tree = (id: string, provider: vscode.TreeDataProvider<Node>, collapseAll = false): void => {
      const view = vscode.window.createTreeView(id, { treeDataProvider: provider, showCollapseAll: collapseAll });
      this.treeViews.set(id, view);
      sub(view);
    };
    tree(VIEW_IDS.home, this.homeView, true);
    this.slots.forEach((slot, i) => tree(slotId(i), slot, true));
    tree(VIEW_IDS.checks, this.checksView, true);
    tree(VIEW_IDS.commands, this.commandsView, true);
    sub(vscode.tasks.registerTaskProvider('if-console', this.tasks));
    this.commands.register(sub);
    const again = (): void => { void this.refresh(); };
    sub(vscode.workspace.onDidChangeWorkspaceFolders(again));
    sub(onDidGrantTrust(again));
    sub(vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('if-console.launchers')) again();
      else if (e.affectsConfiguration('if-console')) this.refreshViews();
    }));
    // VS Code ignores a listener's result; the promise is returned so that a test can wait for the check to end.
    sub(vscode.workspace.onDidSaveTextDocument((d) => this.checkOnSave(d)));
    sub(vscode.window.onDidChangeActiveTextEditor(() => { const r = this.activeRepo(); this.status.render(r, r ? deriveHome(r).needs : []); }));
    const declaration = vscode.workspace.createFileSystemWatcher('**/.if-console.env');
    sub(declaration); sub(declaration.onDidChange(again)); sub(declaration.onDidCreate(again)); sub(declaration.onDidDelete(again));
    this.mcp.start();
    testMode.install(this.context, (o) => this.snapshot(o));
    sub({ dispose: () => testMode.uninstall() });
  }
}
