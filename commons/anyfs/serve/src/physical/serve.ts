// Spec: 0004-anyfs-serve-physical FR-001, FR-002, FR-003
/**
 * The server: `serveStore` hosts the handler of a store on `node:http` through the server of commons, so that it runs on Bun and on Node. It listens on the loopback unless the program names an address with an
 * exposure that names the hosts it may be asked for, and it starts with a random token that the program shows to the person who started it, unless the program gives its own way to know who asks.
 *
 * @example
 * ```ts
 * import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
 * import { serveStore } from "./serve.ts";
 * const running = await serveStore(memoryStore(), {});
 * running.url; // "http://127.0.0.1:49152/"
 * await running.close();
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { serve } from "@intellectual-frontiers/net/serve";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import type { Viewable } from "@intellectual-frontiers/anyfs-posix/physical";
import { type Authenticator, type Exposure, hostsOf, LOOPBACK } from "@intellectual-frontiers/anyfs-serve/governance";
import { handler, type HandlerOptions, newToken, tokenAuthenticator } from "@intellectual-frontiers/anyfs-serve/logical";

/** What the server is told besides what the handler is. */
export type ServeStoreOptions = Omit<HandlerOptions, "authenticator" | "hosts"> & {
  /** The port; 0 asks for a free one. */
  readonly port?: number;
  /** Where it may listen: the loopback by default. */
  readonly exposure?: Exposure;
  /** Who may ask; the token the server makes by default. */
  readonly authenticator?: Authenticator;
  /** The token to use where none of the above is given; made at random where not given. */
  readonly token?: string;
  /** Told the token the server made, so that the program can show it to the person who started the server (it is never logged by the server). */
  readonly onToken?: (token: string) => void;
};

/** A running server. */
export type Serving = {
  /** The address, with the port. */
  readonly url: string;
  readonly port: number;
  /** The token that is accepted where the server made it, else undefined. */
  readonly token: string | undefined;
  close(): Promise<void>;
};

/** Hosts a store as WebDAV, or says why it cannot: an address that is not the loopback needs an exposure that names its hosts. */
export async function serveStore(store: Store<Viewable>, options: ServeStoreOptions = {}): Promise<Result<Serving, string>> {
  const exposure = options.exposure ?? LOOPBACK;
  const hostname = exposure.kind === "loopback" ? "127.0.0.1" : exposure.hostname;
  let token: string | undefined;
  let authenticator = options.authenticator;
  if (authenticator === undefined) {
    token = options.token ?? newToken();
    authenticator = tokenAuthenticator(token);
    options.onToken?.(token);
  }
  const { port: _port, exposure: _exposure, authenticator: _a, token: _t, onToken: _o, ...rest } = options;
  const serveRequest = handler(store, { ...rest, authenticator, hosts: hostsOf(exposure) });
  try {
    const server = await serve({ port: options.port ?? 0, hostname }, (request) => serveRequest(request));
    const host = server.addr.hostname.includes(":") ? `[${server.addr.hostname}]` : server.addr.hostname;
    return ok({ url: `http://${host}:${server.addr.port}/`, port: server.addr.port, token, close: () => server.shutdown() });
  } catch (e) {
    return err(`the server could not listen on ${hostname}:${options.port ?? 0}: ${e instanceof Error ? e.message : "an error"}`);
  }
}
