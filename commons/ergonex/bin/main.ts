// Spec: 0004-onboarding FR-001
/**
 * The entry that is bundled into the one file of the published package (commons ergonex 0004-onboarding FR-001): the controller and everything it imports, commons' kernel and runtime included, so that the
 * package needs nothing installed beside it and runs on Bun and on Node 26 as it is. `tools/pack.ts` builds it.
 *
 * @module
 */
import process from "node:process";
import { main } from "../src/ergonex.ts";

process.exit(await main(process.argv.slice(2)));
