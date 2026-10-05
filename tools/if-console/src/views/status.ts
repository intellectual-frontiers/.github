// The status bar item for the active folder's repository (0043-if-console FR-016): the orchestrator, its audience as the launcher states
// it, and a plain-words state taken from `doctor`. Choosing it opens the `doctor` resource.
import * as vscode from 'vscode';
import type { Repository } from '../services/repository';

export interface StatusModel { text: string; tooltip: string; hidden?: boolean }

type Statused = Pick<Repository, 'state' | 'reason' | 'health' | 'name' | 'audience' | 'displayName'>;

export function statusModel(repo: Statused | null): StatusModel {
  if (!repo) return { text: '$(terminal) IF Console', tooltip: 'No repository here declares a command line for IF Console.', hidden: true };
  if (repo.state === 'untrusted') return { text: '$(shield) IF Console: not trusted', tooltip: repo.reason };
  if (repo.state === 'update') return { text: '$(warning) IF Console: update needed', tooltip: repo.reason };
  if (repo.state !== 'ready') return { text: '$(warning) IF Console: no answer', tooltip: repo.reason };
  const health = repo.health;
  const icon = health === 'well' ? '$(check)' : health === 'not checked yet' || health === 'unknown' ? '$(terminal)' : '$(warning)';
  return {
    text: `${icon} ${repo.name} - ${repo.audience} - ${health}`,
    tooltip: `${repo.displayName}: the command line states its audience as "${repo.audience}"; its health is ${health}. Choose to open its doctor report.`,
  };
}

export class StatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);

  constructor() {
    this.item.command = 'if-console.doctor';
    this.item.name = 'IF Console';
    this.item.accessibilityInformation = { label: 'IF Console status. Choose to open the doctor report.', role: 'button' };
  }

  render(repo: Statused | null): StatusModel {
    const m = statusModel(repo);
    this.item.text = m.text;
    this.item.tooltip = m.tooltip;
    if (m.hidden) this.item.hide(); else this.item.show();
    return m;
  }

  dispose(): void { this.item.dispose(); }
}
