#!/usr/bin/env node
/**
 * The `ifws` command of the package (commons 0025-ifws FR-001, FR-024): the command of Intellectual Frontiers Workspaces, run from the `.ts` sources on Bun, and on Node 26 through the hook it
 * registers first (`register.mjs`, the one `ifc` uses), so that the same file is the command on both.
 *
 * @module
 */
import "./register.mjs";

const { main } = await import("../workspaces/ifws.ts");
process.exit(await main(process.argv.slice(2)));
