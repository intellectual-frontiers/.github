'use strict';
// The interface the executor talks to, made of VS Code's own parts: quick picks and input boxes for forms, the diff editor for
// a dry run's changes, a modal for a decision, progress for a stream. Plain words throughout (0043-if-console FR-025).
const vscode = require('vscode');
const wire = require('./wire');
const preview = require('./preview');
const path = require('path');
const testmode = require('./testmode');

const SCHEME = 'if-console-diff';

// The text the diff editor shows for each side: kept in memory, served by a virtual document provider. Nothing is written.
class DiffDocuments {
  constructor() { this.docs = new Map(); this.n = 0; this.emitter = new vscode.EventEmitter(); }
  get onDidChange() { return this.emitter.event; }
  provideTextDocumentContent(uri) { return this.docs.get(uri.toString()) || ''; }
  put(side, name, text) {
    this.n += 1;
    const uri = vscode.Uri.parse(`${SCHEME}:/${this.n}/${side}/${name.replace(/^\/+/, '')}`);
    this.docs.set(uri.toString(), text);
    return uri;
  }
  dispose() { this.docs.clear(); this.emitter.dispose(); }
}

const streamWords = (doc) => {
  const d = (doc && doc.data) || {};
  return String(d.message || d.label || d.step || d.status || (doc && doc.id) || '');
};

async function readText(repo, file) {
  const uri = path.isAbsolute(file) ? vscode.Uri.file(file) : vscode.Uri.joinPath(repo.folder.uri, file);
  try { return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)); } catch (e) { return null; }
}

function createUi({ docs, output }) {
  const ui = {
    async pick({ title, placeholder, items, canPickMany }) {
      const shown = items.map((i) => ({ label: i.label, description: i.description, detail: i.detail, value: i.value, picked: false }));
      testmode.note('quickpick', { title: title || '', placeholder: placeholder || '', items: shown.map((i) => i.label) });
      const got = await vscode.window.showQuickPick(shown, { title, placeHolder: placeholder, canPickMany: !!canPickMany,
        ignoreFocusOut: true, matchOnDescription: true });
      if (got === undefined) return undefined;
      return Array.isArray(got) ? got.map((g) => g.value) : got.value;
    },
    async input({ title, prompt, placeholder, value, validate }) {
      return vscode.window.showInputBox({ title, prompt, placeHolder: placeholder, value, ignoreFocusOut: true, validateInput: validate });
    },
    async copy(text) { await vscode.env.clipboard.writeText(text); vscode.window.showInformationMessage('The command line is on the clipboard.'); },

    progress(title, fn) {
      return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: true }, (progress, token) => {
        const controller = new AbortController();
        const sub = token.onCancellationRequested(() => { controller.abort(); output.appendLine('The person cancelled the command; its process was ended.'); });
        return Promise.resolve(fn(controller.signal, (doc) => { const w = streamWords(doc); if (w) progress.report({ message: w }); }))
          .finally(() => sub.dispose());
      });
    },

    async showFailure(repo, detail, r) {
      const e = r.error;
      const words = e ? e.message : r.failed ? `${repo.program} could not run "${detail.id}": ${r.failed}` : `"${detail.id}" did not finish (exit ${r.exit}).`;
      output.appendLine(`${detail.id}: ${words}`);
      const pick = await vscode.window.showErrorMessage(words, 'Show Output');
      if (pick === 'Show Output') output.show(true);
    },

    // Each file the change would touch as a diff, from the dry run's resource, and a choice to apply it or not (FR-014).
    async reviewChanges({ repo, detail, changes }) {
      const items = [{ label: '$(check) Apply these changes', description: preview.summaryOf(changes), value: 'apply' },
        ...changes.map((c, i) => ({ label: `$(diff) ${c.path}`, description: `${preview.labelOfChange(c)}, +${c.added} -${c.removed}`, value: i })),
        { label: '$(close) Do not apply', value: 'cancel' }];
      for (;;) {
        const picked = await ui.pick({ title: `${detail.id}: what would change`, placeholder: 'Open a file to see its diff, then apply or leave it',
          items });
        if (picked === undefined || picked === 'cancel') return false;
        if (picked === 'apply') return true;
        const c = changes[picked];
        const before = c.change === 'create' ? '' : await readText(repo, c.path);
        const s = preview.sides(c, before);
        const left = docs.put('before', c.path, s.before);
        const right = docs.put('after', c.path, s.after);
        await vscode.commands.executeCommand('vscode.diff', left, right, `${path.basename(c.path)} (before, after) - dry run of ${detail.id}`);
      }
    },

    // A write whose dry run lists no files (a fetch, for example): show what it said and ask.
    async reviewWithoutFiles({ repo, detail, doc }) {
      const shown = await vscode.workspace.openTextDocument({ language: 'json', content: JSON.stringify(doc.data, null, 2) });
      await vscode.window.showTextDocument(shown, { preview: true, preserveFocus: true });
      const pick = await vscode.window.showInformationMessage(
        `The dry run of "${detail.id}" lists no files. Its result is open beside this message. Run it for real?`, { modal: true }, 'Run it');
      return pick === 'Run it';
    },

    // A decision: a modal that names the command, the resource and what it changes, shown after the dry run (FR-015).
    async confirmDecision({ repo, detail, argv, changes, line }) {
      const what = changes.length ? preview.summaryOf(changes) : 'The dry run lists no files.';
      const resource = argv.slice(detail.words.length).filter((a) => !a.startsWith('-')).join(' ') || '(none)';
      const message = `${repo.name}: ${detail.id} is a decision only you can make.`;
      const options = { modal: true, detail: `Command: ${line}\nResource: ${resource}\nWhat it changes: ${what}\n\n${detail.help}` };
      const button = 'Make this decision';
      // In VS Code's test mode only, a test answers the modal through the hook (0043 FR-033); otherwise VS Code shows it.
      if (testmode.active()) return testmode.answerModal({ message, modal: options.modal, detail: options.detail, buttons: [button] }, button) === button;
      const pick = await vscode.window.showWarningMessage(message, options, button);
      return pick === button;
    },
  };
  return ui;
}

module.exports = { createUi, DiffDocuments, SCHEME, streamWords, readText };
