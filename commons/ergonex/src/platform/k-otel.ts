// Spec: 0002-workspace-model FR-005
/**
 * The kernel's `otel`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { otel } from "@intellectual-frontiers/commons/ts/kernel";
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
