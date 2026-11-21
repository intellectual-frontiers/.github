// Spec: 0004-anyfs-middleware FR-003
/**
 * The audited layer: one record for each operation, a refused one included, given to a sink the caller gives. A record says when, which store, which operation and path, what the outcome was and how many bytes;
 * it holds no bytes. Where the sink fails the answer is `unavailable` and the operation's effect stands, so that a gap in the audit is never silent.
 *
 * @example
 * ```ts
 * import { audited } from "./audited.ts";
 * // const store = audited(inner, sink, clock)
 * ```
 *
 * @module
 */
import { err } from "@intellectual-frontiers/core";
import { type Capability, unavailable } from "@intellectual-frontiers/anyfs/governance";
import { pathOf } from "../ops.ts";
import { type Carried, carriedCapabilities, makeStore, type Store } from "../store.ts";
import type { AuditRecord, AuditSink, Clock } from "./ports.ts";
import { bytesOf } from "./traced.ts";

/** A store that gives a record of each operation of its argument to a sink, and keeps its capabilities. */
export function audited<C extends Capability>(store: Store<C>, sink: AuditSink, clock: Pick<Clock, "now">): Store<Carried<C>> {
  return makeStore({
    id: store.id,
    place: store.place,
    consistency: store.consistency,
    traits: store.traits,
    capabilities: carriedCapabilities(store),
    handle: async (op) => {
      const r = await store.handle(op);
      const path = pathOf(op);
      const size = bytesOf(op, r.kind === "ok" ? r.value : undefined);
      const record: AuditRecord = {
        at: new Date(clock.now()).toISOString(),
        store: store.id,
        op: op.op,
        ...(path === undefined ? {} : { path }),
        outcome: r.kind === "ok" ? "ok" : r.error.kind,
        ...(size === undefined ? {} : { size }),
      };
      try {
        await sink(record);
      } catch (thrown) {
        return err(unavailable(`the audit sink failed (${thrown instanceof Error ? thrown.message : String(thrown)}); the operation was ${r.kind === "ok" ? "done" : "refused"}`, false));
      }
      return r;
    },
  });
}
