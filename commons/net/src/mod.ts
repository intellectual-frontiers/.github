// Spec: 0001-net FR-017
/**
 * Net, the network of Intellectual Frontiers Commons as one typed library (its specification 0001-net): downloads that retry and resume (as `net`), an HTTP server over web `Request` and `Response` (as `serve`),
 * typed HTTP clients with a live or recorded transport (as `http`), TCP and TLS (as `tcp`), DNS records (as `dns`) and ACME certificates by DNS-01 (as `acme`). It names `node:` builtins and no vendor's global,
 * depends on core, formats, crypto, system and telemetry, and runs the same on Bun and on Node 26.
 *
 * @example
 * ```ts
 * import { serve } from "@intellectual-frontiers/net";
 * const server = await serve({ port: 0 }, () => new Response("ok"));
 * await server.shutdown();
 * ```
 *
 * @module
 */
export * as acme from "./acme.ts";
export * as dns from "./dns.ts";
export * as http from "./http-client.ts";
export * as net from "./net.ts";
export * as tcp from "./tcp.ts";
export { serve } from "./serve.ts";
export type { NetAddr, Server, ServeHandler, ServeInfo, ServeOptions } from "./serve.ts";
