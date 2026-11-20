#!/usr/bin/env node
/**
 * The `repoctl` command of the package (commons repoctl 0006-repoctl-surfaces FR-006): run from the `.ts` sources on Bun, and on Node 26 through the hook it registers first (the one `ifc` uses, from commons), so that the same file
 * is the command on both.
 *
 * @module
 */
import "@intellectual-frontiers/commons/ts/node";

const { main } = await import("../src/repoctl.ts");
process.exit(await main(process.argv.slice(2)));
