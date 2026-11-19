// Spec: 0041-identity-authorize FR-004
/**
 * The expression language of attribute-based policies (commons data 0041-identity-authorize): a small closed tree written as JSON, with no code in it, that reads attributes by their keys and
 * answers true, false or unknown. An attribute that is not known makes what reads it unknown, and what is unknown never allows.
 *
 * @module
 */

/** A condition: an operator and its arguments, an attribute, or a literal. */
export type Expr =
  | { readonly op: "and" | "or" | "not" | "eq" | "ne" | "lt" | "le" | "gt" | "ge" | "in" | "contains" | "startsWith" | "exists"; readonly args: readonly Expr[] }
  | { readonly attr: string }
  | { readonly lit: string | number | boolean | null | readonly (string | number | boolean)[] };

/** What an expression says: true, false, or unknown (`undefined`). */
export type Truth = boolean | undefined;

const value = (e: Expr, attrs: Readonly<Record<string, unknown>>): { readonly known: boolean; readonly v: unknown } => {
  if ("attr" in e) return e.attr in attrs && attrs[e.attr] !== undefined ? { known: true, v: attrs[e.attr] } : { known: false, v: undefined };
  if ("lit" in e) return { known: true, v: e.lit };
  return { known: false, v: undefined };
};

const OPS = new Set(["and", "or", "not", "eq", "ne", "lt", "le", "gt", "ge", "in", "contains", "startsWith", "exists"]);

/** Why a value is not an expression, or nothing. */
export function checkExpr(e: unknown, path = "$"): string | undefined {
  if (typeof e !== "object" || e === null) return `${path} is not an expression`;
  const o = e as Record<string, unknown>;
  if ("attr" in o) return typeof o["attr"] === "string" && /^[a-z]+\.[A-Za-z0-9.]+$/.test(o["attr"]) ? undefined : `${path}.attr is not \`category.name\``;
  if ("lit" in o) return undefined;
  if (typeof o["op"] !== "string" || !OPS.has(o["op"])) return `${path}.op is not an operator`;
  if (!Array.isArray(o["args"])) return `${path}.args is not a list`;
  const n = o["args"].length;
  if ((o["op"] === "not" || o["op"] === "exists") && n !== 1) return `${path}: ${o["op"]} takes one argument`;
  if (["eq", "ne", "lt", "le", "gt", "ge", "in", "contains", "startsWith"].includes(o["op"]) && n !== 2) return `${path}: ${o["op"]} takes two arguments`;
  for (const [i, a] of (o["args"] as unknown[]).entries()) {
    const why = checkExpr(a, `${path}.args[${i}]`);
    if (why !== undefined) return why;
  }
  return undefined;
}

/**
 * Evaluates an expression.
 *
 * @param e - the expression
 * @param attrs - the attributes that are known, by key
 * @returns true, false, or unknown
 */
export function evaluate(e: Expr, attrs: Readonly<Record<string, unknown>>): Truth {
  if (checkExpr(e) !== undefined) return undefined;
  if (!("op" in e)) {
    const r = value(e, attrs);
    return r.known && typeof r.v === "boolean" ? r.v : undefined;
  }
  const args = e.args;
  switch (e.op) {
    case "and": {
      const rs = args.map((a) => evaluate(a, attrs));
      return rs.includes(false) ? false : rs.includes(undefined) ? undefined : true;
    }
    case "or": {
      const rs = args.map((a) => evaluate(a, attrs));
      return rs.includes(true) ? true : rs.includes(undefined) ? undefined : false;
    }
    case "not": {
      const r = evaluate(args[0] as Expr, attrs);
      return r === undefined ? undefined : !r;
    }
    case "exists":
      return value(args[0] as Expr, attrs).known;
  }
  const a = value(args[0] as Expr, attrs);
  const b = value(args[1] as Expr, attrs);
  if (!a.known || !b.known) return undefined;
  switch (e.op) {
    case "eq":
      return JSON.stringify(a.v) === JSON.stringify(b.v);
    case "ne":
      return JSON.stringify(a.v) !== JSON.stringify(b.v);
    case "in":
      return Array.isArray(b.v) ? b.v.some((x) => JSON.stringify(x) === JSON.stringify(a.v)) : undefined;
    case "contains":
      return Array.isArray(a.v) ? a.v.some((x) => JSON.stringify(x) === JSON.stringify(b.v)) : typeof a.v === "string" && typeof b.v === "string" ? a.v.includes(b.v) : undefined;
    case "startsWith":
      return typeof a.v === "string" && typeof b.v === "string" ? a.v.startsWith(b.v) : undefined;
    default: {
      const x = a.v as number | string;
      const y = b.v as number | string;
      if (typeof x !== typeof y || (typeof x !== "number" && typeof x !== "string")) return undefined;
      return e.op === "lt" ? x < y : e.op === "le" ? x <= y : e.op === "gt" ? x > y : x >= y;
    }
  }
}
