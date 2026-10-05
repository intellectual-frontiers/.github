// The rows of a noun's `list` (0041-command-line FR-064, 0043-if-console FR-036, FR-038): which fields of each row are its label, its
// description, its status and its badge is the command line's own declaration; this reads a `list` document by it and holds no field name.
import { asArray, asString, isObject, type JsonObject } from './json';
import { rowStatus, type ListDecl, type Status } from './presentation';
import type { Doc } from './wire';

export interface Fact { key: string; value: string }

export interface Row {
  noun: string;
  /** The row's id: the argument of the noun's `show` command. */
  id: string;
  label: string;
  description: string;
  status: Status | undefined;
  /** The status field's own value ("Draft"), which a tooltip says beside the colored icon. */
  statusValue: string;
  badge: string;
  /** The codicon the row's `icon` field gives, where the list declares one and the value is an id. */
  icon: string;
  facts: Fact[];
}

/** A field of a row as the words a person reads: a list is its items joined, an object is skipped, an empty value is nothing. */
export function display(value: unknown, max = 400): string {
  const raw = Array.isArray(value) ? value.map((v) => (isObject(v) ? '' : asString(v))).filter(Boolean).join(', ') : isObject(value) ? '' : asString(value);
  const text = raw.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** A row's own codicon: the declared field's value where it is a codicon id (lowercase words and hyphens), else nothing. */
export function iconOf(decl: ListDecl, raw: JsonObject): string {
  const v = decl.icon ? display(raw[decl.icon]) : '';
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v) ? v : '';
}

export function rowsOf(noun: string, decl: ListDecl, doc: Doc): Row[] {
  const out: Row[] = [];
  for (const raw of asArray(doc.data[decl.rows])) {
    if (!isObject(raw)) continue;
    const id = display(raw[decl.id]);
    if (id === '') continue;
    const status = rowStatus(decl, raw);
    const facts: Fact[] = [];
    for (const key of decl.tooltip) {
      const value = display(raw[key]);
      if (value !== '') facts.push({ key, value });
    }
    out.push({ noun, id, label: display(raw[decl.label]) || id, description: decl.description ? display(raw[decl.description]) : '', status,
      statusValue: decl.status ? display(raw[decl.status]) : '', badge: decl.badge ? display(raw[decl.badge]) : '', icon: iconOf(decl, raw), facts });
  }
  return out;
}

export type RowRecord = JsonObject;

/** The two characters a badge can hold as a file decoration: a count up to 99, or the first two characters of a word. */
export const badgeText = (badge: string): string => (/^\d+$/.test(badge) ? String(Math.min(Number(badge), 99)) : badge.slice(0, 2));
