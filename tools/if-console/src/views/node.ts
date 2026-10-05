// The entries of the views: a node is what a view row stands for, and the provider that built it knows how to draw it. A node carries the
// repository it belongs to and the data its kind needs; the command that activates a row receives the node and nothing a caller can invent.
import * as vscode from 'vscode';
import type { Suggestion } from '../model/home';
import type { NounDecl, Status } from '../model/presentation';
import type { Row } from '../model/rows';
import { lookOf } from '../model/status';
import type { Action, CommandSummary, Finding, Link } from '../model/wire';
import type { Handles } from '../services/handles';
import type { CheckRecord, Repository } from '../services/repository';

export type NodeKind = 'repo' | 'message' | 'trust' | 'wide' | 'noun' | 'command' | 'resource' | 'link' | 'action' | 'more'
  | 'empty' | 'section' | 'finding' | 'suggestion' | 'group' | 'nounGroup' | 'row';

export interface NodeData {
  text?: string;
  commands?: CommandSummary[];
  command?: CommandSummary;
  noun?: string;
  nounDecl?: NounDecl;
  help?: string;
  link?: Link;
  label?: string;
  rel?: string;
  action?: Action;
  name?: string;
  result?: CheckRecord;
  finding?: Finding;
  uri?: vscode.Uri | null;
  line?: number;
  suggestion?: Suggestion;
  row?: Row;
  /** The view that drew this node, so that work started from it shows its progress there. */
  view?: string;
  /** A group that opens by itself. */
  expanded?: boolean;
  /** Where a group's rows come from, and how many are not shown. */
  hidden?: number;
}

export class Node {
  /** The node above this one, for a view that reveals one of its rows (the provider that built it sets it). */
  parent: Node | undefined;
  constructor(readonly kind: NodeKind, readonly repo: Repository, readonly data: NodeData = {}) {}
}

/** What the views need of the extension: the repositories found, the check sections of one, and the file a finding names. */
export interface ViewHost {
  readonly repos: Repository[];
  readonly handles: Handles;
  sectionNames(repo: Repository): Promise<string[]>;
  resolveFile(folder: vscode.WorkspaceFolder, file: string): Promise<vscode.Uri | null>;
  /** The most rows of one noun a view lists before it says how many more there are (the setting `if-console.rowLimit`). */
  rowLimit(): number;
}

export const icon = (id: string, color?: string): vscode.ThemeIcon => new vscode.ThemeIcon(id, color ? new vscode.ThemeColor(color) : undefined);

/** A codicon colored by its status (FR-038): the same mapping in every view. */
export function statusIcon(status: Status): vscode.ThemeIcon {
  const look = lookOf(status);
  return icon(look.icon, look.color);
}

export const CATEGORY_ICON: Record<string, string> = { read: 'eye', check: 'checklist', record: 'note', build: 'tools', generate: 'sync', decision: 'law', setup: 'gear' };

export const messageNode = (repo: Repository, text: string): Node => new Node('message', repo, { text });

export function stateNodes(repo: Repository): Node[] {
  const out = [messageNode(repo, repo.reason)];
  if (repo.state === 'untrusted') out.push(new Node('trust', repo));
  return out;
}

/** The accessibility label of a row: its text, then its description. */
export function speak(item: vscode.TreeItem, extra = ''): void {
  const label = typeof item.label === 'string' ? item.label : item.label?.label ?? '';
  item.accessibilityInformation = { label: [label, item.description ? String(item.description) : '', extra].filter(Boolean).join(', ') };
}

export abstract class BaseProvider implements vscode.TreeDataProvider<Node> {
  private readonly emitter = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(readonly host: ViewHost) {}

  refresh(): void { this.emitter.fire(undefined); }
  getParent(node: Node): Node | undefined { return node.parent; }
  protected repoNodes(): Node[] { return this.host.repos.map((r) => new Node('repo', r)); }

  protected repoItem(node: Node): vscode.TreeItem {
    const r = node.repo;
    const item = new vscode.TreeItem(r.name, vscode.TreeItemCollapsibleState.Expanded);
    item.description = `${r.folder.name}${r.state === 'ready' ? ` · ${r.audience}` : ''}`;
    item.iconPath = icon(r.state === 'ready' ? 'terminal' : r.state === 'untrusted' ? 'shield' : 'warning');
    item.contextValue = 'repo';
    item.tooltip = `${r.displayName}: ${r.state === 'ready' ? `the command line states its audience as "${r.audience}"` : r.reason}`;
    return item;
  }

  /** The rows every view draws the same way, or null for one the view draws itself. */
  protected baseItem(node: Node): vscode.TreeItem | null {
    switch (node.kind) {
      case 'repo': return this.repoItem(node);
      case 'message': {
        const text = node.data.text ?? '';
        const item = new vscode.TreeItem(text, vscode.TreeItemCollapsibleState.None);
        item.iconPath = icon('info');
        item.tooltip = text;
        return item;
      }
      case 'trust': {
        const item = new vscode.TreeItem('Trust this workspace', vscode.TreeItemCollapsibleState.None);
        item.iconPath = icon('shield');
        item.command = { command: 'if-console.trust', title: 'Trust this workspace' };
        item.tooltip = 'Opens VS Code\'s own Workspace Trust page. Trusting a workspace is a decision only you can make.';
        return item;
      }
      default: return null;
    }
  }

  abstract getTreeItem(node: Node): vscode.TreeItem;
  abstract getChildren(node?: Node): Promise<Node[]>;
}

/** Whether a window holds one repository to show, in which case a view lists its entries without a repository above them. */
export const single = (host: ViewHost): Repository | null => (host.repos.length === 1 ? host.repos[0] ?? null : null);
