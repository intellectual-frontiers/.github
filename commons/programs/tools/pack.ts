// Spec: 0036-distribution FR-008
/**
 * The package that is published (commons 0036-distribution FR-008): `bun tools/pack.ts` stages the package `@intellectual-frontiers/programs` (no code, the exact dependencies of its set, the README and the `LICENSE`), inspects it
 * with the inspection of every library's package and packs it into `dist/*.tgz`, which the release workflow sends to npm and to the GitHub package registry. The `package.json` of this folder stays private.
 *
 * ```sh
 * bun tools/pack.ts            stage, inspect and pack
 * bun tools/pack.ts --check    the same, saying so where nothing is wrong
 * ```
 *
 * @module
 */
import process from "node:process";
import { main } from "@intellectual-frontiers/libraries/pack-metapackage";
import { path } from "@intellectual-frontiers/system";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

if (import.meta.main) process.exitCode = await main(ROOT, process.argv.slice(2));
