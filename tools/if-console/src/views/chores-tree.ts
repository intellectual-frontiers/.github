// The Chores view (0043-if-console FR-019): what a person routinely does in a repository, derived from the launcher's own resources.
import * as vscode from 'vscode';
import { deriveChores } from '../model/chores';
import { BaseProvider, CATEGORY_ICON, icon, Node, speak, stateNodes } from './node';

export class ChoresProvider extends BaseProvider {
  getTreeItem(node: Node): vscode.TreeItem {
    const base = this.baseItem(node);
    if (base) return base;
    const d = node.data;
    let item: vscode.TreeItem;
    if (node.kind === 'group') {
      item = new vscode.TreeItem(d.group?.label ?? '', vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = icon('list-unordered');
    } else if (node.kind === 'chore' && d.chore) {
      const c = d.chore;
      const description = 'description' in c ? c.description : '';
      item = new vscode.TreeItem(c.label, vscode.TreeItemCollapsibleState.None);
      item.description = description;
      item.tooltip = description || c.label;
      const category = c.kind === 'command' ? c.category : c.kind === 'action' ? c.action.category : undefined;
      item.iconPath = icon(c.kind === 'note' ? 'warning' : CATEGORY_ICON[category ?? ''] ?? (c.kind === 'ext' ? 'question' : 'play'));
      if (c.kind !== 'note') item.command = { command: 'if-console.activateNode', title: 'Do it', arguments: [node] };
    } else {
      item = new vscode.TreeItem(d.text ?? '', vscode.TreeItemCollapsibleState.None);
      item.iconPath = icon('info');
    }
    speak(item);
    return item;
  }

  getChildren(node?: Node): Promise<Node[]> {
    if (!node) return Promise.resolve(this.repoNodes());
    if (node.kind === 'repo') {
      if (node.repo.state !== 'ready') return Promise.resolve(stateNodes(node.repo));
      return Promise.resolve(deriveChores(node.repo).map((g) => new Node('group', node.repo, { group: g })));
    }
    if (node.kind === 'group') {
      const g = node.data.group;
      if (!g) return Promise.resolve([]);
      if (!g.items.length && g.empty) return Promise.resolve([new Node('empty', node.repo, { text: g.empty })]);
      return Promise.resolve(g.items.map((c) => new Node('chore', node.repo, { chore: c })));
    }
    return Promise.resolve([]);
  }
}
