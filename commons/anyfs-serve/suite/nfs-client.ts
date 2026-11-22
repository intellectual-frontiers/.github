/**
 * A client of NFS version 3 and its mount protocol for the tests, written from RFC 1813 and RFC 5531: it speaks to the server over a real socket of the loopback, with the record marking of TCP, and decodes what
 * comes back into plain values. It shares the XDR reader and writer of the library, so the codec has tests of its own against bytes written out by hand (nfs-codec.test.ts); nothing else of the server is used.
 * It is not a kernel client: what a kernel does that the protocol does not oblige is not covered (0006-anyfs-serve-nfs, out of scope).
 *
 * @module
 */
import { connect, type Conn } from "@intellectual-frontiers/net/tcp";
import { XdrReader, XdrWriter, frame, RecordReader, MOUNT_PROGRAM, NFS_PROGRAM, NFS_PROCEDURES, type NfsProcedure } from "../src/mod.ts";

/** What an RPC reply was. */
export type Rpc = { readonly kind: "ok"; readonly body: Uint8Array } | { readonly kind: "failed"; readonly accept: number; readonly versions?: readonly [number, number] } | { readonly kind: "denied"; readonly why: number; readonly detail: readonly number[] };

/** A decoded `fattr3`. */
export type Fattr = { readonly type: number; readonly mode: number; readonly nlink: number; readonly uid: number; readonly gid: number; readonly size: number; readonly fileid: bigint; readonly mtime: readonly [number, number] };

const readAttr = (r: XdrReader): Fattr => {
  const type = r.u32();
  const mode = r.u32();
  const nlink = r.u32();
  const uid = r.u32();
  const gid = r.u32();
  const size = r.u64();
  r.u64();
  r.u32();
  r.u32();
  r.u64();
  const fileid = r.u64big();
  r.u32();
  r.u32();
  const mtime: [number, number] = [r.u32(), r.u32()];
  r.u32();
  r.u32();
  return { type, mode, nlink, uid, gid, size, fileid, mtime };
};
const postOp = (r: XdrReader): Fattr | undefined => (r.bool() ? readAttr(r) : undefined);
const wcc = (r: XdrReader): Fattr | undefined => {
  if (r.bool()) {
    r.u64();
    r.u32();
    r.u32();
    r.u32();
    r.u32();
  }
  return postOp(r);
};

/** The credential of a call. */
export type Auth = { readonly kind: "none" } | { readonly kind: "sys"; readonly uid: number; readonly gid: number };

/** A connection to the server. */
export class NfsClient {
  #xid = 100;
  readonly #records: Uint8Array[] = [];
  readonly #waiting: ((r: Uint8Array) => void)[] = [];
  readonly #reader = new RecordReader(4 * 1024 * 1024);
  readonly #out: WritableStreamDefaultWriter<Uint8Array>;
  readonly conn: Conn;
  auth: Auth;

  private constructor(conn: Conn, auth: Auth) {
    this.conn = conn;
    this.auth = auth;
    this.#out = conn.writable.getWriter();
    void (async () => {
      try {
        for await (const chunk of conn.readable) {
          const got = this.#reader.push(chunk);
          if (got.kind === "err") return;
          for (const rec of got.value) {
            const w = this.#waiting.shift();
            if (w === undefined) this.#records.push(rec);
            else w(rec);
          }
        }
      } catch {
        // closed
      }
    })();
  }

  static async open(port: number, auth: Auth = { kind: "sys", uid: 1000, gid: 1000 }): Promise<NfsClient> {
    return new NfsClient(await connect({ hostname: "127.0.0.1", port }), auth);
  }

  close(): void {
    this.conn.close();
  }

  #next(): Promise<Uint8Array> {
    const held = this.#records.shift();
    return held !== undefined ? Promise.resolve(held) : new Promise((resolve) => this.#waiting.push(resolve));
  }

  /** The bytes of a call. */
  callBytes(prog: number, vers: number, proc: number, args: Uint8Array, xid: number = this.#xid++, rpcvers = 2): Uint8Array {
    const w = new XdrWriter().u32(xid).u32(0).u32(rpcvers).u32(prog).u32(vers).u32(proc);
    if (this.auth.kind === "none") w.u32(0).u32(0);
    else w.u32(1).opaque(new XdrWriter().u32(1).string("test").u32(this.auth.uid).u32(this.auth.gid).u32(0).bytes());
    w.u32(0).u32(0);
    const head = w.bytes();
    const out = new Uint8Array(head.length + args.length);
    out.set(head);
    out.set(args, head.length);
    return out;
  }

  /** Sends bytes as one record and reads one reply record. */
  async raw(record: Uint8Array): Promise<Uint8Array> {
    await this.#out.write(frame(record));
    return this.#next();
  }

  /** Sends a call and decodes the envelope of the reply. */
  async rpc(prog: number, vers: number, proc: number, args: Uint8Array = new Uint8Array()): Promise<Rpc & { readonly xid: number }> {
    const xid = this.#xid;
    const reply = await this.raw(this.callBytes(prog, vers, proc, args, xid));
    this.#xid++;
    return parseReply(reply);
  }

  async nfs(proc: NfsProcedure, args: Uint8Array = new Uint8Array()): Promise<XdrReader> {
    const r = await this.rpc(NFS_PROGRAM, 3, NFS_PROCEDURES.indexOf(proc), args);
    if (r.kind !== "ok") throw new Error(`${proc}: ${JSON.stringify(r)}`);
    return new XdrReader(r.body);
  }

  // ---- mount ----
  async mount(path = "/"): Promise<{ readonly status: number; readonly fh?: Uint8Array; readonly flavors?: readonly number[] }> {
    const r = await this.rpc(MOUNT_PROGRAM, 3, 1, new XdrWriter().string(path).bytes());
    if (r.kind !== "ok") throw new Error(`MNT: ${JSON.stringify(r)}`);
    const x = new XdrReader(r.body);
    const status = x.u32();
    if (status !== 0) return { status };
    const fh = x.opaque(64);
    const n = x.u32();
    const flavors = Array.from({ length: n }, () => x.u32());
    return { status, fh, flavors };
  }

  // ---- procedures, decoded ----
  async getattr(fh: Uint8Array): Promise<{ status: number; attr?: Fattr }> {
    const r = await this.nfs("GETATTR", new XdrWriter().opaque(fh).bytes());
    const status = r.u32();
    return status === 0 ? { status, attr: readAttr(r) } : { status };
  }

  async lookup(dir: Uint8Array, name: string): Promise<{ status: number; fh?: Uint8Array; attr?: Fattr }> {
    const r = await this.nfs("LOOKUP", new XdrWriter().opaque(dir).string(name).bytes());
    const status = r.u32();
    if (status !== 0) return { status };
    const fh = r.opaque(64);
    const attr = postOp(r);
    return { status, fh, ...(attr === undefined ? {} : { attr }) };
  }

  async create(dir: Uint8Array, name: string, how: 0 | 1 | 2 = 1, verf = new Uint8Array(8), mode?: number): Promise<{ status: number; fh?: Uint8Array; attr?: Fattr }> {
    const w = new XdrWriter().opaque(dir).string(name).u32(how);
    if (how === 2) w.fixed(verf);
    else sattr(w, mode === undefined ? {} : { mode });
    const r = await this.nfs("CREATE", w.bytes());
    const status = r.u32();
    if (status !== 0) return { status };
    const fh = r.bool() ? r.opaque(64) : undefined;
    const attr = postOp(r);
    return { status, ...(fh === undefined ? {} : { fh }), ...(attr === undefined ? {} : { attr }) };
  }

  async mkdir(dir: Uint8Array, name: string): Promise<{ status: number; fh?: Uint8Array }> {
    const r = await this.nfs("MKDIR", sattrWith(new XdrWriter().opaque(dir).string(name), { mode: 0o755 }).bytes());
    const status = r.u32();
    return status === 0 && r.bool() ? { status, fh: r.opaque(64) } : { status };
  }

  async write(fh: Uint8Array, offset: number, data: Uint8Array, stable = 0): Promise<{ status: number; count?: number; committed?: number; verf?: Uint8Array }> {
    const r = await this.nfs("WRITE", new XdrWriter().opaque(fh).u64(offset).u32(data.length).u32(stable).opaque(data).bytes());
    const status = r.u32();
    if (status !== 0) return { status };
    wcc(r);
    return { status, count: r.u32(), committed: r.u32(), verf: r.fixed(8) };
  }

  async commit(fh: Uint8Array): Promise<{ status: number; verf?: Uint8Array }> {
    const r = await this.nfs("COMMIT", new XdrWriter().opaque(fh).u64(0).u32(0).bytes());
    const status = r.u32();
    wcc(r);
    return status === 0 ? { status, verf: r.fixed(8) } : { status };
  }

  async read(fh: Uint8Array, offset: number, count: number): Promise<{ status: number; data?: Uint8Array; eof?: boolean }> {
    const r = await this.nfs("READ", new XdrWriter().opaque(fh).u64(offset).u32(count).bytes());
    const status = r.u32();
    postOp(r);
    if (status !== 0) return { status };
    r.u32();
    const eof = r.bool();
    return { status, eof, data: r.opaque() };
  }

  async readAll(fh: Uint8Array): Promise<Uint8Array> {
    const parts: Uint8Array[] = [];
    for (let at = 0; ; ) {
      const got = await this.read(fh, at, 4096);
      if (got.status !== 0 || got.data === undefined) throw new Error(`read ${got.status}`);
      parts.push(got.data);
      at += got.data.length;
      if (got.eof === true) break;
    }
    return Uint8Array.from(parts.flatMap((p) => [...p]));
  }

  async remove(dir: Uint8Array, name: string, proc: "REMOVE" | "RMDIR" = "REMOVE"): Promise<number> {
    return (await this.nfs(proc, new XdrWriter().opaque(dir).string(name).bytes())).u32();
  }

  async rename(fromDir: Uint8Array, from: string, toDir: Uint8Array, to: string): Promise<number> {
    return (await this.nfs("RENAME", new XdrWriter().opaque(fromDir).string(from).opaque(toDir).string(to).bytes())).u32();
  }

  async setattr(fh: Uint8Array, set: Sattr): Promise<number> {
    return (await this.nfs("SETATTR", sattrWith(new XdrWriter().opaque(fh), set).bool(false).bytes())).u32();
  }

  async readdir(dir: Uint8Array, plus = false): Promise<{ status: number; names: string[]; attrs: Map<string, Fattr>; eof: boolean }> {
    const names: string[] = [];
    const attrs = new Map<string, Fattr>();
    let cookie = 0;
    for (;;) {
      const w = new XdrWriter().opaque(dir).u64(cookie).fixed(new Uint8Array(8)).u32(512);
      if (plus) w.u32(2048);
      const r = await this.nfs(plus ? "READDIRPLUS" : "READDIR", w.bytes());
      const status = r.u32();
      postOp(r);
      if (status !== 0) return { status, names, attrs, eof: false };
      r.fixed(8);
      while (r.bool()) {
        r.u64big();
        const name = r.string(1024);
        cookie = r.u64();
        names.push(name);
        if (plus) {
          const a = postOp(r);
          if (a !== undefined) attrs.set(name, a);
          if (r.bool()) r.opaque(64);
        }
      }
      if (r.bool()) return { status, names, attrs, eof: true };
    }
  }

  async plain(proc: NfsProcedure, fh: Uint8Array): Promise<number> {
    return (await this.nfs(proc, new XdrWriter().opaque(fh).bytes())).u32();
  }
}

/** The attributes `SETATTR` and `CREATE` may set. */
export type Sattr = { readonly mode?: number; readonly uid?: number; readonly size?: number; readonly mtime?: "server" };

function sattr(w: XdrWriter, s: Sattr): XdrWriter {
  w.bool(s.mode !== undefined);
  if (s.mode !== undefined) w.u32(s.mode);
  w.bool(s.uid !== undefined);
  if (s.uid !== undefined) w.u32(s.uid);
  w.bool(false);
  w.bool(s.size !== undefined);
  if (s.size !== undefined) w.u64(s.size);
  w.u32(0);
  w.u32(s.mtime === "server" ? 1 : 0);
  return w;
}
const sattrWith = sattr;

/** The envelope of a reply. */
export function parseReply(reply: Uint8Array): Rpc & { readonly xid: number } {
  const r = new XdrReader(reply);
  const xid = r.u32();
  if (r.u32() !== 1) throw new Error("not a reply");
  if (r.u32() === 1) {
    const why = r.u32();
    const detail: number[] = [];
    while (r.left >= 4) detail.push(r.u32());
    return { xid, kind: "denied", why, detail };
  }
  r.u32();
  r.opaque(400);
  const accept = r.u32();
  if (accept === 0) return { xid, kind: "ok", body: r.rest() };
  if (accept === 2) return { xid, kind: "failed", accept, versions: [r.u32(), r.u32()] };
  return { xid, kind: "failed", accept };
}
