// Spec: 0001-tool-layers FR-005
/**
 * The package that is published (commons 0032-libraries-by-concern FR-005, FR-013): `bun tools/pack.ts` compiles the sources of desired-os-state-tool with the TypeScript 7 compiler into modules and declarations, writes the
 * `package.json` that is published (each entry with its `types`, the source for Bun and the compiled file for the rest), inspects the package and packs it into `dist/intellectual-frontiers-desired-os-state-tool-<version>.tgz`,
 * which the publish workflow sends to npm and to the GitHub package registry. The `package.json` of this folder stays private, so that nothing is published from it by hand.
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

if (import.meta.main) process.exitCode = await main(ROOT, process.argv.slice(2), { types: ["node"] });
