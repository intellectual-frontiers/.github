/**
 * An HTTP server whose handler takes a web `Request` and gives a web `Response` on `node:http`, so the same handler
 * runs on Bun and Node (commons 0005-typescript-runtime FR-025). Request bodies and response bodies stream; a client that goes away
 * aborts `request.signal`. `serve` returns a promise, settled once the port is bound, so `addr` is known.
 *
 * @example
 * ```ts
 * import { serve } from "./serve.ts";
 * const server = await serve({ port: 0, hostname: "127.0.0.1" }, (req) => new Response(`you asked for ${new URL(req.url).pathname}`));
 * const text = await (await fetch(`http://127.0.0.1:${server.addr.port}/x`)).text(); // "you asked for /x"
 * await server.shutdown();
 * ```
 *
 * @module
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { mapError } from "@intellectual-frontiers/system/errors";
import { traceServer } from "./otel.ts";

/** Where the server listens, or where a request came from. */
export type NetAddr = { readonly hostname: string; readonly port: number };

/** What a handler knows of a request besides the request itself. */
export type ServeInfo = { readonly remoteAddr: NetAddr };

/** A function from a request to its response. */
export type ServeHandler = (request: Request, info: ServeInfo) => Response | Promise<Response>;

/** Where and how to listen. */
export type ServeOptions = {
  /** The port; 0 (the default) asks the system for a free one. */
  readonly port?: number;
  /** The address to bind; `127.0.0.1` by default, never every interface unless asked. */
  readonly hostname?: string;
  /** Aborting it shuts the server down. */
  readonly signal?: AbortSignal;
  /** The response where the handler throws (a plain 500 by default). */
  readonly onError?: (error: unknown) => Response | Promise<Response>;
};

/** A running server. */
export type Server = {
  /** Where it listens. */
  readonly addr: NetAddr;
  /** Settles when it has shut down. */
  readonly finished: Promise<void>;
  /** Stop listening and close every connection; settles when it has shut down. */
  shutdown(): Promise<void>;
};

const NO_BODY = new Set(["GET", "HEAD"]);

function toRequest(req: IncomingMessage, fallbackHost: string): { readonly request: Request; readonly abort: AbortController } {
  const abort = new AbortController();
  const headers = new Headers();
  for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) headers.append(req.rawHeaders[i] ?? "", req.rawHeaders[i + 1] ?? "");
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? fallbackHost}`);
  const init: RequestInit & { duplex?: "half" } = { method, headers, signal: abort.signal };
  if (!NO_BODY.has(method)) {
    init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    init.duplex = "half";
  }
  return { request: new Request(url, init), abort };
}

async function send(res: ServerResponse, response: Response, head: boolean): Promise<void> {
  res.statusCode = response.status;
  if (response.statusText !== "") res.statusMessage = response.statusText;
  const cookies = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key !== "set-cookie") res.setHeader(key, value);
  });
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
  if (response.body === null || head) {
    await response.body?.cancel();
    res.end();
    return;
  }
  res.flushHeaders();
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) await new Promise<void>((r) => res.once("drain", r));
      if (res.destroyed) break;
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}

/** A server that answers each request with what `handler` gives, once its port is bound. `AddrInUse` where the port is taken. */
export function serve(options: ServeOptions, handler: ServeHandler): Promise<Server> {
  const hostname = options.hostname ?? "127.0.0.1";
  const onError = options.onError ?? (() => new Response("internal server error", { status: 500 }));
  const server = createServer((req, res) => {
    const { request, abort } = toRequest(req, `${hostname}:${options.port ?? 0}`);
    res.on("close", () => {
      if (!res.writableFinished) abort.abort();
    });
    const remoteAddr = { hostname: req.socket.remoteAddress ?? "", port: req.socket.remotePort ?? 0 };
    void (async () => {
      let response: Response;
      try {
        // Where a telemetry pipeline is installed, an `http.server` span, the child of the request's `traceparent` (0006-signals FR-018).
        response = await traceServer(request, () => handler(request, { remoteAddr }), handler);
      } catch (e) {
        response = await onError(e);
      }
      await send(res, response, request.method === "HEAD").catch(() => res.destroy());
    })();
  });
  const finished = new Promise<void>((resolve) => server.on("close", () => resolve()));
  const shutdown = async (): Promise<void> => {
    if (server.listening) {
      server.close();
      server.closeAllConnections();
    }
    await finished;
  };
  return new Promise<Server>((resolve, reject) => {
    server.once("error", (e) => reject(mapError(e, `${hostname}:${options.port ?? 0}`)));
    server.listen(options.port ?? 0, hostname, () => {
      const a = server.address() as AddressInfo;
      options.signal?.addEventListener("abort", () => void shutdown(), { once: true });
      resolve({ addr: { hostname: a.address, port: a.port }, finished, shutdown });
    });
  });
}
