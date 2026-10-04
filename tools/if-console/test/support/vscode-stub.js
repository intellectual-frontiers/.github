'use strict';
// A stand-in for the VS Code API, enough for the extension's code to run under Node's own test runner (0043-if-console FR-028).
// It records what the extension does (messages, diagnostics, tree items, registered commands) and answers prompts from a
// script the test sets. It is not VS Code: whether the real API behaves as this does is what the optional real-VS-Code run checks.
const Module = require('module');
const path = require('path');

class EventEmitter {
  constructor() { this.listeners = []; this.event = (fn) => { this.listeners.push(fn); return { dispose: () => { this.listeners = this.listeners.filter((l) => l !== fn); } }; }; }
  fire(v) { for (const l of [...this.listeners]) l(v); }
  dispose() { this.listeners = []; }
}

class Uri {
  constructor(scheme, p, raw) { this.scheme = scheme; this.path = p; this.raw = raw; }
  get fsPath() { return this.path; }
  toString() { return this.raw || `${this.scheme}://${this.path}`; }
  static file(p) { return new Uri('file', p); }
  static parse(s) { const m = /^([a-z][a-z0-9+.-]*):(.*)$/i.exec(s); return new Uri(m[1], m[2], s); }
  static joinPath(base, ...parts) { return new Uri(base.scheme, path.join(base.path, ...parts)); }
}
class Position { constructor(line, character) { this.line = line; this.character = character; } }
class Range { constructor(a, b, c, d) { if (typeof a === 'number') { this.start = new Position(a, b); this.end = new Position(c, d); } else { this.start = a; this.end = b; } } }
class Location { constructor(uri, range) { this.uri = uri; this.range = range; } }
class Diagnostic { constructor(range, message, severity) { this.range = range; this.message = message; this.severity = severity; } }
const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };
class ThemeIcon { constructor(id) { this.id = id; } }
class TreeItem { constructor(label, state) { this.label = label; this.collapsibleState = state === undefined ? 0 : state; } }
const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
class Task { constructor(def, scope, name, source, execution) { this.definition = def; this.scope = scope; this.name = name; this.source = source; this.execution = execution; } }
class CustomExecution { constructor(cb) { this.callback = cb; } }
class TestMessage { constructor(m) { this.message = m; } }
class McpStdioServerDefinition { constructor(label, command, args, env, version) { Object.assign(this, { label, command, args, env, version }); } }

function createStub(options = {}) {
  const calls = { messages: [], commands: [], registered: new Map(), output: [], info: [], webviews: [], diffs: [], clipboard: [], tasks: null, mcp: null, textDocs: [], opened: [] };
  const script = { quickPicks: [], inputs: [], warnings: [], infos: [], errors: [] };
  const diagnostics = new Map();
  const answer = (queue, fallback) => (queue.length ? queue.shift() : fallback);
  const folders = options.folders || [];
  const config = options.config || {};
  const vscode = {
    EventEmitter, Uri, Position, Range, Location, Diagnostic, DiagnosticSeverity, ThemeIcon, TreeItem, TreeItemCollapsibleState, Task, CustomExecution,
    TestMessage, TaskGroup: { Build: 'build', Test: 'test' }, StatusBarAlignment: { Left: 1, Right: 2 }, ProgressLocation: { Notification: 15 },
    QuickPickItemKind: { Separator: -1, Default: 0 }, ViewColumn: { Beside: -2 }, TestRunProfileKind: { Run: 1 },
    window: {
      createOutputChannel: (name) => ({ name, appendLine: (l) => calls.output.push(l), show() {}, dispose() {} }),
      createStatusBarItem: () => ({ text: '', tooltip: '', command: '', visible: false, show() { this.visible = true; }, hide() { this.visible = false; }, dispose() {} }),
      showQuickPick: async (items, opts) => { calls.messages.push({ kind: 'quickpick', title: opts && opts.title, items }); let a = answer(script.quickPicks, undefined);
        if (typeof a === 'function') a = a(items, opts);
        // An answer is the value (or id, or label) of the item to choose, or an array of them for a multiple choice.
        const find = (v) => items.find((i) => i.value === v || i.id === v || i.label === v);
        return Array.isArray(a) ? a.map(find) : a === undefined ? undefined : find(a); },
      showInputBox: async (opts) => { calls.messages.push({ kind: 'input', opts }); const a = answer(script.inputs, undefined); return typeof a === 'function' ? a(opts) : a; },
      showInformationMessage: async (text, ...rest) => { calls.messages.push({ kind: 'info', text, rest }); return answer(script.infos, undefined); },
      showWarningMessage: async (text, ...rest) => { calls.messages.push({ kind: 'warning', text, rest }); return answer(script.warnings, undefined); },
      showErrorMessage: async (text, ...rest) => { calls.messages.push({ kind: 'error', text, rest }); return answer(script.errors, undefined); },
      withProgress: async (opts, fn) => fn({ report: (v) => calls.info.push(v) }, { onCancellationRequested: () => ({ dispose() {} }), isCancellationRequested: false }),
      createTreeView: (id, o) => ({ id, o, dispose() {} }),
      createWebviewPanel: (id, title, col, opts) => { const p = { id, title, opts, webview: { html: '', cspSource: 'vscode-resource:', onDidReceiveMessage: (fn) => { p.onMessage = fn; return { dispose() {} }; } }, dispose() {} }; calls.webviews.push(p); return p; },
      showTextDocument: async (d) => { calls.opened.push(d); return d; },
      activeTextEditor: undefined,
      onDidChangeActiveTextEditor: () => ({ dispose() {} }),
    },
    workspace: {
      workspaceFolders: folders, isTrusted: options.trusted !== false,
      getConfiguration: () => ({ inspect: (k) => ({ globalValue: config[k], workspaceValue: (options.workspaceConfig || {})[k] }), get: (k) => config[k] }),
      getWorkspaceFolder: (uri) => folders.find((f) => uri.fsPath === f.uri.fsPath || uri.fsPath.startsWith(f.uri.fsPath + path.sep)),
      onDidChangeWorkspaceFolders: () => ({ dispose() {} }), onDidGrantWorkspaceTrust: () => ({ dispose() {} }), onDidChangeConfiguration: () => ({ dispose() {} }),
      onDidSaveTextDocument: (fn) => { calls.onSave = fn; return { dispose() {} }; },
      registerTextDocumentContentProvider: (scheme, p) => { calls.contentProvider = { scheme, p }; return { dispose() {} }; },
      createFileSystemWatcher: () => ({ onDidChange: () => ({ dispose() {} }), onDidCreate: () => ({ dispose() {} }), onDidDelete: () => ({ dispose() {} }), dispose() {} }),
      fs: { readFile: async (uri) => require('fs').promises.readFile(uri.fsPath) },
      openTextDocument: async (o) => { calls.textDocs.push(o); return o; },
    },
    commands: {
      registerCommand: (id, fn) => { calls.registered.set(id, fn); return { dispose() {} }; },
      executeCommand: async (id, ...args) => { calls.commands.push({ id, args }); if (id === 'vscode.diff') calls.diffs.push(args); return undefined; },
    },
    languages: { createDiagnosticCollection: () => ({ clear: () => diagnostics.clear(), set: (u, d) => diagnostics.set(u.toString(), d), get: (u) => diagnostics.get(u.toString()), dispose() {} }) },
    tests: { createTestController: (id, label) => makeController(id, label, calls) },
    tasks: { registerTaskProvider: (type, provider) => { calls.tasks = { type, provider }; return { dispose() {} }; } },
    env: { clipboard: { writeText: async (t) => calls.clipboard.push(t) } },
  };
  if (options.mcp !== false) {
    vscode.McpStdioServerDefinition = McpStdioServerDefinition;
    vscode.lm = { registerMcpServerDefinitionProvider: (id, provider) => { calls.mcp = { id, provider }; return { dispose() {} }; } };
  }
  return { vscode, calls, script, diagnostics };
}

function makeController(id, label, calls) {
  const items = new Map();
  const collection = { replace(list) { items.clear(); for (const i of list) items.set(i.id, i); }, add(i) { items.set(i.id, i); }, forEach(fn) { items.forEach((v) => fn(v)); },
    [Symbol.iterator]: () => items.entries() };
  const c = { id, label, items: collection, runs: [], createTestItem(i, l) { const kids = new Map(); return { id: i, label: l, children: { add: (k) => kids.set(k.id, k), forEach: (fn) => kids.forEach((v) => fn(v)) } }; },
    createRunProfile(l, kind, handler) { c.handler = handler; return { dispose() {} }; },
    createTestRun() { const r = { log: [], enqueued: (t) => r.log.push(['enqueued', t.id]), started: (t) => r.log.push(['started', t.id]), passed: (t) => r.log.push(['passed', t.id]),
      failed: (t, m) => r.log.push(['failed', t.id, m]), skipped: (t) => r.log.push(['skipped', t.id]), errored: (t, m) => r.log.push(['errored', t.id, m]), appendOutput: () => {}, end: () => r.log.push(['end']) }; c.runs.push(r); return r; },
    dispose() {} };
  calls.testController = c;
  return c;
}

// Make `require('vscode')` return the stub while the test runs.
function install(stub) {
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'vscode') return stub.vscode;
    return original.call(this, request, parent, isMain);
  };
  // Drop the extension's cached modules so each test sees a fresh binding of `vscode`.
  for (const k of Object.keys(require.cache)) if (k.includes(`${path.sep}src${path.sep}`)) delete require.cache[k];
  return () => { Module._load = original; };
}

const folderOf = (name, root) => ({ name, index: 0, uri: Uri.file(root) });

module.exports = { createStub, install, folderOf, Uri };
