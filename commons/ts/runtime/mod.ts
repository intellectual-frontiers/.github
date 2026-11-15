/**
 * The runtime of IFC TypeScript (commons 0005-typescript-runtime): the one part that touches the host, on `node:` builtins and web standards
 * alone, so the same code runs on Deno, Node and Bun, on Linux, macOS and Windows. Its modules keep the names of the `Deno` calls they
 * replace (`fs.readTextFile`, `proc.env.get`, `errors.NotFound`, `serve`), so a conversion is a rename; `http` is the typed HTTP client
 * and `lock` one run at a time. Tests import `./test.ts` on its own.
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
export * as fs from "./fs.ts";
export * as http from "./http-client.ts";
export * as lock from "./lock.ts";
export * as net from "./net.ts";
export * as path from "./path.ts";
export * as proc from "./proc.ts";
export * as tty from "./tty.ts";
export { errors, mapError, RuntimeError, toError } from "./errors.ts";
export { serve } from "./serve.ts";
export type { NetAddr, Server, ServeHandler, ServeInfo, ServeOptions } from "./serve.ts";
