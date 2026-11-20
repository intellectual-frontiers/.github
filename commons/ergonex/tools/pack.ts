// Spec: 0004-onboarding FR-001
/**
 * The package that is published (commons ergonex 0004-onboarding FR-001, commons 0027-commons-libraries FR-015, FR-016, commons 0032-lifting-libraries FR-005, FR-013): `bun tools/pack.ts` packs the command and the
 * library API of Ergonex through the packer of commons. The command is one bundled file with commons' kernel and runtime inside it (`bin: ergonex`); the library API is the entry `.` of the package, one bundled file
 * of code with the declarations of what the entry reaches (`types`), so that a program that imports `@intellectual-frontiers/ergonex` is type-checked against it. The `package.json` of this folder stays private,
 * so that nothing is published from it by hand.
 *
 * ```sh
 * bun tools/pack.ts            build, inspect and pack
 * bun tools/pack.ts --check    the same, saying so where nothing is wrong
 * ```
 *
 * @module
 */
import process from "node:process";
import { type PackOptions, main, packLibrary, type Packed } from "@intellectual-frontiers/commons/ts/tools/pack-library";
import { path } from "@intellectual-frontiers/commons/ts/runtime";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

/** The README that is published. */
const README = [
  "# Ergonex",
  "",
  "The workspaces management of Intellectual Frontiers: one command, `ergonex`, that sets up and operates a team's repositories, tools and shell on Windows, macOS and Linux.",
  "",
  "```sh",
  "bunx @intellectual-frontiers/ergonex init     # with Bun; with Node 26: npx @intellectual-frontiers/ergonex init",
  "```",
  "",
  "It makes the workspace folder, puts `ergonex` on your path and says what to do next. `ergonex doctor` checks the workspace and says what to fix.",
  "",
  'The package is also a library: `import { ... } from "@intellectual-frontiers/ergonex"` gives the plan, the manifest, the layout and the host, with their types.',
  "",
  "The sources and the specifications are in https://github.com/intellectual-frontiers/.github/tree/main/commons/ergonex",
  "",
].join("\n");

/** How the package is made: the command and the API are bundles (commons' kernel, runtime and the rest are inside them), `types` are the declarations of what the entry reaches. */
export const PACK: PackOptions = {
  types: ["node"],
  bundle: {
    bin: { ergonex: "bin/main.ts" },
    readme: README,
    keywords: ["workspace", "git", "repositories", "monorepo", "developer-tools"],
    extraFiles: ["CREDITS.md"],
  },
};

/** Builds, inspects and packs the package of this library. */
export const pack = (): Promise<Packed> => packLibrary(ROOT, PACK);

if (import.meta.main) process.exitCode = await main(ROOT, process.argv.slice(2), PACK);
