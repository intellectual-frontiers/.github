#!/usr/bin/env node
/**
 * The `ifc-docs` command (commons 0011-documentation FR-003, FR-021): `ifc-docs build [--out DIR] [--config FILE]` and
 * `ifc-docs check [--config FILE]`, as `cli.ts` reads them, run on Bun or on Node 26. In commons, `bun main.ts build` and
 * `bun main.ts check` run it from the source in `commons/docs/`.
 *
 * @module
 */
import { proc } from "@intellectual-frontiers/ifc-ts/runtime";
import { main } from "./cli.ts";

if (import.meta.main) proc.exit(await main(proc.args));
