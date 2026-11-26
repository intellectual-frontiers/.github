// Spec: 0001-grc-layers FR-009
/**
 * The registry of typed ports (0001-grc-layers FR-009): the one shape every extension point of GRC takes. An entry has a stable id (lower-case words joined by `-` or `.`), a
 * second entry of one id is refused as an error value, and a registry says nothing of what its entries are: the port that owns it does.
 *
 * @example
 * ```ts
 * import { createRegistry } from "./registry.ts";
 * const r = createRegistry<{ readonly id: string }>("runner");
 * r.register({ id: "sql" }); // { kind: "ok", ... }
 * r.register({ id: "sql" }); // { kind: "err", error: { kind: "duplicate", ... } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** What every entry of a registry has. */
export type Entry = { readonly id: string };

/** Why an entry was refused. */
export type RegistryProblem =
  | { readonly kind: "unstable-id"; readonly registry: string; readonly id: string }
  | { readonly kind: "duplicate"; readonly registry: string; readonly id: string };

/** A stable id: lower-case words (letters and digits, beginning with a letter) joined by `-` or `.`. */
export const STABLE_ID: RegExp = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

/** A registry of the entries of one port. */
export type Registry<T extends Entry> = {
  readonly label: string;
  register(entry: T): Result<T, RegistryProblem>;
  get(id: string): T | undefined;
  has(id: string): boolean;
  /** The entries in the order of their ids. */
  list(): readonly T[];
};

/** A registry of its own, empty; `label` names the port in a problem. */
export function createRegistry<T extends Entry>(label: string): Registry<T> {
  const entries = new Map<string, T>();
  return {
    label,
    register(entry) {
      if (!STABLE_ID.test(entry.id)) return err({ kind: "unstable-id", registry: label, id: entry.id });
      if (entries.has(entry.id)) return err({ kind: "duplicate", registry: label, id: entry.id });
      entries.set(entry.id, entry);
      return ok(entry);
    },
    get: (id) => entries.get(id),
    has: (id) => entries.has(id),
    list: () => [...entries.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}

