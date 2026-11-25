// Spec: 0002-workload-effects FR-001, FR-002, FR-004
/**
 * What a verb node does to the world, declared as data: the store, its class, the mode, whether it can be undone and how, and for a system of record the name of the input that is its idempotency key. The autonomy
 * of a node is derived from the class and the mode by one table, the same in every form, and is never declared. A store is attached to a workshop by the capabilities it must offer (the closed union of AnyFS) and the
 * workshop is disposable where nothing but ephemeral stores is attached.
 *
 * @example
 * ```ts
 * import { AUTONOMY_TABLE } from "./effect.ts";
 * AUTONOMY_TABLE.transactional.mutate; // "agent-proposes"
 * AUTONOMY_TABLE.durable.destroy; // "human-only"
 * ```
 *
 * @module
 */
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import type { NodeId, StoreRef } from "./ids.ts";
import type { Mode, StoreClass } from "./terms.ts";

/** The effect of a verb node. */
export type Effect = {
  readonly store: StoreRef;
  readonly class: StoreClass;
  readonly mode: Mode;
  readonly reversible: boolean;
  /** The undo node that takes it back. */
  readonly compensation?: NodeId;
  /** The name of the input of the node that is the idempotency key; needed where the class is `external` and the mode is not `read`. */
  readonly idempotencyKey?: string;
};

/** A store a workload attaches: its reference, its class and the capabilities it must offer. */
export type StoreDecl = { readonly ref: StoreRef; readonly class: StoreClass; readonly needs: readonly Capability[] };

/** The autonomy that follows from an effect: one cell for each class and mode, held by the compiler. */
export const AUTONOMY_TABLE: Readonly<Record<StoreClass, Readonly<Record<Mode, Autonomy>>>> = {
  ephemeral: { read: "agent-autonomous", append: "agent-autonomous", mutate: "agent-autonomous", destroy: "agent-autonomous" },
  transactional: { read: "agent-autonomous", append: "agent-acts-human-reviews", mutate: "agent-proposes", destroy: "human-only" },
  durable: { read: "agent-autonomous", append: "agent-acts-human-reviews", mutate: "agent-proposes", destroy: "human-only" },
  git: { read: "agent-autonomous", append: "agent-acts-human-reviews", mutate: "human-only", destroy: "human-only" },
  external: { read: "agent-autonomous", append: "agent-proposes", mutate: "agent-proposes", destroy: "human-only" },
};
