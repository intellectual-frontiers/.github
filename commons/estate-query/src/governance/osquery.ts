// Spec: 0005-estate-query-live FR-001
/**
 * The tables of osquery that a question over the live fleet may name, as data: each is an allow-list of the columns that may be read, so that the text sent to a machine is made here from these names and never from what a person wrote. A table is added by a change to this list and a review. What can hold a secret
 * (a command line, an environment) is not here; what makes a request or writes a file is not here either.
 *
 * @example
 * ```ts
 * import { OSQUERY_TABLES, osqueryRelation } from "./osquery.ts";
 * osqueryRelation("processes")?.name; // "osquery_processes"
 * ```
 *
 * @module
 */
import type { Column, ColumnType, Relation } from "./relations.ts";

/** A table of osquery that may be read. */
export type OsqueryTable = { readonly table: string; readonly summary: string; readonly columns: readonly (readonly [string, ColumnType])[] };

const t = (table: string, summary: string, columns: readonly (readonly [string, ColumnType])[]): OsqueryTable => ({ table, summary, columns });

/** Every table that may be read, in the order `query tables` lists them. */
export const OSQUERY_TABLES: readonly OsqueryTable[] = [
  t("os_version", "The operating system.", [["name", "text"], ["version", "text"], ["major", "int"], ["minor", "int"], ["patch", "int"], ["platform", "text"], ["codename", "text"], ["arch", "text"]]),
  t("system_info", "The machine: host name, processor, memory and hardware.", [["hostname", "text"], ["cpu_brand", "text"], ["cpu_physical_cores", "int"], ["cpu_logical_cores", "int"], ["physical_memory", "int"], ["hardware_vendor", "text"], ["hardware_model", "text"], ["computer_name", "text"]]),
  t("kernel_info", "The running kernel.", [["version", "text"], ["path", "text"], ["device", "text"]]),
  t("processes", "The processes that run.", [["pid", "int"], ["name", "text"], ["path", "text"], ["state", "text"], ["uid", "int"], ["gid", "int"], ["parent", "int"]]),
  t("listening_ports", "The ports that listen.", [["pid", "int"], ["port", "int"], ["protocol", "int"], ["family", "int"], ["address", "text"]]),
  t("users", "The accounts of the machine.", [["uid", "int"], ["gid", "int"], ["username", "text"], ["description", "text"], ["directory", "text"], ["shell", "text"]]),
  t("groups", "The groups of the machine.", [["gid", "int"], ["groupname", "text"]]),
  t("deb_packages", "The packages of a Debian family machine.", [["name", "text"], ["version", "text"], ["arch", "text"], ["source", "text"], ["status", "text"]]),
  t("rpm_packages", "The packages of an RPM family machine.", [["name", "text"], ["version", "text"], ["release", "text"], ["arch", "text"], ["source", "text"]]),
  t("mounts", "The file systems mounted.", [["device", "text"], ["path", "text"], ["type", "text"], ["flags", "text"]]),
  t("uptime", "How long the machine has been up.", [["days", "int"], ["hours", "int"], ["minutes", "int"], ["seconds", "int"], ["total_seconds", "int"]]),
  t("load_average", "The load average of the last 1, 5 and 15 minutes.", [["period", "text"], ["average", "text"]]),
  t("memory_info", "The memory of the machine in bytes.", [["memory_total", "int"], ["memory_free", "int"], ["memory_available", "int"], ["buffers", "int"], ["cached", "int"], ["swap_total", "int"], ["swap_free", "int"]]),
  t("cpu_time", "The time each core spent in each mode, in ticks.", [["core", "int"], ["user", "int"], ["nice", "int"], ["system", "int"], ["idle", "int"], ["iowait", "int"], ["irq", "int"], ["softirq", "int"], ["steal", "int"]]),
  t("interface_details", "The network interfaces and their counters.", [["interface", "text"], ["mac", "text"], ["type", "int"], ["mtu", "int"], ["ibytes", "int"], ["obytes", "int"], ["ipackets", "int"], ["opackets", "int"], ["ierrors", "int"], ["oerrors", "int"]]),
];

/** The prefix of the relation of an osquery table. */
export const OSQUERY_PREFIX = "osquery_";

/** The relation of a table, with the columns that say which machine and when added in front, as a question sees it. */
export function osqueryRelation(table: string): Relation | undefined {
  const o = OSQUERY_TABLES.find((x) => x.table === table);
  if (o === undefined) return undefined;
  const lead: readonly Column[] = [{ name: "asset", type: "text", summary: "The asset the row is of." }, { name: "observed_at", type: "timestamp", summary: "When the row was read." }];
  return { name: `${OSQUERY_PREFIX}${o.table}`, summary: `${o.summary} (live: asked of each machine that is enrolled, read only, when the question is asked.)`, columns: [...lead, ...o.columns.map(([name, type]): Column => ({ name, type, summary: `The column ${name} of the osquery table ${o.table}.` }))] };
}

/** The relation that says, for each machine and table asked, whether it answered. */
export const LIVE_STATUS: Relation = {
  name: "live_status",
  summary: "For each machine and each live table a question named: whether it answered, how many rows, and why not where it did not (so that a machine that did not answer is never read as a machine with no rows).",
  columns: [{ name: "asset", type: "text", summary: "The asset." }, { name: "tbl", type: "text", summary: "The osquery table." }, { name: "answered", type: "bool", summary: "Whether the machine answered." }, { name: "row_count", type: "int", summary: "The rows it gave." }, { name: "message", type: "text", summary: "Why it did not answer; empty where it did." }, { name: "at", type: "timestamp", summary: "When it was asked." }],
};

/** The tables of osquery the question names (a table named `osquery_<name>` that may be read), in order and once each; a name with the prefix that is not on the list is not one. */
export function osqueryTablesNamed(sql: string): readonly string[] {
  const code = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""').replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  const found: string[] = [];
  for (const m of code.matchAll(/\bosquery_([a-z_]+)\b/gi)) {
    const name = (m[1] ?? "").toLowerCase();
    if (OSQUERY_TABLES.some((x) => x.table === name) && !found.includes(name)) found.push(name);
  }
  return found;
}

/** The SELECT sent to a machine for a table: the columns of the list and a limit, made from the list alone. */
export function osquerySelect(table: string, limit: number): string | undefined {
  const o = OSQUERY_TABLES.find((x) => x.table === table);
  if (o === undefined || !Number.isInteger(limit) || limit < 1 || limit > 100_000) return undefined;
  return `SELECT ${o.columns.map(([c]) => c).join(", ")} FROM ${o.table} LIMIT ${limit}`;
}
