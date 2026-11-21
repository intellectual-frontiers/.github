// Spec: 0004-anyfs-posix-physical FR-006
/**
 * The read cache of the view: whole objects, kept by their path and their revision, so that an object read again while it has not changed costs a stat and no bytes. A revision names bytes, so an entry
 * can never be stale: a changed object has another revision and another key. The cache holds at most the bytes the policy gives and drops the oldest first; an object larger than the cache is not kept.
 *
 * @example
 * ```ts
 * import { ReadCache } from "./cache.ts";
 * const cache = new ReadCache(1024);
 * cache.put("a", "sha256:1", new Uint8Array(10));
 * cache.get("a", "sha256:1")?.length; // 10
 * ```
 *
 * @module
 */

/** The cache. */
export class ReadCache {
  readonly #max: number;
  readonly #entries = new Map<string, Uint8Array>();
  #bytes = 0;

  /** A cache that holds at most `max` bytes; 0 holds none. */
  constructor(max: number) {
    this.#max = max;
  }

  /** The bytes of an object at a revision, as a copy the caller may change, or nothing. */
  get(path: string, rev: string): Uint8Array | undefined {
    const hit = this.#entries.get(`${path}\n${rev}`);
    return hit === undefined ? undefined : hit.slice();
  }

  /** Keeps the bytes of an object at a revision, dropping the oldest until they fit. */
  put(path: string, rev: string, bytes: Uint8Array): void {
    if (bytes.length > this.#max) return;
    const key = `${path}\n${rev}`;
    const had = this.#entries.get(key);
    if (had !== undefined) {
      this.#bytes -= had.length;
      this.#entries.delete(key);
    }
    this.#entries.set(key, bytes.slice());
    this.#bytes += bytes.length;
    for (const oldest of this.#entries.keys()) {
      if (this.#bytes <= this.#max) break;
      const dropped = this.#entries.get(oldest);
      this.#entries.delete(oldest);
      this.#bytes -= dropped === undefined ? 0 : dropped.length;
    }
  }

  /** How many bytes it holds. */
  get bytes(): number {
    return this.#bytes;
  }
}
