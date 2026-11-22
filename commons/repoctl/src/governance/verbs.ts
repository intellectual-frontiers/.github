// Spec: 0002-repoctl-governance FR-002
/**
 * The verbs of Repoctl as facts (commons repoctl 0002-repoctl-governance FR-002, FR-003; commons headless 0002-headless-governance, 0005-reach-and-targets): each verb is declared once, with what it is (a report or an action), what it may
 * do (`read`, `mutate`, `destructive`), whether repeating it is safe, whether it previews and checks, the tier that may see it and the reach policy that says through which channels it comes and how a destruction is confirmed. The
 * command line, the tool server and the documentation read this one table; a test holds that its facts do not contradict each other.
 *
 * @example
 * ```ts
 * import { VERBS, verbIds } from "./verbs.ts";
 * VERBS["release publish"].effect; // "destructive"
 * verbIds().includes("sync"); // true
 * ```
 *
 * @module
 */
import type { Channel, ConfirmationClass, Effect, Kind } from "@intellectual-frontiers/headless/governance";
import type { TierId } from "./tiers.ts";

/** The words of every verb, as a person types them: a closed union. */
export type VerbId = "sync" | "merge" | "check" | "status" | "hygiene" | "release plan" | "release apply" | "release publish" | "new library" | "commit" | "doctor" | "prove" | "docs build" | "docs serve" | "docs check" | "query" | "usage" | "mcp";

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
  /** Whether `--check` ends with findings where it would change something. */
  readonly check: boolean;
  /** The lowest tier that sees it. */
  readonly tier: TierId;
  /** The channels it comes through. */
  readonly channels: readonly Channel[];
  /** How it is confirmed: a destruction by a person (and, from a tool server, only as a preview). */
  readonly confirmation: ConfirmationClass;
  /** The options only a person may give. */
  readonly humanOnly: readonly string[];
};

/** Every verb, by its words: a registry the compiler holds complete. */
export const VERBS: Readonly<Record<VerbId, VerbFacts>> = {
  sync: {
    id: "sync",
    summary: "Make every generated file, in dependency order, rerunning only the generators whose output is stale.",
    kind: "action",
    effect: "mutate",
    idempotent: true,
    dryRun: true,
    check: true,
    tier: "contributor",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  merge: {
    id: "merge",
    summary: "Merge a reference, regenerate the generated files that conflict and report the conflicts in files a person wrote.",
    kind: "action",
    effect: "mutate",
    idempotent: false,
    dryRun: false,
    check: false,
    tier: "contributor",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  check: {
    id: "check",
    summary: "Run every check of the repository (generated files, specifications, rules, versions) and say what is wrong in one report.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  status: {
    id: "status",
    summary: "Tell, for each library, its version in the repository, on npm and in its tag.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  hygiene: {
    id: "hygiene",
    summary: "Say whether this repository consumes commons as published packages: no Git or path dependency, no vendored copy, one copy of each library, exact versions.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  query: {
    id: "query",
    summary: "Ask the libraries, their specifications and their requirements in SQL: one read-only SELECT over the relations libraries, specs and requirements.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  usage: {
    id: "usage",
    summary: "Say what this repository uses of the package @intellectual-frontiers/commons: the libraries it imports, those reached through them and those never touched, with their sizes.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  "release plan": {
    id: "release plan",
    summary: "Say what a release would do, library by library and why; writes nothing.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  "release apply": {
    id: "release apply",
    summary: "Make a release: raise the versions the plan says, make the generated files, run the tests that pack and write the record; commits nothing.",
    kind: "action",
    effect: "mutate",
    idempotent: false,
    dryRun: true,
    check: false,
    tier: "contributor",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  "release publish": {
    id: "release publish",
    summary: "Publish the packed libraries of the release record to npm, behind the releaser tier and a typed confirmation.",
    kind: "action",
    effect: "destructive",
    idempotent: false,
    dryRun: true,
    check: false,
    tier: "releaser",
    channels: ["local", "mcp"],
    confirmation: "person",
    humanOnly: ["confirm"],
  },
  "new library": {
    id: "new library",
    summary: "Scaffold a library of commons: its folder, manifest, about.ts, specification kit, tools, tsconfig and LICENSE, and make what needs it again.",
    kind: "action",
    effect: "mutate",
    idempotent: false,
    dryRun: true,
    check: false,
    tier: "contributor",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  commit: {
    id: "commit",
    summary: "Make the commit with the repository's identity and trailers, refusing what must not be committed, after the generated files are checked.",
    kind: "action",
    effect: "mutate",
    idempotent: false,
    dryRun: true,
    check: false,
    tier: "contributor",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  doctor: {
    id: "doctor",
    summary: "Say what is wrong with this checkout (dependencies, links, Node, Bun, stale generated files) and what to do about it.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  prove: {
    id: "prove",
    summary: "Compute the proof a change needs from its blast radius (the tiers, the tests and why each skipped proof is safe) and run it.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  "docs build": {
    id: "docs build",
    summary: "Build the documentation site of this repository with the documentation generator, into the folder its configuration names.",
    kind: "action",
    effect: "mutate",
    idempotent: true,
    dryRun: true,
    check: false,
    tier: "contributor",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  "docs serve": {
    id: "docs serve",
    summary: "Build the documentation site and serve it on a loopback port of this computer until the run is stopped; nothing is uploaded.",
    kind: "action",
    effect: "mutate",
    idempotent: true,
    dryRun: true,
    check: false,
    tier: "contributor",
    channels: ["local"],
    confirmation: "none",
    humanOnly: [],
  },
  "docs check": {
    id: "docs check",
    summary: "Build the documentation site into a temporary folder and say every finding, writing nothing in the repository.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local", "mcp"],
    confirmation: "none",
    humanOnly: [],
  },
  mcp: {
    id: "mcp",
    summary: "Serve the verbs the held tier sees as tools of a tool server on standard input and output.",
    kind: "report",
    effect: "read",
    idempotent: true,
    dryRun: false,
    check: false,
    tier: "public",
    channels: ["local"],
    confirmation: "none",
    humanOnly: [],
  },
};

/** The words of every verb, in the order the help lists them. */
export function verbIds(): readonly VerbId[] {
  return ["check", "sync", "merge", "status", "hygiene", "release plan", "release apply", "release publish", "new library", "commit", "doctor", "prove", "docs build", "docs serve", "docs check", "query", "usage", "mcp"];
}
