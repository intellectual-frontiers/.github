/**
 * The configuration of commons' documentation site (commons 0011-documentation FR-023): the site the generator in `docs/` makes from
 * commons' TypeScript and spec kit, with the layered-model lens that documents the data models (FR-026, FR-029). `bun main.ts build`
 * and `bun main.ts check` in `docs/` find it, since it is the first `docs.config.ts` from there up to the repository's root.
 *
 * @module
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { About, BooksConfig, DocsConfig, EvidenceSource, IssuesOf, PackageConfig } from "./docs/src/config.ts";
import { layeredLens } from "./docs/src/lens/layered.ts";
import { DEFAULT_LICENSE } from "./libraries/src/license/standard.ts";
import { guidesLens } from "./docs/src/lens/guides.ts";
import { releasesLens } from "./docs/src/lens/releases.ts";
import { programLens } from "./docs/src/lens/program.ts";
import { ergonexProgram, type ProgramHost } from "./ergonex/src/mod.ts";
import { describe } from "./headless/src/describe/mod.ts";
import { anyfsProgram, INERT_HOST as ANYFS_INERT_HOST } from "./anyfs-cli/src/mod.ts";
import { INERT_HOST as REPOCTL_INERT_HOST, repoctlProgram } from "./repoctl/src/mod.ts";
import { SUBJECTS } from "./data/governance/api.ts";
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

/** The programs built on headless, documented by tier from their own descriptions: ergonex, the workspaces tool, repoctl, the operations program of this repository, and anyfs, the command line of the stores. */
const programs = programLens({ name: "programs", source: () => [...describe(ergonexProgram(INERT_HOST)), ...describe(repoctlProgram(REPOCTL_INERT_HOST)), ...describe(anyfsProgram(ANYFS_INERT_HOST))] });

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

/** What could not be read while this configuration was made (a library whose `about.ts` fails to import): each is a finding of the site and the library is a page that says so, and the site is made without it. */
const problems: { where: string; error: string }[] = [];

/** A library as a package of the site, or, where its `about.ts` or its manifest cannot be read, a package that says so (the site is made whatever one library does). */
async function libraryPackage(name: string): Promise<PackageConfig> {
  try {
    return await readLibraryPackage(name);
  } catch (thrown) {
    const error = thrown instanceof Error ? thrown.message : String(thrown);
    problems.push({ where: `commons/${name}`, error });
    return { dir: `commons/${name}`, slug: name, about: { title: name, summary: `This library could not be read for the site: ${error.replace(/\s+/g, " ").slice(0, 200)}.` } };
  }
}

/** A library as a package of the site: its own `about.ts`, with one area whose entry points are the files its `package.json` exports. */
async function readLibraryPackage(name: string): Promise<PackageConfig> {
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
    { file: "commons/docs/guides/repoctl-in-your-repo.md", path: "how-to/repoctl-in-your-repo.html", section: "howto", group: "How-to", order: 6 },
    { file: "commons/docs/guides/grc-entity-groups.md", path: "how-to/grc-entity-groups.html", section: "howto", group: "How-to", order: 7 },
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

/** The volumes of the series Commons Manuals (commons 0011-documentation FR-040): the pages of the site as the chapter sources of books of `erga`, a volume to a book (`works/book/<id>/generated/<id>.adoc`). The traceability matrix and the register are for the screen and are not in print. */
const books: BooksConfig = {
  site: "https://intellectual-frontiers.github.io/.github/",
  volumes: [
    {
      id: "commons-guide",
      title: "Commons Guide",
      about: "What commons is, how its parts fit, and how to do the common jobs with it.",
      parts: [
        { title: "Start here", select: [{ section: "start" }] },
        { title: "Concepts", select: [{ section: "concepts" }] },
        { title: "The libraries", select: [{ section: "overview" }] },
        { title: "How to", select: [{ section: "howto" }] },
      ],
    },
    {
      id: "commons-api-reference",
      title: "Commons API Reference",
      about: "Every export of every library of commons, read from its TypeScript.",
      parts: [{ title: "The API", select: [{ section: "api" }], perGroup: true }],
    },
    {
      id: "commons-data-models",
      title: "Commons Data Models",
      about: "The data models of commons, by subject: what each means, how it is made logical, and how it is made physical.",
      parts: [
        { title: "The models together", select: [{ section: "models", group: "Models" }] },
        ...SUBJECTS.map((s) => ({ title: s.title, about: s.about, select: [{ section: "models" as const, group: s.title }] })),
      ],
    },
    {
      id: "commons-specifications",
      title: "Commons Specifications",
      about: "The specifications in force, each with its requirements and what enforces them.",
      parts: [{ title: "The specifications", select: [{ section: "specs", exclude: ["specs/index.html", "specs/matrix"] }], perGroup: true }],
    },
    {
      id: "commons-programs",
      title: "Commons Programs",
      about: "The programs built on headless: every command of each, by tier.",
      parts: [{ title: "The programs", select: [{ section: "programs" }], perGroup: true }],
    },
  ],
};

/** The issues a library keeps as typed code, read one set at a time: a set that cannot be imported is a finding of the site and the other sets are shown. */
async function issuesOf(sets: readonly (readonly [library: string, file: string, scoped: boolean])[]): Promise<IssuesOf[]> {
  const out: IssuesOf[] = [];
  for (const [library, file, scoped] of sets) {
    try {
      const { issues } = (await import(file)) as { readonly issues: { readonly scope: string; readonly issues: IssuesOf["issues"] } };
      out.push({ library, ...(scoped ? { scope: issues.scope } : {}), issues: issues.issues });
    } catch (thrown) {
      problems.push({ where: `commons/${file.replace(/^\.\//, "")}`, error: thrown instanceof Error ? thrown.message : String(thrown) });
    }
  }
  return out;
}

/**
 * What the site shows beside the code (commons 0011-documentation FR-041): the results of the tests that CI leaves in `_evidence/` (`<library>.ctrf.json` for each library and `meta.json`; none where a build is made by hand, and the pages
 * say so), a snapshot of the open tickets of GitHub in the same folder, and the issues that the libraries keep as typed code, which are read from the libraries themselves.
 */
const evidence: EvidenceSource = {
  results: "_evidence",
  github: "_evidence/github-issues.json",
  issues: await issuesOf([
    ["data", "./data/issues/mod.ts", false],
    ["data", "./data/sql/extensions/convergence/issues/mod.ts", true],
    ["data", "./data/sql/extensions/history/issues/mod.ts", true],
    ["data", "./data/sql/extensions/operations/issues/mod.ts", true],
    ["data", "./data/sql/presets/issues/mod.ts", true],
  ]),
};

/** Commons' site: its packages, its spec kit, how its specifications are cited, and its lenses. */
export const config: DocsConfig = {
  name: "IF Commons",
  subject: "commons",
  root: "..",
  repository: "https://github.com/intellectual-frontiers/.github",
  home: { dir: "commons" },
  packages: await Promise.all(libraryNames.map(libraryPackage)),
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
    { layout: "commons", dir: "commons/docs/spec-kit" },
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
    { layout: "commons", dir: "commons/estate/spec-kit" },
    { layout: "commons", dir: "commons/anyfs/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-posix/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-serve/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-s3/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-ssh/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-bridge/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-cli/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-git/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-sql/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-githost/spec-kit" },
    { layout: "commons", dir: "commons/anyfs-query/spec-kit" },
    { layout: "commons", dir: "commons/evidence-capture/spec-kit" },
    { layout: "commons", dir: "commons/integrations-fhir/spec-kit" },
    { layout: "commons", dir: "commons/integrations-x12/spec-kit" },
    { layout: "commons", dir: "commons/kanon/spec-kit" },
    { layout: "commons", dir: "commons/lab/spec-kit" },
    { layout: "commons", dir: "commons/machine-probe/spec-kit" },
    { layout: "commons", dir: "commons/archon-boot/spec-kit" },
    { layout: "commons", dir: "commons/archon-converge/spec-kit" },
    { layout: "commons", dir: "commons/archon-dialect-ansible/spec-kit" },
    { layout: "commons", dir: "commons/archon-dialect-cloud-init/spec-kit" },
    { layout: "commons", dir: "commons/archon-dns/spec-kit" },
    { layout: "commons", dir: "commons/catalog-nist-csf-2/spec-kit" },
    { layout: "commons", dir: "commons/catalog-nist-sp800/spec-kit" },
    { layout: "commons", dir: "commons/lang-sql/spec-kit" },
    { layout: "commons", dir: "commons/linux-observe/spec-kit" },
    { layout: "commons", dir: "commons/linux-services/spec-kit" },
    { layout: "commons", dir: "commons/netboot/spec-kit" },
    { layout: "commons", dir: "commons/repoctl/spec-kit" },
    { layout: "commons", dir: "commons/estate-query/spec-kit" },
  ],
  citations: { prefix: "commons", digits: 4, text: ["erga", "archon", "stolos", "thyra"] },
  lenses: [guides, releases, dataModels, programs],
  lintRules: "commons/lint/src/rules",
  retired: ["SQL Aide", "sql-aide", "File Aide", "IFRFS"],
  forbiddenInGuides: ["formerly", "previously", "legacy", "deprecated", "replaces", "replaced", "migration", "backward", "backwards", "acceptance test", "history", "no longer"],
  out: "_site",
  books,
  evidence,
  problems,
};

export default config;
