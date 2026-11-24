// Spec: 0001-anyfs-gdrive-layers FR-003
/**
 * How the store reaches a service: a function from a request to an answer, so that the live network (`fetch`, which Bun and Node 26 both have) and a recorded, documented or simulated service are the same to the client above it. An
 * answer is the status, the headers in lower case and the bytes; a redirect is an answer and never followed (so that a bearer token is never sent to an address nobody checked), and a
 * connection that fails is the reason and not a thrown error.
 *
 * @example
 * ```ts
 * import { fetchTransport } from "./transport.ts";
 * const send = fetchTransport();
 * // await send({ method: "GET", url: "https://www.googleapis.com/drive/v3/files", headers: {} }, { timeoutMs: 5000 });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The methods the store uses. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** A request to a service. */
export type HttpRequest = { readonly method: HttpMethod; readonly url: string; readonly headers: Readonly<Record<string, string>>; readonly body?: Uint8Array };

/** What a service answered. */
export type HttpResponse = { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly body: Uint8Array };

/** What a request is allowed. */
export type SendOptions = { readonly timeoutMs: number };

/** The transport: an answer, or why there was none. */
export type Transport = (request: HttpRequest, options: SendOptions) => Promise<Result<HttpResponse, string>>;

/** The transport over `fetch`. */
export function fetchTransport(): Transport {
  return async (request, options) => {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        ...(request.body === undefined ? {} : { body: request.body as BodyInit }),
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, name) => {
        headers[name.toLowerCase()] = value;
      });
      const body = new Uint8Array(await response.arrayBuffer());
      return ok({ status: response.status, headers, body });
    } catch (thrown) {
      const name = thrown instanceof Error ? thrown.name : "";
      if (name === "TimeoutError" || name === "AbortError") return err(`no answer in ${options.timeoutMs} ms`);
      const cause = thrown instanceof Error && thrown.cause instanceof Error ? ` (${thrown.cause.message})` : "";
      return err(`the connection failed: ${thrown instanceof Error ? thrown.message : String(thrown)}${cause}`);
    }
  };
}
