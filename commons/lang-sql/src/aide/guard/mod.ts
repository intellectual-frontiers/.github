/**
 * The guard of a query that only reads (commons lang-sql 0012-sql-guard): `guard` reads a text with the parser of a dialect and gives its parse only where it is exactly one statement that reads (a query, with no data change, no definition, no
 * `SELECT ... INTO`, no locking clause and no call of a function that sleeps, reads a file, takes a lock or changes a sequence), and every violation with its span where it is not. A word of a write inside a string, an identifier or a comment is
 * not a violation, which no pattern over the text can say. With a catalog, a plain `SELECT` is bound to the tables the connection has.
 *
 * @example
 * ```ts
 * guard("SELECT 'DELETE FROM t'", postgres);            // ok
 * refusal("WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x", postgres); // "delete is not in the language read-only (line 1, column 14)"
 * ```
 *
 * Spec: 0012-sql-guard FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { children, type Dialect, type Node, parse, type Parsed, type Statement } from "../../mod.ts";
import { bind, type Catalog } from "../catalog/mod.ts";
import { conform, defineProfile, type Profile, type Violation } from "../profile/mod.ts";

/** The functions that sleep, read or write files, take locks, change a sequence or a setting, load code or reach another host. */
export const DENIED_FUNCTIONS: readonly string[] = [
  "pg_sleep", "pg_read_file", "pg_read_binary_file", "pg_ls_dir", "pg_stat_file", "lo_import", "lo_export", "lo_unlink", "dblink", "dblink_exec", "pg_advisory_lock", "pg_terminate_backend", "pg_cancel_backend",
  "set_config", "nextval", "setval", "load_extension", "readfile", "writefile", "load_file", "sleep", "benchmark", "xp_cmdshell", "sys_exec",
];

/** What a guard may be given. */
/** The PRAGMAs that take a name and only list (`table_info(t)`): the same form with a value sets, so any other call is refused. */
const LISTING_PRAGMA = /^\s*(?:\w+\.)?(?:table_info|table_xinfo|table_list|index_list|index_info|index_xinfo|foreign_key_list|foreign_key_check|integrity_check|quick_check)\s*\(/i;

export interface GuardOptions {
  /** Allow a `PRAGMA` that reads. */
  readonly allowPragma?: boolean;
  /** The functions that may not be called; the default list where not given. */
  readonly deniedFunctions?: readonly string[];
  /** The tables a plain `SELECT` may be bound to, and the types of their columns. */
  readonly catalog?: Catalog;
  /** The tables that may be read, whatever the catalog. */
  readonly tables?: readonly string[];
  /** The most nodes of the statement. */
  readonly maxNodes?: number;
}

/** A statement that only reads. */
export interface Guarded {
  readonly parsed: Parsed;
  readonly statement: Statement;
}

const WRITES: readonly Node["kind"][] = ["insert", "update", "delete", "create-table", "create-index", "create-view", "alter-table", "drop", "create-routine", "on-conflict"];

/** The profile of the language that only reads. */
export function readOnlyProfile(options: GuardOptions = {}): Profile {
  return defineProfile({
    name: "read-only",
    // every kind of statement is let through here: a write is refused by its node, and a command by the guard, each with its own sentence
    statements: ["select", "set-op", "values", "with", "insert", "update", "delete", "create-table", "create-index", "create-view", "alter-table", "drop", "create-routine", "command"],
    forbidNodes: WRITES,
    deniedFunctions: options.deniedFunctions ?? DENIED_FUNCTIONS,
    maxStatements: 1,
    ...(options.tables === undefined ? {} : { tables: options.tables }),
    ...(options.maxNodes === undefined ? {} : { maxNodes: options.maxNodes }),
  });
}

function walkAll(n: Node, visit: (n: Node) => void): void {
  visit(n);
  for (const c of children(n)) walkAll(c, visit);
}

/** The parse of a text that is exactly one statement that only reads; every violation with its span where it is not. */
export function guard(text: string, dialect: Dialect, options: GuardOptions = {}): Result<Guarded, readonly Violation[]> {
  const parsed = parse(text, dialect);
  const out: Violation[] = [];
  const checked = conform(parsed, readOnlyProfile(options));
  if (checked.kind === "err") out.push(...checked.error);
  if (parsed.script.statements.length === 0 && out.length === 0) out.push({ start: 0, end: text.length, message: "the text holds no statement" });
  for (const s of parsed.script.statements) {
    if (s.kind === "command") {
      const reads = options.allowPragma === true && s.keyword === "PRAGMA" && !s.text.includes("=") && (!s.text.includes("(") || LISTING_PRAGMA.test(s.text));
      if (!reads) out.push({ start: s.start, end: s.end, message: options.allowPragma === true && s.keyword === "PRAGMA" ? "a PRAGMA that sets is not a read" : `${s.keyword} is not a read` });
    }
    walkAll(s, (n) => {
      if (n.kind === "select" && n.into !== undefined) out.push({ start: n.start, end: n.end, message: "SELECT ... INTO makes a table" });
      if ((n.kind === "select" || n.kind === "set-op") && n.locking !== undefined) out.push({ start: n.start, end: n.end, message: "a locking clause takes locks" });
    });
  }
  const only = parsed.script.statements[0];
  if (out.length === 0 && options.catalog !== undefined && only !== undefined && only.kind === "select") {
    const b = bind(only, options.catalog);
    if (b.kind === "err") out.push(...b.error);
  }
  const first = parsed.script.statements[0];
  if (out.length > 0 || first === undefined) return err(out);
  return ok({ parsed, statement: first });
}

/** The sentence of the first violation with its place, or `undefined` where the text is allowed. */
export function refusal(text: string, dialect: Dialect, options: GuardOptions = {}): string | undefined {
  const r = guard(text, dialect, options);
  if (r.kind === "ok") return undefined;
  const v = r.error[0];
  if (v === undefined) return "the text is not allowed";
  const before = text.slice(0, Math.min(v.start, text.length));
  const line = before.split("\n").length;
  const column = v.start - (before.lastIndexOf("\n") + 1) + 1;
  return `${v.message} (line ${line}, column ${column})`;
}
