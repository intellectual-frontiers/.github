/**
 * Loads of a vault: statements that put what a landing relation holds into hubs, satellites and links, and only insert (commons
 * 0009-sql-aide FR-048). Run twice, a load changes nothing; a satellite gains a row only where what it holds of a key has changed.
 *
 * A hub's key is its business key as text (the columns of a business key of more than one joined by `|`), so that the same business key
 * has the same key in every engine and in every load; a satellite's key is its hub's key with the number of the state; a link's key is
 * the keys of its hubs joined by `~`. Data Vault 2.0's hash keys are not made (open question OQ-3 of the specification).
 *
 * @module
 */
import {
  type AnySql,
  bind,
  byDialect,
  join,
  type LineageEdge,
  name,
  raw,
  type RowOf,
  type SelectRow,
  type Sql,
  SQL,
  type TableSpec,
} from "../sql-aide/mod.ts";
import type { AnyHub, Hub, HubId, HubTable, VaultColumns } from "./vault.ts";

/** A load of one table of a vault: its statement and its lineage. */
export interface VaultLoad {
  /** The load's name: `load_` and the table's. */
  readonly name: string;
  /** The statement: an insert of what is not there yet. */
  readonly sql: Sql<"statement", unknown, never, "postgres" | "sqlite" | "duckdb">;
  /** From the landing relation to the table loaded (FR-028). */
  readonly lineage: () => readonly LineageEdge[];
}

/** What a vault's loads read: a relation, with the name it is known by in lineage. */
type Landing<Row> = Sql<"relation", Row, string, string> & { readonly name: string; readonly schema: string | undefined };

const keyName = (e: { readonly name: string; readonly schema: string | undefined }): string => `${e.schema ?? ""}.${e.name}`;

/** A column of the row aliased `alias`. */
const at = (alias: string, column: string): AnySql => SQL`${raw(`${alias}.`)}${name(column)}`;

/** The key a hub gives a business key read from the row aliased `alias`. */
function hubKey(hub: { readonly spec: TableSpec; readonly hubName: string }, alias: string): AnySql {
  const parts = businessKey(hub).map((c) => SQL`CAST(${at(alias, c)} AS TEXT)`);
  return join(parts, " || '|' || ");
}

/** The columns of a hub's business key. */
function businessKey(hub: { readonly spec: TableSpec; readonly hubName: string }): readonly string[] {
  const own = new Set([`hub_${hub.hubName}_id`, "load_at", "record_source"]);
  return hub.spec.columns.map(([n]) => n).filter((n) => !own.has(n));
}

const edge = (via: string, from: Landing<unknown>, to: { readonly name: string; readonly schema: string | undefined }): LineageEdge => ({
  via,
  kind: "load",
  from: keyName(from),
  to: keyName(to),
});

/**
 * Loads a hub: each business key the landing relation holds that the hub does not, once.
 *
 * @param hub - the hub
 * @param from - the landing relation, whose rows give the hub's business key under the same names
 * @param recordSource - where the rows came from
 * @example
 * loadHub(customer, customerFeed, "crm");
 */
export function loadHub<N extends string, BK, Row extends SelectRow<HubTable<N>, BK>>(
  hub: Hub<N, BK>,
  from: Landing<Row>,
  recordSource: string,
): VaultLoad {
  const bk = businessKey(hub);
  const same = join(
    bk.map((c) => SQL`${at("h", c)} = ${at("l", c)}`),
    " AND ",
  );
  const sql = SQL`
    INSERT INTO ${hub} (${name(`hub_${hub.hubName}_id`)}, ${join(bk.map((c) => name(c)))}, ${name("record_source")})
    SELECT DISTINCT ${hubKey(hub, "l")}, ${join(bk.map((c) => at("l", c)))}, ${bind(recordSource)} FROM ${from} AS l
    WHERE NOT EXISTS (SELECT 1 FROM ${hub} AS h WHERE ${same});`;
  return { name: `load_${hub.name}`, sql: asStatement(sql), lineage: () => [edge(`load_${hub.name}`, from, hub)] };
}

/** The columns a satellite holds of its hub's thing: all but its key, its hub's key and the vault's columns. */
export type SatelliteAttributes<S, HN extends string> = S extends { readonly name: infer SN extends string }
  ? Omit<RowOf<S>, keyof VaultColumns | HubId<HN> | `${SN}_id`>
  : never;

const pad = (n: AnySql): AnySql =>
  byDialect({
    postgres: SQL`lpad(CAST(${n} AS TEXT), 9, '0')`,
    duckdb: SQL`lpad(CAST(${n} AS TEXT), 9, '0')`,
    sqlite: SQL`printf('%09d', ${n})`,
  });

/**
 * Loads a satellite: for each business key the landing relation holds, a row of what the satellite holds of it, where the satellite's
 * latest row of that key holds something else or there is none. Its hub must be loaded first. The landing relation should hold one state
 * of a key in one load.
 *
 * @param hub - the satellite's hub
 * @param sat - the satellite; one of another hub does not compile
 * @param from - the landing relation, whose rows give the hub's business key and the satellite's columns under the same names
 * @param recordSource - where the rows came from
 */
export function loadSatellite<
  HN extends string,
  BK,
  S extends Sql<"relation", unknown, string, string> & {
    readonly name: string;
    readonly schema: string | undefined;
    readonly spec: TableSpec;
    readonly c: { readonly [K in HubId<HN>]: unknown };
  },
  Row extends SelectRow<HubTable<HN>, BK> & SatelliteAttributes<S, HN>,
>(hub: Hub<HN, BK>, sat: S, from: Landing<Row>, recordSource: string): VaultLoad {
  const hubId = `hub_${hub.hubName}_id`;
  const satId = `${sat.name}_id`;
  if (!sat.spec.columns.some(([n]) => n === hubId)) throw new Error(`${sat.name} is not a satellite of ${hub.name}`);
  const own = new Set([satId, hubId, "load_at", "record_source"]);
  const attributes = sat.spec.columns.map(([n]) => n).filter((n) => !own.has(n));
  const bk = businessKey(hub);
  const key = hubKey(hub, "l");
  const unchanged = join(
    attributes.map((c) => SQL`${at("s", c)} IS NOT DISTINCT FROM ${at("l", c)}`),
    " AND ",
  );
  const sql = SQL`
    INSERT INTO ${sat} (${name(satId)}, ${name(hubId)}, ${join(attributes.map((c) => name(c)))}, ${name("record_source")})
    SELECT ${key} || '#' || ${pad(SQL`(SELECT count(*) FROM ${sat} AS c WHERE ${at("c", hubId)} = ${key}) + 1`)}, ${key}, ${join(attributes.map((c) => at("l", c)))}, ${bind(recordSource)}
    FROM (SELECT DISTINCT ${join([...bk, ...attributes].map((c) => at("f", c)))} FROM ${from} AS f) AS l
    WHERE NOT EXISTS (
        SELECT 1 FROM ${sat} AS s
        WHERE ${at("s", hubId)} = ${key}
          AND ${at("s", satId)} = (SELECT max(${at("m", satId)}) FROM ${sat} AS m WHERE ${at("m", hubId)} = ${key})
          AND ${attributes.length === 0 ? raw("TRUE") : unchanged});`;
  return { name: `load_${sat.name}`, sql: asStatement(sql), lineage: () => [edge(`load_${sat.name}`, from, sat)] };
}

type UnionToIntersection<U> = (U extends unknown ? (u: U) => void : never) extends (i: infer I) => void ? I : never;

/** The rows a link's landing relation gives: the business keys of all its hubs. */
export type LinkInput<H> = UnionToIntersection<
  { [K in keyof H]: H[K] extends Hub<infer HN, infer BK> ? SelectRow<HubTable<HN>, BK> : never }[keyof H]
>;

/**
 * Loads a link: for each combination of business keys the landing relation holds, a row relating their hubs, where there is none. The
 * hubs must be loaded first, and their business keys' columns must have names no two of them share.
 *
 * @param link - the link
 * @param hubs - the hubs it joins, as it was made with them
 * @param from - the landing relation, whose rows give each hub's business key under the same names
 * @param recordSource - where the rows came from
 */
export function loadLink<H extends { readonly [role: string]: AnyHub & { readonly spec: TableSpec } }, Row extends LinkInput<H>>(
  link: Sql<"relation", unknown, string, string> & { readonly name: string; readonly schema: string | undefined; readonly spec: TableSpec },
  hubs: H,
  from: Landing<Row>,
  recordSource: string,
): VaultLoad {
  const list = Object.values(hubs);
  for (const h of list)
    if (!link.spec.columns.some(([n]) => n === `hub_${h.hubName}_id`)) throw new Error(`${link.name} does not join hub_${h.hubName}`);
  const ids = list.map((h) => `hub_${h.hubName}_id`);
  const keys = list.map((h) => hubKey(h, "l"));
  const same = join(
    ids.map((id, i) => SQL`${at("k", id)} = ${keys[i] ?? raw("NULL")}`),
    " AND ",
  );
  const sql = SQL`
    INSERT INTO ${link} (${name(`${link.name}_id`)}, ${join(ids.map((id) => name(id)))}, ${name("record_source")})
    SELECT DISTINCT ${join(keys, " || '~' || ")}, ${join(keys)}, ${bind(recordSource)} FROM ${from} AS l
    WHERE NOT EXISTS (SELECT 1 FROM ${link} AS k WHERE ${same});`;
  return { name: `load_${link.name}`, sql: asStatement(sql), lineage: () => [edge(`load_${link.name}`, from, link)] };
}

function asStatement(p: AnySql): Sql<"statement", unknown, never, "postgres" | "sqlite" | "duckdb"> {
  // the loads' SQL is written for the three dialects, and the padding has a case for each
  return p as unknown as Sql<"statement", unknown, never, "postgres" | "sqlite" | "duckdb">;
}
