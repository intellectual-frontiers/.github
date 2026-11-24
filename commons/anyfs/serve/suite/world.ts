/**
 * What the tests of the handler share: the stores (all the capabilities of memory, the core capabilities alone, one that only reads), a function that makes a request and keeps the answer, and the headers a test reads.
 *
 * @module
 */
import { memoryStore, MEMORY_CAPABILITIES } from "@intellectual-frontiers/anyfs/memory";
import { only, readOnly, type Store } from "@intellectual-frontiers/anyfs/logical";
import { handler, type HandlerOptions, noAuthentication } from "../src/mod.ts";

export type Viewable = "read" | "list" | "stat";

/** The store in memory with everything it can do. */
export const full = (): Store<(typeof MEMORY_CAPABILITIES)[number]> => memoryStore();
/** The store of the five core capabilities: no `cas`, no `rename`, no `batch`. */
export const core = (): Store<"read" | "write" | "list" | "stat" | "delete"> => only(memoryStore(), ["read", "write", "list", "stat", "delete"] as const);
/** A store that only reads. */
export const reading = (): Store<"read" | "list" | "stat"> => readOnly(memoryStore()) as unknown as Store<"read" | "list" | "stat">;

/** What a request got. */
export type Got = { readonly status: number; readonly headers: Headers; readonly text: string; readonly bytes: Uint8Array };

/** A client of a handler: it makes a request to `http://127.0.0.1` and gives what it got. */
export type Client = (method: string, path: string, init?: { readonly body?: string | Uint8Array; readonly headers?: Record<string, string> }) => Promise<Got>;

/** A client of a store, with the options of the handler. */
export function client(store: Store<Viewable>, options: Partial<HandlerOptions> = {}): { readonly call: Client; readonly store: Store<Viewable> } {
  const h = handler(store, { authenticator: noAuthentication, ...options });
  const call: Client = async (method, path, init = {}) => {
    const r = await h(new Request(`http://127.0.0.1${path}`, { method, ...(init.body === undefined ? {} : { body: init.body as BodyInit }), headers: init.headers ?? {} }));
    const bytes = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, headers: r.headers, text: new TextDecoder().decode(bytes), bytes };
  };
  return { call, store };
}

/** The body of a lockinfo for an exclusive write lock. */
export const LOCKINFO = '<?xml version="1.0"?><D:lockinfo xmlns:D="DAV:"><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype><D:owner><D:href>someone</D:href></D:owner></D:lockinfo>';

/** The token of a lock answer. */
export const tokenOf = (g: Got): string => (g.headers.get("lock-token") ?? "").replace(/^<|>$/gu, "");

/** The `href` texts of a multistatus, in order. */
export const hrefsOf = (text: string): readonly string[] => [...text.matchAll(/<D:href>([^<]*)<\/D:href>/gu)].map((m) => m[1] ?? "");
