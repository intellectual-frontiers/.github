// The resource panel (0043-if-console FR-042, FR-043, FR-014): the one webview a resource, a Learn topic and a dry run's changes open in. It is a
// singleton, so opening another reveals it instead of making a second; it keeps its history (back, forward, a breadcrumb); it draws the resource's
// JSON through the model of model/panel.ts, never a page the launcher rendered; and what it asks of the extension it asks by an index into what
// the extension itself put in the model, so that nothing a page says can name a command of its own.
import * as crypto from 'crypto';
import { statSync } from 'fs';
import * as nodePath from 'path';
import * as vscode from 'vscode';
import { t } from '../l10n';
import { redact } from '../model/context';
import { asNumber, asObject, asString } from '../model/json';
import { buildTopic, topicsOf, type Topic } from '../model/learn';
import { buildResource, copyable, heldOf, type Built, type PanelView, type Ref } from '../model/panel';
import { buildPreview, type Change } from '../model/preview';
import { checkSchema, type Action, type CommandDetail, type Doc } from '../model/wire';
import type { Log } from '../services/log';
import type { Repository } from '../services/repository';
import * as testMode from '../test-mode';

export const PANEL_TYPE = 'if-console.resource';

/** What the panel asks of the extension: each is the one path the same thing takes from anywhere else. */
export interface PanelHost {
  readonly extensionUri: vscode.Uri;
  readonly log: Log;
  repoByKey(key: unknown): Repository | null;
  /** Wait until the repositories are found (a restored panel is drawn only then). */
  whenReady(): Promise<void>;
  openRef(repo: Repository, ref: Ref): Promise<unknown>;
  runAction(repo: Repository, action: Action): Promise<unknown>;
  copyContext(repo: Repository, resource: string): Promise<unknown>;
  copy(text: string): Promise<void>;
  openFile(repo: Repository, path: string, line?: number): Promise<void>;
  showDiff(repo: Repository, detail: Pick<CommandDetail, 'id'>, change: Change): Promise<void>;
  learn(): Promise<unknown>;
  openTopic(repo: Repository, topic: string): Promise<unknown>;
  fail(e: unknown): void;
}

interface Restore { repoKey: string; argv: string[] | null; topic: string | null }

interface Entry {
  kind: 'resource' | 'topic' | 'preview';
  restore: Restore;
  key: string;
  label: string;
  built: Built;
  line: string | null;
  json: string;
  resource: string | null;
  allowed: Set<string>;
  topics: Topic[];
  detail?: Pick<CommandDetail, 'id'>;
  changes?: Change[];
  settled?: 'applied' | 'discarded';
}

const LABELS = (): Record<string, string> => ({
  back: t('Back'), forward: t('Forward'), refresh: t('Refresh'), side: t('Open to the Side'), more: t('More actions'), actions: t('Actions'),
  copyJson: t('Copy as JSON'), copyContext: t('Copy Context'), copyLine: t('Copy the command line'), copy: t('Copy'), run: t('Run'),
  decision: t('Decision'), history: t('History'), breadcrumb: t('Breadcrumb'), status: t('Status'), audience: t('Audience'),
  filter: t('Filter rows'), moreRows: t('{0} more rows are not shown here; the command line lists them all.'), sortBy: t('Sort by'), noMatches: t('No row matches.'), open: t('Open'), openFile: t('Open the file'), command: t('Command line'),
  allTopics: t('All topics'), next: t('Next topic'), yourself: t('You do this one'), terminal: t('Run in a terminal'),
  apply: t('Apply these changes'), discard: t('Discard'), applied: t('Accepted. The command is running.'), discarded: t('Discarded. Nothing was written.'), openDiff: t('Open Diff'),
});

export const dist = (extensionUri: vscode.Uri): vscode.Uri => vscode.Uri.joinPath(extensionUri, 'dist');

/** The page's shell: a strict policy that allows this extension's own script and styles by nonce and its own files by source, and the
 * codicon font the web components read their icons from. It holds no data: the model arrives in a message. */
export function shell(webview: Pick<vscode.Webview, 'cspSource' | 'asWebviewUri'>, root: vscode.Uri, nonce: string): string {
  const uri = (...p: string[]): string => webview.asWebviewUri(vscode.Uri.joinPath(root, ...p)).toString();
  const csp = `default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IF Console</title>
<link rel="stylesheet" href="${uri('panel.css')}" nonce="${nonce}">
<link rel="stylesheet" href="${uri('codicons', 'codicon.css')}" id="vscode-codicon-stylesheet" nonce="${nonce}">
</head>
<body>
<div id="app" role="region" aria-label="IF Console"></div>
<script nonce="${nonce}" src="${uri('webview.js')}"></script>
</body>
</html>`;
}

const inside = (v: unknown, max: number): number | undefined => { const n = asNumber(v, -1); return n >= 0 && n < max ? n : undefined; };

export class ResourcePanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private entries: Entry[] = [];
  private at = -1;
  private ready = false;
  private pending: { entry: Entry; resolve: (ok: boolean) => void } | null = null;
  private focus = false;

  constructor(private readonly host: PanelHost) {}

  // ---- what opens in it ------------------------------------------------------------------------------------------------------------

  /** A resource: a command's own JSON, drawn by what its data is. */
  async showDoc(repo: Repository, argv: string[], doc: Doc): Promise<void> {
    const ok = checkSchema(doc);
    if (!ok.ok) { void vscode.window.showInformationMessage(ok.message); return; }
    if (doc.kind === 'help' && typeof doc.data.topic === 'string') { await this.showTopicDoc(repo, doc, argv); return; }
    const ctx = { presentation: repo.list?.presentation ?? { views: [], nouns: [], references: [] }, isFile: (p: string) => this.isFile(repo, p) };
    const built = buildResource(doc, ctx);
    const resource = doc.id && doc.id !== 'all' ? `${doc.kind.replace(/-/g, '_')}:${doc.id}` : null;
    await this.push(this.entry(repo, 'resource', { repoKey: repo.key, argv, topic: null }, built, repo.line(argv), doc, resource, built.header.title));
  }

  async showTopicDoc(repo: Repository, doc: Doc, argv: string[] | null, topics: Topic[] = []): Promise<void> {
    const topic = asString(doc.data.topic, doc.id);
    const built = buildTopic(doc, { topics });
    await this.push(this.entry(repo, 'topic', { repoKey: repo.key, argv: argv ?? ['help', topic], topic }, built, repo.line(argv ?? ['help', topic]), doc, null, topic, topics));
  }

  /** A write's dry run: the change summary with Apply and Discard. Resolves to the person's choice; closing the panel or moving on is Discard. */
  review(repo: Repository, detail: Pick<CommandDetail, 'id' | 'category' | 'help' | 'title'>, changes: Change[]): Promise<boolean> {
    if (this.pending) this.settle(false);
    const built = buildPreview({ id: detail.id, title: repo.command(detail.id)?.title ?? detail.title, category: detail.category, help: detail.help }, changes, repo.name);
    const e = this.entry(repo, 'preview', { repoKey: repo.key, argv: null, topic: null }, built, null, null, null, built.header.title);
    e.detail = detail;
    e.changes = changes;
    e.key = `preview\n${detail.id}\n${Date.now()}`;
    return new Promise<boolean>((resolve) => { this.pending = { entry: e, resolve }; void this.push(e); });
  }

  private entry(repo: Repository, kind: Entry['kind'], restore: Restore, built: Built, line: string | null, doc: Doc | null, resource: string | null, label: string, topics: Topic[] = []): Entry {
    const json = doc ? JSON.stringify(doc, null, 2) : '';
    const hasContext = resource !== null && repo.has('context');
    return { kind, restore, key: kind === 'topic' ? `topic\n${repo.key}\n${restore.topic ?? ''}` : `${repo.key}\n${(restore.argv ?? []).join(' ')}`, label, built, line, json,
      resource: hasContext ? resource : null, allowed: copyable(built, line), topics };
  }

  private async push(e: Entry): Promise<void> {
    if (this.pending && e.kind !== 'preview') this.settle(false);   // moving on from a dry run is Discard: nothing is written
    const cur = this.entries[this.at];
    if (cur && cur.key === e.key) this.entries[this.at] = e;
    else { this.entries = [...this.entries.slice(0, this.at + 1), e]; this.at = this.entries.length - 1; }
    this.focus = true;
    this.show();
    await Promise.resolve();
  }

  // ---- the panel ----------------------------------------------------------------------------------------------------------------------

  private show(): void {
    const title = this.current()?.built.header.title ?? 'IF Console';
    if (this.panel) { this.panel.title = title; this.panel.reveal(undefined, false); this.post(); return; }
    const panel = vscode.window.createWebviewPanel(PANEL_TYPE, title, { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      { enableScripts: true, enableCommandUris: false, localResourceRoots: [dist(this.host.extensionUri)], retainContextWhenHidden: false });
    this.attach(panel);
  }

  private attach(panel: vscode.WebviewPanel): void {
    this.panel = panel;
    this.ready = false;
    const nonce = crypto.randomBytes(16).toString('hex');
    panel.webview.options = { enableScripts: true, enableCommandUris: false, localResourceRoots: [dist(this.host.extensionUri)] };
    panel.webview.html = shell(panel.webview, dist(this.host.extensionUri), nonce);
    // VS Code ignores the listener's result; the promise is returned so that a test can wait for what the message did.
    panel.webview.onDidReceiveMessage((m: unknown) => this.handle(m).catch((e: unknown) => this.host.fail(e)));
    panel.onDidDispose(() => { this.panel = null; this.ready = false; if (this.pending) this.settle(false); this.entries = []; this.at = -1; });
  }

  /** A panel VS Code brought back with the window: drawn again from what its page saved. */
  async restore(panel: vscode.WebviewPanel, state: unknown): Promise<void> {
    const saved = asObject(asObject(asObject(state).view).restore);
    const repoKey = asString(saved.repoKey);
    const argv = Array.isArray(saved.argv) ? (saved.argv as unknown[]).map((x) => asString(x)) : null;
    const topic = typeof saved.topic === 'string' ? saved.topic : null;
    this.panel?.dispose();
    this.attach(panel);
    await this.host.whenReady();
    const repo = this.host.repoByKey(repoKey);
    if (!repo || repo.state !== 'ready' || !argv) { panel.dispose(); return; }
    const r = await repo.launcher.run(argv);
    if (!r.doc || r.error) { panel.dispose(); return; }
    if (topic !== null) await this.showTopicDoc(repo, r.doc, argv, await this.topics(repo));
    else await this.showDoc(repo, argv, r.doc);
  }

  private async topics(repo: Repository): Promise<Topic[]> {
    const r = await repo.launcher.run(['help']);
    return r.doc ? topicsOf(r.doc) : [];
  }

  private current(): Entry | undefined { return this.entries[this.at]; }
  private repoOf(e: Entry): Repository | null { return this.host.repoByKey(e.restore.repoKey); }

  private view(e: Entry): PanelView {
    const preview = e.kind === 'preview';
    const crumbs = preview ? [{ label: e.label, current: true }] : this.entries.map((x, i) => ({ label: x.label, current: i === this.at }));
    const view: PanelView & { restore?: Restore } = { built: heldOf(e.built), context: e.resource !== null, line: e.line, labels: LABELS(),
      nav: { canBack: !preview && this.at > 0, canForward: !preview && this.at < this.entries.length - 1, crumbs }, ...(e.settled ? { settled: e.settled } : {}) };
    if (!preview) view.restore = e.restore;
    return view;
  }

  private post(): void {
    const e = this.current();
    if (!this.panel || !e) return;
    const view = this.view(e);
    testMode.note('webview', { title: this.panel.title, html: this.panel.webview.html, model: view });
    if (this.ready) { void this.panel.webview.postMessage({ type: 'model', view, focus: this.focus }); this.focus = false; }
  }

  /** The person's choice on a preview: it resolves the review, and the preview gives way to what the person was looking at, or, where
   * there was nothing before it, stays and says what was chosen. */
  private settle(ok: boolean): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    p.entry.settled = ok ? 'applied' : 'discarded';
    const at = this.entries.indexOf(p.entry);
    if (at > 0) {
      this.entries.splice(at, 1);
      this.at = Math.min(this.at, this.entries.length - 1);
      if (this.panel) { const e = this.current(); if (e) this.panel.title = e.built.header.title; this.focus = false; this.post(); }
    } else if (this.panel && this.current() === p.entry) this.post();
    p.resolve(ok);
  }

  /** A write has run: what the panel shows may now be out of date, so the resource in front of the person is asked for again. */
  async refreshCurrent(): Promise<void> {
    const e = this.current();
    const repo = e ? this.repoOf(e) : null;
    if (e && repo && this.panel && e.kind !== 'preview') await this.refresh(repo, e);
  }

  // ---- what the page says -------------------------------------------------------------------------------------------------------------

  /** One message from the page (or, in VS Code's test mode only, from a test through the hook). The page is not trusted: an index it names must
   * be one the model holds, a text it asks to copy must be one the model carries, and nothing it says is run as a command. */
  async handle(raw: unknown): Promise<void> {
    const m = asObject(raw);
    const type = asString(m.type);
    const e = this.current();
    if (type === 'ready') { this.ready = true; this.post(); return; }
    if (type === 'rendered') { testMode.note('rendered', { summary: m.summary, title: e?.built.header.title ?? '' }); return; }
    if (!e) return;
    const repo = this.repoOf(e);
    switch (type) {
      case 'back': return this.go(this.at - 1);
      case 'forward': return this.go(this.at + 1);
      case 'crumb': { const i = inside(m.index, this.entries.length); if (i !== undefined) this.go(i); return; }
      case 'side': this.panel?.reveal(vscode.ViewColumn.Beside, false); return;
      case 'scrollTo': void this.panel?.webview.postMessage({ type: 'scroll', section: asString(m.section) }); return;
      case 'refresh': return repo ? this.refresh(repo, e) : undefined;
      case 'topics': await this.host.learn(); return;
      case 'next': if (repo && e.built.next) await this.host.openTopic(repo, e.built.next.topic); return;
      case 'apply': if (e.kind === 'preview' && this.pending?.entry === e) this.settle(true); return;
      case 'discard': if (e.kind === 'preview' && this.pending?.entry === e) this.settle(false); return;
      case 'diff': {
        const i = inside(m.index, e.changes?.length ?? 0);
        const change = i === undefined ? undefined : e.changes?.[i];
        if (repo && change && e.detail) await this.host.showDiff(repo, e.detail, change);
        return;
      }
      case 'copy': { const text = asString(m.text); if (e.allowed.has(text)) await this.host.copy(text); return; }
      case 'copyLine': if (e.line) await this.host.copy(e.line); return;
      case 'copyJson': if (e.json) { await vscode.env.clipboard.writeText(redact(e.json, process.env.HOME)); void vscode.window.showInformationMessage(t('The resource, as JSON, is on the clipboard.')); } return;
      case 'copyContext': if (repo && e.resource) await this.host.copyContext(repo, e.resource); return;
      case 'file': {
        const path = asString(m.path);
        const known = new Set(e.built.sections.flatMap((s) => this.paths(s)));
        if (repo && known.has(path)) await this.host.openFile(repo, path, typeof m.line === 'number' ? m.line : undefined);
        return;
      }
      case 'open': {
        const i = inside(m.ref, e.built.held.refs.length);
        const ref = i === undefined ? undefined : e.built.held.refs[i];
        if (repo && ref && e.kind !== 'preview') await this.host.openRef(repo, ref);
        return;
      }
      case 'run': {
        const i = inside(m.action, e.built.held.actions.length);
        const action = i === undefined ? undefined : e.built.held.actions[i];
        if (repo && action && e.kind !== 'preview') await this.host.runAction(repo, action);
        return;
      }
      default: this.host.log.info(t('The panel was sent a message it does not know ({0}); nothing was done.', type.slice(0, 40)));
    }
  }

  /** Every file path the model holds, so that a page can open only a file the extension showed. */
  private paths(s: Built['sections'][number]): string[] {
    switch (s.type) {
      case 'kv': return s.items.flatMap((i) => (i.file ? [i.file.path] : []));
      case 'table': return s.rows.flatMap((r) => r.cells.flatMap((c) => (c.file ? [c.file.path] : [])));
      case 'findings': return s.groups.flatMap((g) => g.findings.flatMap((f) => (f.file ? [f.file.path] : [])));
      default: return [];
    }
  }

  private go(i: number): void {
    if (this.pending || i < 0 || i >= this.entries.length) return;
    this.at = i;
    this.focus = true;
    const e = this.current();
    if (this.panel && e) this.panel.title = e.built.header.title;
    this.post();
  }

  private async refresh(repo: Repository, e: Entry): Promise<void> {
    if (e.kind === 'preview' || !e.restore.argv) return;
    repo.forgetResources();
    const r = await repo.launcher.run(e.restore.argv);
    if (!r.doc || r.error) { this.host.fail(new Error(r.error?.message ?? r.failed ?? t('The command line gave nothing to show.'))); return; }
    if (e.kind === 'topic') await this.showTopicDoc(repo, r.doc, e.restore.argv, e.topics);
    else await this.showDoc(repo, e.restore.argv, r.doc);
  }

  private isFile(repo: Repository, path: string): boolean { return this.files.has(`${repo.key}\n${path}`) ? true : this.checkFile(repo, path); }
  private readonly files = new Set<string>();
  private checkFile(repo: Repository, path: string): boolean {
    const abs = nodePath.resolve(repo.root, path);
    const rel = nodePath.relative(repo.root, abs);
    if (rel.startsWith('..') || nodePath.isAbsolute(rel)) return false;
    try { if (!statSync(abs).isFile()) return false; } catch { return false; }
    this.files.add(`${repo.key}\n${path}`);
    return true;
  }

  dispose(): void { if (this.pending) this.settle(false); this.panel?.dispose(); this.panel = null; }

  /** For the test hook: what the panel holds now, in words. */
  describe(): { open: boolean; entries: string[]; at: number; pending: boolean } {
    return { open: this.panel !== null, entries: this.entries.map((x) => x.label), at: this.at, pending: this.pending !== null };
  }
}
