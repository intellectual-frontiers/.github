/**
 * Pure HTTP helpers that API clients and servers keep rewriting (commons 0005-typescript-runtime FR-012): the `Link` header (RFC 8288) read into its
 * links so a client follows `rel="next"` pages, `Retry-After` (RFC 9110 §10.2.3) read as a wait whether it is seconds or a date, and which
 * methods are safe (RFC 9110 §9.2.1) so a read-only client can refuse the rest, and the entity-tag conditions of `If-Match` and
 * `If-None-Match` (RFC 9110 §13.1) a server answers with 412 or 304. Taken from Stolos's connector SDK (`src/archon/connect/sdk.ts`,
 * `connector.ts`), which matched `rel="next"` with a regular expression in two places, and erga's `lib/ts/http` (on `@std/http/etag`).
 *
 * @example
 * ```ts
 * import { nextLink, retryAfterMs } from "./http.ts";
 * nextLink('<https://api.example.com/items?page=2>; rel="next", <https://api.example.com/items?page=9>; rel="last"');
 * // "https://api.example.com/items?page=2"
 * retryAfterMs("120", Date.now()); // 120000
 * ```
 *
 * @module
 */

/** One link of a `Link` header: its target and its parameters (`rel`, `type`, ...), names in lower case. */
export type WebLink = { readonly target: string; readonly params: Readonly<Record<string, string>> };

/** The links of a `Link` header, in order; a part that is not `<target>; params` is skipped. Relative targets are resolved against `base`. */
export function parseLinkHeader(header: string, base?: string): readonly WebLink[] {
  const out: WebLink[] = [];
  const re = /<([^>]*)>((?:\s*;\s*[^;,=\s]+(?:\s*=\s*(?:"(?:[^"\\]|\\.)*"|[^;,\s]*))?)*)\s*(?:,|$)/g;
  for (const m of header.matchAll(re)) {
    const raw = m[1] ?? "";
    let target = raw;
    if (base !== undefined) {
      try {
        target = new URL(raw, base).href;
      } catch {
        continue;
      }
    }
    const params: Record<string, string> = {};
    for (const p of (m[2] ?? "").matchAll(/;\s*([^;,=\s]+)(?:\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;,\s]*)))?/g)) {
      const name = (p[1] ?? "").toLowerCase();
      if (!(name in params)) params[name] = (p[2] ?? p[3] ?? "").replace(/\\(.)/g, "$1");
    }
    out.push({ target, params });
  }
  return out;
}

/** The target of the first link whose `rel` names `rel` (`next` by default); a `rel` may name several, separated by spaces. */
export function nextLink(header: string | null | undefined, rel = "next", base?: string): string | undefined {
  if (header === null || header === undefined) return undefined;
  return parseLinkHeader(header, base).find((l) => (l.params["rel"] ?? "").toLowerCase().split(/\s+/).includes(rel))?.target;
}

/** How long a `Retry-After` value asks to wait, in milliseconds from `now`: whole seconds, or an HTTP date (never negative); undefined where it is neither. */
export function retryAfterMs(value: string | null | undefined, now: number): number | undefined {
  if (value === null || value === undefined) return undefined;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v) * 1000;
  if (!/[A-Za-z]/.test(v)) return undefined;
  const at = Date.parse(v);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

/** The methods that only read (RFC 9110 §9.2.1). */
export const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

/** Whether a method only reads; case does not matter. */
export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

/** The entity tags of an `If-Match` or `If-None-Match` header, as written (`"abc"`, `W/"abc"`), or `*`. */
export function entityTags(header: string): readonly string[] | "*" {
  if (header.trim() === "*") return "*";
  return [...header.matchAll(/(?:W\/)?"[^"]*"/g)].map((m) => m[0]);
}

const opaque = (tag: string): string => tag.replace(/^W\//, "");

/** An entity tag for content by its checksum or another stable token: strong (`"token"`), or weak (`W/"token"`). */
export function entityTag(token: string, weak = false): string {
  return `${weak ? "W/" : ""}"${token.replaceAll('"', "")}"`;
}

/**
 * Whether a request with this `If-Match` header may go on for content with this entity tag (RFC 9110 §13.1.1): yes where the header is
 * absent, is `*`, or names the tag by strong comparison (a weak tag never matches).
 */
export function ifMatch(header: string | null | undefined, etag: string): boolean {
  if (header === null || header === undefined) return true;
  const tags = entityTags(header);
  if (tags === "*") return true;
  return !etag.startsWith("W/") && tags.some((t) => !t.startsWith("W/") && t === etag);
}

/**
 * Whether a request with this `If-None-Match` header should get the content again (RFC 9110 §13.1.2), rather than 304 or 412: yes where
 * the header is absent or names no tag equal to this one by weak comparison; no where it is `*`.
 */
export function ifNoneMatch(header: string | null | undefined, etag: string): boolean {
  if (header === null || header === undefined) return true;
  const tags = entityTags(header);
  if (tags === "*") return false;
  return !tags.some((t) => opaque(t) === opaque(etag));
}
