'use strict';
// The three views (0043-if-console FR-008, FR-019, FR-010): Command Lines (repository -> nouns -> commands and resources ->
// links and actions), Chores, and Checks. Every entry is built from what a launcher returned.
const vscode = require('vscode');
const wire = require('./wire');
const forms = require('./forms');
const chores = require('./chores');
const diagnostics = require('./diagnostics');

const MAX_RESOURCES = 200;

class Node {
  constructor(kind, repo, data) { this.kind = kind; this.repo = repo; this.data = data || {}; }
}

const icon = (id) => new vscode.ThemeIcon(id);
const CATEGORY_ICON = { read: 'eye', check: 'checklist', record: 'note', build: 'tools', generate: 'sync', decision: 'law', setup: 'gear' };

function messageNode(repo, text, extra) { return new Node('message', repo, { text, ...extra }); }

function stateNodes(repo) {
  const out = [messageNode(repo, repo.reason)];
  if (repo.state === 'untrusted') out.push(new Node('trust', repo, {}));
  return out;
}

class BaseProvider {
  constructor(app) {
    this.app = app;
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
  }
  refresh() { this.emitter.fire(undefined); }
  getParent() { return undefined; }
  repoNodes() { return this.app.repos.map((r) => new Node('repo', r)); }
  repoItem(node) {
    const r = node.repo;
    const item = new vscode.TreeItem(r.name, vscode.TreeItemCollapsibleState.Expanded);
    item.description = `${r.folder.name}${r.state === 'ready' ? ` - ${r.audience}` : ''}`;
    item.iconPath = icon(r.state === 'ready' ? 'terminal' : r.state === 'untrusted' ? 'shield' : 'warning');
    item.contextValue = 'repo';
    return item;
  }
  baseItem(node) {
    switch (node.kind) {
      case 'repo': return this.repoItem(node);
      case 'message': {
        const item = new vscode.TreeItem(node.data.text, vscode.TreeItemCollapsibleState.None);
        item.iconPath = icon('info');
        item.tooltip = node.data.text;
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
}

// --- Command Lines ---------------------------------------------------------------------------------------------------
class CommandsProvider extends BaseProvider {
  getTreeItem(node) {
    const base = this.baseItem(node);
    if (base) return base;
    const d = node.data;
    let item;
    switch (node.kind) {
      case 'wide': item = new vscode.TreeItem('Repository-wide', vscode.TreeItemCollapsibleState.Collapsed); item.iconPath = icon('root-folder'); item.description = 'commands that take no noun'; break;
      case 'noun': item = new vscode.TreeItem(d.noun, vscode.TreeItemCollapsibleState.Collapsed); item.iconPath = icon('symbol-namespace'); item.description = d.help || ''; break;
      case 'command':
        item = new vscode.TreeItem(d.command.id, vscode.TreeItemCollapsibleState.None);
        item.description = d.command.category; item.tooltip = d.command.help;
        item.iconPath = icon(CATEGORY_ICON[d.command.category] || 'play');
        item.command = { command: 'if-console.activateNode', title: 'Run', arguments: [node] };
        break;
      case 'resource': item = new vscode.TreeItem(d.label, vscode.TreeItemCollapsibleState.Collapsed); item.iconPath = icon('symbol-file'); item.description = d.rel || ''; item.contextValue = 'resource'; break;
      case 'more': item = new vscode.TreeItem(d.text, vscode.TreeItemCollapsibleState.None); item.iconPath = icon('ellipsis'); break;
      case 'link': item = new vscode.TreeItem(d.label, vscode.TreeItemCollapsibleState.Collapsed); item.description = d.rel; item.iconPath = icon('link'); item.contextValue = 'resource'; break;
      case 'action': {
        const a = d.action;
        item = new vscode.TreeItem(a.label, vscode.TreeItemCollapsibleState.None);
        item.description = a.enabled ? a.category || '' : `unavailable: ${a.reason}`;
        item.iconPath = icon(a.enabled ? CATEGORY_ICON[a.category] || 'play' : 'circle-slash');
        item.contextValue = a.enabled ? 'action' : 'action-disabled';
        item.tooltip = a.enabled ? (a.cli || 'This needs a value you choose when you run it.') : a.reason;
        if (a.enabled) item.command = { command: 'if-console.activateNode', title: 'Run', arguments: [node] };
        break;
      }
      default: item = new vscode.TreeItem(String(node.kind));
    }
    item.accessibilityInformation = { label: `${item.label}${item.description ? `, ${item.description}` : ''}` };
    return item;
  }

  async getChildren(node) {
    if (!node) return this.repoNodes();
    const repo = node.repo;
    switch (node.kind) {
      case 'repo': {
        if (repo.state !== 'ready') return stateNodes(repo);
        const { nouns, repoWide } = repo.nouns();
        const out = [];
        if (repoWide.length) out.push(new Node('wide', repo, { commands: repoWide }));
        for (const [noun, commands] of nouns) out.push(new Node('noun', repo, { noun, commands, help: repo.list.nounHelp && repo.list.nounHelp[noun] }));
        return out;
      }
      case 'wide': return node.data.commands.map((c) => new Node('command', repo, { command: c }));
      case 'noun': {
        const out = node.data.commands.map((c) => new Node('command', repo, { command: c }));
        const links = await repo.resources(node.data.noun, MAX_RESOURCES + 1);
        for (const l of links.slice(0, MAX_RESOURCES)) out.push(new Node('resource', repo, { link: l, label: String(Object.values(l.fields)[0] || l.command), rel: l.rel }));
        if (links.length > MAX_RESOURCES) out.push(new Node('more', repo, { text: `Only the first ${MAX_RESOURCES} are shown; use Run Command to choose any.` }));
        return out;
      }
      case 'resource': case 'link': return this.resourceChildren(node);
      default: return [];
    }
  }

  async resourceChildren(node) {
    const repo = node.repo;
    const link = node.data.link;
    let detail;
    try { detail = await repo.detail(link.command); } catch (e) { return [messageNode(repo, e.message)]; }
    const r = await repo.launcher.run(forms.argvFromFields(detail, link.fields));
    if (!r.doc || r.error) return [messageNode(repo, r.error ? r.error.message : `${repo.program} did not return this resource.`)];
    const check = wire.checkSchema(r.doc);
    if (!check.ok) return [messageNode(repo, check.message)];
    const out = wire.linksOf(r.doc).slice(0, MAX_RESOURCES).map((l) => new Node('link', repo,
      { link: l, label: String(Object.values(l.fields)[0] || l.command), rel: l.rel }));
    out.push(...wire.actionsOf(r.doc).map((a) => new Node('action', repo, { action: a })));
    return out.length ? out : [messageNode(repo, 'This resource has no links or actions.')];
  }
}

// --- Chores ------------------------------------------------------------------------------------------------------------
class ChoresProvider extends BaseProvider {
  getTreeItem(node) {
    const base = this.baseItem(node);
    if (base) return base;
    const d = node.data;
    let item;
    if (node.kind === 'group') {
      item = new vscode.TreeItem(d.group.label, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = icon('list-unordered');
    } else if (node.kind === 'chore') {
      const c = d.chore;
      item = new vscode.TreeItem(c.label, vscode.TreeItemCollapsibleState.None);
      item.description = c.description || '';
      item.tooltip = c.description || c.label;
      item.iconPath = icon(c.kind === 'note' ? 'warning' : CATEGORY_ICON[c.category || (c.action && c.action.category)] || (c.kind === 'ext' ? 'question' : 'play'));
      if (c.kind !== 'note') item.command = { command: 'if-console.activateNode', title: 'Do it', arguments: [node] };
    } else {
      item = new vscode.TreeItem(d.text || '', vscode.TreeItemCollapsibleState.None);
      item.iconPath = icon('info');
    }
    item.accessibilityInformation = { label: `${item.label}${item.description ? `, ${item.description}` : ''}` };
    return item;
  }
  async getChildren(node) {
    if (!node) return this.repoNodes();
    if (node.kind === 'repo') {
      if (node.repo.state !== 'ready') return stateNodes(node.repo);
      return chores.deriveChores(node.repo).map((g) => new Node('group', node.repo, { group: g }));
    }
    if (node.kind === 'group') {
      const g = node.data.group;
      if (!g.items.length && g.empty) return [new Node('empty', node.repo, { text: g.empty })];
      return g.items.map((c) => new Node('chore', node.repo, { chore: c }));
    }
    return [];
  }
}

// --- Checks ----------------------------------------------------------------------------------------------------------
class ChecksProvider extends BaseProvider {
  getTreeItem(node) {
    const base = this.baseItem(node);
    if (base) return base;
    const d = node.data;
    let item;
    if (node.kind === 'section') {
      const r = d.result;
      item = new vscode.TreeItem(d.name, r && r.status === 'failed' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
      item.description = r ? (r.status === 'skipped' ? `skipped${r.reason ? `: ${r.reason}` : ''}` : r.status) : 'not run yet';
      item.iconPath = icon(!r ? 'circle-outline' : r.status === 'passed' ? 'pass' : r.status === 'failed' ? 'error' : 'debug-step-over');
      item.contextValue = 'section';
      item.command = { command: 'if-console.activateNode', title: 'Run this section', arguments: [node] };
    } else if (node.kind === 'finding') {
      const f = d.finding;
      item = new vscode.TreeItem(f.message, vscode.TreeItemCollapsibleState.None);
      item.description = f.where;
      item.tooltip = `${f.message}${f.next ? `\nNext: ${f.next}` : ''}`;
      item.iconPath = icon(f.level === 'error' ? 'error' : 'warning');
      if (d.uri) item.command = { command: 'vscode.open', title: 'Open', arguments: [d.uri, { selection: new vscode.Range(d.line, 0, d.line, 0) }] };
    } else {
      item = new vscode.TreeItem(d.text || '', vscode.TreeItemCollapsibleState.None);
    }
    item.accessibilityInformation = { label: `${item.label}${item.description ? `, ${item.description}` : ''}` };
    return item;
  }
  async getChildren(node) {
    if (!node) return this.repoNodes();
    const repo = node.repo;
    if (node.kind === 'repo') {
      if (repo.state !== 'ready') return stateNodes(repo);
      const names = await this.app.sectionNames(repo);
      if (!names.length) return [messageNode(repo, 'This command line lists no check sections.')];
      return names.map((name) => new Node('section', repo, { name, result: repo.checks.get(name) }));
    }
    if (node.kind === 'section') {
      const r = node.data.result;
      if (!r) return [];
      const out = [];
      for (const f of r.findings) {
        const loc = diagnostics.locate(f.where);
        const uri = loc ? await this.app.resolveFile(repo.folder, loc.file) : null;
        out.push(new Node('finding', repo, { finding: f, uri, line: loc ? Math.max(0, loc.line - 1) : 0 }));
      }
      return out;
    }
    return [];
  }
}

module.exports = { Node, CommandsProvider, ChoresProvider, ChecksProvider, MAX_RESOURCES };
