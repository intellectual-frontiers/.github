/**
 * The configuration of commons' documentation site (commons 0011-documentation FR-023): the site the generator in `docs/` makes from
 * commons' TypeScript and spec kit, with the layered-model lens that documents the data models (FR-026, FR-029). `bun main.ts build`
 * and `bun main.ts check` in `docs/` find it, since it is the first `docs.config.ts` from there up to the repository's root.
 *
 * @module
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { About, DocsConfig, PackageConfig } from "./docs/config.ts";
import { layeredLens } from "./docs/lens/layered.ts";
import { DEFAULT_LICENSE } from "./libraries/src/license/standard.ts";
import { guidesLens } from "./docs/lens/guides.ts";
import { releasesLens } from "./docs/lens/releases.ts";
import { programLens } from "./docs/lens/program.ts";
import { ergonexProgram, type ProgramHost } from "./ergonex/src/mod.ts";
import { describe } from "./headless/src/describe/mod.ts";
import { INERT_HOST as REPOCTL_INERT_HOST, repoctlProgram } from "./repoctl/src/mod.ts";
import { allModules } from "./data/sql/cli/config.ts";
import { describeModels } from "./data/sql/describe/mod.ts";
import { dialect as duckdb } from "./data/sql/dialects/duckdb/mod.ts";
import { dialect as postgres } from "./data/sql/dialects/postgres/mod.ts";
import { dialect as sqlite } from "./data/sql/dialects/sqlite/mod.ts";

/** The files of the data models that export the values the models are made of (modules, concepts, code lists), from the repository's root: where an element is written is found from them. */
const modelFiles = readdirSync(new URL("./data/models/", import.meta.url), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .flatMap((e) => readdirSync(new URL(`./data/models/${e.name}/`, import.meta.url)).filter((f) => f.endsWith(".ts")).map((f) => `commons/data/models/${e.name}/${f}`))
  .sort();

/** The data models, documented layer by layer (governance, logical, physical) from the values of the library itself. */
const dataModels = layeredLens({
  name: "data-models",
  exports: modelFiles,
  regenerate: ["cd commons/data && bun tools/typed.ts --write", "cd commons/data && bun run verify"],
  source: (locate) => {
    const r = describeModels({ modules: allModules(), dialects: [postgres, sqlite, duckdb], domain: "arca", library: "data", locate });
    if (r.kind === "err") throw new Error(`the data models cannot be described: ${r.error.kind}: ${r.error.why}`);
    return r.value;
  },
});

/** A host that does nothing: the tree of a program is made from it without reading anything, and `describe` never runs a command. */
const INERT_HOST: ProgramHost = { env: {}, cwd: "/", today: "2026-11-20", platform: { os: "linux", arch: "x86_64", windows: false }, places: undefined, homeFor: () => undefined, stdin: () => Promise.resolve(""), argv: [], now: () => 0 } as unknown as ProgramHost;

/** The programs built on headless, documented by tier from their own descriptions: ergonex, the workspaces tool, and repoctl, the operations program of this repository. */
const programs = programLens({ name: "programs", source: () => [...describe(ergonexProgram(INERT_HOST)), ...describe(repoctlProgram(REPOCTL_INERT_HOST))] });

/** The libraries of commons: each folder with a manifest (`library.ts`), a `package.json` and an `about.ts`, in order of name. */
const libraryNames: readonly string[] = readdirSync(new URL("./", import.meta.url), { withFileTypes: true })
  .filter((e) => e.isDirectory() && ["library.ts", "package.json", "about.ts"].every((f) => existsSync(new URL(`./${e.name}/${f}`, import.meta.url))))
  .map((e) => e.name)
  .sort();

/** The folder that holds every one of the files: their longest shared path of folders (empty where they share none). */
function commonFolder(files: readonly string[]): string {
  const dirs = files.map((f) => f.split("/").slice(0, -1));
  const first = dirs[0] ?? [];
  let n = first.length;
  for (const d of dirs) while (n > 0 && d.slice(0, n).join("/") !== first.slice(0, n).join("/")) n--;
  return first.slice(0, n).join("/");
}

/** A library as a package of the site: its own `about.ts`, with one area whose entry points are the files its `package.json` exports. */
async function libraryPackage(name: string): Promise<PackageConfig> {
  const pkg = JSON.parse(readFileSync(new URL(`./${name}/package.json`, import.meta.url), "utf8")) as { readonly exports?: Readonly<Record<string, string | { readonly default?: string; readonly import?: string }>>; readonly description?: string };
  const targets = Object.values(pkg.exports ?? {}).map((t) => (typeof t === "string" ? t : (t.default ?? t.import ?? ""))).filter((t) => t.endsWith(".ts")).map((t) => t.replace(/^\.\//, ""));
  const { about: written } = (await import(`./${name}/about.ts`)) as { readonly about: About };
  const { library } = (await import(`./${name}/library.ts`)) as { readonly library: { readonly version?: string; readonly level?: string; readonly distribution?: readonly string[]; readonly license?: string; readonly kanon?: { readonly units: readonly { readonly folder: string; readonly layer?: string; readonly mayImport?: readonly string[] }[] } } };
  const about: About = {
    ...written,
    ...(library.kanon === undefined ? {} : { layers: library.kanon.units.filter((u) => typeof u.layer === "string").map((u) => ({ folder: u.folder, layer: u.layer ?? "", ...(u.mayImport === undefined ? {} : { mayImport: u.mayImport }) })) }),
    facts: [
      ...(library.version === undefined ? [] : [{ label: "Version", value: `\`${library.version}\`` }]),
      ...(library.level === undefined ? [] : [{ label: "Conformance level", value: `\`${library.level}\`` }]),
      ...(library.distribution === undefined ? [] : [{ label: "Distributed", value: library.distribution.join(", ") }]),
      { label: "License", value: `\`${library.license ?? DEFAULT_LICENSE}\`, source-available: free for noncommercial use, commercial use needs a license from the owner (see Licensing in Start here)` },
      { label: "Import it as", value: `\`@intellectual-frontiers/${name}\`` },
    ],
  };
  const entryPoints = [...new Set(targets)].filter((t) => existsSync(new URL(`./${name}/${t}`, import.meta.url)));
  return { dir: `commons/${name}`, slug: name, about: entryPoints.length === 0 ? about : { ...about, areas: [{ title: about.title, slug: name, entryPoints, folder: commonFolder(entryPoints) }] } };
}

/** The pages people write for a newcomer: a path for each kind of reader, the concepts, and how to do the common things. */
const guides = guidesLens({
  name: "guides",
  guides: [
    { file: "commons/docs/guides/start-index.md", path: "start/index.html", section: "start", group: "Start here", order: 0 },
    { file: "commons/docs/guides/new-developer.md", path: "start/new-developer.html", section: "start", group: "Start here", order: 1 },
    { file: "commons/docs/guides/contributor.md", path: "start/contributor.html", section: "start", group: "Start here", order: 2 },
    { file: "commons/docs/guides/agent.md", path: "start/agent.html", section: "start", group: "Start here", order: 3 },
    { file: "commons/docs/guides/auditor.md", path: "start/auditor.html", section: "start", group: "Start here", order: 4 },
    { file: "LICENSING.md", path: "start/licensing.html", section: "start", group: "Licensing", order: 0 },
    { file: "COMMERCIAL.md", path: "start/commercial.html", section: "start", group: "Licensing", order: 1 },
    { file: "THIRD_PARTY_NOTICES.md", path: "start/third-party-notices.html", section: "start", group: "Licensing", order: 2 },
    { file: "commons/docs/guides/concepts-index.md", path: "concepts/index.html", section: "concepts", group: "Concepts", order: 0 },
    { file: "commons/docs/guides/concept-mizan.md", path: "concepts/mizan.html", section: "concepts", group: "Concepts", order: 1 },
    { file: "commons/docs/guides/concept-kanon.md", path: "concepts/kanon.html", section: "concepts", group: "Concepts", order: 2 },
    { file: "commons/docs/guides/concept-ladder.md", path: "concepts/ladder.html", section: "concepts", group: "Concepts", order: 3 },
    { file: "commons/docs/guides/concept-standards-first.md", path: "concepts/standards-first.html", section: "concepts", group: "Concepts", order: 4 },
    { file: "commons/docs/guides/concept-ifr.md", path: "concepts/ifr.html", section: "concepts", group: "Concepts", order: 5 },
    { file: "commons/docs/guides/concept-ifqs.md", path: "concepts/ifqs.html", section: "concepts", group: "Concepts", order: 6 },
    { file: "commons/docs/guides/concept-ifccm.md", path: "concepts/ifccm.html", section: "concepts", group: "Concepts", order: 7 },
    { file: "commons/docs/guides/concept-lenses.md", path: "concepts/lenses.html", section: "concepts", group: "Concepts", order: 8 },
    { file: "commons/docs/guides/concept-release-loop.md", path: "concepts/release-loop.html", section: "concepts", group: "Concepts", order: 9 },
    { file: "commons/docs/guides/proof-by-blast-radius.md", path: "concepts/proof-by-blast-radius.html", section: "concepts", group: "Concepts", order: 10 },
    { file: "commons/docs/guides/how-to-index.md", path: "how-to/index.html", section: "howto", group: "How-to", order: 0 },
    { file: "commons/docs/guides/where-does-x-live.md", path: "how-to/where-does-x-live.html", section: "howto", group: "How-to", order: 1 },
    { file: "commons/docs/guides/add-a-library.md", path: "how-to/add-a-library.html", section: "howto", group: "How-to", order: 2 },
    { file: "commons/docs/guides/add-a-verb.md", path: "how-to/add-a-verb.html", section: "howto", group: "How-to", order: 3 },
    { file: "commons/docs/guides/cut-a-release.md", path: "how-to/cut-a-release.html", section: "howto", group: "How-to", order: 4 },
    { file: "commons/docs/guides/consuming-commons.md", path: "how-to/consuming-commons.html", section: "howto", group: "How-to", order: 5 },
    { file: "commons/docs/guides/ai-start.md", path: "how-to/ai-start.html", section: "howto", group: "With an AI assistant", order: 0 },
    { file: "commons/docs/guides/ai-add-a-library.md", path: "how-to/ai-add-a-library.html", section: "howto", group: "With an AI assistant", order: 1 },
    { file: "commons/docs/guides/ai-fix-a-failing-check.md", path: "how-to/ai-fix-a-failing-check.html", section: "howto", group: "With an AI assistant", order: 2 },
    { file: "commons/docs/guides/ai-add-a-command.md", path: "how-to/ai-add-a-command.html", section: "howto", group: "With an AI assistant", order: 3 },
    { file: "commons/docs/guides/ai-write-a-spec.md", path: "how-to/ai-write-a-spec.html", section: "howto", group: "With an AI assistant", order: 4 },
    { file: "commons/docs/guides/ai-ticket-to-spec.md", path: "how-to/ai-ticket-to-spec.html", section: "howto", group: "With an AI assistant", order: 5 },
    { file: "commons/docs/guides/ai-add-a-dialect.md", path: "how-to/ai-add-a-dialect.html", section: "howto", group: "With an AI assistant", order: 6 },
    { file: "commons/docs/guides/ai-review-a-diff.md", path: "how-to/ai-review-a-diff.html", section: "howto", group: "With an AI assistant", order: 7 },
    { file: "commons/docs/guides/ai-cut-a-release.md", path: "how-to/ai-cut-a-release.html", section: "howto", group: "With an AI assistant", order: 8 },
  ],
});

/** The record of the next release: which libraries it publishes, at which version, under which tag. */
const releases = releasesLens({ name: "releases", file: "commons/generated/release.auto.json" });

/** Commons' site: its packages, its spec kit, how its specifications are cited, and its lenses. */
export const config: DocsConfig = {
  name: "IF Commons",
  subject: "commons",
  root: "..",
  repository: "https://github.com/intellectual-frontiers/.github",
  home: { dir: "commons" },
  packages: [{ dir: "commons/ts", slug: "ifc-typescript" }, ...(await Promise.all(libraryNames.map(libraryPackage)))],
  specKits: [
    { layout: "commons", dir: "commons/spec-kit" },
    { layout: "commons", dir: "commons/core/spec-kit" },
    { layout: "commons", dir: "commons/rdf/spec-kit" },
    { layout: "commons", dir: "commons/terminal/spec-kit" },
    { layout: "commons", dir: "commons/system/spec-kit" },
    { layout: "commons", dir: "commons/telemetry/spec-kit" },
    { layout: "commons", dir: "commons/lint/spec-kit" },
    { layout: "commons", dir: "commons/githost/spec-kit" },
    { layout: "commons", dir: "commons/ontology/spec-kit" },
    { layout: "commons", dir: "commons/mizan/spec-kit" },
    { layout: "commons", dir: "commons/net/spec-kit" },
    { layout: "commons", dir: "commons/test/spec-kit" },
    { layout: "commons", dir: "commons/grc/spec-kit" },
    { layout: "commons", dir: "commons/crypto/spec-kit" },
    { layout: "commons", dir: "commons/formats/spec-kit" },
    { layout: "commons", dir: "commons/data/spec-kit" },
    { layout: "commons", dir: "commons/ergonex/spec-kit" },
    { layout: "commons", dir: "commons/libraries/spec-kit" },
    { layout: "commons", dir: "commons/quality/spec-kit" },
    { layout: "commons", dir: "commons/headless/spec-kit" },
    { layout: "commons", dir: "commons/integrations/spec-kit" },
    { layout: "commons", dir: "commons/integrations-github/spec-kit" },
    { layout: "commons", dir: "commons/archon/spec-kit" },
    { layout: "commons", dir: "commons/toolchain/spec-kit" },
    { layout: "commons", dir: "commons/archon-dialect-native-pinned/spec-kit" },
    { layout: "commons", dir: "commons/package-managers/spec-kit" },
    { layout: "commons", dir: "commons/archon-dialect-apt/spec-kit" },
    { layout: "commons", dir: "commons/archon-dialect-homebrew/spec-kit" },
    { layout: "commons", dir: "commons/archon-dialect-mise/spec-kit" },
    { layout: "commons", dir: "commons/archon-dialect-winget/spec-kit" },
    { layout: "commons", dir: "commons/archon-tool/spec-kit" },
    { layout: "commons", dir: "commons/integrations-fhir/spec-kit" },
    { layout: "commons", dir: "commons/integrations-x12/spec-kit" },
    { layout: "commons", dir: "commons/kanon/spec-kit" },
    { layout: "commons", dir: "commons/repoctl/spec-kit" },
  ],
  citations: { prefix: "commons", digits: 4, text: ["erga", "archon", "stolos", "thyra"] },
  lenses: [guides, releases, dataModels, programs],
  lintRules: "commons/lint/src/rules",
  retired: ["SQL Aide", "sql-aide", "File Aide", "IFRFS"],
  forbiddenInGuides: ["formerly", "previously", "legacy", "deprecated", "replaces", "replaced", "migration", "backward", "backwards", "acceptance test", "history", "no longer"],
  out: "_site",
};

export default config;
