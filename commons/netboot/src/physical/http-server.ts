// Spec: 0004-netboot-physical FR-004
/**
 * The HTTP server of the boot machine, on `node:http`. Firmware and GRUB are picky clients: GRUB's HTTP client compares `Content-Length: ` case-sensitively and reads every file as empty if the name is in lower case, and sends HEAD and then GET on one connection. So the
 * header names are written in their canonical case, connections are kept alive, and a file is streamed (an installer image is several GB) with `Range` for a resumed download. The handler is a function of a plain request to a plain response.
 *
 * @example
 * ```ts
 * import { httpServer } from "./http-server.ts";
 * // const s = await httpServer({ port: 0, handle: async () => ({ status: 200, headers: {}, body: "ok" }) }); await s.stop();
 * ```
 *
 * @module
 */
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/** A request, as the handler sees it. */
export type BootRequest = { readonly method: string; readonly path: string; readonly host: string; readonly from: string; readonly range: string | undefined; readonly body: Uint8Array };

/** What a response carries: text or bytes, or a file to stream. */
export type BootBody = string | Uint8Array | { readonly file: string; readonly size: number };

/** A response. */
export type BootResponse = { readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly body: BootBody };

/** What the server is given. */
export type HttpOptions = { readonly port: number; readonly hostname?: string; readonly handle: (r: BootRequest) => Promise<BootResponse> };

/** A running server. */
export type HttpServer = { readonly port: number; stop(): Promise<void> };

const REASON: Record<number, string> = { 200: "OK", 206: "Partial Content", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 416: "Range Not Satisfiable", 500: "Internal Server Error" };

/** The byte range a `Range: bytes=a-b` asks of a file of `size` bytes, or why it cannot be given. */
export function parseRange(header: string | undefined, size: number): { readonly start: number; readonly end: number } | "none" | "unsatisfiable" {
  if (header === undefined) return "none";
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (m === null) return "none";
  const a = m[1] ?? "";
  const b = m[2] ?? "";
  if (a === "" && b === "") return "none";
  const start = a === "" ? Math.max(0, size - Number(b)) : Number(a);
  const end = a === "" || b === "" ? size - 1 : Math.min(Number(b), size - 1);
  return start > end || start >= size ? "unsatisfiable" : { start, end };
}

/** Starts the server. */
export async function httpServer(o: HttpOptions): Promise<HttpServer> {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 1 << 20) {
        res.writeHead(400, { "Content-Length": "0", Connection: "close" });
        return void res.end();
      }
      chunks.push(c as Buffer);
    }
    const request: BootRequest = { method: req.method ?? "GET", path: req.url ?? "/", host: req.headers.host ?? "", from: req.socket.remoteAddress ?? "", range: req.headers.range, body: new Uint8Array(Buffer.concat(chunks)) };
    let r: BootResponse;
    try {
      r = await o.handle(request);
    } catch {
      r = { status: 500, headers: {}, body: "error\n" };
    }
    const head = request.method === "HEAD";
    const base: Record<string, string> = { "Content-Type": "application/octet-stream", ...r.headers };
    if (typeof r.body === "string" || r.body instanceof Uint8Array) {
      const bytes = typeof r.body === "string" ? new TextEncoder().encode(r.body) : r.body;
      res.writeHead(r.status, REASON[r.status], { ...base, "Content-Length": String(bytes.length) });
      return void res.end(head ? undefined : bytes);
    }
    const range = parseRange(request.range, r.body.size);
    if (range === "unsatisfiable") {
      res.writeHead(416, REASON[416], { ...base, "Content-Range": `bytes */${r.body.size}`, "Content-Length": "0" });
      return void res.end();
    }
    const whole = range === "none";
    const [start, end] = whole ? [0, r.body.size - 1] : [range.start, range.end];
    res.writeHead(whole ? r.status : 206, REASON[whole ? r.status : 206], { ...base, "Accept-Ranges": "bytes", "Content-Length": String(r.body.size === 0 ? 0 : end - start + 1), ...(whole ? {} : { "Content-Range": `bytes ${start}-${end}/${r.body.size}` }) });
    if (head || r.body.size === 0) return void res.end();
    createReadStream(r.body.file, { start, end }).pipe(res);
  });
  server.keepAliveTimeout = 30_000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(o.port, o.hostname ?? "0.0.0.0", () => resolve());
  });
  return {
    port: (server.address() as AddressInfo).port,
    stop: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}
