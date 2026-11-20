// Spec: 0001-docs FR-003
/**
 * The `ifc-docs` command from the source (commons 0011-documentation FR-003): `bun main.ts build [--out DIR] [--config FILE]` and
 * `bun main.ts check [--config FILE]`, run in `commons/docs/`, as `cli.ts` reads them. The package's command is `ifc-docs.mjs`, which
 * registers the Node hook first, so that it runs from `node_modules` on Node 26 too (FR-021).
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/system";
import { main } from "./cli.ts";

if (import.meta.main) proc.exit(await main(proc.args));
