#!/usr/bin/env node
/**
 * The `repoctl` command of the package (commons repoctl 0006-repoctl-surfaces FR-006): run from the `.ts` sources, which Bun and Node 26 both run, so that the same file
 * is the command on both.
 *
 * @module
 */
import { main } from "../src/repoctl.ts";

process.exit(await main(process.argv.slice(2)));
