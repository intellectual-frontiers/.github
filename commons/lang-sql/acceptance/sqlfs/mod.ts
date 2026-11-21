/**
 * sqlfs (commons lang-sql 0011-acceptance FR-003): SQL over a file system, run in this process. A query is read, conformed, bound, typed and planned by aide, the walk of the file system is pruned where the filter shows that nothing below a directory
 * can match (a bound on `depth`, a prefix of `path`), and the plan is run over the entries that the walk gives.
 *
 * @example
 * ```ts
 * const r = await search(diskFs("/etc"), "SELECT path, size FROM files WHERE ext = 'conf' AND size > 1 KB ORDER BY size DESC LIMIT 5");
 * ```
 *
 * Spec: 0011-acceptance FR-003
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Expr } from "../../src/mod.ts";
import { type Environment, type Fn, run, type Value } from "../../src/aide/exec/mod.ts";
import { conjuncts } from "../../src/aide/normalize/mod.ts";
import { explain, type Plan } from "../../src/aide/plan/mod.ts";
import { analyze, columnsOf, type Diagnostic, type Entry, type Result2, toRow } from "../shared/language.ts";
import type { FileSystem } from "../shared/walk.ts";

/** What a search may be asked. */
export interface SearchOptions {
  /** The time `now()` gives, in seconds; the clock where not given. */
  readonly now?: number;
  /** The most rows to give (10000 where not given). */
  readonly maxRows?: number;
  /** The deepest level to read (64 where not given). */
  readonly maxDepth?: number;
  /** Told what could not be read. */
  readonly warn?: (message: string) => void;
}

/** What a search gives. */
export interface Searched extends Result2 {
  /** The plan and what the walk did, as text. */
  readonly explained: string;
  /** Whether the rows were cut at `maxRows`. */
  readonly truncated: boolean;
}

const lit = (e: Expr): Value | undefined => (e.kind === "number" ? Number(e.text) : e.kind === "string" ? e.value : undefined);
const col = (e: Expr): string | undefined => (e.kind === "name" ? e.parts[e.parts.length - 1]?.name.toLowerCase() : undefined);

/** The leading part of a pattern before its first wildcard. */
function prefixOf(pattern: string, like: boolean): string {
  const stop = like ? /[%_]/ : /[*?[]/;
  const m = stop.exec(pattern);
  return m === null ? pattern : pattern.slice(0, m.index);
}

/** What a filter shows about where a match can be: the deepest level and the prefix of the path. */
export function boundsOf(predicate: Expr | undefined): { readonly maxDepth: number | undefined; readonly prefix: string | undefined; readonly never: boolean } {
  let maxDepth: number | undefined;
  let prefix: string | undefined;
  let never = false;
  if (predicate === undefined) return { maxDepth, prefix, never };
  for (const c of conjuncts(predicate)) {
    if (c.kind === "boolean" && !c.value) never = true;
    if (c.kind === "binary") {
      const l = col(c.left);
      const v = lit(c.right);
      if (l === "depth" && typeof v === "number") {
        const bound = c.op === "<=" ? v : c.op === "<" ? v - 1 : c.op === "=" ? v : undefined;
        if (bound !== undefined) maxDepth = maxDepth === undefined ? bound : Math.min(maxDepth, bound);
      }
      if (l === "path" && c.op === "=" && typeof v === "string") prefix = prefix === undefined || v.startsWith(prefix) ? v : prefix;
    }
    if (c.kind === "like" && !c.negated && col(c.arg) === "path" && c.escape === undefined) {
      const v = lit(c.pattern);
      const op = c.op.toUpperCase();
      if (typeof v === "string" && (op === "GLOB" || op === "LIKE")) {
        const p = prefixOf(v, op === "LIKE");
        if (p !== "" && (prefix === undefined || p.startsWith(prefix))) prefix = p;
      }
    }
  }
  return { maxDepth, prefix, never };
}

function filterOf(p: Plan): Expr | undefined {
  for (let q: Plan = p; ; ) {
    if (q.kind === "filter") return q.predicate;
    if (q.kind === "scan") return undefined;
    q = q.input;
  }
}

/** Runs a query over a file system; the errors of the query as values with their spans. */
export async function search(fs: FileSystem, text: string, options: SearchOptions = {}): Promise<Result<Searched, readonly Diagnostic[]>> {
  const analyzed = analyze(text);
  if (analyzed.kind === "err") return analyzed;
  const { plan } = analyzed.value;
  const bounds = boundsOf(filterOf(plan));
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const functions = new Map<string, Fn>([["now", () => now]]);
  const env: Environment = { functions };
  const maxRows = options.maxRows ?? 10000;
  const limitDepth = options.maxDepth ?? 64;
  const walked: Entry[] = [];
  if (!bounds.never) {
    const depthCap = bounds.maxDepth === undefined ? limitDepth : Math.min(limitDepth, bounds.maxDepth);
    const prefix = bounds.prefix;
    const walkOptions = {
      maxDepth: depthCap,
      descend: (d: Entry): boolean => prefix === undefined || prefix.startsWith(`${d.path}/`) || `${d.path}/`.startsWith(prefix),
      ...(options.warn === undefined ? {} : { warn: options.warn }),
    };
    for await (const e of fs.walk(walkOptions)) walked.push(e);
  }
  const rows = await run(plan, walked.map(toRow), env);
  if (rows.kind === "err") return err(rows.error);
  const columns = columnsOf(analyzed.value);
  const truncated = rows.value.length > maxRows;
  const notes = [explain(plan), `walk: ${bounds.never ? "nothing (the filter is never true)" : `${bounds.maxDepth === undefined ? "all levels" : `to level ${bounds.maxDepth}`}${bounds.prefix === undefined ? "" : `, path prefix '${bounds.prefix}'`}`}`];
  return ok({ columns, rows: truncated ? rows.value.slice(0, maxRows) : rows.value, explained: notes.join("\n"), truncated });
}
