#!/usr/bin/env node
/**
 * The `anyfs` command of the package (commons anyfs-cli 0004-anyfs-cli-surfaces FR-016): run from the `.ts` sources, which Bun and Node 26 both run, so that the same file is the command on both.
 *
 * @module
 */
import { main } from "../src/anyfs.ts";

process.exit(await main(process.argv.slice(2)));
