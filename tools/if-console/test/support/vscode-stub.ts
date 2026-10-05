// A stand-in for the VS Code API, enough for the extension's code to run under Node's own test runner (0043-if-console FR-028). It records
// what the extension does (messages, diagnostics, tree items, registered commands) and answers prompts from a script the test sets. It is
// not VS Code: whether the real API behaves as this does is what the real-VS-Code run checks.
import Module from 'module';
import * as path from 'path';
import { promises as fsp } from 'fs';

export type Loose = any;

class EventEmitter {
  listeners: Array<(v: Loose) => void> = [];
  event = (fn: (v: Loose) => void): { dispose(): void } => { this.listeners.push(fn); return { dispose: () => { this.listeners = this.listeners.filter((l) => l !== fn); } }; };
  fire(v?: Loose): void { for (const l of [...this.listeners]) l(v); }
  dispose(): void { this.listeners = []; }
}

export class Uri {
  constructor(public scheme: string, public path: string, public raw?: string) {}
  get fsPath(): string { return this.path; }
  toString(): string { return this.raw ?? `${this.scheme}://${this.path}`; }
  static file(p: string): Uri { return new Uri('file', p); }
  static parse(s: string): Uri { const m = /^([a-z][a-z0-9+.-]*):(.*)$/i.exec(s) ?? ['', 'file', s]; return new Uri(m[1] as string, m[2] as string, s); }
  static joinPath(base: Uri, ...parts: string[]): Uri { return new Uri(base.scheme, path.join(base.path, ...parts)); }
  static from(c: { scheme: string; path?: string; query?: string }): Uri { const u = new Uri(c.scheme, c.path ?? ''); u.query = c.query ?? ''; return u; }
  query = '';
}
class Position { constructor(public line: number, public character: number) {} }
class Range {
  start: Position; end: Position;
  constructor(a: Loose, b: Loose, c?: Loose, d?: Loose) { if (typeof a === 'number') { this.start = new Position(a, b); this.end = new Position(c, d); } else { this.start = a; this.end = b; } }
}
class Location { constructor(public uri: Uri, public range: Loose) {} }
class Diagnostic { source?: string; constructor(public range: Range, public message: string, public severity: number) {} }
const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };
class ThemeIcon { constructor(public id: string, public color?: Loose) {} }
class ThemeColor { constructor(public id: string) {} }
class MarkdownString {
  value: string; isTrusted: Loose; supportHtml = false;
  constructor(value = '', public supportThemeIcons = false) { this.value = value; }
  appendMarkdown(v: string): MarkdownString { this.value += v; return this; }
  appendText(v: string): MarkdownString { this.value += v; return this; }
}
class FileDecoration { propagate = false; constructor(public badge?: string, public tooltip?: string, public color?: Loose) {} }
class CodeLens { command?: Loose; constructor(public range: Range, command?: Loose) { this.command = command; } }
class Hover { constructor(public contents: Loose, public range?: Range) {} }
class DocumentLink { tooltip?: string; constructor(public range: Range, public target?: Uri) {} }
class TreeItem { collapsibleState: number; [k: string]: Loose; constructor(public label: Loose, state?: number) { this.collapsibleState = state === undefined ? 0 : state; } }
const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
class Task { constructor(public definition: Loose, public scope: Loose, public name: string, public source: string, public execution: Loose) {} [k: string]: Loose }
class CustomExecution { constructor(public callback: Loose) {} }
class TestMessage { constructor(public message: string) {} [k: string]: Loose }
class RelativePattern { constructor(public base: Loose, public pattern: string) {} }
class McpStdioServerDefinition {
  [k: string]: Loose;
  constructor(label: string, command: string, args: string[], env: Loose, version: string) { Object.assign(this, { label, command, args, env, version }); }
}

export interface StubOptions { folders?: Loose[]; trusted?: boolean; config?: Record<string, Loose>; mcp?: boolean; workspaceConfig?: Record<string, Loose> }

export interface Stub {
  vscode: Loose;
  calls: Loose;
  script: { quickPicks: Loose[]; inputs: Loose[]; warnings: Loose[]; infos: Loose[]; errors: Loose[] };
  diagnostics: Map<string, Loose>;
}

export function createStub(options: StubOptions = {}): Stub {
  const calls: Loose = { contexts: new Map<string, Loose>(), progress: [], decorationProvider: null, languages: [], statusBar: [], treeViews: new Map<string, Loose>(), messages: [], commands: [], registered: new Map(), output: [], info: [], webviews: [], diffs: [], clipboard: [], tasks: null, mcp: null, textDocs: [], opened: [], watchers: [] };
  const script = { quickPicks: [] as Loose[], inputs: [] as Loose[], warnings: [] as Loose[], infos: [] as Loose[], errors: [] as Loose[] };
  const diagnostics = new Map<string, Loose>();
  const answer = (queue: Loose[], fallback: Loose): Loose => (queue.length ? queue.shift() : fallback);
  const folders = options.folders ?? [];
  const config = options.config ?? {};
  const vscode: Loose = {
    EventEmitter, Uri, Position, Range, Location, Diagnostic, DiagnosticSeverity, ThemeIcon, TreeItem, TreeItemCollapsibleState, Task, CustomExecution, RelativePattern,
    TestMessage, ThemeColor, MarkdownString, FileDecoration, CodeLens, Hover, DocumentLink, TaskGroup: { Build: 'build', Test: 'test' }, StatusBarAlignment: { Left: 1, Right: 2 }, ProgressLocation: { Notification: 15, Window: 10 },
    QuickPickItemKind: { Separator: -1, Default: 0 }, ExtensionMode: { Production: 1, Development: 2, Test: 3 }, ViewColumn: { Beside: -2 }, TestRunProfileKind: { Run: 1, Debug: 2, Coverage: 3 },
    window: {
      createOutputChannel: (name: string) => {
        const add = (l: string): void => { calls.output.push(l); };
        return { name, appendLine: add, info: add, warn: add, error: add, show() { /* nothing to show */ }, dispose() { /* nothing to free */ } };
      },
      createStatusBarItem: () => { const item = { text: '', tooltip: '' as Loose, command: '' as Loose, backgroundColor: undefined as Loose, visible: false, show() { this.visible = true; }, hide() { this.visible = false; }, dispose() { /* none */ } }; calls.statusBar.push(item); return item; },
      showQuickPick: (items: Loose[], opts: Loose) => {
        calls.messages.push({ kind: 'quickpick', title: opts?.title, items });
        let a = answer(script.quickPicks, undefined);
        if (typeof a === 'function') a = a(items, opts);
        // An answer is the value (or id, or label) of the item to choose, or an array of them for a multiple choice.
        const find = (v: Loose): Loose => items.find((i: Loose) => i.value === v || i.id === v || i.label === v);
        return Promise.resolve(Array.isArray(a) ? a.map(find) : a === undefined ? undefined : find(a));
      },
      showInputBox: (opts: Loose) => { calls.messages.push({ kind: 'input', opts }); const a = answer(script.inputs, undefined); return Promise.resolve(typeof a === 'function' ? a(opts) : a); },
      showInformationMessage: (text: string, ...rest: Loose[]) => { calls.messages.push({ kind: 'info', text, rest }); return Promise.resolve(answer(script.infos, undefined)); },
      showWarningMessage: (text: string, ...rest: Loose[]) => { calls.messages.push({ kind: 'warning', text, rest }); return Promise.resolve(answer(script.warnings, undefined)); },
      showErrorMessage: (text: string, ...rest: Loose[]) => { calls.messages.push({ kind: 'error', text, rest }); return Promise.resolve(answer(script.errors, undefined)); },
      withProgress: (opts: Loose, fn: Loose) => { calls.progress.push(opts); return fn({ report: (v: Loose) => calls.info.push(v) }, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() { /* none */ } }) }); },
      createTreeView: (id: string, o: Loose) => { const v = { id, o, title: undefined as Loose, description: undefined as Loose, badge: undefined as Loose, message: undefined as Loose, revealed: [] as Loose[], reveal(n: Loose, opts: Loose) { v.revealed.push([n, opts]); return Promise.resolve(); }, dispose() { /* none */ } }; calls.treeViews.set(id, v); return v; },
      registerFileDecorationProvider: (p: Loose) => { calls.decorationProvider = p; return { dispose() { /* none */ } }; },
      createWebviewPanel: (id: string, title: string, _col: Loose, opts: Loose) => {
        const p: Loose = { id, title, opts, webview: { html: '', cspSource: 'vscode-resource:', onDidReceiveMessage: (fn: Loose) => { p.onMessage = fn; return { dispose() { /* none */ } }; } }, dispose() { /* none */ } };
        calls.webviews.push(p);
        return p;
      },
      showTextDocument: (d: Loose) => { calls.opened.push(d); return Promise.resolve(d); },
      activeTextEditor: undefined,
      onDidChangeActiveTextEditor: () => ({ dispose() { /* none */ } }),
    },
    workspace: {
      workspaceFolders: folders, isTrusted: options.trusted !== false,
      getConfiguration: () => ({ inspect: (k: string) => ({ globalValue: config[k], workspaceValue: (options.workspaceConfig ?? {})[k] }), get: (k: string) => config[k] }),
      getWorkspaceFolder: (uri: Uri) => folders.find((f: Loose) => uri.fsPath === f.uri.fsPath || uri.fsPath.startsWith(f.uri.fsPath + path.sep)),
      onDidChangeWorkspaceFolders: () => ({ dispose() { /* none */ } }), onDidGrantWorkspaceTrust: () => ({ dispose() { /* none */ } }), onDidChangeConfiguration: () => ({ dispose() { /* none */ } }),
      onDidSaveTextDocument: (fn: Loose) => { calls.onSave = fn; return { dispose() { /* none */ } }; },
      registerTextDocumentContentProvider: (scheme: string, p: Loose) => { calls.contentProvider = { scheme, p }; return { dispose() { /* none */ } }; },
      createFileSystemWatcher: (pattern: Loose) => {
        const w: Loose = { pattern, handlers: [] as Array<(kind: string) => void>, disposed: false,
          onDidChange: (fn: Loose) => { w.handlers.push((k: string) => k === 'change' && fn()); return { dispose() { /* none */ } }; },
          onDidCreate: (fn: Loose) => { w.handlers.push((k: string) => k === 'create' && fn()); return { dispose() { /* none */ } }; },
          onDidDelete: (fn: Loose) => { w.handlers.push((k: string) => k === 'delete' && fn()); return { dispose() { /* none */ } }; },
          fire: (kind: string) => { w.handlers.forEach((h: Loose) => h(kind)); }, dispose() { w.disposed = true; } };
        calls.watchers.push(w);
        return w;
      },
      fs: { readFile: (uri: Uri) => fsp.readFile(uri.fsPath) },
      openTextDocument: (o: Loose) => { calls.textDocs.push(o); return Promise.resolve(o); },
      textDocuments: [] as Loose[],
      onDidOpenTextDocument: (fn: Loose) => { calls.onOpen = fn; return { dispose() { /* none */ } }; },
      asRelativePath: (u: Loose) => path.basename(u.fsPath ?? String(u)),
    },
    commands: {
      registerCommand: (id: string, fn: Loose) => { calls.registered.set(id, fn); return { dispose() { /* none */ } }; },
      executeCommand: (id: string, ...args: Loose[]) => { calls.commands.push({ id, args }); if (id === 'vscode.diff') calls.diffs.push(args); if (id === 'setContext') calls.contexts.set(args[0], args[1]); return Promise.resolve(undefined); },
    },
    languages: {
      registerHoverProvider: (selector: Loose, p: Loose) => { calls.languages.push({ kind: 'hover', selector, p }); return { dispose() { /* none */ } }; },
      registerDefinitionProvider: (selector: Loose, p: Loose) => { calls.languages.push({ kind: 'definition', selector, p }); return { dispose() { /* none */ } }; },
      registerCodeLensProvider: (selector: Loose, p: Loose) => { calls.languages.push({ kind: 'codelens', selector, p }); return { dispose() { /* none */ } }; },
      registerDocumentLinkProvider: (selector: Loose, p: Loose) => { calls.languages.push({ kind: 'links', selector, p }); return { dispose() { /* none */ } }; },
      createDiagnosticCollection: () => ({ clear: () => diagnostics.clear(), set: (u: Uri, d: Loose) => diagnostics.set(u.toString(), d), get: (u: Uri) => diagnostics.get(u.toString()), dispose() { /* none */ } }) },
    tests: { createTestController: (id: string, label: string) => makeController(id, label, calls) },
    tasks: { registerTaskProvider: (type: string, provider: Loose) => { calls.tasks = { type, provider }; return { dispose() { /* none */ } }; } },
    env: { clipboard: { writeText: (t: string) => Promise.resolve(calls.clipboard.push(t)) } },
  };
  if (options.mcp !== false) {
    vscode.McpStdioServerDefinition = McpStdioServerDefinition;
    vscode.lm = { registerMcpServerDefinitionProvider: (id: string, provider: Loose) => { calls.mcp = { id, provider }; return { dispose() { /* none */ } }; } };
  }
  return { vscode, calls, script, diagnostics };
}

function makeController(id: string, label: string, calls: Loose): Loose {
  const items = new Map<string, Loose>();
  const collection = { replace(list: Loose[]) { items.clear(); for (const i of list) items.set(i.id, i); }, add(i: Loose) { items.set(i.id, i); }, get(i: string) { return items.get(i); },
    forEach(fn: Loose) { items.forEach((v) => fn(v)); }, [Symbol.iterator]: () => items.entries() };
  const c: Loose = { id, label, items: collection, runs: [] as Loose[], profiles: [] as Loose[],
    createTestItem(i: string, l: string, uri?: Loose) {
      const kids = new Map<string, Loose>();
      return { id: i, label: l, uri, range: undefined as Loose, description: undefined as Loose,
        children: { add: (k: Loose) => kids.set(k.id, k), replace: (list: Loose[]) => { kids.clear(); for (const k of list) kids.set(k.id, k); }, delete: (k: string) => kids.delete(k), forEach: (fn: Loose) => kids.forEach((v) => fn(v)),
          get size() { return kids.size; } } };
    },
    createRunProfile(l: string, kind: number, handler: Loose, isDefault?: boolean) { c.profiles.push({ label: l, kind, handler, isDefault }); if (!c.handler) c.handler = handler; return { dispose() { /* none */ } }; },
    createTestRun() {
      const r: Loose = { log: [] as Loose[], enqueued: (t: Loose) => r.log.push(['enqueued', t.id]), started: (t: Loose) => r.log.push(['started', t.id]), passed: (t: Loose) => r.log.push(['passed', t.id]),
        failed: (t: Loose, m: Loose) => r.log.push(['failed', t.id, m]), skipped: (t: Loose) => r.log.push(['skipped', t.id]), errored: (t: Loose, m: Loose) => r.log.push(['errored', t.id, m]),
        appendOutput: () => undefined, end: () => r.log.push(['end']) };
      c.runs.push(r);
      return r;
    },
    dispose() { /* none */ } };
  calls.testController = c;
  return c;
}

interface Loader { _load: (request: string, parent: unknown, isMain: boolean) => unknown }

/** Make `require('vscode')` return the stub while the test runs, and drop the extension's cached modules so each test sees a fresh binding. */
export function install(stub: Stub): () => void {
  const loader = Module as unknown as Loader;
  const original = loader._load;
  loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
    if (request === 'vscode') return stub.vscode;
    return original.call(this, request, parent, isMain);
  };
  for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}src${path.sep}`)) delete require.cache[k];
  return () => { loader._load = original; };
}

export const folderOf = (name: string, root: string): Loose => ({ name, index: 0, uri: Uri.file(root) });
