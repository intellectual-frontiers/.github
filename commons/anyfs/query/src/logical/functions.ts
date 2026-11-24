// Spec: 0002-query-language FR-005
/**
 * The scalar functions of the language that are not the language library's (commons anyfs-query 0002-query-language FR-005): `under`, `contains` and `json_get`, each total (a value that is not known gives no
 * value) and bounded, so that no text a query is given makes one run long.
 *
 * @module
 */
import { BUILTINS, type Fn, type Value } from "@intellectual-frontiers/lang-sql/aide/exec";

/** The most text `json_get` reads. */
export const MAX_JSON_BYTES = 1024 * 1024;
/** The deepest nesting `json_get` reads. */
export const MAX_JSON_DEPTH = 64;
/** The longest path `json_get` follows. */
export const MAX_JSON_PATH = 256;

const str = (v: Value | undefined): string | null => (v === null || v === undefined ? null : String(v));

/** Whether a path is a path or below the prefix, by whole segments: `a/b` is under `a`, and `ab` is not. */
export function under(path: string, prefix: string): boolean {
  const p = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return p === "" || path === p || path.startsWith(`${p}/`);
}

type Step = { readonly key: string } | { readonly index: number };

/** The steps of a path such as `$.a.b[0].c`, or nothing where it is not one. */
export function stepsOf(path: string): readonly Step[] | undefined {
  if (path.length > MAX_JSON_PATH || !path.startsWith("$")) return undefined;
  const steps: Step[] = [];
  let i = 1;
  while (i < path.length) {
    const c = path.charAt(i);
    if (c === ".") {
      let j = i + 1;
      while (j < path.length && path.charAt(j) !== "." && path.charAt(j) !== "[") j++;
      const key = path.slice(i + 1, j);
      if (key === "") return undefined;
      steps.push({ key });
      i = j;
    } else if (c === "[") {
      const close = path.indexOf("]", i);
      if (close < 0) return undefined;
      const inner = path.slice(i + 1, close);
      if (!/^\d{1,9}$/.test(inner)) return undefined;
      steps.push({ index: Number(inner) });
      i = close + 1;
    } else return undefined;
  }
  return steps;
}

const depthOf = (v: unknown, depth: number): number => {
  if (typeof v !== "object" || v === null) return depth;
  let deepest = depth;
  for (const x of Array.isArray(v) ? v : Object.values(v as Record<string, unknown>)) deepest = Math.max(deepest, depthOf(x, depth + 1));
  return deepest;
};

/** The value at a path of a JSON text: a scalar as itself, an object or array as its text, and nothing where there is none or the text is too long, too deep or not JSON. */
export function jsonGet(text: string, path: string): Value {
  if (text.length > MAX_JSON_BYTES) return null;
  const steps = stepsOf(path);
  if (steps === undefined) return null;
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  if (depthOf(doc, 0) > MAX_JSON_DEPTH) return null;
  let at: unknown = doc;
  for (const s of steps) {
    if ("key" in s) {
      if (typeof at !== "object" || at === null || Array.isArray(at) || !Object.hasOwn(at, s.key)) return null;
      at = (at as Record<string, unknown>)[s.key];
    } else {
      if (!Array.isArray(at) || s.index >= at.length) return null;
      at = at[s.index];
    }
  }
  if (at === null || at === undefined) return null;
  if (typeof at === "string" || typeof at === "number" || typeof at === "boolean") return at;
  return JSON.stringify(at);
}

/** The functions of an environment: those of the language library and the three of this one, and `now` as the time given. */
export function environmentFunctions(nowSeconds: number): ReadonlyMap<string, Fn> {
  return new Map<string, Fn>([
    ...BUILTINS,
    ["now", () => nowSeconds],
    ["under", (a) => (str(a[0]) === null || str(a[1]) === null ? null : under(str(a[0]) ?? "", str(a[1]) ?? ""))],
    ["contains", (a) => (str(a[0]) === null || str(a[1]) === null ? null : (str(a[0]) ?? "").includes(str(a[1]) ?? ""))],
    ["json_get", (a) => (str(a[0]) === null || str(a[1]) === null ? null : jsonGet(str(a[0]) ?? "", str(a[1]) ?? ""))],
  ]);
}
