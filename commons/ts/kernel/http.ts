/**
 * Pure HTTP helpers that API clients keep rewriting (commons 0005-typescript-runtime FR-012): the `Link` header (RFC 8288) read into its
 * links so a client follows `rel="next"` pages, `Retry-After` (RFC 9110 §10.2.3) read as a wait whether it is seconds or a date, and which
 * methods are safe (RFC 9110 §9.2.1) so a read-only client can refuse the rest. Taken from Stolos's connector SDK
 * (`src/archon/connect/sdk.ts`, `connector.ts`), which matched `rel="next"` with a regular expression in two places.
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
