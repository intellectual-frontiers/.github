// Spec: 0003-anyfs-posix-logical FR-001, FR-002
/**
 * The plan of an operation: how a store of some capabilities carries it out, as data. A plan says how faithfully (native, emulated with its reason and risk, or refused with its reason) and which
 * operations of the store it may use, so that `explain` answers before anything is run, the result of an operation carries the fidelity of its plan, and a test can hold that an operation used nothing
 * its plan did not name. The plan depends on the capabilities of the store and the policy, and on nothing else.
 *
 * @example
 * ```ts
 * import { plan } from "./plan.ts";
 * import { defaultPolicy } from "@intellectual-frontiers/anyfs-posix/governance";
 * const facts = { capabilities: new Set(["read", "write", "list", "stat", "delete"] as const), policy: defaultPolicy() };
 * plan(facts, "rename-file").fidelity.kind; // "emulated": a store without `rename` copies and then deletes
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import type { OpName } from "./store-ops.ts";
import { emulated, type Fidelity, native, OP_SUMMARY, PLAN_OPS, type PlanOp, type Policy, refusedBy } from "@intellectual-frontiers/anyfs-posix/governance";

/** What a plan depends on: the capabilities of the store and the policy of the view. */
export type Facts = { readonly capabilities: ReadonlySet<Capability>; readonly policy: Policy };

/** How an operation is carried out. */
export type Plan = {
  readonly op: PlanOp;
  readonly fidelity: Fidelity;
  /** The operations of the store it may use. */
  readonly steps: readonly OpName[];
  /** What the operation does, in a sentence. */
  readonly summary: string;
};

const NOT_IN_MODEL = (what: string): Fidelity => refusedBy("not-in-model", `${what} is not a thing of an object store: an object has a size, a revision and its bytes, and nothing else`);
const READ_ONLY = refusedBy("read-only", "the store cannot be written");
const NEEDS_CAS = (what: string): Fidelity => refusedBy("capability-absent", `${what} reads and writes the object back, which is safe only where the store compares revisions (cas), and this store does not`);

/** The plan of an operation for a store of capabilities. */
export function plan(facts: Facts, op: PlanOp): Plan {
  const has = (c: Capability): boolean => facts.capabilities.has(c);
  const write = has("write");
  const del = has("delete");
  const cas = has("cas");
  const done = (fidelity: Fidelity, steps: readonly OpName[]): Plan => ({ op, fidelity, steps, summary: OP_SUMMARY[op] });
  switch (op) {
    case "stat-file":
      return done(native, ["stat"]);
    case "stat-dir":
    case "readdir":
      return done(emulated("derived-directory"), ["stat", "list"]);
    case "mkdir":
      if (!write) return done(READ_ONLY, []);
      return facts.policy.markers.kind === "keep" ? done(emulated("marker-object"), ["stat", "list", "write"]) : done(emulated("no-marker"), ["stat", "list"]);
    case "rmdir":
      if (!del) return done(READ_ONLY, []);
      return facts.policy.markers.kind === "keep" ? done(emulated("marker-object"), ["stat", "list", "delete"]) : done(emulated("derived-directory"), ["stat", "list"]);
    case "unlink":
      return del ? done(native, ["stat", "list", "delete"]) : done(READ_ONLY, []);
    case "rename-file":
      if (!write || !del) return done(READ_ONLY, []);
      return has("rename") ? done(native, ["stat", "list", "rename"]) : done(emulated("copy-then-delete"), ["stat", "list", "read", "write", "delete"]);
    case "rename-over":
      return write && del ? done(emulated("copy-then-delete"), ["stat", "list", "read", "write", "delete"]) : done(READ_ONLY, []);
    case "rename-dir":
      if (!write || !del) return done(READ_ONLY, []);
      return done(emulated("listing-walk"), has("rename") ? ["stat", "list", "rename"] : ["stat", "list", "read", "write", "delete"]);
    case "read-all":
      return done(native, ["stat", "read"]);
    case "read-range":
      return done(emulated("whole-object-range"), ["stat", "read"]);
    case "write-all":
      return write ? done(native, ["stat", "list", "write"]) : done(READ_ONLY, []);
    case "open-write":
      return write ? done(emulated("write-back-buffer"), ["stat", "list", "read"]) : done(READ_ONLY, []);
    case "write":
      return write ? done(emulated("write-back-buffer"), []) : done(READ_ONLY, []);
    case "fsync":
    case "close":
      if (!write) return done(READ_ONLY, []);
      return cas ? done(emulated("write-back-buffer"), ["write"]) : done(emulated("unguarded-write"), ["write"]);
    case "truncate":
      if (!write) return done(READ_ONLY, []);
      return cas ? done(emulated("read-modify-write"), ["stat", "list", "read", "write"]) : done(NEEDS_CAS("a truncate"), []);
    case "append":
      if (!write) return done(READ_ONLY, []);
      return cas ? done(emulated("read-modify-write"), ["stat", "list", "read", "write"]) : done(NEEDS_CAS("an append"), []);
    case "touch":
      return write ? done(emulated("touch-without-mtime"), ["stat", "list", "write"]) : done(READ_ONLY, []);
    case "rm-r":
      if (!del) return done(READ_ONLY, []);
      return done(emulated("listing-walk"), has("batch") ? ["stat", "list", "batch"] : ["stat", "list", "delete"]);
    case "chmod":
      return done(NOT_IN_MODEL("a mode"), []);
    case "chown":
      return done(NOT_IN_MODEL("an owner"), []);
    case "utimes":
      return done(NOT_IN_MODEL("a time that can be set"), []);
    case "symlink":
      return done(NOT_IN_MODEL("a link"), []);
    case "link":
      return done(NOT_IN_MODEL("a second name"), []);
    case "readlink":
      return done(NOT_IN_MODEL("a link"), []);
    case "mmap":
      return done(NOT_IN_MODEL("a mapping"), []);
    default:
      return absurd(op);
  }
}

/** Every plan for a store of capabilities, in the order of the operations. */
export function plans(facts: Facts): readonly Plan[] {
  return PLAN_OPS.map((op) => plan(facts, op));
}
