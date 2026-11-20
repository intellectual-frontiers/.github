#!/usr/bin/env node
/**
 * The `ifc-docs` command of the package (commons 0011-documentation FR-003, FR-021): `ifc-docs build` and `ifc-docs check`, as `cli.ts`
 * reads them, run from the `.ts` sources, which Bun and Node 26 both run, so that the same file is the command on both. In commons, `bun main.ts` runs the same from the source.
 *
 * @module
 */
import { main } from "./src/cli.ts";

process.exit(await main(process.argv.slice(2)));
