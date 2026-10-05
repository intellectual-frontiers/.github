// The preview of a write (0043-if-console FR-014): the dry run's resource carries, for each file the change would touch, a unified
// diff (0041-command-line FR-015). This reads it and rebuilds the two sides of each file for VS Code's diff editor.
import { asArray, asNumber, asObject, asString } from './json';
import { t } from '../l10n';
import type { Built, ChangeView } from './panel';
import type { Doc } from './wire';

export interface Change { path: string; change: string; added: number; removed: number; diff: string[] }

export function changesOf(doc: Doc | null): Change[] {
  if (!doc) return [];
  return asArray(doc.data.changes).map(asObject).filter((c) => typeof c.path === 'string').map((c): Change => ({
    path: asString(c.path), change: asString(c.change, 'modify'), added: asNumber(c.added), removed: asNumber(c.removed),
    diff: asArray(c.diff).map((l) => asString(l)) }));
}

/** Apply a unified diff (as difflib writes it, no line endings, context lines) to the text it was made from. */
export function applyUnified(before: string | null | undefined, diff: string[]): string {
  const src = (before ?? '').split('\n');
  if (src.length && src[src.length - 1] === '') src.pop();
  const out: string[] = [];
  let at = 0;
  let i = 0;
  while (i < diff.length) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(diff[i] ?? '');
    if (!m) { i += 1; continue; }
    const start = Number(m[1]) - (m[2] === '0' ? 0 : 1);
    while (at < start) out.push(src[at++] ?? '');
    i += 1;
    for (; i < diff.length && !(diff[i] ?? '').startsWith('@@'); i += 1) {
      const line = diff[i] ?? '';
      const tag = line[0];
      const body = line.slice(1);
      if (tag === ' ') { out.push(src[at] === undefined ? body : src[at] ?? ''); at += 1; }
      else if (tag === '-') at += 1;
      else if (tag === '+') out.push(body);
    }
  }
  while (at < src.length) out.push(src[at++] ?? '');
  return out.length ? `${out.join('\n')}\n` : '';
}

/** The two sides of one change. `before` is the file's text now (empty for a file to be created). */
export function sides(change: Change, before: string | null): { before: string; after: string } {
  if (change.change === 'create') return { before: '', after: applyUnified('', change.diff) };
  if (change.change === 'delete') return { before: before ?? '', after: '' };
  return { before: before ?? '', after: applyUnified(before ?? '', change.diff) };
}

export function summaryOf(changes: Change[]): string {
  if (changes.length === 0) return t('Nothing would change.');
  const files = changes.length === 1 ? t('1 file') : t('{0} files', changes.length);
  const plus = changes.reduce((n, c) => n + c.added, 0);
  const minus = changes.reduce((n, c) => n + c.removed, 0);
  return `${files} would change: ${plus} lines added, ${minus} removed.`;
}

export const labelOfChange = (c: Change): string => ({ create: t('new file'), delete: t('removed'), modify: t('changed') })[c.change] ?? c.change;

/** The panel's model of a dry run (0043-if-console FR-014, FR-042): the change summary and each file, with Apply and Discard. A decision's Apply
 * leads on to its modal, which says so. */
export function buildPreview(detail: { id: string; title: string | null; category: string; help: string }, changes: Change[], repoName: string): Built {
  const plus = changes.reduce((n, c) => n + c.added, 0);
  const minus = changes.reduce((n, c) => n + c.removed, 0);
  const decision = detail.category === 'decision';
  const views: ChangeView[] = changes.map((c, index) => ({ index, path: c.path, change: c.change, word: labelOfChange(c), added: c.added, removed: c.removed }));
  return {
    mode: 'preview',
    header: { icon: decision ? 'law' : 'diff', title: detail.title ? detail.title.replace(/\u2026$/, '') : detail.id, kind: decision ? t('Decision, dry run') : t('Dry run'), id: detail.id, audience: '',
      pills: [{ text: changes.length === 1 ? t('1 file') : t('{0} files', changes.length), icon: 'files', kind: 'plain' }, { text: `+${plus}`, status: 'ok', kind: 'status', title: t('Lines added') },
        { text: `\u2212${minus}`, status: 'error', kind: 'status', title: t('Lines removed') }, ...(decision ? [{ text: t('Decision'), icon: 'law', status: 'warning' as const, kind: 'status' as const }] : [])],
      subtitle: `${repoName}: ${detail.help}` },
    actions: [],
    sections: [{ type: 'changes', id: 'changes', title: t('What would change'), icon: 'diff', changes: views, summary: summaryOf(changes) }],
    held: { actions: [], refs: [] },
    preview: { apply: decision ? 'Continue to the decision' : 'Apply these changes', discard: 'Discard', decision },
  };
}
