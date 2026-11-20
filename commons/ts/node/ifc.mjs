#!/usr/bin/env node
/**
 * The `ifc` command of the package (commons 0005-typescript-runtime FR-070, 0008-test-evidence): `ifc test run|sign|verify|render`,
 * the command line of test evidence, run from the `.ts` sources on Bun, and on Node 26 through the hook it registers first
 * (`register.mjs`), so that the same file is the command on both.
 *
 * @module
 */
import "./register.mjs";

const USAGE = "usage: ifc test run|sign|verify|render [OPTIONS] (--help for each)";
const [command, ...rest] = process.argv.slice(2);
if (command === "test") {
  const { main } = await import("@intellectual-frontiers/quality/test-cli");
  process.exit(await main(rest));
} else {
  console.error(command === undefined ? USAGE : `ifc: ${command} is not a command; ${USAGE}`);
  process.exit(2);
}
