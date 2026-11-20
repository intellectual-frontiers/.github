/**
 * The metapackages of commons (commons 0036-distribution FR-005 to FR-008): five packages with no code of their own, each a set of libraries at the exact versions of one release. `@intellectual-frontiers/commons` is every
 * consumer-facing library; `foundation`, `patterns`, `programs` and `standards` are the four roles of the libraries. A repository other than `.github` installs commons by installing one of them, or a library, from a registry.
 *
 * @remarks
 * Pure: the libraries as data give the members of a set, the exact dependencies of its package, the file that records them, the `package.json` and the README that are published. The role of a library is read from `ROLE_OF` of
 * `readme.ts`, the one place that says it, and the set of a role is the role's: `foundation`, `pattern` (`patterns`), `program` (`programs`) and `standard` (`standards`). A library is consumer-facing where its distribution
 * names npm and it is not a metapackage and not held back ({@link HELD_BACK}); the package of a member is the package it publishes ({@link publishedPackage}). A member whose role is not known is a problem and never a member
 * of no set. The effects (writing the files, packing) are `pack-metapackage.ts`.
 *
 * @limits
 * It reads no file and knows no registry. It does not know what is published: a release that has not published a member makes the set refer to a version npm does not hold yet, which the release's order prevents.
 *
 * @example
 * ```ts
 * import { dependenciesOf } from "./metapackages.ts";
 * dependenciesOf([{ library: "core", package: "@intellectual-frontiers/core", version: "0.1.5" }]); // { "@intellectual-frontiers/core": "0.1.5" }
 * ```
 *
 * Spec: 0001-libraries FR-023
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { type BundleName, BUNDLES, type Library, publishedPackage } from "./libraries.ts";
import { DEFAULT_LICENSE } from "./license/standard.ts";
import { ROLE_OF, type Role } from "./readme.ts";

/** The libraries that are not in any set yet, each with why: they declare npm and are not ready to be installed (commons 0036-distribution FR-006). A library leaves this list when its owner releases it. */
export const HELD_BACK: ReadonlyMap<string, string> = new Map([
  ["archon", "the Archon library is not released yet"],
  ["archon-dialect-apt", "a dialect of Archon, which is not released yet"],
  ["archon-dialect-homebrew", "a dialect of Archon, which is not released yet"],
  ["archon-dialect-mise", "a dialect of Archon, which is not released yet"],
  ["archon-dialect-native-pinned", "a dialect of Archon, which is not released yet"],
  ["archon-dialect-winget", "a dialect of Archon, which is not released yet"],
  ["package-managers", "the kit of the dialects of Archon and Toolchain, which are not released yet"],
  ["toolchain", "the Toolchain library is not released yet"],
]);

/** The roles' sets: a role is in exactly one. */
export const BUNDLE_OF_ROLE: Readonly<Record<Role, Exclude<BundleName, "commons">>> = {
  foundation: "foundation",
  pattern: "patterns",
  program: "programs",
  standard: "standards",
};

/** A member of a set: the library, the package it publishes and the version of this release. */
export type Member = { readonly library: string; readonly package: string; readonly version: string };

/** The exact dependencies of a package: the name of each member and its version, nothing else. */
export type Dependencies = Readonly<Record<string, string>>;

/** Whether a library is installed by a set: it names npm, it is no metapackage and it is not held back. */
export function isConsumerFacing(l: Pick<Library, "name" | "bundle" | "distribution" | "held">): boolean {
  return l.held === undefined && l.bundle === undefined && l.distribution.includes("npm") && !HELD_BACK.has(l.name);
}

/** Whether a set holds a library of this role. */
function holds(bundle: BundleName, role: Role): boolean {
  switch (bundle) {
    case "commons":
      return true;
    case "foundation":
    case "patterns":
    case "programs":
    case "standards":
      return BUNDLE_OF_ROLE[role] === bundle;
    default:
      return absurd(bundle);
  }
}

/** The members of a set, in the order of their packages' names; the problem where a consumer-facing library has no role in `ROLE_OF`. */
export function membersOf(bundle: BundleName, libraries: readonly Library[]): Result<readonly Member[], string> {
  const out: Member[] = [];
  for (const l of libraries) {
    if (!isConsumerFacing(l)) continue;
    const role = ROLE_OF.get(l.name);
    if (role === undefined) return err(`commons/${l.name} has no role in ROLE_OF (commons/libraries/src/readme.ts), so no set can hold it`);
    if (holds(bundle, role)) out.push({ library: l.name, package: publishedPackage(l), version: l.version });
  }
  return ok(out.sort((a, b) => (a.package < b.package ? -1 : a.package > b.package ? 1 : 0)));
}

/** The exact dependencies of the package of a set: each member's package at its version, no range. */
export function dependenciesOf(members: readonly Member[]): Dependencies {
  return Object.fromEntries(members.map((m) => [m.package, m.version]));
}

/** What the generated file of a set holds: the set and its exact dependencies. */
export function setFileText(bundle: BundleName, members: readonly Member[]): string {
  return `${JSON.stringify({ generated: "bun commons/libraries/src/pack-metapackage.ts; do not edit (commons 0036-distribution FR-007)", set: bundle, dependencies: dependenciesOf(members) }, null, 2)}\n`;
}

/** The generated file of a set, from its folder. */
export const SET_FILE = "dependencies.auto.json";

/** The dependencies a generated file holds, or why its text is not one. */
export function readSetFile(text: string): Result<Dependencies, string> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err(`${SET_FILE} is not JSON`);
  }
  const deps = typeof json === "object" && json !== null && "dependencies" in json ? json.dependencies : undefined;
  if (typeof deps !== "object" || deps === null || Array.isArray(deps)) return err(`${SET_FILE} has no dependencies`);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(deps)) {
    if (typeof v !== "string") return err(`${SET_FILE}: ${k} has no version`);
    out[k] = v;
  }
  return ok(out);
}

/** What a set is for, in words, for its README. */
const PURPOSE: Readonly<Record<BundleName, string>> = {
  commons: "Every consumer-facing library of Intellectual Frontiers Commons, at the versions of one release.",
  foundation: "The foundation libraries: errors as values and decoders, formats, cryptography, the system, the terminal, telemetry, the network, the test runtime, RDF, the Git host and the lint rules.",
  patterns: "The pattern libraries: the headless program pattern and the layers of Kanon.",
  programs: "The program libraries: the operations program of a repository, workspaces, data, integrations and the rest of the programs.",
  standards: "The standards libraries: Mizan, the ontologies, the quality standards and the standards of integrations.",
};

/** The text of a set's own `description`, which the package carries. */
export function descriptionOf(bundle: BundleName): string {
  return `${PURPOSE[bundle]} No code of its own: it depends on each library at one exact version.`;
}

/** The scope of the packages. */
const SCOPE = "@intellectual-frontiers";

/** The README of a set's package: what it holds, how to install it from npm and from the GitHub package registry, and how to keep one copy of each library. */
export function readmeOf(bundle: BundleName, members: readonly Member[]): string {
  const name = `${SCOPE}/${bundle}`;
  const rows = members.map((m) => `| \`${m.package}\` | \`${m.version}\` |`);
  return [
    `# ${name}`,
    "",
    descriptionOf(bundle),
    "",
    "```sh",
    `bun add ${name}@<version>     # or: npm install --save-exact ${name}@<version>`,
    "```",
    "",
    `The package has no code of its own. Its dependencies are the libraries below, each at one exact version, so that one version of \`${name}\` is one coherent set. Pin it exactly, and import the libraries by their own names.`,
    "",
    "| Library | Version |",
    "| --- | --- |",
    ...rows,
    "",
    "## One copy of each library",
    "",
    "Where another package of your tree depends on one of these libraries at a range, make the tree hold one copy: add",
    "",
    "```json",
    `{ "overrides": { "${SCOPE}/core": "<the version above>" } }`,
    "```",
    "",
    "to your `package.json` for each library you find twice (`bun pm ls --all`, `npm ls @intellectual-frontiers/core`). `repoctl hygiene` names the library that is installed twice.",
    "",
    "## From the GitHub package registry",
    "",
    "The same package is on the GitHub package registry of the organization. Put the scoped line in `.npmrc` and a token that may read packages in the environment:",
    "",
    "```sh",
    "@intellectual-frontiers:registry=https://npm.pkg.github.com",
    "//npm.pkg.github.com/:_authToken=${ERGONEX_GITHUB_TOKEN}",
    "```",
    "",
    `License: ${DEFAULT_LICENSE}. Sources and specifications: https://github.com/intellectual-frontiers/.github/tree/main/commons/${bundle}`,
    "",
  ].join("\n");
}

/** The `package.json` that is published for a set: no code, one empty entry, the exact dependencies. */
export function publishedManifest(bundle: BundleName, version: string, dependencies: Dependencies, license: string): Readonly<Record<string, unknown>> {
  return {
    name: `${SCOPE}/${bundle}`,
    version,
    description: descriptionOf(bundle),
    license,
    type: "module",
    engines: { node: ">=26" },
    sideEffects: false,
    types: "./index.d.ts",
    exports: { ".": { types: "./index.d.ts", default: "./index.js" } },
    dependencies,
    files: ["index.js", "index.d.ts", "README.md", "LICENSE"],
    repository: { type: "git", url: "git+https://github.com/intellectual-frontiers/.github.git", directory: `commons/${bundle}` },
    homepage: `https://github.com/intellectual-frontiers/.github/tree/main/commons/${bundle}`,
    bugs: { url: "https://github.com/intellectual-frontiers/.github/issues" },
    keywords: ["intellectual-frontiers", "commons", bundle],
    publishConfig: { access: "public" },
  };
}

/** The one file of code of a set's package, and its declaration: an empty module, so that the entry imports. */
export const ENTRY_JS = "export {};\n";
/** The declaration of {@link ENTRY_JS}. */
export const ENTRY_DTS = "export {};\n";

/** Every set, in the order the README lists them. */
export const ALL_BUNDLES: readonly BundleName[] = BUNDLES;
