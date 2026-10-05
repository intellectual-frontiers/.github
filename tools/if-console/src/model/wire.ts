// The wire shape every orchestrator uses for what the editor reads (0041-command-line FR-019, FR-064). Nothing here knows any one
// orchestrator: it reads documents and says what they hold.
import { asArray, asBool, asObject, asString, asStrings, isObject, type JsonObject } from './json';
import { NO_PRESENTATION, presentationOf, type Presentation } from './presentation';

export const DECISION = 'decision';
/** Every category but read and check (0041 FR-015). */
export const WRITES: readonly string[] = ['record', 'build', 'generate', 'decision', 'setup'];
/** The versions of each document kind this extension reads. A kind it holds no entry for is read at version 1, the wire's first. */
export const SUPPORTED: Record<string, number[]> = { 'command-list': [1], command: [1], check: [1], doctor: [1], error: [1], fresh: [1], default: [1] };

export type WireCode = 'schema' | 'update' | 'json' | 'launcher';

export class WireError extends Error {
  readonly code: WireCode;
  constructor(code: WireCode, message: string) {
    super(message);
    this.name = 'WireError';
    this.code = code;
  }
}

/** One document of the wire. `data`, `links` and `actions` are read by the functions below, never cast. */
export interface Doc { schema: string; audience: string; kind: string; id: string; data: JsonObject; links: unknown[]; actions: unknown[] }

export interface Link { rel: string; command: string; fields: Record<string, unknown>; cli: string | null }

export interface Action {
  label: string;
  command: string;
  fields: Record<string, unknown>;
  category: string;
  cli: string | null;
  enabled: boolean;
  reason: string;
  needs: string[];
}

export interface Arg { name: string; type: string; help: string; required: boolean; words: boolean; many: boolean; choices: string[] | null }
export interface Opt { flag: string; type: string; help: string; multiple: boolean; required: boolean; choices: string[] | null }

export interface CommandSummary {
  id: string;
  words: string[];
  noun: string | null;
  verb: string;
  category: string;
  group: string | null;
  surfaces: string[];
  help: string;
  title: string | null;
  icon: string | null;
}

export interface CommandList { orchestrator: string; audience: string; commands: CommandSummary[]; presentation: Presentation }

export interface CommandDetail {
  id: string;
  words: string[];
  noun: string | null;
  verb: string | null;
  category: string;
  help: string;
  group: string | null;
  usage: string;
  surfaces: string[];
  programs: unknown[];
  title: string | null;
  icon: string | null;
  arguments: Arg[];
  options: Opt[];
}

export interface Finding { level: string; where: string; message: string; next: string }
export interface Section { name: string; status: string; reason: string; notes: unknown[]; findings: Finding[] }
export interface CheckResult { status: string; summary: Record<string, number>; sections: Section[] }

export interface ErrorInfo { code: string; message: string; type: string | null; value: unknown; examples: string[]; actions: Action[] }

export interface Schema { orchestrator: string; kind: string; version: number }
export type SchemaCheck = { ok: true; schema: Schema } | { ok: false; code: WireCode; message: string; schema?: Schema };

export function parseSchema(schema: unknown): Schema | null {
  const m = /^([^/@\s]+)\/([^@\s]+)@(\d+)$/.exec(asString(schema));
  return m ? { orchestrator: m[1] ?? '', kind: m[2] ?? '', version: Number(m[3]) } : null;
}

/** Read a parsed JSON value as a document, or null where it is not an object. A field a document lacks is empty, so that the checks
 * below can say what is wrong with it. */
export function readDoc(value: unknown): Doc | null {
  if (!isObject(value)) return null;
  return { schema: asString(value.schema), audience: asString(value.audience), kind: asString(value.kind), id: asString(value.id),
    data: asObject(value.data), links: asArray(value.links), actions: asArray(value.actions) };
}

/** A newer version is "update needed" (0043 FR-021). */
export function checkSchema(doc: Doc | null, table: Record<string, number[]> = SUPPORTED): SchemaCheck {
  const s = parseSchema(doc?.schema);
  if (!s) return { ok: false, code: 'schema', message: 'The command line answered with something this extension does not recognize as one of its documents.' };
  const known = table[s.kind] ?? table.default ?? [1];
  if (!known.includes(s.version)) {
    return { ok: false, code: 'update', schema: s,
      message: `This command line answers in a newer form (${doc?.schema ?? ''}) than this extension understands. Update the IF Console extension to read it.` };
  }
  return { ok: true, schema: s };
}

/** Standard output: one JSON document, or NDJSON, one document per line (0041 FR-019). */
export function parseDocuments(text: string): Doc[] {
  const t = text.trim();
  if (t === '') return [];
  const one = tryParse(t);
  if (one !== undefined) {
    const d = readDoc(one);
    return d ? [d] : [];
  }
  const docs: Doc[] = [];
  for (const line of t.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const parsed = tryParse(line);
    const d = parsed === undefined ? null : readDoc(parsed);
    if (!d) throw new WireError('json', 'The command line printed something that is not a document.');
    docs.push(d);
  }
  return docs;
}

function tryParse(text: string): unknown {
  try { return JSON.parse(text) as unknown; } catch { return undefined; }
}

export const wordsOf = (id: unknown): string[] => asString(id).trim().split(/\s+/);

function need(doc: Doc, kind: string, message: string): void {
  const s = checkSchema(doc);
  if (!s.ok) throw new WireError(s.code, s.message);
  if (doc.kind !== kind) throw new WireError('schema', message);
}

/** `command list` -> the orchestrator, its audience, each command and its presentation. */
export function commandList(doc: Doc): CommandList {
  need(doc, 'command-list', 'The command line did not answer `command list` with a list of commands.');
  const rows = doc.data.commands;
  if (!Array.isArray(rows)) throw new WireError('schema', 'The command line did not answer `command list` with a list of commands.');
  const commands = rows.map(asObject).map((c): CommandSummary => {
    const words = wordsOf(c.id);
    return {
      id: words.join(' '), words,
      noun: c.noun !== undefined ? (c.noun === null ? null : asString(c.noun)) : (words.length === 2 ? words[0] ?? null : null),
      verb: c.verb !== undefined ? asString(c.verb) : (words.length === 2 ? words[1] ?? '' : words[0] ?? ''),
      category: asString(c.category), group: c.group ? asString(c.group) : null, surfaces: asStrings(c.surfaces), help: asString(c.help),
      title: c.title ? asString(c.title) : null, icon: c.icon ? asString(c.icon) : null,
    };
  });
  const s = parseSchema(doc.schema);
  return { orchestrator: s?.orchestrator ?? '', audience: doc.audience || 'unstated', commands,
    presentation: doc.data.presentation === undefined ? NO_PRESENTATION : presentationOf(doc.data) };
}

export const exposed = (c: CommandSummary): boolean => c.surfaces.includes('editor');

export interface Nouns { nouns: Map<string, CommandSummary[]>; repoWide: CommandSummary[] }

export function nounsOf(list: CommandList): Nouns {
  const nouns = new Map<string, CommandSummary[]>();
  const repoWide: CommandSummary[] = [];
  for (const c of list.commands) {
    if (!exposed(c)) continue;
    if (c.noun === null) { repoWide.push(c); continue; }
    const held = nouns.get(c.noun);
    if (held) held.push(c); else nouns.set(c.noun, [c]);
  }
  return { nouns, repoWide };
}

const choicesOf = (v: unknown): string[] | null => (Array.isArray(v) ? v.map((x) => asString(x)) : null);

/** `command show` -> one command in full. */
export function commandDetail(doc: Doc): CommandDetail {
  need(doc, 'command', 'The command line did not describe the command in a form this extension reads.');
  const d = doc.data;
  if (!Array.isArray(d.arguments) || !Array.isArray(d.options)) throw new WireError('schema', 'The command line did not describe the command in a form this extension reads.');
  return {
    id: wordsOf(d.id).join(' '), words: wordsOf(d.id), noun: d.noun ? asString(d.noun) : null, verb: d.verb ? asString(d.verb) : null,
    category: asString(d.category), help: asString(d.help), group: d.group ? asString(d.group) : null, usage: asString(d.usage),
    surfaces: asStrings(d.surfaces), programs: asArray(d.programs ?? d.toolchain), title: d.title ? asString(d.title) : null, icon: d.icon ? asString(d.icon) : null,
    arguments: d.arguments.map(asObject).map((a): Arg => ({ name: asString(a.name), type: asString(a.type), help: asString(a.help), required: asBool(a.required),
      words: asBool(a.words), many: asBool(a.many), choices: choicesOf(a.choices) })),
    options: d.options.map(asObject).map((o): Opt => ({ flag: asString(o.flag), type: asString(o.type), help: asString(o.help), multiple: asBool(o.multiple),
      required: asBool(o.required), choices: choicesOf(o.choices) })),
  };
}

export function actionOf(raw: unknown): Action | null {
  const a = asObject(raw);
  if (!asStrings(a.surfaces).includes('editor')) return null;
  return { label: asString(a.label), command: asString(a.command), fields: asObject(a.fields), category: asString(a.category),
    cli: a.cli === undefined || a.cli === null ? null : asString(a.cli), enabled: a.enabled !== false, reason: asString(a.reason), needs: asStrings(a.needs) };
}

/** The actions a person is offered: only those the editor surface exposes. One that cannot run now is shown disabled with its reason. */
export const actionsOf = (doc: Doc): Action[] => doc.actions.map(actionOf).filter((a): a is Action => a !== null);

export const linksOf = (doc: Doc): Link[] => doc.links.map(asObject).map((l): Link => ({ rel: asString(l.rel), command: asString(l.command), fields: asObject(l.fields),
  cli: l.cli === undefined || l.cli === null ? null : asString(l.cli) }));

/** A `check` document -> its status, summary and sections with their findings. */
export function checkResult(doc: Doc): CheckResult {
  need(doc, 'check', 'The command line did not answer with check results.');
  const d = doc.data;
  if (!Array.isArray(d.sections)) throw new WireError('schema', 'The command line did not answer with check results.');
  const summary: Record<string, number> = {};
  for (const [k, v] of Object.entries(asObject(d.summary))) if (typeof v === 'number') summary[k] = v;
  return {
    status: asString(d.status), summary,
    sections: d.sections.map(asObject).map((x): Section => ({ name: asString(x.name), status: asString(x.status), reason: asString(x.reason), notes: asArray(x.notes),
      findings: asArray(x.findings).map(asObject).map((f): Finding => ({ level: asString(f.level), where: asString(f.where), message: asString(f.message), next: asString(f.next) })) })),
  };
}

export type Health = 'well' | 'something missing' | 'needs attention' | 'unknown';

/** The plain-words state of a `doctor` document. */
export function doctorState(doc: Doc | null): Health {
  const status = doc?.data.status;
  if (status === 'ok' || status === 'well' || status === 'passed') return 'well';
  if (status === 'missing') return 'something missing';
  if (status === 'failed' || status === 'attention') return 'needs attention';
  return 'unknown';
}

/** An error document -> its code, message and, for a refused value, the type and examples. */
export function errorOf(doc: Doc | null): ErrorInfo | null {
  if (!doc || doc.kind !== 'error') return null;
  const d = doc.data;
  return { code: asString(d.code, doc.id), message: asString(d.message, 'The command failed.'), type: d.type ? asString(d.type) : null, value: d.value,
    examples: asStrings(d.examples), actions: actionsOf(doc) };
}

/** The one-line label of a resource, from what the document carries. */
export const labelOf = (doc: Doc): string => asString(doc.data.title || doc.data.name || doc.data.label || doc.id || doc.kind);
