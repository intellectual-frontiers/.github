// Spec: 0002-anyfs-cli-governance FR-004
/**
 * The problem codes of the `anyfs` program and what each means (commons anyfs-cli 0002-anyfs-cli-governance FR-004; commons headless 0003-headless-output FR-008): every problem a run can raise is one of a closed union of
 * codes, and each code has one explanation (a title, what happened, the likely cause and the fix) that `anyfs explain <code>` prints and the documentation renders. The registry holds one entry for every code, which
 * the compiler checks.
 *
 * @example
 * ```ts
 * import { CATALOGUE, isProblemCode } from "./problems.ts";
 * isProblemCode("E-FILESYSTEM"); // true
 * CATALOGUE["E-STRICT"].fix; // "run it again without --strict, or give the store the capability it lacks"
 * ```
 *
 * @module
 */

/** What `anyfs explain` says of a code: the shape of Headless' explanation, held here so that the governance imports no more than it needs. */
export type Explained = { readonly title: string; readonly what: string; readonly why: string; readonly fix: string };

/** The code of every problem: a closed union. */
export type ProblemCode =
  | "E-USAGE"
  | "E-ENVIRONMENT"
  | "E-CONFIG-LOAD"
  | "E-CONFIG-INVALID"
  | "E-LOCATION"
  | "E-MOUNT-UNKNOWN"
  | "E-PLACE-UNAVAILABLE"
  | "E-OPEN"
  | "E-FILESYSTEM"
  | "E-STRICT"
  | "E-DIFFERENT"
  | "E-PLAN-REFUSED"
  | "E-PLAN-STALE"
  | "E-CONFLICTS"
  | "E-APPLY-FAILED"
  | "E-REPLICA-DIVERGED"
  | "E-TRUST";

/** Every code, in the order the union lists them. */
export const PROBLEM_CODES: readonly ProblemCode[] = [
  "E-USAGE",
  "E-ENVIRONMENT",
  "E-CONFIG-LOAD",
  "E-CONFIG-INVALID",
  "E-LOCATION",
  "E-MOUNT-UNKNOWN",
  "E-PLACE-UNAVAILABLE",
  "E-OPEN",
  "E-FILESYSTEM",
  "E-STRICT",
  "E-DIFFERENT",
  "E-PLAN-REFUSED",
  "E-PLAN-STALE",
  "E-CONFLICTS",
  "E-APPLY-FAILED",
  "E-REPLICA-DIVERGED",
  "E-TRUST",
];

/** Whether a word is a code of the program. */
export function isProblemCode(word: string): word is ProblemCode {
  return PROBLEM_CODES.some((c) => c === word);
}

/** The explanation of every code. */
export const CATALOGUE: Readonly<Record<ProblemCode, Explained>> = {
  "E-USAGE": { title: "The command line does not fit", what: "A verb was given words, options or operands it does not take.", why: "A typing slip, or an option of another verb.", fix: "anyfs help" },
  "E-ENVIRONMENT": { title: "The program cannot do it here", what: "The setup of this computer does not allow the verb to run: a store could not be reached or a tool it needs is missing.", why: "A host that is down, a missing ssh program, or a place that needs a driver this program does not have.", fix: "anyfs doctor" },
  "E-CONFIG-LOAD": { title: "The configuration could not be loaded", what: "The file anyfs.config.ts exists but importing it failed.", why: "A syntax or import error in the file, or a runtime that cannot run TypeScript (use Bun or Node 26).", fix: "fix the error the message gives, then run anyfs doctor" },
  "E-CONFIG-INVALID": { title: "The configuration is not valid", what: "The file exports a configuration that does not fit its type: a mount name that is not a word, a place that does not parse, or a limit out of range.", why: "A typing slip in a mount or a default.", fix: "fix what the message names; anyfs places lists the mounts that are read" },
  "E-LOCATION": { title: "That is not a place the program can read", what: "A word given as a place is neither a path, a mount (name:/path) nor an address of a store (ssh://host/path, memory:name).", why: "A typing slip, or a place of a kind this program has no store for.", fix: "anyfs places" },
  "E-MOUNT-UNKNOWN": { title: "No mount has that name", what: "A word of the form name:/path names a mount the configuration does not hold.", why: "The mount is not in anyfs.config.ts, or the file was not found from this folder.", fix: "anyfs places" },
  "E-PLACE-UNAVAILABLE": { title: "No store for that kind of place yet", what: "The place parses, but no opener of a store for its kind is installed in this program.", why: "The kinds git, github, gitlab, s3, onedrive, gdrive and sql are added by their own libraries, through the configuration.", fix: "add the opener of the kind to the kinds of anyfs.config.ts" },
  "E-OPEN": { title: "The store could not be opened", what: "The place is of a kind the program has, but opening its store failed.", why: "The folder is not there, the host does not answer, its key is not trusted yet, or the helper cannot be kept on it.", fix: "anyfs doctor" },
  "E-FILESYSTEM": { title: "The operation failed", what: "The store refused an operation, in the words of a file system: ENOENT, EEXIST, EISDIR, ENOTDIR, ENOTEMPTY, EROFS, EXDEV, ENOTSUP, ESTALE or another errno.", why: "What the errno says, as it applies to this store.", fix: "read the errno in the message; --explain says how the store would carry the operation out" },
  "E-STRICT": { title: "The operation would be emulated or refused", what: "--strict stops where the store carries an operation out by a means that can lose or change what you meant, or refuses it.", why: "The store lacks a capability the operation wants (for example cas for append, or rename for an atomic move).", fix: "run it again without --strict, or give the store the capability it lacks" },
  "E-DIFFERENT": { title: "The two differ", what: "diff or check found that the two sides are not the same.", why: "A real difference.", fix: "anyfs sync SRC DST --dry-run shows what would make them equal" },
  "E-PLAN-REFUSED": { title: "No plan was made", what: "The plan was refused before it was made: a rail was crossed, the deletes were over their allowance, something would be lost, or a store lacks what the mode needs.", why: "The reason is in the message: rails, delete budget, losses or capability.", fix: "change the rails or the allowance named in the message, or look at the plan with --dry-run" },
  "E-PLAN-STALE": { title: "The plan changed", what: "The hash that was approved is not the hash of the plan made now: a store changed since the plan was looked at.", why: "Someone changed the source or the destination between the dry run and the apply.", fix: "run --dry-run again, read the new plan, then apply with its hash" },
  "E-CONFLICTS": { title: "The plan has conflicts", what: "Some names changed on both sides or collide, so the plan will not apply them unasked.", why: "A change on both sides, a name that two paths make, or names that differ only in case.", fix: "settle them by hand, or choose a rule (--conflict newer-wins or keep-both for bisync)" },
  "E-APPLY-FAILED": { title: "Some of the plan did not apply", what: "At least one action failed or was skipped; the report says which and why.", why: "A store was unreachable, refused a write, or changed under the plan.", fix: "run the same command again: what is done is not done twice" },
  "E-REPLICA-DIVERGED": { title: "A replica changed on its own", what: "The replica holds changes the primary does not, so a sync would lose them.", why: "Someone wrote to the replica directly.", fix: "decide which side is right; anyfs mirror status names the paths" },
  "E-TRUST": { title: "The host key is not trusted yet", what: "The host presents a key this computer has not recorded, and the program never accepts one on its own.", why: "First contact with a host.", fix: "anyfs trust-host NAME, then check the fingerprint by another way and run it again with --fingerprint" },
};
