// Choosing a repository and a command: the quick picks every command handler starts from.
import * as vscode from 'vscode';
import type { App } from '../app';
import type { CommandSummary } from '../model/wire';
import type { Repository } from '../services/repository';
import * as testMode from '../test-mode';
import { CATEGORY_ICON } from '../views/node';
import { t } from '../l10n';

const NO_REPOSITORY = 'No folder in this window declares a command line for IF Console (a .if-console.env file at its root).';

/** The repository a command is for: the only ready one, or the person's choice among several. */
export async function chooseRepo(app: App, placeholder?: string, filter?: (r: Repository) => boolean): Promise<Repository | null> {
  const ready = app.repos.filter((r) => r.state === 'ready' && (!filter || filter(r)));
  if (!ready.length) {
    const why = app.repos.find((r) => r.state !== 'ready');
    void vscode.window.showInformationMessage(why ? why.reason : NO_REPOSITORY);
    return null;
  }
  if (ready.length === 1) return ready[0] ?? null;
  testMode.note('quickpick', { title: '', placeholder: placeholder ?? 'Which repository?', items: ready.map((r) => r.name) });
  const pick = await vscode.window.showQuickPick(ready.map((r) => ({ label: r.name, description: r.folder.name, detail: r.root, repo: r })),
    { placeHolder: placeholder ?? 'Which repository?', ignoreFocusOut: true });
  return pick ? pick.repo : null;
}

/** The id of the command the person chooses among the ones the editor surface offers, grouped by noun. */
export async function pickCommand(repo: Repository, filter?: (c: CommandSummary) => boolean): Promise<string | null> {
  const { nouns, repoWide } = repo.nouns();
  const items: Array<vscode.QuickPickItem & { id?: string }> = [];
  const add = (label: string, cmds: CommandSummary[]): void => {
    const kept = cmds.filter((c) => !filter || filter(c));
    if (!kept.length) return;
    items.push({ label, kind: vscode.QuickPickItemKind.Separator });
    // The label is the command's own id and its title (the palette title the command line gives it) is beside it; a person can type either.
    for (const c of kept) items.push({ label: c.id, description: [c.title, c.category].filter(Boolean).join(' \u00b7 '), detail: c.help,
      iconPath: new vscode.ThemeIcon(c.icon ?? CATEGORY_ICON[c.category] ?? 'play'), id: c.id });
  };
  add(`${repo.name}: repository-wide`, repoWide);
  for (const [noun, cmds] of nouns) add(`${repo.name}: ${noun}`, cmds);
  testMode.note('quickpick', { title: '', placeholder: t('Which command?'), items: items.filter((i) => i.kind !== vscode.QuickPickItemKind.Separator).map((i) => i.label) });
  const pick = await vscode.window.showQuickPick(items, { placeHolder: t('Which command?'), matchOnDescription: true, matchOnDetail: true, ignoreFocusOut: true });
  return pick?.id ?? null;
}
