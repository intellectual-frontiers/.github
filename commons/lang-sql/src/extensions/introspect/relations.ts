/**
 * The relations of a parse (commons lang-sql 0008-sql-introspect FR-002, FR-003, FR-008): the tree, its attributes, ancestors, tokens, comments, names, calls, parameters, common table expressions, diagnostics and the language of the dialect,
 * as tables of values. Each is built when it is asked for.
 *
 * Spec: 0008-sql-introspect FR-002, FR-003, FR-008
 *
 * @module
 */
import { describeParseError, type Dialect, type Node, type Parsed, spanOf, Tok, kindAt, lex, startAt, endAt, textAt, tokenCount } from "../../mod.ts";
import type { Table, Value } from "./engine.ts";

/** A node in the order of the text with where it stands. */
export interface Flat {
  readonly id: number;
  readonly parent: number;
  readonly stmt: number;
  readonly node: Node;
  readonly field: string;
  readonly ordinal: number;
  readonly depth: number;
  readonly parentNode: Node | undefined;
}

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string" && "start" in v && typeof v.start === "number";

/** Every node of every statement in the order of the text. */
export function flatten(parsed: Parsed): readonly Flat[] {
  const out: Flat[] = [];
  const visit = (node: Node, parent: Flat | undefined, stmt: number, field: string, ordinal: number): void => {
    const flat: Flat = { id: out.length + 1, parent: parent?.id ?? 0, stmt, node, field, ordinal, depth: (parent?.depth ?? -1) + 1, parentNode: parent?.node };
    out.push(flat);
    const kids: { readonly start: number; readonly field: string; readonly ordinal: number; readonly node: Node }[] = [];
    for (const [key, v] of Object.entries(node)) {
      if (key === "kind" || v === undefined) continue;
      if (isNode(v)) kids.push({ start: v.start, field: key, ordinal: 0, node: v });
      else if (Array.isArray(v)) for (const [i, x] of v.entries()) if (isNode(x)) kids.push({ start: x.start, field: key, ordinal: i, node: x });
    }
    kids.sort((a, b) => a.start - b.start);
    for (const k of kids) visit(k.node, flat, stmt, k.field, k.ordinal);
  };
  for (const [i, s] of parsed.script.statements.entries()) visit(s, undefined, i + 1, "statements", i);
  return out;
}

/** The columns of every relation. */
export const SCHEMA: Readonly<Record<string, readonly string[]>> = {
  statement: ["id", "kind", "start", "stop", "text", "fingerprint", "read_only"],
  node: ["id", "parent", "stmt", "kind", "field", "ordinal", "depth", "start", "stop"],
  attr: ["node", "name", "value"],
  ancestor: ["node", "ancestor", "distance"],
  token: ["id", "kind", "start", "stop", "text"],
  comment: ["id", "style", "marker", "text", "start", "stop", "placement", "node"],
  table_ref: ["node", "name", "access"],
  column_ref: ["node", "name", "qualifier"],
  function_call: ["node", "name", "argc", "is_distinct"],
  param: ["node", "style", "text"],
  cte: ["node", "name", "uses"],
  diagnostic: ["id", "severity", "code", "message", "start", "stop", "rule", "node"],
  keyword: ["word"],
  operator: ["text"],
  function: ["name", "min_args", "max_args", "aggregate"],
};

const lc = (s: string): string => s.toLowerCase();
const dotted = (n: Node): string => (n.kind === "name" ? n.parts.map((p) => p.name).join(".") : "");

function hash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b + c, 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

const MASKED: ReadonlySet<string> = new Set(["number", "string", "param", "boolean", "null", "typed-string"]);

/** The shape of a node: its kinds and names with the values of literals taken out. */
export function shapeOf(node: Node): string {
  let out = node.kind;
  if (MASKED.has(node.kind)) return "?";
  const parts: string[] = [];
  for (const [key, v] of Object.entries(node)) {
    if (key === "kind" || key === "start" || key === "end" || v === undefined) continue;
    if (isNode(v)) parts.push(`${key}:${shapeOf(v)}`);
    else if (Array.isArray(v)) parts.push(`${key}:[${v.map((x) => (isNode(x) ? shapeOf(x) : String(x))).join(",")}]`);
    else parts.push(`${key}=${String(v)}`);
  }
  out += `(${parts.join(";")})`;
  return out;
}

const WRITE_PARENT: ReadonlySet<string> = new Set(["update", "delete"]);

function accessOf(f: Flat): string | undefined {
  const p = f.parentNode?.kind;
  if (f.node.kind === "table") return p !== undefined && WRITE_PARENT.has(p) && f.field === "table" ? "write" : "read";
  if (f.node.kind !== "name") return undefined;
  if (p === "insert" && f.field === "table") return "write";
  if ((p === "create-table" || p === "create-view") && f.field === "name") return "create";
  if (p === "create-index" && f.field === "table") return "alter";
  if (p === "alter-table" && f.field === "table") return "alter";
  if (p === "drop" && f.field === "names") return "drop";
  return undefined;
}

const NOT_COLUMN: ReadonlySet<string> = new Set(["insert.table", "create-table.name", "create-view.name", "create-index.table", "create-index.name", "alter-table.table", "drop.names", "call.name", "table.name", "cte.name", "collate.collation", "table-like.table", "reference.table", "create-routine.name", "star.qualifier"]);

/** The relations that a parse gives, built one by one when asked. */
export function relationsOf(parsed: Parsed, dialect: Dialect, functions: readonly { readonly name: string; readonly minArgs: number; readonly maxArgs: number | undefined; readonly aggregate: boolean }[], diagnosticRows: () => readonly (readonly Value[])[]): { readonly get: (name: string) => Table | undefined; readonly built: () => readonly string[]; readonly flat: () => readonly Flat[] } {
  const cache = new Map<string, Table>();
  const builtOrder: string[] = [];
  let flatCache: readonly Flat[] | undefined;
  const flat = (): readonly Flat[] => {
    flatCache ??= flatten(parsed);
    return flatCache;
  };
  const make = (name: string): Table | undefined => {
    const columns = SCHEMA[name];
    if (columns === undefined) return undefined;
    const rows: (readonly Value[])[] = [];
    switch (name) {
      case "statement":
        for (const f of flat()) {
          if (f.parent !== 0) continue;
          const k = f.node.kind;
          const readOnly = k === "select" || k === "set-op" || k === "values" || (k === "with" && f.node.kind === "with" && (f.node.body.kind === "select" || f.node.body.kind === "set-op" || f.node.body.kind === "values" || f.node.body.kind === "with"));
          rows.push([f.stmt, k, f.node.start, f.node.end, parsed.text.slice(f.node.start, f.node.end), hash(shapeOf(f.node)), readOnly]);
        }
        break;
      case "node":
        for (const f of flat()) rows.push([f.id, f.parent, f.stmt, f.node.kind, f.field, f.ordinal, f.depth, f.node.start, f.node.end]);
        break;
      case "attr":
        for (const f of flat()) {
          for (const [k, v] of Object.entries(f.node)) {
            if (k === "kind" || k === "start" || k === "end") continue;
            if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") rows.push([f.id, k, v]);
          }
        }
        break;
      case "ancestor": {
        const byId = new Map(flat().map((f) => [f.id, f]));
        for (const f of flat()) {
          let d = 1;
          for (let p = byId.get(f.parent); p !== undefined; p = byId.get(p.parent)) rows.push([f.id, p.id, d++]);
        }
        break;
      }
      case "token": {
        const l = lex(parsed.text, dialect.compiled);
        const names = new Map<number, string>(Object.entries(Tok).map(([k, v]) => [v, k.toLowerCase()]));
        for (let i = 0; i < tokenCount(l.tokens) - 1; i++) rows.push([i + 1, names.get(kindAt(l.tokens, i)) ?? "?", startAt(l.tokens, i), endAt(l.tokens, i), textAt(l.tokens, parsed.text, i)]);
        break;
      }
      case "comment": {
        const ids = new Map<Node, number>(flat().map((f) => [f.node, f.id]));
        for (const [i, a] of parsed.attachments.all.entries()) rows.push([i + 1, a.comment.style, a.comment.marker, a.comment.text, a.comment.span.start, a.comment.span.end, a.placement, ids.get(a.node) ?? 0]);
        break;
      }
      case "table_ref":
        for (const f of flat()) {
          const a = accessOf(f);
          if (a !== undefined) rows.push([f.id, f.node.kind === "table" ? dotted(f.node.name) : dotted(f.node), a]);
        }
        break;
      case "column_ref":
        for (const f of flat()) {
          if (f.node.kind !== "name") continue;
          if (NOT_COLUMN.has(`${f.parentNode?.kind ?? ""}.${f.field}`)) continue;
          const parts = f.node.parts;
          rows.push([f.id, parts[parts.length - 1]?.name ?? "", parts.length > 1 ? parts.slice(0, -1).map((p) => p.name).join(".") : null]);
        }
        break;
      case "function_call":
        for (const f of flat()) if (f.node.kind === "call") rows.push([f.id, dotted(f.node.name), f.node.args.length, f.node.distinct]);
        break;
      case "param":
        for (const f of flat()) if (f.node.kind === "param") rows.push([f.id, f.node.style, f.node.text]);
        break;
      case "cte": {
        const uses = new Map<string, number>();
        for (const f of flat()) if (f.node.kind === "table" && f.node.name.parts.length === 1) uses.set(`${f.stmt}:${lc(f.node.name.parts[0]?.name ?? "")}`, (uses.get(`${f.stmt}:${lc(f.node.name.parts[0]?.name ?? "")}`) ?? 0) + 1);
        for (const f of flat()) if (f.node.kind === "cte") rows.push([f.id, f.node.name.name, uses.get(`${f.stmt}:${lc(f.node.name.name)}`) ?? 0]);
        break;
      }
      case "diagnostic":
        rows.push(...diagnosticRows());
        break;
      case "keyword":
        for (const w of dialect.lexical.keywords) rows.push([w.toUpperCase()]);
        break;
      case "operator":
        for (const o of dialect.compiled.operators) rows.push([o]);
        break;
      case "function":
        for (const f of functions) rows.push([f.name, f.minArgs, f.maxArgs ?? null, f.aggregate]);
        break;
      default:
        return undefined;
    }
    return { columns, rows };
  };
  return {
    get(name) {
      const key = lc(name);
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const t = make(key);
      if (t !== undefined) {
        cache.set(key, t);
        builtOrder.push(key);
      }
      return t;
    },
    built: () => [...builtOrder],
    flat,
  };
}

/** The rows of the errors of the lexer and the parser of a parse. */
export function parseDiagnostics(parsed: Parsed): readonly (readonly Value[])[] {
  return parsed.errors.map((e, i) => {
    const s = spanOf(e);
    return [i + 1, "error", e.kind === "lex" ? "lex" : "parse", describeParseError(e), s.start, s.end, e.kind === "lex" ? "lex" : "parse", null];
  });
}
