/**
 * The runtime of IFC TypeScript (commons 0005-typescript-runtime): what still touches the host in this package, on `node:` builtins and web standards alone, so the same code runs on Bun, the default runtime, and on Node 26, the
 * backup, on Linux, macOS and Windows. The host's files, paths, processes, Git, locks, watching and scheduled jobs are the library `system` (`@intellectual-frontiers/system`, commons 0032-lifting-libraries), which this runtime
 * and its tests import by package name. What is left has short, plain names (`http` is the typed HTTP client, `serve`, `net`, `tcp`, `dns`); `acme` gets certificates by ACME's DNS-01 challenge (commons 0013-acme),
 * `otel` is the pipeline that exports the runtime's signals, `terminal` the console that renders them, and `trace` reads the files the kernel's trace and layers checks judge and holds their findings against a baseline
 * (commons 0015-trace). Tests import `./test.ts` on its own.
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
export * as acme from "./acme.ts";
export * as dns from "./dns.ts";
export * as grc from "./grc.ts";
export * as http from "./http-client.ts";
export * as net from "./net.ts";
export * as otel from "./otel.ts";
export * as sign from "./sign.ts";
export * as tcp from "./tcp.ts";
export * as terminal from "./console.ts";
export * as trace from "./trace.ts";
export { serve } from "./serve.ts";
export type { NetAddr, Server, ServeHandler, ServeInfo, ServeOptions } from "./serve.ts";
