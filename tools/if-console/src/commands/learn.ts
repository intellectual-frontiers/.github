// Learn (0043-if-console FR-031, FR-043): the help topics the repository's `help` command lists, as a quick pick; a topic is shown in the
// resource panel with its steps, each with its command line to copy and a Run that goes through the one path every command takes.
import * as vscode from 'vscode';
import type { App } from '../app';
import { t } from '../l10n';
import { TOPIC_ICON, topicsOf } from '../model/learn';
import { checkSchema, type Doc } from '../model/wire';
import type { Repository } from '../services/repository';
import { chooseRepo } from './pick';


export class LearnCommands {
  constructor(private readonly app: App) {}

  async learn(): Promise<unknown> {
    const repo = await chooseRepo(this.app, t('Which repository do you want to learn about?'), (r) => r.has('help'));
    if (!repo) return null;
    const listed = await repo.launcher.run(['help']);
    const doc = this.readable(repo, listed.doc, listed.error?.message, 'help topics');
    if (!doc) return null;
    const topics = topicsOf(doc);
    if (!topics.length) { void vscode.window.showInformationMessage(t('{0} lists no help topics.', repo.name)); return null; }
    const picked = await this.app.ui.pick<string>({ title: t('Learn'), placeholder: t('{0}: which topic?', repo.name),
      items: topics.map((x) => ({ label: `$(${TOPIC_ICON}) ${x.topic}`, description: x.summary, detail: repo.line(['help', x.topic]), value: x.topic })) });
    return picked === undefined || Array.isArray(picked) ? null : this.openTopic(repo, picked);
  }

  /** One topic in the resource panel, with the list of topics read beside it so that it can lead on to the next. */
  async openTopic(repo: Repository, topic: string): Promise<boolean> {
    const [r, listed] = await Promise.all([repo.launcher.run(['help', topic]), repo.launcher.run(['help'])]);
    const doc = this.readable(repo, r.doc, r.error?.message, `help for ${topic}`);
    if (!doc) return false;
    await this.app.panel.showTopicDoc(repo, doc, ['help', topic], topicsOf(listed.doc));
    return true;
  }

  /** The document, if it is one this extension reads; otherwise the person is told why, once. */
  private readable(repo: Repository, doc: Doc | null, errorMessage: string | undefined, what: string): Doc | null {
    const ok = doc && errorMessage === undefined ? checkSchema(doc) : { ok: false as const, message: errorMessage ?? `${repo.program} gave no ${what}.` };
    if (ok.ok) return doc;
    void vscode.window.showInformationMessage(ok.message);
    return null;
  }
}
