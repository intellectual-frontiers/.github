// Spec: 0004-anyfs-middleware FR-001
/**
 * What the layers are given instead of reaching for it: the clock and the sleep, the tracer and the sink of the audit. Each is a value a caller passes, so that every layer is a function of its arguments and a
 * test holds time in its hand.
 *
 * @example
 * ```ts
 * import type { Clock } from "./ports.ts";
 * const clock: Clock = { now: () => 0, sleep: async () => {} };
 * ```
 *
 * @module
 */
import type { OpName } from "../ops.ts";

/** Time: the instant in milliseconds since the epoch, and a wait. */
export type Clock = { now(): number; sleep(ms: number): Promise<void> };

/** A span that has begun: it ends with the attributes of what happened. */
export type Span = { end(attributes: Readonly<Record<string, string | number>>): void };
/** Where spans begin. */
export type Tracer = { start(name: string, attributes: Readonly<Record<string, string | number>>): Span };

/** What the audit says of one operation. It holds no bytes and no text of a file. */
export type AuditRecord = {
  readonly at: string;
  readonly store: string;
  readonly op: OpName;
  readonly path?: string;
  readonly outcome: "ok" | "missing" | "conflict" | "refused" | "unavailable" | "tampered";
  readonly size?: number;
};
/** Where the audit records go: it may throw, and the operation says so. */
export type AuditSink = (record: AuditRecord) => Promise<void>;
