// Spec: 0003-anyfs-logical FR-001
/**
 * The operations of a store as data, and what each ends with. A store is a facade over one handler of operations (`store.ts`), so that a layer, an attenuation or a mount is a function of operations and
 * can neither be bypassed nor forget one. An operation names the capability it needs, and an expectation of a revision needs `cas` as well.
 *
 * @example
 * ```ts
 * import { capabilitiesNeeded } from "./ops.ts";
 * import { parsePath, expectAny } from "@intellectual-frontiers/anyfs/governance";
 * const p = parsePath("a");
 * p.kind === "ok" && capabilitiesNeeded({ op: "write", path: p.value, bytes: new Uint8Array(), expect: expectAny }); // ["write"]
 * ```
 *
 * @module
 */
import { absurd, type Result } from "@intellectual-frontiers/core";
import type { Capability, Expect, Path, Prefix, Problem, Revision, Cursor } from "@intellectual-frontiers/anyfs/governance";

/** What a store says of an object without its bytes. */
export type Stat = { readonly path: Path; readonly size: number; readonly rev: Revision; readonly modified?: string };
/** The bytes of an object and the revision they are at. */
export type Read = { readonly bytes: Uint8Array; readonly rev: Revision; readonly modified?: string };
/** What a write made: the revision of the object and whether it did not exist. */
export type Written = { readonly rev: Revision; readonly created: boolean };
/** What a delete did: whether there was an object. */
export type Deleted = { readonly existed: boolean };
/** One page of a list: the entries in the order of their paths, and where the next page begins where there is one. */
export type Listing = { readonly entries: readonly Stat[]; readonly next?: Cursor };
/** What one change of a batch made. */
export type ChangeResult = { readonly kind: "put"; readonly path: Path; readonly rev: Revision; readonly created: boolean } | { readonly kind: "delete"; readonly path: Path; readonly existed: boolean };
/** What a batch made: one result for each change, in order. */
export type BatchWritten = { readonly results: readonly ChangeResult[] };
/** The earlier revisions of an object, newest first. */
export type Versions = { readonly versions: readonly { readonly rev: Revision; readonly size: number; readonly modified?: string }[] };
/** A part of an object. */
export type Ranged = { readonly bytes: Uint8Array; readonly rev: Revision; readonly start: number };
/** The objects a search found. */
export type Hits = { readonly hits: readonly { readonly path: Path; readonly rev: Revision }[] };

/** One change of a batch. */
export type Change<E extends Expect = Expect> =
  | { readonly kind: "put"; readonly path: Path; readonly bytes: Uint8Array; readonly expect: E }
  | { readonly kind: "delete"; readonly path: Path; readonly expect: E };

/** What a list is asked: how many entries at most, and where to resume. */
export type ListOptions = { readonly limit?: number; readonly after?: Cursor };

/** An operation of a store, as data: a closed union. */
export type Op =
  | { readonly op: "read"; readonly path: Path }
  | { readonly op: "write"; readonly path: Path; readonly bytes: Uint8Array; readonly expect: Expect }
  | { readonly op: "stat"; readonly path: Path }
  | { readonly op: "list"; readonly prefix: Prefix; readonly limit?: number; readonly after?: Cursor }
  | { readonly op: "delete"; readonly path: Path; readonly expect: Expect }
  | { readonly op: "batch"; readonly changes: readonly Change[] }
  | { readonly op: "rename"; readonly from: Path; readonly to: Path; readonly expect: Expect }
  | { readonly op: "history"; readonly path: Path; readonly limit?: number }
  | { readonly op: "rangeRead"; readonly path: Path; readonly start: number; readonly length: number }
  | { readonly op: "append"; readonly path: Path; readonly bytes: Uint8Array; readonly expect: Expect }
  | { readonly op: "search"; readonly prefix: Prefix; readonly text: string; readonly limit?: number };

/** The name of an operation. */
export type OpName = Op["op"];
/** The names of the operations, in the order of the capabilities. */
export const OP_NAMES: readonly OpName[] = ["read", "write", "stat", "list", "delete", "batch", "rename", "history", "rangeRead", "append", "search"];

/** What an operation ended with: a closed union, tagged by the operation it answers. */
export type Done =
  | { readonly op: "read"; readonly value: Read }
  | { readonly op: "write"; readonly value: Written }
  | { readonly op: "stat"; readonly value: Stat }
  | { readonly op: "list"; readonly value: Listing }
  | { readonly op: "delete"; readonly value: Deleted }
  | { readonly op: "batch"; readonly value: BatchWritten }
  | { readonly op: "rename"; readonly value: Written }
  | { readonly op: "history"; readonly value: Versions }
  | { readonly op: "rangeRead"; readonly value: Ranged }
  | { readonly op: "append"; readonly value: Written }
  | { readonly op: "search"; readonly value: Hits };

/** The one function a backend writes: an operation to what it ended with. It does not throw. */
export type Handler = (op: Op) => Promise<Result<Done, Problem>>;

/** The capability an operation needs. */
export function capabilityOf(op: Op): Capability {
  switch (op.op) {
    case "read":
    case "write":
    case "stat":
    case "list":
    case "delete":
    case "batch":
    case "rename":
    case "history":
    case "rangeRead":
    case "append":
    case "search":
      return op.op;
    default:
      return absurd(op);
  }
}

const needsRevision = (expect: Expect): boolean => expect.kind === "rev";

/** Whether an operation expects a revision somewhere: it needs `cas`. */
export function expectsRevision(op: Op): boolean {
  switch (op.op) {
    case "write":
    case "delete":
    case "rename":
    case "append":
      return needsRevision(op.expect);
    case "batch":
      return op.changes.some((c) => needsRevision(c.expect));
    case "read":
    case "stat":
    case "list":
    case "history":
    case "rangeRead":
    case "search":
      return false;
    default:
      return absurd(op);
  }
}

/** Every capability an operation needs: its own, and `cas` where it expects a revision. */
export function capabilitiesNeeded(op: Op): readonly Capability[] {
  return expectsRevision(op) ? [capabilityOf(op), "cas"] : [capabilityOf(op)];
}

/** The path an operation is about, where it is about one. */
export function pathOf(op: Op): Path | undefined {
  switch (op.op) {
    case "read":
    case "write":
    case "stat":
    case "delete":
    case "history":
    case "rangeRead":
    case "append":
      return op.path;
    case "rename":
      return op.from;
    case "list":
    case "search":
    case "batch":
      return undefined;
    default:
      return absurd(op);
  }
}
