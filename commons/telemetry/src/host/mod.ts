// Spec: 0001-telemetry FR-026
/**
 * The host of Telemetry (its specification 0001-telemetry): the exporter over OTLP/HTTP JSON with its journal, its probe and the pipeline a process installs (as `otel`, with `startTelemetry`), and the console that
 * renders signals for a person and is the one writer to standard output and standard error for that (as `console`). It names `node:` builtins and no vendor's global, and depends on the library `system` for
 * the process, the terminal and the files.
 *
 * @example
 * ```ts
 * import { otel } from "@intellectual-frontiers/telemetry/host";
 * const run = otel.startTelemetry({ registry, service: "build" });
 * ```
 *
 * @module
 */
export * as console from "./console.ts";
export * as otel from "./otel.ts";
