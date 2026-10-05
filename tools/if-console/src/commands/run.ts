// Running commands for a person: the command palette's Run Command, the repository-wide commands, an action, a row of a view, a read
// command's HTML rendering. Each goes through the executor, the one path every command takes (FR-013 to FR-015).
import * as vscode from 'vscode';
import type { App } from '../app';
import { argvFromFields, collect } from '../model/forms';
import { firstValue } from '../model/json';
import { actionsOf, checkSchema, exposed, WRITES, type Action, type CommandDetail, type Doc } from '../model/wire';
import * as executor from '../services/executor';
import type { RunResult } from '../services/launcher';
import type { Repository } from '../services/repository';
import { Node } from '../views/node';
import { chooseRepo, pickCommand } from './pick';

export class RunCommands {
  constructor(private readonly app: App) {}

  async runCommandPalette(): Promise<executor.Outcome | null> {
    const repo = await chooseRepo(this.app);
    if (!repo) return null;
    const id = await pickCommand(repo);
    return id ? this.runForm(repo, id) : null;
  }

  async runForm(repo: Repository, id: string, presets?: Record<string, unknown>, only?: string[]): Promise<executor.Outcome | null> {
    const c = repo.command(id);
    if (!c || !exposed(c)) { this.app.log.info(`${id} is not a command this repository exposes to the editor.`); return null; }
    try { return await executor.runForm(this.app.ui, repo, id, presets, only); } catch (e) { this.app.fail(e); return null; }
  }

  async runRepoWide(name: string, { form }: { form?: boolean } = {}): Promise<executor.Outcome | null> {
    const repo = await chooseRepo(this.app);
    if (!repo) return null;
    if (!repo.has(name)) { void vscode.window.showInformationMessage(`${repo.name} has no "${name}" command.`); return null; }
    if (form) return this.runForm(repo, name);
    try { const detail = await repo.detail(name); return await executor.runArgv(this.app.ui, repo, detail, [name]); } catch (e) { this.app.fail(e); return null; }
  }

  async runAction(repo: Repository, action: Action): Promise<executor.Outcome | null> {
    if (!action.enabled) {
      void vscode.window.showInformationMessage(`${action.label} cannot run now: ${action.reason || 'the command line says it is unavailable'}.`);
      return null;
    }
    try {
      const detail = await repo.detail(action.command);
      if (action.needs.length) return await executor.runForm(this.app.ui, repo, detail, action.fields, action.needs);
      return await executor.runArgv(this.app.ui, repo, detail, argvFromFields(detail, action.fields));
    } catch (e) { this.app.fail(e); return null; }
  }

  /** The command a row of a view runs. Only what the views hand over is accepted: nothing a caller can invent. */
  async activateNode(node: unknown): Promise<unknown> {
    if (!(node instanceof Node)) return null;
    const repo = node.repo;
    const d = node.data;
    switch (node.kind) {
      case 'command': return d.command ? this.runForm(repo, d.command.id) : null;
      case 'resource': case 'link': return d.link ? this.openResource(repo, d.link) : null;
      case 'action': return d.action ? this.runAction(repo, d.action) : null;
      case 'section': return d.name ? this.app.runSections(repo, [d.name]) : null;
      case 'chore': {
        const c = d.chore;
        if (!c) return null;
        if (c.kind === 'command') return this.runForm(repo, c.command);
        if (c.kind === 'action') return this.runAction(repo, c.action);
        if (c.kind === 'section') return this.app.runSections(repo, [c.section]);
        if (c.kind === 'resource') return this.openResource(repo, c.link);
        if (c.kind === 'ext') return vscode.commands.executeCommand(c.command);
        return null;
      }
      default: return null;
    }
  }

  async openResource(repo: Repository, link: { command: string; fields: Record<string, unknown> }): Promise<void> {
    try {
      const detail = await repo.detail(link.command);
      await this.openView(repo, detail, argvFromFields(detail, link.fields));
    } catch (e) { this.app.fail(e); }
  }

  /** A command's own result: a check's findings into Problems, a write's next steps, or a read's HTML rendering. */
  async showResult(repo: Repository, detail: CommandDetail, argv: string[], real: RunResult): Promise<void> {
    const doc = real.doc;
    if (!doc) return;
    const ok = checkSchema(doc);
    if (!ok.ok) { await this.app.updateNeeded(ok.message); return; }
    if (doc.kind === 'check') {
      const r = await this.app.handleCheck(repo, doc);
      const s = r.summary;
      const text = `${repo.name} check: ${s.passed ?? 0} passed, ${s.failed ?? 0} failed, ${s.skipped ?? 0} skipped.`;
      const pick = await (s.failed ? vscode.window.showWarningMessage(text, 'Show Problems') : vscode.window.showInformationMessage(text));
      if (pick === 'Show Problems') void vscode.commands.executeCommand('workbench.actions.view.problems');
      return;
    }
    if (doc.kind === 'doctor') { repo.doctor = doc; this.app.refreshViews(); }
    if (doc.kind === 'fresh') { repo.fresh = doc; this.app.refreshViews(); }
    if (WRITES.includes(detail.category)) { await this.afterWrite(repo, detail, doc); return; }
    await this.openView(repo, detail, argv);
  }

  private async afterWrite(repo: Repository, detail: CommandDetail, doc: Doc): Promise<void> {
    const next = actionsOf(doc).filter((a) => a.enabled).slice(0, 3);
    const pick = await vscode.window.showInformationMessage(`${repo.name}: ${detail.id} is done.`, ...next.map((a) => a.label));
    const hit = next.find((a) => a.label === pick);
    if (hit) await this.runAction(repo, hit);
    this.app.refreshViews();
  }

  /** A read command's HTML rendering in a webview (FR-011). */
  async openView(repo: Repository, detail: CommandDetail, argv: string[]): Promise<void> {
    const r = await repo.launcher.run(argv, { format: 'html' });
    if (r.failed || !r.stdout) { this.app.log.info(`${detail.id}: the command line gave no rendering (${r.failed ?? `exit ${String(r.exit)}`}).`); return; }
    this.app.openHtml(repo, `${repo.name}: ${argv.join(' ')}`, r.stdout);
  }

  /** A command named by words (from a link): run it through the one path, with its values already given. */
  async runWords(repo: Repository, words: string[]): Promise<executor.Outcome | null> {
    const c = repo.editorCommands().sort((a, b) => b.words.length - a.words.length).find((x) => x.words.every((w, i) => words[i] === w));
    if (!c) { this.app.log.info(`A link named "${words.join(' ')}", which is not a command this repository exposes to the editor.`); return null; }
    const detail = await repo.detail(c.id);
    return executor.runArgv(this.app.ui, repo, detail, words);
  }

  async showCommandLine(): Promise<void> {
    const repo = await chooseRepo(this.app);
    if (!repo) return;
    const id = await pickCommand(repo);
    if (!id) return;
    try {
      const detail = await repo.detail(id);
      const got = await collect(this.app.ui, detail, (s) => repo.choicesFor(s), null);
      if (got.cancelled) return;
      const line = repo.launcher.line(argvFromFields(detail, got.values));
      const pick = await vscode.window.showInformationMessage(line, 'Copy');
      if (pick === 'Copy') await this.app.ui.copy(line);
    } catch (e) { this.app.fail(e); }
  }

  async openViewCommand(): Promise<void> {
    const repo = await chooseRepo(this.app);
    if (!repo) return;
    const id = await pickCommand(repo, (c) => c.category === 'read');
    if (!id) return;
    try {
      const detail = await repo.detail(id);
      const got = await collect(this.app.ui, detail, (s) => repo.choicesFor(s), null);
      if (!got.cancelled) await this.openView(repo, detail, argvFromFields(detail, got.values));
    } catch (e) { this.app.fail(e); }
  }

  /** The id a link's first field names, as `kind:id` for `context`. */
  static resourceOf(link: { command: string; fields: Record<string, unknown> }): string | null {
    const kind = link.command.split(/\s+/)[0] ?? '';
    const id = firstValue(link.fields);
    return id === undefined ? null : `${kind}:${id}`;
  }
}
