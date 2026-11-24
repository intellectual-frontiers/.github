// Spec: 0002-anyfs-onedrive-store FR-001, FR-008
/**
 * The client of Microsoft Graph: it puts the bearer token of the token source on every request to the service, asks again once with a new token when the service refuses the first, follows the redirect of a download to
 * its pre-authenticated address without the token (and only to an `https` address), and gives what the service answered, or why it did not, as a value. It knows nothing of what an item is.
 *
 * @example
 * ```ts
 * import { makeGraph } from "./graph.ts";
 * // const graph = makeGraph({ endpoint: "https://graph.microsoft.com/v1.0", token, transport, timeoutMs: 30000 });
 * // await graph.send({ method: "GET", address: "/me/drive/root" });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { failureOf, type Failure } from "./errors.ts";
import type { HttpMethod, HttpResponse, Transport } from "./transport.ts";

/** Where a bearer token comes from: a function that gives one, or says why it cannot. It is asked for every request, so that it may refresh. */
export type TokenSource = () => Promise<Result<string, string>>;

/** The token that is always the same text, for a program that holds one for a short time. */
export const staticToken = (token: string): TokenSource => () => Promise.resolve(ok(token));

/** Why a call gave no answer to read. */
export type CallError = { readonly kind: "transport"; readonly message: string } | { readonly kind: "token"; readonly message: string } | { readonly kind: "failure"; readonly failure: Failure };

/** What a request is. */
export type GraphRequest = {
  readonly method: HttpMethod;
  /** The address below the endpoint, already written as a URL (`/me/drive/root:/a/b`). */
  readonly address?: string;
  /** A whole address, as the service gave it (a next page): it must be on the host of the endpoint. */
  readonly url?: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
  /** Follow the redirect of a download without the token. */
  readonly download?: boolean;
};

/** A client. */
export type Graph = { send(request: GraphRequest): Promise<Result<HttpResponse, CallError>> };

/** What a client is made with. */
export type GraphOptions = { readonly endpoint: string; readonly token: TokenSource; readonly transport: Transport; readonly timeoutMs: number };

const queryText = (query: Readonly<Record<string, string>> | undefined): string => {
  const parts = Object.entries(query ?? {}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
};

/** The host of an address, or nothing where it is not an address. */
function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

/** Whether an address of a page is one the client may follow: on the host of the endpoint and `https`. */
export function sameService(endpoint: string, url: string): boolean {
  try {
    const a = new URL(endpoint);
    const b = new URL(url);
    return a.protocol === b.protocol && a.host === b.host;
  } catch {
    return false;
  }
}

/** A client of Graph. */
export function makeGraph(options: GraphOptions): Graph {
  const base = options.endpoint.replace(/\/+$/u, "");
  const attempt = async (request: GraphRequest, url: string): Promise<Result<HttpResponse, CallError>> => {
    const token = await options.token();
    if (token.kind === "err") return err({ kind: "token", message: token.error });
    const answer = await options.transport({ method: request.method, url, headers: { ...request.headers, authorization: `Bearer ${token.value}`, accept: "application/json, */*" }, ...(request.body === undefined ? {} : { body: request.body }) }, { timeoutMs: options.timeoutMs });
    if (answer.kind === "err") return err({ kind: "transport", message: answer.error });
    return ok(answer.value);
  };
  return {
    async send(request) {
      let url: string;
      if (request.url !== undefined) {
        if (!sameService(base, request.url)) return err({ kind: "transport", message: `the service gave a link to ${hostOf(request.url) ?? "a place that is not an address"}, which is not the service the store was opened on` });
        url = request.url;
      } else url = `${base}${request.address ?? ""}${queryText(request.query)}`;
      let answered = await attempt(request, url);
      if (answered.kind === "ok" && answered.value.status === 401) answered = await attempt(request, url);
      if (answered.kind === "err") return answered;
      let response = answered.value;
      if (request.download === true && [302, 303, 307].includes(response.status)) {
        const location = response.headers["location"];
        if (location === undefined || !location.startsWith("https://")) return err({ kind: "transport", message: "the service redirected a download to an address that is not https" });
        // the pre-authenticated address of the content: no token goes to it
        const followed = await options.transport({ method: "GET", url: location, headers: {} }, { timeoutMs: options.timeoutMs });
        if (followed.kind === "err") return err({ kind: "transport", message: followed.error });
        response = followed.value;
      }
      if (response.status >= 200 && response.status < 300) return ok(response);
      const failure = failureOf(response.status, response.headers, response.body);
      return err({ kind: "failure", failure });
    },
  };
}
