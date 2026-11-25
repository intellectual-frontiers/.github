// Spec: 0004-netboot-physical FR-003
/**
 * A read-only TFTP server for PXE: UEFI firmware fetches the shim over TFTP, the shim its GRUB, and GRUB its menu, kernel and initrd, all from the same server. Each read is answered by the same function as HTTP's, so PXE and HTTP boot get the same files. Each transfer
 * runs on its own socket (the client's transfer id), one block in flight, retransmitting on a timeout; a write request is refused.
 *
 * @example
 * ```ts
 * import { tftpServer } from "./tftp-server.ts";
 * // const s = await tftpServer({ port: 0, read: async (p) => (p === "/x" ? new Uint8Array([1]) : undefined) }); await s.stop();
 * ```
 *
 * @module
 */
import dgram from "node:dgram";
import { agreedOptions, ackPacket, dataPacket, ERR, errorPacket, OP, oackPacket, parseRequest, servedPath } from "@intellectual-frontiers/netboot/logical";

/** What the server is given. */
export type TftpOptions = {
  readonly port: number;
  readonly hostname?: string;
  /** The bytes of a file of the served tree (a path with a leading slash), or nothing where there is none. */
  readonly read: (path: string, from: string) => Promise<Uint8Array | undefined>;
  /** Told of each transfer: its file, who asked and how it ended. */
  readonly onTransfer?: (e: { readonly file: string; readonly from: string; readonly outcome: "sent" | "refused" | "not-found" | "timed-out" }) => void;
  /** How many times a block is sent again before the transfer is given up (5 by default). */
  readonly retries?: number;
};

/** A running server. */
export type TftpServer = { readonly port: number; stop(): Promise<void> };

/** Starts the server. */
export async function tftpServer(o: TftpOptions): Promise<TftpServer> {
  const sock = dgram.createSocket("udp4");
  const host = o.hostname ?? "0.0.0.0";
  const active = new Set<dgram.Socket>();
  sock.on("message", (msg, rinfo) => {
    const from = `${rinfo.address}:${rinfo.port}`;
    const { op, request } = parseRequest(new Uint8Array(msg));
    const refuse = (code: number, text: string, file: string, outcome: "refused" | "not-found"): void => {
      sock.send(errorPacket(code, text), rinfo.port, rinfo.address);
      o.onTransfer?.({ file, from, outcome });
    };
    if (op === OP.WRQ) return refuse(ERR.ACCESS, "this server is read-only", "", "refused");
    if (op !== OP.RRQ || request === undefined) return refuse(ERR.ILLEGAL, "not a read request", "", "refused");
    if (request.mode !== "octet") return refuse(ERR.ILLEGAL, "only octet mode", request.file, "refused");
    const file = servedPath(request.file);
    if (file === undefined) return refuse(ERR.ACCESS, "access violation", request.file, "refused");
    void (async () => {
      const bytes = await o.read(file, rinfo.address);
      if (bytes === undefined) return refuse(ERR.NOT_FOUND, "file not found", file, "not-found");
      await transfer(bytes, file, rinfo, request.options, from);
    })();
  });

  async function transfer(bytes: Uint8Array, file: string, rinfo: dgram.RemoteInfo, asked: Readonly<Record<string, string>>, from: string): Promise<void> {
    const t = dgram.createSocket("udp4");
    active.add(t);
    // `stop` closes the socket of a transfer that is still going, and a socket closed twice, or sent on once closed, throws: the transfer notices that it was closed and ends without a word
    let closed = false;
    let wake: (() => void) | undefined;
    t.once("close", () => {
      closed = true;
      wake?.();
    });
    const { blksize, timeoutMs, oack } = agreedOptions(asked, bytes.length);
    const inbox: number[] = [];
    t.on("message", (m) => {
      if (m.length >= 4 && ((m[0] ?? 0) << 8 | (m[1] ?? 0)) === OP.ACK) {
        inbox.push((m[2] ?? 0) << 8 | (m[3] ?? 0));
        wake?.();
      }
    });
    const waitFor = async (block: number): Promise<boolean> => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline && !closed) {
        const i = inbox.indexOf(block);
        if (i >= 0) {
          inbox.length = 0;
          return true;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
          setTimeout(resolve, Math.max(1, Math.min(50, deadline - Date.now())));
        });
      }
      return false;
    };
    const send = (p: Uint8Array): void => {
      try {
        if (!closed) t.send(p, rinfo.port, rinfo.address);
      } catch {
        closed = true; // closed by `stop` since the event: the same end
      }
    };
    const retries = o.retries ?? 5;
    const reliably = async (p: Uint8Array, block: number): Promise<boolean> => {
      for (let attempt = 0; attempt <= retries && !closed; attempt++) {
        send(p);
        if (await waitFor(block)) return true;
      }
      return false;
    };
    try {
      if (Object.keys(oack).length > 0 && !(await reliably(oackPacket(oack), 0))) return void (closed || o.onTransfer?.({ file, from, outcome: "timed-out" }));
      let n = 1;
      for (let off = 0; ; off += blksize, n++) {
        const chunk = bytes.subarray(off, off + blksize);
        if (!(await reliably(dataPacket(n & 0xffff, chunk), n & 0xffff))) return void (closed || o.onTransfer?.({ file, from, outcome: "timed-out" }));
        if (chunk.length < blksize) break;
      }
      o.onTransfer?.({ file, from, outcome: "sent" });
    } finally {
      active.delete(t);
      try {
        t.close();
      } catch {
        // `stop` closed it already
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    sock.once("error", reject);
    sock.bind(o.port, host, () => resolve());
  });
  const port = sock.address().port;
  return {
    port,
    stop: async () => {
      for (const t of active) t.close();
      await new Promise<void>((resolve) => sock.close(() => resolve()));
    },
  };
}

export { ackPacket };
