// Spec: 0058-sql-osquery FR-004, FR-005, FR-006
/**
 * A read-only driver for osquery (commons data 0058-sql-osquery FR-004 to FR-006): a `Driver` of the library (0056) that asks `osqueryi --json "<sql>"` on demand, through a function that runs a program (the caller gives it, `system.proc.run` in
 * practice, so that this library depends on no runtime). Only a `SELECT` (or a `WITH` that ends in one) of one statement is run: anything else, and a table that osquery has for its side effects, is refused as an error value before a process is
 * started; a table that does not exist on the platform is a typed error that says where it does. Rows are given with the types of the schema, since osquery prints every value as text.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import type { OsqueryType, OsquerySchema, Platform } from "./schema.ts";

/** What a program run gave. */
export interface Ran {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a program by its argument vector. */
export type Run = (argv: readonly string[]) => Promise<Ran>;

/** Why a query was not run, or did not give rows. */
export type OsqueryError =
  | { readonly kind: "not-select"; readonly why: string }
  | { readonly kind: "denied-table"; readonly table: string; readonly why: string }
  | { readonly kind: "unknown-table"; readonly table: string }
  | { readonly kind: "table-unavailable"; readonly table: string; readonly platform: Platform; readonly available: readonly Platform[] }
  | { readonly kind: "failed"; readonly code: number; readonly message: string }
  | { readonly kind: "bad-output"; readonly why: string };

/** A row as osquery gives it, with the types of the schema where it knows them. */
export type OsqueryRow = Readonly<Record<string, string | number | null>>;

/** What the driver is told. */
export interface OsqueryOptions {
  /** Runs `osqueryi`. */
  readonly run: Run;
  /** The published schema, which says which table exists where and how a column is typed. */
  readonly schema: OsquerySchema;
  /** The platform of the machine osquery runs on. */
  readonly platform: Platform;
  /** The program, `osqueryi` where not given (a path, or `ssh host osqueryi` as a prefix). */
  readonly program?: readonly string[];
  /** Tables that are never run, besides those osquery has for their side effects. */
  readonly deny?: readonly string[];
}

/** The tables that act on the world and not only report it: they fetch from the network or carve files. */
export const SIDE_EFFECT_TABLES: readonly string[] = ["carves", "curl", "curl_certificate"];

const WRITES = /\b(insert|update|delete|drop|create|alter|attach|detach|pragma|replace|vacuum|reindex|analyze|savepoint|release|rollback|begin|commit)\b/i;

/** The text of a statement without its comments and the text of its strings (which are replaced by `''`), so that what is looked for is code. */
function bare(sql: string): string {
  let out = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i] ?? "";
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end < 0 ? sql.length : end + 1;
      out += " ";
    } else if (ch === "'" || ch === '"' || ch === "`") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) j += 2;
          else break;
        } else j++;
      }
      out += ch === "'" ? "''" : `${ch}${ch}`;
      i = j;
    } else out += ch;
  }
  return out;
}

/**
 * Whether a statement may be run: one statement, that begins with `SELECT` or `WITH` and holds no word that writes.
 *
 * @param sql - the statement
 * @returns the statement as it is to be run, or why it is refused
 */
export function selectOnly(sql: string): Result<string, OsqueryError> {
  const code = bare(sql).trim().replace(/;+\s*$/, "");
  if (code === "") return err({ kind: "not-select", why: "the statement is empty" });
  if (code.includes(";")) return err({ kind: "not-select", why: "more than one statement: osquery here runs one SELECT at a time" });
  if (!/^(select|with)\b/i.test(code)) return err({ kind: "not-select", why: "only a SELECT is run: this machine is read, never changed" });
  const w = WRITES.exec(code);
  if (w !== null) return err({ kind: "not-select", why: `the word ${w[0].toUpperCase()} writes, and only a SELECT is run` });
  return ok(sql.trim().replace(/;+\s*$/, ""));
}

/** The names that follow `FROM` and `JOIN` in a statement, in lower case, as the tables it reads. */
export function tablesRead(sql: string): readonly string[] {
  const code = bare(sql);
  const out = new Set<string>();
  for (const m of code.matchAll(/\b(?:from|join)\s+([A-Za-z_][A-Za-z0-9_]*)/gi)) out.add((m[1] ?? "").toLowerCase());
  return [...out];
}

const num = (s: string, bigint: boolean): string | number => {
  const n = Number(s);
  return Number.isFinite(n) && (!bigint || Number.isSafeInteger(n)) ? n : s;
};

/** A value osquery printed as text, as its column's type says. */
function coerce(value: unknown, type: OsqueryType | undefined): string | number | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  if (type === undefined || type === "text" || type === "blob") return s;
  if (s === "") return null;
  return num(s, type !== "double");
}

/**
 * Runs a SELECT on the machine through `osqueryi --json`.
 *
 * @param options - the program runner, the schema and the platform
 * @param sql - the statement
 * @returns the rows with the types of the schema, or why not
 */
export async function osqueryQuery(options: OsqueryOptions, sql: string): Promise<Result<readonly OsqueryRow[], OsqueryError>> {
  const statement = selectOnly(sql);
  if (statement.kind === "err") return statement;
  const denied = new Set([...SIDE_EFFECT_TABLES, ...(options.deny ?? [])]);
  const known = new Map(options.schema.tables.map((t) => [t.name, t]));
  const read = tablesRead(statement.value);
  for (const table of read) {
    if (denied.has(table)) return err({ kind: "denied-table", table, why: "it acts on the world (it fetches or carves) and is never run here" });
    const t = known.get(table);
    if (t === undefined) {
      // a name that follows FROM and is no table of osquery's: a common table expression's, or a subquery's alias: osquery says if it is not there
      continue;
    }
    if (!t.platforms.includes(options.platform)) return err({ kind: "table-unavailable", table, platform: options.platform, available: t.platforms });
  }
  const ran = await options.run([...(options.program ?? ["osqueryi"]), "--json", statement.value]);
  if (ran.code !== 0) {
    const missing = /no such table:\s*([A-Za-z0-9_]+)/i.exec(ran.stderr + ran.stdout);
    if (missing !== null) return err({ kind: "unknown-table", table: (missing[1] ?? "").toLowerCase() });
    return err({ kind: "failed", code: ran.code, message: (ran.stderr || ran.stdout).trim().slice(0, 500) });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(ran.stdout.trim() === "" ? "[]" : ran.stdout);
  } catch {
    return err({ kind: "bad-output", why: "osqueryi did not print JSON" });
  }
  if (!Array.isArray(parsed)) return err({ kind: "bad-output", why: "osqueryi printed JSON that is not a list of rows" });
  const types = new Map<string, OsqueryType | undefined>();
  for (const table of read) for (const c of known.get(table)?.columns ?? []) types.set(c.name, types.has(c.name) && types.get(c.name) !== c.type ? undefined : c.type);
  return ok((parsed as Record<string, unknown>[]).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, coerce(v, types.get(k))]))));
}

/** The error a driver rejects with, which carries the typed error. */
export class OsqueryFailure extends Error {
  readonly error: OsqueryError;
  constructor(error: OsqueryError) {
    super(`osquery: ${error.kind}${"why" in error ? `: ${error.why}` : "table" in error ? `: ${error.table}` : ""}`);
    this.name = "OsqueryFailure";
    this.error = error;
  }
}

/**
 * The driver of osquery: `query` runs a SELECT and gives its rows; `exec` is refused, always, since nothing is changed on the machine.
 *
 * @param options - the program runner, the schema and the platform
 */
export function osqueryDriver(options: OsqueryOptions): Driver {
  return {
    exec: () => Promise.reject(new OsqueryFailure({ kind: "not-select", why: "osquery here is read-only: nothing is executed on the machine, only a SELECT is queried" })),
    query: async (sql) => {
      const r = await osqueryQuery(options, sql);
      if (r.kind === "err") throw new OsqueryFailure(r.error);
      return r.value;
    },
  };
}

/** A machine that a fan-out (0059) can ask: a name, its platform and the read-only driver; the shape of a federation target, without depending on it. */
export interface MachineTarget {
  readonly id: string;
  readonly platform: Platform;
  readonly driver: Driver;
}

/**
 * A machine as a target of a fan-out: `osqueryDriver` for it, with the platform it runs on.
 *
 * @param id - what the machine is called in results
 * @param options - how to run `osqueryi` on it (the runner, usually `ssh host` as a prefix of the program), the schema and its platform
 */
export const osqueryTarget = (id: string, options: OsqueryOptions): MachineTarget => ({ id, platform: options.platform, driver: osqueryDriver(options) });
