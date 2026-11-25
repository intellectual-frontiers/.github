// Spec: 0006-workload-split FR-004
/**
 * The registry of verbs by id: the deterministic operations of the pinned packages that a verb node may call. A verb has a package it comes from, typed inputs, the classes of store it acts on and the greatest
 * mode it does, the workbench requirements it needs (a program, a credential) and, where the static checks know it by what it does, a role. A node declares its own effect within what its verb is registered with.
 * The registry of the commons is `VERBS`; another is made by `createVerbRegistry`, which refuses an id twice.
 *
 * @example
 * ```ts
 * import { VERBS } from "./verbs.ts";
 * VERBS.get("store.checkpoint")?.role; // "checkpoint"
 * VERBS.has("rm.rf"); // false
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Requirement } from "@intellectual-frontiers/workbench/governance";
import { type VerbId, verbId } from "./ids.ts";
import type { Mode, StoreClass, VerbRole } from "./terms.ts";

/** What type an input of a verb has. */
export const INPUT_TYPES = ["text", "integer", "flag", "store", "digest", "path"] as const;
/** One type of input. */
export type InputType = (typeof INPUT_TYPES)[number];

/** One input of a verb: its name, its type and whether it is required. */
export type InputSpec = { readonly name: string; readonly type: InputType; readonly required: boolean };

/** A verb as registered. */
export type VerbSpec = {
  readonly id: VerbId;
  readonly summary: string;
  /** The pinned package the verb comes from, by name. */
  readonly package: string;
  readonly inputs: readonly InputSpec[];
  /** The classes of store the verb acts on. */
  readonly classes: readonly StoreClass[];
  /** The greatest mode the verb does; a node declares at most this. */
  readonly maxMode: Mode;
  readonly role?: VerbRole;
  /** What the workbench must find for the verb to run. */
  readonly needs: readonly Requirement[];
};

/** A registry of verbs by id. */
export type VerbRegistry = {
  has(id: string): boolean;
  get(id: string): VerbSpec | undefined;
  list(): readonly VerbSpec[];
};

/** A registry made of verbs, or the id it has twice. */
export function createVerbRegistry(specs: readonly VerbSpec[]): Result<VerbRegistry, string> {
  const byId = new Map<string, VerbSpec>();
  for (const s of specs) {
    if (byId.has(s.id)) return err(`the verb ${s.id} is registered twice`);
    byId.set(s.id, s);
  }
  const sorted = [...specs].sort((a, b) => (a.id < b.id ? -1 : 1));
  return ok({ has: (id) => byId.has(id), get: (id) => byId.get(id), list: () => sorted });
}

const id = (text: string): VerbId => {
  const r = verbId(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const SQLITE: Requirement = { id: "sqlite3", kind: "program", concept: "workshop", task: "run", safety: false, summary: "sqlite3 reads, backs up and restores the SQLite stores of a run", name: "sqlite3" };
const STORE = (required = true): InputSpec => ({ name: "store", type: "store", required });

/** The verbs of the commons. Every id is `<noun>.<action>`; none takes a shell string. */
export const VERBS: VerbRegistry = (() => {
  const made = createVerbRegistry([
    { id: id("work.claim"), summary: "Claim a work order for a person or the agent that acts for them", package: "@intellectual-frontiers/planning", inputs: [{ name: "order", type: "text", required: true }], classes: ["durable"], maxMode: "append", needs: [] },
    { id: id("work.record"), summary: "Record evidence on a work order", package: "@intellectual-frontiers/planning", inputs: [{ name: "order", type: "text", required: true }, { name: "digest", type: "digest", required: false }], classes: ["durable"], maxMode: "append", needs: [] },
    { id: id("work.release"), summary: "Release a claim on a work order", package: "@intellectual-frontiers/planning", inputs: [{ name: "order", type: "text", required: true }], classes: ["durable"], maxMode: "append", needs: [] },
    { id: id("workshop.attach"), summary: "Attach a store to the workshop by the capabilities it needs", package: "@intellectual-frontiers/anyfs", inputs: [STORE()], classes: [...(["ephemeral", "transactional", "durable", "git", "external"] as const)], maxMode: "read", role: "attach", needs: [] },
    { id: id("workshop.detach"), summary: "Detach a store from the workshop", package: "@intellectual-frontiers/anyfs", inputs: [STORE()], classes: [...(["ephemeral", "transactional", "durable", "git", "external"] as const)], maxMode: "read", role: "detach", needs: [] },
    { id: id("workshop.dispose"), summary: "Dispose of the workshop; it must be disposable, which is computed from what is attached", package: "@intellectual-frontiers/anyfs", inputs: [STORE()], classes: ["ephemeral"], maxMode: "destroy", role: "dispose", needs: [] },
    { id: id("store.checkpoint"), summary: "Make a restore point of a store before it is changed", package: "@intellectual-frontiers/data", inputs: [STORE()], classes: ["transactional", "durable"], maxMode: "append", role: "checkpoint", needs: [SQLITE] },
    { id: id("store.backup"), summary: "Copy a store into a backup store", package: "@intellectual-frontiers/data", inputs: [STORE(), { name: "target", type: "store", required: true }], classes: ["durable"], maxMode: "append", needs: [SQLITE] },
    { id: id("store.restore"), summary: "Restore a backup into a store", package: "@intellectual-frontiers/data", inputs: [STORE(), { name: "from", type: "store", required: true }], classes: ["ephemeral", "transactional"], maxMode: "mutate", needs: [SQLITE] },
    { id: id("store.digests"), summary: "Read the digests of the objects of two stores and say whether they are the same", package: "@intellectual-frontiers/crypto", inputs: [STORE(), { name: "other", type: "store", required: true }], classes: ["ephemeral", "transactional", "durable"], maxMode: "read", needs: [] },
    { id: id("store.delete"), summary: "Delete the objects of a durable store", package: "@intellectual-frontiers/anyfs", inputs: [STORE()], classes: ["durable"], maxMode: "destroy", needs: [] },
    { id: id("workbench.ready"), summary: "Check that the workbench has what a task needs, installing nothing: the install check of a run", package: "@intellectual-frontiers/workbench", inputs: [{ name: "task", type: "text", required: false }], classes: ["ephemeral"], maxMode: "read", needs: [] },
    { id: id("git.commit"), summary: "Commit a change to a repository, as its configuration says", package: "@intellectual-frontiers/repoctl", inputs: [{ name: "subject", type: "text", required: true }], classes: ["git"], maxMode: "append", needs: [] },
    { id: id("git.rewrite"), summary: "Rewrite the history of a repository", package: "@intellectual-frontiers/repoctl", inputs: [{ name: "ref", type: "text", required: true }], classes: ["git"], maxMode: "mutate", needs: [] },
    { id: id("state.observe"), summary: "Read the state of a store as named values, for a loop that observes the actual or the desired state; the host that has the system binds it", package: "@intellectual-frontiers/workload", inputs: [STORE()], classes: ["ephemeral", "transactional", "durable", "git", "external"], maxMode: "read", needs: [] },
    { id: id("state.verify"), summary: "Read the state of a store and say whether it matches the state of another store, for a loop that verifies it converged; the host that has the system binds it", package: "@intellectual-frontiers/workload", inputs: [STORE(), { name: "desired", type: "store", required: true }], classes: ["ephemeral", "transactional", "durable", "git", "external"], maxMode: "read", needs: [] },
    { id: id("state.apply"), summary: "Apply the changes of an approved plan to a store, once, by the hash of the plan as its idempotency key; the host that has the system binds it", package: "@intellectual-frontiers/workload", inputs: [STORE(), { name: "key", type: "text", required: true }, { name: "changes", type: "text", required: true }], classes: ["ephemeral", "transactional", "durable", "external"], maxMode: "destroy", needs: [] },
    { id: id("external.apply"), summary: "Apply a change to a system of record, once, by its idempotency key", package: "@intellectual-frontiers/integrations", inputs: [STORE(), { name: "key", type: "text", required: true }], classes: ["external"], maxMode: "mutate", needs: [] },
  ]);
  if (made.kind === "err") throw new Error(made.error);
  return made.value;
})();
