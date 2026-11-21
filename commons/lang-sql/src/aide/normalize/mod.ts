/**
 * Simplifying (commons lang-sql 0010-aide FR-005): `simplify` gives an expression that has the same value for every row, with constants folded, `NOT` pushed to the leaves, `BETWEEN` and a short `IN` written as comparisons, and `AND` and `OR` flat
 * with `TRUE` and `FALSE` taken out; `conjuncts` and `conjoin` split and join the top-level `AND`. A new node keeps the range of the node it replaces.
 *
 * Spec: 0010-aide FR-005
 *
 * @module
 */
import type { BinaryOp, Expr } from "../../mod.ts";

type Span = { readonly start: number; readonly end: number };

const T = (at: Span): Expr => ({ kind: "boolean", start: at.start, end: at.end, value: true });
const F = (at: Span): Expr => ({ kind: "boolean", start: at.start, end: at.end, value: false });
const bin = (at: Span, op: BinaryOp, left: Expr, right: Expr): Expr => ({ kind: "binary", start: at.start, end: at.end, op, left, right });
const isBool = (e: Expr, v: boolean): boolean => e.kind === "boolean" && e.value === v;

const INVERSE: Readonly<Partial<Record<BinaryOp, BinaryOp>>> = { "=": "<>", "<>": "=", "!=": "=", "<": ">=", ">=": "<", ">": "<=", "<=": ">" };
const MAX_IN = 8;

/** The operands of the top-level `AND` of an expression, in order. */
export function conjuncts(e: Expr): readonly Expr[] {
  return e.kind === "binary" && e.op === "AND" ? [...conjuncts(e.left), ...conjuncts(e.right)] : [e];
}

/** The operands joined by `AND` from the left; `undefined` for none. */
export function conjoin(list: readonly Expr[]): Expr | undefined {
  let out: Expr | undefined;
  for (const e of list) out = out === undefined ? e : bin({ start: out.start, end: e.end }, "AND", out, e);
  return out;
}

function flat(op: "AND" | "OR", e: Expr, out: Expr[]): void {
  if (e.kind === "binary" && e.op === op) {
    flat(op, e.left, out);
    flat(op, e.right, out);
  } else out.push(e);
}

function join(op: "AND" | "OR", at: Span, list: readonly Expr[]): Expr {
  const keep: Expr[] = [];
  for (const e of list) {
    if (isBool(e, op === "AND")) continue;
    if (isBool(e, op === "OR")) return op === "AND" ? F(at) : T(at);
    keep.push(e);
  }
  if (op === "AND" && list.some((e) => isBool(e, false))) return F(at);
  if (op === "OR" && list.some((e) => isBool(e, true))) return T(at);
  let out: Expr | undefined;
  for (const e of keep) out = out === undefined ? e : bin(at, op, out, e);
  return out ?? (op === "AND" ? T(at) : F(at));
}

function negate(e: Expr, at: Span): Expr {
  switch (e.kind) {
    case "boolean":
      return { ...e, start: at.start, end: at.end, value: !e.value };
    case "null":
      return e;
    case "unary":
      if (e.op === "NOT") return e.arg;
      break;
    case "binary": {
      if (e.op === "AND" || e.op === "OR") return join(e.op === "AND" ? "OR" : "AND", at, (() => {
        const parts: Expr[] = [];
        flat(e.op, e, parts);
        return parts.map((p) => negate(p, at));
      })());
      const inv = INVERSE[e.op];
      if (inv !== undefined) return bin(at, inv, e.left, e.right);
      break;
    }
    case "is":
      if (e.test !== "unknown") return { ...e, negated: !e.negated };
      break;
    case "between":
    case "in":
    case "in-query":
    case "like":
      return { ...e, negated: !e.negated };
    default:
      break;
  }
  return { kind: "unary", start: at.start, end: at.end, op: "NOT", arg: e };
}

const num = (e: Expr): number | undefined => (e.kind === "number" && /^\d+(\.\d+)?$/.test(e.text) ? Number(e.text) : undefined);
const mk = (at: Span, n: number): Expr => ({ kind: "number", start: at.start, end: at.end, text: String(n) });

/** An expression with the same value for every row, simplified. */
export function simplify(e: Expr): Expr {
  const at: Span = e;
  switch (e.kind) {
    case "unary": {
      if (e.op === "NOT") return negate(simplify(e.arg), at);
      const a = simplify(e.arg);
      const n = num(a);
      if (n !== undefined) return e.op === "-" && n !== 0 ? { kind: "unary", start: at.start, end: at.end, op: "-", arg: a } : a;
      return a === e.arg ? e : { ...e, arg: a };
    }
    case "binary": {
      if (e.op === "AND" || e.op === "OR") {
        const parts: Expr[] = [];
        flat(e.op, e, parts);
        return join(e.op, at, parts.map(simplify));
      }
      const l = simplify(e.left);
      const r = simplify(e.right);
      const a = num(l);
      const b = num(r);
      if (a !== undefined && b !== undefined) {
        switch (e.op) {
          case "+":
            return mk(at, a + b);
          case "-":
            return a - b >= 0 ? mk(at, a - b) : bin(at, e.op, l, r);
          case "*":
            return mk(at, a * b);
          case "/":
            if (b !== 0 && Number.isInteger(a / b)) return mk(at, a / b);
            break;
          case "%":
            if (b !== 0) return mk(at, a % b);
            break;
          case "=":
            return a === b ? T(at) : F(at);
          case "<>":
          case "!=":
            return a !== b ? T(at) : F(at);
          case "<":
            return a < b ? T(at) : F(at);
          case "<=":
            return a <= b ? T(at) : F(at);
          case ">":
            return a > b ? T(at) : F(at);
          case ">=":
            return a >= b ? T(at) : F(at);
          default:
            break;
        }
      }
      if (l.kind === "string" && r.kind === "string") {
        if (e.op === "||") return { kind: "string", start: at.start, end: at.end, value: l.value + r.value, prefix: "" };
        if (e.op === "=") return l.value === r.value ? T(at) : F(at);
        if (e.op === "<>" || e.op === "!=") return l.value !== r.value ? T(at) : F(at);
      }
      return l === e.left && r === e.right ? e : bin(at, e.op, l, r);
    }
    case "between": {
      const arg = simplify(e.arg);
      const lo = simplify(e.low);
      const hi = simplify(e.high);
      if (e.negated) return join("OR", at, [bin(at, "<", arg, lo), bin(at, ">", arg, hi)]);
      return join("AND", at, [bin(at, ">=", arg, lo), bin(at, "<=", arg, hi)]);
    }
    case "in": {
      const arg = simplify(e.arg);
      const values = e.values.map(simplify);
      if (!e.bare && values.length > 0 && values.length <= MAX_IN) {
        return e.negated ? join("AND", at, values.map((v) => bin(at, "<>", arg, v))) : join("OR", at, values.map((v) => bin(at, "=", arg, v)));
      }
      return { ...e, arg, values };
    }
    case "is": {
      const arg = simplify(e.arg);
      if (e.test === "null" && arg.kind === "null") return e.negated ? F(at) : T(at);
      return arg === e.arg ? e : { ...e, arg };
    }
    case "like": {
      const arg = simplify(e.arg);
      const pattern = simplify(e.pattern);
      return arg === e.arg && pattern === e.pattern ? e : { ...e, arg, pattern };
    }
    default:
      return e;
  }
}
