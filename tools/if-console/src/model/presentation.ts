// How a command line presents its resources to an editor (0041-command-line FR-064): views, an icon and a view for each noun, which
// fields of a list's rows are the label, the description, the status and the badge, and the patterns in files that name a resource.
// Read from `command list`'s `data.presentation`; a document without it gives an empty presentation and the editor shows plainer views.
import { asArray, asNumber, asObject, asString, asStrings, optString, type JsonObject } from './json';

/** The fixed vocabulary of a status. The editor maps each to a codicon and a theme color; a command line names neither. */
export const STATUSES = ['ok', 'warning', 'error', 'pending', 'skipped', 'info', 'muted'] as const;
export type Status = (typeof STATUSES)[number];

export const isStatus = (v: unknown): v is Status => typeof v === 'string' && (STATUSES as readonly string[]).includes(v);

export interface ViewDecl { id: string; title: string; icon: string; order: number; description: string }

export interface ListDecl {
  command: string;
  rows: string;
  id: string;
  label: string;
  description?: string;
  status?: string;
  statusMap: Record<string, Status>;
  badge?: string;
  /** The row field whose value is the row's own codicon id, for a row with no status (a kind of resource with an icon for each of its kinds). */
  icon?: string;
  /** The option (by its name, `match` for `--match`) of the list command that narrows its rows to the ones that match a text. */
  search?: string;
  tooltip: string[];
}

export interface NounDecl { noun: string; title: string; icon: string; view?: string; list?: ListDecl }

export interface ReferenceDecl {
  id: string;
  noun: string;
  pattern: string;
  value: string;
  files: string[];
  text?: string;
  facts: string[];
  lens: string[];
  definition: string[];
}

export interface Presentation { views: ViewDecl[]; nouns: NounDecl[]; references: ReferenceDecl[] }

export const NO_PRESENTATION: Presentation = { views: [], nouns: [], references: [] };

function listOf(v: unknown): ListDecl | undefined {
  const o = asObject(v);
  const command = asString(o.command);
  const rows = asString(o.rows);
  const id = asString(o.id);
  const label = asString(o.label);
  if (!command || !rows || !id || !label) return undefined;
  const statusMap: Record<string, Status> = {};
  for (const [k, s] of Object.entries(asObject(o.status_map))) if (isStatus(s)) statusMap[k] = s;
  return { command, rows, id, label, description: optString(o.description), status: optString(o.status), statusMap,
    badge: optString(o.badge), icon: optString(o.icon), search: optString(o.search), tooltip: asStrings(o.tooltip) };
}

function nounOf(v: unknown): NounDecl | null {
  const o = asObject(v);
  const noun = asString(o.noun);
  if (!noun) return null;
  return { noun, title: asString(o.title, noun), icon: asString(o.icon, 'symbol-namespace'), view: optString(o.view), list: listOf(o.list) };
}

function referenceOf(v: unknown): ReferenceDecl | null {
  const o = asObject(v);
  const id = asString(o.id);
  const noun = asString(o.noun);
  const pattern = asString(o.pattern);
  if (!id || !noun || !pattern) return null;
  return { id, noun, pattern, value: asString(o.value, '$1'), files: asStrings(o.files), text: optString(o.text),
    facts: asStrings(o.facts), lens: asStrings(o.lens), definition: asStrings(o.definition) };
}

/** `command list`'s `data.presentation`, read tolerantly: what is malformed is left out. Views come in their declared `order`. */
export function presentationOf(data: JsonObject): Presentation {
  const p = asObject(data.presentation);
  const views = asArray(p.views).map(asObject).filter((o) => asString(o.id) !== '').map((o): ViewDecl => ({
    id: asString(o.id), title: asString(o.title, asString(o.id)), icon: asString(o.icon, 'folder'), order: asNumber(o.order, 100),
    description: asString(o.description) }));
  views.sort((a, b) => a.order - b.order);
  return {
    views,
    nouns: asArray(p.nouns).map(nounOf).filter((n): n is NounDecl => n !== null),
    references: asArray(p.references).map(referenceOf).filter((r): r is ReferenceDecl => r !== null),
  };
}

/** The status of one row of a list, by the list's own `status` field and `status_map` (a value already in the vocabulary needs none). */
export function rowStatus(list: ListDecl, row: JsonObject): Status | undefined {
  if (!list.status) return undefined;
  const value = asString(row[list.status]);
  return list.statusMap[value] ?? (isStatus(value) ? value : 'muted');
}

/** A `check` section's status, and a finding's level, in the vocabulary. */
export function checkStatus(status: string): Status {
  return status === 'passed' ? 'ok' : status === 'failed' ? 'error' : status === 'skipped' ? 'skipped' : isStatus(status) ? status : 'muted';
}
