// The preview of a write (0043-if-console FR-014): the dry run's resource carries, for each file the change would touch, a unified
// diff (0041-command-line FR-015). This reads it and rebuilds the two sides of each file for VS Code's diff editor.
import { asArray, asNumber, asObject, asString } from './json';
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
  if (changes.length === 0) return 'Nothing would change.';
  const files = changes.length === 1 ? '1 file' : `${changes.length} files`;
  const plus = changes.reduce((n, c) => n + c.added, 0);
  const minus = changes.reduce((n, c) => n + c.removed, 0);
  return `${files} would change: ${plus} lines added, ${minus} removed.`;
}

const CHANGE_WORDS: Record<string, string> = { create: 'new file', delete: 'removed', modify: 'changed' };
export const labelOfChange = (c: Change): string => CHANGE_WORDS[c.change] ?? c.change;
