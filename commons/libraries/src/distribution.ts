/**
 * The distribution mode of the repository (commons 0036-distribution FR-019, FR-020): how the libraries of commons reach a registry. There are two modes and no other. In `per-library` mode each library that names npm is a package of its
 * own, five metapackages install them as sets, and the release raises and publishes each library. In `single` mode the whole of commons is one package, `@intellectual-frontiers/commons`, with one version, one release record and one tag. The
 * source tree is the same in both: the folders, their specifications, their `verify`, their layers and their version fields do not change with the mode; only what is packed, released and published does.
 *
 * @remarks
 * The mode is one constant, {@link DISTRIBUTION}, which every program that packs, plans or generates for distribution reads through {@link activeMode}; changing it is one line and the generated files follow (`repoctl sync`). The environment
 * variable `IFC_DISTRIBUTION` names the other mode for one run, which is how the machinery of the mode that is not active is proved and how a release of it would be tried; a value that is not a mode is refused, never read as the default.
 * The machinery of the inactive mode is not deleted: it is switched off, so that the owner can switch back.
 *
 * @limits
 * It decides nothing about versions or registries; it names the mode and the one package of `single`.
 *
 * @example
 * ```ts
 * import { activeMode, parseMode } from "./distribution.ts";
 * activeMode(undefined); // { kind: "ok", value: "single" }
 * parseMode("per-library").kind; // "ok"
 * ```
 *
 * Spec: 0001-libraries FR-028
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The modes of distribution: a closed set. */
export const DISTRIBUTION_MODES = ["per-library", "single"] as const;
/** A mode of distribution. */
export type DistributionMode = (typeof DISTRIBUTION_MODES)[number];

/** The mode of this repository (0036-distribution FR-019). */
export const DISTRIBUTION: DistributionMode = "single";

/** The environment variable that names the mode for one run. */
export const MODE_VARIABLE = "IFC_DISTRIBUTION";

/** A mode from its text, or why the text is not one. */
export function parseMode(text: string): Result<DistributionMode, string> {
  const found = DISTRIBUTION_MODES.find((m) => m === text);
  return found === undefined ? err(`${text} is not a distribution mode (${DISTRIBUTION_MODES.join(", ")})`) : ok(found);
}

/** The mode a run uses: the one the environment names where it names one, the mode of the repository otherwise. */
export function activeMode(fromEnvironment: string | undefined): Result<DistributionMode, string> {
  if (fromEnvironment === undefined || fromEnvironment === "") return ok(DISTRIBUTION);
  const r = parseMode(fromEnvironment);
  return r.kind === "ok" ? r : err(`${MODE_VARIABLE}: ${r.error}`);
}

/** The one package of `single` mode: its name, its release slug (the first word of its tag) and its folder. */
export const SINGLE = { package: "@intellectual-frontiers/commons", slug: "commons", folder: "commons/commons" } as const;

/**
 * The libraries that `single` mode leaves out of the package, each with its reason: the policy of the one package, which is none while the owner orders every library in. A library with a `held` reason is not left out by that (a held library is packed
 * like any other); it is left out only by an entry here.
 */
export const SINGLE_EXCLUDED: ReadonlyMap<string, string> = new Map<string, string>();

/** How a package the single package does not install is asked for: the range a consumer's copy must satisfy, whether the package works without it, and why (0036-distribution FR-023). */
export type PeerRule = { readonly range: string; readonly optional: boolean; readonly why: string; readonly pinnedBy: "dependencies" | "devDependencies" };

/**
 * The third-party packages that the single package does not install but asks the consumer for, as `peerDependencies` (0036-distribution FR-023, FR-033): the database drivers that the libraries take as ports (a driver is handed to a library by its
 * caller, typed by the shape it is used by, and no source of commons imports one by name), the two packages only the documentation generator loads, and the TypeScript compiler, whose API the documentation generator reads. Each is optional: a consumer that uses a
 * store of AnyFS or of Data installs its driver, one that builds a site installs what Docs loads, and the compiler of the consumer is the one used, so that a second is never installed. This breaks a consumer that relied on the package to install one of them (a driver, `shiki`, `beautiful-mermaid` or a second compiler): it installs the one it uses, and a missing one says which. The range of each is the versions the libraries are written against, and `pinnedBy` says where a library names the version it is written against (a driver in its `devDependencies`, what Docs loads in its `dependencies`).
 */
export const SINGLE_PEERS: ReadonlyMap<string, PeerRule> = new Map<string, PeerRule>([
  ["@duckdb/node-api", { range: ">=2.0.0-r.1", optional: true, pinnedBy: "devDependencies", why: "the DuckDB store of AnyFS and of Data: the caller hands the connection to the library, so it installs the driver" }],
  ["@electric-sql/pglite", { range: ">=0.5.16 <1.0.0", optional: true, pinnedBy: "devDependencies", why: "the in-process PostgreSQL store of AnyFS and of Data: the caller installs the driver" }],
  ["pg", { range: ">=8.23.1 <9.0.0", optional: true, pinnedBy: "devDependencies", why: "the PostgreSQL store of AnyFS and of Data: the caller installs the driver" }],
  ["shiki", { range: ">=4.5.0 <5.0.0", optional: true, pinnedBy: "dependencies", why: "Docs colours the code of a page with it; without it the page is plain and Docs says so" }],
  ["beautiful-mermaid", { range: ">=1.1.3 <2.0.0", optional: true, pinnedBy: "dependencies", why: "Docs draws a diagram with it; without it the diagram stays as its source and Docs says so" }],
  ["typescript", { range: ">=7.1.0-0", optional: true, pinnedBy: "dependencies", why: "Docs reads the API of an area through `typescript/async` of the compiler 7.1; the consumer's own compiler is used" }],
]);

/** The size budget of the single package (0036-distribution FR-032): a growth beyond it is a finding, so that it is a decision and never an accident. Bytes of the staged package, files of it, and bytes of the tarball. */
export const SINGLE_BUDGET = { apparentBytes: 30_500_000, files: 5_300, tarballBytes: 5_600_000 } as const;

/** The registries a release can send a package to: a closed set. */
export const PUBLISH_TARGETS = ["github", "npm"] as const;
/** A registry a release sends a package to. */
export type PublishTarget = (typeof PUBLISH_TARGETS)[number];

/** The address of the GitHub package registry of the organization. */
export const GITHUB_REGISTRY = "https://npm.pkg.github.com";

/**
 * The registries the one package is sent to (0036-distribution FR-028): the GitHub package registry only. `npm` is a switch that is off: adding it here makes the release record, the publication and the manifest of the package carry npm as well, and nothing else changes.
 */
export const SINGLE_TARGETS: readonly PublishTarget[] = ["github"];

/** Whether a run is in `single` mode: the environment's mode, or the repository's. A value that is no mode is not `single`; the commands that pack and release refuse it. */
export function isSingle(fromEnvironment: string | undefined): boolean {
  const m = activeMode(fromEnvironment);
  return m.kind === "ok" && m.value === "single";
}
