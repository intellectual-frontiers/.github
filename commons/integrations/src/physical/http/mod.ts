// Spec: 0001-integrations-layers FR-003; 0004-integrations-physical FR-001, FR-002, FR-003
/**
 * The HTTP adapter of observation (commons integrations 0004-integrations-physical): the read port of the logical layer made on Net's transport, with the read-only guard
 * (only safe methods, and POST only to the declared token endpoints), backoff on 429 and 503, pages by `Link` or by a cursor of the body, bearer or signed requests, and a
 * digest of what was fetched. It is the physical edge: the only place of observation that reaches a network.
 *
 * @remarks
 * A failure names the path of the request and never its query, its headers or its body, so that no credential or personal datum is said.
 *
 * @module
 */
import { absurd, err, ok, unknownValue, type Result } from "@intellectual-frontiers/core";
import { cursorPages, linkPages, readOnly, withBackoff, withSigV4, type ReadError, type SigV4TransportOptions, type Transport } from "@intellectual-frontiers/net/http-client";
import { parseSha256, type IdError, type Sha256 } from "@intellectual-frontiers/integrations/governance";
import type { Json, ReadFailure, ReadPort, Secret } from "@intellectual-frontiers/integrations/logical";

/** How a list pages: by the `Link` header, or by a cursor in the body (`items` takes a page's items, `next` the next page's path or undefined). */
export type Paging =
  | { readonly kind: "link" }
  | { readonly kind: "cursor"; readonly items: (body: Json) => readonly Json[]; readonly next: (body: Json, path: string) => string | undefined };

/** How the requests are authorized. */
export type Auth =
  | { readonly kind: "bearer"; readonly secret: Secret; readonly scheme: string }
  | { readonly kind: "header"; readonly name: string; readonly secret: Secret }
  | { readonly kind: "sigv4"; readonly options: SigV4TransportOptions }
  | { readonly kind: "none" };

/** What the read port of a system is made of. */
export type HttpReadOptions = {
  readonly transport: Transport;
  readonly base: string;
  readonly auth: Auth;
  readonly tokenEndpoints?: readonly string[];
  readonly headers?: Readonly<Record<string, string>>;
  readonly paging?: Paging;
  readonly maxPages?: number;
  readonly pause?: (ms: number) => Promise<void>;
};

/** A failure of the read as the logical layer says it: what was asked and what came, never a payload. */
export function failureOf(e: ReadError): ReadFailure {
  const subject = (url: string): string => {
    try {
      return new URL(url).pathname;
    } catch {
      return "(unparsable url)";
    }
  };
  switch (e.kind) {
    case "refused":
    case "network":
      return { kind: "network", subject: "(request)" };
    case "denied":
      return { kind: "denied", subject: subject(e.url) };
    case "status":
      return e.status === 404 ? { kind: "not-found", subject: subject(e.url) } : e.status === 429 ? { kind: "rate-limited", subject: subject(e.url) } : { kind: "server", subject: subject(e.url), status: e.status };
    case "decode":
      return { kind: "decode", subject: subject(e.url) };
    default:
      return absurd(e);
  }
}

function headersOf(auth: Auth, extra: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  switch (auth.kind) {
    case "bearer":
      return { ...extra, authorization: `${auth.scheme} ${auth.secret.reveal()}` };
    case "header":
      return { ...extra, [auth.name]: auth.secret.reveal() };
    case "sigv4":
    case "none":
      return extra;
    default:
      return absurd(auth);
  }
}

/** The read port of a system over a transport: read-only, backing off, paged, authorized; no write is possible through it. */
export function httpReadPort(o: HttpReadOptions): ReadPort {
  const guarded = readOnly(o.transport, o.tokenEndpoints ?? []);
  const signed = o.auth.kind === "sigv4" ? withSigV4(guarded, o.auth.options) : guarded;
  const t = withBackoff(signed, o.pause === undefined ? {} : { pause: o.pause });
  const headers = headersOf(o.auth, o.headers ?? {});
  const url = (path: string): string => (path.startsWith("https://") ? path : `${o.base}${path}`);
  const paging = o.paging ?? { kind: "link" };
  const maxPages = o.maxPages === undefined ? {} : { maxPages: o.maxPages };
  return {
    get: async (path) => {
      const x = await t.send({ method: "GET", url: url(path), headers: { accept: "application/json", ...headers } });
      if (x.kind === "err") return err({ kind: "network", subject: "(request)" });
      const status = x.value.status;
      if (status === 401 || status === 403) return err({ kind: "denied", subject: path.split("?")[0] ?? path });
      if (status === 404) return err({ kind: "not-found", subject: path.split("?")[0] ?? path });
      if (status === 429) return err({ kind: "rate-limited", subject: path.split("?")[0] ?? path });
      if (status >= 400) return err({ kind: "server", subject: path.split("?")[0] ?? path, status });
      try {
        const body: Json = JSON.parse(x.value.body) as Json;
        return ok(body);
      } catch {
        return err({ kind: "decode", subject: path.split("?")[0] ?? path });
      }
    },
    pages: async function* (path) {
      switch (paging.kind) {
        case "link": {
          const g = linkPages(t, url(path), unknownValue, { headers, ...maxPages });
          for (;;) {
            const n = await g.next();
            if (n.done === true) return n.value.kind === "ok" ? n.value : err(failureOf(n.value.error));
            yield n.value as Json;
          }
        }
        case "cursor": {
          const g = cursorPages(t, url(path), unknownValue, (b) => paging.items(b as Json), (b, u) => paging.next(b as Json, u), { headers, ...maxPages });
          for (;;) {
            const n = await g.next();
            if (n.done === true) return n.value.kind === "ok" ? n.value : err(failureOf(n.value.error));
            yield n.value as Json;
          }
        }
        default:
          return absurd(paging);
      }
    },
  };
}

/** The SHA-256 of a text, as the library's digest. */
export async function sha256Of(text: string): Promise<Result<Sha256, IdError>> {
  const bytes = new TextEncoder().encode(text);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return parseSha256([...digest].map((b) => b.toString(16).padStart(2, "0")).join(""));
}
