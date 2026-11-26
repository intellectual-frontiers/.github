// Spec: 0007-archon-observe-osquery FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * What a host is, as far as an order is concerned, said by osQuery and read as typed data. `queryPackFor` maps each kind of requirement to the tables of osQuery that say its state (one query for each table, the names
 * of the order in a literal list), `decodeRows` reads what `osqueryi --json` printed, strictly, and `observedFromRows` says, for each requirement, what is observed of it. Archon runs no query: the rows come from
 * another program (an ssh job, an outbound ssh command or a local run). `observedFromFacts` gives the same observed state for packages from the answer of a package manager, for a platform with no osQuery. Pure.
 *
 * @example
 * ```ts
 * import { queryPackFor, observedFromRows, decodeRows } from "./osquery.ts";
 * // queryPackFor(order, "debian") queries deb_packages; observedFromRows(order, new Map([["deb_packages", rows]])) is what is observed
 * ```
 *
 * @module
 */
import { array, err, formatDecodeError, json, ok, record, string, type Result } from "@intellectual-frontiers/core";
import { type JsonValue, type Requirement } from "@intellectual-frontiers/archon/governance";
import type { Order } from "./order.ts";
import { planOf, type Observed, type Plan } from "./state.ts";

/** The platform whose tables answer: the family of the Linux distribution, macOS or Windows. */
export type Platform = "debian" | "redhat" | "suse" | "alpine" | "macos" | "windows";
/** Every platform. */
export const PLATFORMS: readonly Platform[] = ["debian", "redhat", "suse", "alpine", "macos", "windows"];

/** One query of a pack: its name (the table it reads), the table and the SQL text. */
export type Query = { readonly name: string; readonly table: string; readonly sql: string };
/** The queries an order needs on a platform. */
export type QueryPack = { readonly platform: Platform; readonly queries: readonly Query[] };
/** One row osQuery returned: every value is a string. */
export type OsRow = Readonly<Record<string, string>>;
/** The rows of each query, by the table it read. */
export type OsRows = ReadonlyMap<string, readonly OsRow[]>;

const PACKAGE_TABLE: Readonly<Record<Platform, string>> = { debian: "deb_packages", redhat: "rpm_packages", suse: "rpm_packages", alpine: "apk_packages", macos: "homebrew_packages", windows: "programs" };

/** The tables that say the state of a service on each platform. */
const SERVICE_TABLE: Readonly<Record<Platform, string>> = { debian: "systemd_units", redhat: "systemd_units", suse: "systemd_units", alpine: "services", macos: "launchd", windows: "services" };

/** The characters a name that goes into a query may have: letters, digits and `_ . + : / @ \ ~ -` and the space. */
const SAFE = /^[A-Za-z0-9_.+:/@\\~ -]+$/u;

/** A name as a literal of SQL, or why it cannot be one: a character outside the closed set is refused, so that a requirement cannot inject text into a query. */
export function quoteName(name: string): Result<string, string> {
  return name !== "" && SAFE.test(name) ? ok(`'${name}'`) : err(`${JSON.stringify(name.slice(0, 40))} is not a name that may be put in a query: letters, digits and _ . + : / @ \\ ~ - and the space only`);
}

const isRecord = (v: JsonValue): v is { readonly [key: string]: JsonValue } => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: JsonValue | undefined): string | undefined => (typeof v === "string" ? v : undefined);

/** The name a requirement is looked for by in a table: the field of its desired state that names the resource. */
function nameOf(r: Requirement): string | undefined {
  if (!isRecord(r.desired)) return undefined;
  const d = r.desired;
  switch (r.kind) {
    case "file":
    case "directory":
      return text(d["path"]);
    case "system-setting":
      return text(d["registry"]) ?? text(d["name"]);
    default:
      return text(d["name"]);
  }
}

/** The table that says the state of a kind on a platform, and the column that holds the name; none for a kind that osQuery does not say. */
function tableFor(kind: string, platform: Platform, r: Requirement): { readonly table: string; readonly column: string } | undefined {
  switch (kind) {
    case "package":
      return { table: PACKAGE_TABLE[platform], column: "name" };
    case "user":
      return { table: "users", column: "username" };
    case "group":
      return { table: "groups", column: "groupname" };
    case "service":
      return { table: SERVICE_TABLE[platform], column: platform === "macos" ? "label" : platform === "windows" || platform === "alpine" ? "name" : "id" };
    case "file":
    case "directory":
      return { table: "file", column: "path" };
    case "sysctl":
      return { table: "system_controls", column: "name" };
    case "system-setting":
      return platform === "windows" && isRecord(r.desired) && typeof r.desired["registry"] === "string" ? { table: "registry", column: "path" } : undefined;
    default:
      return undefined;
  }
}

const COLUMNS: Readonly<Record<string, string>> = {
  deb_packages: "name, version, arch",
  rpm_packages: "name, version, release, arch",
  apk_packages: "name, version",
  homebrew_packages: "name, version",
  programs: "name, version",
  users: "username, uid, gid, shell, directory",
  groups: "groupname, gid",
  systemd_units: "id, active_state, sub_state, unit_file_state",
  services: "name, status, start_type",
  launchd: "label, run_at_load, program",
  file: "path, type, mode, uid, gid",
  system_controls: "name, current_value",
  registry: "path, name, data",
};

/** The queries an order needs on a platform: one for each table, with every name the order asks of it, in the order of the table names; or every name that cannot be put in a query. */
export function queryPackFor(order: Order, platform: Platform): Result<QueryPack, readonly string[]> {
  const names = new Map<string, { readonly column: string; readonly list: Set<string> }>();
  const problems: string[] = [];
  for (const r of order.requirements) {
    const t = tableFor(r.kind, platform, r);
    const name = nameOf(r);
    if (t === undefined || name === undefined) continue;
    const variants = r.kind === "service" && t.table === "systemd_units" && !name.includes(".") ? [name, `${name}.service`] : [name];
    const entry = names.get(t.table) ?? { column: t.column, list: new Set<string>() };
    for (const v of variants) {
      const q = quoteName(v);
      if (q.kind === "err") problems.push(`${r.id}: ${q.error}`);
      else entry.list.add(q.value);
    }
    names.set(t.table, entry);
  }
  if (problems.length > 0) return err(problems);
  const queries = [...names.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([table, e]): Query => ({ name: table, table, sql: `SELECT ${COLUMNS[table] ?? "*"} FROM ${table} WHERE ${e.column} IN (${[...e.list].sort().join(", ")});` }));
  return ok({ platform, queries });
}

/** The rows of what `osqueryi --json` printed, or why it is not that: an array of objects whose every value is a string, strictly. */
export function decodeRows(source: string): Result<readonly OsRow[], string> {
  const r = json(source, array(record(string)));
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

const same = (a: string | undefined, b: string | undefined): boolean => a === b;
/** A version without the epoch of Debian (`1:`) and, where the wanted one has no revision, without the revision (`-1ubuntu2`). */
function versionMatches(wanted: string, seen: string): boolean {
  if (wanted === seen) return true;
  const bare = seen.replace(/^\d+:/u, "");
  return bare === wanted || (!wanted.includes("-") && bare.replace(/-[^-]*$/u, "") === wanted);
}

function firstRow(rows: readonly OsRow[], column: string, names: readonly string[]): OsRow | undefined {
  return rows.find((row) => {
    const v = row[column];
    return v !== undefined && names.includes(v);
  });
}

function observedPackage(d: { readonly [key: string]: JsonValue }, row: OsRow): JsonValue {
  const wanted = text(d["version"]);
  const seen = row["version"];
  if (wanted === undefined || seen === undefined || versionMatches(wanted, seen)) return d;
  return { ...d, version: seen };
}

function mode(m: string | undefined): string | undefined {
  return m === undefined ? undefined : m.replace(/^0+(?=\d)/u, "");
}

/** The state observed of one requirement from the rows of its table: the desired state itself where every field the order names is as the row says, the desired state with the fields that differ where not, nothing where no row names it. */
function observedOf(r: Requirement, rows: OsRows, platform: Platform | undefined): JsonValue | undefined {
  if (!isRecord(r.desired)) return undefined;
  const d = r.desired;
  const name = nameOf(r);
  if (name === undefined) return undefined;
  const find = (table: string, column: string, names: readonly string[] = [name]): OsRow | undefined => firstRow(rows.get(table) ?? [], column, names);
  switch (r.kind) {
    case "package": {
      const table = ["deb_packages", "rpm_packages", "apk_packages", "homebrew_packages", "programs"].find((t) => rows.has(t) && (platform === undefined || PACKAGE_TABLE[platform] === t));
      const row = table === undefined ? undefined : find(table, "name");
      return row === undefined ? undefined : observedPackage(d, row);
    }
    case "user": {
      const row = find("users", "username");
      if (row === undefined) return undefined;
      const out: { [key: string]: JsonValue } = { ...d };
      for (const [field, column] of [["uid", "uid"], ["shell", "shell"], ["home", "directory"]] as const) {
        const want = d[field];
        const seen = row[column];
        if (want !== undefined && seen !== undefined && !same(String(want), seen)) out[field] = field === "uid" && !Number.isNaN(Number(seen)) ? Number(seen) : seen;
      }
      return out;
    }
    case "group": {
      const row = find("groups", "groupname");
      if (row === undefined) return undefined;
      const want = d["gid"];
      const seen = row["gid"];
      return want !== undefined && seen !== undefined && !same(String(want), seen) ? { ...d, gid: Number.isNaN(Number(seen)) ? seen : Number(seen) } : d;
    }
    case "service": {
      const table = rows.has("systemd_units") ? "systemd_units" : rows.has("launchd") ? "launchd" : "services";
      const column = table === "systemd_units" ? "id" : table === "launchd" ? "label" : "name";
      const row = find(table, column, [name, `${name}.service`]);
      if (row === undefined) return undefined;
      const out: { [key: string]: JsonValue } = { ...d };
      const running = table === "systemd_units" ? row["active_state"] === "active" : table === "services" ? (row["status"] ?? "").toUpperCase() === "RUNNING" : undefined;
      if (typeof d["running"] === "boolean" && running !== undefined && d["running"] !== running) out["running"] = running;
      const enabled = table === "systemd_units" ? row["unit_file_state"] === "enabled" : table === "launchd" ? row["run_at_load"] === "1" : (row["start_type"] ?? "").toUpperCase() === "AUTO_START";
      if (typeof d["enabled"] === "boolean" && d["enabled"] !== enabled) out["enabled"] = enabled;
      return out;
    }
    case "file":
    case "directory": {
      const row = find("file", "path");
      if (row === undefined) return undefined;
      const out: { [key: string]: JsonValue } = { ...d };
      const type = r.kind === "directory" ? "directory" : "regular";
      if (row["type"] !== undefined && row["type"] !== type) return { ...d, path: name, type: row["type"] };
      const want = text(d["mode"]);
      if (want !== undefined && row["mode"] !== undefined && mode(want) !== mode(row["mode"])) out["mode"] = row["mode"];
      return out;
    }
    case "sysctl": {
      const row = find("system_controls", "name");
      if (row === undefined) return undefined;
      const want = d["value"];
      const seen = row["current_value"];
      return want !== undefined && seen !== undefined && String(want) !== seen ? { ...d, value: typeof want === "number" && !Number.isNaN(Number(seen)) ? Number(seen) : seen } : d;
    }
    case "system-setting": {
      const row = find("registry", "path");
      if (row === undefined) return undefined;
      const want = d["value"];
      const seen = row["data"];
      return want !== undefined && seen !== undefined && String(want) !== seen ? { ...d, value: seen } : d;
    }
    default:
      return undefined;
  }
}

/** What is observed of each requirement of the order, from the rows osQuery returned: a requirement no row names has no entry, so a requirement that must be absent and has no row is converged. */
export function observedFromRows(order: Order, rows: OsRows, platform?: Platform): Observed {
  const out = new Map<Requirement["id"], JsonValue>();
  for (const r of order.requirements) {
    const v = observedOf(r, rows, platform);
    if (v !== undefined) out.set(r.id, v);
  }
  return out;
}

/** The drift of an order: the plan of the order against what osQuery says, the same plan and the same hash the reconcile loop makes. */
export function driftOf(order: Order, rows: OsRows, platform?: Platform): Plan {
  return planOf(order, observedFromRows(order, rows, platform));
}

/** What a package manager's own query says of an installed package. */
export type InstalledPackage = { readonly name: string; readonly version: string };

/** The observed state of the packages of an order from the answer of a package manager (the fallback for a platform with no osQuery): the same state `observedFromRows` gives from a table of packages. */
export function observedFromFacts(order: Order, installed: readonly InstalledPackage[]): Observed {
  const rows: OsRow[] = installed.map((p) => ({ name: p.name, version: p.version }));
  return observedFromRows({ ...order, requirements: order.requirements.filter((r) => r.kind === "package") }, new Map([["deb_packages", rows]]));
}
