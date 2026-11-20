// Spec: 0009-grc-groups FR-002, FR-006, FR-007, FR-010
/**
 * The ports of one entity of a group (0009-grc-groups): its ledger, its results, its exceptions and its evidence store, which the host resolves for that entity alone, and the reference reader that
 * makes the entity's snapshot from them. A reader takes only its own entity's ports; nothing here names how they are stored or kept apart from another entity's.
 *
 * @example
 * ```ts
 * import { entityReader } from "./entity.ts";
 * // const read = entityReader(portsOfUnitA, { frameworks, crosswalks, checks });
 * // const snapshot = await read("2026-06-01T00:00:00Z");
 * ```
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Check, Crosswalk, EntityId, Exception, Framework } from "@intellectual-frontiers/grc/governance";
import { GENESIS, type LedgerEntry, type Result as Outcome, snapshotOf, verifyLedger, type EntityReader } from "@intellectual-frontiers/grc/logical";
import type { EvidenceStore } from "./store.ts";

/** The ports of one entity, resolved by the host for that entity alone. */
export type EntityPorts = {
  readonly entity: EntityId;
  readonly ledger: { entries(): Promise<readonly LedgerEntry[]> };
  readonly results: { list(): Promise<readonly Outcome[]> };
  readonly exceptions: { list(): Promise<readonly Exception[]> };
  readonly store: EvidenceStore;
};

/** What the group defines once and every entity reads the same. */
export type GroupMaterial = { readonly frameworks: readonly Framework[]; readonly crosswalks: readonly Crosswalk[]; readonly checks: readonly Check[] };

/**
 * The reference reader of an entity: reads its ledger (a broken chain is `malformed`), its results and exceptions, and gives the snapshot; any port that fails is `unreachable`.
 *
 * @example
 * ```ts
 * // const read = entityReader(ports, { frameworks, crosswalks, checks }); await read("2026-06-01T00:00:00Z");
 * ```
 */
export function entityReader(ports: EntityPorts, material: GroupMaterial): EntityReader {
  return async (at) => {
    try {
      const entries = await ports.ledger.entries();
      const chain = await verifyLedger(entries);
      if (chain.kind === "err") return err({ kind: "malformed", message: `the ledger of ${ports.entity}: ${chain.error.reason}` });
      const [results, exceptions] = [await ports.results.list(), await ports.exceptions.list()];
      const made = await snapshotOf({ entity: ports.entity, ...material, results, exceptions, ledgerHead: entries.at(-1)?.digest ?? GENESIS }, at);
      return made.kind === "ok" ? ok(made.value) : err({ kind: "malformed", message: made.error });
    } catch (e) {
      return err({ kind: "unreachable", message: e instanceof Error ? e.message : String(e) });
    }
  };
}
