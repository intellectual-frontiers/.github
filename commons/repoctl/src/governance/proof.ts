// Spec: 0007-repoctl-prove FR-002
/**
 * The facts of proof proportional to blast radius (commons repoctl 0007-repoctl-prove FR-002 to FR-005, FR-009): the seven tiers of proof with their budgets, the change classes with the proofs each one needs, the proofs
 * as a closed union (each belongs to exactly one tier by an exhaustive function), the reasons a proof is left out, the foundation libraries and the files whose change is every proof's change. The planner of the Logical layer
 * reads these tables and decides nothing of its own that is not here.
 *
 * @example
 * ```ts
 * import { CLASS_RULES, tierOfProof } from "./proof.ts";
 * CLASS_RULES.prose.tiers; // ["T0"]
 * tierOfProof({ kind: "sync-check" }); // "T0"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { absurd } from "@intellectual-frontiers/core";
import type { LibraryName } from "./ids.ts";

/** The seven tiers of proof, cheapest first: a closed union. */
export type ProofTier = "T0" | "T1" | "T2" | "T3" | "T4" | "T5" | "T6";

/** Every tier of proof, cheapest first. */
export const PROOF_TIER_IDS: readonly ProofTier[] = ["T0", "T1", "T2", "T3", "T4", "T5", "T6"];

/** When a tier runs. */
export type Occasion = "edit" | "push" | "main" | "nightly" | "release";

/** What a tier is: its name, what it proves, its budget in seconds and the occasions it runs on. */
export type TierFacts = {
  readonly id: ProofTier;
  readonly name: string;
  readonly proves: string;
  readonly budgetSeconds: number;
  readonly runsOn: readonly Occasion[];
};

/** The tiers of proof by their words. */
export const PROOF_TIERS: Readonly<Record<ProofTier, TierFacts>> = {
  T0: { id: "T0", name: "static", proves: "types, format, specification and trace checks, on the affected files alone", budgetSeconds: 10, runsOn: ["edit", "push", "main", "nightly", "release"] },
  T1: { id: "T1", name: "library", proves: "the suite of one library, property tests included", budgetSeconds: 30, runsOn: ["edit", "push", "main", "nightly", "release"] },
  T2: { id: "T2", name: "seam", proves: "provider conformance and consumer seam tests where a provider's surface changed", budgetSeconds: 120, runsOn: ["push", "main", "nightly", "release"] },
  T3: { id: "T3", name: "packaging", proves: "a tarball packed, installed, imported and type-checked", budgetSeconds: 120, runsOn: ["push", "main", "nightly", "release"] },
  T4: { id: "T4", name: "end to end", proves: "the hermetic flows of a product", budgetSeconds: 600, runsOn: ["main", "nightly", "release"] },
  T5: { id: "T5", name: "platform", proves: "Windows, macOS and Node against Bun, for libraries with code of their own for a system", budgetSeconds: 600, runsOn: ["main", "nightly", "release"] },
  T6: { id: "T6", name: "release", proves: "everything, once per release", budgetSeconds: 1800, runsOn: ["release"] },
};

/** A tier from `3` or `T3`, or why the text is none. */
export function parseProofTier(text: string): Result<ProofTier, string> {
  const word = /^T?([0-6])$/.exec(text.trim());
  const found = PROOF_TIER_IDS.find((t) => t === `T${word?.[1] ?? ""}`);
  return found === undefined ? err(`${JSON.stringify(text)} is not a tier: 0 to 6, or T0 to T6`) : ok(found);
}

/** What a changed file is: a closed union. */
export type ChangeClass = "prose" | "spec" | "spec-requirements" | "generated" | "version" | "test" | "source" | "packaging" | "planner" | "outside";

/** Every class, in the order the table and the plan list them. */
export const CHANGE_CLASSES: readonly ChangeClass[] = ["prose", "spec", "spec-requirements", "generated", "version", "test", "source", "packaging", "planner", "outside"];

/** What a class is and what it needs: one row for each class. */
export type ClassRule = {
  readonly class: ChangeClass;
  readonly means: string;
  readonly proofs: string;
  readonly tiers: readonly ProofTier[];
};

/** The class rules: the one table the planner, the documentation and the tests read. */
export const CLASS_RULES: Readonly<Record<ChangeClass, ClassRule>> = {
  prose: { class: "prose", means: "a comment, TSDoc or text with no code change", proofs: "the documentation check", tiers: ["T0"] },
  spec: { class: "spec", means: "a specification whose requirement identifiers are unchanged", proofs: "the specification and trace checks", tiers: ["T0"] },
  "spec-requirements": { class: "spec-requirements", means: "a specification whose requirement identifiers changed", proofs: "the specification and trace checks, and the suite of the library", tiers: ["T0", "T1"] },
  generated: { class: "generated", means: "a file a generator makes", proofs: "sync --check: the bytes equal the generators'", tiers: ["T0"] },
  version: { class: "version", means: "a version or a release record only", proofs: "the versions check", tiers: ["T0"] },
  test: { class: "test", means: "a test file of a library", proofs: "types, trace and the suite of that library", tiers: ["T0", "T1"] },
  source: {
    class: "source",
    means: "code inside a library",
    proofs: "types, trace and the suite of the library; its importers only where the public surface changed, and only the importers of the changed symbols; a foundation library also its smoke gate",
    tiers: ["T0", "T1", "T2"],
  },
  packaging: { class: "packaging", means: "exports, package.json beyond its version, the packer", proofs: "pack, install, import and type-check the tarball", tiers: ["T0", "T3"] },
  planner: { class: "planner", means: "the planner, the generators, the workflows or the tier rules", proofs: "every proof of every tier", tiers: ["T0", "T1", "T2", "T3", "T4", "T5", "T6"] },
  outside: { class: "outside", means: "a file in no library that is none of the above", proofs: "the checks of the repository and the libraries that read the file", tiers: ["T0", "T1", "T4"] },
};

/** What a scope of the specification check is: one library's kit or the repository's. */
export type SpecScope = LibraryName | "repository";

/** A proof: one check or run, for a library where it has one. A closed union, so that every proof has its tier, its command and its sentence by an exhaustive match. */
export type Proof =
  | { readonly kind: "docs-check" }
  | { readonly kind: "spec-check"; readonly scope: SpecScope }
  | { readonly kind: "trace-check"; readonly library: LibraryName }
  | { readonly kind: "types"; readonly library: LibraryName }
  | { readonly kind: "sync-check" }
  | { readonly kind: "versions-check" }
  | { readonly kind: "suite"; readonly library: LibraryName }
  | { readonly kind: "smoke"; readonly library: LibraryName }
  | { readonly kind: "seam"; readonly provider: LibraryName; readonly consumer: LibraryName }
  | { readonly kind: "pack"; readonly library: LibraryName }
  | { readonly kind: "end-to-end" }
  | { readonly kind: "platform"; readonly library: LibraryName; readonly system: "windows" | "macos" }
  | { readonly kind: "release-gate" };

/** The tier a proof belongs to: every proof is in exactly one. */
export function tierOfProof(p: Proof): ProofTier {
  switch (p.kind) {
    case "docs-check":
    case "spec-check":
    case "trace-check":
    case "types":
    case "sync-check":
    case "versions-check":
      return "T0";
    case "suite":
    case "smoke":
      return "T1";
    case "seam":
      return "T2";
    case "pack":
      return "T3";
    case "end-to-end":
      return "T4";
    case "platform":
      return "T5";
    case "release-gate":
      return "T6";
    default:
      return absurd(p);
  }
}

/** The proof as one stable key: the same proof has the same key, so a plan holds each once. */
export function proofKey(p: Proof): string {
  switch (p.kind) {
    case "docs-check":
    case "sync-check":
    case "versions-check":
    case "end-to-end":
    case "release-gate":
      return p.kind;
    case "spec-check":
      return `${p.kind}:${p.scope}`;
    case "trace-check":
    case "types":
    case "suite":
    case "smoke":
    case "pack":
      return `${p.kind}:${p.library}`;
    case "seam":
      return `${p.kind}:${p.provider}>${p.consumer}`;
    case "platform":
      return `${p.kind}:${p.library}:${p.system}`;
    default:
      return absurd(p);
  }
}

/** Why a proof is left out: a closed union, each with one sentence in the plan. */
export type SkipReason = "class-needs-none" | "surface-unchanged" | "symbols-unused" | "tests-unaffected" | "cache-hit" | "tier-scheduled" | "quarantined";

/** Every reason, in the order of the documentation. */
export const SKIP_REASONS: readonly SkipReason[] = ["class-needs-none", "surface-unchanged", "symbols-unused", "tests-unaffected", "cache-hit", "tier-scheduled", "quarantined"];

/** The foundation libraries: what the rest of commons stands on, so a change of their behaviour runs a smoke gate before anything wider. */
export const FOUNDATION: readonly string[] = ["core", "formats", "crypto", "system", "terminal", "kanon", "libraries"];

/** The paths whose change is the change of every proof: the planner, the generators, the workflow definitions and the tier rules (globs; `*` is one segment, `**` any number). */
export const PLANNER_GLOBS: readonly string[] = [
  "commons/repoctl/src/governance/proof.ts",
  "commons/repoctl/src/governance/generators.ts",
  "commons/repoctl/src/logical/prove*.ts",
  "commons/repoctl/src/logical/surface.ts",
  "commons/repoctl/src/logical/select.ts",
  "commons/repoctl/src/physical/tests.ts",
  "commons/repoctl/src/physical/prove*.ts",
  "commons/repoctl/src/physical/verbs/prove.ts",
  "commons/libraries/src/affected.ts",
  "commons/libraries/src/plan.ts",
  "commons/libraries/src/dev.ts",
  "commons/libraries/src/generate-*.ts",
  "commons/libraries/src/libraries.ts",
  "commons/libraries/src/readme.ts",
  "commons/libraries/src/license.ts",
  "commons/libraries/src/workflows/**",
  "commons/tools/generate-*.ts",
];

/** A quarantined test: named by its path from the repository's root, with the person who owns getting it fixed, the day it must be fixed by (it runs again after) and why. */
export type QuarantineEntry = { readonly test: string; readonly owner: string; readonly expires: string; readonly reason: string };

/** The quarantine record from its JSON text, or why it is not one: a list of entries, each with a test, an owner, an expiry day (`YYYY-MM-DD`) and a reason. */
export function parseQuarantine(text: string): Result<readonly QuarantineEntry[], string> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err("the quarantine record is not JSON");
  }
  if (!Array.isArray(raw)) return err("the quarantine record is a list of entries");
  const entries: QuarantineEntry[] = [];
  for (const [i, e] of raw.entries()) {
    if (typeof e !== "object" || e === null) return err(`entry ${i} is not an object`);
    const field = (k: string): string => {
      const v: unknown = Object.entries(e).find(([name]) => name === k)?.[1];
      return typeof v === "string" ? v : "";
    };
    const entry = { test: field("test"), owner: field("owner"), expires: field("expires"), reason: field("reason") };
    if (entry.test === "" || entry.owner === "" || entry.reason === "") return err(`entry ${i} needs a test, an owner and a reason`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires)) return err(`entry ${i} needs an expiry day as YYYY-MM-DD`);
    entries.push(entry);
  }
  return ok(entries);
}
