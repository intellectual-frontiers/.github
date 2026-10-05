// Each `check` section as a test in the Test Explorer (0043-if-console FR-010), run by `check SECTION --json`. A section the launcher
// reports as skipped is shown as skipped, never as passed (0041-command-line FR-033).
import * as vscode from 'vscode';
import type { Section } from '../model/wire';
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
  resolveFile(folder: vscode.WorkspaceFolder, file: string): Promise<vscode.Uri | null>;
}

interface Meta { repo: Repository; section: string | null }

export class CheckTests implements vscode.Disposable {
  private readonly controller = vscode.tests.createTestController('if-console.checks', 'IF Console checks');
  private readonly items = new Map<string, Meta>();   // test item id -> what it stands for

  constructor(private readonly host: TestHost) {
    this.controller.refreshHandler = () => host.refresh().then(() => undefined);
    this.controller.createRunProfile('Run check', vscode.TestRunProfileKind.Run, (request, token) => this.run(request, token), true);
  }

  async rebuild(): Promise<void> {
    this.controller.items.replace([]);
    this.items.clear();
    for (const repo of this.host.repos) {
      if (repo.state !== 'ready' || !repo.has('check')) continue;
      const root = this.controller.createTestItem(`repo:${repo.key}`, `${repo.name} (${repo.folder.name})`);
      this.items.set(root.id, { repo, section: null });
      for (const name of await this.host.sectionNames(repo)) {
        const t = this.controller.createTestItem(`section:${repo.key}:${name}`, name);
        root.children.add(t);
        this.items.set(t.id, { repo, section: name });
      }
      this.controller.items.add(root);
    }
  }

  /** The leaves a request names: a chosen section, or every section of a chosen repository. */
  private leavesOf(request: vscode.TestRunRequest): Array<{ item: vscode.TestItem; repo: Repository; section: string }> {
    const all: vscode.TestItem[] = [];
    this.controller.items.forEach((t) => all.push(t));
    const chosen = request.include && request.include.length ? request.include : all;
    const leaves: Array<{ item: vscode.TestItem; repo: Repository; section: string }> = [];
    const excluded = new Set((request.exclude ?? []).map((t) => t.id));
    const walk = (t: vscode.TestItem): void => {
      if (excluded.has(t.id)) return;
      const meta = this.items.get(t.id);
      if (meta?.section) { leaves.push({ item: t, repo: meta.repo, section: meta.section }); return; }
      t.children.forEach((c) => walk(c));
    };
    chosen.forEach(walk);
    return leaves;
  }

  private async run(request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
    const run = this.controller.createTestRun(request);
    const leaves = this.leavesOf(request);
    for (const { item } of leaves) run.enqueued(item);
    for (const { item, repo, section } of leaves) {
      if (token.isCancellationRequested) break;
      run.started(item);
      const started = Date.now();
      const results = await this.host.runSections(repo, [section], { token });
      const r = results.find((x) => x.name === section) ?? results[0];
      if (!r) { run.skipped(item); continue; }
      if ('failed' in r) { run.errored(item, new vscode.TestMessage(r.message)); continue; }
      if (r.status === 'skipped') { run.appendOutput(`${section}: skipped${r.reason ? `: ${r.reason}` : ''}\r\n`, undefined, item); run.skipped(item); continue; }
      if (r.status === 'passed') { run.passed(item, Date.now() - started); continue; }
      const messages: vscode.TestMessage[] = [];
      for (const f of r.findings) {
        const m = new vscode.TestMessage(`${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}${f.next ? `\nNext: ${f.next}` : ''}`);
        const loc = locate(f.where);
        const uri = loc ? await this.host.resolveFile(repo.folder, loc.file) : null;
        if (loc && uri) m.location = new vscode.Location(uri, new vscode.Position(Math.max(0, loc.line - 1), 0));
        messages.push(m);
        run.appendOutput(`${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}\r\n`, undefined, item);
      }
      run.failed(item, messages.length ? messages : new vscode.TestMessage('The section failed.'), Date.now() - started);
    }
    run.end();
  }

  dispose(): void { this.controller.dispose(); }
}
