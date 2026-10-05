// The Checks view (0043-if-console FR-010): each section of the repository's `check`, its last result and, under a failed one, its findings.
import * as vscode from 'vscode';
import { locate } from '../services/diagnostics';
import { BaseProvider, icon, messageNode, Node, speak, stateNodes } from './node';

export class ChecksProvider extends BaseProvider {
  getTreeItem(node: Node): vscode.TreeItem {
    const base = this.baseItem(node);
    if (base) return base;
    const d = node.data;
    let item: vscode.TreeItem;
    if (node.kind === 'section') {
      const r = d.result;
      item = new vscode.TreeItem(d.name ?? '', r && r.status === 'failed' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
      item.description = r ? (r.status === 'skipped' ? `skipped${r.reason ? `: ${r.reason}` : ''}` : r.status) : 'not run yet';
      item.iconPath = icon(!r ? 'circle-outline' : r.status === 'passed' ? 'pass' : r.status === 'failed' ? 'error' : 'debug-step-over');
      item.contextValue = 'section';
      item.command = { command: 'if-console.activateNode', title: 'Run this section', arguments: [node] };
    } else if (node.kind === 'finding' && d.finding) {
      const f = d.finding;
      item = new vscode.TreeItem(f.message, vscode.TreeItemCollapsibleState.None);
      item.description = f.where;
      item.tooltip = `${f.message}${f.next ? `\nNext: ${f.next}` : ''}`;
      item.iconPath = icon(f.level === 'error' ? 'error' : 'warning');
      if (d.uri) {
        const line = d.line ?? 0;
        item.command = { command: 'vscode.open', title: 'Open', arguments: [d.uri, { selection: new vscode.Range(line, 0, line, 0) }] };
      }
    } else {
      item = new vscode.TreeItem(d.text ?? '', vscode.TreeItemCollapsibleState.None);
    }
    speak(item);
    return item;
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (!node) return this.repoNodes();
    const repo = node.repo;
    if (node.kind === 'repo') {
      if (repo.state !== 'ready') return stateNodes(repo);
      const names = await this.host.sectionNames(repo);
      if (!names.length) return [messageNode(repo, 'This command line lists no check sections.')];
      return names.map((name) => new Node('section', repo, { name, result: repo.checks.get(name) }));
    }
    if (node.kind === 'section') {
      const r = node.data.result;
      if (!r) return [];
      const out: Node[] = [];
      for (const f of r.findings) {
        const loc = locate(f.where);
        const uri = loc ? await this.host.resolveFile(repo.folder, loc.file) : null;
        out.push(new Node('finding', repo, { finding: f, uri, line: loc ? Math.max(0, loc.line - 1) : 0 }));
      }
      return out;
    }
    return [];
  }
}
