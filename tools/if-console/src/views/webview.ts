// A `read` command's HTML rendering (`--html`) in a webview (0043-if-console FR-011): it loads local resources only, runs no script from
// outside it (a Content Security Policy allows one inline script, this file's, and nothing remote), follows only links that name a command
// or a file in the clone, and adds no style beyond VS Code's theme variables around the rendering.
import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { asObject, asString } from '../model/json';
import type { Log } from '../services/log';
import type { Repository } from '../services/repository';
import * as testMode from '../test-mode';

const CLICK_SCRIPT = `const api = acquireVsCodeApi();
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('button[data-step]') : null;
  if (b && !b.disabled) { api.postMessage({ step: Number(b.getAttribute('data-step')) }); return; }
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  e.preventDefault();
  api.postMessage({ href: a.getAttribute('href') });
});`;
const THEME_STYLE = 'body { color: var(--vscode-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }';

export function wrap(html: string, cspSource: string, nonce: string): string {
  const csp = `default-src 'none'; img-src ${cspSource} data:; font-src ${cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
  const head = `<meta http-equiv="Content-Security-Policy" content="${csp}"><style nonce="${nonce}">${THEME_STYLE}</style>`;
  const tail = `<script nonce="${nonce}">${CLICK_SCRIPT}</script>`;
  let out = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');   // none comes from outside; the policy would refuse it anyway
  out = /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (m) => `${m}${head}`) : `<head>${head}</head>${out}`;
  return /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${tail}</body>`) : `${out}${tail}`;
}

export type LinkTarget = { kind: 'command'; words: string[] } | { kind: 'file'; file: string } | { kind: 'ignored' };

/** What a clicked link names: a file inside the clone, a command (if-console:<words>), or nothing this panel follows. */
export function classifyLink(href: unknown, root: string): LinkTarget {
  const h = asString(href);
  if (h.startsWith('if-console:')) return { kind: 'command', words: decodeURIComponent(h.slice('if-console:'.length)).trim().split(/\s+/) };
  if (/^[a-z][a-z0-9+.-]*:/i.test(h) && !/^file:/i.test(h)) return { kind: 'ignored' };
  const file = h.startsWith('file:') ? decodeURIComponent(h.replace(/^file:\/\//i, '')) : (h.split('#')[0] ?? '');
  if (file === '') return { kind: 'ignored' };
  const abs = path.resolve(root, file);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { kind: 'ignored' };
  return { kind: 'file', file: abs };
}

export interface HtmlView {
  repo: Pick<Repository, 'folder' | 'root'>;
  title: string;
  html: string;
  log: Log;
  onCommand?: (words: string[]) => Promise<unknown>;
  onStep?: (index: number) => Promise<unknown>;
}

export function openHtmlView({ repo, title, html, log, onCommand, onStep }: HtmlView): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel('if-console.view', title, vscode.ViewColumn.Beside,
    { enableScripts: true, enableCommandUris: false, localResourceRoots: [repo.folder.uri], retainContextWhenHidden: false });
  const nonce = crypto.randomBytes(16).toString('hex');
  panel.webview.html = wrap(html, panel.webview.cspSource, nonce);
  testMode.note('webview', { title, html });
  panel.webview.onDidReceiveMessage(async (raw: unknown) => {
    const m = asObject(raw);
    if (typeof m.step === 'number') { if (onStep) await onStep(m.step); return; }
    const link = classifyLink(m.href, repo.root);
    if (link.kind === 'file') await vscode.window.showTextDocument(vscode.Uri.file(link.file), { preview: true });
    else if (link.kind === 'command' && onCommand) await onCommand(link.words);
    else log.info(`A link in the view was not followed: it names neither a command nor a file in the clone (${asString(m.href).slice(0, 80)}).`);
  });
  return panel;
}
