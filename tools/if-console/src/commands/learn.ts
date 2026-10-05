// Learn (0043-if-console FR-031): the help topics the repository's `help` command lists, as a quick pick; a topic is shown as a resource
// with its steps as buttons that run through the one path every command takes.
import * as vscode from 'vscode';
import type { App } from '../app';
import { stepsOf, topicPage, topicsOf } from '../model/learn';
import { checkSchema, type Doc } from '../model/wire';
import type { Repository } from '../services/repository';
import { chooseRepo } from './pick';
import type { RunCommands } from './run';

export class LearnCommands {
  constructor(private readonly app: App, private readonly run: RunCommands) {}

  async learn(): Promise<unknown> {
    const repo = await chooseRepo(this.app, 'Which repository do you want to learn about?', (r) => r.has('help'));
    if (!repo) return null;
    const listed = await repo.launcher.run(['help']);
    const doc = this.readable(repo, listed.doc, listed.error?.message, 'help topics');
    if (!doc) return null;
    const topics = topicsOf(doc);
    if (!topics.length) { void vscode.window.showInformationMessage(`${repo.name} lists no help topics.`); return null; }
    const picked = await this.app.ui.pick<string>({ title: 'Learn', placeholder: `${repo.name}: which topic?`,
      items: topics.map((t) => ({ label: t.topic, description: t.summary, value: t.topic })) });
    return picked === undefined || Array.isArray(picked) ? null : this.openTopic(repo, picked);
  }

  async openTopic(repo: Repository, topic: string): Promise<vscode.WebviewPanel | null> {
    const r = await repo.launcher.run(['help', topic]);
    const doc = this.readable(repo, r.doc, r.error?.message, `help for ${topic}`);
    if (!doc) return null;
    const steps = stepsOf(doc);
    return this.app.openHtml(repo, `${repo.name}: ${topic}`, topicPage(doc), async (i) => {
      const step = steps[i];
      if (step?.runnable) await this.run.runAction(repo, step.action);
    });
  }

  /** The document, if it is one this extension reads; otherwise the person is told why, once. */
  private readable(repo: Repository, doc: Doc | null, errorMessage: string | undefined, what: string): Doc | null {
    const ok = doc && errorMessage === undefined ? checkSchema(doc) : { ok: false as const, message: errorMessage ?? `${repo.program} gave no ${what}.` };
    if (ok.ok) return doc;
    void vscode.window.showInformationMessage(ok.message);
    return null;
  }
}
