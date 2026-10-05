// The tree of every noun and command of a repository (0043-if-console FR-008): repository -> nouns -> commands and resources -> links and
// actions. Every entry is built from what a launcher returned.
import * as vscode from 'vscode';
import { argvFromFields } from '../model/forms';
import { firstValue } from '../model/json';
import { actionsOf, checkSchema, linksOf } from '../model/wire';
import { BaseProvider, CATEGORY_ICON, icon, messageNode, Node, speak, stateNodes } from './node';

export const MAX_RESOURCES = 200;

export class CommandsProvider extends BaseProvider {
  getTreeItem(node: Node): vscode.TreeItem {
    const base = this.baseItem(node);
    if (base) return base;
    const d = node.data;
    let item: vscode.TreeItem;
    switch (node.kind) {
      case 'wide':
        item = new vscode.TreeItem('Repository-wide', vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = icon('root-folder');
        item.description = 'commands that take no noun';
        break;
      case 'noun':
        item = new vscode.TreeItem(d.noun ?? '', vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = icon('symbol-namespace');
        item.description = d.help ?? '';
        break;
      case 'command':
        item = new vscode.TreeItem(d.command?.id ?? '', vscode.TreeItemCollapsibleState.None);
        item.description = d.command?.category;
        item.tooltip = d.command?.help;
        item.iconPath = icon(CATEGORY_ICON[d.command?.category ?? ''] ?? 'play');
        item.command = { command: 'if-console.activateNode', title: 'Run', arguments: [node] };
        break;
      case 'resource':
        item = new vscode.TreeItem(d.label ?? '', vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = icon('symbol-file');
        item.description = d.rel ?? '';
        item.contextValue = 'resource';
        break;
      case 'more':
        item = new vscode.TreeItem(d.text ?? '', vscode.TreeItemCollapsibleState.None);
        item.iconPath = icon('ellipsis');
        break;
      case 'link':
        item = new vscode.TreeItem(d.label ?? '', vscode.TreeItemCollapsibleState.Collapsed);
        item.description = d.rel;
        item.iconPath = icon('link');
        item.contextValue = 'resource';
        break;
      case 'action': {
        const a = d.action;
        item = new vscode.TreeItem(a?.label ?? '', vscode.TreeItemCollapsibleState.None);
        if (a) {
          item.description = a.enabled ? a.category : `unavailable: ${a.reason}`;
          item.iconPath = icon(a.enabled ? CATEGORY_ICON[a.category] ?? 'play' : 'circle-slash');
          item.contextValue = a.enabled ? 'action' : 'action-disabled';
          item.tooltip = a.enabled ? (a.cli ?? 'This needs a value you choose when you run it.') : a.reason;
          if (a.enabled) item.command = { command: 'if-console.activateNode', title: 'Run', arguments: [node] };
        }
        break;
      }
      default: item = new vscode.TreeItem(node.kind);
    }
    speak(item);
    return item;
  }

  async getChildren(node?: Node): Promise<Node[]> {
    if (!node) return this.repoNodes();
    const repo = node.repo;
    switch (node.kind) {
      case 'repo': {
        if (repo.state !== 'ready') return stateNodes(repo);
        const { nouns, repoWide } = repo.nouns();
        const out: Node[] = [];
        if (repoWide.length) out.push(new Node('wide', repo, { commands: repoWide }));
        for (const [noun, commands] of nouns) out.push(new Node('noun', repo, { noun, commands }));
        return out;
      }
      case 'wide': return (node.data.commands ?? []).map((c) => new Node('command', repo, { command: c }));
      case 'noun': {
        const out = (node.data.commands ?? []).map((c) => new Node('command', repo, { command: c }));
        const links = await repo.resources(node.data.noun ?? '', MAX_RESOURCES + 1);
        for (const l of links.slice(0, MAX_RESOURCES)) out.push(new Node('resource', repo, { link: l, label: firstValue(l.fields) || l.command, rel: l.rel }));
        if (links.length > MAX_RESOURCES) out.push(new Node('more', repo, { text: `Only the first ${MAX_RESOURCES} are shown; use Run Command to choose any.` }));
        return out;
      }
      case 'resource': case 'link': return this.resourceChildren(node);
      default: return [];
    }
  }

  private async resourceChildren(node: Node): Promise<Node[]> {
    const repo = node.repo;
    const link = node.data.link;
    if (!link) return [];
    let detail;
    try { detail = await repo.detail(link.command); } catch (e) { return [messageNode(repo, e instanceof Error ? e.message : String(e))]; }
    const r = await repo.launcher.run(argvFromFields(detail, link.fields));
    if (!r.doc || r.error) return [messageNode(repo, r.error ? r.error.message : `${repo.program} did not return this resource.`)];
    const check = checkSchema(r.doc);
    if (!check.ok) return [messageNode(repo, check.message)];
    const out = linksOf(r.doc).slice(0, MAX_RESOURCES).map((l) => new Node('link', repo, { link: l, label: firstValue(l.fields) || l.command, rel: l.rel }));
    out.push(...actionsOf(r.doc).map((a) => new Node('action', repo, { action: a })));
    return out.length ? out : [messageNode(repo, 'This resource has no links or actions.')];
  }
}
