// Spec: 0006-anyfs-serve-nfs FR-002, FR-010, FR-011
/**
 * The server of NFS: `serveNfs` hosts the service of a store on a TCP socket of the loopback (the NFS program and the mount protocol on the same port, which a mount names with `port=` and `mountport=`), reads the
 * records of each connection, answers them in order, and bounds what a caller can make it hold: the connections, the size of a record and (in the service) the handles and the size of an object. It does not listen on
 * any other address than the loopback, and it puts every buffer that holds a write when it is closed.
 *
 * @example
 * ```ts
 * import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
 * import { serveNfs } from "./nfs.ts";
 * const running = await serveNfs(memoryStore(), {});
 * running.kind === "ok" && running.value.mountCommand("/mnt/anyfs");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import { posix, type Viewable } from "@intellectual-frontiers/anyfs-posix/physical";
import { keepMarkers, defaultPolicy, type Policy } from "@intellectual-frontiers/anyfs-posix/governance";
import { listen, type Conn } from "@intellectual-frontiers/net/tcp";
import { TRANSFER } from "@intellectual-frontiers/anyfs-serve/governance";
import { frame, nfsService, parseCall, RecordReader, type NfsOptions } from "@intellectual-frontiers/anyfs-serve/logical";

/** What the server is told besides what the service is. */
export type ServeNfsOptions = NfsOptions & {
  /** The port; 0 asks for a free one. */
  readonly port?: number;
  /** The most connections at once: 16 by default. */
  readonly maxConnections?: number;
  /** The policy of the view; empty directories are kept as `.keep` objects by default, so that a directory made persists. */
  readonly policy?: Policy;
};

/** A running server. */
export type NfsServing = {
  readonly port: number;
  readonly hostname: string;
  /** How the boot of this server writes itself: the write verifier. */
  readonly boot: Uint8Array;
  /** The command that mounts the export on a Linux computer (`mount -t nfs`): the port is named, so that no portmapper is needed. */
  mountCommand(directory: string): string;
  /** How many attributes were accepted without effect. */
  dropped(): number;
  /** Puts what is held, stops listening and ends the connections. The failures to put are given. */
  close(): Promise<readonly string[]>;
};

const LOOPBACK = "127.0.0.1";
const RECORD_SLACK = 65536;

/** Hosts a store as NFS version 3 on the loopback, or says why it cannot. */
export async function serveNfs(store: Store<Viewable>, options: ServeNfsOptions = {}): Promise<Result<NfsServing, string>> {
  const kept = keepMarkers(".keep");
  const policy = options.policy ?? (kept.kind === "ok" ? { ...defaultPolicy(), markers: kept.value } : defaultPolicy());
  const view = posix(store, { policy });
  const service = nfsService(view, options);
  const maxConnections = options.maxConnections ?? 16;
  let listener;
  try {
    listener = await listen({ port: options.port ?? 0, hostname: LOOPBACK });
  } catch (e) {
    return err(`the server could not listen on ${LOOPBACK}:${options.port ?? 0}: ${e instanceof Error ? e.message : "an error"}`);
  }
  const open = new Set<Conn>();
  const serveConn = async (conn: Conn): Promise<void> => {
    const reader = new RecordReader(TRANSFER.wtmax + RECORD_SLACK);
    const out = conn.writable.getWriter();
    try {
      for await (const chunk of conn.readable) {
        const records = reader.push(chunk);
        if (records.kind === "err") return;
        for (const record of records.value) {
          const parsed = parseCall(record);
          if (parsed.kind === "drop") continue;
          const reply = parsed.kind === "reply" ? parsed.reply : await service.handle(parsed.call);
          await out.write(frame(reply));
        }
      }
    } catch {
      // the caller went away: nothing to answer
    } finally {
      open.delete(conn);
      conn.close();
    }
  };
  const accepting = (async (): Promise<void> => {
    try {
      for await (const conn of listener) {
        if (open.size >= maxConnections) {
          conn.close();
          continue;
        }
        open.add(conn);
        void serveConn(conn);
      }
    } catch {
      // closed
    }
  })();
  const port = listener.addr.port;
  return ok({
    port,
    hostname: LOOPBACK,
    boot: service.boot,
    mountCommand: (directory) => `mount -t nfs -o vers=3,proto=tcp,port=${port},mountport=${port},nolock,soft ${LOOPBACK}:${options.exportPath ?? "/"} ${directory}`,
    dropped: () => service.dropped(),
    async close() {
      const failures = await service.flushAll();
      listener.close();
      for (const c of [...open]) c.close();
      await accepting;
      return failures;
    },
  });
}
