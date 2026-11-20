// Spec: 0007-repoctl-prove FR-003
/**
 * The proof plan as a pure function (commons repoctl 0007-repoctl-prove FR-003 to FR-009): each changed file is classified by its path and its content at the base and now; the classes give the proofs of the tiers; a change
 * inside a library asks the fingerprint of its public surface (and of the surfaces of the importers it reaches) to decide who must be proved again; every proof left out says why. Nothing here reads a file or runs a program: the
 * Physical layer gives the changed files, the import graph and the surfaces, and asks again where the planner says it needs a surface it was not given.
 *
 * @remarks
 * `planProof` answers either with the plan or with the libraries whose surface it still needs, so that the compiler is asked only for the libraries the reach touches. The same input gives the same plan, in the same order.
 *
 * @limits
 * It plans T0 to T6 and runs nothing; the caller decides which tiers run where. A change it cannot classify is `outside`, and a change it cannot explain (Git that does not say) plans everything.
 *
 * @example
 * ```ts
 * import { classifyFile } from "./prove.ts";
 * classifyFile({ path: "README.md", before: "a", after: "b" }, () => undefined).class; // "prose"
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import {
  type ChangeClass,
  CHANGE_CLASSES,
  CLASS_RULES,
  type LibraryName,
  PLANNER_GLOBS,
  type Proof,
  PROOF_TIER_IDS,
  PROOF_TIERS,
  proofKey,
  type ProofTier,
  type SkipReason,
  tierOfProof,
} from "@intellectual-frontiers/repoctl/governance";
import { matches } from "./glob.ts";
import { codeOf, type SurfaceDelta, type Usage } from "./surface.ts";

/** A file that changed: its path and its text at the base and now (none where it was not there). */
export type ChangedFile = { readonly path: string; readonly before: string | undefined; readonly after: string | undefined };

/** A changed file with its class and the library whose folder holds it, where one does. */
export type ClassifiedFile = { readonly path: string; readonly class: ChangeClass; readonly library: LibraryName | undefined };

/** What one library imports from another. */
export type Use = { readonly provider: LibraryName; readonly usage: Usage };

/** A library as the planner reads it: its place, what it imports from other libraries, whether it is foundation, and the systems it has code of its own for. */
export type LibraryNode = {
  readonly name: LibraryName;
  readonly folder: string;
  readonly foundation: boolean;
  readonly uses: readonly Use[];
  readonly systems: readonly ("windows" | "macos")[];
};

/** The surface of one library as the planner needs it: how it differs from the base, and the identifiers its declarations mention. */
export type LibrarySurface = { readonly delta: SurfaceDelta; readonly mentions: readonly string[] };

/** Everything the planner reads. */
export type ProofInput = {
  readonly base: string;
  /** Whether Git said what changed; where it did not, the plan is everything. */
  readonly gitKnown: boolean;
  /** Plan everything (`--all`). */
  readonly all: boolean;
  readonly changed: readonly ChangedFile[];
  readonly libraries: readonly LibraryNode[];
  readonly surfaces: ReadonlyMap<LibraryName, LibrarySurface>;
  /** The libraries that read the files that no library holds. */
  readonly outsideReaders: readonly LibraryName[];
};

/** Why a proof is in the plan. */
export type Why =
  | { readonly kind: "class"; readonly class: ChangeClass; readonly files: number }
  | { readonly kind: "surface"; readonly provider: LibraryName; readonly symbols: readonly string[] }
  | { readonly kind: "surface-unknown"; readonly provider: LibraryName; readonly why: string }
  | { readonly kind: "foundation"; readonly library: LibraryName }
  | { readonly kind: "everything"; readonly because: string };

/** A proof of the plan with its tier and why. */
export type PlannedProof = { readonly proof: Proof; readonly tier: ProofTier; readonly why: Why };

/** A proof left out, the tier it would have been in, what it would have proved, the reason and the sentence that says why leaving it out is safe. */
export type SkippedProof = { readonly tier: ProofTier; readonly subject: string; readonly reason: SkipReason; readonly because: string };

/** The proof plan of a change. */
export type ProofPlan = {
  readonly base: string;
  readonly files: readonly ClassifiedFile[];
  readonly classes: readonly ChangeClass[];
  readonly proofs: readonly PlannedProof[];
  readonly skipped: readonly SkippedProof[];
  readonly libraries: { readonly total: number; readonly proven: readonly LibraryName[] };
};

/** The planner's answer: the plan, or the libraries whose surface it needs first. */
export type PlanStep = { readonly kind: "plan"; readonly plan: ProofPlan } | { readonly kind: "needs"; readonly libraries: readonly LibraryName[] };

const LIBRARY_FILE = /^commons\/([a-z][a-z0-9-]*)\//;
const CODE = /\.(?:ts|mts|mjs|js)$/;

const specLines = (text: string): string => text.split("\n").filter((l) => /\bSpec:\s/.test(l)).join("\n");
const requirementIds = (text: string): string => [...new Set(text.match(/\*\*FR-\d+\*\*/g) ?? [])].sort().join(",");

function jsonWithout(text: string | undefined, key: string): string | undefined {
  if (text === undefined) return undefined;
  try {
    const x: unknown = JSON.parse(text);
    if (typeof x !== "object" || x === null || Array.isArray(x)) return text;
    return JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => k !== key)));
  } catch {
    return text;
  }
}

const withoutVersion = (text: string | undefined): string | undefined => text?.replace(/\bversion\s*[:=]\s*["'][^"']*["']/g, "version").replace(/\b[A-Z_]*VERSION\s*=\s*["'][^"']*["']/g, "VERSION");

/** The class of a changed file, by its path and its content at the base and now; `libraryOf` says which library's folder holds a path. */
export function classifyFile(change: ChangedFile, libraryOf: (path: string) => LibraryName | undefined): ClassifiedFile {
  const { path, before, after } = change;
  const library = libraryOf(path);
  const is = (cls: ChangeClass): ClassifiedFile => ({ path, class: cls, library });
  const base = path.split("/").pop() ?? path;
  if (PLANNER_GLOBS.some((g) => matches(g, path))) return is("planner");
  if (path.endsWith("pack-library.ts")) return is("packaging");
  if (path === "commons/generated/release.auto.json") return is("version");
  if (path.startsWith("commons/generated/") || /\.auto\.[a-z]+$/.test(base) || base === "LICENSE" || base === "THIRD_PARTY_NOTICES.md" || /^\.github\/workflows\/.*\.auto\.yml$/.test(path)) return is("generated");
  if (base === "package.json") {
    if (before === undefined || after === undefined) return is("packaging");
    return jsonWithout(before, "version") === jsonWithout(after, "version") ? is("version") : is("packaging");
  }
  if (base === "library.ts" || base === "release.ts") {
    if (before === undefined || after === undefined) return is("packaging");
    return withoutVersion(before) === withoutVersion(after) ? is("version") : is("packaging");
  }
  if (path.includes("/spec-kit/") || path.startsWith("spec-kit/")) {
    if (path.endsWith("spec.md")) return requirementIds(before ?? "") === requirementIds(after ?? "") ? is("spec") : is("spec-requirements");
    return is("spec");
  }
  if (/\.(?:md|html|txt)$/.test(base)) return is("prose");
  if (CODE.test(base)) {
    if (before !== undefined && after !== undefined && codeOf(before) === codeOf(after)) return specLines(before) === specLines(after) ? is("prose") : is("spec");
    if (library === undefined) return is("outside");
    return base.endsWith(".test.ts") || path.includes("/suite/") ? is("test") : is("source");
  }
  return library === undefined ? is("outside") : is("source");
}

/** The classes of the files, in the order of the table, each once. */
export function classesOf(files: readonly ClassifiedFile[]): readonly ChangeClass[] {
  return CHANGE_CLASSES.filter((c) => files.some((f) => f.class === c));
}

/** The library whose folder holds a path of the repository, among these. */
export function libraryOfPath(libraries: readonly { readonly name: LibraryName; readonly folder: string }[]): (path: string) => LibraryName | undefined {
  return (path) => {
    const m = LIBRARY_FILE.exec(path);
    return m === null ? undefined : libraries.find((l) => l.folder === `commons/${m[1] ?? ""}`)?.name;
  };
}

const planned = (proof: Proof, why: Why): PlannedProof => ({ proof, tier: tierOfProof(proof), why });

/** The proofs of every tier for these libraries: what a change to the planner, `--all` and the release plan. */
export function everything(libraries: readonly LibraryNode[], why: Why): readonly PlannedProof[] {
  const proofs: Proof[] = [{ kind: "docs-check" }, { kind: "spec-check", scope: "repository" }, { kind: "sync-check" }, { kind: "versions-check" }, { kind: "end-to-end" }, { kind: "release-gate" }];
  for (const l of libraries) {
    proofs.push({ kind: "types", library: l.name }, { kind: "trace-check", library: l.name }, { kind: "suite", library: l.name }, { kind: "pack", library: l.name });
    if (l.foundation) proofs.push({ kind: "smoke", library: l.name });
    for (const system of l.systems) proofs.push({ kind: "platform", library: l.name, system });
    for (const u of l.uses) proofs.push({ kind: "seam", provider: u.provider, consumer: l.name });
  }
  return proofs.map((p) => planned(p, why));
}

const listOf = (xs: readonly string[], n = 6): string => (xs.length <= n ? xs.join(", ") : `${xs.slice(0, n).join(", ")} and ${xs.length - n} more`);

/** The sentence that says why a proof is in the plan. */
export function whySentence(w: Why): string {
  switch (w.kind) {
    case "class":
      return `${w.files} ${w.files === 1 ? "file is" : "files are"} ${w.class}: ${CLASS_RULES[w.class].means}`;
    case "surface":
      return `the public surface of ${w.provider} changed in ${listOf(w.symbols)}, which this library imports`;
    case "surface-unknown":
      return `the public surface of ${w.provider} cannot be compared (${w.why}), so every importer is reached`;
    case "foundation":
      return `${w.library} is a foundation library: its smoke gate runs before anything wider`;
    case "everything":
      return w.because;
    default:
      return absurd(w);
  }
}

/** The sentence that says why leaving a proof out is safe. */
export function skipSentence(s: SkippedProof): string {
  return `${s.subject}: ${s.because}`;
}

/** A name of the proof for a person. */
export function proofLabel(p: Proof): string {
  switch (p.kind) {
    case "docs-check":
      return "documentation check";
    case "spec-check":
      return `specification check (${p.scope})`;
    case "trace-check":
      return `trace check of ${p.library}`;
    case "types":
      return `types of ${p.library}`;
    case "sync-check":
      return "sync --check";
    case "versions-check":
      return "versions check";
    case "suite":
      return `suite of ${p.library}`;
    case "smoke":
      return `smoke gate of ${p.library}`;
    case "seam":
      return `seam ${p.provider} to ${p.consumer}`;
    case "pack":
      return `tarball of ${p.library}`;
    case "end-to-end":
      return "end-to-end flows";
    case "platform":
      return `${p.library} on ${p.system}`;
    case "release-gate":
      return "release gate";
    default:
      return absurd(p);
  }
}

type Reach = { readonly changed: ReadonlySet<string> | "all"; readonly via: Why };

/** The plan of a change, or the libraries whose surface it needs to be given first. */
export function planProof(input: ProofInput): PlanStep {
  const libs = new Map(input.libraries.map((l) => [l.name, l]));
  const total = input.libraries.length;
  const files = input.changed.map((c) => classifyFile(c, libraryOfPath(input.libraries)));
  const classes = classesOf(files);
  const finish = (proofs: readonly PlannedProof[], skipped: readonly SkippedProof[]): PlanStep => {
    const byKey = new Map<string, PlannedProof>();
    for (const p of proofs) if (!byKey.has(proofKey(p.proof))) byKey.set(proofKey(p.proof), p);
    const ordered = [...byKey.values()].sort((a, b) => PROOF_TIER_IDS.indexOf(a.tier) - PROOF_TIER_IDS.indexOf(b.tier) || (proofKey(a.proof) < proofKey(b.proof) ? -1 : 1));
    const proven = [...new Set(ordered.flatMap((p) => ("library" in p.proof ? [p.proof.library] : "consumer" in p.proof ? [p.proof.consumer] : [])))].sort();
    const tierSkips = PROOF_TIER_IDS.filter((t) => !ordered.some((p) => p.tier === t)).map(
      (t): SkippedProof =>
        t === "T4" || t === "T5" || t === "T6"
          ? { tier: t, subject: `${t} ${PROOF_TIERS[t].name}`, reason: "tier-scheduled", because: `it runs on ${PROOF_TIERS[t].runsOn.filter((o) => o !== "edit" && o !== "push").join(", ")}, and this change reaches none of what it proves` }
          : { tier: t, subject: `${t} ${PROOF_TIERS[t].name}`, reason: "class-needs-none", because: `no class of this change needs it (${classes.map((c) => c).join(", ") || "no change"})` },
    );
    const plan: ProofPlan = { base: input.base, files, classes, proofs: ordered, skipped: [...skipped, ...tierSkips], libraries: { total, proven } };
    return { kind: "plan", plan };
  };
  if (input.all) return finish(everything(input.libraries, { kind: "everything", because: "--all plans every proof of every tier" }), []);
  if (!input.gitKnown) return finish(everything(input.libraries, { kind: "everything", because: "Git cannot say what changed, so nothing can be shown safe to skip" }), []);
  const planner = files.find((f) => f.class === "planner");
  if (planner !== undefined) return finish(everything(input.libraries, { kind: "everything", because: `${planner.path} is the planner, a generator or a tier rule: nothing it decides can be shown safe to skip` }), []);

  const proofs: PlannedProof[] = [];
  const skipped: SkippedProof[] = [];
  const add = (proof: Proof, why: Why): void => {
    proofs.push(planned(proof, why));
  };
  const sourceLibs = new Set<LibraryName>();
  for (const f of files) {
    const why: Why = { kind: "class", class: f.class, files: files.filter((x) => x.class === f.class).length };
    const lib = f.library;
    switch (f.class) {
      case "prose":
        add({ kind: "docs-check" }, why);
        break;
      case "spec":
        add({ kind: "spec-check", scope: lib ?? "repository" }, why);
        if (lib !== undefined) add({ kind: "trace-check", library: lib }, why);
        break;
      case "spec-requirements":
        add({ kind: "spec-check", scope: lib ?? "repository" }, why);
        if (lib !== undefined) add({ kind: "trace-check", library: lib }, why);
        if (lib !== undefined) add({ kind: "suite", library: lib }, why);
        break;
      case "generated":
        add({ kind: "sync-check" }, why);
        break;
      case "version":
        add({ kind: "versions-check" }, why);
        break;
      case "test":
        if (lib !== undefined) {
          add({ kind: "types", library: lib }, why);
          add({ kind: "trace-check", library: lib }, why);
          add({ kind: "suite", library: lib }, why);
        }
        break;
      case "source":
        if (lib !== undefined) {
          sourceLibs.add(lib);
          add({ kind: "types", library: lib }, why);
          add({ kind: "trace-check", library: lib }, why);
          add({ kind: "suite", library: lib }, why);
        }
        break;
      case "packaging":
        for (const l of lib === undefined ? input.libraries : input.libraries.filter((x) => x.name === lib)) add({ kind: "pack", library: l.name }, why);
        break;
      case "planner":
        break;
      case "outside":
        add({ kind: "spec-check", scope: "repository" }, why);
        add({ kind: "end-to-end" }, why);
        for (const l of input.outsideReaders) {
          add({ kind: "types", library: l }, why);
          add({ kind: "suite", library: l }, why);
        }
        break;
      default:
        return absurd(f.class);
    }
  }

  // the reach of a change inside a library: who imports what changed
  const need: LibraryName[] = [];
  const reached = new Map<string, Reach>();
  const visit = (provider: LibraryName, changed: ReadonlySet<string> | "all", via: Why): void => {
    const importers = input.libraries.filter((l) => l.uses.some((u) => u.provider === provider));
    for (const x of importers) {
      const usage = x.uses.find((u) => u.provider === provider)?.usage;
      if (usage === undefined) continue;
      if (changed !== "all" && changed.size === 0) {
        skipped.push({ tier: "T2", subject: `seam ${provider} to ${x.name}`, reason: "surface-unchanged", because: `the public surface of ${provider} is the same as at ${input.base}, so ${x.name} cannot see the change` });
        continue;
      }
      const hit = changed === "all" || usage.all || usage.names.some((n) => changed.has(n));
      if (!hit) {
        skipped.push({ tier: "T2", subject: `seam ${provider} to ${x.name}`, reason: "symbols-unused", because: `${x.name} imports ${listOf(usage.names, 4) || "nothing by name"} of ${provider}, none of the changed symbols` });
        continue;
      }
      const key = `${provider}>${x.name}`;
      if (reached.has(key)) continue;
      reached.set(key, { changed, via });
      add({ kind: "types", library: x.name }, via);
      add({ kind: "seam", provider, consumer: x.name }, via);
      const surface = input.surfaces.get(x.name);
      if (surface === undefined) {
        if (!need.includes(x.name)) need.push(x.name);
        continue;
      }
      const onward = changed === "all" ? "all" : new Set(surface.mentions.filter((m) => changed.has(m)));
      if (onward === "all" || onward.size > 0) visit(x.name, onward, { kind: "surface", provider: x.name, symbols: onward === "all" ? [] : [...onward].sort() });
    }
  };
  for (const name of [...sourceLibs].sort()) {
    const surface = input.surfaces.get(name);
    if (surface === undefined) {
      need.push(name);
      continue;
    }
    const node = libs.get(name);
    if (node?.foundation === true) add({ kind: "smoke", library: name }, { kind: "foundation", library: name });
    const d = surface.delta;
    switch (d.kind) {
      case "same":
        visit(name, new Set(), { kind: "surface", provider: name, symbols: [] });
        break;
      case "changed":
        visit(name, new Set(d.symbols), { kind: "surface", provider: name, symbols: d.symbols });
        break;
      case "unknown":
        visit(name, "all", { kind: "surface-unknown", provider: name, why: d.why });
        break;
      default:
        return absurd(d);
    }
  }
  if (need.length > 0) return { kind: "needs", libraries: [...new Set(need)].sort() };
  for (const name of sourceLibs) {
    const node = libs.get(name);
    for (const system of node?.systems ?? []) skipped.push({ tier: "T5", subject: `${name} on ${system}`, reason: "tier-scheduled", because: "platform proofs run on main and nightly" });
  }
  return finish(proofs, skipped);
}
