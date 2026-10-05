// What the resource panel draws (0043-if-console FR-042): a resource's JSON turned into a model of header, actions and sections, by the
// shape of its data. The model is plain data (no VS Code, no DOM): the host builds it here and posts it, the panel's page draws it, and a
// test reads it. Nothing here knows any one orchestrator's resource: a key, an array of objects or a list of stages is read as what it is.
import { asObject, asString, isObject, type JsonObject } from './json';
import { checkStatus, isStatus, type NounDecl, type Presentation, type Status } from './presentation';
import { CATEGORY_ICON, lookOf } from './status';
import { t } from '../l10n';
import { actionsOf, checkResult, labelOf, linksOf, type Action, type Doc, type Link } from './wire';

// ---- the model -------------------------------------------------------------------------------------------------------------

/** What opens when a row, a chip or a finding is chosen: a link the document gave, or a noun's `show` for an id. The page holds an index. */
export type Ref = { kind: 'link'; link: Link } | { kind: 'row'; noun: string; id: string };

export interface Pill { text: string; status?: Status; icon?: string; title?: string; kind?: 'audience' | 'status' | 'plain' }

export interface Header {
  icon: string;
  title: string;
  kind: string;
  id: string;
  audience: string;
  pills: Pill[];
  /** The one line of words that says what this is, where the data gives one (a summary or description). */
  subtitle: string;
}

export interface ActionView {
  /** The index into the actions the host holds; the page sends only this back. */
  id: number;
  label: string;
  icon: string;
  primary: boolean;
  decision: boolean;
  enabled: boolean;
  reason: string;
  cli: string | null;
  category: string;
}

export interface FileRef { path: string; line?: number }

export type CellKind = 'text' | 'code' | 'file' | 'color' | 'bool' | 'empty' | 'status' | 'chips';

export interface KeyValue {
  key: string;
  /** For a yes-or-no value: which. (The words are the host's, in the person's language; the page reads this.) */
  on?: boolean;
  label: string;
  value: string;
  kind: CellKind;
  file?: FileRef;
  status?: Status;
  items?: string[];
}

export interface Column { key: string; label: string; numeric: boolean }
/** `open`: where the cell's text names another resource the row does not itself open, the index of its reference: the cell is a link. */
export interface Cell { text: string; kind: CellKind; on?: boolean; status?: Status; file?: FileRef; sort: string | number; open?: number }
export interface TableRow { cells: Cell[]; open?: number; label: string }

export type StageState = 'done' | 'current' | 'todo' | 'blocked' | 'skipped';
export interface Stage { label: string; state: StageState; word: string; note: string }

export interface FindingView { level: string; status: Status; /** The status in words, for a tooltip. */ word: string; message: string; where: string; file?: FileRef; next: string; open?: number; category?: string }
export interface FindingGroup { name: string; status: Status; word: string; findings: FindingView[]; note: string }

export type Block = { kind: 'p'; text: string } | { kind: 'code'; lines: CodeLine[] };
export interface CodeLine { text: string; copy: string; run?: number; reason?: string }

export interface Chip { label: string; title: string; open: number }

export interface ChangeView { index: number; path: string; change: string; word: string; added: number; removed: number }

export interface LessonStep {
  n: number;
  label: string;
  note: string;
  line: string;
  /** What runs it: the index of its action; absent where the person runs it in a terminal or does it themselves. */
  run?: number;
  /** Why it cannot run here, and what to do instead. */
  reason: string;
  yourself: boolean;
}

export type Section =
  | { type: 'kv'; id: string; title: string; icon: string; items: KeyValue[] }
  | { type: 'table'; id: string; title: string; icon: string; columns: Column[]; rows: TableRow[]; more: number }
  | { type: 'stages'; id: string; title: string; icon: string; stages: Stage[] }
  | { type: 'findings'; id: string; title: string; icon: string; groups: FindingGroup[] }
  | { type: 'text'; id: string; title: string; icon: string; blocks: Block[] }
  | { type: 'chips'; id: string; title: string; icon: string; chips: Chip[] }
  | { type: 'changes'; id: string; title: string; icon: string; changes: ChangeView[]; summary: string }
  | { type: 'reading'; id: string; title: string; icon: string; parts: Array<{ n: number | null; heading: string; blocks: Block[] }> }
  | { type: 'lesson'; id: string; title: string; icon: string; steps: LessonStep[] }
  | { type: 'empty'; id: string; title: string; icon: string; text: string; guidance: string };

export type Mode = 'resource' | 'topic' | 'preview';

/** One thing the panel shows, before the host adds its navigation. */
export interface Built {
  mode: Mode;
  header: Header;
  actions: ActionView[];
  sections: Section[];
  /** What the page's own message ids refer to: the actions, the references, and a topic's next. */
  held: { actions: Action[]; refs: Ref[] };
  /** For a preview, the words of its two buttons. */
  preview?: { apply: string; discard: string; decision: boolean };
  next?: { topic: string; summary: string } | null;
}

export interface BuildContext {
  presentation: Presentation;
  /** Whether this path names a file in the clone (so that it is a link), and which. */
  isFile: (path: string) => boolean;
}

// ---- words -----------------------------------------------------------------------------------------------------------------

export function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return words === '' ? key : words.charAt(0).toUpperCase() + words.slice(1);
}

const isScalar = (v: unknown): v is string | number | boolean | null => v === null || ['string', 'number', 'boolean'].includes(typeof v);

/** The words an status value says, mapped into the fixed vocabulary where it is one of the common ones; otherwise it has no color. */
const WORD_STATUS: Record<string, Status> = {
  ok: 'ok', well: 'ok', passed: 'ok', pass: 'ok', success: 'ok', succeeded: 'ok', current: 'ok', fresh: 'ok', ready: 'ok', done: 'ok', healthy: 'ok', verified: 'ok', complete: 'ok', completed: 'ok', reached: 'ok', public: 'ok', accepted: 'ok', applied: 'ok',
  warning: 'warning', warn: 'warning', stale: 'warning', missing: 'warning', attention: 'warning', degraded: 'warning', 'needs attention': 'warning', 'something missing': 'warning',
  error: 'error', failed: 'error', fail: 'error', broken: 'error', blocked: 'error', refused: 'error', invalid: 'error', rejected: 'error',
  pending: 'pending', draft: 'pending', open: 'pending', waiting: 'pending', todo: 'pending', proposed: 'pending', ahead: 'pending',
  skipped: 'skipped', info: 'info', note: 'info', muted: 'muted', inactive: 'muted', closed: 'muted', retired: 'muted',
};
export const statusOfWord = (word: unknown): Status | undefined => {
  const w = asString(word).trim().toLowerCase();
  return isStatus(w) ? w : WORD_STATUS[w];
};

const LEVEL_STATUS: Record<string, Status> = { error: 'error', failure: 'error', failed: 'error', critical: 'error', warning: 'warning', warn: 'warning', attention: 'warning', info: 'info', note: 'info', notice: 'info', ok: 'ok', passed: 'ok', skipped: 'skipped' };
export const levelStatus = (level: string): Status => LEVEL_STATUS[level.toLowerCase()] ?? (isStatus(level) ? level : 'info');

const KIND_LOOK: Record<string, { icon: string; title: string }> = {
  check: { icon: 'checklist', title: t('Check results') },
  doctor: { icon: 'pulse', title: t('Health') },
  fresh: { icon: 'sync', title: t('Generated files') },
  error: { icon: 'error', title: t('Error') },
  help: { icon: 'mortar-board', title: t('Help') },
  'help-list': { icon: 'mortar-board', title: t('Help topics') },
  'command-list': { icon: 'list-unordered', title: t('Commands') },
  command: { icon: 'terminal', title: t('Command') },
};

const LAST_RUN_KEYS = ['last_run', 'last_ran', 'ran_at', 'checked_at', 'generated_at', 'updated_at', 'updated'];
const SUBTITLE_KEYS = ['summary', 'description', 'help'];
const WORD_COUNT = (s: string): number => s.trim().split(/\s+/).length;

const FILE_KEYS = new Set(['path', 'file', 'package', 'spec', 'ontology_file', 'register', 'source', 'master', 'folder', 'directory', 'dir']);

/** A long value is read as paragraphs, not as a cell. */
export const isLong = (s: string): boolean => s.includes('\n') || s.length > 140 || WORD_COUNT(s) > 24;

export function when(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return m ? `${m[1]} ${m[2]}` : value;
}

// ---- references -------------------------------------------------------------------------------------------------------------

class Refs {
  readonly list: Ref[] = [];
  private readonly seen = new Map<string, number>();
  add(ref: Ref): number {
    const key = ref.kind === 'row' ? `row\n${ref.noun}\n${ref.id}` : `link\n${ref.link.command}\n${JSON.stringify(ref.link.fields)}`;
    const held = this.seen.get(key);
    if (held !== undefined) return held;
    this.list.push(ref);
    this.seen.set(key, this.list.length - 1);
    return this.list.length - 1;
  }
}

// ---- actions ---------------------------------------------------------------------------------------------------------------

export function actionViews(actions: Action[], decisionsApart = true): ActionView[] {
  const firstPrimary = actions.findIndex((a) => a.enabled && a.category !== 'decision');
  return actions.map((a, i): ActionView => ({
    id: i, label: a.label, icon: a.category === 'decision' && decisionsApart ? 'law' : CATEGORY_ICON[a.category] ?? 'play', primary: i === firstPrimary,
    decision: a.category === 'decision', enabled: a.enabled, reason: a.enabled ? '' : (a.reason || 'The command line says it cannot run now.'), cli: a.cli, category: a.category }));
}

// ---- the sections of a resource -----------------------------------------------------------------------------------------------

function fileOf(value: string, ctx: BuildContext, line?: number): FileRef | undefined {
  if (value === '' || /\s/.test(value) || /^[a-z]+:\/\//i.test(value) || !ctx.isFile(value)) return undefined;
  return line === undefined ? { path: value } : { path: value, line };
}

const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function valueOf(key: string, v: unknown, ctx: BuildContext, siblings: JsonObject): KeyValue {
  const label = humanize(key);
  if (v === null || v === undefined || v === '') return { key, label, value: '—', kind: 'empty' };
  if (typeof v === 'boolean') return { key, label, value: v ? t('Yes') : t('No'), kind: 'bool', on: v };
  if (typeof v === 'number') return { key, label, value: String(v), kind: 'text' };
  const s = asString(v);
  if (COLOR.test(s)) return { key, label, value: s, kind: 'color' };
  const line = typeof siblings.line === 'number' && (key === 'path' || key === 'file') ? siblings.line : undefined;
  const file = FILE_KEYS.has(key) || /^[\w./-]+\.[A-Za-z0-9]{1,6}$/.test(s) ? fileOf(s, ctx, line) : undefined;
  if (file) return { key, label, value: line === undefined ? s : `${s}:${line}`, kind: 'file', file };
  if (['status', 'state', 'level', 'result'].includes(key)) { const status = statusOfWord(s); if (status) return { key, label, value: s, kind: 'status', status }; }
  return { key, label, value: s, kind: 'text' };
}

function scalarArray(key: string, items: unknown[]): KeyValue {
  const words = items.map((x) => asString(x));
  return { key, label: humanize(key), value: words.join(', '), kind: 'chips', items: words };
}

const columnKeys = (rows: JsonObject[]): string[] => {
  const keys: string[] = [];
  for (const r of rows) for (const [k, v] of Object.entries(r)) if (!keys.includes(k) && (isScalar(v) || (Array.isArray(v) && v.every(isScalar))) && !(typeof v === 'string' && isLong(v) && !keys.length)) keys.push(k);
  return keys.filter((k) => rows.some((r) => r[k] !== null && r[k] !== undefined && r[k] !== '' && !(Array.isArray(r[k]) && (r[k] as unknown[]).length === 0)));
};

const cellText = (v: unknown): string => (Array.isArray(v) ? v.map((x) => asString(x)).join(', ') : v === null || v === undefined ? '' : asString(v));

const STAGE_STATE: Record<string, StageState> = {
  reached: 'done', done: 'done', complete: 'done', completed: 'done', passed: 'done', past: 'done',
  current: 'current', active: 'current', now: 'current', 'in-progress': 'current', in_progress: 'current',
  ahead: 'todo', todo: 'todo', pending: 'todo', upcoming: 'todo', future: 'todo', next: 'todo',
  blocked: 'blocked', failed: 'blocked', skipped: 'skipped',
};
const stageWord = (s: StageState): string => ({ done: t('done'), current: t('now'), todo: t('to come'), blocked: t('blocked'), skipped: t('skipped') })[s];

function stagesOf(rows: JsonObject[]): Stage[] | null {
  if (rows.length < 2) return null;
  const nameKey = ['stage', 'label', 'name', 'step', 'phase'].find((k) => rows.every((r) => typeof r[k] === 'string'));
  const stateKey = ['state', 'status'].find((k) => rows.every((r) => typeof r[k] === 'string' && STAGE_STATE[asString(r[k]).toLowerCase()] !== undefined));
  if (!nameKey || !stateKey) return null;
  return rows.map((r): Stage => {
    const state = STAGE_STATE[asString(r[stateKey]).toLowerCase()] ?? 'todo';
    const label = asString(r.label ?? r[nameKey]);
    const decided = isObject(r.decided) ? [asString(r.decided.date), asString(r.decided.by)].filter(Boolean).join(' by ') : '';
    const note = decided ? `decided ${decided}` : asString(r.note ?? r.date ?? '');
    return { label, state, word: stageWord(state), note };
  });
}

const FINDING_TEXT = ['message', 'text', 'summary'];

function isFindings(rows: JsonObject[]): boolean {
  const text = FINDING_TEXT.find((k) => rows.every((r) => typeof r[k] === 'string'));
  return text !== undefined && rows.every((r) => typeof r.level === 'string' || typeof r.severity === 'string' || typeof r.where === 'string');
}

function lineRef(where: string): { path: string; line?: number } | null {
  const m = /^(.+?):(\d+)(?::\d+)?$/.exec(where);
  if (m) return { path: m[1] ?? '', line: Number(m[2]) };
  return /^[\w./-]+\.[A-Za-z0-9]{1,6}$/.test(where) ? { path: where } : null;
}

function findingOf(r: JsonObject, ctx: BuildContext, refs: Refs): FindingView {
  const level = asString(r.level ?? r.severity, 'info');
  const where = asString(r.where ?? r.file ?? '');
  const parsed = where ? lineRef(where) : null;
  const file = parsed && ctx.isFile(parsed.path) ? (parsed.line === undefined ? { path: parsed.path } : { path: parsed.path, line: parsed.line }) : undefined;
  const command = asString(r.command);
  const open = command !== '' ? refs.add({ kind: 'link', link: { rel: 'finding', command, fields: asObject(r.fields), cli: null } }) : undefined;
  const f: FindingView = { level, status: levelStatus(level), word: lookOf(levelStatus(level)).word, message: asString(r.message ?? r.text ?? r.summary), where, next: asString(r.next ?? r.hint ?? ''), category: asString(r.category) || undefined };
  if (file) f.file = file;
  if (open !== undefined) f.open = open;
  return f;
}

function findingGroups(title: string, rows: JsonObject[], ctx: BuildContext, refs: Refs): FindingGroup[] {
  const byCategory = new Map<string, JsonObject[]>();
  for (const r of rows) { const c = asString(r.category) || title; byCategory.set(c, [...(byCategory.get(c) ?? []), r]); }
  return [...byCategory.entries()].map(([name, list]): FindingGroup => {
    const findings = list.map((r) => findingOf(r, ctx, refs));
    const worst = (['error', 'warning', 'pending', 'info'] as Status[]).find((s) => findings.some((f) => f.status === s)) ?? 'ok';
    return { name: humanize(name), status: worst, word: '', findings, note: '' };
  });
}

/** The noun whose `list` declares these rows, if one does: its row id opens the noun's resource. */
function nounOfRows(key: string, ctx: BuildContext): NounDecl | undefined {
  return ctx.presentation.nouns.find((n) => n.list?.rows === key);
}

const MAX_ROWS = 500;

function tableOf(key: string, title: string, rows: JsonObject[], ctx: BuildContext, refs: Refs, byValue: Map<string, Link>): Section {
  const keys = columnKeys(rows).slice(0, 8);
  const noun = nounOfRows(key, ctx);
  const columns: Column[] = keys.map((k) => ({ key: k, label: humanize(k), numeric: rows.every((r) => r[k] === null || r[k] === undefined || typeof r[k] === 'number') }));
  const shown = rows.slice(0, MAX_ROWS);
  const out: TableRow[] = shown.map((r): TableRow => {
    const cells = keys.map((k): Cell => {
      const v = r[k];
      const text = cellText(v);
      const sort = typeof v === 'number' ? v : text.toLowerCase();
      if (typeof v === 'boolean') return { text: v ? t('Yes') : t('No'), kind: 'bool', on: v, sort };
      if (text === '') return { text: '—', kind: 'empty', sort };
      if (COLOR.test(text)) return { text, kind: 'color', sort };
      if (['status', 'state', 'level', 'result'].includes(k)) { const status = statusOfWord(text); if (status) return { text, kind: 'status', status, sort }; }
      const file = FILE_KEYS.has(k) ? fileOf(text, ctx) : undefined;
      return file ? { text, kind: 'file', file, sort } : { text, kind: 'text', sort };
    });
    let open: number | undefined;
    if (noun?.list) {
      const id = cellText(r[noun.list.id]);
      if (id !== '') open = refs.add({ kind: 'row', noun: noun.noun, id });
    }
    let opener: Cell | undefined;
    if (open === undefined) {
      for (const c of cells) { const hit = byValue.get(c.text); if (hit) { open = refs.add({ kind: 'link', link: hit }); opener = c; break; } }
    }
    // The other cells that name a resource are links of their own: a statement's object, a reference's predicate.
    for (const c of cells) {
      if (c === opener) continue;
      const hit = byValue.get(c.text);
      if (hit && c.kind === 'text') c.open = refs.add({ kind: 'link', link: hit });
    }
    const first = cells.find((c) => c.kind !== 'empty');
    const row: TableRow = { cells, label: first?.text ?? '' };
    if (open !== undefined) row.open = open;
    return row;
  });
  return { type: 'table', id: key, title, icon: 'table', columns, rows: out, more: Math.max(0, rows.length - shown.length) };
}

/** The text of a long value, as paragraphs and indented code (four spaces, as the launcher's help writes a command line). */
export function blocksOf(text: string, runs?: (line: string) => { run?: number; reason?: string } | undefined): Block[] {
  const out: Block[] = [];
  let code: string[] = [];
  let para: string[] = [];
  const flushCode = (): void => {
    if (!code.length) return;
    out.push({ kind: 'code', lines: code.map((l): CodeLine => ({ text: l, copy: l, ...(runs?.(l) ?? {}) })) });
    code = [];
  };
  const flushPara = (): void => { if (para.length) { out.push({ kind: 'p', text: para.join(' ') }); para = []; } };
  for (const raw of text.split('\n')) {
    if (raw.startsWith('    ')) { flushPara(); code.push(raw.slice(4)); continue; }
    flushCode();
    if (raw.trim() === '') flushPara(); else para.push(raw.trim());
  }
  flushCode();
  flushPara();
  return out;
}

function guidanceFor(actions: Action[]): string {
  const first = actions.find((a) => a.enabled && a.category !== 'decision');
  return first ? t('Use “{0}” above to change this.', first.label) : t('Nothing to do here yet. It fills in as the command line records more.');
}

interface Walk { sections: Section[]; kv: KeyValue[] }

function walk(data: JsonObject, ctx: BuildContext, refs: Refs, byValue: Map<string, Link>, actions: Action[], skip: Set<string>, titleText: string): Walk {
  const sections: Section[] = [];
  const kv: KeyValue[] = [];
  for (const [key, v] of Object.entries(data)) {
    if (skip.has(key)) continue;
    const title = humanize(key);
    if ((key === 'title' || key === 'name' || key === 'label') && asString(v) === titleText) continue;
    if (isScalar(v)) {
      if (typeof v === 'string' && isLong(v)) sections.push({ type: 'text', id: key, title, icon: 'note', blocks: blocksOf(v) });
      else if (v !== null && v !== '') kv.push(valueOf(key, v, ctx, data));
    } else if (Array.isArray(v)) {
      if (v.length === 0) { sections.push({ type: 'empty', id: key, title, icon: 'inbox', text: t('No {0}.', title.toLowerCase()), guidance: guidanceFor(actions) }); continue; }
      if (v.every(isScalar)) {
        if (v.length <= 12 && v.every((x) => !isLong(asString(x)))) kv.push(scalarArray(key, v));
        else sections.push({ type: 'text', id: key, title, icon: 'note', blocks: v.map((x): Block => ({ kind: 'p', text: asString(x) })) });
        continue;
      }
      const objects = v.filter(isObject);
      if (objects.length === v.length) {
        const stages = stagesOf(objects);
        if (stages) sections.push({ type: 'stages', id: key, title, icon: 'milestone', stages });
        else if (isFindings(objects)) sections.push({ type: 'findings', id: key, title, icon: 'warning', groups: findingGroups(title, objects, ctx, refs) });
        else sections.push(tableOf(key, title, objects, ctx, refs, byValue));
      } else sections.push({ type: 'text', id: key, title, icon: 'json', blocks: [{ kind: 'code', lines: JSON.stringify(v, null, 2).split('\n').map((l) => ({ text: l, copy: l })) }] });
    } else if (isObject(v)) {
      const entries = Object.entries(v);
      if (entries.length === 0) continue;
      if (entries.every(([, x]) => isScalar(x))) {
        sections.push({ type: 'kv', id: key, title, icon: 'symbol-property', items: entries.map(([k, x]) => valueOf(k, x, ctx, v)) });
      } else if (entries.every(([, x]) => isObject(x))) {
        const rows = entries.map(([k, x]) => ({ name: k, ...asObject(x) }));
        sections.push(tableOf(key, title, rows, ctx, refs, byValue));
      } else sections.push({ type: 'text', id: key, title, icon: 'json', blocks: [{ kind: 'code', lines: JSON.stringify(v, null, 2).split('\n').map((l) => ({ text: l, copy: l })) }] });
    }
  }
  return { sections, kv };
}

// ---- the resource --------------------------------------------------------------------------------------------------------------

export function nounOfKind(kind: string, presentation: Presentation): NounDecl | undefined {
  const norm = (s: string): string => s.replace(/[_\s]+/g, '-').toLowerCase();
  return presentation.nouns.find((n) => norm(n.noun) === norm(kind));
}

function titleOf(doc: Doc): string {
  const look = KIND_LOOK[doc.kind];
  if (doc.kind === 'help') return `Help: ${asString(doc.data.topic, doc.id)}`;
  if (look && ['check', 'doctor', 'fresh', 'help-list', 'command-list'].includes(doc.kind)) return look.title;
  if (doc.kind.endsWith('-list') && doc.id === 'all') return `${humanize(doc.kind.replace(/-list$/, ''))} list`;
  return labelOf(doc);
}

/** The pills a resource's own status words give: the status of the list's field (colored by the list's own map) and the common ones. */
function statusPills(doc: Doc, ctx: BuildContext): Pill[] {
  const out: Pill[] = [];
  const noun = nounOfKind(doc.kind, ctx.presentation);
  const list = noun?.list;
  if (list?.status && doc.data[list.status] !== undefined) {
    const value = asString(doc.data[list.status]);
    const status = list.statusMap[value] ?? statusOfWord(value);
    if (value) out.push({ text: value, status: status ?? 'muted', kind: 'status', title: humanize(list.status) });
  } else {
    for (const key of ['status', 'state']) {
      const v = doc.data[key];
      if (typeof v === 'string' && v !== '' && v.length < 40) { const status = doc.kind === 'check' ? checkStatus(v) : statusOfWord(v); out.push({ text: v, ...(status ? { status } : {}), kind: 'status', title: humanize(key) }); break; }
    }
  }
  const stage = doc.data.stage;
  if (typeof stage === 'string' && stage !== '' && !out.some((p) => p.text === stage)) out.push({ text: stage, icon: 'milestone', kind: 'plain', title: t('Stage') });
  for (const key of LAST_RUN_KEYS) {
    const v = doc.data[key];
    if (typeof v === 'string' && v !== '') { out.push({ text: t('Last run {0}', when(v)), icon: 'history', kind: 'plain', title: humanize(key) }); break; }
  }
  return out;
}

/** The codicon a resource's own data gives for its header, by the field its noun's `list` declares as `icon` (0041 FR-064; 0043 FR-049). */
function ownIcon(noun: NounDecl | undefined, doc: Doc): string | undefined {
  const v = noun?.list?.icon ? asString(doc.data[noun.list.icon]) : '';
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v) ? v : undefined;
}

export function buildResource(doc: Doc, ctx: BuildContext): Built {
  const refs = new Refs();
  const actions = actionsOf(doc);
  const noun = nounOfKind(doc.kind, ctx.presentation);
  const look = KIND_LOOK[doc.kind];
  const title = titleOf(doc);
  const kind = noun?.title ?? look?.title ?? humanize(doc.kind);
  const links = linksOf(doc);
  const byValue = new Map<string, Link>();
  for (const l of links) {
    if (!/\sshow$/.test(l.command)) continue;
    const first = Object.values(l.fields)[0];
    if (first !== undefined && !byValue.has(asString(first))) byValue.set(asString(first), l);
  }
  const pills = statusPills(doc, ctx);
  const subtitleKey = SUBTITLE_KEYS.find((k) => typeof doc.data[k] === 'string' && asString(doc.data[k]) !== '' && asString(doc.data[k]).length <= 300);
  const sections: Section[] = [];
  const skip = new Set<string>(subtitleKey ? [subtitleKey] : []);
  if (noun?.list?.icon && ownIcon(noun, doc)) skip.add(noun.list.icon);   // the header draws it
  const isCheck = doc.kind === 'check' && Array.isArray(doc.data.sections);
  if (isCheck) {
    const result = checkResult(doc);
    skip.add('sections').add('status').add('summary').add('suite').add('scope').add('changed');   // what the run was asked for is not a finding
    const groups = result.sections.map((s): FindingGroup => {
      const status = checkStatus(s.status);
      return { name: s.name, status, word: s.status, findings: s.findings.map((f) => findingOf({ level: f.level, where: f.where, message: f.message, next: f.next }, ctx, refs)), note: s.reason };
    });
    const counts = Object.entries(result.summary).filter(([k, n]) => !['run', 'total', 'sections'].includes(k) && n > 0).map(([k, n]): Pill => ({ text: `${n} ${k}`, status: checkStatus(k) }));
    pills.push(...counts.filter((c) => !pills.some((p) => p.text === c.text)));
    sections.push({ type: 'findings', id: 'sections', title: t('Sections'), icon: 'checklist', groups });
  }
  // What the header already says is not said again: the kind, its label, the resource's own id under its kind's name, and a line that belongs to a path.
  const norm = (x: string): string => x.replace(/[_\s]+/g, '-').toLowerCase();
  for (const [key, v] of Object.entries(doc.data)) {
    if (key === 'kind_label' || (key === 'kind' && typeof v === 'string' && norm(v) === norm(doc.kind)) || (norm(key) === norm(doc.kind) && v === doc.id)) skip.add(key);
  }
  if (typeof doc.data.line === 'number' && ['path', 'file'].some((k) => typeof doc.data[k] === 'string' && ctx.isFile(asString(doc.data[k])))) skip.add('line');
  const walked = walk(doc.data, ctx, refs, byValue, actions, skip, title);
  if (walked.kv.length) sections.unshift({ type: 'kv', id: 'details', title: t('Details'), icon: 'info', items: walked.kv });
  sections.push(...walked.sections);
  if (!sections.length) sections.push({ type: 'empty', id: 'nothing', title: t('Details'), icon: 'inbox', text: t('This resource carries no details.'), guidance: guidanceFor(actions) });
  // The links the rows did not use are the resource's related ones.
  const used = new Set(refs.list.filter((r): r is Extract<Ref, { kind: 'link' }> => r.kind === 'link').map((r) => `${r.link.command}\n${JSON.stringify(r.link.fields)}`));
  const opened = new Set(sections.flatMap((x) => (x.type === 'table' ? x.rows.filter((r) => r.open !== undefined).flatMap((r) => r.cells.map((c) => c.text)) : [])));
  const chips = links.filter((l) => !used.has(`${l.command}\n${JSON.stringify(l.fields)}`) && l.command !== '' && !opened.has(asString(Object.values(l.fields)[0]))).slice(0, 24).map((l): Chip => {
    const first = Object.values(l.fields)[0];
    const label = first === undefined ? humanize(l.rel || l.command) : `${humanize(l.rel || l.command.split(' ')[0] || l.command)}: ${asString(first)}`;
    return { label, title: l.cli ?? l.command, open: refs.add({ kind: 'link', link: l }) };
  });
  const rowOpened = refs.list.filter((r) => r.kind === 'row').length > 0 || sections.some((s) => s.type === 'table' && s.rows.some((r) => r.open !== undefined));
  if (chips.length && !(rowOpened && chips.length > 12)) sections.push({ type: 'chips', id: 'related', title: t('Related'), icon: 'link', chips });
  const header: Header = { icon: ownIcon(noun, doc) ?? noun?.icon ?? look?.icon ?? 'symbol-misc', title, kind, id: doc.id, audience: doc.audience, pills, subtitle: subtitleKey ? asString(doc.data[subtitleKey]) : '' };
  return { mode: 'resource', header, actions: actionViews(actions), sections, held: { actions, refs: refs.list } };
}

// ---- what the page receives ----------------------------------------------------------------------------------------------------

export interface Crumb { label: string; current: boolean }
export interface Nav { canBack: boolean; canForward: boolean; crumbs: Crumb[] }

/** Everything the page draws, in one message: the model of what is shown, the navigation, and the words of the page's own buttons (the host
 * puts them through `vscode.l10n`, so that the page holds no user-facing string of its own). */
export interface PanelView {
  built: Omit<Built, 'held'>;
  nav: Nav;
  /** Whether the overflow menu offers Copy Context (the command line has a `context` command and the resource a kind and an id). */
  context: boolean;
  /** The command line that shows this resource, to copy. */
  line: string | null;
  /** Set once the person has applied or discarded a dry run, so that its buttons say so and are off. */
  settled?: 'applied' | 'discarded';
  labels: Record<string, string>;
}

/** Every text the host may send the page to copy: the lines of the code blocks, the commands of the actions and the paths of the files. The
 * page asks to copy by text, and the host copies only what it itself put in the model. */
export function copyable(built: Built, line: string | null): Set<string> {
  const out = new Set<string>();
  if (line) out.add(line);
  for (const a of built.actions) if (a.cli) out.add(a.cli);
  const code = (blocks: Block[]): void => { for (const b of blocks) if (b.kind === 'code') for (const l of b.lines) out.add(l.copy); };
  for (const s of built.sections) {
    switch (s.type) {
      case 'text': code(s.blocks); break;
      case 'reading': for (const p of s.parts) code(p.blocks); break;
      case 'lesson': for (const st of s.steps) if (st.line) out.add(st.line); break;
      case 'kv': for (const i of s.items) { out.add(i.value); if (i.file) out.add(i.file.path); } break;
      case 'changes': for (const c of s.changes) out.add(c.path); break;
      case 'findings': for (const g of s.groups) for (const f of g.findings) { out.add(f.message); if (f.where) out.add(f.where); } break;
      default: break;
    }
  }
  return out;
}

export const heldOf = (built: Built): Omit<Built, 'held'> => { const { held: _held, ...rest } = built; return rest; };
