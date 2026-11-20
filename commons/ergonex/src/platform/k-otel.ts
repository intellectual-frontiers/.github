// Spec: 0002-workspace-model FR-005
/**
 * The `otel` of the library `telemetry`, by its package name (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { otel } from "@intellectual-frontiers/telemetry";
/** `otel.parseSpanId`. */
export const parseSpanId = otel.parseSpanId;
/** `otel.parseTraceId`. */
export const parseTraceId = otel.parseTraceId;
/** `otel.Attributes`. */
export type Attributes = otel.Attributes;
/** `otel.SpanId`. */
export type SpanId = otel.SpanId;
/** `otel.TraceId`. */
export type TraceId = otel.TraceId;
