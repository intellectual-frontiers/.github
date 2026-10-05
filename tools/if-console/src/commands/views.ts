// What the views' rows, inline buttons, context menus and links do (0043-if-console FR-036, FR-038, FR-041): open a resource, run a suggestion or
// a resource's action, copy a command line or an identifier, find a resource among a view's rows, follow a handle from a tooltip, a hover or a
// CodeLens, stop what is running and show Home. Each hands over to the one path every command takes, and accepts only what the views gave it.
import * as vscode from 'vscode';
import type { App } from '../app';
import { actionsOf } from '../model/wire';
import { lookOf } from '../model/status';
import type { Repository } from '../services/repository';
import { CATEGORY_ICON, Node } from '../views/node';
import type { ContextCommands } from './context';
import type { RunCommands } from './run';

export class ViewCommands {
  constructor(private readonly app: App, private readonly run: RunCommands, private readonly context: ContextCommands) {}

  showHome(arg: unknown): Promise<void> { return this.app.showHome(arg === 'suggestions'); }

  runSuggestion(node: unknown): Promise<unknown> {
    if (!(node instanceof Node) || node.kind !== 'suggestion' || !node.data.suggestion) return Promise.resolve(null);
    const { suggestion } = node.data;
    return this.app.fromView(node.data.view, () => this.run.runSuggestion(node.repo, suggestion));
  }

  async openRow(node: unknown): Promise<unknown> {
    if (!(node instanceof Node) || node.kind !== 'row' || !node.data.row) return null;
    const { row } = node.data;
    return this.app.fromView(node.data.view, () => this.app.opener.openRow(node.repo, row.noun, row.id));
  }

  /** The actions of a row's resource, chosen in a quick pick, and run through the one path every command takes (dry run, diff, modal). */
  async rowActions(repo: Repository, noun: string, id: string, view?: string): Promise<unknown> {
    const shown = await repo.show(noun, id);
    const actions = shown ? actionsOf(shown) : [];
    if (!actions.length) { void vscode.window.showInformationMessage(`${id} has no actions the editor offers.`); return null; }
    const picked = await this.app.ui.pick({ title: `${noun} ${id}`, placeholder: 'Which action?',
      items: actions.map((a) => ({ label: `$(${a.enabled ? CATEGORY_ICON[a.category] ?? 'play' : 'circle-slash'}) ${a.label}`,
        description: a.enabled ? a.category : `unavailable: ${a.reason}`, detail: a.cli ?? (a.needs.length ? `asks for ${a.needs.join(', ')}` : undefined), value: a })) });
    if (picked === undefined || Array.isArray(picked)) return null;
    return this.app.fromView(view, () => this.run.runAction(repo, picked));
  }

  runRowAction(node: unknown): Promise<unknown> {
    if (!(node instanceof Node) || node.kind !== 'row' || !node.data.row) return Promise.resolve(null);
    const { row } = node.data;
    return this.rowActions(node.repo, row.noun, row.id, node.data.view);
  }

  /** The command line behind a row, as the line to paste in a terminal, and nothing where it needs a value. */
  commandLineOf(node: Node): string | null {
    const d = node.data;
    if (d.suggestion) return d.suggestion.commandLine;
    if (d.name && node.kind === 'section') return node.repo.line(['check', d.name]);
    if (d.row) { const c = node.repo.command(`${d.row.noun} show`); return c ? node.repo.line([...c.words, d.row.id]) : null; }
    if (d.link) return d.link.cli;
    if (d.action) return d.action.cli;
    return null;
  }

  async copyCommandLine(node: unknown): Promise<void> {
    if (!(node instanceof Node)) return;
    const line = this.commandLineOf(node);
    if (!line) { void vscode.window.showInformationMessage('This one needs a value only you can give, so it has no single command line. Run it and it asks.'); return; }
    await this.app.ui.copy(line);
  }

  async copyId(node: unknown): Promise<void> {
    if (!(node instanceof Node)) return;
    const id = node.data.row?.id ?? node.data.name ?? (node.data.link ? Object.values(node.data.link.fields)[0] : undefined);
    if (typeof id === 'string' && id) { await vscode.env.clipboard.writeText(id); void vscode.window.showInformationMessage(`${id} is on the clipboard.`); }
  }

  /** A quick pick over every row of the view a node belongs to (or of every view), to open one. */
  async findResource(node: unknown): Promise<unknown> {
    const view = node instanceof Node ? node.data.view : undefined;
    const slots = this.app.slots.filter((s) => s.plan && (!view || s.viewId === view));
    const all = (await Promise.all((slots.length ? slots : this.app.slots.filter((s) => s.plan)).map((s) => s.allRows()))).flat();
    if (!all.length) { void vscode.window.showInformationMessage('No view lists resources yet.'); return null; }
    const picked = await this.app.ui.pick({ title: 'Find a resource', placeholder: 'Type to search by name, description or kind',
      items: all.map((x) => ({ label: `$(${x.row.status ? lookOf(x.row.status).icon : x.decl.icon}) ${x.row.label}`, description: [x.row.description, x.decl.title].filter(Boolean).join(' · '),
        detail: x.row.facts.map((f) => `${f.key}: ${f.value}`).join('  '), value: x })) });
    if (picked === undefined || Array.isArray(picked)) return null;
    return this.app.fromView(view, () => this.app.opener.openRow(picked.repo, picked.row.noun, picked.row.id));
  }

  /** A command of the noun a group stands for, from the palette's quick pick limited to that noun. */
  runNounCommand(node: unknown): Promise<unknown> {
    if (!(node instanceof Node) || !node.data.noun) return Promise.resolve(null);
    const noun = node.data.noun;
    return this.app.fromView(node.data.view, () => this.run.runCommandPalette(node.repo, (c) => c.noun === noun));
  }

  /** A handle from a tooltip, a hover, a CodeLens or a document link: only what the extension issued leads anywhere. */
  async followLink(handle: unknown): Promise<unknown> {
    const p = this.app.handles.get(handle);
    if (!p) { this.app.log.info('A link named something this extension did not offer; nothing was run.'); return null; }
    if (p.kind === 'copy') { await this.app.ui.copy(p.text); return null; }
    if (p.kind === 'home') return this.app.showHome(true);
    const repo = this.app.repoByKey(p.repoKey);
    if (!repo || repo.state !== 'ready') return null;
    switch (p.kind) {
      case 'run': return this.run.runRun(repo, p.run);
      case 'open': return this.app.opener.openRow(repo, p.noun, p.id);
      case 'primary': return this.rowActions(repo, p.noun, p.id);
      case 'context': return this.context.copyContextOf(repo, `${p.noun}:${p.id}`);
      case 'action': return this.run.runAction(repo, p.action);
    }
  }

  cancelRun(): void {
    const n = this.app.running.cancelAll();
    if (!n) void vscode.window.showInformationMessage('Nothing is running.');
  }

  toggleAllCommands(): void {
    const shown = this.app.toggleAllCommands();
    if (shown) void vscode.commands.executeCommand('if-console.commands.focus');
  }
}
