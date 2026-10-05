// The views each command line declares (0043-if-console FR-036, FR-038): one view for each entry of `presentation.views`, merged across
// repositories by id, holding the nouns whose `view` is its id. A noun's resources are the rows of its `list` command, drawn as its declaration
// says (label, muted description, status as a colored codicon, badge, tooltip fields); a noun with no `list` shows the commands the editor offers
// for it. The manifest holds a fixed pool of slots; each slot's title, description and entries are set when the command lines are read.
import * as vscode from 'vscode';
import type { PlannedView } from '../model/viewplan';
import type { Row } from '../model/rows';
import { lookOf } from '../model/status';
import type { NounDecl } from '../model/presentation';
import type { Repository } from '../services/repository';
import { BaseProvider, CATEGORY_ICON, icon, Node, single, speak, statusIcon, type ViewHost } from './node';
import { escapeMarkdown as esc } from '../model/markdown';
import { markdown, rowTooltip } from './tooltips';

export const ROW_SCHEME = 'if-console-row';

export class ResourceProvider extends BaseProvider {
  plan: PlannedView<Repository> | null = null;
  /** How many rows each noun has, once loaded, for its group's description. */
  private readonly counts = new Map<string, number>();

  constructor(host: ViewHost, readonly slot: number) { super(host); }

  get viewId(): string { return `if-console.view.${this.slot}`; }

  setPlan(plan: PlannedView<Repository> | null): void {
    this.plan = plan;
    this.counts.clear();
    this.refresh();
  }

  private nounKey(repo: Repository, noun: string): string { return `${repo.key}\n${noun}`; }

  getTreeItem(node: Node): vscode.TreeItem {
    const base = this.baseItem(node);
    if (base) { if (node.kind === 'repo') base.id = `${this.viewId}:${node.repo.key}`; return base; }
    const d = node.data;
    let item: vscode.TreeItem;
    switch (node.kind) {
      case 'nounGroup': {
        const decl = d.nounDecl;
        const count = this.counts.get(this.nounKey(node.repo, d.noun ?? ''));
        item = new vscode.TreeItem(decl?.title ?? d.noun ?? '', d.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = icon(decl?.icon ?? 'symbol-namespace');
        item.description = count === undefined ? '' : String(count);
        item.contextValue = decl?.list ? 'noun listed' : 'noun';
        item.id = `${this.viewId}:${node.repo.key}:${d.noun ?? ''}`;
        break;
      }
      case 'row': {
        const row = d.row;
        if (!row) { item = new vscode.TreeItem(''); break; }
        item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
        item.description = row.description;
        item.iconPath = row.status ? statusIcon(row.status) : icon(row.icon || d.nounDecl?.icon || 'symbol-misc');
        const opens = node.repo.has(`${row.noun} show`);
        item.tooltip = rowTooltip(row, d.nounDecl?.title ?? row.noun, node.repo.key, this.host.handles, opens);
        item.contextValue = ['row', opens ? 'openable' : '', node.repo.has('context') ? 'contextual' : ''].filter(Boolean).join(' ');
        if (opens) item.command = { command: 'if-console.openRow', title: 'Open', arguments: [node] };
        if (row.badge) item.resourceUri = vscode.Uri.from({ scheme: ROW_SCHEME, path: `/${encodeURIComponent(row.noun)}/${encodeURIComponent(row.id)}`, query: row.badge });
        item.id = `${this.viewId}:${node.repo.key}:${row.noun}:${row.id}`;
        speak(item, [row.statusValue ? lookOf(row.status ?? 'muted').word : '', row.badge ? `${row.badge}` : ''].filter(Boolean).join(', '));
        return item;
      }
      case 'command': {
        const c = d.command;
        item = new vscode.TreeItem(c?.title ?? c?.id ?? '', vscode.TreeItemCollapsibleState.None);
        item.description = c?.category ?? '';
        item.iconPath = icon(c?.icon ?? CATEGORY_ICON[c?.category ?? ''] ?? 'play');
        const md = markdown();
        md.appendMarkdown(`$(${c?.icon ?? CATEGORY_ICON[c?.category ?? ''] ?? 'play'}) **${esc(c?.title ?? c?.id ?? '')}**\n\n${esc(c?.help ?? '')}\n\n\`${esc(node.repo.line(c?.words ?? []))}\``);
        item.tooltip = md;
        item.contextValue = 'command runnable';
        item.command = { command: 'if-console.activateNode', title: 'Run', arguments: [node] };
        break;
      }
      case 'more':
        item = new vscode.TreeItem(d.text ?? '', vscode.TreeItemCollapsibleState.None);
        item.iconPath = icon('ellipsis');
        item.command = { command: 'if-console.findResource', title: 'Find a resource', arguments: [node] };
        item.tooltip = 'Search all of them in a quick pick.';
        break;
      default: item = new vscode.TreeItem(d.text ?? '', vscode.TreeItemCollapsibleState.None);
    }
    speak(item);
    return item;
  }

  async getChildren(node?: Node): Promise<Node[]> {
    const plan = this.plan;
    if (!plan) return [];
    if (!node) {
      const only = single({ repos: plan.entries.map((e) => e.source) } as ViewHost);
      if (plan.entries.length === 1 && only) return this.nounsOf(only, plan.entries[0]?.nouns ?? [], undefined);
      return plan.entries.map((e) => { const n = new Node('repo', e.source, { view: this.viewId }); return n; });
    }
    if (node.kind === 'repo') {
      const entry = plan.entries.find((e) => e.source === node.repo);
      return entry ? this.nounsOf(node.repo, entry.nouns, node) : [];
    }
    if (node.kind === 'nounGroup') return this.rowsOf(node);
    return [];
  }

  private nounsOf(repo: Repository, nouns: NounDecl[], parent: Node | undefined): Node[] {
    // A view that holds one kind opens it: there is nothing else to choose between.
    return nouns.map((decl) => { const n = new Node('nounGroup', repo, { noun: decl.noun, nounDecl: decl, view: this.viewId, expanded: nouns.length === 1 && decl.list !== undefined }); n.parent = parent; return n; });
  }

  /** The rows of a noun's `list` (the first `rowLimit` of them, then how many more), or the commands the editor offers for a noun without one. */
  private async rowsOf(group: Node): Promise<Node[]> {
    const { repo } = group;
    const decl = group.data.nounDecl;
    const noun = group.data.noun ?? '';
    if (!decl?.list || !repo.listDecl(noun)) {
      return repo.editorCommands().filter((c) => c.noun === noun).map((c) => { const n = new Node('command', repo, { command: c, view: this.viewId }); n.parent = group; return n; });
    }
    const rows = await repo.rows(noun);
    this.counts.set(this.nounKey(repo, noun), rows.length);
    const limit = this.host.rowLimit();
    const shown = rows.slice(0, limit).map((row) => this.rowNode(repo, decl, row, group));
    if (rows.length > limit) shown.push(Object.assign(new Node('more', repo, { text: `${rows.length - limit} more…`, hidden: rows.length - limit, noun, view: this.viewId }), { parent: group }));
    if (!rows.length) shown.push(Object.assign(new Node('empty', repo, { text: `No ${decl.title.toLowerCase()} yet.` }), { parent: group }));
    return shown;
  }

  private rowNode(repo: Repository, decl: NounDecl, row: Row, parent: Node): Node {
    const n = new Node('row', repo, { row, noun: row.noun, nounDecl: decl, view: this.viewId });
    n.parent = parent;
    return n;
  }

  /** Every row of every noun in this view, for the quick pick that finds one. */
  async allRows(): Promise<Array<{ repo: Repository; decl: NounDecl; row: Row }>> {
    const out: Array<{ repo: Repository; decl: NounDecl; row: Row }> = [];
    for (const entry of this.plan?.entries ?? []) {
      for (const decl of entry.nouns) {
        if (!decl.list || !entry.source.listDecl(decl.noun)) continue;
        for (const row of await entry.source.rows(decl.noun)) out.push({ repo: entry.source, decl, row });
      }
    }
    return out;
  }
}
