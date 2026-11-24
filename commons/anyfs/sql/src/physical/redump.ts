// Spec: 0008-sql-dump FR-006
/**
 * A dump written in the plain `INSERT`s of an engine: what the rows a dump holds become as text for SQLite, PostgreSQL or DuckDB, so that the engine's own client replays them with no library code. It writes text and runs nothing.
 *
 * @example
 * ```ts
 * import { redump } from "./redump.ts";
 * const text = redump({ versions: [], blobs: [] }, "postgres", naming);
 * ```
 *
 * @module
 */
import { type Naming, type SqlDialect, tableOf } from "@intellectual-frontiers/anyfs-sql/governance";
import { sqlFor } from "./sql.ts";

/** A version row as a dump gives it: its nine values in the order of the columns. */
export type DumpedVersion = readonly [string, string, string, number, string, string | null, string, string, string | null];
/** What a dump holds: its version rows and its blobs. */
export type Dump = { readonly versions: readonly DumpedVersion[]; readonly blobs: readonly { readonly sha: string; readonly bytes: Uint8Array }[] };

const quoteText = (v: string): string => `'${v.split("'").join("''")}'`;
const hexOfBytes = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/**
 * A dump (the rows `parseDump` read) written as the plain `INSERT`s of an engine, in key order, so that the engine's own client replays it with no library code: SQLite's form is what the real `sqlite3` writes (`X'hex'` for bytes);
 * PostgreSQL's is what `pg_dump --data-only --inserts --on-conflict-do-nothing` writes (`'\xhex'` and `ON CONFLICT DO NOTHING`); DuckDB's is `INSERT OR IGNORE` with `unhex`. Every row of every form replays as a union.
 */
export function redump(dump: Dump, target: SqlDialect, naming: Naming): string {
  const [vt, bt] = [tableOf(naming, "versions"), tableOf(naming, "blobs")];
  const t = (name: string): string => sqlFor(target, naming).name(name);
  const head = target === "duckdb" ? "INSERT OR IGNORE INTO" : "INSERT INTO";
  const tail = target === "postgres" ? " ON CONFLICT DO NOTHING" : "";
  const lit = (v: string | number | null): string => (v === null ? "NULL" : typeof v === "number" ? String(v) : quoteText(v));
  const lines: string[] = [];
  for (const v of dump.versions) lines.push(`${head} ${t(vt)} VALUES(${v.map(lit).join(",")})${tail};`);
  for (const b of dump.blobs) {
    const bytes = target === "sqlite" ? `X'${hexOfBytes(b.bytes)}'` : target === "postgres" ? `'\\x${hexOfBytes(b.bytes)}'` : `unhex('${hexOfBytes(b.bytes)}')`;
    lines.push(`${head} ${t(bt)} VALUES(${quoteText(b.sha)},${bytes})${tail};`);
  }
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}

