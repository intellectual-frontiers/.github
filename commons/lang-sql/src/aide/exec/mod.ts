/**
 * Running (commons lang-sql 0010-aide FR-008): `compile` turns an expression into a closure `(row) => value` with the logic of SQL (null where a value is not known, `AND` and `OR` with their three values), `LIKE` with its like-words, and the
 * functions of an environment, and `run` applies a plan, or the residual of a split, to the rows of an iterable or an async iterable. No code is generated: a closure is composed of closures, so the same module runs on Bun, Node 26 and in a browser.
 *
 * Spec: 0010-aide FR-008
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Expr } from "../../mod.ts";
import type { Plan } from "../plan/mod.ts";

/** A value of a row. */
export type Value = string | number | boolean | null;

/** A row: values by column name. */
export type Row = Readonly<Record<string, Value>>;

/** A function of the environment. */
export type Fn = (args: readonly Value[]) => Value;

/** What an expression may use. */
export interface Environment {
  readonly functions?: ReadonlyMap<string, Fn>;
  /** The values of `?` and `$n` parameters. */
  readonly params?: readonly Value[];
}

/** What cannot be compiled. */
export interface CompileError {
  readonly start: number;
  readonly end: number;
  readonly message: string;
}

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

const order = (a: Value, b: Value): number => (a === null ? (b === null ? 0 : -1) : b === null ? 1 : compare(a, b));

const ESC = /[.*+?^${}()|[\]\\]/g;

/** A SQL `LIKE` pattern as a regular expression. */
export function likeRegex(pattern: string, escape: string | undefined, caseless: boolean): RegExp {
  let out = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern.charAt(i);
    if (escape !== undefined && c === escape && i + 1 < pattern.length) out += pattern.charAt(++i).replace(ESC, "\\$&");
    else if (c === "%") out += "[\\s\\S]*";
    else if (c === "_") out += "[\\s\\S]";
    else out += c.replace(ESC, "\\$&");
  }
  return new RegExp(`${out}$`, caseless ? "iu" : "u");
}

/** A `GLOB` pattern (`*`, `?`, `[a-z]`, `[!a-z]`; `*` matches any characters, `/` included) as a regular expression. */
export function globRegex(pattern: string): RegExp {
  let out = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern.charAt(i);
    if (c === "*") out += "[\\s\\S]*";
    else if (c === "?") out += "[\\s\\S]";
    else if (c === "[") {
      const close = pattern.indexOf("]", i + 2);
      if (close < 0) out += "\\[";
      else {
        let cls = pattern.slice(i + 1, close);
        if (cls.startsWith("!")) cls = `^${cls.slice(1)}`;
        out += `[${cls.replace(/\\/g, "\\\\")}]`;
        i = close;
      }
    } else out += c.replace(ESC, "\\$&");
  }
  return new RegExp(`${out}$`, "u");
}

const str = (v: Value | undefined): string | null => (v === null || v === undefined ? null : String(v));

/** The functions every environment has. */
export const BUILTINS: ReadonlyMap<string, Fn> = new Map<string, Fn>([
  ["lower", (a) => str(a[0])?.toLowerCase() ?? null],
  ["upper", (a) => str(a[0])?.toUpperCase() ?? null],
  ["length", (a) => str(a[0])?.length ?? null],
  ["substr", (a) => {
    const s = str(a[0]);
    const from = a[1];
    if (s === null || typeof from !== "number") return null;
    const len = a[2];
    const start = from > 0 ? from - 1 : 0;
    return typeof len === "number" ? s.slice(start, start + len) : s.slice(start);
  }],
  ["coalesce", (a) => a.find((v) => v !== null) ?? null],
  ["nullif", (a) => (a[0] !== undefined && a[1] !== undefined && a[0] !== null && a[1] !== null && compare(a[0], a[1]) === 0 ? null : (a[0] ?? null))],
  ["abs", (a) => (typeof a[0] === "number" ? Math.abs(a[0]) : null)],
  ["instr", (a) => (str(a[0]) === null || str(a[1]) === null ? null : (str(a[0]) ?? "").indexOf(str(a[1]) ?? "") + 1)],
  ["replace", (a) => (str(a[0]) === null || str(a[1]) === null || str(a[2]) === null ? null : (str(a[0]) ?? "").split(str(a[1]) ?? "").join(str(a[2]) ?? ""))],
  ["basename", (a) => {
    const s = str(a[0]);
    return s === null ? null : (s.split("/").pop() ?? s);
  }],
  ["dirname", (a) => {
    const s = str(a[0]);
    if (s === null) return null;
    const i = s.lastIndexOf("/");
    return i < 0 ? "." : i === 0 ? "/" : s.slice(0, i);
  }],
  ["regexp", (a) => {
    const s = str(a[0]);
    const p = str(a[1]);
    if (s === null || p === null) return null;
    try {
      return new RegExp(p, "u").test(s);
    } catch {
      return null;
    }
  }],
  ["glob", (a) => {
    const s = str(a[0]);
    const p = str(a[1]);
    return s === null || p === null ? null : globRegex(p).test(s);
  }],
]);

type Compiled = (row: Row) => Value;

const NUMERIC_OPS: ReadonlySet<string> = new Set(["+", "-", "*", "/", "%"]);
const toNum = (v: Value): number | null => (v === null ? null : typeof v === "number" ? v : typeof v === "boolean" ? Number(v) : Number.isNaN(Number(v)) ? null : Number(v));

/** An expression as a closure over a row; an error value for a construct that is not compiled or a function that is not known. */
export function compile(expr: Expr, env: Environment = {}): Result<(row: Row) => Value, readonly CompileError[]> {
  const errors: CompileError[] = [];
  const fns = (name: string): Fn | undefined => env.functions?.get(name) ?? BUILTINS.get(name);
  const bad = (e: { readonly start: number; readonly end: number }, message: string): Compiled => {
    errors.push({ start: e.start, end: e.end, message });
    return () => null;
  };
  const go = (e: Expr): Compiled => {
    switch (e.kind) {
      case "number": {
        const n = Number(e.text.replaceAll("_", ""));
        return () => n;
      }
      case "string": {
        const v = e.value;
        return () => v;
      }
      case "boolean": {
        const v = e.value;
        return () => v;
      }
      case "null":
        return () => null;
      case "param": {
        const idx = /^\$\d+$/.test(e.text) ? Number(e.text.slice(1)) - 1 : 0;
        const v = env.params?.[idx];
        if (v === undefined) return bad(e, `the parameter ${e.text} has no value`);
        return () => v;
      }
      case "name": {
        const col = e.parts[e.parts.length - 1]?.name ?? "";
        return (row) => row[col] ?? null;
      }
      case "unary": {
        const a = go(e.arg);
        if (e.op === "NOT") return (r) => {
          const v = a(r);
          return v === null ? null : !truthy(v);
        };
        const sign = e.op === "-" ? -1 : 1;
        return (r) => {
          const n = toNum(a(r));
          return n === null ? null : sign * n;
        };
      }
      case "binary": {
        const l = go(e.left);
        const r = go(e.right);
        const op = e.op;
        if (op === "AND")
          return (row) => {
            const x = l(row);
            if (x !== null && !truthy(x)) return false;
            const y = r(row);
            if (y !== null && !truthy(y)) return false;
            return x === null || y === null ? null : true;
          };
        if (op === "OR")
          return (row) => {
            const x = l(row);
            if (x !== null && truthy(x)) return true;
            const y = r(row);
            if (y !== null && truthy(y)) return true;
            return x === null || y === null ? null : false;
          };
        if (NUMERIC_OPS.has(op))
          return (row) => {
            const a = toNum(l(row));
            const b = toNum(r(row));
            if (a === null || b === null) return null;
            if ((op === "/" || op === "%") && b === 0) return null;
            return op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : op === "/" ? a / b : a % b;
          };
        return (row) => {
          const a = l(row);
          const b = r(row);
          if (a === null || b === null) return null;
          switch (op) {
            case "=":
              return compare(a, b) === 0;
            case "<>":
            case "!=":
              return compare(a, b) !== 0;
            case "<":
              return compare(a, b) < 0;
            case "<=":
              return compare(a, b) <= 0;
            case ">":
              return compare(a, b) > 0;
            case ">=":
              return compare(a, b) >= 0;
            default:
              return String(a) + String(b);
          }
        };
      }
      case "is": {
        const a = go(e.arg);
        const o = e.other === undefined ? undefined : go(e.other);
        const neg = e.negated;
        const test = e.test;
        return (row) => {
          const v = a(row);
          let res: boolean;
          if (test === "null" || test === "unknown") res = v === null;
          else if (test === "true") res = v !== null && truthy(v);
          else if (test === "false") res = v !== null && !truthy(v);
          else {
            const w = o === undefined ? null : o(row);
            res = !(v === w || (v !== null && w !== null && compare(v, w) === 0));
          }
          return neg ? !res : res;
        };
      }
      case "between": {
        const a = go(e.arg);
        const lo = go(e.low);
        const hi = go(e.high);
        const neg = e.negated;
        return (row) => {
          const v = a(row);
          const x = lo(row);
          const y = hi(row);
          if (v === null || x === null || y === null) return null;
          const res = compare(v, x) >= 0 && compare(v, y) <= 0;
          return neg ? !res : res;
        };
      }
      case "in": {
        if (e.bare) return bad(e, "IN with no parentheses is not compiled");
        const a = go(e.arg);
        const vs = e.values.map(go);
        const neg = e.negated;
        return (row) => {
          const v = a(row);
          if (v === null) return null;
          let sawNull = false;
          for (const f of vs) {
            const o = f(row);
            if (o === null) sawNull = true;
            else if (compare(v, o) === 0) return neg ? false : true;
          }
          return sawNull ? null : neg;
        };
      }
      case "like": {
        const a = go(e.arg);
        const p = go(e.pattern);
        const esc = e.escape === undefined ? undefined : go(e.escape);
        const neg = e.negated;
        const word = e.op.toUpperCase();
        if (word !== "LIKE" && word !== "ILIKE" && word !== "GLOB" && word !== "REGEXP") return bad(e, `${e.op} is not compiled`);
        const literal = e.pattern.kind === "string" ? e.pattern.value : undefined;
        if (word === "REGEXP" && literal !== undefined) {
          try {
            new RegExp(literal, "u");
          } catch {
            return bad(e.pattern, `${literal} is not a regular expression`);
          }
        }
        const cache = new Map<string, RegExp | null>();
        const rx = (pat: string, escape: string | undefined): RegExp | null => {
          const key = `${pat}\u0000${escape ?? ""}`;
          const hit = cache.get(key);
          if (hit !== undefined) return hit;
          let made: RegExp | null;
          try {
            made = word === "GLOB" ? globRegex(pat) : word === "REGEXP" ? new RegExp(pat, "u") : likeRegex(pat, escape, word === "ILIKE");
          } catch {
            made = null;
          }
          cache.set(key, made);
          return made;
        };
        return (row) => {
          const v = a(row);
          const pv = p(row);
          if (v === null || pv === null) return null;
          const ev = esc === undefined ? undefined : esc(row);
          const re = rx(String(pv), typeof ev === "string" ? ev : undefined);
          if (re === null) return null;
          const res = re.test(String(v));
          return neg ? !res : res;
        };
      }
      case "case": {
        const operand = e.operand === undefined ? undefined : go(e.operand);
        const whens = e.whens.map((w) => ({ c: go(w.cond), r: go(w.result) }));
        const other = e.otherwise === undefined ? undefined : go(e.otherwise);
        return (row) => {
          const o = operand === undefined ? undefined : operand(row);
          for (const w of whens) {
            const c = w.c(row);
            if (o === undefined ? truthy(c) : c !== null && o !== null && compare(o, c) === 0) return w.r(row);
          }
          return other === undefined ? null : other(row);
        };
      }
      case "cast": {
        const a = go(e.arg);
        const t = e.type.name.toUpperCase();
        return (row) => {
          const v = a(row);
          if (v === null) return null;
          if (t === "INT" || t === "INTEGER" || t === "BIGINT") return toNum(v) === null ? null : Math.trunc(toNum(v) ?? 0);
          if (t === "REAL" || t === "FLOAT" || t === "DOUBLE" || t === "NUMERIC") return toNum(v);
          if (t === "BOOLEAN" || t === "BOOL") return truthy(v);
          return String(v);
        };
      }
      case "call": {
        const name = lc(e.name.parts.map((p) => p.name).join("."));
        if (name === "now" && fns("now") === undefined) return bad(e, "now needs a clock in the environment");
        const f = fns(name);
        if (f === undefined) return bad(e, `the function ${name} is not known`);
        const args: Compiled[] = [];
        for (const a of e.args) {
          if (a.kind === "star" || a.kind === "named-arg" || a.kind === "keyword-arg" || a.kind === "lambda") return bad(a, `${name} takes plain arguments`);
          args.push(go(a));
        }
        return (row) => f(args.map((x) => x(row)));
      }
      default:
        return bad(e, `a ${e.kind} is not compiled`);
    }
  };
  const fn = go(expr);
  return errors.length > 0 ? err(errors) : ok(fn);
}

const nameOf = (e: Expr, i: number): string => (e.kind === "name" ? (e.parts[e.parts.length - 1]?.name ?? `column${i + 1}`) : `column${i + 1}`);

/** Runs a plan over rows (an iterable or an async iterable of rows) and gives the rows it selects; an error value for an expression that is not compiled. */
export async function run(plan: Plan, rows: Iterable<Row> | AsyncIterable<Row>, env: Environment = {}): Promise<Result<readonly Row[], readonly CompileError[]>> {
  const stages: Plan[] = [];
  for (let p: Plan = plan; ; ) {
    stages.unshift(p);
    if (p.kind === "scan") break;
    p = p.input;
  }
  const errors: CompileError[] = [];
  const c = (e: Expr): ((row: Row) => Value) => {
    const r = compile(e, env);
    if (r.kind === "err") {
      errors.push(...r.error);
      return () => null;
    }
    return r.value;
  };
  let current: Row[] = [];
  for await (const r of rows) current.push(r);
  for (const st of stages) {
    switch (st.kind) {
      case "scan":
        break;
      case "filter": {
        const f = c(st.predicate);
        current = current.filter((r) => truthy(f(r)));
        break;
      }
      case "sort": {
        const keys = st.order.map((o) => ({ f: c(o.expr), dir: o.direction === "desc" ? -1 : 1 }));
        const keyed = current.map((r) => ({ r, k: keys.map((x) => x.f(r)) }));
        keyed.sort((a, b) => {
          for (const [i, k] of keys.entries()) {
            const d = order(a.k[i] ?? null, b.k[i] ?? null);
            if (d !== 0) return d * k.dir;
          }
          return 0;
        });
        current = keyed.map((x) => x.r);
        break;
      }
      case "project": {
        const cols = st.items.map((it, i) => ({ star: it.expr.kind === "star", name: it.alias?.name ?? nameOf(it.expr, i), f: it.expr.kind === "star" ? undefined : c(it.expr) }));
        let out = current.map((r): Row => {
          const o: Record<string, Value> = {};
          for (const col of cols) {
            if (col.f === undefined) Object.assign(o, r);
            else o[col.name] = col.f(r);
          }
          return o;
        });
        if (st.distinct) {
          const seen = new Set<string>();
          out = out.filter((r) => {
            const k = JSON.stringify(Object.values(r));
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        }
        current = out;
        break;
      }
      case "limit": {
        const from = st.offset ?? 0;
        current = st.limit === undefined ? current.slice(from) : current.slice(from, from + st.limit);
        break;
      }
    }
  }
  return errors.length > 0 ? err(errors) : ok(current);
}
