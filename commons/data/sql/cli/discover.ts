// Spec: 0047-arcactl-init FR-011, FR-012
/**
 * Finding the instances a person can reach (commons data 0047-arcactl-init FR-011, FR-012): from the connection the environment names, libpq's own variables, the services of `pg_service.conf`, the
 * hosts `.pgpass` has passwords for, what `arcactl` already knows, and (where asked) PostgreSQL on this machine; and the `arca.config.ts` files in an Ergonex workspace. Then looking at each one
 * and saying, without changing anything, whether it is reached, as whom, what that role could do to it (read, migrate, migrate and guard) and what arca it has. A password goes only to the host it is
 * written for, never to a wildcard, and no password is printed.
 *
 * @module
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type ModelName, modelNames, schemaOf, settingsOf } from "./config.ts";
import type { Connection, ConnectOptions } from "./connection.ts";
import { parsePgpass, parseServices } from "./libpq.ts";
import { redact } from "./redact.ts";
import type { State } from "./state.ts";
import type { Paths } from "./workstation.ts";

/** A place a person might connect to, and where we heard of it. */
export interface Candidate {
  readonly name: string;
  readonly sources: readonly string[];
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly user?: string;
  readonly sslmode?: string;
  /** Where the person defined a service of this name themselves, outside `arcactl`'s block. */
  readonly userService?: boolean;
}

/** What discovery is given. */
export interface DiscoverInput {
  readonly paths: Paths;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** The connection URL the person gave, which may have a password (it is dropped here). */
  readonly url?: string;
  /** Also look for PostgreSQL on this machine (`127.0.0.1:5432`). */
  readonly local?: boolean;
  readonly state: State;
  /** The root of an Ergonex workspace, where it is known (`ERGONEX_HOME`). */
  readonly workspace?: string;
}

const read = (p: string): string => {
  try {
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  } catch {
    return "";
  }
};

const concrete = (host: string | undefined): host is string => host !== undefined && host !== "" && host !== "*";
const portOf = (v: string | undefined): number | undefined => (v !== undefined && /^\d{1,5}$/.test(v) ? Number(v) : undefined);
const keyOf = (c: Pick<Candidate, "host" | "port" | "database">): string => `${c.host ?? ""}|${c.port ?? 5432}|${c.database ?? ""}`;

/** A name for a place that has none of its own: its host and port. */
const derived = (c: Pick<Candidate, "host" | "port">): string => `${(c.host ?? "local").replace(/[^A-Za-z0-9._-]/g, "-")}${c.port === undefined || c.port === 5432 ? "" : `-${c.port}`}`;

/** The `arca.config.ts` files under a workspace root, a few levels deep, leaving out what is not source. */
export function workspaceConfigs(root: string, depth = 4): readonly string[] {
  const out: string[] = [];
  const walk = (dir: string, d: number): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir).toSorted();
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".git" || name === ".worktrees" || name === "dist") continue;
      const full = join(dir, name);
      if (name === "arca.config.ts") out.push(full);
      else if (d > 0) {
        try {
          if (statSync(full).isDirectory()) walk(full, d - 1);
        } catch {
          // not readable: not source
        }
      }
    }
  };
  if (existsSync(root)) walk(root, depth);
  return out;
}

/**
 * The instances a person might reach, and the configurations their workspace has.
 *
 * @param i - what to look in
 * @returns the candidates, each with where it was heard of, and the `arca.config.ts` files
 */
export function discover(i: DiscoverInput): { readonly candidates: readonly Candidate[]; readonly configs: readonly string[] } {
  const found: Candidate[] = [];
  const add = (c: Candidate): void => void found.push(c);
  if (i.url !== undefined) {
    try {
      const u = new URL(i.url);
      add({ name: i.env["ARCA_INSTANCE"] ?? "given", sources: ["the connection URL"], host: u.hostname, ...(u.port === "" ? {} : { port: Number(u.port) }), ...(u.pathname.length > 1 ? { database: decodeURIComponent(u.pathname.slice(1)) } : {}), ...(u.username === "" ? {} : { user: decodeURIComponent(u.username) }), ...(u.searchParams.get("sslmode") === null ? {} : { sslmode: u.searchParams.get("sslmode") as string }) });
    } catch {
      // not a URL: nothing is learned from it
    }
  }
  const e = i.env;
  if (concrete(e["PGHOST"])) add({ name: e["PGSERVICE"] ?? "libpq-env", sources: ["libpq's environment"], host: e["PGHOST"], ...(portOf(e["PGPORT"]) === undefined ? {} : { port: portOf(e["PGPORT"]) as number }), ...(e["PGDATABASE"] === undefined ? {} : { database: e["PGDATABASE"] }), ...(e["PGUSER"] === undefined ? {} : { user: e["PGUSER"] }), ...(e["PGSSLMODE"] === undefined ? {} : { sslmode: e["PGSSLMODE"] }) });
  const own = new Set(i.state.instances.filter((k) => k.ownsService === true).map((k) => k.name));
  for (const s of parseServices(read(i.paths.pgServiceFile))) {
    const host = s.settings["host"];
    if (!concrete(host)) continue;
    add({ name: s.name, sources: [own.has(s.name) ? "pg_service.conf (arcactl's)" : "pg_service.conf"], host, ...(portOf(s.settings["port"]) === undefined ? {} : { port: portOf(s.settings["port"]) as number }), ...(s.settings["dbname"] === undefined ? {} : { database: s.settings["dbname"] }), ...(s.settings["user"] === undefined ? {} : { user: s.settings["user"] }), ...(s.settings["sslmode"] === undefined ? {} : { sslmode: s.settings["sslmode"] }), ...(own.has(s.name) ? {} : { userService: true }) });
  }
  for (const c of parsePgpass(read(i.paths.pgpass)).credentials) {
    if (!concrete(c.host)) continue;
    add({ name: "", sources: [".pgpass"], host: c.host, ...(portOf(c.port) === undefined ? {} : { port: portOf(c.port) as number }), ...(c.database === "*" ? {} : { database: c.database }), ...(c.user === "*" ? {} : { user: c.user }) });
  }
  for (const k of i.state.instances) if (concrete(k.host)) add({ name: k.name, sources: ["arcactl"], host: k.host, ...(k.port === undefined ? {} : { port: k.port }), ...(k.database === undefined ? {} : { database: k.database }), ...(k.user === undefined ? {} : { user: k.user }), ...(k.sslmode === undefined ? {} : { sslmode: k.sslmode }) });
  if (i.local === true) add({ name: "local", sources: ["this machine"], host: "127.0.0.1", port: 5432 });
  // the same place heard of twice is one: its names (a service's before a derived one), its sources and what each knew
  const merged = new Map<string, Candidate>();
  for (const c of found) {
    const k = keyOf(c);
    const had = merged.get(k);
    if (had === undefined) {
      merged.set(k, c);
      continue;
    }
    const pick = <K extends "host" | "port" | "database" | "user" | "sslmode">(f: K): { [P in K]?: NonNullable<Candidate[K]> } => {
      const v = had[f] ?? c[f];
      return (v === undefined ? {} : { [f]: v }) as { [P in K]?: NonNullable<Candidate[K]> };
    };
    merged.set(k, {
      name: had.name !== "" && !(c.name !== "" && (c.sources[0] ?? "").startsWith("pg_service")) ? had.name : c.name !== "" ? c.name : had.name,
      sources: [...new Set([...had.sources, ...c.sources])],
      ...pick("host"),
      ...pick("port"),
      ...pick("database"),
      ...pick("user"),
      ...pick("sslmode"),
      ...(had.userService === true || c.userService === true ? { userService: true } : {}),
    });
  }
  const named = [...merged.values()].map((c): Candidate => (c.name === "" ? { ...c, name: derived(c) } : c));
  // two places with one name: the later gets its host and port added
  const seen = new Map<string, number>();
  const unique = named.map((c) => {
    const n = seen.get(c.name) ?? 0;
    seen.set(c.name, n + 1);
    return n === 0 ? c : { ...c, name: `${c.name}-${derived(c)}` };
  });
  return { candidates: unique, configs: i.workspace === undefined ? [] : workspaceConfigs(i.workspace) };
}

/** The password `.pgpass` has for a place, as libpq reads it (the first line that matches, each field exact or `*`); none where there is none. */
export function passwordFor(paths: Paths, c: Pick<Candidate, "host" | "port" | "database" | "user">): string | undefined {
  const want = { host: c.host ?? "", port: String(c.port ?? 5432), database: c.database ?? "postgres", user: c.user ?? "" };
  const hit = parsePgpass(read(paths.pgpass)).credentials.find((p) => (["host", "port", "database", "user"] as const).every((k) => p[k] === "*" || p[k] === want[k]));
  return hit?.password;
}

/** A connection URL for a candidate, with a password where there is one; the password is encoded, and the URL is for the program and never for the screen. */
export function urlOf(c: Candidate, password?: string): string {
  const auth = c.user === undefined ? "" : `${encodeURIComponent(c.user)}${password === undefined ? "" : `:${encodeURIComponent(password)}`}@`;
  const q = c.sslmode === undefined ? "" : `?sslmode=${encodeURIComponent(c.sslmode)}`;
  return `postgres://${auth}${c.host ?? "127.0.0.1"}:${c.port ?? 5432}/${encodeURIComponent(c.database ?? "postgres")}${q}`;
}

/** What it would do to an instance: nothing, read it, migrate it, or migrate it and guard it (create event triggers). */
export type Level = "none" | "read" | "migrate" | "migrate+guard";

/** What looking at one instance found. */
export interface Probe {
  readonly reachable: boolean;
  readonly error?: string;
  readonly version?: string;
  readonly user?: string;
  readonly superuser?: boolean;
  readonly level: Level;
  readonly arca: { readonly schema: string; readonly exists: boolean; readonly tables: number; readonly models: readonly ModelName[] };
}

const modelTables = new Map<ModelName, ReadonlySet<string>>();
/** The tables of a model with what it requires, as they are named in the database. */
export function tablesOfModel(m: ModelName): ReadonlySet<string> {
  const had = modelTables.get(m);
  if (had !== undefined) return had;
  const c = settingsOf({ models: [m] });
  const s = c.kind === "ok" ? schemaOf(c.value) : undefined;
  const set = new Set(s?.kind === "ok" ? s.value.schema.tables.map((t) => t.name.join("_")) : []);
  modelTables.set(m, set);
  return set;
}

/**
 * Looks at an instance: reads and changes nothing.
 *
 * @param connect - how a connection is made
 * @param c - the instance
 * @param password - the password `.pgpass` has for it, where there is one
 * @param schema - the schema arca is looked for in
 * @returns what was found
 */
export async function probe(connect: (o: ConnectOptions) => Promise<Connection>, c: Candidate, password: string | undefined, schema = "arca"): Promise<Probe> {
  const none = (error: string): Probe => ({ reachable: false, error, level: "none", arca: { schema, exists: false, tables: 0, models: [] } });
  let conn: Connection;
  try {
    conn = await connect({ url: urlOf(c, password), connectTimeout: 3 });
  } catch (thrown) {
    return none(redact(thrown instanceof Error ? thrown.message : String(thrown), password === undefined ? [] : [password]));
  }
  try {
    const q = (sql: string) => conn.driver.query(sql);
    const lit = (s: string): string => `'${s.replaceAll("'", "''")}'`;
    const me = (await q(`SELECT version() AS v, current_user AS u, coalesce((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), false) AS su, has_database_privilege(current_database(), 'CREATE') AS cdb`))[0];
    const tables = (await q(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ${lit(schema)}`)).map((r) => String(r["t"]));
    const exists = (await q(`SELECT 1 AS x FROM information_schema.schemata WHERE schema_name = ${lit(schema)}`)).length > 0;
    const there = new Set(tables);
    const models = modelNames.filter((m) => {
      const want = tablesOfModel(m);
      return want.size > 0 && [...want].every((t) => there.has(t));
    });
    const create = exists ? (await q(`SELECT has_schema_privilege(current_user, ${lit(schema)}, 'CREATE') AS ok`))[0]?.["ok"] === true : me?.["cdb"] === true;
    const superuser = me?.["su"] === true;
    return {
      reachable: true,
      version: String(me?.["v"]).split(" on ")[0] as string,
      user: String(me?.["u"]),
      superuser,
      level: superuser ? "migrate+guard" : create ? "migrate" : "read",
      arca: { schema, exists, tables: tables.length, models },
    };
  } catch (thrown) {
    return none(redact(thrown instanceof Error ? thrown.message : String(thrown), password === undefined ? [] : [password]));
  } finally {
    await conn.close().catch(() => undefined);
  }
}
