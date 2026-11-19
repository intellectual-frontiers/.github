#!/usr/bin/env node
/**
 * The `ergonex` command of the package (commons 0001-ergonex FR-001, FR-024): run from the `.ts` sources on Bun, and on Node 26 through the hook it registers first (the one `ifc` uses, from commons), so that
 * the same file is the command on both.
 *
 * @module
 */
import "@intellectual-frontiers/commons/ts/node";

const { main } = await import("../src/ergonex.ts");
process.exit(await main(process.argv.slice(2)));
