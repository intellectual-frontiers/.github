/**
 * TCP connections, plain and over TLS (commons 0005-typescript-runtime FR-055), on `node:net` and `node:tls`, by the names of
 * `Deno.listen`, `Deno.listenTls`, `Deno.connect` and `Deno.connectTls` so that a conversion is a rename. A {@link Listener} gives its
 * address and its connections as an async iterable and closes by `close()`, an abort signal or `using`; a {@link Conn} gives its local and
 * remote addresses, a web `ReadableStream` and `WritableStream` (made here by hand over the socket, the same on Deno, Node and Bun),
 * `closeWrite` and `close`. Failures are thrown as the runtime's errors (FR-019): `AddrInUse`, `ConnectionRefused`, `TimedOut`
 * (an `AbortSignal.timeout` that fired), and `InvalidData` for a server certificate that does not check out.
 *
 * Where it differs from Deno, on purpose: `listen` and `listenTls` return a promise (Node binds asynchronously and reports a taken port
 * then); a listener binds `127.0.0.1` unless asked, as `serve.ts` does, never every interface; `connectTls`'s `caCerts` replace the system's
 * roots instead of adding to them, so a test or a pinned service trusts exactly the roots it names; and a TLS connection is given once its
 * handshake is done.
 *
 * @example
 * ```ts
 * import { connect, listen } from "./tcp.ts";
 * await using listener = await listen({ port: 0 });
 * void (async () => {
 *   for await (const conn of listener) void conn.readable.pipeTo(conn.writable); // an echo server
 * })();
 * using conn = await connect({ port: listener.addr.port });
 * ```
 *
 * @module
 */
import * as net from "node:net";
import * as tls from "node:tls";
import { ConnectionAborted, InvalidData, mapError, TimedOut, toError } from "./errors.ts";
import type { NetAddr } from "./serve.ts";

export type { NetAddr } from "./serve.ts";

/** Where to listen. */
export type ListenOptions = {
  /** The port; 0 (the default) asks the system for a free one. */
  readonly port?: number;
  /** The address to bind; `127.0.0.1` by default, never every interface unless asked (`0.0.0.0`, `::`). */
  readonly hostname?: string;
  /** Aborting it closes the listener. */
  readonly signal?: AbortSignal;
};

/** Where to listen for TLS, and the certificate to answer with. */
export type ListenTlsOptions = ListenOptions & {
  /** The server's certificate chain, in PEM. */
  readonly cert: string;
  /** The certificate's private key, in PEM. */
  readonly key: string;
};

/** Where to connect. */
export type ConnectOptions = {
  /** The host's name or address; `127.0.0.1` by default. */
  readonly hostname?: string;
  /** The port. */
  readonly port: number;
  /** Aborting it gives up while connecting (`TimedOut` where it is an `AbortSignal.timeout`); a connection made is not affected. */
  readonly signal?: AbortSignal;
};

/** Where to connect over TLS, and the roots to check the server's certificate against. */
export type ConnectTlsOptions = ConnectOptions & {
  /** The roots, in PEM, that the server's certificate must chain to, instead of the system's; the system's roots where not given. */
  readonly caCerts?: readonly string[];
  /** The name the certificate must be for, where it is not `hostname` (SNI is sent only for a name, never for an address). */
  readonly serverName?: string;
};

/** A connection: its two ends, its bytes as web streams, and how to end it. */
export type Conn = {
  /** This end's address. */
  readonly localAddr: NetAddr;
  /** The other end's address. */
  readonly remoteAddr: NetAddr;
  /** The bytes the other end sends; ends when it closes its side; cancelling it closes the connection. */
  readonly readable: ReadableStream<Uint8Array>;
  /** The bytes to send; each write settles once the system has taken it; closing it ends this side (as `closeWrite`). */
  readonly writable: WritableStream<Uint8Array>;
  /** End this side (TCP half-close): the other end reads the end of the data, and this end can still read. */
  closeWrite(): Promise<void>;
  /** Close the connection at once, both ways. Closing it again does nothing. */
  close(): void;
  /** `using conn = await connect(...)` closes it at the end of the block. */
  [Symbol.dispose](): void;
};

/** A listener: its address and its connections. */
export type Listener = {
  /** Where it listens (the port the system chose where 0 was asked). */
  readonly addr: NetAddr;
  /** The next connection; rejects with `ConnectionAborted` once the listener is closed. */
  accept(): Promise<Conn>;
  /** The connections, one by one, until the listener is closed. */
  [Symbol.asyncIterator](): AsyncIterator<Conn>;
  /** Stop listening; connections already given stay open, those not yet taken are closed. Closing it again does nothing. */
  close(): void;
  /** `using listener = await listen(...)` closes it at the end of the block. */
  [Symbol.dispose](): void;
  /** `await using listener = await listen(...)` closes it at the end of the block. */
  [Symbol.asyncDispose](): Promise<void>;
};

/**
 * Every TCP socket, and each a TLS listener accepts, is half-open, as a `Deno.Conn` is: the end of what the peer sends ends the readable
 * stream alone, and this side writes on until it closes its own (`closeWrite`, `close`). Node's default ends this side too as soon as the
 * peer's end is read, so an echo server whose peer half-closed could lose what it had still to send, by the order in which the peer's end
 * and its own writes happened. A TLS client keeps the TLS socket's own setting, which Node's types do not let one choose.
 */
const HALF_OPEN = true;

const MAPPED_V4 = "::ffff:";

function hostOf(address: string | undefined): string {
  const a = address ?? "";
  return a.startsWith(MAPPED_V4) && net.isIPv4(a.slice(MAPPED_V4.length)) ? a.slice(MAPPED_V4.length) : a;
}

function wrapSocket(socket: net.Socket): Conn {
  let closed = false;
  let ended = false;
  const readable = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        const finish = (e?: unknown): void => {
          if (ended) return;
          ended = true;
          try {
            if (e === undefined) controller.close();
            else controller.error(mapError(e));
          } catch {
            // The stream was cancelled already.
          }
        };
        socket.on("data", (chunk: Buffer) => {
          if (ended) return;
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
          if ((controller.desiredSize ?? 1) <= 0) socket.pause();
        });
        socket.on("end", () => finish());
        socket.on("error", (e) => finish(e));
        socket.on("close", () => finish());
      },
      pull() {
        socket.resume();
      },
      cancel() {
        ended = true;
        socket.destroy();
      },
    },
    { highWaterMark: 1 },
  );
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      return new Promise<void>((resolve, reject) => {
        if (socket.destroyed || socket.writableEnded) {
          reject(mapError(Object.assign(new Error("the connection is closed"), { code: "EPIPE" })));
          return;
        }
        socket.write(chunk, (e) => (e === undefined || e === null ? resolve() : reject(mapError(e))));
      });
    },
    close() {
      return endSocket(socket);
    },
    abort() {
      socket.destroy();
    },
  });
  const close = (): void => {
    if (closed) return;
    closed = true;
    socket.destroy();
  };
  return {
    localAddr: { hostname: hostOf(socket.localAddress), port: socket.localPort ?? 0 },
    remoteAddr: { hostname: hostOf(socket.remoteAddress), port: socket.remotePort ?? 0 },
    readable,
    writable,
    closeWrite: () => endSocket(socket),
    close,
    [Symbol.dispose]: close,
  };
}

function endSocket(socket: net.Socket): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (socket.destroyed || socket.writableFinished) {
      resolve();
      return;
    }
    const onError = (e: Error): void => reject(mapError(e));
    socket.once("error", onError);
    socket.end(() => {
      socket.off("error", onError);
      resolve();
    });
  });
}

function makeListener(server: net.Server, event: "connection" | "secureConnection", options: ListenOptions): Promise<Listener> {
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? 0;
  const queue: net.Socket[] = [];
  const waiting: { readonly resolve: (c: Conn) => void; readonly reject: (e: Error) => void }[] = [];
  let closed = false;
  const closedError = (): Error => new ConnectionAborted("the listener is closed", "", `${hostname}:${port}`);
  server.on(event, (socket: net.Socket) => {
    // An error before the connection is taken is seen by whoever reads it, not thrown out of the process.
    socket.on("error", () => undefined);
    if (closed) {
      socket.destroy();
      return;
    }
    const w = waiting.shift();
    if (w === undefined) queue.push(socket);
    else w.resolve(wrapSocket(socket));
  });
  // A client whose TLS handshake fails is that client's problem, not the listener's.
  server.on("tlsClientError", (_e: Error, socket: net.Socket) => socket.destroy());
  const close = (): void => {
    if (closed) return;
    closed = true;
    server.close();
    for (const s of queue.splice(0)) s.destroy();
    for (const w of waiting.splice(0)) w.reject(closedError());
  };
  const accept = (): Promise<Conn> => {
    const s = queue.shift();
    if (s !== undefined) return Promise.resolve(wrapSocket(s));
    if (closed) return Promise.reject(closedError());
    return new Promise<Conn>((resolve, reject) => waiting.push({ resolve, reject }));
  };
  return new Promise<Listener>((resolve, reject) => {
    if (options.signal?.aborted === true) {
      reject(abortError(options.signal));
      return;
    }
    server.once("error", (e) => reject(mapError(e, `${hostname}:${port}`)));
    server.listen(port, hostname, () => {
      const a = server.address() as net.AddressInfo; // A TCP server's address is always an AddressInfo once it listens.
      options.signal?.addEventListener("abort", close, { once: true });
      resolve({
        addr: { hostname: hostOf(a.address), port: a.port },
        accept,
        async *[Symbol.asyncIterator](): AsyncGenerator<Conn> {
          for (;;) {
            let conn: Conn;
            try {
              conn = await accept();
            } catch (e) {
              if (closed) return;
              throw e;
            }
            yield conn;
          }
        },
        close,
        [Symbol.dispose]: close,
        [Symbol.asyncDispose]: () => {
          close();
          return Promise.resolve();
        },
      });
    });
  });
}

/** Listen for TCP connections (`Deno.listen`); `AddrInUse` where the port is taken. */
export function listen(options: ListenOptions = {}): Promise<Listener> {
  return makeListener(net.createServer({ pauseOnConnect: false, allowHalfOpen: HALF_OPEN }), "connection", options);
}

/** Listen for TLS connections with a certificate and key in PEM (`Deno.listenTls`); `AddrInUse` where the port is taken. */
export function listenTls(options: ListenTlsOptions): Promise<Listener> {
  return makeListener(tls.createServer({ cert: options.cert, key: options.key, allowHalfOpen: HALF_OPEN }), "secureConnection", options);
}

function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error && reason.name === "TimeoutError") return new TimedOut(reason.message, "ETIMEDOUT", undefined, reason);
  return toError(reason, "the operation was aborted");
}

const CERT_CODE = /CERT|SELF_SIGNED|UNABLE_TO_|ERR_TLS_/;

function connectError(e: unknown, where: string): Error {
  const code: unknown = typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined;
  if (typeof code === "string" && CERT_CODE.test(code)) {
    const message = e instanceof Error ? e.message : code;
    return new InvalidData(`the server's certificate was refused: ${message}`, code, where, e);
  }
  return mapError(e, where);
}

function open(socket: net.Socket, ready: "connect" | "secureConnect", where: string, signal: AbortSignal | undefined): Promise<Conn> {
  return new Promise<Conn>((resolve, reject) => {
    const onAbort = (): void => {
      socket.destroy();
      if (signal !== undefined) reject(abortError(signal));
    };
    const onError = (e: Error): void => {
      signal?.removeEventListener("abort", onAbort);
      socket.destroy();
      reject(connectError(e, where));
    };
    socket.once("error", onError);
    socket.once(ready, () => {
      signal?.removeEventListener("abort", onAbort);
      socket.off("error", onError);
      resolve(wrapSocket(socket));
    });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Connect over TCP (`Deno.connect`); `ConnectionRefused` where nothing listens. */
export function connect(options: ConnectOptions): Promise<Conn> {
  const host = options.hostname ?? "127.0.0.1";
  const where = `${host}:${options.port}`;
  if (options.signal?.aborted === true) return Promise.reject(abortError(options.signal));
  return open(net.connect({ host, port: options.port, allowHalfOpen: HALF_OPEN }), "connect", where, options.signal);
}

/**
 * Connect over TLS (`Deno.connectTls`), checking the server's certificate against the system's roots or the `caCerts` given, and its
 * name against `serverName` or `hostname`; `InvalidData` where the certificate does not check out.
 */
export function connectTls(options: ConnectTlsOptions): Promise<Conn> {
  const host = options.hostname ?? "127.0.0.1";
  const where = `${host}:${options.port}`;
  if (options.signal?.aborted === true) return Promise.reject(abortError(options.signal));
  const name = options.serverName ?? host;
  const tlsOptions: tls.ConnectionOptions = {
    host,
    port: options.port,
    rejectUnauthorized: true,
    checkServerIdentity: (_host, cert) => tls.checkServerIdentity(name, cert),
    ...(net.isIP(name) === 0 ? { servername: name } : {}),
    ...(options.caCerts === undefined ? {} : { ca: [...options.caCerts] }),
  };
  return open(tls.connect(tlsOptions), "secureConnect", where, options.signal);
}
