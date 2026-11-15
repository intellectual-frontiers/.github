/**
 * The typed facts of commons' documentation generator (commons 0011-documentation), as the site it makes shows them: its folders and what
 * each may import, and the commands that work on it.
 *
 * @module
 */
import type { About } from "../ts/kernel/mod.ts";

/** The documentation generator: the site made from commons' TypeScript and spec kit alone. */
export const about: About = {
  title: "Documentation generator",
  summary: "The generator of this site. It reads only commons' TypeScript (module documentation, TSDoc, the `about` of each package, " +
    "examples, and the values of models and layouts) and the spec kit, through the TypeScript 7.1 programmatic API and the libraries' own " +
    "functions, and writes static HTML with no framework. It knows what each library is for: a schema written with SQL Aide is shown as a " +
    "schema, a layout written with File Aide as a layout. Nothing is written for the site alone.",
  spec: { repo: "commons", id: "0011-documentation" },
  folders: [
    { path: "extract/", what: "The readers of the spec kit and of the API, through `typescript/async`.", mayImport: ["the kernel", "the runtime", "typescript/async"] },
    { path: "lens/", what: "What the generator knows of each library: which exports are its, and the pages their values make.", mayImport: ["the kernel", "the libraries' entry points"] },
    { path: "emit/", what: "The page model written as HTML, and the search index.", mayImport: ["the kernel"] },
    { path: "theme/", what: "The stylesheet and the one script of the site.", mayImport: ["nothing: CSS and a browser script"] },
    { path: "suite/", what: "The tests, with the HTML of the fixtures committed under `golden/`.", mayImport: ["anything here"] },
  ],
  commands: [
    { run: "bun install --frozen-lockfile", does: "Installs TypeScript 7.1 (beta), Mermaid and @types/node, exactly as bun.lock pins them." },
    { run: "bun run verify", does: "Runs the compiler, the tests, then --check on commons." },
    { run: "bun run site", does: "Writes the site into _site at the root of the checkout." },
    { run: "bun run site:check", does: "Builds the site in a temporary folder and reports every finding; writes nothing in the checkout." },
    { run: "IFCDOCS_UPDATE_GOLDEN=1 bun test suite/", does: "Writes the fixtures' HTML again; then read the diff." },
  ],
};
