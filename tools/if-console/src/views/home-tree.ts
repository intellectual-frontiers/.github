// The Home view (0043-if-console FR-037): what needs a person, across every command line found, each as a row with a status and an action.
// Every row says what is wrong in plain words, shows the exact command line that fixes it and has a Run button that goes through the one path
// every command takes, or says what the person must do themselves. The count of what needs a person is the view's badge.
import * as vscode from 'vscode';
import { countOf, deriveHome, type Suggestion } from '../model/home';
import { BaseProvider, icon, Node, single, speak, stateNodes, statusIcon } from './node';
import { findingItem } from './checks-tree';
import { suggestionTooltip } from './tooltips';
import type { Repository } from '../services/repository';

export const EVERYTHING_OK = 'Everything is in order. Nothing needs you.';

export class HomeProvider extends BaseProvider {
  /** The nodes built last, by suggestion id, so that a view can reveal one. */
  private readonly built = new Map<string, Node>();

  /** Every suggestion of every repository, for the badge, the status bar and the notifications. */
  suggestions(): Array<{ repo: Repository; items: Suggestion[]; help: Suggestion[] }> {
    return this.host.repos.map((repo) => ({ repo, ...(({ needs, help }) => ({ items: needs, help }))(deriveHome(repo)) }));
  }

  count(): number { return this.suggestions().reduce((n, r) => n + countOf(r.items), 0); }

  /** Build every row (a repository's rows are made when its group is opened), so that the first one that needs a person can be found. */
  async prepare(): Promise<void> {
    for (const n of await this.getChildren()) if (n.kind === 'repo') await this.getChildren(n);
  }

  /** The first node that needs a person, for the status bar's click to land on. */
  first(): Node | undefined {
    for (const [id, node] of this.built) if (node.kind === 'suggestion' && node.data.suggestion?.counts) return this.built.get(id);
    return [...this.built.values()].find((n) => n.kind === 'suggestion');
  }

  getTreeItem(node: Node): vscode.TreeItem {
    const base = this.baseItem(node);
    if (base) return base;
    const d = node.data;
    let item: vscode.TreeItem;
    if (node.kind === 'suggestion' && d.suggestion) {
      const s = d.suggestion;
      item = new vscode.TreeItem(s.label, s.findings.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
      item.description = s.commandLine ?? (s.yourself ? `you: ${s.yourself}` : '');
      item.iconPath = statusIcon(s.status);
      item.tooltip = suggestionTooltip(s, node.repo.key, this.host.handles);
      item.contextValue = ['suggestion', s.run ? 'runnable' : '', s.commandLine ? 'copyable' : ''].filter(Boolean).join(' ');
      if (s.run) item.command = { command: 'if-console.runSuggestion', title: s.runLabel || 'Run', arguments: [node] };
      item.id = `home:${node.repo.key}:${s.id}`;
      speak(item, s.runLabel ? `${s.runLabel} is available` : '');
      return item;
    }
    if (node.kind === 'group') {
      item = new vscode.TreeItem(d.label ?? '', vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = icon('question');
      item.id = `home:${node.repo.key}:group:${d.label ?? ''}`;
    } else if (node.kind === 'finding') {
      return findingItem(node);
    } else {
      item = new vscode.TreeItem(d.text ?? '', vscode.TreeItemCollapsibleState.None);
      item.iconPath = icon('pass', 'testing.iconPassed');
    }
    speak(item);
    return item;
  }

  getChildren(node?: Node): Promise<Node[]> {
    return Promise.resolve(this.childrenOf(node));
  }

  private childrenOf(node?: Node): Node[] {
    if (!node) {
      this.built.clear();
      const only = single(this.host);
      if (only) return this.itemsOf(only, undefined);
      return this.host.repos.map((r) => { const n = new Node('repo', r, { view: 'if-console.home' }); this.built.set(`repo:${r.key}`, n); return n; });
    }
    if (node.kind === 'repo') return node.repo.state === 'ready' || node.repo.state === 'untrusted' || node.repo.state === 'update' ? this.itemsOf(node.repo, node) : stateNodes(node.repo);
    if (node.kind === 'group') return this.helpOf(node);
    if (node.kind === 'suggestion') {
      const s = node.data.suggestion;
      return (s?.findings ?? []).map((f) => { const c = new Node('finding', node.repo, { finding: f, view: 'if-console.home' }); c.parent = node; return c; });
    }
    return [];
  }

  private helpOf(group: Node): Node[] {
    const { help } = deriveHome(group.repo);
    return help.map((s) => { const n = new Node('suggestion', group.repo, { suggestion: s, view: 'if-console.home' }); n.parent = group; return n; });
  }

  private itemsOf(repo: Repository, parent: Node | undefined): Node[] {
    const { needs, help } = deriveHome(repo);
    const out: Node[] = needs.map((s) => {
      const n = new Node('suggestion', repo, { suggestion: s, view: 'if-console.home' });
      n.parent = parent;
      this.built.set(`${repo.key}:${s.id}`, n);
      return n;
    });
    if (!out.length && repo.state === 'ready') out.push(Object.assign(new Node('empty', repo, { text: EVERYTHING_OK }), { parent }));
    if (help.length) { const g = new Node('group', repo, { label: 'Get help', view: 'if-console.home' }); g.parent = parent; out.push(g); }
    return out;
  }
}
