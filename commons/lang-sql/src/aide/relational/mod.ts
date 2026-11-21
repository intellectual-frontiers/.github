/**
 * The engine of introspection (commons lang-sql 0008-sql-introspect FR-005, FR-006; 0010-aide FR-010): a small evaluator of the common ground of SQL over relations held in memory, so that a question about a tree is a query. It reads the query with this
 * library's own parser, with the logic of SQL (null where a value is not known), and says in one sentence what it does not have. It sits behind {@link Engine}, which does not name the tree, and takes its relations from a {@link Provider}, so that any rows (a file tree, a list of checks, the tables of a machine) can be asked in SQL; it is read-only, and a statement that is not a query is an error value.
 *
 * Spec: 0008-sql-introspect FR-005, FR-006
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { ansi, children, type Dialect, type Expr, type Node, parse, type Query, type Select, type SelectItem, type Source, declareDialect } from "../../mod.ts";

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
}
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
}

const AGGREGATES: ReadonlySet<string> = new Set(["count", "sum", "avg", "min", "max", "group_concat"]);
const lc = (s: string): string => s.toLowerCase();

const truthy = (v: Value): boolean => v === true || (typeof v === "number" && v !== 0);

function compare(a: Value, b: Value): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
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
      if (i >= 0) {
        found = b.row[i] ?? null;
        count++;
      }
    }
    if (count > 1) return fail(`the column ${name} is ambiguous`);
    if (found !== undefined) return found;
  }
  return fail(`no column ${qualifier === undefined ? "" : `${qualifier}.`}${name}`);
}

const isQuery = (n: Node): boolean => n.kind === "select" || n.kind === "set-op" || n.kind === "values" || n.kind === "with";

function hasAggregate(n: Node): boolean {
  if (n.kind === "call" && AGGREGATES.has(lc(n.name.parts[n.name.parts.length - 1]?.name ?? ""))) return true;
  for (const c of children(n)) {
    if (isQuery(c)) continue;
    if (hasAggregate(c)) return true;
  }
  return false;
}

function paramsOf(n: Node, out: Node[]): void {
  if (n.kind === "param") out.push(n);
  for (const c of children(n)) paramsOf(c, out);
}

/** The value of an expression in a row; in a group, an aggregate reads the rows of the group. */
function evalExpr(e: Expr, env: Env, ctx: Context, group: readonly Env[] | undefined): Value {
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
      const last = e.parts[e.parts.length - 1]?.name ?? "";
      const q = e.parts.length > 1 ? e.parts[e.parts.length - 2]?.name : undefined;
      return lookup(env, q, last);
    }
    case "unary": {
      const v = go(e.arg);
      if (e.op === "NOT") return v === null ? null : !truthy(v);
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
      if (t.startsWith("VARCHAR") || t === "TEXT" || t === "CHAR") return String(v);
      return fail(`the type ${e.type.name} is not in astsql`);
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

function callFunction(e: Extract<Expr, { kind: "call" }>, env: Env, ctx: Context, group: readonly Env[] | undefined): Value {
  const name = lc(e.name.parts[e.name.parts.length - 1]?.name ?? "");
  if (AGGREGATES.has(name)) {
    if (group === undefined) return fail(`${name} is an aggregate and stands only in a query that groups`);
    const star = e.args[0]?.kind === "star";
    const arg = e.args[0];
    if (arg !== undefined && arg.kind !== "star" && arg.kind !== "named-arg" && arg.kind !== "keyword-arg") {
      let values = group.map((g) => evalExpr(arg, g, ctx, undefined)).filter((v) => v !== null);
      if (e.distinct) values = values.filter((v, i) => values.findIndex((w) => compare(v, w) === 0) === i);
      switch (name) {
        case "count":
          return values.length;
        case "sum":
          return values.length === 0 ? null : values.reduce<number>((s, v) => s + (numberOf(v) ?? 0), 0);
        case "avg":
          return values.length === 0 ? null : values.reduce<number>((s, v) => s + (numberOf(v) ?? 0), 0) / values.length;
        case "min":
          return values.length === 0 ? null : values.reduce((m, v) => (compare(v, m) < 0 ? v : m));
        case "max":
          return values.length === 0 ? null : values.reduce((m, v) => (compare(v, m) > 0 ? v : m));
        default: {
          const sep = e.args[1] === undefined || e.args[1].kind === "star" || e.args[1].kind === "named-arg" || e.args[1].kind === "keyword-arg" ? "," : String(evalExpr(e.args[1], env, ctx, undefined));
          return values.length === 0 ? null : values.map(String).join(sep);
        }
      }
    }
    if (name === "count" && (star || e.args.length === 0)) return group.length;
    return fail(`${name} takes an expression`);
  }
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
      if (src.natural || src.using.length > 0) return fail("NATURAL and USING joins are not in astsql");
      if (src.type !== "inner" && src.type !== "left" && src.type !== "cross") return fail(`a ${src.type} join is not in astsql`);
      const left = envsOf(src.left, ctx, outer);
      const right = envsOf(src.right, ctx, outer);
      const names = [...left.names, ...right.names];
      const out: Env[] = [];
      const nullRight: Binding[] = right.names.map((b) => ({ alias: b.alias, columns: b.columns, row: b.columns.map(() => null) }));
      // an equality of two qualified columns is a hash join
      const on = src.on;
      let hash: { readonly leftKey: Expr; readonly rightKey: Expr } | undefined;
      if (on !== undefined && on.kind === "binary" && on.op === "=" && on.left.kind === "name" && on.right.kind === "name" && right.names.length === 1) {
        const ra = lc(right.names[0]?.alias ?? "");
        const lq = lc(on.left.parts.length > 1 ? (on.left.parts[on.left.parts.length - 2]?.name ?? "") : "");
        const rq = lc(on.right.parts.length > 1 ? (on.right.parts[on.right.parts.length - 2]?.name ?? "") : "");
        if (rq === ra && lq !== ra && lq !== "") hash = { leftKey: on.left, rightKey: on.right };
        else if (lq === ra && rq !== ra && rq !== "") hash = { leftKey: on.right, rightKey: on.left };
      }
      let index: Map<string, Env[]> | undefined;
      if (hash !== undefined) {
        const h = hash;
        index = new Map();
        for (const r of right.envs) {
          const k = evalExpr(h.rightKey, r, ctx, undefined);
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
          const k = evalExpr(hash.leftKey, l, ctx, undefined);
          return k === null ? [] : (index.get(`${typeof k}:${String(k)}`) ?? []);
        })() : right.envs;
        for (const r of candidates) {
          const merged: Env = { bindings: [...l.bindings, ...r.bindings], outer };
          if (on === undefined || truthy(evalExpr(on, merged, ctx, undefined))) {
            out.push(merged);
            matched = true;
          }
        }
        if (!matched && src.type === "left") out.push({ bindings: [...l.bindings, ...nullRight], outer });
      }
      return { envs: out, names };
    }
    default:
      return fail(`a source of kind ${src.kind} is not in astsql`);
  }
}

function runSelect(q: Select, ctx: Context, outer: Env | undefined): Table {
  if (q.distinctOn.length > 0 || q.windows.length > 0 || q.qualify !== undefined || q.groupAll || q.top !== undefined || q.into !== undefined) return fail("that clause of SELECT is not in astsql");
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
  const grouped = q.groupBy.length > 0 || q.items.some((i) => hasAggregate(i.expr)) || (q.having !== undefined && hasAggregate(q.having));
  // the columns of the output
  const colNames: string[] = [];
  const itemsOut: { readonly item: SelectItem; readonly star: readonly number[] | undefined }[] = [];
  for (const item of q.items) {
    if (item.expr.kind === "star") {
      const qual = item.expr.qualifier?.parts.map((p) => p.name).join(".");
      const picked = names.filter((b) => qual === undefined || lc(b.alias) === lc(qual));
      if (picked.length === 0 && qual !== undefined) fail(`no relation ${qual}`);
      for (const b of picked) for (const c of b.columns) colNames.push(c);
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
  const project = (env: Env, group: readonly Env[] | undefined): Out => {
    const values: Value[] = [];
    for (const { item, star } of itemsOut) {
      if (star !== undefined) {
        const qual = item.expr.kind === "star" ? item.expr.qualifier?.parts.map((p) => p.name).join(".") : undefined;
        for (const b of env.bindings.length > 0 ? env.bindings : []) {
          if (qual !== undefined && lc(b.alias) !== lc(qual)) continue;
          for (const v of b.row) values.push(v);
        }
      } else values.push(evalExpr(item.expr, env, ctx, group));
    }
    const keys = q.orderBy.map((o): Value => {
      const ex = o.expr;
      if (ex.kind === "number") return values[Number(ex.text) - 1] ?? null;
      if (ex.kind === "name" && ex.parts.length === 1) {
        const i = colNames.findIndex((c) => lc(c) === lc(ex.parts[0]?.name ?? ""));
        if (i >= 0 && itemsOut[i]?.item.alias !== undefined) return values[i] ?? null;
      }
      return evalExpr(ex, env, ctx, group);
    });
    return { values, keys };
  };
  if (grouped) {
    const groups = new Map<string, Env[]>();
    if (q.groupBy.length === 0) groups.set("", envs);
    else {
      for (const e of envs) {
        const key = JSON.stringify(q.groupBy.map((g) => evalExpr(g, e, ctx, undefined)));
        const list = groups.get(key);
        if (list === undefined) groups.set(key, [e]);
        else list.push(e);
      }
    }
    for (const g of groups.values()) {
      const rep = g[0] ?? { bindings: names.map((b) => ({ alias: b.alias, columns: b.columns, row: b.columns.map(() => null) })), outer };
      if (q.having !== undefined && !truthy(evalExpr(q.having, rep, ctx, g))) continue;
      outs.push(project(rep, g));
    }
  } else for (const e of envs) outs.push(project(e, undefined));
  let result = outs;
  if (q.distinct) result = result.filter((o, i) => result.findIndex((p) => p.values.length === o.values.length && p.values.every((v, j) => order(v, o.values[j] ?? null) === 0)) === i);
  if (q.orderBy.length > 0) {
    const dirs = q.orderBy.map((o) => (o.direction === "desc" ? -1 : 1));
    result = [...result].sort((a, b) => {
      for (const [i, d] of dirs.entries()) {
        const c = order(a.keys[i] ?? null, b.keys[i] ?? null);
        if (c !== 0) return c * d;
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

function runQuery(q: Query, ctx: Context, outer: Env | undefined): Table {
  switch (q.kind) {
    case "select":
      return runSelect(q, ctx, outer);
    case "with": {
      if (q.recursive) return fail("recursive queries are not in astsql");
      const ctes = new Map(ctx.ctes);
      for (const c of q.ctes) {
        if (c.query.kind === "insert" || c.query.kind === "update" || c.query.kind === "delete") return fail("a data change is not in astsql");
        const t = runQuery(c.query, { ...ctx, ctes }, outer);
        ctes.set(lc(c.name.name), c.columns.length > 0 ? { columns: c.columns.map((x) => x.name), rows: t.rows } : t);
      }
      if (q.body.kind === "insert" || q.body.kind === "update" || q.body.kind === "delete") return fail("a data change is not in astsql");
      return runQuery(q.body, { ...ctx, ctes }, outer);
    }
    case "set-op":
      return fail("set operations are not in astsql");
    case "values":
      return fail("VALUES is not in astsql");
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

/** An engine over relations that a function gives by name (the relations are built when a query names them). */
export function createEngine(tables: Provider, functions: ReadonlyMap<string, ScalarFunction> = new Map()): Engine {
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
        return ok(runQuery(stmt, { tables, functions, params, paramIndex, ctes: new Map() }, undefined));
      } catch (e) {
        if (e instanceof Failure) return err({ message: e.detail });
        return err({ message: "the query could not be run" });
      }
    },
  };
}
