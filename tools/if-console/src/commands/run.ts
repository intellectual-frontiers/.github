// Running commands for a person: the command palette's Run Command, the repository-wide commands, an action, a row of a view, a read
// command's HTML rendering. Each goes through the executor, the one path every command takes (FR-013 to FR-015).
import * as vscode from 'vscode';
import type { App } from '../app';
import { argvFromFields, collect } from '../model/forms';
import { deriveHome, EXT_COMMANDS, type Run, type Suggestion } from '../model/home';
import { firstValue } from '../model/json';
import { actionsOf, checkSchema, exposed, WRITES, type Action, type CommandDetail, type CommandSummary, type Doc } from '../model/wire';
import * as executor from '../services/executor';
import type { RunResult } from '../services/launcher';
import type { Repository } from '../services/repository';
import { Node } from '../views/node';
import { chooseRepo, pickCommand } from './pick';
import { t } from '../l10n';

export class RunCommands {
  constructor(private readonly app: App) {}

  async runCommandPalette(known?: Repository, filter?: (c: CommandSummary) => boolean): Promise<executor.Outcome | null> {
    const repo = known ?? await chooseRepo(this.app);
    if (!repo) return null;
    const id = await pickCommand(repo, filter);
    return id ? this.runForm(repo, id) : null;
  }

  async runForm(repo: Repository, id: string, presets?: Record<string, unknown>, only?: string[]): Promise<executor.Outcome | null> {
    const c = repo.command(id);
    if (!c || !exposed(c)) { this.app.log.info(`${id} is not a command this repository exposes to the editor.`); return null; }
    try { return await executor.runForm(this.app.ui, repo, id, presets, only); } catch (e) { this.app.fail(e); return null; }
  }

  async runRepoWide(name: string, { form, args }: { form?: boolean; args?: string[] } = {}): Promise<executor.Outcome | null> {
    const repo = await chooseRepo(this.app);
    if (!repo) return null;
    if (!repo.has(name)) { void vscode.window.showInformationMessage(t('{0} has no "{1}" command.', repo.name, name)); return null; }
    if (form) return this.runForm(repo, name);
    try { const detail = await repo.detail(name); return await executor.runArgv(this.app.ui, repo, detail, [name, ...(args ?? [])]); } catch (e) { this.app.fail(e); return null; }
  }

  /** What a suggestion runs: a command the launcher offers, a check section, a resource to open, or one of the few commands of the editor. */
  async runRun(repo: Repository, run: Run): Promise<unknown> {
    switch (run.kind) {
      case 'action': return this.runAction(repo, run.action);
      case 'words': return this.runWords(repo, run.words);
      case 'section': return this.app.runSectionsShown(repo, [run.section]);
      case 'resource': return this.app.opener.open(repo, run.link);
      case 'ext': return EXT_COMMANDS.includes(run.command) ? vscode.commands.executeCommand(run.command) : null;
    }
  }

  async runSuggestion(repo: Repository, s: Suggestion): Promise<unknown> {
    return s.run ? this.runRun(repo, s.run) : null;
  }

  async runAction(repo: Repository, action: Action): Promise<executor.Outcome | null> {
    if (!action.enabled) {
      void vscode.window.showInformationMessage(t('{0} cannot run now: {1}.', action.label, action.reason || 'the command line says it is unavailable'));
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
    return this.app.fromView(d.view, async () => {
      switch (node.kind) {
        case 'command': return d.command ? this.runForm(repo, d.command.id) : null;
        case 'resource': case 'link': return d.link ? this.app.opener.open(repo, d.link) : null;
        case 'action': return d.action ? this.runAction(repo, d.action) : null;
        case 'section': return d.name ? this.app.runSectionsShown(repo, [d.name]) : null;
        case 'suggestion': return d.suggestion ? this.runSuggestion(repo, d.suggestion) : null;
        case 'row': return d.row ? this.app.opener.openRow(repo, d.row.noun, d.row.id) : null;
        default: return null;
      }
    });
  }

  /** A command's own result: a check's findings into Problems, a write's next steps, or a read's HTML rendering. A problem is always shown with
   * the command that fixes it and a button that runs it (0043 FR-048), never as a pointer to somewhere else. */
  async showResult(repo: Repository, detail: CommandDetail, argv: string[], real: RunResult): Promise<void> {
    const doc = real.doc;
    if (!doc) return;
    const ok = checkSchema(doc);
    if (!ok.ok) { await this.app.updateNeeded(ok.message); return; }
    if (doc.kind === 'check') {
      const r = await this.app.handleCheck(repo, doc);
      const s = r.summary;
      await this.tell(repo, t('{0} check: {1} passed, {2} failed, {3} skipped.', repo.name, s.passed ?? 0, s.failed ?? 0, s.skipped ?? 0), ['checks']);
      return;
    }
    if (doc.kind === 'doctor') { repo.doctor = doc; this.app.refreshViews(); await this.tell(repo, t('{0} doctor: {1}.', repo.name, repo.health), ['toolchain', 'health']); }
    if (doc.kind === 'fresh') { repo.fresh = doc; this.app.refreshViews(); await this.tell(repo, t('{0} fresh: {1}.', repo.name, asStatus(doc)), ['generated']); }
    if (WRITES.includes(detail.category)) { repo.forgetResources(); await this.app.panel.refreshCurrent(); await this.afterWrite(repo, detail, doc); return; }
    await this.app.opener.argv(repo, detail, argv);
  }

  /** A message about a result. Where something needs a person it says what, gives the exact command line, and has the button that runs the fix
   * and the one that shows all of it in Home; where nothing does it is only said. */
  async tell(repo: Repository, headline: string, groups: Suggestion['group'][]): Promise<void> {
    const needs = deriveHome(repo).needs.filter((s) => groups.includes(s.group) && s.counts);
    const first = needs[0];
    if (!first) { void vscode.window.showInformationMessage(headline); return; }
    const more = needs.length > 1 ? t(' (and {0} more)', needs.length - 1) : '';
    const line = first.commandLine ? t(' Run {0}.', first.commandLine) : first.yourself ? t(' You: {0}', first.yourself) : '';
    const buttons = [...(first.run ? [first.runLabel || 'Run'] : []), 'Show all'];
    const pick = await vscode.window.showWarningMessage(t('{0} {1}{2}.{3}', headline, first.label, more, line), ...buttons);
    if (pick === 'Show all') await this.app.showHome(true);
    else if (pick !== undefined && pick === (first.runLabel || 'Run')) await this.app.fromView(undefined, () => this.runSuggestion(repo, first));
  }

  private async afterWrite(repo: Repository, detail: CommandDetail, doc: Doc): Promise<void> {
    const next = actionsOf(doc).filter((a) => a.enabled).slice(0, 3);
    const pick = await vscode.window.showInformationMessage(t('{0}: {1} is done.', repo.name, detail.id), ...next.map((a) => a.label));
    const hit = next.find((a) => a.label === pick);
    if (hit) await this.runAction(repo, hit);
    repo.forgetResources();
    this.app.refreshViews();
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
      const pick = await vscode.window.showInformationMessage(line, t('Copy'));
      if (pick === 'Copy') await this.app.ui.copy(line);
    } catch (e) { this.app.fail(e); }
  }

  async openViewCommand(): Promise<void> {
    const repo = await chooseRepo(this.app);
    if (!repo) return;
    const id = await pickCommand(repo, (c) => c.category === 'read' || c.category === 'check');
    if (!id) return;
    try {
      const detail = await repo.detail(id);
      const got = await collect(this.app.ui, detail, (s) => repo.choicesFor(s), null);
      if (!got.cancelled) await this.app.opener.argv(repo, detail, argvFromFields(detail, got.values));
    } catch (e) { this.app.fail(e); }
  }

  /** The id a link's first field names, as `kind:id` for `context`. */
  static resourceOf(link: { command: string; fields: Record<string, unknown> }): string | null {
    const kind = link.command.split(/\s+/)[0] ?? '';
    const id = firstValue(link.fields);
    return id === undefined ? null : `${kind}:${id}`;
  }
}

const asStatus = (doc: Doc): string => {
  const d = doc.data;
  return typeof d.status === 'string' ? d.status : 'done';
};
