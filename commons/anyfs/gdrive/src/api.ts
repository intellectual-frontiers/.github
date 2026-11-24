// Spec: 0002-anyfs-gdrive-store FR-001, FR-008
/**
 * The client of the Drive API: it puts the bearer token of the token source on every request, says `supportsAllDrives` on every one so that a shared drive is served as a personal one, asks again once with a new token
 * when the service refuses the first, and gives what the service answered, or why it did not, as a value. It knows nothing of what a file is.
 *
 * @example
 * ```ts
 * import { makeDrive } from "./api.ts";
 * // const drive = makeDrive({ endpoint: "https://www.googleapis.com", token, transport, timeoutMs: 30000 });
 * // await drive.send({ method: "GET", path: "/drive/v3/files/ID", query: { fields: "id" } });
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
export type DriveRequest = {
  readonly method: HttpMethod;
  /** The path below the endpoint: `/drive/v3/files/ID` or `/upload/drive/v3/files`. */
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array;
};

/** A client. */
export type Drive = { send(request: DriveRequest): Promise<Result<HttpResponse, CallError>> };

/** What a client is made with. */
export type DriveOptions = { readonly endpoint: string; readonly token: TokenSource; readonly transport: Transport; readonly timeoutMs: number };

const queryText = (query: Readonly<Record<string, string>>): string => {
  const parts = Object.entries(query).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
};

/** A client of the Drive API. */
export function makeDrive(options: DriveOptions): Drive {
  const base = options.endpoint.replace(/\/+$/u, "");
  const attempt = async (request: DriveRequest, url: string): Promise<Result<HttpResponse, CallError>> => {
    const token = await options.token();
    if (token.kind === "err") return err({ kind: "token", message: token.error });
    const answer = await options.transport({ method: request.method, url, headers: { ...request.headers, authorization: `Bearer ${token.value}`, accept: "application/json" }, ...(request.body === undefined ? {} : { body: request.body }) }, { timeoutMs: options.timeoutMs });
    if (answer.kind === "err") return err({ kind: "transport", message: answer.error });
    return ok(answer.value);
  };
  return {
    async send(request) {
      const url = `${base}${request.path}${queryText({ supportsAllDrives: "true", ...request.query })}`;
      let answered = await attempt(request, url);
      if (answered.kind === "ok" && answered.value.status === 401) answered = await attempt(request, url);
      if (answered.kind === "err") return answered;
      const response = answered.value;
      if (response.status >= 200 && response.status < 300) return ok(response);
      return err({ kind: "failure", failure: failureOf(response.status, response.headers, response.body) });
    },
  };
}
