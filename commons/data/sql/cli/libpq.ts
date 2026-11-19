// Spec: 0047-arcactl-init FR-008, FR-009, FR-010
/**
 * The writers of the files libpq and `psql` read (commons data 0047-arcactl-init FR-008 to FR-010): `.pgpass` (the passwords), `pg_service.conf` (the instances: host, port, database, user, SSL) and
 * `.psqlrc` (the prompt, the settings and a few helper queries). Each is a managed block (0047 FR-002) planned as a change (FR-003), so what a person wrote in the file is untouched. They are
 * functions of their input and make nothing: the password is given to them and is written only to `.pgpass`, mode `0600`, which libpq ignores where the group or others can read it.
 *
 * @module
 */
import { chmodSync, existsSync, readFileSync, statSync } from "node:fs";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { blockOf, type BlockError } from "./blocks.ts";
import { type Change, type FileError, pgpassModeOk, planBlock } from "./files.ts";
import type { Paths } from "./workstation.ts";

// ---- what is given

/** An instance: what libpq's service file says of it, and what `arcactl` adds. */
export interface Instance {
  readonly name: string;
  readonly host?: string;
  readonly port?: number;
  readonly database?: string;
  readonly user?: string;
  /** `disable`, `allow`, `prefer`, `require`, `verify-ca` or `verify-full`. */
  readonly sslmode?: string;
  /** The schema the arca tables are in, which the service puts first on the search path. */
  readonly schema?: string;
}

/** A password for one place: each of host, port, database and user is exact or `*`. */
export interface Credential {
  readonly host: string;
  readonly port: string;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

/** The part of a credential that says where it is for. */
export type Key = Pick<Credential, "host" | "port" | "database" | "user">;

/** What is wrong with what a writer is given. */
export type WriteError =
  | { readonly kind: "invalid"; readonly what: string; readonly why: string }
  | { readonly kind: "conflict"; readonly service: string; readonly why: string }
  | { readonly kind: "block"; readonly path: string; readonly error: BlockError }
  | FileError;

const SSLMODES = ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"];
const NO_LINE = /[\r\n\0]/;
const bad = (what: string, why: string): WriteError => ({ kind: "invalid", what, why });

/** What is wrong with an instance, as a service. */
export function checkInstance(i: Instance): readonly WriteError[] {
  const out: WriteError[] = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(i.name)) out.push(bad("name", `${JSON.stringify(i.name)} is not letters, digits, dots, dashes and underscores`));
  for (const [k, v] of [["host", i.host], ["database", i.database], ["user", i.user]] as const)
    if (v !== undefined && (v === "" || NO_LINE.test(v) || v !== v.trim())) out.push(bad(k, `${JSON.stringify(v)} is empty, has a line ending or surrounding space`));
  if (i.port !== undefined && !(Number.isInteger(i.port) && i.port >= 1 && i.port <= 65535)) out.push(bad("port", `${String(i.port)} is not a port`));
  if (i.sslmode !== undefined && !SSLMODES.includes(i.sslmode)) out.push(bad("sslmode", `${i.sslmode} is not one of ${SSLMODES.join(", ")}`));
  if (i.schema !== undefined && !/^[a-z][a-z0-9_]{0,62}$/.test(i.schema)) out.push(bad("schema", `${JSON.stringify(i.schema)} is not a lower-case name`));
  return out;
}

/** What is wrong with a credential. */
export function checkCredential(c: Credential): readonly WriteError[] {
  const out: WriteError[] = [];
  for (const k of ["host", "port", "database", "user"] as const) if (c[k] === "" || NO_LINE.test(c[k])) out.push(bad(k, "it is empty or has a line ending"));
  if (c.port !== "*" && !/^\d{1,5}$/.test(c.port)) out.push(bad("port", `${JSON.stringify(c.port)} is not a port or *`));
  if (c.password === "" || NO_LINE.test(c.password)) out.push(bad("password", "it is empty or has a line ending, which `.pgpass` cannot hold"));
  return out;
}

// ---- .pgpass

/** A field as `.pgpass` holds it: a backslash and a colon are escaped, and a lone `*` is a wildcard. */
const field = (v: string): string => (v === "*" ? "*" : v.replaceAll("\\", "\\\\").replaceAll(":", "\\:"));

/** One line of `.pgpass`. */
export const pgpassLine = (c: Credential): string => [c.host, c.port, c.database, c.user, c.password].map((v, i) => (i === 4 ? v.replaceAll("\\", "\\\\").replaceAll(":", "\\:") : field(v))).join(":");

/** The fields of a line, with the escapes undone; none where it does not have five. */
export function splitPgpass(line: string): readonly string[] | undefined {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (ch === "\\" && i + 1 < line.length) cur += line[++i];
    else if (ch === ":") {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts.length === 5 ? parts : undefined;
}

/** The credentials in a text (the body of a block or a whole file); a comment and a blank line are skipped, and a line that is not one is returned apart. */
export function parsePgpass(text: string): { readonly credentials: readonly Credential[]; readonly other: readonly string[] } {
  const credentials: Credential[] = [];
  const other: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.startsWith("#")) continue;
    const f = splitPgpass(raw);
    if (f === undefined) other.push(raw);
    else credentials.push({ host: f[0] as string, port: f[1] as string, database: f[2] as string, user: f[3] as string, password: f[4] as string });
  }
  return { credentials, other };
}

const sameKey = (a: Key, b: Key): boolean => a.host === b.host && a.port === b.port && a.database === b.database && a.user === b.user;
/** Whether a credential's key says it is for a place, as libpq reads it: each field exact or `*`. */
const matches = (c: Key, place: Key): boolean => (["host", "port", "database", "user"] as const).every((k) => c[k] === "*" || c[k] === place[k]);

/** What a change of the credentials is: some set (a new password replaces the one for the same place), some removed. */
export interface PgpassChange {
  readonly set?: readonly Credential[];
  readonly remove?: readonly Key[];
}

/** What planning a writer gives: the changes, what a person should know, and a file's mode to put right. */
export interface Plan {
  readonly changes: readonly Change[];
  readonly warnings: readonly string[];
  /** A file that libpq would ignore for its mode, and the mode it is to have. */
  readonly modes: readonly { readonly path: string; readonly from: number; readonly to: number }[];
}

const readText = (path: string): string | undefined => {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
  } catch {
    return undefined;
  }
};

const lines = (text: string): readonly string[] => text.split(/\r?\n/);

/** The text of a file with the block `name` taken out, for what is outside it. */
function outside(text: string, name: string, style: "#" | "--"): string {
  const open = `${style} >>> arcactl:${name} >>>`;
  const close = `${style} <<< arcactl:${name} <<<`;
  const out: string[] = [];
  let inside = false;
  for (const l of lines(text)) {
    if (l.trimEnd() === open) inside = true;
    else if (l.trimEnd() === close) inside = false;
    else if (!inside) out.push(l);
  }
  return out.join("\n");
}

/**
 * Plans the change of `.pgpass`.
 *
 * @param paths - where the files are
 * @param change - the credentials to set and to remove
 * @returns the plan (the file at mode `0600`, a warning where a line of the person's own would be read first), or what is wrong
 */
export function planPgpass(paths: Paths, change: PgpassChange): Result<Plan, readonly WriteError[]> {
  const errors = (change.set ?? []).flatMap((c) => checkCredential(c));
  if (errors.length > 0) return err(errors);
  const text = readText(paths.pgpass) ?? "";
  const inside = blockOf(text, "credentials", "#");
  if (inside.kind === "err") return err([{ kind: "block", path: paths.pgpass, error: inside.error }]);
  const mine = parsePgpass(inside.value ?? "");
  if (mine.other.length > 0) return err([bad("credentials block", `it has a line that is not a credential: ${mine.other[0]?.replace(/:[^:]*$/, ":***")}`)]);
  // a password for a place that is there is replaced where it is, so that setting the same again changes nothing; a new place goes at the end
  const wanted = change.set ?? [];
  const kept = mine.credentials.filter((c) => !(change.remove ?? []).some((k) => sameKey(c, k))).map((c) => wanted.find((w) => sameKey(w, c)) ?? c);
  const creds = [...kept, ...wanted.filter((w) => !kept.some((c) => sameKey(c, w)))];
  const planned = planBlock(paths.pgpass, "credentials", "#", creds.length === 0 ? "absent" : { body: creds.map(pgpassLine).join("\n") }, 0o600);
  if (planned.kind === "err") return err([planned.error]);
  const warnings: string[] = [];
  const theirs = parsePgpass(outside(text, "credentials", "#")).credentials;
  for (const c of change.set ?? []) {
    const first = theirs.find((t) => matches(t, c));
    if (first !== undefined) warnings.push(`a line of your own in ${paths.pgpass} for ${first.host}:${first.port}:${first.database}:${first.user} comes before the one arcactl wrote, and libpq reads the first that matches`);
  }
  const modes: { path: string; from: number; to: number }[] = [];
  if (paths.platform !== "win32" && existsSync(planned.value.target)) {
    const mode = statSync(planned.value.target).mode & 0o777;
    if (!pgpassModeOk(mode)) modes.push({ path: planned.value.target, from: mode, to: 0o600 });
  }
  return ok({ changes: [planned.value], warnings, modes });
}

// ---- pg_service.conf

/** One service, as the lines of its section. */
export function serviceSection(i: Instance): string {
  const kv: [string, string][] = [];
  if (i.host !== undefined) kv.push(["host", i.host]);
  if (i.port !== undefined) kv.push(["port", String(i.port)]);
  if (i.database !== undefined) kv.push(["dbname", i.database]);
  if (i.user !== undefined) kv.push(["user", i.user]);
  if (i.sslmode !== undefined) kv.push(["sslmode", i.sslmode]);
  if (i.schema !== undefined) kv.push(["options", `-c search_path=${i.schema},public`]);
  return [`[${i.name}]`, ...kv.map(([k, v]) => `${k}=${v}`)].join("\n");
}

/** The services in a text: each `[name]` section and its settings. */
export function parseServices(text: string): readonly { readonly name: string; readonly settings: Readonly<Record<string, string>> }[] {
  const out: { name: string; settings: Record<string, string> }[] = [];
  for (const raw of lines(text)) {
    const l = raw.trim();
    if (l === "" || l.startsWith("#") || l.startsWith(";")) continue;
    const m = /^\[(.+)\]$/.exec(l);
    if (m !== null) out.push({ name: m[1] as string, settings: {} });
    else {
      const eq = l.indexOf("=");
      if (eq > 0 && out.length > 0) (out[out.length - 1] as { settings: Record<string, string> }).settings[l.slice(0, eq).trim()] = l.slice(eq + 1).trim();
    }
  }
  return out;
}

/** The instances `arcactl` has written to a service file, read back from its block. */
export function readInstances(paths: Paths): Result<readonly Instance[], readonly WriteError[]> {
  const text = readText(paths.pgServiceFile) ?? "";
  const body = blockOf(text, "services", "#");
  if (body.kind === "err") return err([{ kind: "block", path: paths.pgServiceFile, error: body.error }]);
  return ok(
    parseServices(body.value ?? "").map((s): Instance => {
      const schema = /search_path=([a-z][a-z0-9_]*),public/.exec(s.settings["options"] ?? "")?.[1];
      return {
        name: s.name,
        ...(s.settings["host"] === undefined ? {} : { host: s.settings["host"] }),
        ...(s.settings["port"] === undefined ? {} : { port: Number(s.settings["port"]) }),
        ...(s.settings["dbname"] === undefined ? {} : { database: s.settings["dbname"] }),
        ...(s.settings["user"] === undefined ? {} : { user: s.settings["user"] }),
        ...(s.settings["sslmode"] === undefined ? {} : { sslmode: s.settings["sslmode"] }),
        ...(schema === undefined ? {} : { schema }),
      };
    }),
  );
}

/**
 * Plans the service file for a set of instances: the block holds exactly these.
 *
 * @param paths - where the files are
 * @param instances - every instance `arcactl` is to write (none takes the block out)
 * @returns the plan, or what is wrong: an instance that is not valid, or one a person already defined outside the block (libpq reads the first, so the one `arcactl` wrote would be ignored)
 */
export function planServices(paths: Paths, instances: readonly Instance[]): Result<Plan, readonly WriteError[]> {
  const errors: WriteError[] = instances.flatMap((i) => checkInstance(i));
  const dup = instances.find((x, n) => instances.findIndex((y) => y.name === x.name) !== n);
  if (dup !== undefined) errors.push(bad("name", `${dup.name} is there twice`));
  const text = readText(paths.pgServiceFile) ?? "";
  const theirs = new Set(parseServices(outside(text, "services", "#")).map((s) => s.name));
  for (const i of instances) if (theirs.has(i.name)) errors.push({ kind: "conflict", service: i.name, why: `${i.name} is already a service in ${paths.pgServiceFile}, outside the block arcactl owns: rename one of them` });
  if (errors.length > 0) return err(errors);
  const planned = planBlock(paths.pgServiceFile, "services", "#", instances.length === 0 ? "absent" : { body: instances.map(serviceSection).join("\n\n") });
  return planned.kind === "err" ? err([planned.error]) : ok({ changes: [planned.value], warnings: [], modes: [] });
}

// ---- .psqlrc

/** The file of `psql` that `arcactl` owns: the prompt, the settings and the helper queries. It needs `psql` 15 or later, which has `\getenv`. */
export const psqlrcBody = (): string =>
  [
    "-- psql for arca instances: the prompt names the instance, and a few queries are one word away (:tables :invariants :guard :audit)",
    "\\set QUIET 1",
    "\\getenv arca_instance ARCA_INSTANCE",
    "\\getenv arca_env ARCA_ENV",
    "\\set PROMPT1 '%[%033[1m%]%:arca_instance:%[%033[0m%] %/%R%# '",
    "\\set PROMPT2 '%R> '",
    "\\x auto",
    "\\pset null '(null)'",
    "\\pset linestyle unicode",
    "\\pset border 1",
    "\\set HISTFILE ~/.psql_history- :DBNAME",
    "\\set HISTCONTROL ignoredups",
    "\\set COMP_KEYWORD_CASE upper",
    "\\set tables 'SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY 1;'",
    "\\set invariants 'SELECT c.relname AS \"table\", t.tgname AS trigger, t.tgenabled AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = current_schema()::regnamespace AND t.tgname LIKE ''inv\\\\_%'' ORDER BY 1, 2;'",
    "\\set guard 'SELECT evtname, evtenabled FROM pg_event_trigger WHERE evtname LIKE ''inv\\\\_guard\\\\_%'' OR evtname LIKE ''ifc\\\\_seal\\\\_guard\\\\_%'' ORDER BY 1;'",
    "\\set audit 'SELECT sequence, occurred_at, actor_kind, action, outcome FROM audit_event ORDER BY sequence DESC LIMIT 20;'",
    "\\unset QUIET",
  ].join("\n");

/** A path as `psql`'s `\i` reads it: forward slashes, which it takes on Windows too. */
const psqlPath = (p: string): string => p.replaceAll("\\", "/");

/**
 * Plans the `psql` files: the one `arcactl` owns, and a block in the person's `psqlrc` that includes it.
 *
 * @param paths - where the files are
 * @returns the plan
 */
export function planPsql(paths: Paths): Result<Plan, readonly WriteError[]> {
  const own = planBlock(paths.arcaPsqlrc, "psql", "--", { body: psqlrcBody() });
  if (own.kind === "err") return err([own.error]);
  const include = planBlock(paths.psqlrc, "psql", "--", { body: `\\i ${psqlPath(paths.arcaPsqlrc)}` });
  if (include.kind === "err") return err([include.error]);
  return ok({ changes: [own.value, include.value], warnings: [], modes: [] });
}

/** Plans taking away what the writers put in: the block of each file, and the credentials and services of `arcactl`. */
export function planUndo(paths: Paths): Result<Plan, readonly WriteError[]> {
  const changes: Change[] = [];
  const errors: WriteError[] = [];
  for (const [path, name, style] of [
    [paths.pgpass, "credentials", "#"],
    [paths.pgServiceFile, "services", "#"],
    [paths.psqlrc, "psql", "--"],
    [paths.arcaPsqlrc, "psql", "--"],
  ] as const) {
    const c = planBlock(path, name, style, "absent");
    if (c.kind === "err") errors.push(c.error);
    else changes.push(c.value);
  }
  return errors.length > 0 ? err(errors) : ok({ changes, warnings: [], modes: [] });
}

/** Puts right the mode of a password file that libpq would ignore. */
export function fixModes(plan: Plan): readonly string[] {
  const done: string[] = [];
  for (const m of plan.modes) {
    chmodSync(m.path, m.to);
    done.push(`${m.path}: ${m.from.toString(8)} to ${m.to.toString(8)}`);
  }
  return done;
}
