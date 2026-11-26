// Spec: 0003-server-policy FR-006
/**
 * Rate limits and penalties, pure over an injected clock: a token bucket per source, and a penalty that grows by doubling with each strike and ends by itself.
 *
 * @module
 */

/** A token bucket. */
export type Bucket = { readonly tokens: number; readonly at: number };
/** The settings of a bucket. */
export type BucketConfig = { readonly capacity: number; readonly refillPerSecond: number };

/** A full bucket at a time. */
export function fullBucket(config: BucketConfig, now: number): Bucket {
  return { tokens: config.capacity, at: now };
}

/** Take one token at `now`: the bucket after, whether it was allowed and how long to wait where it was not. A clock that goes back is treated as no time passing. */
export function take(bucket: Bucket, config: BucketConfig, now: number): { readonly bucket: Bucket; readonly allowed: boolean; readonly retryAfterMs: number } {
  const elapsed = Math.max(0, now - bucket.at) / 1000;
  const tokens = Math.min(config.capacity, bucket.tokens + elapsed * config.refillPerSecond);
  if (tokens >= 1) return { bucket: { tokens: tokens - 1, at: now }, allowed: true, retryAfterMs: 0 };
  const wait = config.refillPerSecond > 0 ? Math.ceil(((1 - tokens) / config.refillPerSecond) * 1000) : Number.POSITIVE_INFINITY;
  return { bucket: { tokens, at: now }, allowed: false, retryAfterMs: wait };
}

/** What is held against a source. */
export type Penalty = { readonly strikes: number; readonly blockedUntil: number };
/** The settings of penalties. */
export type PenaltyConfig = { readonly baseMs: number; readonly maxMs: number };

/** No strike. */
export const CLEAN: Penalty = { strikes: 0, blockedUntil: 0 };

/** Add a strike at `now`: the block lasts `baseMs` doubled for each earlier strike, up to `maxMs`. */
export function strike(p: Penalty, config: PenaltyConfig, now: number): Penalty {
  const ms = Math.min(config.maxMs, config.baseMs * 2 ** Math.min(p.strikes, 30));
  return { strikes: p.strikes + 1, blockedUntil: now + ms };
}

/** Whether a source is blocked at `now`. */
export function blocked(p: Penalty, now: number): boolean {
  return now < p.blockedUntil;
}

/** A source that was quiet for a time forgives its strikes: where `forgetMs` passed since the block ended, the penalty is clean. */
export function forgive(p: Penalty, now: number, forgetMs: number): Penalty {
  return p.strikes > 0 && now >= p.blockedUntil + forgetMs ? CLEAN : p;
}
