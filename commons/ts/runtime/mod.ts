/**
 * The runtime of IFC TypeScript (commons 0005-typescript-runtime): what still touches the host in this package, on `node:` builtins and web standards alone, so the same code runs on Bun, the default runtime, and on Node 26, the
 * backup, on Linux, macOS and Windows. The host's files, paths, processes, Git, locks, watching and scheduled jobs are the library `system` (`@intellectual-frontiers/system`, commons 0032-lifting-libraries), which this runtime
 * and its tests import by package name; the network (the typed HTTP client, `serve`, `net`, `tcp`, `dns` and `acme`, which gets certificates by ACME's DNS-01 challenge, commons 0013-acme) is the library `net`
 * (`@intellectual-frontiers/net`). The signals (the pipeline that exports them and the console that renders them) are the library `telemetry` (`@intellectual-frontiers/telemetry`, commons 0032-lifting-libraries),
 * the governance, risk and compliance primitives, their loaders and the signers are the library `grc` (`@intellectual-frontiers/grc`, commons 0032-lifting-libraries),
 * Tests import the library `test` (`@intellectual-frontiers/test`, commons 0032-lifting-libraries), which loads no test runner for a program that does not test.
 *
 * @example
 * ```ts
 * import { fs, proc } from "@intellectual-frontiers/system";
 * const home = proc.env.get("HOME") ?? proc.homeDir();
 * console.log(await fs.readTextFile(`${home}/.profile`));
 * ```
 *
 * @module
 */
