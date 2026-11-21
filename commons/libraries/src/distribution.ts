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

/**
 * The third-party packages that the single package depends on although no source of commons imports them by name: the database drivers that the libraries take as ports (a driver is handed to the library by its caller, typed by the shape it
 * is used by), so that a consumer who uses a store of AnyFS or of Data finds the driver installed. The version of each is the one the libraries name in their own `package.json`; two libraries that name two versions are a finding.
 */
export const SINGLE_DRIVERS: readonly string[] = ["@duckdb/node-api", "@electric-sql/pglite", "pg"];

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
