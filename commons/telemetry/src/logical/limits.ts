// Spec: 0003-telemetry-reach FR-023
/**
 * The limits of a receiver, pure (0003-telemetry-reach FR-023): the largest body it reads, and a token bucket per source (a device, a relay, or `anonymous` where no one was identified) that says whether the next batch is taken
 * now or, if not, in how many milliseconds. A batch the bucket refuses is not taken, so it is not marked as seen: the sender keeps it and sends it again. The clock is an argument.
 *
 * @example
 * ```ts
 * import { newLimiter, take } from "./limits.ts";
 * const l = newLimiter({ maxBodyBytes: 1000, burst: 2, perSecond: 1 });
 * take(l, "device-01", 0).kind; // "taken"
 * ```
 *
 * @module
 */

/** What a source may send: the largest body in bytes, the batches it may send at once (`burst`) and the rate at which that allowance comes back. */
export type SourceLimits = { readonly maxBodyBytes: number; readonly burst: number; readonly perSecond: number };

/** The defaults: 4 MiB, a burst of 20 batches, one more each second. */
export const DEFAULT_SOURCE_LIMITS: SourceLimits = { maxBodyBytes: 4 * 1024 * 1024, burst: 20, perSecond: 1 };

/** What is wrong with a set of limits, as sentences (none where it is well formed). */
export function limitProblems(l: SourceLimits): readonly string[] {
  const out: string[] = [];
  if (!Number.isInteger(l.maxBodyBytes) || l.maxBodyBytes <= 0) out.push("maxBodyBytes is a positive whole number");
  if (!Number.isInteger(l.burst) || l.burst <= 0) out.push("burst is a positive whole number");
  if (!(l.perSecond > 0) || !Number.isFinite(l.perSecond)) out.push("perSecond is a positive number");
  return out;
}

/** The state of the buckets of every source: what is left of each allowance and when it was last filled. */
export type Limiter = { readonly limits: SourceLimits; readonly buckets: ReadonlyMap<string, { readonly tokens: number; readonly at: number }> };

/** A limiter with every source at its full allowance. */
export function newLimiter(limits: SourceLimits = DEFAULT_SOURCE_LIMITS): Limiter {
  return { limits, buckets: new Map() };
}

/** The answer of one request for a batch: taken (with the limiter after it), or refused with the milliseconds to wait. */
export type Taken = { readonly kind: "taken"; readonly limiter: Limiter } | { readonly kind: "limited"; readonly retryAfterMs: number; readonly limiter: Limiter };

/** Ask whether `source` may send a batch at `now` (milliseconds). The allowance fills at `perSecond` up to `burst`. */
export function take(limiter: Limiter, source: string, now: number): Taken {
  const { burst, perSecond } = limiter.limits;
  const old = limiter.buckets.get(source);
  const filled = old === undefined ? burst : Math.min(burst, old.tokens + Math.max(0, now - old.at) * (perSecond / 1000));
  const next = new Map(limiter.buckets);
  if (filled >= 1) {
    next.set(source, { tokens: filled - 1, at: now });
    return { kind: "taken", limiter: { limits: limiter.limits, buckets: next } };
  }
  next.set(source, { tokens: filled, at: now });
  return { kind: "limited", retryAfterMs: Math.ceil(((1 - filled) / perSecond) * 1000), limiter: { limits: limiter.limits, buckets: next } };
}
