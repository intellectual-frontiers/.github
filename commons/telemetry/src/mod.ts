// Spec: 0001-telemetry FR-026
/**
 * Telemetry, OpenTelemetry-native signals as one typed library (its specification 0001-telemetry): the data model, W3C Trace Context and the configuration from the environment (as `otel`), OTLP/HTTP JSON
 * (as `otlp`), typed signals declared once with spans, log events and metrics (as `signals`), and the pure reducer that renders them for a terminal (as `render`). This entry is pure: it names no host global,
 * reads no environment and writes nothing. The code that exports, journals and shows signals is `@intellectual-frontiers/telemetry/host`.
 *
 * @example
 * ```ts
 * import { signals } from "@intellectual-frontiers/telemetry";
 * const registry = signals.defineSignals({ "build": { kind: "span", attributes: {} } });
 * ```
 *
 * @module
 */
export * as otel from "./otel.ts";
export * as otlp from "./otlp.ts";
export * as render from "./render.ts";
export * as signals from "./signals.ts";
