/**
 * The typed facts of the documentation generator, IFC Docs (commons 0011-documentation), as the site it makes shows them: its folders
 * and what each may import, and the commands that work on it.
 *
 * @module
 */
import type { About } from "./config.ts";

/** The documentation generator: a repository's site made from its TypeScript and its spec kit alone. */
export const about: About = {
  title: "Documentation generator",
  summary: "The generator of this site, released as `@intellectual-frontiers/ifc-docs` so that any repository builds its own site the same " +
    "way. It reads only the repository's TypeScript (module documentation, TSDoc, the `about` of each package, examples, and the values of " +
    "models and layouts) and its spec kit, through the TypeScript 7.1 programmatic API and the libraries' own functions, and writes static " +
    "HTML with no framework. A repository says what to read in a typed configuration, `docs.config.ts`; commons' is `commons/docs.config.ts`. " +
    "Its lenses know what each library is for: a schema written with SQL Aide is shown as a schema, a layout written with File Aide as a " +
    "layout. Nothing is written for the site alone.",
  spec: { repo: "commons", id: "0011-documentation" },
  folders: [
    { path: "config.ts", what: "The configuration's types (`DocsConfig`, `About`) and the one check of a configuration.", mayImport: ["the kernel", "the runtime"] },
    { path: "extract/", what: "The readers of the spec kits (both layouts) and of the API, through `typescript/async`.", mayImport: ["the kernel", "the runtime", "typescript/async"] },
    {
      path: "lens/",
      what: "Commons' lenses, which commons' configuration passes: which exports are each library's, and the pages their values make. Left out of the release.",
      mayImport: ["the generator's `mod.ts`", "the kernel", "the libraries' entry points"],
    },
    { path: "emit/", what: "The page model written as HTML, and the search index.", mayImport: ["the kernel"] },
    { path: "theme/", what: "The stylesheet and the one script of the site.", mayImport: ["nothing: CSS and a browser script"] },
    { path: "tools/", what: "The release's tools: the package packed, and the packed package installed and used on Bun and Node 26.", mayImport: ["the kernel", "the runtime"] },
    { path: "suite/", what: "The tests, with the HTML of the fixtures committed under `golden/` and a fixture repository under `fixture-repo/`.", mayImport: ["anything here"] },
  ],
  commands: [
    { run: "bun install --frozen-lockfile", does: "Installs IFC TypeScript (its release tarball), TypeScript 7.1 (beta), Mermaid and @types/node, exactly as bun.lock pins them." },
    { run: "bun run verify", does: "Runs the compiler, the tests, then check on commons." },
    { run: "bun run site", does: "Writes the site into _site at the root of the checkout." },
    { run: "bun run site:check", does: "Builds the site in a temporary folder and reports every finding; writes nothing in the checkout." },
    { run: "bun run pack", does: "Builds the package with TypeScript 7 and packs it into dist/, with its SHA-256; --tag ifc-docs-vX.Y.Z stops unless the tag names the version." },
    { run: "bun run smoke", does: "Installs a packed tarball into an empty project with a fixture repository and runs ifc-docs check and build on Bun and Node 26." },
    { run: "IFCDOCS_UPDATE_GOLDEN=1 bun test suite/", does: "Writes the fixtures' HTML again; then read the diff." },
  ],
};
