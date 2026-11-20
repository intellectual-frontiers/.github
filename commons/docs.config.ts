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
import { programLens } from "./docs/lens/program.ts";
import { ergonexProgram, type ProgramHost } from "./ergonex/src/mod.ts";
import { describe } from "./headless/src/describe/mod.ts";
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

/** The programs built on headless, documented by tier from their own descriptions: ergonex, the workspaces tool. */
const programs = programLens({ name: "programs", source: () => describe(ergonexProgram(INERT_HOST)) });

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
  const { library } = (await import(`./${name}/library.ts`)) as { readonly library: { readonly version?: string; readonly level?: string; readonly distribution?: readonly string[] } };
  const about: About = {
    ...written,
    facts: [
      ...(library.version === undefined ? [] : [{ label: "Version", value: `\`${library.version}\`` }]),
      ...(library.level === undefined ? [] : [{ label: "Conformance level", value: `\`${library.level}\`` }]),
      ...(library.distribution === undefined ? [] : [{ label: "Distributed", value: library.distribution.join(", ") }]),
      { label: "Import it as", value: `\`@intellectual-frontiers/${name}\`` },
    ],
  };
  const entryPoints = [...new Set(targets)].filter((t) => existsSync(new URL(`./${name}/${t}`, import.meta.url)));
  return { dir: `commons/${name}`, slug: name, about: entryPoints.length === 0 ? about : { ...about, areas: [{ title: about.title, slug: name, entryPoints, folder: commonFolder(entryPoints) }] } };
}

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
    { layout: "commons", dir: "commons/integrations-fhir/spec-kit" },
    { layout: "commons", dir: "commons/integrations-x12/spec-kit" },
    { layout: "commons", dir: "commons/kanon/spec-kit" },
  ],
  citations: { prefix: "commons", digits: 4, text: ["erga", "archon", "stolos", "thyra"] },
  lenses: [dataModels, programs],
  lintRules: "commons/lint/src/rules",
  out: "_site",
};

export default config;
