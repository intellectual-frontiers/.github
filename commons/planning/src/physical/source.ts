// Spec: 0004-planning-sources FR-002
// Spec: 0004-planning-sources FR-003
/**
 * What a source is (0037-planning FR-013, FR-030, FR-032): a typed lens over one kind of place with a name, its capabilities and a place; `acquire` reads the place and returns its observations and findings;
 * `preview` gives the plan a patch would carry out; `write` carries a plan out and returns what the place now holds. `defineSource` makes one from a typed record and refuses a record that says one thing of what it
 * can write and does another; `applyPatch` is the one way a patch reaches a source, a dry run unless it names the hash of the preview, refusing a hash that is not the plan's, and sending a patch the source cannot
 * apply to the outbox.
 *
 * @example
 * ```ts
 * import { defineSource } from "./source.ts";
 * // defineSource({ name: "table", place: "t", capabilities: ["read"], acquire })
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Capability, type Instant, mayApply, type Observation, type OutboxEntry, type Patch, capabilityFor } from "@intellectual-frontiers/planning/governance";
import { decide, type Plan, type Preview } from "@intellectual-frontiers/planning/logical";

/** Why a source could not read or write a place. */
export type SourceProblem =
  | { readonly kind: "read"; readonly message: string }
  | { readonly kind: "conflict"; readonly path: string; readonly message: string }
  | { readonly kind: "unexpressed"; readonly reason: string }
  | { readonly kind: "refused"; readonly message: string };

/** A thing a source could not read, and why: a finding, not a failure of the read. */
export type SourceFinding = { readonly path: string; readonly message: string };

/** What a read of a place gives: its observations, in a fixed order, and what it could not read. */
export type Acquired = { readonly observations: readonly Observation[]; readonly findings: readonly SourceFinding[] };

/** A source: a lens over one kind of place. */
export type Source = {
  readonly name: string;
  readonly place: string;
  readonly capabilities: ReadonlySet<Capability>;
  acquire(): Promise<Result<Acquired, SourceProblem>>;
  /** The plan a patch would carry out, or why this place cannot say it. Present when the source can write. */
  preview?(patch: Patch): Promise<Result<Plan, SourceProblem>>;
  /** Carries a plan out and returns what the place now holds. Present when the source can write. */
  write?(plan: Plan): Promise<Result<Acquired, SourceProblem>>;
};

/** What a person gives to make a source. */
export type SourceRecord = {
  readonly name: string;
  readonly place: string;
  readonly capabilities: readonly Capability[];
  readonly acquire: Source["acquire"];
  readonly preview?: Source["preview"];
  readonly write?: Source["write"];
};

/** Why a record is not a source. */
export type DefineProblem = { readonly kind: "write-mismatch"; readonly message: string } | { readonly kind: "bad-name"; readonly message: string };

/** The capabilities that say a source can write. */
const WRITING: readonly Capability[] = ["create", "append-event", "edit", "close", "assign", "delete"];

/** A source from a typed record: a record whose `preview` or `write` is present while its capabilities say it cannot write, or absent while they say it can, is refused. */
export function defineSource(record: SourceRecord): Result<Source, DefineProblem> {
  if (record.name === "" || record.place === "") return err({ kind: "bad-name", message: "a source has a name and a place" });
  const canWrite = record.capabilities.some((c) => WRITING.includes(c));
  const hasWrite = record.write !== undefined || record.preview !== undefined;
  if (hasWrite && !canWrite) return err({ kind: "write-mismatch", message: `${record.name} has a write but its capabilities (${record.capabilities.join(", ")}) say it cannot write` });
  if (canWrite && (record.write === undefined || record.preview === undefined)) return err({ kind: "write-mismatch", message: `${record.name} says it can write but has no preview and write` });
  return ok({
    name: record.name,
    place: record.place,
    capabilities: new Set(record.capabilities),
    acquire: record.acquire,
    ...(record.preview === undefined ? {} : { preview: record.preview }),
    ...(record.write === undefined ? {} : { write: record.write }),
  });
}

/** What applying a patch came to. */
export type Applied =
  | { readonly kind: "dry-run"; readonly preview: Preview }
  | { readonly kind: "written"; readonly preview: Preview; readonly now: Acquired }
  | { readonly kind: "stale"; readonly given: string; readonly preview: Preview }
  | { readonly kind: "outbox"; readonly entry: OutboxEntry }
  | { readonly kind: "failed"; readonly problem: SourceProblem };

/**
 * The one way a patch reaches a source. A patch for another source or place than the source's own is refused (a write needs an explicit target); a patch the source cannot apply, or that its place cannot say, is an
 * outbox entry; otherwise the plan is made and the write is a dry run unless `hash` is the hash of its preview.
 */
export async function applyPatch(source: Source, patch: Patch, at: Instant, hash?: string): Promise<Applied> {
  if (patch.source !== source.name || patch.place !== source.place) return { kind: "failed", problem: { kind: "refused", message: `the patch is for ${patch.source} at ${patch.place} and not for ${source.name} at ${source.place}` } };
  if (!mayApply(patch, source.capabilities) || source.preview === undefined || source.write === undefined) return { kind: "outbox", entry: { patch, waiting: { kind: "capability", capability: capabilityFor(patch) }, at } };
  const plan = await source.preview(patch);
  if (plan.kind === "err") return plan.error.kind === "unexpressed" ? { kind: "outbox", entry: { patch, waiting: { kind: "unexpressed", reason: plan.error.reason }, at } } : { kind: "failed", problem: plan.error };
  const decision = await decide(plan.value, hash);
  switch (decision.kind) {
    case "dry-run":
      return { kind: "dry-run", preview: decision.preview };
    case "stale":
      return { kind: "stale", given: decision.given, preview: decision.preview };
    case "apply": {
      const written = await source.write(plan.value);
      return written.kind === "ok" ? { kind: "written", preview: decision.preview, now: written.value } : { kind: "failed", problem: written.error };
    }
    default: {
      const never: never = decision;
      return never;
    }
  }
}
