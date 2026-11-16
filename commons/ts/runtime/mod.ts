/**
 * The runtime of IFC TypeScript (commons 0005-typescript-runtime): the one part that touches the host, on `node:` builtins and web standards
 * alone, so the same code runs on Bun, the default runtime, and on Node 26, the backup, on Linux, macOS and Windows. Its modules have short, plain names
 * (`fs.readTextFile`, `proc.env.get`, `errors.NotFound`, `serve`); `http` is the typed HTTP client
 * `lock` one run at a time, and `discover` finds programs by the prefix of their name, as Git finds its commands. Tests import `./test.ts` on its own.
 *
 * @example
 * ```ts
 * import { errors, fs, proc } from "./mod.ts";
 * const home = proc.env.get("HOME") ?? proc.homeDir();
 * try {
 *   console.log(await fs.readTextFile(`${home}/.profile`));
 * } catch (e) {
 *   if (!(e instanceof errors.NotFound)) throw e;
 * }
 * ```
 *
 * @module
 */
export * as compile from "./compile.ts";
export * as discover from "./discover.ts";
export * as dns from "./dns.ts";
export * as fs from "./fs.ts";
export * as git from "./git.ts";
export * as grc from "./grc.ts";
export * as http from "./http-client.ts";
export * as lock from "./lock.ts";
export * as net from "./net.ts";
export * as otel from "./otel.ts";
export * as path from "./path.ts";
export * as proc from "./proc.ts";
export * as sign from "./sign.ts";
export * as jobs from "./schedule.ts";
export * as stdio from "./stdio.ts";
export * as tcp from "./tcp.ts";
export * as terminal from "./console.ts";
export * as watch from "./watch.ts";
export * as tty from "./tty.ts";
export { errors, mapError, RuntimeError, toError } from "./errors.ts";
export { serve } from "./serve.ts";
export type { NetAddr, Server, ServeHandler, ServeInfo, ServeOptions } from "./serve.ts";
