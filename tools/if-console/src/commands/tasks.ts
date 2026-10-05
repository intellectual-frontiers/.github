// The task type `if-console` (0043-if-console FR-010): a repository's repository-wide commands (`check`, `test`, `fresh`, `doctor`) and,
// for `check`, a section or a suite, under Run Task, bindable to a keybinding. A task runs the launcher with `--json` and writes a summary
// to its terminal; the findings of a check go straight to the Problems panel (direct diagnostics), so no problem matcher is needed.
import * as vscode from 'vscode';
import { asString } from '../model/json';
import { checkResult, checkSchema, exposed, type Doc } from '../model/wire';
import { CancelSource } from '../services/cancellation';
import type { Repository } from '../services/repository';
import { t } from '../l10n';

export const COMMANDS = ['check', 'test', 'fresh', 'doctor'];

export interface TaskDef extends vscode.TaskDefinition { command: string; section?: string; suite?: string; changed?: boolean; folder?: string }

/** What a task needs of the extension: the repositories, whether the workspace is trusted, and where a result goes. */
export interface TaskHost {
  readonly repos: Repository[];
  trusted(): boolean;
  handleCheck(repo: Repository, doc: Doc): Promise<unknown>;
  refreshViews(): void;
}

export function argvOf(def: TaskDef): string[] {
  const argv = [def.command];
  if (def.command === 'check') {
    if (def.suite) argv.push('--suite', def.suite);
    if (def.section) argv.push(def.section);
    if (def.changed) argv.push('--changed');
  }
  return argv;
}

function labelOf(repo: Repository, def: TaskDef): string {
  return [repo.name, def.command, def.section ?? (def.suite ? `--suite ${def.suite}` : '')].filter(Boolean).join(' ');
}

/** What a task writes to its terminal for a result: plain lines. */
export function summaryLines(doc: Doc): string[] {
  const out: string[] = [];
  if (doc.kind === 'check') {
    const r = checkResult(doc);
    for (const s of r.sections) {
      out.push(`${s.status === 'passed' ? 'passed' : s.status === 'skipped' ? 'skipped' : 'FAILED'}  ${s.name}${s.reason ? ` (${s.reason})` : ''}`);
      for (const f of s.findings) out.push(`  ${f.level}: ${f.where ? `${f.where}: ` : ''}${f.message}`);
    }
    out.push(`check: ${r.summary.passed ?? 0} passed, ${r.summary.failed ?? 0} failed, ${r.summary.skipped ?? 0} skipped`);
  } else {
    out.push(`${doc.kind}: ${asString(doc.data.status, 'done')}`);
  }
  return out;
}

export class TaskTerminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  private readonly closeEmitter = new vscode.EventEmitter<number | void>();
  readonly onDidWrite = this.writeEmitter.event;
  readonly onDidClose = this.closeEmitter.event;
  private readonly cancel = new CancelSource();

  constructor(private readonly host: TaskHost, private readonly repo: Repository, private readonly def: TaskDef) {}

  private write(line: string): void { this.writeEmitter.fire(`${line}\r\n`); }

  open(): void { void this.start(); }

  private async start(): Promise<void> {
    const argv = argvOf(this.def);
    this.write(`$ ${this.repo.launcher.line([...argv, '--json'])}`);
    if (!this.host.trusted()) { this.write('IF Console runs nothing in a workspace that is not trusted.'); this.closeEmitter.fire(1); return; }
    const r = await this.repo.launcher.run(argv, { token: this.cancel.token,
      onDocument: (d) => this.write(asString(d.data.message || d.data.step || d.id)) });
    if (r.cancelled) { this.write('Cancelled.'); this.closeEmitter.fire(1); return; }
    if (!r.doc || r.error) { this.write(r.error ? r.error.message : t('{0} gave no result ({1}).', this.repo.program, r.failed ?? `exit ${String(r.exit)}`)); this.closeEmitter.fire(r.exit || 1); return; }
    const ok = checkSchema(r.doc);
    if (!ok.ok) { this.write(ok.message); this.closeEmitter.fire(1); return; }
    if (r.doc.kind === 'check') await this.host.handleCheck(this.repo, r.doc);
    if (r.doc.kind === 'doctor') { this.repo.doctor = r.doc; this.host.refreshViews(); }
    if (r.doc.kind === 'fresh') { this.repo.fresh = r.doc; this.host.refreshViews(); }
    for (const l of summaryLines(r.doc)) this.write(l);
    this.closeEmitter.fire(r.exit ?? 0);
  }

  close(): void { this.cancel.cancel(); }
}

export class TaskProvider implements vscode.TaskProvider {
  constructor(private readonly host: TaskHost) {}

  private make(repo: Repository, def: TaskDef): vscode.Task {
    const task = new vscode.Task({ ...def, folder: repo.folder.name }, repo.folder, labelOf(repo, def), 'if-console',
      new vscode.CustomExecution(() => Promise.resolve(new TaskTerminal(this.host, repo, def))));
    task.detail = repo.launcher.line([...argvOf(def), '--json']);
    if (def.command === 'test') task.group = vscode.TaskGroup.Test;
    if (def.command === 'check') task.group = vscode.TaskGroup.Build;
    return task;
  }

  async provideTasks(): Promise<vscode.Task[]> {
    const tasks: vscode.Task[] = [];
    for (const repo of this.host.repos) {
      if (repo.state !== 'ready') continue;
      for (const command of COMMANDS) {
        const c = repo.command(command);
        if (!c || !exposed(c)) continue;
        tasks.push(this.make(repo, { type: 'if-console', command }));
        if (command === 'check') {
          try {
            const d = await repo.detail('check');
            const suite = d.options.find((o) => o.flag === '--suite');
            for (const s of suite?.choices ?? []) tasks.push(this.make(repo, { type: 'if-console', command, suite: s }));
          } catch { /* the plain check task is still there */ }
        }
      }
    }
    return tasks;
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    const def = task.definition as Partial<TaskDef>;   // a task's definition is what package.json's taskDefinitions describes; VS Code types it as an open record
    if (def.type !== 'if-console' || !def.command || !COMMANDS.includes(def.command)) return undefined;
    const command = def.command;
    const repo = this.host.repos.find((r) => (def.folder ? r.folder.name === def.folder : true) && r.state === 'ready' && r.has(command));
    return repo ? this.make(repo, { ...def, type: 'if-console', command }) : undefined;
  }
}
