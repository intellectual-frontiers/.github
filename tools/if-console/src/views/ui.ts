// The interface the executor talks to, made of VS Code's own parts: quick picks and input boxes for forms, the diff editor for a dry run's
// changes, a modal for a decision, progress for a stream. Plain words throughout (0043-if-console FR-025).
import * as path from 'path';
import * as vscode from 'vscode';
import type { PickItem } from '../model/forms';
import { asString } from '../model/json';
import { sides, summaryOf, type Change } from '../model/preview';
import type { CommandDetail, Doc } from '../model/wire';
import type { Ui } from '../services/executor';
import type { Cancellation, RunResult } from '../services/launcher';
import type { Log } from '../services/log';
import type { Running } from '../services/running';
import type { Repository } from '../services/repository';
import * as testMode from '../test-mode';
import { t } from '../l10n';

export const SCHEME = 'if-console-diff';

/** The text the diff editor shows for each side: kept in memory, served by a virtual document provider. Nothing is written. */
export class DiffDocuments implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly docs = new Map<string, string>();
  private n = 0;
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  get onDidChange(): vscode.Event<vscode.Uri> { return this.emitter.event; }
  provideTextDocumentContent(uri: vscode.Uri): string { return this.docs.get(uri.toString()) ?? ''; }
  put(side: string, name: string, text: string): vscode.Uri {
    this.n += 1;
    const uri = vscode.Uri.parse(`${SCHEME}:/${this.n}/${side}/${name.replace(/^\/+/, '')}`);
    this.docs.set(uri.toString(), text);
    return uri;
  }
  dispose(): void { this.docs.clear(); this.emitter.dispose(); }
}

/** The words a stream's line says about its progress. */
export const streamWords = (doc: Doc | null): string => {
  const d = doc?.data ?? {};
  return asString(d.message || d.label || d.step || d.status || doc?.id);
};

export async function readText(repo: Repository, file: string): Promise<string | null> {
  const uri = path.isAbsolute(file) ? vscode.Uri.file(file) : vscode.Uri.joinPath(repo.folder.uri, file);
  try { return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)); } catch { return null; }
}

export interface UiParts {
  log: Log;
  /** The view that started the work now, if one did, so that its progress shows there (FR-038). */
  where?: () => string | null;
  /** The commands running, which a Stop action in a view's title ends. */
  running?: Running;
  /** Shows a dry run's changes in the resource panel and resolves to the person's choice to apply them or not. */
  review: (repo: Repository, detail: CommandDetail, changes: Change[]) => Promise<boolean>;
  /** What to do with a command's result once it has run. */
  showResult: (repo: Repository, detail: CommandDetail, argv: string[], real: RunResult) => Promise<void>;
}

export function createUi({ log, showResult, where, running, review }: UiParts): Ui {
  const ui: Ui = {
    async pick<V>({ title, placeholder, items, canPickMany }: { title?: string; placeholder?: string; items: Array<PickItem<V>>; canPickMany?: boolean }): Promise<V | V[] | undefined> {
      const shown = items.map((i) => ({ label: i.label, description: i.description, detail: i.detail, value: i.value, picked: false }));
      testMode.note('quickpick', { title: title ?? '', placeholder: placeholder ?? '', items: shown.map((i) => i.label) });
      const options = { title, placeHolder: placeholder, ignoreFocusOut: true, matchOnDescription: true };
      if (canPickMany) {
        const many = await vscode.window.showQuickPick(shown, { ...options, canPickMany: true });
        return many === undefined ? undefined : many.map((g) => g.value);
      }
      const got = await vscode.window.showQuickPick(shown, options);
      return got === undefined ? undefined : got.value;
    },
    input: ({ title, prompt, placeholder, value, validate }) =>
      Promise.resolve(vscode.window.showInputBox({ title, prompt, placeHolder: placeholder, value, ignoreFocusOut: true, validateInput: validate })),
    async copy(text: string): Promise<void> {
      await vscode.env.clipboard.writeText(text);
      void vscode.window.showInformationMessage(t('The command line is on the clipboard.'));
    },

    progress<T>(title: string, fn: (token: Cancellation, report: (doc: Doc) => void) => Promise<T>): Promise<T> {
      const view = where ? where() : null;
      const said = (progress: vscode.Progress<{ message?: string }>) => (doc: Doc): void => { const w = streamWords(doc); if (w) progress.report({ message: w }); };
      // Work a view started is shown in that view, and ended by the Stop action in its title; any other is a notification with its own Cancel.
      if (view && running) {
        const source = running.begin();
        return Promise.resolve(vscode.window.withProgress({ location: { viewId: view }, title }, (progress) => {
          const sub = source.token.onCancellationRequested(() => log.info('The person cancelled the command; its process was ended.'));
          return fn(source.token, said(progress)).finally(() => { sub.dispose(); running.done(source); });
        }));
      }
      return Promise.resolve(vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: true }, (progress, token) => {
        const sub = token.onCancellationRequested(() => log.info('The person cancelled the command; its process was ended.'));
        return fn(token, said(progress)).finally(() => { sub.dispose(); });
      }));
    },

    async showFailure(repo: Repository, detail: CommandDetail, r: RunResult): Promise<void> {
      const words = r.error ? r.error.message : r.failed ? `${repo.program} could not run "${detail.id}": ${r.failed}` : `"${detail.id}" did not finish (exit ${String(r.exit)}).`;
      log.error(`${detail.id}: ${words}`);
      const pick = await vscode.window.showErrorMessage(words, t('Show Output'));
      if (pick === 'Show Output') log.show(true);
    },

    /** The change summary in the resource panel, with Apply and Discard, and each file as a diff on request (FR-014, FR-042). */
    reviewChanges: ({ repo, detail, changes }): Promise<boolean> => review(repo, detail, changes),

    /** A write whose dry run lists no files (a fetch, for example): show what it said and ask. */
    async reviewWithoutFiles({ detail, doc }): Promise<boolean> {
      const shown = await vscode.workspace.openTextDocument({ language: 'json', content: JSON.stringify(doc.data, null, 2) });
      await vscode.window.showTextDocument(shown, { preview: true, preserveFocus: true });
      const pick = await vscode.window.showInformationMessage(
        `The dry run of "${detail.id}" lists no files. Its result is open beside this message. Run it for real?`, { modal: true }, 'Run it');
      return pick === 'Run it';
    },

    /** A decision: a modal that names the command, the resource and what it changes, shown after the dry run (FR-015). */
    async confirmDecision({ repo, detail, argv, changes, line }): Promise<boolean> {
      const what = changes.length ? summaryOf(changes) : 'The dry run lists no files.';
      const resource = argv.slice(detail.words.length).filter((a) => !a.startsWith('-')).join(' ') || '(none)';
      const message = `${repo.name}: ${detail.id} is a decision only you can make.`;
      const options = { modal: true, detail: t('Command: {0}\nResource: {1}\nWhat it changes: {2}\n\n{3}', line, resource, what, detail.help) };
      const button = 'Make this decision';
      // In VS Code's test mode only, a test answers the modal through the hook (0043 FR-033); otherwise VS Code shows it.
      if (testMode.active()) return testMode.answerModal({ message, modal: options.modal, detail: options.detail, buttons: [button] }, button) === button;
      const pick = await vscode.window.showWarningMessage(message, options, button);
      return pick === button;
    },

    showResult,
  };
  return ui;
}

/** One file of a dry run as VS Code's diff editor: the file as it is now against the file as the change would leave it. Nothing is written. */
export async function openDiff(docs: DiffDocuments, repo: Repository, detail: Pick<CommandDetail, 'id'>, c: Change): Promise<void> {
  const before = c.change === 'create' ? '' : await readText(repo, c.path);
  const s = sides(c, before);
  const left = docs.put('before', c.path, s.before);
  const right = docs.put('after', c.path, s.after);
  await vscode.commands.executeCommand('vscode.diff', left, right, `${path.basename(c.path)} (before, after) - dry run of ${detail.id}`);
}
