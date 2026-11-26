// Spec: 0001-net FR-002, FR-018
/**
 * An HTTP server whose handler takes a web `Request` and gives a web `Response` on `node:http`, so the same handler
 * runs on Bun and Node (commons 0001-net FR-002). Request bodies and response bodies stream; a client that goes away
 * aborts `request.signal`. `serve` returns a promise, settled once the port is bound, so `addr` is known. `folderHandler` and `serveFolder` serve a published folder (an agora rendition folder with `README.html` as its index)
 * read-only and safely (0001-net FR-018).
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
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createSecureServer } from "node:https";
import type { AddressInfo } from "node:net";
import { isAbsolute, join, relative, sep } from "node:path";
import { Readable } from "node:stream";
import { InvalidData, mapError, NotSupported } from "@intellectual-frontiers/system/errors";
import { clientAuth, subjectOf, type ClientCertMode } from "./tcp.ts";
import { traceServer } from "@intellectual-frontiers/telemetry/host/otel";

/** Where the server listens, or where a request came from. */
export type NetAddr = { readonly hostname: string; readonly port: number };

/** What a handler knows of a request besides the request itself. */
export type ServeInfo = {
  readonly remoteAddr: NetAddr;
  /** The subject of the client's certificate where `tls` asked for one and it verified (`CN=device-01`); nothing otherwise. */
  readonly clientSubject?: string;
};

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
  /** Answer HTTPS: the certificate chain and key in PEM, and where a client certificate is asked for, the roots it must chain to and whether it is required. Without it the server answers plain HTTP. */
  readonly tls?: {
    readonly cert: string;
    readonly key: string;
    readonly clientCa?: readonly string[];
    readonly requestClientCert?: ClientCertMode;
  };
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
  const mode = options.tls?.requestClientCert ?? "none";
  if (mode !== "none" && (options.tls?.clientCa === undefined || options.tls.clientCa.length === 0)) return Promise.reject(new InvalidData("a client certificate is asked for, so the roots it must chain to (clientCa) are needed", "", ""));
  if (mode !== "none" && "Bun" in globalThis) return Promise.reject(new NotSupported("a client certificate in serve is not supported on Bun: its HTTPS server gives a handler no peer certificate, so it cannot say who the client is; run it on Node 26, or authenticate by a token over TLS (without requestClientCert)", "", ""));
  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    const { request, abort } = toRequest(req, `${hostname}:${options.port ?? 0}`);
    res.on("close", () => {
      if (!res.writableFinished) abort.abort();
    });
    const remoteAddr = { hostname: req.socket.remoteAddress ?? "", port: req.socket.remotePort ?? 0 };
    const clientSubject = subjectOf(req.socket);
    const info: ServeInfo = { remoteAddr, ...(clientSubject === undefined ? {} : { clientSubject }) };
    void (async () => {
      let response: Response;
      try {
        // Where a telemetry pipeline is installed, an `http.server` span, the child of the request's `traceparent` (0001-net FR-016).
        response = await traceServer(request, () => handler(request, info), handler);
      } catch (e) {
        response = await onError(e);
      }
      await send(res, response, request.method === "HEAD").catch(() => res.destroy());
    })();
  };
  const server = options.tls === undefined ? createServer(handle) : createSecureServer({ cert: options.tls.cert, key: options.tls.key, ...clientAuth(options.tls) }, handle);
  server.on("tlsClientError", (_e, socket) => socket.destroy());
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

/** How a folder is served. */
export type FolderOptions = {
  /** The files that answer a directory, in order; `index.html` then `README.html` by default. Each is a plain file name. */
  readonly index?: readonly string[];
  /** Content types by lower case extension with its dot (`.xyz`), added to or replacing the built-in ones. */
  readonly types?: Readonly<Record<string, string>>;
};

/** The content types of a folder: what a published rendition holds. Anything else is `application/octet-stream`. */
export const FOLDER_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
  ".txt": "text/plain; charset=utf-8",
};

const FOLDER_HEADERS = { "x-content-type-options": "nosniff", "cache-control": "no-cache" } as const;

function plain(status: number, text: string, extra: Readonly<Record<string, string>> = {}): Response {
  return new Response(text, { status, headers: { ...FOLDER_HEADERS, "content-type": "text/plain; charset=utf-8", ...extra } });
}

/** The segments of a request path, or nothing where the path is one that must not be served: malformed escapes, NUL, a backslash, `.` or `..`, a drive or an absolute form after decoding. Empty segments are dropped. */
function segmentsOf(pathname: string): readonly string[] | undefined {
  if (!pathname.startsWith("/") || pathname.includes("\\") || pathname.includes("\0")) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return undefined;
  const out: string[] = [];
  for (const seg of decoded.split("/")) {
    if (seg === "") continue;
    if (seg === "." || seg === ".." || /^[A-Za-z]:/u.test(seg)) return undefined;
    out.push(seg);
  }
  return out;
}

/** Whether `child` is `root` or inside it, both already resolved. */
function inside(root: string, child: string): boolean {
  const rel = relative(root, child);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/** The single range `bytes=a-b`, `bytes=a-` or `bytes=-n` of a size: the bytes, `"unsatisfiable"`, or nothing where the header is none we answer (several ranges, or a form we do not know), so the whole file is sent. */
function rangeOf(header: string, size: number): { readonly start: number; readonly end: number } | "unsatisfiable" | undefined {
  const m = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());
  if (m === null || (m[1] === "" && m[2] === "")) return undefined;
  if (m[1] === "") {
    const n = Number(m[2]);
    if (n === 0) return "unsatisfiable";
    return size === 0 ? "unsatisfiable" : { start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

const etagMatches = (header: string, etag: string): boolean => header.trim() === "*" || header.split(",").some((t) => t.trim().replace(/^W\//u, "") === etag);

/**
 * A handler that serves the regular files of a folder, read-only: only `GET` and `HEAD` (405 otherwise), only a regular file inside the folder's resolved root (a `..`, an encoded traversal, a NUL, a backslash, a drive or a
 * symlink that leaves the root is refused, with no word of what is outside), a directory answered by its `index.html` or `README.html` and never listed (404 where it has none), the content type from the extension (a safe
 * default of `application/octet-stream`) with `X-Content-Type-Options: nosniff`, an `ETag` from size and modification time answering `If-None-Match` with 304, one `bytes=a-b` range (206, or 416), and `Cache-Control: no-cache`
 * (0001-net FR-018). The root is resolved on the first request.
 *
 * @example
 * ```ts
 * const server = await serve({ port: 0 }, folderHandler("/srv/rendition"));
 * ```
 */
export function folderHandler(root: string, options: FolderOptions = {}): ServeHandler {
  const index = options.index ?? ["index.html", "README.html"];
  const types = { ...FOLDER_TYPES, ...options.types };
  let resolved: Promise<string> | undefined;
  const rootReal = (): Promise<string> => {
    resolved ??= realpath(root).catch((e: unknown) => {
      resolved = undefined;
      throw e;
    });
    return resolved;
  };
  /** The real path of a file inside the root with its stat, or nothing where it is missing, outside the root or not a regular file. */
  const regular = async (base: string, path: string): Promise<{ readonly real: string; readonly size: number; readonly mtimeMs: number } | undefined> => {
    try {
      const real = await realpath(path);
      if (!inside(base, real)) return undefined;
      const st = await stat(real);
      return st.isFile() ? { real, size: st.size, mtimeMs: st.mtimeMs } : undefined;
    } catch {
      return undefined;
    }
  };
  return async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") return plain(405, "method not allowed", { allow: "GET, HEAD" });
    const url = new URL(request.url);
    const segments = segmentsOf(url.pathname);
    if (segments === undefined) return plain(400, "bad path");
    const base = await rootReal();
    const wanted = join(base, ...segments);
    let file = await regular(base, wanted);
    if (file === undefined) {
      let dir = false;
      try {
        const real = await realpath(wanted);
        dir = inside(base, real) && (await stat(real)).isDirectory();
        if (dir) for (const name of index) {
          if (name.includes("/") || name.includes("\\")) continue;
          file = await regular(base, join(real, name));
          if (file !== undefined) break;
        }
      } catch {
        dir = false;
      }
      if (file === undefined) return plain(404, "not found");
      if (!url.pathname.endsWith("/")) return new Response(null, { status: 301, headers: { ...FOLDER_HEADERS, location: `${url.pathname}/${url.search}` } });
    }
    const etag = `"${file.size.toString(16)}-${Math.floor(file.mtimeMs).toString(16)}"`;
    const dot = file.real.lastIndexOf(".");
    const ext = dot > file.real.lastIndexOf(sep) ? file.real.slice(dot).toLowerCase() : "";
    const common = { ...FOLDER_HEADERS, etag, "accept-ranges": "bytes", "content-type": types[ext] ?? "application/octet-stream" };
    const inm = request.headers.get("if-none-match");
    if (inm !== null && etagMatches(inm, etag)) return new Response(null, { status: 304, headers: { ...FOLDER_HEADERS, etag } });
    const header = request.headers.get("range");
    const ifRange = request.headers.get("if-range");
    const range = header === null || (ifRange !== null && ifRange.trim() !== etag) ? undefined : rangeOf(header, file.size);
    if (range === "unsatisfiable") return new Response(null, { status: 416, headers: { ...FOLDER_HEADERS, "content-range": `bytes */${file.size}` } });
    const [start, end] = range === undefined ? [0, file.size - 1] : [range.start, range.end];
    const length = file.size === 0 ? 0 : end - start + 1;
    const headers = { ...common, "content-length": String(length), ...(range === undefined ? {} : { "content-range": `bytes ${start}-${end}/${file.size}` }) };
    const status = range === undefined ? 200 : 206;
    if (request.method === "HEAD" || length === 0) return new Response(null, { status, headers });
    const body = Readable.toWeb(createReadStream(file.real, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(body, { status, headers });
  };
}

/** Serve a folder on `127.0.0.1` (or the `hostname` given), a port of the system's choice unless one is given: `serve(options, folderHandler(root, options))`. */
export function serveFolder(root: string, options: ServeOptions & FolderOptions = {}): Promise<Server> {
  return serve(options, folderHandler(root, options));
}
