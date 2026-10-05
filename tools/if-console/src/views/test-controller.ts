// The Testing API (0043-if-console FR-010, FR-040): each repository's `check` sections as tests in the Test Explorer, run by `check SECTION
// --json`, with two run profiles (Run, and Run with --changed); the findings of a failed section as child tests with a range at the line each
// names; and, for each reference that a spec or a register names whose enforcing action is a check, a test with a range at its line, run by that
// action. A section the launcher reports as skipped is shown as skipped, never as passed (0041-command-line FR-033).
import * as vscode from 'vscode';
import { argvFromFields } from '../model/forms';
import { display } from '../model/rows';
import type { ReferenceMatch } from '../model/references';
import { actionsOf, checkResult, type Action, type Section } from '../model/wire';
import { locate } from '../services/diagnostics';
import type { Cancellation } from '../services/launcher';
import type { Repository } from '../services/repository';

/** One section that failed to run at all, or one the launcher reported. */
export type SectionOutcome = Section | { name: string; failed: true; message: string };

/** What the controller needs of the extension. */
export interface TestHost {
  readonly repos: Repository[];
  refresh(): Promise<unknown>;
  sectionNames(repo: Repository): Promise<string[]>;
  runSections(repo: Repository, names: string[], opts?: { token?: Cancellation }): Promise<SectionOutcome[]>;
  /** `check --changed`, and what it reported. */
  runChanged(repo: Repository, opts?: { token?: Cancellation }): Promise<SectionOutcome[]>;
  resolveFile(folder: vscode.WorkspaceFolder, file: string): Promise<vscode.Uri | null>;
  /** The references in a document, and the repository they belong to. */
  referencesIn(document: vscode.TextDocument): { repo: Repository; matches: ReferenceMatch[] } | null;
  handleCheckDoc(repo: Repository, doc: Parameters<typeof checkResult>[0]): Promise<unknown>;
}

type Meta =
  | { kind: 'repo'; repo: Repository }
  | { kind: 'section'; repo: Repository; section: string }
  | { kind: 'finding'; repo: Repository; section: string }
  | { kind: 'reference'; repo: Repository; action: Action }
  | { kind: 'file'; repo: Repository };

const MAX_REFERENCES = 60;
const CONCURRENCY = 4;

export class CheckTests implements vscode.Disposable {
  private readonly controller = vscode.tests.createTestController('if-console.checks', 'IF Console checks');
  private readonly items = new Map<string, Meta>();   // test item id -> what it stands for
  private readonly sectionItems = new Map<string, vscode.TestItem>();
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly profiles: string[] = ['Run', 'Run with --changed'];

  constructor(private readonly host: TestHost) {
    this.controller.refreshHandler = () => host.refresh().then(() => undefined);
    this.controller.createRunProfile('Run', vscode.TestRunProfileKind.Run, (request, token) => this.run(request, token, false), true);
    this.controller.createRunProfile('Run with --changed', vscode.TestRunProfileKind.Run, (request, token) => this.run(request, token, true), false);
    this.subscriptions.push(vscode.workspace.onDidOpenTextDocument((d) => this.addReferences(d)));
  }

  async rebuild(): Promise<void> {
    this.controller.items.replace([]);
    this.items.clear();
    this.sectionItems.clear();
    for (const repo of this.host.repos) {
      if (repo.state !== 'ready' || !repo.has('check')) continue;
      const root = this.controller.createTestItem(`repo:${repo.key}`, `${repo.name} (${repo.folder.name})`);
      this.items.set(root.id, { kind: 'repo', repo });
      for (const name of await this.host.sectionNames(repo)) {
        const id = `section:${repo.key}:${name}`;
        const t = this.controller.createTestItem(id, name);
        root.children.add(t);
        this.items.set(id, { kind: 'section', repo, section: name });
        this.sectionItems.set(id, t);
      }
      this.controller.items.add(root);
    }
    for (const d of vscode.workspace.textDocuments) void this.addReferences(d);
  }

  // --- references ----------------------------------------------------------------------------------------------------
  /** For each reference in an open document whose resource has an enforcing check, a test with a range at its line. */
  async addReferences(document: vscode.TextDocument): Promise<void> {
    const found = this.host.referencesIn(document);
    if (!found || !found.matches.length) return;
    const { repo } = found;
    const fileId = `file:${document.uri.toString()}`;
    const unique = new Map<string, ReferenceMatch>();
    for (const m of found.matches) if (!unique.has(`${m.decl.noun}\n${m.value}`) && unique.size < MAX_REFERENCES) unique.set(`${m.decl.noun}\n${m.value}`, m);
    const queue = [...unique.values()];
    const checks = new Map<string, Action>();
    const worker = async (): Promise<void> => {
      for (let m = queue.shift(); m; m = queue.shift()) {
        const shown = await repo.show(m.decl.noun, m.value);
        const check = shown ? actionsOf(shown).find((a) => a.enabled && a.category === 'check') : undefined;
        if (check) checks.set(`${m.decl.noun}\n${m.value}`, check);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    if (!checks.size) return;
    const file = this.items.has(fileId) ? this.controller.items.get(fileId) : undefined;
    const parent = file ?? this.controller.createTestItem(fileId, vscode.workspace.asRelativePath(document.uri, false), document.uri);
    if (!file) { this.items.set(fileId, { kind: 'file', repo }); this.controller.items.add(parent); }
    parent.children.replace([]);
    for (const m of found.matches) {
      const check = checks.get(`${m.decl.noun}\n${m.value}`);
      if (!check) continue;
      const id = `reference:${document.uri.toString()}:${m.line}:${m.start}`;
      const t = this.controller.createTestItem(id, `${m.text}`, document.uri);
      t.range = new vscode.Range(m.line, m.start, m.line, m.end);
      t.description = check.label;
      this.items.set(id, { kind: 'reference', repo, action: check });
      parent.children.add(t);
    }
  }

  // --- running -------------------------------------------------------------------------------------------------------
  /** The leaves a request names: a chosen section or reference, or every section of a chosen repository. */
  private leavesOf(request: vscode.TestRunRequest): Array<{ item: vscode.TestItem; meta: Meta }> {
    const all: vscode.TestItem[] = [];
    this.controller.items.forEach((t) => all.push(t));
    const chosen = request.include && request.include.length ? request.include : all;
    const leaves: Array<{ item: vscode.TestItem; meta: Meta }> = [];
    const excluded = new Set((request.exclude ?? []).map((t) => t.id));
    const walk = (t: vscode.TestItem): void => {
      if (excluded.has(t.id)) return;
      const meta = this.items.get(t.id);
      if (meta && (meta.kind === 'section' || meta.kind === 'reference')) { leaves.push({ item: t, meta }); return; }
      t.children.forEach((c) => walk(c));
    };
    chosen.forEach(walk);
    return leaves;
  }

  private async finish(run: vscode.TestRun, item: vscode.TestItem, repo: Repository, r: SectionOutcome, started: number): Promise<void> {
    const section = r.name;
    if ('failed' in r) { run.errored(item, new vscode.TestMessage(r.message)); return; }
    this.clearFindings(item);
    if (r.status === 'skipped') { run.appendOutput(`${section}: skipped${r.reason ? `: ${r.reason}` : ''}\r\n`, undefined, item); run.skipped(item); return; }
    if (r.status === 'passed') { run.passed(item, Date.now() - started); return; }
    const messages: vscode.TestMessage[] = [];
    for (const f of r.findings) {
      const m = new vscode.TestMessage(`${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}${f.next ? `\nNext: ${f.next}` : ''}`);
      const loc = locate(f.where);
      const uri = loc ? await this.host.resolveFile(repo.folder, loc.file) : null;
      if (loc && uri) {
        m.location = new vscode.Location(uri, new vscode.Position(Math.max(0, loc.line - 1), 0));
        const child = this.controller.createTestItem(`finding:${item.id}:${messages.length}`, f.message.length > 80 ? `${f.message.slice(0, 79)}…` : f.message, uri);
        child.range = new vscode.Range(Math.max(0, loc.line - 1), 0, Math.max(0, loc.line - 1), 0);
        child.description = f.where;
        item.children.add(child);
        this.items.set(child.id, { kind: 'finding', repo, section });
        run.failed(child, new vscode.TestMessage(f.message), Date.now() - started);
      }
      messages.push(m);
      run.appendOutput(`${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}\r\n`, undefined, item);
    }
    run.failed(item, messages.length ? messages : new vscode.TestMessage('The section failed.'), Date.now() - started);
  }

  /** The findings a section reported last time are not the findings of this run. */
  private clearFindings(item: vscode.TestItem): void {
    const ids: string[] = [];
    item.children.forEach((c) => ids.push(c.id));
    for (const id of ids) { item.children.delete(id); this.items.delete(id); }
  }

  private async run(request: vscode.TestRunRequest, token: vscode.CancellationToken, changed: boolean): Promise<void> {
    const run = this.controller.createTestRun(request);
    const leaves = this.leavesOf(request);
    for (const { item } of leaves) run.enqueued(item);
    if (changed) await this.runChanged(run, leaves, token);
    else for (const { item, meta } of leaves) {
      if (token.isCancellationRequested) break;
      run.started(item);
      const started = Date.now();
      if (meta.kind === 'section') {
        const results = await this.host.runSections(meta.repo, [meta.section], { token });
        const r = results.find((x) => x.name === meta.section) ?? results[0];
        if (!r) run.skipped(item); else await this.finish(run, item, meta.repo, r, started);
      } else if (meta.kind === 'reference') await this.runReference(run, item, meta, started, token);
    }
    run.end();
  }

  /** `check --changed` once for each repository the request touches, and each section it reported marked on its test. */
  private async runChanged(run: vscode.TestRun, leaves: Array<{ item: vscode.TestItem; meta: Meta }>, token: vscode.CancellationToken): Promise<void> {
    const repos = new Map<string, Repository>();
    for (const { meta } of leaves) repos.set(meta.repo.key, meta.repo);
    for (const repo of repos.values()) {
      if (token.isCancellationRequested) break;
      const mine = leaves.filter((l) => l.meta.repo === repo && l.meta.kind === 'section');
      for (const { item } of mine) run.started(item);
      const started = Date.now();
      const results = await this.host.runChanged(repo, { token });
      for (const { item, meta } of mine) {
        const r = meta.kind === 'section' ? results.find((x) => x.name === meta.section) : undefined;
        if (!r) { run.appendOutput('Nothing this section watches changed, so it did not run.\r\n', undefined, item); run.skipped(item); } else await this.finish(run, item, repo, r, started);
      }
    }
  }

  private async runReference(run: vscode.TestRun, item: vscode.TestItem, meta: Extract<Meta, { kind: 'reference' }>, started: number, token: vscode.CancellationToken): Promise<void> {
    const { repo, action } = meta;
    try {
      const detail = await repo.detail(action.command);
      const r = await repo.launcher.run(argvFromFields(detail, action.fields), { token });
      if (r.cancelled) { run.skipped(item); return; }
      if (!r.doc || r.error) { run.errored(item, new vscode.TestMessage(r.error ? r.error.message : r.failed ?? 'The check gave no result.')); return; }
      const result = checkResult(r.doc);
      await this.host.handleCheckDoc(repo, r.doc);
      const bad = result.sections.filter((s) => s.status === 'failed');
      if (!bad.length) { run.passed(item, Date.now() - started); return; }
      run.failed(item, bad.flatMap((s) => s.findings.map((f) => new vscode.TestMessage(`${s.name}: ${f.message}${f.where ? ` (${f.where})` : ''}`))), Date.now() - started);
    } catch (e) { run.errored(item, new vscode.TestMessage(display(e instanceof Error ? e.message : e))); }
  }

  /** What the Test Explorer holds, for the test hook's snapshot: each item's label and, where it has one, its range's first line. */
  describe(): unknown {
    interface Entry { id: string; label: string; line?: number; children: Entry[] }
    const walk = (item: vscode.TestItem): Entry => {
      const children: Entry[] = [];
      item.children.forEach((c) => children.push(walk(c)));
      return { id: item.id, label: item.label, line: item.range?.start.line, children };
    };
    const out: Entry[] = [];
    this.controller.items.forEach((t) => out.push(walk(t)));
    return { profiles: this.profiles, items: out };
  }

  dispose(): void {
    for (const s of this.subscriptions) s.dispose();
    this.controller.dispose();
  }
}
