// The status bar item for the active folder's repository (0043-if-console FR-016, FR-039): an icon, the orchestrator and, when something needs a
// person, how many things; a rich tooltip with the audience as the launcher states it, the health from `doctor` and what needs a person, each with
// its command line; and a click that opens Home with the suggestions in view, never a silent refresh.
import * as vscode from 'vscode';
import { countOf, type Suggestion } from '../model/home';
import { escapeMarkdown as esc, commandLink } from '../model/markdown';
import { lookOf } from '../model/status';
import type { Handles } from '../services/handles';
import type { Repository } from '../services/repository';
import { link, markdown } from './tooltips';

export interface StatusModel {
  text: string;
  /** The tooltip's plain lines, which the Markdown tooltip is made from. */
  lines: string[];
  hidden?: boolean;
  /** `warning` or `error` colors the item as the theme colors those. */
  tone?: 'warning' | 'error';
}

type Statused = Pick<Repository, 'state' | 'reason' | 'health' | 'name' | 'audience' | 'displayName'>;

export function statusModel(repo: Statused | null, needs: Suggestion[] = []): StatusModel {
  if (!repo) return { text: '$(terminal) IF Console', lines: ['No repository here declares a command line for IF Console.'], hidden: true };
  if (repo.state === 'untrusted') return { text: '$(shield) IF Console: not trusted', lines: [repo.reason], tone: 'warning' };
  if (repo.state === 'update') return { text: '$(warning) IF Console: update needed', lines: [repo.reason], tone: 'warning' };
  if (repo.state !== 'ready') return { text: '$(warning) IF Console: no answer', lines: [repo.reason], tone: 'warning' };
  const n = countOf(needs);
  const worst = needs.some((s) => s.status === 'error') ? 'error' : n ? 'warning' : undefined;
  const icon = n ? (worst === 'error' ? '$(error)' : '$(warning)') : repo.health === 'well' ? '$(check)' : '$(terminal)';
  return {
    text: n ? `${icon} ${repo.name} ${n}` : `${icon} ${repo.name}`,
    lines: [`${repo.displayName}: audience ${repo.audience} (as the command line states it); health: ${repo.health}.`],
    tone: worst,
  };
}

export class StatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  /** What the item showed last, for the test hook's snapshot. */
  last: { text: string; tooltip: string; visible: boolean } = { text: '', tooltip: '', visible: false };

  constructor(private readonly handles: Handles) {
    this.item.command = { command: 'if-console.showHome', title: 'Show what needs you', arguments: ['suggestions'] };
    this.item.name = 'IF Console';
  }

  render(repo: Statused & { key?: string } | null, needs: Suggestion[] = []): StatusModel {
    const m = statusModel(repo, needs);
    this.item.text = m.text;
    const tip = this.tooltip(repo, m, needs);
    this.item.tooltip = tip;
    this.item.backgroundColor = m.tone ? new vscode.ThemeColor(m.tone === 'error' ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground') : undefined;
    this.item.accessibilityInformation = { label: `IF Console: ${m.text.replace(/\$\([^)]+\)\s*/g, '')}. Choose to open Home with what needs you.`, role: 'button' };
    if (m.hidden) this.item.hide(); else this.item.show();
    this.last = { text: m.text, tooltip: tip.value, visible: !m.hidden };
    return m;
  }

  private tooltip(repo: (Statused & { key?: string }) | null, m: StatusModel, needs: Suggestion[]): vscode.MarkdownString {
    const md = markdown();
    md.appendMarkdown(`${m.hidden ? '' : '$(terminal) '}**IF Console**\n\n${m.lines.map((l) => esc(l, 400)).join('\n\n')}\n\n`);
    const items = needs.filter((s) => s.counts).slice(0, 5);
    if (repo && items.length) {
      md.appendMarkdown(`**${countOf(needs)} ${countOf(needs) === 1 ? 'thing needs' : 'things need'} you:**\n\n`);
      for (const s of items) md.appendMarkdown(`- $(${lookOf(s.status).icon}) ${esc(s.label, 200)}${s.commandLine ? ` — \`${s.commandLine.replace(/`/g, "'")}\`` : ''}\n`);
      md.appendMarkdown('\n');
    } else if (repo?.state === 'ready') md.appendMarkdown('Nothing needs you.\n\n');
    const links: string[] = [];
    const first = needs.find((s) => s.counts && s.run);
    if (repo?.key && first?.run) links.push(link(this.handles, `$(play) ${esc(first.runLabel || 'Run')}`, { kind: 'run', repoKey: repo.key, run: first.run }, first.commandLine ?? first.label));
    if (repo?.state === 'ready' || repo?.state === 'untrusted') links.push(commandLink('$(home) Show all', 'if-console.showHome', ['suggestions'], 'Open Home with what needs you'));
    md.appendMarkdown(links.join('\u00a0\u00a0\u00b7\u00a0\u00a0'));
    return md;
  }

  dispose(): void { this.item.dispose(); }
}
