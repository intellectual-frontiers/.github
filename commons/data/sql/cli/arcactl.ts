#!/usr/bin/env bun
// Spec: 0046-arcactl FR-001
/**
 * The program `arcactl`: it gives `main` the real arguments and environment, prints what it returns and exits with its code.
 *
 * @module
 */
import { main } from "./main.ts";

const result = await main(process.argv.slice(2), { env: process.env, cwd: process.cwd() });
if (result.out !== "") process.stdout.write(result.out);
if (result.err !== "") process.stderr.write(result.err);
process.exit(result.code);
