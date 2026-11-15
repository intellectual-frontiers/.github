/**
 * Data Vault (the library targets Data Vault 2.1; see the README for what of it is here) as functions: a hub, a satellite and a link are made for whatever names them, each a table whose type is worked out from
 * what it is given (commons 0009-sql-aide FR-048). A satellite belongs to a hub and a link joins hubs; giving either a table that is not
 * a hub does not compile.
 *
 * A hub holds the business key of one thing and nothing else; a satellite holds what is known of it at a moment, one row for each
 * change, never updated; a link holds that hubs are related. Every row says when it was loaded and where it came from.
 *
 * @module
 */
import {
  type Brand,
  type Column,
  type ColumnMap,
  type ColumnRef,
  fk,
  now,
  pk,
  type Referable,
  type Table,
  table,
  text,
  timestamptz,
} from "../sql-aide/mod.ts";

/** The columns every table of a vault has. */
export interface VaultColumns {
  /** When the row was loaded. */
  readonly load_at: Column<Date, false, "default">;
  /** Where the row came from: the system, file or feed. */
  readonly record_source: Column<string>;
}

const vaultColumns = (): VaultColumns => ({
  load_at: timestamptz().default(now).doc("When the row was loaded"),
  record_source: text().doc("Where the row came from: the system, file or feed"),
});

/** The name of a hub's table. */
export type HubTable<N extends string> = `hub_${N}`;
/** The name of a hub's key column. */
export type HubId<N extends string> = `hub_${N}_id`;
/** A key of a hub. */
export type HubKey<N extends string> = Brand<string, HubTable<N>>;

/** The columns of a hub: its key, its business key and the vault's columns. */
export type HubColumns<N extends string, BK> = { readonly [K in HubId<N>]: Column<string, false, "required", true> } & BK & VaultColumns;

/** A hub: the table of one thing's business key. */
export interface Hub<N extends string, BK> extends Table<HubTable<N>, HubColumns<N, BK>> {
  /** Says that this table is a hub. */
  readonly vault: "hub";
  /** The name of what the hub is a hub of. */
  readonly hubName: N;
  /** The hub's key column. */
  readonly id: ColumnRef<HubTable<N>, HubId<N>, HubKey<N>>;
}

/** What makes a table a hub, whatever it is a hub of: what a satellite and a link ask of what they are given. */
export interface AnyHub {
  /** Says that this table is a hub. */
  readonly vault: "hub";
  /** The name of what the hub is a hub of. */
  readonly hubName: string;
  /** The hub's key column. */
  readonly id: Referable<string>;
}

/**
 * Makes a hub.
 *
 * @param name - what the hub is a hub of (`customer`)
 * @param businessKey - the columns by which the business knows one of them; together they are unique
 * @example
 * const customer = hub("customer", { customer_number: text() });
 */
export function hub<const N extends string, const BK extends ColumnMap>(name: N, businessKey: BK): Hub<N, BK> {
  const idColumn = `hub_${name}_id`;
  const columns: ColumnMap = { [idColumn]: pk.ulid().doc(`The key of the ${name} in the vault`), ...businessKey, ...vaultColumns() };
  const made = table(`hub_${name}`, columns, {
    doc: `Hub: the business key of ${name}`,
    owner: "data-vault",
    unique: [Object.keys(businessKey)],
  });
  const id = made.c[idColumn];
  if (id === undefined) throw new Error(`hub ${name} has no key column`);
  // the columns are made from the hub's name, so their type is computed and the table made here cannot say it
  return { ...made, vault: "hub", hubName: name, id } as unknown as Hub<N, BK>;
}

/** The name of a satellite's table. */
export type SatelliteTable<HN extends string, N extends string> = `sat_${HN}_${N}`;

/** The columns of a satellite: its key, its hub's key, what it holds and the vault's columns. */
export type SatelliteColumns<HN extends string, N extends string, A> = {
  readonly [K in `sat_${HN}_${N}_id`]: Column<string, false, "required", true>;
} & { readonly [K in HubId<HN>]: Column<HubKey<HN>> } & A &
  VaultColumns;

/**
 * Makes a satellite of a hub: what is known of the hub's thing, one row for each time it changed.
 *
 * @param of - the hub; a table that is not a hub does not compile
 * @param name - what the satellite holds (`contact`)
 * @param attributes - its columns
 * @example
 * const customerContact = satellite(customer, "contact", { email: text().nullable() });
 */
export function satellite<HN extends string, BK, const N extends string, const A extends ColumnMap>(
  of: Hub<HN, BK>,
  name: N,
  attributes: A,
): Table<SatelliteTable<HN, N>, SatelliteColumns<HN, N, A>> {
  const columns: ColumnMap = {
    [`sat_${of.hubName}_${name}_id`]: pk.ulid().doc(`The key of this state of ${name}`),
    [`hub_${of.hubName}_id`]: fk(of.id).doc(`The ${of.hubName} this is known of`),
    ...attributes,
    ...vaultColumns(),
  };
  const made = table(`sat_${of.hubName}_${name}`, columns, {
    doc: `Satellite: the ${name} of ${of.hubName}, a row for each change`,
    owner: "data-vault",
  });
  // as in `hub`: the columns' names are computed from the names given
  return made as unknown as Table<SatelliteTable<HN, N>, SatelliteColumns<HN, N, A>>;
}

/** The name of a link's table. */
export type LinkTable<N extends string> = `link_${N}`;

/** The columns of a link: its key, the key of each hub it joins and the vault's columns. */
export type LinkColumns<N extends string, H> = { readonly [K in `link_${N}_id`]: Column<string, false, "required", true> } & {
  readonly [K in keyof H as H[K] extends { readonly hubName: infer HN extends string } ? HubId<HN> : never]: H[K] extends {
    readonly hubName: infer HN extends string;
  }
    ? Column<HubKey<HN>>
    : never;
} & VaultColumns;

/**
 * Makes a link: that the things of two or more hubs are related. The hubs' keys are unique together.
 *
 * @param name - what the relation is (`customer_order`)
 * @param hubs - the hubs joined, by any names; a table that is not a hub does not compile
 * @example
 * const customerOrder = link("customer_order", { customer, order });
 */
export function link<const N extends string, const H extends { readonly [role: string]: AnyHub }>(
  name: N,
  hubs: H,
): Table<LinkTable<N>, LinkColumns<N, H>> {
  const hubColumns = Object.values(hubs).map((h) => [`hub_${h.hubName}_id`, fk(h.id).doc(`The ${h.hubName} related`)] as const);
  const columns: ColumnMap = {
    [`link_${name}_id`]: pk.ulid().doc(`The key of this ${name}`),
    ...Object.fromEntries(hubColumns),
    ...vaultColumns(),
  };
  const made = table(`link_${name}`, columns, { doc: `Link: ${name}`, owner: "data-vault", unique: [hubColumns.map(([n]) => n)] });
  // as in `hub`: the columns' names are computed from the names given
  return made as unknown as Table<LinkTable<N>, LinkColumns<N, H>>;
}
