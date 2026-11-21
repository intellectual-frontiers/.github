// Spec: 0004-query-safety FR-001, FR-002, FR-006
/**
 * What a query is run with (commons anyfs-query 0004-query-safety FR-001, FR-002, FR-006): the way a place named in a query becomes a store, the consent each place is given, the budget, the clock, the paths that
 * are never read, and an optional index of listings. Nothing here is ambient: a query reaches the places the context gives it and no other.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Budget, type Consent, DEFAULT_BUDGET } from "@intellectual-frontiers/anyfs-query/governance";
import { type Path, type Prefix, parsePrefix } from "@intellectual-frontiers/anyfs/governance";
import type { AnyStore, Stat } from "@intellectual-frontiers/anyfs/logical";

/** A place named in a query, resolved: the store, the prefix in it where the query starts, and the name the place is called in the results. */
export type Resolved = { readonly place: string; readonly store: AnyStore; readonly prefix: Prefix };

/** How a place named in a query becomes a store, or why it cannot. */
export type Resolver = (place: string) => Result<Resolved, string>;

/** What the table `places` says of a place. */
export type PlaceInfo = { readonly uri: string; readonly kind: string; readonly capabilities: readonly string[]; readonly consistency: string; readonly maxObject?: number };

/** A catalog of listings: what it knows of a place below a prefix, or nothing where it does not know. */
export type Index = { list(place: string, prefix: Prefix): Promise<readonly Stat[] | undefined> };

/** The time, in milliseconds. */
export type QueryClock = { now(): number };

/** What a query is run with. */
export type QueryContext = {
  readonly resolve: Resolver;
  /** What a query may do at a place. */
  readonly consent: (place: string) => Consent;
  /** The place a table without one reads from. */
  readonly defaultPlace?: string;
  /** The places `places` lists. */
  readonly places?: readonly PlaceInfo[];
  /** The objects that are never read, whatever the consent: their text is not known. */
  readonly redacted?: (place: string, path: Path) => boolean;
  readonly index?: Index;
  readonly budget?: Partial<Budget>;
  readonly clock: QueryClock;
};

/** The budget of a context, over the default. */
export const budgetOf = (ctx: QueryContext): Budget => ({ ...DEFAULT_BUDGET, ...ctx.budget });

/** A store that is mounted by name. */
export type NamedStore = { readonly store: AnyStore; readonly consent?: Consent };

/** A resolver and a consent of stores by name: `fleet:/machines` is the store named `fleet` and the prefix `machines`; the places `places` lists are the names. */
export function mountTable(stores: Readonly<Record<string, NamedStore>>, open?: (place: string) => Result<Resolved, string>): Pick<QueryContext, "resolve" | "consent" | "places"> {
  return {
    resolve(place) {
      const m = /^([A-Za-z][A-Za-z0-9_-]*):(\/.*)?$/.exec(place);
      const name = m?.[1];
      const entry = name === undefined ? undefined : Object.hasOwn(stores, name) ? stores[name] : undefined;
      if (name !== undefined && entry !== undefined) {
        const rest = (m?.[2] ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
        const prefix = parsePrefix(rest);
        return prefix.kind === "ok" ? ok({ place: `${name}:`, store: entry.store, prefix: prefix.value }) : err(prefix.error);
      }
      return open === undefined ? err(`no store is named in ${place}`) : open(place);
    },
    consent: (place) => {
      const name = /^([A-Za-z][A-Za-z0-9_-]*):/.exec(place)?.[1];
      const entry = name === undefined || !Object.hasOwn(stores, name) ? undefined : stores[name];
      return entry?.consent ?? "metadata";
    },
    places: Object.entries(stores).map(([name, s]) => ({ uri: `${name}:`, kind: s.store.place.kind, capabilities: [...s.store.capabilities].sort(), consistency: s.store.consistency, ...(s.store.traits.maxObject === undefined ? {} : { maxObject: s.store.traits.maxObject }) })),
  };
}
