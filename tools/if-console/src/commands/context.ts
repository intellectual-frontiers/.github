// Copy Context and Get Help (0043-if-console FR-018): what an agent needs to know about a resource, and the report to paste to a person
// or an AI. Both are assembled from what the launcher returns, with secrets removed, and neither is sent anywhere.
import * as vscode from 'vscode';
import type { App } from '../app';
import { helpReport, redact } from '../model/context';
import { asString, firstValue } from '../model/json';
import type { Doc } from '../model/wire';
import type { Repository } from '../services/repository';
import { Node } from '../views/node';
import { chooseRepo } from './pick';
import { t } from '../l10n';

export class ContextCommands {
  constructor(private readonly app: App) {}

  /** The `kind:id` a context is wanted for: the one a row of a view stands for, or the person's choice. */
  async pickResource(repo: Repository, node: Node | null): Promise<string | null> {
    const row = node?.data.row;
    if (row) return `${row.noun}:${row.id}`;
    const link = node?.data.link;
    if (link) {
      const kind = link.command.split(/\s+/)[0] ?? '';
      const id = Object.values(link.fields)[0];
      if (id !== undefined) return `${kind}:${asString(id)}`;
    }
    if (!repo.has('context')) return null;
    const detail = await repo.detail('context');
    const arg = detail.arguments[0];
    const kinds = (arg?.choices ?? []).filter((c) => c.endsWith(':'));
    if (kinds.length) {
      const kind = await vscode.window.showQuickPick(kinds.map((k) => ({ label: k.slice(0, -1), value: k.slice(0, -1) })), { placeHolder: t('What kind of resource?'), ignoreFocusOut: true });
      if (!kind) return null;
      const ids = await this.idsOfKind(repo, kind.value);
      if (ids.length) {
        const id = await vscode.window.showQuickPick(ids, { placeHolder: t('Which {0}?', kind.value), ignoreFocusOut: true });
        return id ? `${kind.value}:${id}` : null;
      }
      const typed = await vscode.window.showInputBox({ prompt: t('The {0}\'s id', kind.value), ignoreFocusOut: true });
      return typed ? `${kind.value}:${typed}` : null;
    }
    const typed = await vscode.window.showInputBox({ prompt: arg ? arg.help || arg.type : 'The resource', ignoreFocusOut: true });
    return typed || null;
  }

  private async idsOfKind(repo: Repository, kind: string): Promise<string[]> {
    const noun = kind.replace(/_/g, '-');
    if (!repo.nouns().nouns.has(noun) && !repo.has(`${noun} list`)) return [];
    const links = await repo.resources(noun, 500);
    return links.map((l) => firstValue(l.fields) ?? '');
  }

  private async deliver(text: string, language: string): Promise<void> {
    const where = await vscode.window.showQuickPick([{ label: t('Copy to the clipboard'), value: 'clip' }, { label: t('Open in an untitled editor'), value: 'editor' }],
      { placeHolder: t('Where should it go? Nothing is sent anywhere.'), ignoreFocusOut: true });
    if (!where) return;
    if (where.value === 'clip') { await vscode.env.clipboard.writeText(text); void vscode.window.showInformationMessage(t('It is on the clipboard.')); return; }
    const doc = await vscode.workspace.openTextDocument({ language, content: text });
    await vscode.window.showTextDocument(doc);
  }

  async copyContext(node?: unknown): Promise<void> {
    const row = node instanceof Node ? node : null;
    const repo = row ? row.repo : await chooseRepo(this.app, 'Which repository?');
    if (!repo) return;
    if (!repo.has('context')) { void vscode.window.showInformationMessage(t('{0} has no "context" command.', repo.name)); return; }
    const resource = await this.pickResource(repo, row);
    if (!resource) return;
    await this.copyContextOf(repo, resource);
  }

  /** `context RESOURCE`, with secrets removed, to where the person chooses. */
  async copyContextOf(repo: Repository, resource: string): Promise<void> {
    if (!repo.has('context')) { void vscode.window.showInformationMessage(t('{0} has no "context" command.', repo.name)); return; }
    const r = await repo.launcher.run(['context', resource]);
    if (!r.doc || r.error) { void vscode.window.showErrorMessage(r.error ? r.error.message : t('{0} gave no context for {1}.', repo.program, resource)); return; }
    await this.deliver(redact(JSON.stringify(r.doc, null, 2), process.env.HOME), 'json');
  }

  async getHelp(): Promise<void> {
    const repo = await chooseRepo(this.app);
    if (!repo) return;
    const doctor = (await repo.runDoctor()).doc;
    let contextDoc: Doc | null = null;
    if (repo.has('context') && (await vscode.window.showQuickPick(['Add a resource to the report', 'Only the health report'], { placeHolder: t('What is the help about?'), ignoreFocusOut: true })) === 'Add a resource to the report') {
      const resource = await this.pickResource(repo, null);
      if (resource) contextDoc = (await repo.launcher.run(['context', resource])).doc;
    }
    const text = helpReport({ program: repo.program, orchestrator: repo.name, audience: repo.audience, contextDoc, doctorDoc: doctor, home: process.env.HOME });
    await this.deliver(text, 'markdown');
  }
}
