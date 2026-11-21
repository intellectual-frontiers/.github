// Spec: 0004-anyfs-middleware FR-002
/**
 * The tracer of the traced layer, made from the telemetry of commons: one declared span kind, `anyfs.op`, whose attributes are the store, the operation, the path, the outcome and the number of bytes, never
 * the bytes themselves. A span begins when the operation does and ends, with its outcome, when it has an answer.
 *
 * @example
 * ```ts
 * import { ANYFS_SIGNALS, tracerOf } from "./mod.ts";
 * // const tracer = tracerOf(createTelemetry({ registry: ANYFS_SIGNALS, ... }))
 * ```
 *
 * @module
 */
import { signals } from "@intellectual-frontiers/telemetry";
import type { Tracer } from "@intellectual-frontiers/anyfs/layers";

/** The one kind of signal the traced layer makes: a span for each operation of a store. */
const DECLARATIONS = {
  "anyfs.op": { signal: "span", role: "step", attributes: { store: "string", op: "string", "path?": "string", "outcome?": "string", "bytes?": "int" } },
} as const;

/** The registry of the signals the traced layer makes. */
export const ANYFS_SIGNALS = signals.defineSignals(DECLARATIONS);

/** Where the spans of the traced layer go: a telemetry made with `ANYFS_SIGNALS`. */
export type AnyfsTelemetry = signals.Telemetry<typeof DECLARATIONS>;

/** The tracer of a telemetry: each span it starts is a span of the telemetry, ended with the outcome. */
export function tracerOf(telemetry: AnyfsTelemetry): Tracer {
  return {
    start(_name, attributes) {
      let finish: (a: Readonly<Record<string, string | number>>) => void = () => undefined;
      const store = String(attributes["anyfs.store"] ?? "");
      const op = String(attributes["anyfs.op"] ?? "");
      const path = attributes["anyfs.path"];
      void telemetry.span(
        "anyfs.op",
        { store, op, ...(path === undefined ? {} : { path: String(path) }) },
        (handle) =>
          new Promise<void>((resolve) => {
            finish = (a) => {
              const bytes = a["anyfs.bytes"];
              handle.set({ outcome: String(a["anyfs.outcome"] ?? ""), ...(typeof bytes === "number" ? { bytes } : {}) });
              resolve();
            };
          }),
      );
      return { end: (a) => finish(a) };
    },
  };
}
