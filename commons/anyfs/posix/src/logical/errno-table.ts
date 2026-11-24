// Spec: 0003-anyfs-posix-logical FR-003
/**
 * What a store's problem is, as a code of POSIX: a total table from the five kinds of problem (and the seven reasons of a refusal) to the code a local file system would have given. Where the same
 * problem means two things the operation decides: a write that expected no object and found one is `EEXIST` where it made a file and `ESTALE` where it was to replace what it had read.
 *
 * @example
 * ```ts
 * import { errnoOf } from "./errno-table.ts";
 * import { missing, parsePath } from "@intellectual-frontiers/anyfs/governance";
 * const p = parsePath("a");
 * p.kind === "ok" && errnoOf(missing(p.value), { op: "read-all" }); // "ENOENT"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Problem, Refusal } from "@intellectual-frontiers/anyfs/governance";
import type { Errno, PlanOp } from "@intellectual-frontiers/anyfs-posix/governance";

/** What the operation was doing when the store said it: the operation, and whether it was making an object where there was none. */
export type Context = { readonly op: PlanOp; readonly creating?: boolean };

const WRITES: readonly PlanOp[] = ["mkdir", "rmdir", "unlink", "rename-file", "rename-over", "rename-dir", "write-all", "open-write", "write", "fsync", "close", "truncate", "append", "touch", "rm-r"];
const RENAMES: readonly PlanOp[] = ["rename-file", "rename-over", "rename-dir"];

function refusal(reason: Refusal, context: Context): Errno {
  switch (reason) {
    case "read-only":
      return "EROFS";
    case "outside-scope":
      return RENAMES.includes(context.op) ? "EXDEV" : "EACCES";
    case "unsupported-expectation":
    case "capability-absent":
      return "ENOTSUP";
    case "too-large":
      return WRITES.includes(context.op) ? "EFBIG" : "ENAMETOOLONG";
    case "unportable-path":
      return "EINVAL";
    case "consent":
      return "EACCES";
    default:
      return absurd(reason);
  }
}

/** The code of a problem. */
export function errnoOf(problem: Problem, context: Context): Errno {
  switch (problem.kind) {
    case "missing":
      return "ENOENT";
    case "conflict":
      return context.creating === true && problem.expected.kind === "absent" ? "EEXIST" : "ESTALE";
    case "refused":
      return refusal(problem.reason, context);
    case "unavailable":
    case "tampered":
      return "EIO";
    default:
      return absurd(problem);
  }
}
