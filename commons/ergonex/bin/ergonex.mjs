#!/usr/bin/env node
/**
 * The `ergonex` command of the package (commons 0001-ergonex FR-001, FR-024): run from the `.ts` sources, which Bun and Node 26 both run, so that
 * the same file is the command on both.
 *
 * @module
 */
import { main } from "../src/ergonex.ts";

process.exit(await main(process.argv.slice(2)));
