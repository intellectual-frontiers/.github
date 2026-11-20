// Spec: 0008-repoctl-prove FR-011
/**
 * Which tests a change must run, and which it may leave out (commons repoctl 0008-repoctl-prove FR-011, FR-012, FR-014): a test runs when anything it transitively imports changed (the selector by imports), when a requirement named by
 * a changed file's `// Spec:` line is proved by it (the selector by the trace register), or, for a seam, when its library imports a changed symbol of the provider; a test of a suite that reads the tree is never left out (a seam is about symbols, so it runs the tests that import them); a quarantined test is
 * reported and not run until its expiry; and the key of a result in the cache is a hash of everything that decides it.
 *
 * @remarks
 * The functions are pure: the Physical layer reads the files, resolves the imports and runs the tests, and these decide. A test leaves out only what it cannot reach, so the selectors only ever add a test to the run.
 *
 * @limits
 * A test that reads a file by a path it builds at run time is found only where it names the checkout (`CHECKOUT`, `import.meta`, `process.cwd`): it is then `environmental` and runs whenever its library is proved.
 *
 * @example
 * ```ts
 * import { specIdsOf } from "./select.ts";
 * specIdsOf("// Spec: 0003-repoctl-sync FR-002, FR-003\n"); // ["0003-repoctl-sync FR-002", "0003-repoctl-sync FR-003"]
 * ```
 *
 * @module
 */
import type { LibraryName, QuarantineEntry } from "@intellectual-frontiers/repoctl/governance";
import { type SurfaceDelta, type Usage } from "./surface.ts";

/** A test file as the selectors read it: where it is, what it reaches, whether it reads the tree, which requirements it proves and what its library imports of other libraries through it. */
export type TestReach = {
  readonly library: LibraryName;
  /** The path from the repository's root. */
  readonly path: string;
  /** What it transitively imports: files, and folders (ending with `/`) where an import could not be resolved to a file. */
  readonly depends: readonly string[];
  /** Whether it reads the checkout, so that no change can be shown not to reach it. */
  readonly environmental: boolean;
  /** The requirements it proves, as `<spec> FR-nnn`. */
  readonly proves: readonly string[];
  /** What the files of its own library that it reaches import of each other library. */
  readonly uses: readonly { readonly provider: LibraryName; readonly usage: Usage }[];
};

/** Why a test is in the run. */
export type Selector = "import" | "trace" | "symbol" | "environmental" | "everything";

/** The tests that run, each with why, and those left out. */
export type Selection = {
  readonly run: readonly { readonly test: TestReach; readonly by: Selector }[];
  readonly left: readonly TestReach[];
};

/** The requirements a text names on its `Spec:` lines, as `<spec> FR-nnn`, the list after a spec expanded. */
export function specIdsOf(text: string): readonly string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(/\bSpec:\s*([^\n]*)/g)) {
    const spec = /(\d{4}-[a-z0-9-]+)\s+(FR-\d+(?:\s*,\s*FR-\d+)*)/.exec(m[1] ?? "");
    if (spec?.[1] === undefined || spec[2] === undefined) continue;
    for (const fr of spec[2].split(",")) ids.add(`${spec[1]} ${fr.trim()}`);
  }
  return [...ids].sort();
}

/** The requirements a test proves: the identifiers in its `proves([...])` calls. */
export function provesOf(text: string): readonly string[] {
  const ids = new Set<string>();
  for (const call of text.matchAll(/\bproves\(\s*\[([^\]]*)\]/g)) for (const id of (call[1] ?? "").matchAll(/["'`]([^"'`]+)["'`]/g)) if (id[1] !== undefined) ids.add(id[1]);
  return [...ids].sort();
}

/** The specification a path of a specification's own folder names (`.../specs/0008-repoctl-prove/spec.md`), where it is one. */
export function specOfPath(path: string): string | undefined {
  return /\/specs\/(\d{4}-[a-z0-9-]+)\//.exec(path)?.[1];
}

const ENVIRONMENT = /\bCHECKOUT\b|import\.meta\.(?:url|dirname|dir)\b|\bprocess\.cwd\(|\bfromFileUrl\(/;

/** Whether a text reads the checkout: the tests that do are never left out. */
export function readsTheTree(text: string): boolean {
  return ENVIRONMENT.test(text);
}

const reaches = (depends: readonly string[], path: string): boolean => depends.some((d) => (d.endsWith("/") ? path.startsWith(d) : d === path));

/** The tests of a suite that a change must run: by imports, by the trace register, and the ones that read the tree; the others are left out. `everything` runs them all (the plan is every proof). */
export function selectTests(tests: readonly TestReach[], changed: readonly { readonly path: string; readonly text: string }[], everything: boolean): Selection {
  const ids = new Set(changed.flatMap((c) => [...specIdsOf(c.text), ...(specOfPath(c.path) === undefined ? [] : [`${specOfPath(c.path)} `])]));
  const run: { test: TestReach; by: Selector }[] = [];
  const left: TestReach[] = [];
  for (const test of tests) {
    const by: Selector | undefined = everything
      ? "everything"
      : changed.some((c) => reaches(test.depends, c.path) || c.path === test.path)
        ? "import"
        : test.proves.some((p) => ids.has(p) || [...ids].some((i) => i.endsWith(" ") && p.startsWith(i)))
          ? "trace"
          : test.environmental && changed.length > 0
            ? "environmental"
            : undefined;
    if (by === undefined) left.push(test);
    else run.push({ test, by });
  }
  return { run, left };
}

/** The tests of a consumer that a change of the symbols of a provider must run: those whose library files import one of them (or everything from the provider). */
export function selectSeam(tests: readonly TestReach[], provider: LibraryName, delta: SurfaceDelta): Selection {
  const run: { test: TestReach; by: Selector }[] = [];
  const left: TestReach[] = [];
  for (const test of tests) {
    const usage = test.uses.find((u) => u.provider === provider)?.usage;
    const hit = usage !== undefined && (delta.kind === "unknown" || usage.all || (delta.kind === "changed" && usage.names.some((n) => delta.symbols.includes(n))));
    if (hit) run.push({ test, by: "symbol" });
    else left.push(test);
  }
  return { run, left };
}

/** The tests of a run split by the quarantine record on a day (`YYYY-MM-DD`): those that run, those held back with their entry, and the entries that have expired (their tests run again). */
export function applyQuarantine<T extends { readonly test: TestReach }>(
  selected: readonly T[],
  entries: readonly QuarantineEntry[],
  today: string,
): { readonly run: readonly T[]; readonly held: readonly { readonly item: T; readonly entry: QuarantineEntry }[]; readonly expired: readonly QuarantineEntry[] } {
  const live = entries.filter((e) => e.expires >= today);
  const run: T[] = [];
  const held: { item: T; entry: QuarantineEntry }[] = [];
  for (const item of selected) {
    const entry = live.find((e) => e.test === item.test.path);
    if (entry === undefined) run.push(item);
    else held.push({ item, entry });
  }
  return { run, held, expired: entries.filter((e) => e.expires < today) };
}

/** The seeds and counterexamples a failing property test printed, so that a failure says how to reproduce it. */
export function seedsOf(output: string): readonly string[] {
  const out = new Set<string>();
  for (const m of output.matchAll(/\bseed:\s*(-?\d+)/g)) out.add(`seed ${m[1] ?? ""}`);
  for (const m of output.matchAll(/Counterexample:\s*([^\n]+)/g)) out.add(`counterexample ${m[1] ?? ""}`);
  return [...out];
}

/** The key of a result: the same text for the same test, the same sources it imports and the same runtime, so that a cache holds a result by it. The hashes are given: one for the test, one for each source it imports. */
export function cacheKeyOf(parts: { readonly runtime: string; readonly library: LibraryName; readonly test: string; readonly hashes: readonly (readonly [string, string])[] }): string {
  return JSON.stringify([parts.runtime, parts.library, parts.test, ...[...parts.hashes].sort(([a], [b]) => (a < b ? -1 : 1))]);
}
