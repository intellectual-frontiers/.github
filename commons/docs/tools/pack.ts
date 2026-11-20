// Spec: 0001-docs FR-004
/**
 * The package that is published (commons 0001-docs FR-004, commons 0027-commons-libraries FR-015, commons 0032-lifting-libraries FR-005): `bun tools/pack.ts` compiles the sources of Docs with the TypeScript 7 compiler into modules and
 * declarations, writes the `package.json` that is published (each entry with its `types`, the source for Bun and the compiled file for the rest, the command `ifc-docs` as a launcher of the compiled `cli`, the theme files beside
 * the modules that read them), inspects the package and packs it into `dist/intellectual-frontiers-docs-<version>.tgz`, which the release workflow sends to npm and to the GitHub package registry. The `package.json` of this folder
 * stays private, so that nothing is published from it by hand.
 *
 * ```sh
 * bun tools/pack.ts            build, inspect and pack
 * bun tools/pack.ts --check    the same, saying so where nothing is wrong
 * ```
 *
 * @module
 */
import process from "node:process";
import { main } from "@intellectual-frontiers/libraries/pack";
import { path } from "@intellectual-frontiers/system";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

if (import.meta.main) process.exitCode = await main(ROOT, process.argv.slice(2), { types: ["node"], launchers: { "ifc-docs": "src/cli.ts" } });
