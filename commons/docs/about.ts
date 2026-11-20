// Spec: 0001-docs FR-001
/**
 * The typed facts of the documentation generator, IFC Docs (commons 0011-documentation), as the site it makes shows them: its folders
 * and what each may import, and the commands that work on it.
 *
 * @module
 */
import type { About } from "./src/config.ts";

/** The documentation generator: a repository's site made from its TypeScript and its spec kit alone. */
export const about: About = {
  title: "Documentation generator",
  summary: "The generator of a repository's documentation site, a library of commons that any repository installs from npm (`@intellectual-frontiers/docs`) and runs as `ifc-docs`. It reads only the repository's TypeScript (module documentation, TSDoc, " +
    "the `about` of each package, examples, and the values of models and programs) and its spec kit, through the TypeScript 7.1 programmatic API and the libraries' own functions, and writes a static site with a Markdown twin and JSON beside it, " +
    "with no framework: code is coloured and diagrams are drawn when the site is built. A repository says what to read in a typed configuration, `docs.config.ts`, which imports the types and the lens factories by package name and gives the " +
    "address and branch of the repository, so that a private repository has a site whose links go where it says. Commons' own is `commons/docs.config.ts`. Nothing is written for a site alone but its guides.",
  spec: { repo: "commons", id: "0001-docs" },
  folders: [
    { path: "src/", what: "The generator: the configuration and its one check, the readers of the spec kits and of the API, the page model, the pages, the HTML and Markdown writers, the lenses and the command line.", mayImport: ["core and system, by package name", "typescript/async", "shiki", "beautiful-mermaid"] },
    { path: "src/extract/", what: "The readers of the spec kits (both layouts) and of the API, through `typescript/async`.", mayImport: ["src/", "typescript/async"] },
    { path: "src/emit/", what: "The page model written as HTML and Markdown, and the search index.", mayImport: ["src/", "shiki", "beautiful-mermaid"] },
    { path: "src/lens/", what: "The factories of the lenses a configuration passes: layered models, programs, guides and releases.", mayImport: ["src/mod.ts only"] },
    { path: "src/theme/", what: "The stylesheet and the one script of the site, published beside the modules that read them.", mayImport: ["nothing: CSS and a browser script"] },
    { path: "ifc-docs.mjs", what: "The command `ifc-docs` in this repository: it registers IFC TypeScript's Node hook, then runs the command line, on Bun and on Node 26 alike; the published package has its own launcher of the compiled module.", mayImport: ["the Node hook", "src/cli.ts"] },
    { path: "tools/", what: "The trace check and the packer that `bun run verify` runs.", mayImport: ["mizan and the packer of commons, by package name"] },
    { path: "suite/", what: "The tests, with the HTML of the fixtures committed under `golden/`, a fixture repository under `fixture-repo/` and the packed package installed into an empty project.", mayImport: ["anything here"] },
  ],
  commands: [
    { run: "bun install --frozen-lockfile", does: "Installs TypeScript 7.1 (beta), Shiki, beautiful-mermaid and @types/node, exactly as bun.lock pins them." },
    { run: "bun run verify", does: "Runs the compiler, the specification and trace checks, the tests, check on commons, and the packing of the package." },
    { run: "bun run site", does: "Writes the site into _site at the root of the checkout." },
    { run: "bun run site:check", does: "Builds the site in a temporary folder and reports every finding; writes nothing in the checkout." },
    { run: "bun run pack", does: "Builds, inspects and packs the package into dist/." },
    { run: "IFCDOCS_UPDATE_GOLDEN=1 bun test suite/", does: "Writes the fixtures' HTML again; then read the diff." },
  ],
};
