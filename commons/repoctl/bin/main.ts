// Spec: 0006-repoctl-surfaces FR-006
/**
 * The entry that is bundled into the one file of the published package (commons repoctl 0006-repoctl-surfaces FR-006): the program and everything it imports, commons' kernel and runtime included, so that the package needs nothing
 * installed beside it and runs on Bun and on Node 26 as it is. `tools/pack.ts` builds it.
 *
 * @module
 */
import process from "node:process";
import { main } from "../src/repoctl.ts";

process.exit(await main(process.argv.slice(2)));
