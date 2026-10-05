// The Checks view (0043-if-console FR-010): each section of the repository's `check`, its last result and, under a failed one, its findings.
// A section's row has a status icon, its result as the muted description and a hover button that runs it again; a finding opens its file at
// its line.
import * as vscode from 'vscode';
import { checkStatus } from '../model/presentation';
import { locate } from '../services/diagnostics';
import { BaseProvider, icon, messageNode, Node, single, speak, stateNodes, statusIcon } from './node';
import { findingTooltip, sectionTooltip } from './tooltips';

const plural = (n: number, one: string): string => `${n} ${n === 1 ? one : `${one}s`}`;

/** A finding as a row: its level as a colored icon, its place as the muted description, a click that opens the file at the line. */
export function findingItem(node: Node): vscode.TreeItem {
  const f = node.data.finding;
  const item = new vscode.TreeItem(f?.message ?? '', vscode.TreeItemCollapsibleState.None);
  if (f) {
    item.description = f.where;
    item.tooltip = findingTooltip(f);
    item.iconPath = statusIcon(checkStatus(f.level === 'error' || f.level === 'warning' || f.level === 'info' ? f.level : 'info'));
    item.contextValue = 'finding';
  }
  if (node.data.uri) {
    const line = node.data.line ?? 0;
    item.command = { command: 'vscode.open', title: 'Open', arguments: [node.data.uri, { selection: new vscode.Range(line, 0, line, 0), preview: true }] };
    item.contextValue = 'finding openable';
  }
  speak(item);
  return item;
}

export class ChecksProvider extends BaseProvider {
  /** How many sections failed in the last runs, for the view's badge. */
  failed(): number {
    let n = 0;
    for (const r of this.host.repos) for (const s of r.checks.values()) if (s.status === 'failed') n += 1;
    return n;
  }

  getTreeItem(node: Node): vscode.TreeItem {
    const base = this.baseItem(node);
    if (base) return base;
    const d = node.data;
    if (node.kind === 'finding') return findingItem(node);
    let item: vscode.TreeItem;
    if (node.kind === 'section') {
      const r = d.result;
      const name = d.name ?? '';
      const status = r ? checkStatus(r.status) : 'pending';
      item = new vscode.TreeItem(name, r && r.status === 'failed' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
      const summary = r ? (r.status === 'skipped' ? `skipped${r.reason ? `: ${r.reason}` : ''}` : r.status === 'failed' ? plural(r.findings.length, 'finding') : r.findings.length ? `passed, ${plural(r.findings.length, 'warning')}` : 'passed') : 'not run yet';
      item.description = summary;
      item.iconPath = statusIcon(status);
      item.tooltip = sectionTooltip(name, status, summary, node.repo.line(['check', name]), node.repo.key, this.host.handles);
      item.contextValue = 'section runnable copyable';
      item.command = { command: 'if-console.runSection', title: 'Run this section', arguments: [node] };
      item.id = `checks:${node.repo.key}:${name}`;
    } else {
      item = new vscode.TreeItem(d.text ?? '', vscode.TreeItemCollapsibleState.None);
      item.iconPath = icon('info');
    }
    speak(item);
    return item;
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (!node) {
      const only = single(this.host);
      return only ? this.sectionsOf(only, undefined) : this.repoNodes();
    }
    const repo = node.repo;
    if (node.kind === 'repo') return this.sectionsOf(repo, node);
    if (node.kind === 'section') {
      const r = node.data.result;
      if (!r) return [];
      const out: Node[] = [];
      for (const f of r.findings) {
        const loc = locate(f.where);
        const uri = loc ? await this.host.resolveFile(repo.folder, loc.file) : null;
        const n = new Node('finding', repo, { finding: f, uri, line: loc ? Math.max(0, loc.line - 1) : 0, view: 'if-console.checks' });
        n.parent = node;
        out.push(n);
      }
      return out;
    }
    return [];
  }

  private async sectionsOf(repo: Node['repo'], parent: Node | undefined): Promise<Node[]> {
    if (repo.state !== 'ready') return stateNodes(repo);
    const names = await this.host.sectionNames(repo);
    if (!names.length) return [messageNode(repo, 'This command line lists no check sections.')];
    return names.map((name) => { const n = new Node('section', repo, { name, result: repo.checks.get(name), view: 'if-console.checks' }); n.parent = parent; return n; });
  }
}
