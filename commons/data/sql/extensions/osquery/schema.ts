// Spec: 0058-sql-osquery FR-001, FR-002, FR-003
/**
 * The machine facts of osquery as a schema (commons data 0058-sql-osquery): the published schema of one version of osquery, read as a value and imported through the live-database path (0055) into a logical schema, so that it is
 * never written by hand. Each table says on which platforms it exists and whether it is evented, each column says if it is hidden, required or an index and on which platforms it exists, the columns that hold personal data are
 * marked (`classify.ts`), and the schema is stamped with the version of osquery it describes.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { annotate, annotationKind, vocabularies } from "@intellectual-frontiers/data/governance";
import { adopt, type AdoptError } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Column, LogicalSchema, Table } from "@intellectual-frontiers/data/sql/logical";
import type { Observed } from "@intellectual-frontiers/data/sql/physical";
import { classify } from "./classify.ts";

/** The platforms osquery runs on, as this library names them. */
export type Platform = "linux" | "darwin" | "windows";
export const PLATFORMS: readonly Platform[] = ["linux", "darwin", "windows"];

/** The types of an osquery column. */
export type OsqueryType = "text" | "integer" | "bigint" | "unsigned_bigint" | "double" | "blob";

/** A column as osquery publishes it. */
export interface OsqueryColumn {
  readonly name: string;
  readonly description: string;
  readonly type: OsqueryType;
  readonly hidden: boolean;
  readonly required: boolean;
  readonly index: boolean;
  /** Where it exists, where that is fewer places than its table. */
  readonly platforms?: readonly Platform[];
}

/** A table as osquery publishes it. */
export interface OsqueryTable {
  readonly name: string;
  readonly description: string;
  readonly platforms: readonly Platform[];
  readonly evented: boolean;
  readonly cacheable: boolean;
  readonly columns: readonly OsqueryColumn[];
}

/** The published schema of one version of osquery. */
export interface OsquerySchema {
  readonly version: string;
  readonly source: { readonly repository: string; readonly commit: string; readonly path: string; readonly sha256: string; readonly license: string };
  readonly tables: readonly OsqueryTable[];
}

/** Where the library's own annotations of osquery are written: `osquery.version` on the schema, `osquery.platforms` and `osquery.evented` on a table, `osquery.column` on a column. */
export const osquery = {
  version: annotationKind<string>("osquery.version", ["domain"]),
  platforms: annotationKind<readonly Platform[]>("osquery.platforms", ["concept", "attribute"]),
  evented: annotationKind<boolean>("osquery.evented", ["concept"]),
  column: annotationKind<{ readonly hidden: boolean; readonly required: boolean; readonly index: boolean }>("osquery.column", ["attribute"]),
} as const;

const platformOf = (p: string): Platform | undefined => (p === "linux" ? "linux" : p === "darwin" ? "darwin" : p === "windows" || p === "win32" || p === "cygwin" ? "windows" : undefined);
const platformsOf = (xs: readonly string[]): readonly Platform[] => [...new Set(xs.flatMap((x) => platformOf(x) ?? []))].toSorted();
const TYPES: ReadonlySet<string> = new Set<OsqueryType>(["text", "integer", "bigint", "unsigned_bigint", "double", "blob"]);

/**
 * Reads the published schema file (the trimmed JSON of `tools/osquery-schema.ts`) into a value, or says what is wrong with it.
 *
 * @param json - the parsed file
 */
export function readSchema(json: unknown): Result<OsquerySchema, string> {
  const o = json as { osquery?: unknown; source?: Record<string, unknown>; tables?: unknown };
  if (typeof o?.osquery !== "string" || o.source === undefined || !Array.isArray(o.tables)) return err("not a published osquery schema: it needs `osquery` (the version), `source` and `tables`");
  const tables: OsqueryTable[] = [];
  for (const t of o.tables as Record<string, unknown>[]) {
    const name = String(t["name"]);
    const columns = (t["columns"] as Record<string, unknown>[] | undefined) ?? [];
    for (const c of columns) if (!TYPES.has(String(c["type"]))) return err(`table ${name}: column ${String(c["name"])} has the type ${String(c["type"])}, which osquery's schema does not have`);
    tables.push({
      name,
      description: String(t["description"] ?? ""),
      platforms: platformsOf((t["platforms"] as string[] | undefined) ?? []),
      evented: t["evented"] === true,
      cacheable: t["cacheable"] === true,
      columns: columns.map((c): OsqueryColumn => ({
        name: String(c["name"]),
        description: String(c["description"] ?? ""),
        type: String(c["type"]) as OsqueryType,
        hidden: c["hidden"] === true,
        required: c["required"] === true,
        index: c["index"] === true,
        ...(Array.isArray(c["platforms"]) ? { platforms: platformsOf(c["platforms"] as string[]) } : {}),
      })),
    });
  }
  const s = o.source;
  return ok({ version: o.osquery, source: { repository: String(s["repository"]), commit: String(s["commit"]), path: String(s["path"]), sha256: String(s["sha256"]), license: String(s["license"]) }, tables });
}

const SQL_TYPE: Readonly<Record<OsqueryType, string>> = { text: "text", integer: "integer", bigint: "bigint", unsigned_bigint: "bigint", double: "double precision", blob: "blob" };

/** The schema as what a database holds (0055): the tables with their columns as osquery types them, and no key, since osquery has none. A table is left out where it does not exist on the platform asked for. */
export function toObserved(schema: OsquerySchema, platform?: Platform): Observed {
  return {
    dialect: "osquery",
    tables: schema.tables
      .filter((t) => platform === undefined || t.platforms.includes(platform))
      .map((t) => ({
        name: t.name,
        columns: t.columns.filter((c) => platform === undefined || c.platforms === undefined || c.platforms.includes(platform)).map((c) => ({ name: c.name, type: SQL_TYPE[c.type], nullable: true })),
        primaryKey: [],
        uniques: [],
        foreignKeys: [],
        indexes: [],
      })),
  };
}

/**
 * The logical schema of a version of osquery, made through `adopt` and not by hand: names and types come from the published schema, each table is annotated with its platforms and whether it is evented, each column with
 * whether it is hidden, required or an index, and each column that holds personal data with its category and what it is held for; the schema is stamped with the version.
 *
 * @param schema - the published schema
 * @param platform - leave out what does not exist on this platform; every platform where not given
 */
export function importSchema(schema: OsquerySchema, platform?: Platform): Result<LogicalSchema, readonly AdoptError[]> {
  const adopted = adopt(toObserved(schema, platform), `osquery-${schema.version}`);
  if (adopted.kind === "err") return adopted;
  const byTable = new Map(schema.tables.map((t) => [t.name, t]));
  const tables = adopted.value.tables.map((t): Table => {
    const name = t.name.join("_");
    const published = byTable.get(name);
    if (published === undefined) return t;
    const columns = t.columns.map((col): Column => {
      const pc = published.columns.find((x) => x.name === col.name.join("_"));
      if (pc === undefined) return col;
      const personal = classify(name, pc.name);
      return {
        ...col,
        comment: pc.description,
        governance: [
          annotate(osquery.column, { hidden: pc.hidden, required: pc.required, index: pc.index }),
          ...(pc.platforms === undefined ? [] : [annotate(osquery.platforms, pc.platforms)]),
          ...(personal === undefined ? [] : [annotate(vocabularies.privacy.personal, { category: personal.category, purposes: personal.purposes })]),
        ],
      };
    });
    return { ...t, comment: published.description, columns, governance: [annotate(osquery.platforms, published.platforms), annotate(osquery.evented, published.evented)] };
  });
  return ok({ ...adopted.value, comment: `The machine facts of osquery ${schema.version}`, tables, governance: [annotate(osquery.version, schema.version)] });
}
