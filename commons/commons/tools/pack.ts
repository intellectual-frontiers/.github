// Spec: 0036-distribution FR-021
/**
 * The package that is published (commons 0036-distribution FR-019, FR-021): `bun tools/pack.ts` packs `@intellectual-frontiers/commons` into `dist/*.tgz`, which the release workflow sends to npm and to the GitHub package registry. In `single`
 * distribution mode (the mode of the repository) the package holds every library of commons, compiled, with their sources, one `exports` map, the union of their dependencies and their commands (`commons/libraries/src/pack-commons.ts`); in `per-library`
 * mode it is the metapackage with no code of its own that depends on the libraries at exact versions (`pack-metapackage.ts`). The `package.json` of this folder stays private.
 *
 * ```sh
 * bun tools/pack.ts            build, stage, inspect and pack
 * bun tools/pack.ts --check    the same, saying so where nothing is wrong
 * ```
 *
 * @module
 */
import process from "node:process";
import { activeMode, MODE_VARIABLE } from "@intellectual-frontiers/libraries/distribution";
import { main as packSingle } from "@intellectual-frontiers/libraries/pack-commons";
import { main as packSet } from "@intellectual-frontiers/libraries/pack-metapackage";
import { path, proc } from "@intellectual-frontiers/system";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "..", "..");

async function run(argv: readonly string[]): Promise<number> {
  const mode = activeMode(proc.env.get(MODE_VARIABLE));
  if (mode.kind === "err") {
    console.error(mode.error);
    return 2;
  }
  switch (mode.value) {
    case "single":
      return packSingle(REPO, argv);
    case "per-library":
      return packSet(ROOT, argv);
    default: {
      const never: never = mode.value;
      return never;
    }
  }
}

if (import.meta.main) process.exitCode = await run(process.argv.slice(2));
