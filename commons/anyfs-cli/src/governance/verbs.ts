// Spec: 0002-anyfs-cli-governance FR-001, FR-002
/**
 * The verbs of the `anyfs` program as facts (commons anyfs-cli 0002-anyfs-cli-governance FR-001, FR-002; commons headless 0002-headless-governance, 0005-reach-and-targets): each verb is declared once, with what it is
 * (a report or an action), what it may do to the world (`read`, `mutate`, `destructive`), whether repeating it is safe, whether it previews, the tier that may see it and the reach policy that says through which channels it
 * comes and how a destruction is confirmed. The command line, the tool server and the documentation read this one table; a test holds that its facts do not contradict each other.
 *
 * @example
 * ```ts
 * import { VERBS, verbIds } from "./verbs.ts";
 * VERBS["rm"].effect; // "destructive"
 * verbIds().includes("ls"); // true
 * ```
 *
 * @module
 */
import type { Channel, ConfirmationClass, Effect, Kind } from "@intellectual-frontiers/headless/governance";
import type { TierId } from "./tiers.ts";

/** The words of every verb of the program, as a person types them: a closed union. */
export type VerbId =
  | "ls"
  | "cat"
  | "stat"
  | "head"
  | "tail"
  | "find"
  | "du"
  | "tree"
  | "grep"
  | "diff"
  | "sha256sum"
  | "put"
  | "mkdir"
  | "touch"
  | "cp"
  | "mv"
  | "rm"
  | "sync"
  | "bisync"
  | "merge"
  | "sync-medium"
  | "check"
  | "mirror status"
  | "mirror sync"
  | "mirror promote"
  | "places"
  | "doctor";

/** What a verb is. */
export type VerbFacts = {
  readonly id: VerbId;
  readonly summary: string;
  readonly kind: Kind;
  readonly effect: Effect;
  /** Whether running it again with the same input changes nothing more. */
  readonly idempotent: boolean;
  /** Whether `--dry-run` previews what it would change. */
  readonly dryRun: boolean;
  /** The lowest tier that sees it. */
  readonly tier: TierId;
  /** The channels it comes through. */
  readonly channels: readonly Channel[];
  /** How it is confirmed: a destruction by a flag from a person (and, from a tool server, only as a preview). */
  readonly confirmation: ConfirmationClass;
};

const READ: readonly Channel[] = ["local", "ssh", "mcp", "rest"];
const CHANGE: readonly Channel[] = ["local", "mcp"];

const report = (id: VerbId, summary: string): VerbFacts => ({ id, summary, kind: "report", effect: "read", idempotent: true, dryRun: false, tier: "reader", channels: READ, confirmation: "none" });
const change = (id: VerbId, summary: string, idempotent: boolean): VerbFacts => ({ id, summary, kind: "action", effect: "mutate", idempotent, dryRun: true, tier: "writer", channels: CHANGE, confirmation: "none" });
const destroy = (id: VerbId, summary: string): VerbFacts => ({ id, summary, kind: "action", effect: "destructive", idempotent: false, dryRun: true, tier: "writer", channels: CHANGE, confirmation: "flag" });

/** Every verb, by its words: a registry the compiler holds complete. */
export const VERBS: Readonly<Record<VerbId, VerbFacts>> = {
  ls: report("ls", "List what is in a directory of a store, or say what a file is."),
  cat: report("cat", "Write the bytes of files to standard output, byte for byte."),
  stat: report("stat", "Say what a name is in a store: its type, size, mode, time and revision."),
  head: report("head", "Write the first lines (or bytes) of a file."),
  tail: report("tail", "Write the last lines (or bytes) of a file."),
  find: report("find", "Find names below a directory of a store by name, type and size."),
  du: report("du", "Say how many bytes are below a directory of a store."),
  tree: report("tree", "Draw the directories and files below a directory of a store."),
  grep: report("grep", "Find lines that hold a text in files of a store, within a limit of files and bytes."),
  diff: report("diff", "Show how two files differ, as a unified diff; the exit says whether they do."),
  sha256sum: report("sha256sum", "Say the SHA-256 of the bytes of files in a store."),
  put: change("put", "Write standard input or a local file as a file of a store.", true),
  mkdir: change("mkdir", "Make a directory of a store, where a store keeps directories that persist; else say what it did instead.", true),
  touch: change("touch", "Make an empty file where there is none.", true),
  cp: change("cp", "Copy files, and directories with -r, within a store or from one store to another.", true),
  mv: destroy("mv", "Move files or directories, within a store or from one store to another: a copy that is checked, then the removal of the source."),
  rm: destroy("rm", "Remove files, or directories and everything below them with -r."),
  sync: destroy("sync", "Make a destination equal to a source: a plan first with its hash, then the apply that the hash approves."),
  merge: destroy("merge", "Bring two stores that merge together: a plan first with its hash (what each takes from the other), then the apply that the hash approves; there is no conflict to settle."),
  "sync-medium": change("sync-medium", "Exchange a store that merges with a shared place: publish its new rows as delta files and take the files of the others.", true),
  bisync: destroy("bisync", "Make two directories equal both ways against a recorded base, with a rule for what both changed."),
  check: report("check", "Compare two directories by content and say what differs; changes nothing."),
  "mirror status": report("mirror status", "Say whether a replica is in sync with its primary, behind it, or has diverged."),
  "mirror sync": destroy("mirror sync", "Bring a replica to its primary, never touching what the replica changed itself."),
  "mirror promote": destroy("mirror promote", "Make a replica the primary, saying what that loses."),
  places: report("places", "List the mounts of the configuration with their places, and what each kind of place is today."),
  doctor: report("doctor", "Say what is wrong with this computer's setup for the program, and the command for each."),
};

/** The ids of the verbs, in the order they are listed. */
export const VERB_IDS: readonly VerbId[] = [
  "ls", "cat", "stat", "head", "tail", "find", "du", "tree", "grep", "diff", "sha256sum", "put", "mkdir", "touch", "cp", "mv", "rm", "sync", "bisync", "merge", "sync-medium", "check", "mirror status", "mirror sync", "mirror promote", "places", "doctor",
];

/** The ids of the verbs, in the order they are listed. */
export function verbIds(): readonly VerbId[] {
  return VERB_IDS;
}
