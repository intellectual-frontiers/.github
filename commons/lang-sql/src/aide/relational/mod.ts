/**
 * The engine of introspection (commons lang-sql 0008-sql-introspect FR-005, FR-006; 0010-aide FR-010): a small evaluator of the common ground of SQL over relations held in memory, so that a question about a tree is a query. It reads the query with this
 * library's own parser, with the logic of SQL (null where a value is not known), and says in one sentence what it does not have. It sits behind {@link Engine}, which does not name the tree, and takes its relations from a {@link Provider}, so that any rows (a file tree, a list of checks, the tables of a machine) can be asked in SQL; it is read-only, and a statement that is not a query is an error value.
 *
 * Spec: 0008-sql-introspect FR-005, FR-006
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { castTemporal, extract, formatDate, formatTime, formatTimestamp, intervalLiteral, formatInterval, negateInterval, temporalArithmetic, temporalOrder } from "./temporal.ts";
import { ansi, children, type Dialect, type Expr, type FrameBound, type Node, type OrderItem, parse, type Query, type Select, type SelectItem, type SetOp, type Source, type WindowDef, type WindowSpec, declareDialect } from "../../mod.ts";

/** A value of a relation. */
export type Value = string | number | boolean | null;

/** A relation: named columns and rows of values. */
export interface Table {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly Value[])[];
}

/** What a query gives. */
export type Rows = Table;

/** What is wrong with a query, in one sentence. */
export interface QueryError {
  readonly message: string;
}

/** The functions a query may call besides the built-in ones of the engine. */
export type ScalarFunction = (args: readonly Value[]) => Value;

/** Something that answers a query. */
export interface Engine {
  run(sql: string, params?: readonly Value[]): Result<Rows, QueryError>;
}

/** The dialect of the queries: the common ground. */
export const astsql: Dialect = declareDialect({ name: "astsql", extends: ansi, lexical: (l) => ({ ...l, params: ["question", "dollar-number"] }) });

class Failure extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(detail);
    this.detail = detail;
  }
}
const fail = (m: string): never => {
  throw new Failure(m);
};

interface Binding {
  readonly alias: string;
  readonly columns: readonly string[];
  readonly row: readonly Value[];
  /** The columns (in lower case) that a `USING` or `NATURAL` join made one, which `*` and an unqualified name read from the join's own column instead (0010-aide FR-014). */
  readonly hidden?: ReadonlySet<string>;
}

/** A binding with more of its columns hidden from `*` and from unqualified names. */
const hiding = (b: Binding, columns: readonly string[]): Binding => ({ ...b, hidden: new Set([...(b.hidden ?? []), ...columns]) });

/** Whether `*` and an unqualified name read the column at `i` of the binding. */
const visible = (b: Binding, i: number): boolean => !(b.hidden ?? new Set<string>()).has(lc(b.columns[i] ?? ""));
interface Env {
  readonly bindings: readonly Binding[];
  readonly outer: Env | undefined;
}
interface Context {
  readonly tables: (name: string) => Table | undefined;
  readonly functions: ReadonlyMap<string, ScalarFunction>;
  readonly params: readonly Value[];
  readonly paramIndex: ReadonlyMap<Node, number>;
  readonly ctes: ReadonlyMap<string, Table>;
  /** The moment `CURRENT_DATE`, `CURRENT_TIMESTAMP` and the others are read at: one for the whole statement (0010-aide FR-017). */
  readonly now: Date;
  /** The values of the window functions of the select being run, by call and by the row they are for (0010-aide FR-013). */
  readonly windowValues?: Map<Node, ReadonlyMap<Env, Value>>;
  /** In a row of a grouping set (0010-aide FR-019): the keys of the grouping expressions the set holds, and of those it does not, which are null in the row. */
  readonly groupingSet?: ReadonlySet<string>;
  readonly nulled?: ReadonlySet<string>;
  readonly groupingAll?: ReadonlySet<string>;
}

const AGGREGATES: ReadonlySet<string> = new Set(["count", "sum", "avg", "min", "max", "group_concat"]);
const lc = (s: string): string => s.toLowerCase();

const truthy = (v: Value): boolean => v === true || (typeof v === "number" && v !== 0);

/** Whether a text may be a date, a time, a timestamp or an interval, from its first characters, so that the text of other values is not read as one. */
const maybeTemporal = (s: string): boolean => (s.length >= 3 && s.length <= 40 && ((s.charCodeAt(0) >= 48 && s.charCodeAt(0) <= 57 && (s.charAt(4) === "-" || s.charAt(2) === ":")) || s.charAt(0) === "P" || s.startsWith("-P")));

function compare(a: Value, b: Value): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string" && maybeTemporal(a) && maybeTemporal(b)) {
    const t = temporalOrder(a, b);
    if (t !== undefined) return t;
  }
  if (typeof a === "boolean" || typeof b === "boolean") return Number(a) - Number(b);
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The order of values of one column: null first. */
function order(a: Value, b: Value): number {
  if (a === null) return b === null ? 0 : -1;
  if (b === null) return 1;
  return compare(a, b);
}

function likeRegex(pattern: string, escape: string | undefined): RegExp {
  let out = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern.charAt(i);
    if (escape !== undefined && c === escape && i + 1 < pattern.length) {
      i++;
      out += pattern.charAt(i).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (c === "%") out += "[\\s\\S]*";
    else if (c === "_") out += "[\\s\\S]";
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${out}$`, "u");
}

function numberOf(v: Value): number | null {
  if (v === null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return Number.isNaN(n) ? fail(`"${v}" is not a number`) : n;
}

const BUILTIN: ReadonlyMap<string, ScalarFunction> = new Map<string, ScalarFunction>([
  ["lower", (a) => (typeof a[0] === "string" ? a[0].toLowerCase() : (a[0] ?? null))],
  ["upper", (a) => (typeof a[0] === "string" ? a[0].toUpperCase() : (a[0] ?? null))],
  ["length", (a) => (a[0] === null || a[0] === undefined ? null : String(a[0]).length)],
  [
    "substr",
    (a) => {
      const s = a[0];
      if (s === null || s === undefined) return null;
      const from = numberOf(a[1] ?? null);
      if (from === null) return null;
      const len = a[2] === undefined ? undefined : numberOf(a[2]);
      const start = from > 0 ? from - 1 : 0;
      return len === undefined || len === null ? String(s).slice(start) : String(s).slice(start, start + len);
    },
  ],
  ["coalesce", (a) => a.find((v) => v !== null) ?? null],
  ["nullif", (a) => (a[0] !== undefined && a[1] !== undefined && compare(a[0], a[1]) === 0 ? null : (a[0] ?? null))],
  ["abs", (a) => (a[0] === null || a[0] === undefined ? null : Math.abs(numberOf(a[0]) ?? 0))],
  [
    "instr",
    (a) => {
      if (a[0] === null || a[1] === null || a[0] === undefined || a[1] === undefined) return null;
      return String(a[0]).indexOf(String(a[1])) + 1;
    },
  ],
  [
    "replace",
    (a) => {
      if (a[0] === null || a[1] === null || a[2] === null || a[0] === undefined || a[1] === undefined || a[2] === undefined) return null;
      return String(a[0]).split(String(a[1])).join(String(a[2]));
    },
  ],
  ["typeof", (a) => (a[0] === null || a[0] === undefined ? "null" : typeof a[0] === "number" ? (Number.isInteger(a[0]) ? "integer" : "real") : typeof a[0] === "boolean" ? "boolean" : "text")],
]);

function pushScope(env: Env | undefined, b: Binding): Env {
  return { bindings: [b], outer: env };
}

function lookup(env: Env, qualifier: string | undefined, name: string): Value {
  const n = lc(name);
  for (let e: Env | undefined = env; e !== undefined; e = e.outer) {
    let found: Value | undefined;
    let count = 0;
    for (const b of e.bindings) {
      if (qualifier !== undefined && lc(b.alias) !== lc(qualifier)) continue;
      const i = b.columns.findIndex((c) => lc(c) === n);
      if (i >= 0 && (qualifier !== undefined || visible(b, i))) {
        found = b.row[i] ?? null;
        count++;
      }
    }
    if (count > 1) return fail(`the column ${name} is ambiguous`);
    if (found !== undefined) return found;
  }
  return fail(`no column ${qualifier === undefined ? "" : `${qualifier}.`}${name}`);
}

/** The key of the values a join compares: null where any is null (a null equals nothing), else the values as text with their types. */
const rowKeyValue = (values: readonly Value[]): Value => (values.some((v) => v === null) ? null : values.map((v) => `${typeof v}:${String(v)}`).join("\u0001"));

/** `CURRENT_DATE`, `CURRENT_TIME`, `CURRENT_TIMESTAMP`, `LOCALTIME` and `LOCALTIMESTAMP` at a moment (in UTC), or `undefined` for any other name (0010-aide FR-017). */
function currentOf(name: string, now: Date): Value | undefined {
  switch (name) {
    case "current_date":
      return formatDate(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    case "current_time":
    case "localtime":
      return formatTime(now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds());
    case "current_timestamp":
    case "localtimestamp":
      return formatTimestamp(Math.floor(now.getTime() / 1000) * 1000);
    default:
      return undefined;
  }
}

/** A key that two expressions share where they are the same expression written alike, without regard to case or place. */
function exprKey(e: Node): string {
  return JSON.stringify(e, (k, v: unknown) => (k === "start" || k === "end" || k === "leading" || k === "trailing" || k === "comments" ? undefined : v)).toLowerCase();
}

/** The sets of a `GROUP BY` that one of its elements stands for (0010-aide FR-019): a plain expression is one set of one, a parenthesized list one set, `ROLLUP` its prefixes, `CUBE` its subsets and `GROUPING SETS` the sets of its arguments. */
function setsOf(x: Expr): Expr[][] {
  const units = (args: readonly Expr[]): Expr[][] => args.map((a) => (a.kind === "tuple" ? [...a.items] : [a]));
  if (x.kind === "tuple") return [[...x.items]];
  if (x.kind !== "call") return [[x]];
  const name = lc(x.name.parts.map((p) => p.name).join(" "));
  const args = x.args.map((a) => (a.kind === "star" || a.kind === "named-arg" || a.kind === "keyword-arg" ? fail(`${name} takes expressions`) : a));
  if (name === "rollup") {
    const u = units(args);
    return Array.from({ length: u.length + 1 }, (_, i) => u.slice(0, u.length - i).flat());
  }
  if (name === "cube") {
    const u = units(args);
    if (u.length > 12) return fail("a CUBE of more than 12 expressions is not in astsql");
    const out: Expr[][] = [];
    for (let mask = (1 << u.length) - 1; mask >= 0; mask--) out.push(u.flatMap((x2, i) => ((mask >> (u.length - 1 - i)) & 1) === 1 ? x2 : []));
    return out;
  }
  if (name === "grouping sets") return args.flatMap((a) => (a.kind === "tuple" || a.kind === "call" ? setsOf(a) : [[a]]));
  return [[x]];
}

/** All the sets of a `GROUP BY`: the sets of each element put together with those of the elements before it. */
function groupingSets(elements: readonly Expr[]): Expr[][] {
  let sets: Expr[][] = [[]];
  for (const el of elements) {
    const next: Expr[][] = [];
    for (const s of sets) for (const t of setsOf(el)) next.push([...s, ...t]);
    sets = next;
  }
  return sets;
}

const QUANTIFIERS: ReadonlySet<string> = new Set(["any", "some", "all"]);

/** `a op b` for a comparison operator, with the logic of SQL (null where either is null), or `undefined` for any other operator. */
function comparison(op: string, a: Value, b: Value): boolean | null | undefined {
  if (op !== "=" && op !== "<>" && op !== "!=" && op !== "<" && op !== "<=" && op !== ">" && op !== ">=") return undefined;
  if (a === null || b === null) return null;
  const c = compare(a, b);
  return op === "=" ? c === 0 : op === "<>" || op === "!=" ? c !== 0 : op === "<" ? c < 0 : op === "<=" ? c <= 0 : op === ">" ? c > 0 : c >= 0;
}

/** `x op ANY|SOME|ALL (query or array)` (0010-aide FR-020). */
function quantified(op: string, quantifier: string, left: Value, arg: Expr | Extract<Expr, { kind: "call" }>["args"][number] | undefined, env: Env, ctx: Context): Value {
  if (!isPlainArg(arg)) return fail(`${quantifier.toUpperCase()} takes a subquery or an array`);
  let values: Value[];
  if (arg.kind === "scalar-query") {
    const t = runQuery(arg.query, ctx, env);
    if (t.columns.length !== 1) return fail(`the subquery of ${quantifier.toUpperCase()} has ${t.columns.length} columns, and must have one`);
    values = t.rows.map((r) => r[0] ?? null);
  } else if (arg.kind === "array") values = arg.items.map((x) => evalExpr(x, env, ctx, undefined));
  else return fail(`${quantifier.toUpperCase()} takes a subquery or an array`);
  let sawNull = false;
  for (const v of values) {
    const c = comparison(op, left, v);
    if (c === undefined) return fail(`the operator ${op} is not in astsql with ${quantifier.toUpperCase()}`);
    if (c === null) sawNull = true;
    else if (quantifier === "all" ? !c : c) return quantifier !== "all";
  }
  if (values.length === 0) return quantifier === "all";
  return sawNull ? null : quantifier === "all";
}

const isQuery = (n: Node): boolean => n.kind === "select" || n.kind === "set-op" || n.kind === "values" || n.kind === "with";

function hasAggregate(n: Node): boolean {
  if (n.kind === "call" && n.over === undefined && AGGREGATES.has(lc(n.name.parts[n.name.parts.length - 1]?.name ?? ""))) return true;
  for (const c of children(n)) {
    if (isQuery(c)) continue;
    if (hasAggregate(c)) return true;
  }
  return false;
}

/** The window functions (calls with `OVER`) of an expression, not looking into a subquery. */
function windowCallsOf(n: Node, out: Extract<Expr, { kind: "call" }>[]): void {
  if (n.kind === "call" && n.over !== undefined) out.push(n);
  for (const c of children(n)) if (!isQuery(c)) windowCallsOf(c, out);
}

function paramsOf(n: Node, out: Node[]): void {
  if (n.kind === "param") out.push(n);
  for (const c of children(n)) paramsOf(c, out);
}

/** The value of an expression in a row; in a group, an aggregate reads the rows of the group. */
function evalExpr(e: Expr, env: Env, ctx: Context, group: readonly Env[] | undefined): Value {
  if (ctx.nulled !== undefined && group !== undefined && e.kind !== "number" && e.kind !== "string" && ctx.nulled.has(exprKey(e))) return null;
  const go = (x: Expr): Value => evalExpr(x, env, ctx, group);
  switch (e.kind) {
    case "number":
      return Number(e.text.replaceAll("_", ""));
    case "string":
      return e.value;
    case "boolean":
      return e.value;
    case "null":
      return null;
    case "param": {
      const i = ctx.paramIndex.get(e);
      const style = e.text;
      const idx = style.startsWith("$") && /^\$\d+$/.test(style) ? Number(style.slice(1)) - 1 : (i ?? 0);
      const v = ctx.params[idx];
      return v === undefined ? fail(`the parameter ${style} has no value`) : v;
    }
    case "name": {
      if (e.parts.length === 1) {
        const now = currentOf(lc(e.parts[0]?.name ?? ""), ctx.now);
        if (now !== undefined) return now;
      }
      const last = e.parts[e.parts.length - 1]?.name ?? "";
      const q = e.parts.length > 1 ? e.parts[e.parts.length - 2]?.name : undefined;
      return lookup(env, q, last);
    }
    case "unary": {
      const v = go(e.arg);
      if (e.op === "NOT") return v === null ? null : !truthy(v);
      if (e.op === "-" && typeof v === "string" && maybeTemporal(v)) {
        const negated = negateInterval(v);
        if (negated !== undefined) return negated;
      }
      const n = numberOf(v);
      return n === null ? null : e.op === "-" ? -n : n;
    }
    case "binary": {
      if (e.op === "AND") {
        const l = go(e.left);
        if (l !== null && !truthy(l)) return false;
        const r = go(e.right);
        if (r !== null && !truthy(r)) return false;
        return l === null || r === null ? null : true;
      }
      if (e.op === "OR") {
        const l = go(e.left);
        if (l !== null && truthy(l)) return true;
        const r = go(e.right);
        if (r !== null && truthy(r)) return true;
        return l === null || r === null ? null : false;
      }
      if (e.right.kind === "call" && e.right.over === undefined && e.right.name.parts.length === 1 && QUANTIFIERS.has(lc(e.right.name.parts[0]?.name ?? "")) && e.right.args.length === 1) return quantified(e.op, lc(e.right.name.parts[0]?.name ?? ""), go(e.left), e.right.args[0], env, ctx);
      const l = go(e.left);
      const r = go(e.right);
      if (l === null || r === null) return null;
      switch (e.op) {
        case "=":
          return compare(l, r) === 0;
        case "<>":
        case "!=":
          return compare(l, r) !== 0;
        case "<":
          return compare(l, r) < 0;
        case "<=":
          return compare(l, r) <= 0;
        case ">":
          return compare(l, r) > 0;
        case ">=":
          return compare(l, r) >= 0;
        case "||":
          return String(l) + String(r);
        case "+":
        case "-":
        case "*":
        case "/":
        case "%": {
          if ((typeof l === "string" && maybeTemporal(l)) || (typeof r === "string" && maybeTemporal(r))) {
            const t = temporalArithmetic(e.op, l, r);
            if (t !== undefined) return t.kind === "ok" ? t.value : fail(t.error);
          }
          const a = numberOf(l) ?? 0;
          const b = numberOf(r) ?? 0;
          if ((e.op === "/" || e.op === "%") && b === 0) return null;
          return e.op === "+" ? a + b : e.op === "-" ? a - b : e.op === "*" ? a * b : e.op === "/" ? a / b : a % b;
        }
        default:
          return fail(`the operator ${e.op} is not in astsql`);
      }
    }
    case "is": {
      const v = go(e.arg);
      let r: boolean;
      switch (e.test) {
        case "null":
          r = v === null;
          break;
        case "true":
          r = v === true || (typeof v === "number" && v !== 0);
          break;
        case "false":
          r = v === false || v === 0;
          break;
        case "unknown":
          r = v === null;
          break;
        case "distinct-from": {
          const o = e.other === undefined ? null : go(e.other);
          r = !(v === o || (v !== null && o !== null && compare(v, o) === 0));
          break;
        }
      }
      return e.negated ? !r : r;
    }
    case "between": {
      const v = go(e.arg);
      const lo = go(e.low);
      const hi = go(e.high);
      if (v === null || lo === null || hi === null) return null;
      const r = compare(v, lo) >= 0 && compare(v, hi) <= 0;
      return e.negated ? !r : r;
    }
    case "in": {
      const v = go(e.arg);
      if (v === null) return null;
      let sawNull = false;
      for (const x of e.values) {
        const o = go(x);
        if (o === null) sawNull = true;
        else if (compare(v, o) === 0) return e.negated ? false : true;
      }
      return sawNull ? null : e.negated;
    }
    case "in-query": {
      const v = go(e.arg);
      if (v === null) return null;
      const t = runQuery(e.query, ctx, env);
      let sawNull = false;
      for (const row of t.rows) {
        const o = row[0] ?? null;
        if (o === null) sawNull = true;
        else if (compare(v, o) === 0) return e.negated ? false : true;
      }
      return sawNull ? null : e.negated;
    }
    case "like": {
      if (e.op !== "LIKE") return fail(`${e.op} is not in astsql`);
      const v = go(e.arg);
      const p = go(e.pattern);
      if (v === null || p === null) return null;
      const esc = e.escape === undefined ? undefined : go(e.escape);
      const r = likeRegex(String(p), typeof esc === "string" ? esc : undefined).test(String(v));
      return e.negated ? !r : r;
    }
    case "case": {
      const operand = e.operand === undefined ? undefined : go(e.operand);
      for (const w of e.whens) {
        const c = go(w.cond);
        const hit = operand === undefined ? truthy(c) : c !== null && operand !== null && compare(operand, c) === 0;
        if (hit) return go(w.result);
      }
      return e.otherwise === undefined ? null : go(e.otherwise);
    }
    case "cast": {
      const v = go(e.arg);
      if (v === null) return null;
      const t = e.type.name.toUpperCase();
      if (t === "INT" || t === "INTEGER" || t === "BIGINT" || t === "SMALLINT") return Math.trunc(numberOf(v) ?? 0);
      if (t === "REAL" || t === "FLOAT" || t === "DOUBLE" || t === "DOUBLE PRECISION" || t === "NUMERIC" || t === "DECIMAL") return numberOf(v);
      if (t === "BOOLEAN" || t === "BOOL") return truthy(v);
      if (t === "DATE" || t === "TIME" || t === "TIMESTAMP" || t === "INTERVAL") {
        const c = castTemporal(t, v);
        return c.kind === "ok" ? c.value : fail(c.error);
      }
      if (t.startsWith("VARCHAR") || t === "TEXT" || t === "CHAR") return String(v);
      return fail(`the type ${e.type.name} is not in astsql`);
    }
    case "typed-string": {
      const text = e.value.kind === "string" ? e.value.value : fail(`a ${e.type} literal is a string`);
      const type = e.type.toUpperCase();
      if (type !== "DATE" && type !== "TIME" && type !== "TIMESTAMP") return fail(`a ${e.type} literal is not in astsql`);
      const c = castTemporal(type, text);
      return c.kind === "ok" ? c.value : fail(c.error);
    }
    case "interval": {
      const text = e.value.kind === "string" ? e.value.value : e.value.kind === "number" ? e.value.text : fail("an INTERVAL literal is a string or a number");
      const i = intervalLiteral(text, e.unit);
      return i === undefined ? fail(`"${text}"${e.unit === undefined ? "" : ` ${e.unit}`} is not an interval`) : formatInterval(i);
    }
    case "extract": {
      const v = go(e.arg);
      if (v === null) return null;
      const x = extract(e.field, v);
      return x.kind === "ok" ? x.value : fail(x.error);
    }
    case "exists":
      return runQuery(e.query, ctx, env).rows.length > 0;
    case "scalar-query": {
      const t = runQuery(e.query, ctx, env);
      if (t.rows.length > 1) return fail("a scalar subquery gave more than one row");
      return t.rows[0]?.[0] ?? null;
    }
    case "call":
      return callFunction(e, env, ctx, group);
    default:
      return fail(`${e.kind === "operator" ? `the operator ${e.op}` : `a ${e.kind}`} is not in astsql`);
  }
}

/** An aggregate of the values it is given (nulls already left out) and the number of rows it ranges over. */
function reduce(name: string, distinct: boolean, values: readonly Value[], rows: number, star: boolean, separator: string): Value {
  let v = values;
  if (distinct) v = v.filter((x, i) => v.findIndex((w) => compare(x, w) === 0) === i);
  switch (name) {
    case "count":
      return star ? rows : v.length;
    case "sum":
      return v.length === 0 ? null : v.reduce<number>((s, x) => s + (numberOf(x) ?? 0), 0);
    case "avg":
      return v.length === 0 ? null : v.reduce<number>((s, x) => s + (numberOf(x) ?? 0), 0) / v.length;
    case "min":
      return v.length === 0 ? null : v.reduce((m, x) => (compare(x, m) < 0 ? x : m));
    case "max":
      return v.length === 0 ? null : v.reduce((m, x) => (compare(x, m) > 0 ? x : m));
    default:
      return v.length === 0 ? null : v.map(String).join(separator);
  }
}

const isPlainArg = (a: Extract<Expr, { kind: "call" }>["args"][number] | undefined): a is Expr => a !== undefined && a.kind !== "star" && a.kind !== "named-arg" && a.kind !== "keyword-arg";

/** The separator of `group_concat(x, sep)`, a comma where none is given. */
function separatorOf(e: Extract<Expr, { kind: "call" }>, env: Env, ctx: Context): string {
  const a = e.args[1];
  return isPlainArg(a) ? String(evalExpr(a, env, ctx, undefined)) : ",";
}

function callFunction(e: Extract<Expr, { kind: "call" }>, env: Env, ctx: Context, group: readonly Env[] | undefined): Value {
  const name = lc(e.name.parts[e.name.parts.length - 1]?.name ?? "");
  if (e.over !== undefined) {
    const values = ctx.windowValues?.get(e);
    if (values === undefined) return fail("a window function stands only in the select list and the ORDER BY");
    return values.get(env) ?? null;
  }
  if (name === "grouping" && ctx.groupingSet !== undefined) {
    let bits = 0;
    for (const a of e.args) {
      if (!isPlainArg(a)) return fail("GROUPING takes expressions");
      const key = exprKey(a);
      if (ctx.groupingAll?.has(key) !== true) return fail("GROUPING takes an expression that the query groups on");
      bits = bits * 2 + (ctx.groupingSet.has(key) ? 0 : 1);
    }
    return bits;
  }
  if (AGGREGATES.has(name)) {
    if (group === undefined) return fail(`${name} is an aggregate and stands only in a query that groups`);
    const filter = e.filter;
    const rows = filter === undefined ? group : group.filter((g) => truthy(evalExpr(filter, g, ctx, undefined)));
    const star = e.args[0]?.kind === "star";
    const arg = e.args[0];
    if (isPlainArg(arg)) return reduce(name, e.distinct, rows.map((g) => evalExpr(arg, g, ctx, undefined)).filter((v) => v !== null), rows.length, false, name === "group_concat" ? separatorOf(e, env, ctx) : ",");
    if (name === "count" && (star || e.args.length === 0)) return rows.length;
    return fail(`${name} takes an expression`);
  }
  const current = e.args.length <= 1 ? currentOf(name, ctx.now) : undefined;
  if (current !== undefined) return current;
  const fn = ctx.functions.get(name) ?? BUILTIN.get(name);
  if (fn === undefined) return fail(`the function ${name} is not in astsql`);
  const args: Value[] = [];
  for (const a of e.args) {
    if (a.kind === "star" || a.kind === "named-arg" || a.kind === "keyword-arg") return fail(`${name} takes plain arguments`);
    args.push(evalExpr(a, env, ctx, group));
  }
  return fn(args);
}

function envsOf(src: Source, ctx: Context, outer: Env | undefined): { readonly envs: Env[]; readonly names: readonly Binding[] } {
  switch (src.kind) {
    case "table": {
      const name = src.name.parts.map((p) => p.name).join(".");
      const t = ctx.ctes.get(lc(name)) ?? ctx.tables(name);
      if (t === undefined) return fail(`there is no relation ${name}`);
      const alias = src.alias?.name.name ?? src.name.parts[src.name.parts.length - 1]?.name ?? name;
      const empty: Binding = { alias, columns: t.columns, row: [] };
      return { envs: t.rows.map((row) => pushScope(outer, { alias, columns: t.columns, row })), names: [empty] };
    }
    case "subquery": {
      if (src.lateral) return fail("LATERAL is not in astsql");
      const t = runQuery(src.query, ctx, outer);
      const alias = src.alias?.name.name ?? "";
      const cols = src.alias !== undefined && src.alias.columns.length > 0 ? src.alias.columns.map((c) => c.name) : t.columns;
      const empty: Binding = { alias, columns: cols, row: [] };
      return { envs: t.rows.map((row) => pushScope(outer, { alias, columns: cols, row })), names: [empty] };
    }
    case "join": {
      if (src.type !== "inner" && src.type !== "left" && src.type !== "right" && src.type !== "full" && src.type !== "cross") return fail(`a ${src.type} join is not in astsql`);
      const left = envsOf(src.left, ctx, outer);
      const right = envsOf(src.right, ctx, outer);
      const type = src.type;
      // the columns a USING list or a NATURAL join makes one (FR-014)
      const columnsOf = (bs: readonly Binding[]): string[] => bs.flatMap((b) => b.columns.filter((_, k) => visible(b, k)));
      const leftColumns = columnsOf(left.names);
      const rightColumns = columnsOf(right.names);
      let joined: readonly string[] = [];
      if (src.natural) joined = leftColumns.filter((c, k) => leftColumns.findIndex((d) => lc(d) === lc(c)) === k && rightColumns.some((d) => lc(d) === lc(c)));
      else if (src.using.length > 0) {
        joined = src.using.map((u) => u.name);
        for (const c of joined) {
          if (!leftColumns.some((d) => lc(d) === lc(c))) return fail(`the column ${c} of USING is not in the left side`);
          if (!rightColumns.some((d) => lc(d) === lc(c))) return fail(`the column ${c} of USING is not in the right side`);
        }
      }
      const hide = (bs: readonly Binding[]): Binding[] => (joined.length === 0 ? [...bs] : bs.map((b) => hiding(b, joined.map(lc))));
      const valueIn = (e: Env, c: string): Value => lookup({ bindings: e.bindings, outer: undefined }, undefined, c);
      const mergedNames: Binding[] = joined.length === 0 ? [] : [{ alias: "", columns: joined, row: [] }];
      const names = [...mergedNames, ...hide(left.names), ...hide(right.names)];
      const nullOf = (bs: readonly Binding[]): Binding[] => bs.map((b) => ({ ...b, row: b.columns.map(() => null) }));
      const nullLeft = hide(nullOf(left.names));
      const nullRight = hide(nullOf(right.names));
      const merge = (l: Env | undefined, r: Env | undefined): Env => {
        const lb = l === undefined ? nullLeft : hide(l.bindings);
        const rb = r === undefined ? nullRight : hide(r.bindings);
        if (joined.length === 0) return { bindings: [...lb, ...rb], outer };
        const lv = l ?? { bindings: left.names, outer: undefined };
        const rv = r ?? { bindings: right.names, outer: undefined };
        const row = joined.map((c) => (l !== undefined ? valueIn(lv, c) : valueIn(rv, c)));
        return { bindings: [{ alias: "", columns: joined, row }, ...lb, ...rb], outer };
      };
      const out: Env[] = [];
      const keep = type === "left" || type === "full";
      const keepRight = type === "right" || type === "full";
      const matchedRight = new Set<Env>();
      const on = src.on;
      // an equality of two qualified columns, or the columns of USING, is a hash join
      let hash: { readonly leftKey: (e: Env) => Value; readonly rightKey: (e: Env) => Value } | undefined;
      if (joined.length > 0) hash = { leftKey: (e) => rowKeyValue(joined.map((c) => valueIn(e, c))), rightKey: (e) => rowKeyValue(joined.map((c) => valueIn(e, c))) };
      else if (on !== undefined && on.kind === "binary" && on.op === "=" && on.left.kind === "name" && on.right.kind === "name" && right.names.length === 1) {
        const ra = lc(right.names[0]?.alias ?? "");
        const lq = lc(on.left.parts.length > 1 ? (on.left.parts[on.left.parts.length - 2]?.name ?? "") : "");
        const rq = lc(on.right.parts.length > 1 ? (on.right.parts[on.right.parts.length - 2]?.name ?? "") : "");
        const a = on.left;
        const b = on.right;
        if (rq === ra && lq !== ra && lq !== "") hash = { leftKey: (e) => evalExpr(a, e, ctx, undefined), rightKey: (e) => evalExpr(b, e, ctx, undefined) };
        else if (lq === ra && rq !== ra && rq !== "") hash = { leftKey: (e) => evalExpr(b, e, ctx, undefined), rightKey: (e) => evalExpr(a, e, ctx, undefined) };
      }
      let index: Map<string, Env[]> | undefined;
      if (hash !== undefined) {
        const h = hash;
        index = new Map();
        for (const r of right.envs) {
          const k = h.rightKey(r);
          if (k === null) continue;
          const key = `${typeof k}:${String(k)}`;
          const list = index.get(key);
          if (list === undefined) index.set(key, [r]);
          else list.push(r);
        }
      }
      for (const l of left.envs) {
        let matched = false;
        const candidates = index !== undefined && hash !== undefined ? (() => {
          const k = hash.leftKey(l);
          return k === null ? [] : (index.get(`${typeof k}:${String(k)}`) ?? []);
        })() : right.envs;
        for (const r of candidates) {
          const both = merge(l, r);
          if (on === undefined || truthy(evalExpr(on, both, ctx, undefined))) {
            out.push(both);
            matched = true;
            if (keepRight) matchedRight.add(r);
          }
        }
        if (!matched && keep) out.push(merge(l, undefined));
      }
      if (keepRight) for (const r of right.envs) if (!matchedRight.has(r)) out.push(merge(undefined, r));
      return { envs: out, names };
    }
    default:
      return fail(`a source of kind ${src.kind} is not in astsql`);
  }
}

/** A row a select gives, before it is projected: its environment and, where the select groups, the rows of its group. */
interface Unit {
  readonly env: Env;
  readonly group: readonly Env[] | undefined;
  /** The context of its grouping set, where the select has grouping sets. */
  readonly ctx?: Context;
}

type CallExpr = Extract<Expr, { kind: "call" }>;

const WINDOW_ONLY: ReadonlySet<string> = new Set(["row_number", "rank", "dense_rank", "percent_rank", "cume_dist", "ntile", "lag", "lead", "first_value", "last_value", "nth_value"]);

/** The window of a call with the named window it refines put together (`OVER w`, `OVER (w ORDER BY ...)`). */
function resolveWindow(over: WindowSpec, defs: readonly WindowDef[], seen: readonly string[] = []): WindowSpec {
  if (over.base === undefined) return over;
  const name = lc(over.base.name);
  if (seen.includes(name)) return fail(`the window ${over.base.name} is defined by itself`);
  const def = defs.find((d) => lc(d.name.name) === name);
  if (def === undefined) return fail(`there is no window ${over.base.name}`);
  const base = resolveWindow(def.spec, defs, [...seen, name]);
  if (over.partitionBy.length > 0 && base.partitionBy.length > 0) return fail(`the window ${over.base.name} has a PARTITION BY already`);
  if (over.orderBy.length > 0 && base.orderBy.length > 0) return fail(`the window ${over.base.name} has an ORDER BY already`);
  return { ...over, base: undefined, partitionBy: over.partitionBy.length > 0 ? over.partitionBy : base.partitionBy, orderBy: over.orderBy.length > 0 ? over.orderBy : base.orderBy, frame: over.frame ?? base.frame };
}

/** The first and last rows (by place in the partition) of the frame of the row at `i`, or `undefined` where the frame is empty (0010-aide FR-013). */
function frameOf(w: WindowSpec, i: number, n: number, peerStart: number, peerEnd: number, valueOf: (e: Expr) => Value): readonly [number, number] | undefined {
  if (w.frame === undefined) return w.orderBy.length === 0 ? [0, n - 1] : [0, peerEnd];
  const f = w.frame;
  if (f.unit === "groups") return fail("a GROUPS frame is not in astsql");
  if (f.exclude !== undefined && f.exclude !== "NO OTHERS") return fail("EXCLUDE is not in astsql");
  const bound = (b: FrameBound, start: boolean): number => {
    const offset = (): number => {
      const v = b.offset === undefined ? null : numberOf(valueOf(b.offset));
      if (v === null || !Number.isInteger(v) || v < 0) return fail("the distance of a frame is a whole number that is not negative");
      return v;
    };
    switch (b.type) {
      case "unbounded-preceding":
        return 0;
      case "unbounded-following":
        return n - 1;
      case "current-row":
        return f.unit === "rows" ? i : start ? peerStart : peerEnd;
      case "preceding":
        return f.unit === "rows" ? i - offset() : fail("a RANGE frame with a distance is not in astsql");
      default:
        return f.unit === "rows" ? i + offset() : fail("a RANGE frame with a distance is not in astsql");
    }
  };
  const from = Math.max(0, bound(f.from, true));
  const to = Math.min(n - 1, bound(f.to ?? { kind: "frame-bound", type: "current-row", offset: undefined, start: 0, end: 0 }, false));
  return from > to ? undefined : [from, to];
}

/** The values of every window function of a select, for each of its rows (0010-aide FR-013): each partition ordered by its window, the function computed over it, the value kept for the row. */
function computeWindows(calls: readonly CallExpr[], units: readonly Unit[], defs: readonly WindowDef[], ctx: Context): Map<Node, Map<Env, Value>> {
  const out = new Map<Node, Map<Env, Value>>();
  for (const call of calls) {
    if (out.has(call)) continue;
    const over = call.over;
    if (over === undefined) continue;
    const name = lc(call.name.parts[call.name.parts.length - 1]?.name ?? "");
    if (!WINDOW_ONLY.has(name) && !AGGREGATES.has(name)) fail(`the function ${name} is not a window function in astsql`);
    if (call.distinct || call.orderBy.length > 0 || call.withinGroup.length > 0 || call.parameters.length > 0) fail(`${name} with DISTINCT, ORDER BY or WITHIN GROUP is not a window function in astsql`);
    if (call.nullTreatment === "ignore") fail("IGNORE NULLS is not in astsql");
    const w = resolveWindow(over, defs);
    const values = new Map<Env, Value>();
    out.set(call, values);
    const partitions = new Map<string, Unit[]>();
    for (const u of units) {
      const key = rowKey(w.partitionBy.map((x) => evalExpr(x, u.env, u.ctx ?? ctx, u.group)));
      const list = partitions.get(key);
      if (list === undefined) partitions.set(key, [u]);
      else list.push(u);
    }
    const arg = (u: Unit, k: number): Value => {
      const a = call.args[k];
      return isPlainArg(a) ? evalExpr(a, u.env, u.ctx ?? ctx, u.group) : fail(`${name} takes plain arguments`);
    };
    for (const part of partitions.values()) {
      const keyed = part.map((u) => ({ u, keys: w.orderBy.map((o) => evalExpr(o.expr, u.env, u.ctx ?? ctx, u.group)) }));
      if (w.orderBy.length > 0) {
        keyed.sort((a, b) => {
          for (const [i, o] of w.orderBy.entries()) {
            const c = nullsOrder(a.keys[i] ?? null, b.keys[i] ?? null, o.direction === "desc" ? -1 : 1, o.nulls);
            if (c !== 0) return c;
          }
          return 0;
        });
      }
      const n = keyed.length;
      const same = (a: number, b: number): boolean => w.orderBy.length === 0 || w.orderBy.every((_, k) => nullsOrder(keyed[a]?.keys[k] ?? null, keyed[b]?.keys[k] ?? null, 1, undefined) === 0);
      const peerStart: number[] = [];
      const peerEnd: number[] = [];
      for (let i = 0; i < n; i++) peerStart[i] = i > 0 && same(i, i - 1) ? (peerStart[i - 1] ?? i) : i;
      for (let i = n - 1; i >= 0; i--) peerEnd[i] = i < n - 1 && same(i, i + 1) ? (peerEnd[i + 1] ?? i) : i;
      let dense = 0;
      for (const [i, { u }] of keyed.entries()) {
        const first = peerStart[i] ?? i;
        const last = peerEnd[i] ?? i;
        if (first === i) dense++;
        const frameValue = (e: Expr): Value => evalExpr(e, u.env, u.ctx ?? ctx, u.group);
        const frame = (): readonly [number, number] | undefined => frameOf(w, i, n, first, last, frameValue);
        let v: Value;
        switch (name) {
          case "row_number":
            v = i + 1;
            break;
          case "rank":
            v = first + 1;
            break;
          case "dense_rank":
            v = dense;
            break;
          case "percent_rank":
            v = n <= 1 ? 0 : first / (n - 1);
            break;
          case "cume_dist":
            v = (last + 1) / n;
            break;
          case "ntile": {
            const k = numberOf(arg(u, 0));
            if (k === null || !Number.isInteger(k) || k < 1) return fail("ntile takes a whole number of buckets that is more than 0");
            const size = Math.floor(n / k);
            const extra = n % k;
            const wide = extra * (size + 1);
            v = i < wide ? Math.floor(i / (size + 1)) + 1 : extra + Math.floor((i - wide) / Math.max(size, 1)) + 1;
            break;
          }
          case "lag":
          case "lead": {
            const by = call.args[1] === undefined ? 1 : numberOf(arg(u, 1));
            if (by === null || !Number.isInteger(by) || by < 0) return fail(`${name} takes an offset that is a whole number and not negative`);
            const at = name === "lag" ? i - by : i + by;
            v = at >= 0 && at < n ? arg(keyed[at]?.u ?? u, 0) : call.args[2] === undefined ? null : arg(u, 2);
            break;
          }
          case "first_value":
          case "last_value":
          case "nth_value": {
            const f = frame();
            let at: number | undefined;
            if (f !== undefined) {
              if (name === "first_value") at = f[0];
              else if (name === "last_value") at = f[1];
              else {
                const k = numberOf(arg(u, 1));
                if (k === null || !Number.isInteger(k) || k < 1) return fail("nth_value takes a whole number that is more than 0");
                at = f[0] + k - 1 <= f[1] ? f[0] + k - 1 : undefined;
              }
            }
            v = at === undefined ? null : arg(keyed[at]?.u ?? u, 0);
            break;
          }
          default: {
            const f = frame();
            const rows = f === undefined ? [] : keyed.slice(f[0], f[1] + 1).map((k) => k.u);
            const filter = call.filter;
            const kept = filter === undefined ? rows : rows.filter((r) => truthy(evalExpr(filter, r.env, r.ctx ?? ctx, r.group)));
            const star = call.args[0]?.kind === "star";
            if (name === "count" && (star || call.args.length === 0)) v = kept.length;
            else if (!isPlainArg(call.args[0])) return fail(`${name} takes an expression`);
            else v = reduce(name, false, kept.map((r) => arg(r, 0)).filter((x) => x !== null), kept.length, false, name === "group_concat" ? separatorOf(call, u.env, ctx) : ",");
          }
        }
        values.set(u.env, v);
      }
    }
  }
  return out;
}

function runSelect(q: Select, ctx: Context, outer: Env | undefined): Table {
  if (q.distinctOn.length > 0 || q.qualify !== undefined || q.groupAll || q.top !== undefined || q.into !== undefined) return fail("that clause of SELECT is not in astsql");
  let envs: Env[];
  let names: readonly Binding[] = [];
  if (q.from.length === 0) envs = [{ bindings: [], outer }];
  else {
    envs = [{ bindings: [], outer }];
    for (const s of q.from) {
      const part = envsOf(s, ctx, outer);
      names = [...names, ...part.names];
      const next: Env[] = [];
      for (const e of envs) for (const p of part.envs) next.push({ bindings: [...e.bindings, ...p.bindings], outer });
      envs = next;
    }
  }
  if (q.where !== undefined) {
    const w = q.where;
    envs = envs.filter((e) => truthy(evalExpr(w, e, ctx, undefined)));
  }
  for (const x of [q.where, q.having, ...q.groupBy]) {
    const bad: CallExpr[] = [];
    if (x !== undefined) windowCallsOf(x, bad);
    if (bad.length > 0) fail("a window function stands only in the select list and the ORDER BY");
  }
  const windowCalls: CallExpr[] = [];
  for (const x of [...q.items.map((i) => i.expr), ...q.orderBy.map((o) => o.expr)]) windowCallsOf(x, windowCalls);
  const wctx: Context = windowCalls.length === 0 ? ctx : { ...ctx, windowValues: new Map() };
  const grouped = q.groupBy.length > 0 || q.items.some((i) => hasAggregate(i.expr)) || (q.having !== undefined && hasAggregate(q.having));
  // the columns of the output
  const colNames: string[] = [];
  const itemsOut: { readonly item: SelectItem; readonly star: readonly number[] | undefined }[] = [];
  for (const item of q.items) {
    if (item.expr.kind === "star") {
      const qual = item.expr.qualifier?.parts.map((p) => p.name).join(".");
      const picked = names.filter((b) => qual === undefined || lc(b.alias) === lc(qual));
      if (picked.length === 0 && qual !== undefined) fail(`no relation ${qual}`);
      for (const b of picked) for (const [k, c] of b.columns.entries()) if (qual !== undefined || visible(b, k)) colNames.push(c);
      itemsOut.push({ item, star: [] });
    } else {
      colNames.push(item.alias?.name ?? (item.expr.kind === "name" ? (item.expr.parts[item.expr.parts.length - 1]?.name ?? "?") : `column${colNames.length + 1}`));
      itemsOut.push({ item, star: undefined });
    }
  }
  interface Out {
    readonly values: Value[];
    readonly keys: Value[];
  }
  const outs: Out[] = [];
  const project = (env: Env, group: readonly Env[] | undefined, c: Context): Out => {
    const values: Value[] = [];
    for (const { item, star } of itemsOut) {
      if (star !== undefined) {
        const qual = item.expr.kind === "star" ? item.expr.qualifier?.parts.map((p) => p.name).join(".") : undefined;
        for (const b of env.bindings.length > 0 ? env.bindings : []) {
          if (qual !== undefined && lc(b.alias) !== lc(qual)) continue;
          for (const [k, v] of b.row.entries()) if (qual !== undefined || visible(b, k)) values.push(v);
        }
      } else values.push(evalExpr(item.expr, env, c, group));
    }
    const keys = q.orderBy.map((o): Value => {
      const ex = o.expr;
      if (ex.kind === "number") return values[Number(ex.text) - 1] ?? null;
      if (ex.kind === "name" && ex.parts.length === 1) {
        const i = colNames.findIndex((c) => lc(c) === lc(ex.parts[0]?.name ?? ""));
        if (i >= 0 && itemsOut[i]?.item.alias !== undefined) return values[i] ?? null;
      }
      return evalExpr(ex, env, c, group);
    });
    return { values, keys };
  };
  const units: Unit[] = [];
  if (grouped) {
    const sets = q.groupBy.length === 0 ? [[]] : groupingSets(q.groupBy);
    const all = new Set(sets.flat().map(exprKey));
    for (const set of sets) {
      const inSet = new Set(set.map(exprKey));
      const absent = [...all].filter((k) => !inSet.has(k));
      const setCtx: Context = { ...wctx, groupingSet: inSet, groupingAll: all, ...(absent.length > 0 ? { nulled: new Set(absent) } : {}) };
      const groups = new Map<string, Env[]>();
      if (set.length === 0) groups.set("", envs);
      else {
        for (const e of envs) {
          const key = JSON.stringify(set.map((g) => evalExpr(g, e, ctx, undefined)));
          const list = groups.get(key);
          if (list === undefined) groups.set(key, [e]);
          else list.push(e);
        }
      }
      for (const g of groups.values()) {
        const rep = g[0] ?? { bindings: names.map((b) => ({ alias: b.alias, columns: b.columns, row: b.columns.map(() => null) })), outer };
        if (q.having !== undefined && !truthy(evalExpr(q.having, rep, setCtx, g))) continue;
        // a row of its own, though the first row of the group is also the first of the groups of the other sets: the values of the window functions are kept by it
        units.push({ env: { bindings: rep.bindings, outer: rep.outer }, group: g, ctx: setCtx });
      }
    }
  } else for (const e of envs) units.push({ env: e, group: undefined });
  if (windowCalls.length > 0) {
    const computed = computeWindows(windowCalls, units, q.windows, wctx);
    for (const [k, v] of computed) wctx.windowValues?.set(k, v);
  }
  for (const u of units) outs.push(project(u.env, u.group, u.ctx ?? wctx));
  let result = outs;
  if (q.distinct) result = result.filter((o, i) => result.findIndex((p) => p.values.length === o.values.length && p.values.every((v, j) => order(v, o.values[j] ?? null) === 0)) === i);
  if (q.orderBy.length > 0) {
    const dirs = q.orderBy.map((o) => (o.direction === "desc" ? -1 : 1));
    result = [...result].sort((a, b) => {
      for (const [i, d] of dirs.entries()) {
        const c = nullsOrder(a.keys[i] ?? null, b.keys[i] ?? null, d, q.orderBy[i]?.nulls);
        if (c !== 0) return c;
      }
      return 0;
    });
  }
  let rows = result.map((o) => o.values);
  const num = (x: Expr | undefined): number | undefined => {
    if (x === undefined) return undefined;
    const v = evalExpr(x, { bindings: [], outer }, ctx, undefined);
    const n = numberOf(v);
    return n === null ? undefined : n;
  };
  const off = num(q.offset);
  const lim = num(q.limit);
  if (off !== undefined) rows = rows.slice(off);
  if (lim !== undefined) rows = rows.slice(0, lim);
  return { columns: colNames, rows };
}

/** A key that two rows share where they are equal for a set operation: a null equals a null, a value only a value of its type. */
const rowKey = (row: readonly Value[]): string => row.map((v) => (v === null ? "null" : `${typeof v}:${String(v)}`)).join("\u0001");

/** The rows of a table counted by their key, in the order each is first met. */
function counted(rows: readonly (readonly Value[])[]): Map<string, { readonly row: readonly Value[]; n: number }> {
  const out = new Map<string, { readonly row: readonly Value[]; n: number }>();
  for (const row of rows) {
    const k = rowKey(row);
    const c = out.get(k);
    if (c === undefined) out.set(k, { row, n: 1 });
    else c.n++;
  }
  return out;
}

/** `UNION`, `INTERSECT` and `EXCEPT`, with or without `ALL` (0010-aide FR-012), then the `ORDER BY`, `OFFSET` and `LIMIT` of the whole. */
function runSetOp(q: SetOp, ctx: Context, outer: Env | undefined): Table {
  if (q.byName) return fail("BY NAME is not in astsql");
  if (q.locking !== undefined || q.settings !== undefined) return fail("that clause of a set operation is not in astsql");
  const left = runQuery(q.left, ctx, outer);
  const right = runQuery(q.right, ctx, outer);
  if (left.columns.length !== right.columns.length) return fail(`the two sides of ${q.op.toUpperCase()} have ${left.columns.length} and ${right.columns.length} columns`);
  const all = q.quantifier === "all";
  let rows: (readonly Value[])[];
  switch (q.op) {
    case "union":
      rows = all ? [...left.rows, ...right.rows] : [...counted([...left.rows, ...right.rows]).values()].map((c) => c.row);
      break;
    case "intersect": {
      const r = counted(right.rows);
      rows = [];
      for (const [k, c] of counted(left.rows)) {
        const n = Math.min(c.n, r.get(k)?.n ?? 0);
        for (let i = 0; i < (all ? n : Math.min(n, 1)); i++) rows.push(c.row);
      }
      break;
    }
    case "except": {
      const r = counted(right.rows);
      rows = [];
      for (const [k, c] of counted(left.rows)) {
        const n = all ? c.n - (r.get(k)?.n ?? 0) : r.has(k) ? 0 : 1;
        for (let i = 0; i < n; i++) rows.push(c.row);
      }
      break;
    }
    default:
      return fail(`the set operator ${q.op} is not in astsql`);
  }
  return tail({ columns: left.columns, rows }, q.orderBy, q.limit, q.offset, ctx, outer);
}

/** The `ORDER BY` (by the name of an output column or its place), `OFFSET` and `LIMIT` of a query that is made of a set operation. */
function tail(t: Table, orderBy: readonly OrderItem[], limit: Expr | undefined, offset: Expr | undefined, ctx: Context, outer: Env | undefined): Table {
  let rows = t.rows;
  if (orderBy.length > 0) {
    const keys = orderBy.map((o): { readonly at: number; readonly sign: number; readonly nulls: "first" | "last" | undefined } => {
      const ex = o.expr;
      let at = -1;
      if (ex.kind === "number") at = Number(ex.text) - 1;
      else if (ex.kind === "name" && ex.parts.length === 1) at = t.columns.findIndex((c) => lc(c) === lc(ex.parts[0]?.name ?? ""));
      if (at < 0 || at >= t.columns.length) return fail("the ORDER BY of a set operation names an output column or its place");
      return { at, sign: o.direction === "desc" ? -1 : 1, nulls: o.nulls };
    });
    rows = [...rows].sort((a, b) => {
      for (const k of keys) {
        const x = a[k.at] ?? null;
        const y = b[k.at] ?? null;
        const c = nullsOrder(x, y, k.sign, k.nulls);
        if (c !== 0) return c;
      }
      return 0;
    });
  }
  const num = (x: Expr | undefined): number | undefined => {
    if (x === undefined) return undefined;
    const n = numberOf(evalExpr(x, { bindings: [], outer }, ctx, undefined));
    return n === null ? undefined : n;
  };
  const off = num(offset);
  const lim = num(limit);
  if (off !== undefined) rows = rows.slice(off);
  if (lim !== undefined) rows = rows.slice(0, lim);
  return { columns: t.columns, rows };
}

/** The order of two values of an `ORDER BY` key: nulls first for `ASC` and last for `DESC` where `NULLS` is not written, and as it says where it is; `sign` is -1 for `DESC`. */
function nullsOrder(a: Value, b: Value, sign: number, nulls: "first" | "last" | undefined): number {
  if (a === null || b === null) {
    if (a === null && b === null) return 0;
    const nullFirst = nulls === undefined ? sign > 0 : nulls === "first";
    return (a === null ? -1 : 1) * (nullFirst ? 1 : -1);
  }
  return compare(a, b) * sign;
}

/** Whether a query names a relation (a table in a `FROM`), without regard to case, anywhere in it. */
function mentions(n: Node, name: string): boolean {
  if (n.kind === "table" && n.name.parts.length === 1 && lc(n.name.parts[0]?.name ?? "") === name) return true;
  return children(n).some((c) => mentions(c, name));
}

/** The most rounds and rows of a recursive common table expression (0010-aide FR-016). */
const MOST_ROUNDS = 10_000;
const MOST_ROWS = 1_000_000;

/** `WITH RECURSIVE name AS (anchor UNION [ALL] step)`: the anchor once, then the step on the rows the last round made, until a round makes none (0010-aide FR-016). */
function runRecursive(q: SetOp, name: string, columns: readonly string[], ctx: Context, outer: Env | undefined): Table {
  const self = lc(name);
  if (mentions(q.left, self)) return fail(`the first part of the recursive ${name} names ${name}: the anchor comes first`);
  const all = q.quantifier === "all";
  const anchor = runQuery(q.left, ctx, outer);
  const cols = columns.length > 0 ? columns : anchor.columns;
  if (cols.length !== anchor.columns.length) return fail(`the recursive ${name} has ${cols.length} column names and its anchor ${anchor.columns.length} columns`);
  const seen = new Set<string>();
  const first = all ? anchor.rows : anchor.rows.filter((r) => (seen.has(rowKey(r)) ? false : (seen.add(rowKey(r)), true)));
  const result: (readonly Value[])[] = [...first];
  let working: readonly (readonly Value[])[] = first;
  for (let round = 1; working.length > 0; round++) {
    if (round > MOST_ROUNDS) return fail(`the recursive ${name} did not end in ${MOST_ROUNDS} rounds`);
    const step = runQuery(q.right, { ...ctx, ctes: new Map(ctx.ctes).set(self, { columns: cols, rows: working }) }, outer);
    if (step.columns.length !== cols.length) return fail(`the step of the recursive ${name} has ${step.columns.length} columns, and the anchor ${cols.length}`);
    working = all ? step.rows : step.rows.filter((r) => (seen.has(rowKey(r)) ? false : (seen.add(rowKey(r)), true)));
    result.push(...working);
    if (result.length > MOST_ROWS) return fail(`the recursive ${name} made more than ${MOST_ROWS} rows`);
  }
  return tail({ columns: cols, rows: result }, q.orderBy, q.limit, q.offset, ctx, outer);
}

function runQuery(q: Query, ctx: Context, outer: Env | undefined): Table {
  switch (q.kind) {
    case "select":
      return runSelect(q, ctx, outer);
    case "with": {
      const ctes = new Map(ctx.ctes);
      for (const c of q.ctes) {
        if (c.query.kind === "insert" || c.query.kind === "update" || c.query.kind === "delete") return fail("a data change is not in astsql");
        const self = lc(c.name.name);
        const t = q.recursive && c.query.kind === "set-op" && c.query.op === "union" && (mentions(c.query.right, self) || mentions(c.query.left, self)) ? runRecursive(c.query, c.name.name, c.columns.map((x) => x.name), { ...ctx, ctes }, outer) : runQuery(c.query, { ...ctx, ctes }, outer);
        ctes.set(self, c.columns.length > 0 ? { columns: c.columns.map((x) => x.name), rows: t.rows } : t);
      }
      if (q.body.kind === "insert" || q.body.kind === "update" || q.body.kind === "delete") return fail("a data change is not in astsql");
      return runQuery(q.body, { ...ctx, ctes }, outer);
    }
    case "set-op":
      return runSetOp(q, ctx, outer);
    case "values": {
      const rows = q.rows.map((t) => t.items.map((x) => evalExpr(x, { bindings: [], outer }, ctx, undefined)));
      const width = rows[0]?.length ?? 0;
      if (rows.some((r) => r.length !== width)) return fail("the rows of VALUES have different numbers of columns");
      return { columns: Array.from({ length: width }, (_, i) => `column${i + 1}`), rows };
    }
    default:
      return fail("that query is not in astsql");
  }
}

/** Where relations come from: a function that gives the relation of a name, or `undefined` for a name it has not; it is asked when a query names the relation, so a provider may build it then. */
export type Provider = (name: string) => Table | undefined;

/** A provider of the relations of a record, found without regard to case. */
export function providerOf(tables: Readonly<Record<string, Table>>): Provider {
  const byName = new Map(Object.entries(tables).map(([k, v]) => [k.toLowerCase(), v]));
  return (name) => byName.get(name.toLowerCase());
}

/** What an engine may be given besides its relations and functions. */
export interface EngineOptions {
  /** The clock `CURRENT_DATE` and the other current values are read from, once for each statement (the system clock where none is given). */
  readonly now?: () => Date;
}

/** An engine over relations that a function gives by name (the relations are built when a query names them). */
export function createEngine(tables: Provider, functions: ReadonlyMap<string, ScalarFunction> = new Map(), options: EngineOptions = {}): Engine {
  return {
    run(sql, params = []) {
      const parsed = parse(sql, astsql);
      if (parsed.errors.length > 0) return err({ message: `the query does not read: ${parsed.errors[0]?.kind === "expected" ? `expected ${parsed.errors[0].expected}, found ${parsed.errors[0].found}` : "it is not valid SQL"}` });
      const s = parsed.script.statements;
      if (s.length !== 1) return err({ message: "a query is one statement" });
      const stmt = s[0];
      if (stmt === undefined || !(stmt.kind === "select" || stmt.kind === "with" || stmt.kind === "set-op" || stmt.kind === "values")) return err({ message: "only a query can be asked" });
      const ps: Node[] = [];
      paramsOf(stmt, ps);
      ps.sort((a, b) => a.start - b.start);
      const paramIndex = new Map<Node, number>(ps.map((n, i) => [n, i]));
      try {
        return ok(runQuery(stmt, { tables, functions, params, paramIndex, ctes: new Map(), now: (options.now ?? (() => new Date()))() }, undefined));
      } catch (e) {
        if (e instanceof Failure) return err({ message: e.detail });
        return err({ message: "the query could not be run" });
      }
    },
  };
}
