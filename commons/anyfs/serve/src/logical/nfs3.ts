// Spec: 0006-anyfs-serve-nfs FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * NFS version 3 and its mount protocol over the POSIX view of a store: `nfsService(view, options)` gives one function that takes a call of ONC RPC and gives the bytes of its reply, with nothing of a socket in it. A
 * file handle is the boot identity of the server and a number the server gives a path (a bounded table, so a handle that is not known is `NFS3ERR_STALE`); the attributes of an object are those of its stat, with a time
 * that changes with its revision where the store keeps none; a write is held in a buffer of the whole object and put as one object at `COMMIT`, at a write that asks for stable storage, when the buffer has been idle,
 * before a rename and at the end; and what the store cannot keep (links, nodes, modes, owners, times) is refused, or accepted and counted where the person asked for that. The status of a failure is the table of
 * `nfsStatusOfErrno` over the code the view gave, and every operation tells `onEvent` how it was carried out.
 *
 * @example
 * ```ts
 * import { posix } from "@intellectual-frontiers/anyfs-posix/physical";
 * import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
 * import { nfsService } from "./nfs3.ts";
 * const service = nfsService(posix(memoryStore()), {});
 * service.boot.length; // 8
 * ```
 *
 * @module
 */
import {
  emulated,
  type Fidelity,
  isBelow,
  joinPosix,
  native,
  parentPosix,
  type PosixError,
  type PosixPath,
  type PosixStat,
  refusedBy,
  resolvePosix,
  ROOT_PATH,
} from "@intellectual-frontiers/anyfs-posix/governance";
import type { Posix } from "@intellectual-frontiers/anyfs-posix/logical";
import {
  ACCESS,
  FTYPE,
  MOUNT_PROCEDURES,
  MOUNT_PROGRAM,
  MOUNT_STATUS,
  MOUNT_VERSION,
  NFS_PROCEDURES,
  NFS_PROGRAM,
  NFS_STATUS,
  NFS_VERSION,
  type NfsProcedure,
  nfsStatusOfErrno,
  STABLE,
  TRANSFER,
} from "@intellectual-frontiers/anyfs-serve/governance";
import { ACCEPT, AUTH, accepted, failed, progMismatch, type RpcCall } from "./rpc.ts";
import { XdrError, XdrReader, XdrWriter } from "./xdr.ts";

/** What the service tells of one operation: the procedure, the path, the status given and how it was carried out. */
export type NfsEvent = {
  readonly proc: NfsProcedure | "MNT" | "UMNT" | "UMNTALL" | "EXPORT" | "DUMP";
  readonly path?: string;
  readonly status: number;
  readonly fidelity: Fidelity;
  /** The uid the call said it was, where it said one. */
  readonly uid?: number;
  /** What the operation noticed on the way (the mode of a create that is not kept, an attribute that was dropped). */
  readonly note?: string;
};

/** What the service is told. */
export type NfsOptions = {
  /** The path a client mounts: `/` by default. */
  readonly exportPath?: string;
  /** Refuse every change. */
  readonly readOnly?: boolean;
  /** The uids that may ask (the `AUTH_SYS` of the call); anyone where it is not given. */
  readonly uids?: readonly number[];
  /** What to do with a mode, an owner or a time the store cannot keep: refuse it (the default) or accept it without effect and count it. */
  readonly attributes?: "refuse" | "ignore";
  /** The largest object, in bytes: 64 MiB by default. */
  readonly maxFileBytes?: number;
  /** The most file handles held: 65536 by default. */
  readonly maxHandles?: number;
  /** How long a buffer is idle before it is put, in milliseconds: 2000 by default. */
  readonly flushAfterMs?: number;
  /** The time in milliseconds; the clock by default. */
  readonly clock?: () => number;
  /** The identity of this boot, 8 bytes; random by default. */
  readonly boot?: Uint8Array;
  readonly onEvent?: (event: NfsEvent) => void;
};

/** A running service. */
export type NfsService = {
  /** Answers a call with the bytes of its reply. */
  handle(call: RpcCall): Promise<Uint8Array>;
  /** Puts every buffer that holds a write; the failures are given. */
  flushAll(): Promise<readonly string[]>;
  /** The identity of this boot: the write verifier and the first part of every handle. */
  readonly boot: Uint8Array;
  /** How many attributes were accepted without effect (`attributes: "ignore"`). */
  dropped(): number;
};

type Reply = { readonly status: number; readonly body: XdrWriter; readonly path?: string; readonly fidelity: Fidelity; readonly note?: string };

type Attr = { readonly type: 1 | 2; readonly mode: number; readonly uid: number; readonly gid: number; readonly size: number; readonly sec: number; readonly nsec: number; readonly fileid: bigint };

const DEFAULT_MAX_FILE = 64 * 1024 * 1024;
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;

/** A stable number for a path, for the `fileid` of an object: FNV-1a of its bytes, kept to 52 bits, never 0. */
export function fileidOf(path: string): bigint {
  let h = FNV_OFFSET;
  for (const b of new TextEncoder().encode(path)) h = ((h ^ BigInt(b)) * FNV_PRIME) & 0xffffffffffffffffn;
  const n = h & 0xfffffffffffffn;
  return n === 0n ? 1n : n;
}

/**
 * The time of a stat in seconds and nanoseconds: the store's where it keeps one, and below the millisecond a number made from the revision, so that two changes in one millisecond (or a store that keeps no time) still
 * show as a change to a client that keeps its cache by time and size.
 */
function timeOf(stat: { readonly mtime?: string; readonly rev?: string }): { readonly sec: number; readonly nsec: number } {
  let h = 0;
  if (stat.rev !== undefined) {
    h = 2166136261;
    for (let i = 0; i < stat.rev.length; i++) h = Math.imul(h ^ stat.rev.charCodeAt(i), 16777619) >>> 0;
  }
  if (stat.mtime !== undefined) {
    const ms = Date.parse(stat.mtime);
    if (Number.isFinite(ms)) return { sec: Math.floor(ms / 1000), nsec: (ms % 1000) * 1_000_000 + (h % 1_000_000) };
  }
  return stat.rev === undefined ? { sec: 0, nsec: 0 } : { sec: 1, nsec: h % 1_000_000_000 };
}

class Handles {
  readonly #byId = new Map<number, PosixPath>([[1, ROOT_PATH]]);
  readonly #byPath = new Map<PosixPath, number>([[ROOT_PATH, 1]]);
  #next = 2;
  readonly max: number;
  constructor(max: number) {
    this.max = max;
  }

  idOf(path: PosixPath): number {
    const held = this.#byPath.get(path);
    if (held !== undefined) {
      if (held !== 1) {
        this.#byId.delete(held);
        this.#byId.set(held, path);
      }
      return held;
    }
    const id = this.#next++;
    this.#byId.set(id, path);
    this.#byPath.set(path, id);
    while (this.#byId.size > this.max) {
      const oldest = this.#byId.keys().next().value;
      if (oldest === undefined) break;
      if (oldest === 1) {
        this.#byId.delete(1);
        this.#byId.set(1, ROOT_PATH);
        continue;
      }
      const p = this.#byId.get(oldest);
      this.#byId.delete(oldest);
      if (p !== undefined) this.#byPath.delete(p);
    }
    return id;
  }

  pathOf(id: number): PosixPath | undefined {
    return this.#byId.get(id);
  }

  /** The path and what is below it are not there any more. */
  forget(path: PosixPath): void {
    for (const [id, p] of [...this.#byId]) {
      if (id !== 1 && (p === path || isBelow(path, p))) {
        this.#byId.delete(id);
        this.#byPath.delete(p);
      }
    }
  }

  /** What was at `from` and below it is at `to`, with the same handles. */
  moved(from: PosixPath, to: PosixPath): void {
    this.forget(to);
    for (const [id, p] of [...this.#byId]) {
      if (p === from || isBelow(from, p)) {
        const next = (to === ROOT_PATH ? p.slice(from.length) : `${to}${p.slice(from.length)}`) as PosixPath;
        this.#byPath.delete(p);
        this.#byId.set(id, next);
        this.#byPath.set(next, id);
      }
    }
  }
}

type Buffer = { bytes: Uint8Array; dirty: boolean; mtime: number; timer: ReturnType<typeof setTimeout> | undefined };

const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

/** The service over a view. */
export function nfsService(view: Posix, options: NfsOptions): NfsService {
  const clock = options.clock ?? ((): number => Date.now());
  const maxFile = options.maxFileBytes ?? DEFAULT_MAX_FILE;
  const flushAfter = options.flushAfterMs ?? 2000;
  const exportPath = resolvePosix(ROOT_PATH, options.exportPath ?? "/");
  const root: PosixPath = exportPath.kind === "ok" ? exportPath.value : ROOT_PATH;
  const boot = options.boot ?? crypto.getRandomValues(new Uint8Array(8));
  const handles = new Handles(options.maxHandles ?? 65536);
  const buffers = new Map<PosixPath, Buffer>();
  const verifiers = new Map<PosixPath, string>();
  const ownership = view.policy.ownership;
  const refuseAttributes = (options.attributes ?? "refuse") === "refuse";
  let dropped = 0;
  const canWrite = !(options.readOnly ?? false) && view.capabilities.has("write");
  const allowed = (call: RpcCall): boolean => options.uids === undefined || (call.cred.flavor === AUTH.SYS && call.cred.uid !== undefined && options.uids.includes(call.cred.uid));

  const handleOf = (path: PosixPath): Uint8Array => {
    const out = new Uint8Array(17);
    out[0] = 1;
    out.set(boot, 1);
    new DataView(out.buffer).setBigUint64(9, BigInt(handles.idOf(path)));
    return out;
  };

  /** The path of a handle, or the status that says why it is not one. */
  const resolveHandle = (fh: Uint8Array): { readonly path: PosixPath } | { readonly status: number } => {
    if (fh.length !== 17 || fh[0] !== 1) return { status: NFS_STATUS.BADHANDLE };
    for (let i = 0; i < 8; i++) if (fh[1 + i] !== boot[i]) return { status: NFS_STATUS.STALE };
    const id = Number(new DataView(fh.buffer, fh.byteOffset, fh.byteLength).getBigUint64(9));
    const path = handles.pathOf(id);
    return path === undefined ? { status: NFS_STATUS.STALE } : { path };
  };

  const nameError = (name: string): number | undefined => {
    if (name === "") return NFS_STATUS.INVAL;
    if (new TextEncoder().encode(name).length > 255) return NFS_STATUS.NAMETOOLONG;
    if (name.includes("/") || name !== name.normalize("NFC")) return NFS_STATUS.INVAL;
    const r = resolvePosix(ROOT_PATH, name);
    return r.kind === "ok" && r.value === `/${name}` ? undefined : NFS_STATUS.INVAL;
  };

  const attrOfStat = (path: PosixPath, stat: PosixStat | { readonly type: "file" | "dir"; readonly size?: number; readonly mtime?: string; readonly rev?: string }): Attr => {
    const buffer = buffers.get(path);
    const t = buffer?.dirty === true ? { sec: Math.floor(buffer.mtime / 1000), nsec: (buffer.mtime % 1000) * 1_000_000 } : timeOf(stat);
    const isDir = stat.type === "dir";
    return {
      type: isDir ? FTYPE.dir : FTYPE.file,
      mode: "mode" in stat ? stat.mode : isDir ? ownership.dirMode : ownership.fileMode,
      uid: "uid" in stat ? stat.uid : ownership.uid,
      gid: "gid" in stat ? stat.gid : ownership.gid,
      size: isDir ? 4096 : (buffer?.bytes.length ?? stat.size ?? 0),
      ...t,
      fileid: fileidOf(path),
    };
  };

  const failure = (status: number, path?: string, fidelity: Fidelity = native, note?: string): Reply => ({ status, body: new XdrWriter().u32(status).bool(false).bool(false).bool(false).bool(false), ...(path === undefined ? {} : { path }), fidelity, ...(note === undefined ? {} : { note }) });
  const failureOf = (e: PosixError, path?: string): Reply => failure(nfsStatusOfErrno(e.errno), path, e.fidelity);

  const writeAttr = (w: XdrWriter, a: Attr): void => {
    w.u32(a.type).u32(a.mode).u32(a.type === FTYPE.dir ? 2 : 1).u32(a.uid).u32(a.gid).u64(a.size).u64(Math.ceil(a.size / 4096) * 4096).u32(0).u32(0).u64(1).u64(a.fileid);
    w.u32(a.sec).u32(a.nsec).u32(a.sec).u32(a.nsec).u32(a.sec).u32(a.nsec);
  };

  /** The attributes of a path, or nothing where it cannot be said. */
  const attrs = async (path: PosixPath): Promise<Attr | undefined> => {
    const s = await view.stat(path);
    return s.kind === "ok" ? attrOfStat(path, s.value.value) : undefined;
  };
  const postOp = async (w: XdrWriter, path: PosixPath | undefined): Promise<void> => {
    const a = path === undefined ? undefined : await attrs(path);
    if (a === undefined) w.bool(false);
    else {
      w.bool(true);
      writeAttr(w, a);
    }
  };
  const wcc = async (w: XdrWriter, path: PosixPath | undefined): Promise<void> => {
    w.bool(false);
    await postOp(w, path);
  };

  const modify = (path?: string): Reply | undefined => (canWrite ? undefined : failure(NFS_STATUS.ROFS, path, refusedBy("read-only", "the export is read-only or the store cannot write")));

  const flush = async (path: PosixPath): Promise<PosixError | undefined> => {
    const b = buffers.get(path);
    if (b === undefined || !b.dirty) return undefined;
    if (b.timer !== undefined) clearTimeout(b.timer);
    b.timer = undefined;
    const done = await view.writeFile(path, b.bytes);
    if (done.kind === "err") return done.error;
    b.dirty = false;
    buffers.delete(path);
    return undefined;
  };
  const flushBelow = async (path: PosixPath): Promise<PosixError | undefined> => {
    for (const p of [...buffers.keys()]) if (p === path || isBelow(path, p)) {
      const e = await flush(p);
      if (e !== undefined) return e;
    }
    return undefined;
  };
  const dropBelow = (path: PosixPath): void => {
    for (const [p, b] of [...buffers]) if (p === path || isBelow(path, p)) {
      if (b.timer !== undefined) clearTimeout(b.timer);
      buffers.delete(p);
    }
    for (const p of [...verifiers.keys()]) if (p === path || isBelow(path, p)) verifiers.delete(p);
  };
  const touch = (path: PosixPath, b: Buffer): void => {
    b.dirty = true;
    b.mtime = clock();
    if (b.timer !== undefined) clearTimeout(b.timer);
    b.timer = setTimeout(() => void flush(path), flushAfter);
    (b.timer as { unref?: () => void }).unref?.();
  };
  const bufferOf = async (path: PosixPath): Promise<Buffer | Reply> => {
    const held = buffers.get(path);
    if (held !== undefined) return held;
    const stat = await view.stat(path);
    if (stat.kind === "err") return failure(stat.error.errno === "ENOENT" ? NFS_STATUS.STALE : nfsStatusOfErrno(stat.error.errno), path, stat.error.fidelity);
    if (stat.value.value.type === "dir") return failure(NFS_STATUS.ISDIR, path);
    if (stat.value.value.size > maxFile) return failure(NFS_STATUS.FBIG, path);
    const read = await view.readFile(path);
    if (read.kind === "err") return failureOf(read.error, path);
    const b: Buffer = { bytes: read.value.value.slice(), dirty: false, mtime: clock(), timer: undefined };
    buffers.set(path, b);
    return b;
  };
  const isReply = (x: Buffer | Reply): x is Reply => "status" in x;

  const dirOf = async (fh: Uint8Array): Promise<{ readonly path: PosixPath } | Reply> => {
    const h = resolveHandle(fh);
    if ("status" in h) return failure(h.status);
    const s = await view.stat(h.path);
    if (s.kind === "err") return failure(s.error.errno === "ENOENT" ? NFS_STATUS.STALE : nfsStatusOfErrno(s.error.errno), h.path, s.error.fidelity);
    return s.value.value.type === "dir" ? { path: h.path } : failure(NFS_STATUS.NOTDIR, h.path);
  };
  const isPath = (x: { readonly path: PosixPath } | Reply): x is { readonly path: PosixPath } => "path" in x && !("status" in x);

  const sattr = (r: XdrReader): { readonly mode?: number; readonly uid?: number; readonly gid?: number; readonly size?: number; readonly time: boolean } => {
    const out: { mode?: number; uid?: number; gid?: number; size?: number; time: boolean } = { time: false };
    if (r.bool()) out.mode = r.u32();
    if (r.bool()) out.uid = r.u32();
    if (r.bool()) out.gid = r.u32();
    if (r.bool()) out.size = r.u64();
    for (let i = 0; i < 2; i++) {
      const how = r.u32();
      if (how > 2) throw new XdrError("a time is set to nothing, the server's time or the client's");
      if (how === 2) {
        r.u32();
        r.u32();
      }
      if (how !== 0) out.time = true;
    }
    return out;
  };

  /** What `sattr` asks that the object does not already have, as the note of the attributes that cannot be kept. */
  const unkept = (want: ReturnType<typeof sattr>, have: Attr | undefined): string[] => {
    const out: string[] = [];
    if (want.mode !== undefined && want.mode !== have?.mode) out.push(`mode ${want.mode.toString(8)}`);
    if (want.uid !== undefined && want.uid !== have?.uid) out.push(`uid ${want.uid}`);
    if (want.gid !== undefined && want.gid !== have?.gid) out.push(`gid ${want.gid}`);
    if (want.time) out.push("time");
    return out;
  };

  const fhOut = (w: XdrWriter, path: PosixPath): void => {
    w.bool(true);
    w.opaque(handleOf(path));
  };

  // ---- the procedures of NFS ----
  type Handler = (r: XdrReader, call: RpcCall) => Promise<Reply>;

  const getattr: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    if ("status" in h) return failure(h.status);
    const s = await view.stat(h.path);
    if (s.kind === "err") return failure(s.error.errno === "ENOENT" ? NFS_STATUS.STALE : nfsStatusOfErrno(s.error.errno), h.path, s.error.fidelity);
    const w = new XdrWriter().u32(0);
    writeAttr(w, attrOfStat(h.path, s.value.value));
    return { status: 0, body: w, path: h.path, fidelity: s.value.fidelity };
  };

  const setattr: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    const want = sattr(r);
    if (r.bool()) {
      r.u32();
      r.u32();
    }
    if ("status" in h) return failure(h.status);
    const denied = modify(h.path);
    if (denied !== undefined) return denied;
    const have = await attrs(h.path);
    if (have === undefined) return failure(NFS_STATUS.STALE, h.path);
    const lost = unkept(want, have);
    if (lost.length > 0 && refuseAttributes) {
      const w = new XdrWriter().u32(NFS_STATUS.NOTSUPP);
      await wcc(w, h.path);
      return { status: NFS_STATUS.NOTSUPP, body: w, path: h.path, fidelity: refusedBy("not-in-model", `the store keeps no ${lost.join(", ")}`) };
    }
    let fidelity: Fidelity = native;
    if (lost.length > 0) {
      dropped += lost.length;
      fidelity = emulated("touch-without-mtime", `${lost.join(", ")} accepted and not kept`);
    }
    if (want.size !== undefined) {
      if (have.type === FTYPE.dir) return failure(NFS_STATUS.ISDIR, h.path);
      if (want.size > maxFile) return failure(NFS_STATUS.FBIG, h.path);
      const b = await bufferOf(h.path);
      if (isReply(b)) return b;
      if (b.bytes.length !== want.size) {
        const next = new Uint8Array(want.size);
        next.set(b.bytes.subarray(0, want.size));
        b.bytes = next;
        touch(h.path, b);
      }
      fidelity = emulated("write-back-buffer");
    }
    const w = new XdrWriter().u32(0);
    await wcc(w, h.path);
    return { status: 0, body: w, path: h.path, fidelity, ...(lost.length > 0 ? { note: `dropped ${lost.join(", ")}` } : {}) };
  };

  const lookup: Handler = async (r) => {
    const dir = await dirOf(r.opaque(64));
    const name = r.string(1024);
    if (!isPath(dir)) {
      const w = new XdrWriter().u32(dir.status);
      w.bool(false);
      return { ...dir, body: w };
    }
    let child: PosixPath;
    if (name === ".") child = dir.path;
    else if (name === "..") child = dir.path === root ? dir.path : parentPosix(dir.path);
    else {
      const bad = nameError(name);
      if (bad !== undefined) {
        const w = new XdrWriter().u32(bad);
        await postOp(w, dir.path);
        return { status: bad, body: w, path: dir.path, fidelity: refusedBy("not-in-model", "the name is not one the store keeps") };
      }
      child = joinPosix(dir.path, name);
    }
    const s = await view.stat(child);
    if (s.kind === "err") {
      const w = new XdrWriter().u32(nfsStatusOfErrno(s.error.errno));
      await postOp(w, dir.path);
      return { status: nfsStatusOfErrno(s.error.errno), body: w, path: child, fidelity: s.error.fidelity };
    }
    const w = new XdrWriter().u32(0);
    w.opaque(handleOf(child));
    w.bool(true);
    writeAttr(w, attrOfStat(child, s.value.value));
    await postOp(w, dir.path);
    return { status: 0, body: w, path: child, fidelity: s.value.fidelity };
  };

  const access: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    const want = r.u32();
    if ("status" in h) return failure(h.status);
    const a = await attrs(h.path);
    if (a === undefined) return failure(NFS_STATUS.STALE, h.path);
    const all = a.type === FTYPE.dir ? ACCESS.READ | ACCESS.LOOKUP | (canWrite ? ACCESS.MODIFY | ACCESS.EXTEND | ACCESS.DELETE : 0) : ACCESS.READ | (canWrite ? ACCESS.MODIFY | ACCESS.EXTEND : 0);
    const w = new XdrWriter().u32(0);
    w.bool(true);
    writeAttr(w, a);
    w.u32(want & all);
    return { status: 0, body: w, path: h.path, fidelity: native };
  };

  const readlink: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    if ("status" in h) return failure(h.status);
    const w = new XdrWriter().u32(NFS_STATUS.INVAL);
    await postOp(w, h.path);
    return { status: NFS_STATUS.INVAL, body: w, path: h.path, fidelity: refusedBy("not-in-model", "the store has no symbolic links") };
  };

  const read: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    const offset = r.u64();
    const count = Math.min(r.u32(), TRANSFER.rtmax);
    if ("status" in h) return failure(h.status);
    const s = await view.stat(h.path);
    if (s.kind === "err") return failure(s.error.errno === "ENOENT" ? NFS_STATUS.STALE : nfsStatusOfErrno(s.error.errno), h.path, s.error.fidelity);
    if (s.value.value.type === "dir") {
      const w = new XdrWriter().u32(NFS_STATUS.ISDIR);
      await postOp(w, h.path);
      return { status: NFS_STATUS.ISDIR, body: w, path: h.path, fidelity: native };
    }
    const attr = attrOfStat(h.path, s.value.value);
    let data: Uint8Array;
    let fidelity: Fidelity = s.value.fidelity;
    const b = buffers.get(h.path);
    if (b !== undefined) {
      data = b.bytes.subarray(Math.min(offset, b.bytes.length), Math.min(offset + count, b.bytes.length));
      fidelity = emulated("write-back-buffer", "read from the buffer of a write not yet put");
    } else if (offset >= attr.size || count === 0) data = new Uint8Array();
    else {
      const opened = await view.open(h.path, "r");
      if (opened.kind === "err") return failureOf(opened.error, h.path);
      const got = await view.read(opened.value.value, count, offset);
      await view.close(opened.value.value);
      if (got.kind === "err") return failureOf(got.error, h.path);
      data = got.value.value;
      fidelity = got.value.fidelity;
    }
    const w = new XdrWriter().u32(0);
    w.bool(true);
    writeAttr(w, attr);
    w.u32(data.length).bool(offset + data.length >= attr.size).opaque(data);
    return { status: 0, body: w, path: h.path, fidelity };
  };

  const write: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    const offset = r.u64();
    const count = r.u32();
    const stable = r.u32();
    const data = r.opaque(TRANSFER.wtmax);
    if (stable > STABLE.FILE_SYNC) throw new XdrError("stable is unstable, data sync or file sync");
    if (data.length !== count) throw new XdrError("a write says its count and holds another");
    if ("status" in h) return failure(h.status);
    const denied = modify(h.path);
    if (denied !== undefined) {
      const w = new XdrWriter().u32(denied.status);
      await wcc(w, h.path);
      return { ...denied, body: w };
    }
    if (offset + count > maxFile) {
      const w = new XdrWriter().u32(NFS_STATUS.FBIG);
      await wcc(w, h.path);
      return { status: NFS_STATUS.FBIG, body: w, path: h.path, fidelity: refusedBy("not-in-model", "the object would be larger than the limit") };
    }
    const b = await bufferOf(h.path);
    if (isReply(b)) {
      const w = new XdrWriter().u32(b.status);
      await wcc(w, h.path);
      return { ...b, body: w };
    }
    if (offset + count > b.bytes.length) {
      const next = new Uint8Array(offset + count);
      next.set(b.bytes);
      b.bytes = next;
    }
    b.bytes.set(data, offset);
    touch(h.path, b);
    let committed: number = STABLE.UNSTABLE;
    let fidelity: Fidelity = emulated("write-back-buffer");
    if (stable !== STABLE.UNSTABLE) {
      const e = await flush(h.path);
      if (e !== undefined) {
        const w = new XdrWriter().u32(nfsStatusOfErrno(e.errno));
        await wcc(w, h.path);
        return { status: nfsStatusOfErrno(e.errno), body: w, path: h.path, fidelity: e.fidelity };
      }
      committed = stable;
      fidelity = emulated("read-modify-write");
    }
    const w = new XdrWriter().u32(0);
    await wcc(w, h.path);
    w.u32(count).u32(committed).fixed(boot);
    return { status: 0, body: w, path: h.path, fidelity };
  };

  /** CREATE and MKDIR share the shape of their answers. */
  const made = async (dir: PosixPath, child: PosixPath, w: XdrWriter, fidelity: Fidelity, note?: string): Promise<Reply> => {
    fhOut(w, child);
    await postOp(w, child);
    await wcc(w, dir);
    return { status: 0, body: w, path: child, fidelity, ...(note === undefined ? {} : { note }) };
  };
  const refusedIn = async (status: number, dir: PosixPath | undefined, path: string | undefined, fidelity: Fidelity): Promise<Reply> => {
    const w = new XdrWriter().u32(status);
    await wcc(w, dir);
    return { status, body: w, ...(path === undefined ? {} : { path }), fidelity };
  };

  const create: Handler = async (r) => {
    const dir = await dirOf(r.opaque(64));
    const name = r.string(1024);
    const how = r.u32();
    if (how > 2) throw new XdrError("a create is unchecked, guarded or exclusive");
    let want: ReturnType<typeof sattr> = { time: false };
    let verf = "";
    if (how === 2) verf = hex(r.fixed(8));
    else want = sattr(r);
    if (!isPath(dir)) return refusedIn(dir.status, undefined, undefined, native);
    const denied = modify(dir.path);
    if (denied !== undefined) return refusedIn(denied.status, dir.path, dir.path, denied.fidelity);
    const bad = nameError(name);
    if (bad !== undefined) return refusedIn(bad, dir.path, dir.path, refusedBy("not-in-model", "the name is not one the store keeps"));
    const child = joinPosix(dir.path, name);
    const there = await view.stat(child);
    const note = want.mode === undefined ? undefined : `the mode ${want.mode.toString(8)} of the create is not kept`;
    if (there.kind === "ok") {
      if (how === 1) return refusedIn(NFS_STATUS.EXIST, dir.path, child, native);
      if (how === 2 && verifiers.get(child) !== verf) return refusedIn(NFS_STATUS.EXIST, dir.path, child, native);
      if (there.value.value.type === "dir") return refusedIn(NFS_STATUS.ISDIR, dir.path, child, native);
      if (how === 0 && want.size === 0) {
        const b = await bufferOf(child);
        if (!isReply(b) && b.bytes.length > 0) {
          b.bytes = new Uint8Array();
          touch(child, b);
        }
      }
      return made(dir.path, child, new XdrWriter().u32(0), there.value.fidelity, note);
    }
    if (there.error.errno !== "ENOENT") return refusedIn(nfsStatusOfErrno(there.error.errno), dir.path, child, there.error.fidelity);
    const done = await view.writeFile(child, new Uint8Array(), { exclusive: how !== 0 });
    if (done.kind === "err") return refusedIn(nfsStatusOfErrno(done.error.errno), dir.path, child, done.error.fidelity);
    if (how === 2) verifiers.set(child, verf);
    return made(dir.path, child, new XdrWriter().u32(0), done.value.fidelity, note);
  };

  const mkdir: Handler = async (r) => {
    const dir = await dirOf(r.opaque(64));
    const name = r.string(1024);
    const want = sattr(r);
    if (!isPath(dir)) return refusedIn(dir.status, undefined, undefined, native);
    const denied = modify(dir.path);
    if (denied !== undefined) return refusedIn(denied.status, dir.path, dir.path, denied.fidelity);
    const bad = nameError(name);
    if (bad !== undefined) return refusedIn(bad, dir.path, dir.path, refusedBy("not-in-model", "the name is not one the store keeps"));
    const child = joinPosix(dir.path, name);
    const done = await view.mkdir(child);
    if (done.kind === "err") return refusedIn(nfsStatusOfErrno(done.error.errno), dir.path, child, done.error.fidelity);
    return made(dir.path, child, new XdrWriter().u32(0), done.value.fidelity, want.mode === undefined ? undefined : `the mode ${want.mode.toString(8)} of the mkdir is not kept`);
  };

  const unsupported = (status: number, why: string, link = false): Handler => async (r) => {
    const h = resolveHandle(r.opaque(64));
    if (link) {
      const w = new XdrWriter().u32(status);
      w.bool(false);
      await wcc(w, "path" in h ? h.path : undefined);
      return { status, body: w, fidelity: refusedBy("not-in-model", why) };
    }
    return refusedIn(status, "path" in h ? h.path : undefined, "path" in h ? h.path : undefined, refusedBy("not-in-model", why));
  };

  const remove = (kind: "file" | "dir"): Handler => async (r) => {
    const dir = await dirOf(r.opaque(64));
    const name = r.string(1024);
    if (!isPath(dir)) return refusedIn(dir.status, undefined, undefined, native);
    const denied = modify(dir.path);
    if (denied !== undefined) return refusedIn(denied.status, dir.path, dir.path, denied.fidelity);
    const bad = nameError(name);
    if (bad !== undefined) return refusedIn(bad, dir.path, dir.path, refusedBy("not-in-model", "the name is not one the store keeps"));
    const child = joinPosix(dir.path, name);
    const s = await view.stat(child);
    if (s.kind === "err") return refusedIn(nfsStatusOfErrno(s.error.errno), dir.path, child, s.error.fidelity);
    if (kind === "file" && s.value.value.type === "dir") return refusedIn(NFS_STATUS.ISDIR, dir.path, child, native);
    if (kind === "dir" && s.value.value.type !== "dir") return refusedIn(NFS_STATUS.NOTDIR, dir.path, child, native);
    const done = kind === "file" ? await view.unlink(child) : await view.rmdir(child);
    if (done.kind === "err") return refusedIn(nfsStatusOfErrno(done.error.errno), dir.path, child, done.error.fidelity);
    dropBelow(child);
    handles.forget(child);
    const w = new XdrWriter().u32(0);
    await wcc(w, dir.path);
    return { status: 0, body: w, path: child, fidelity: done.value.fidelity };
  };

  const rename: Handler = async (r) => {
    const from = await dirOf(r.opaque(64));
    const fromName = r.string(1024);
    const to = await dirOf(r.opaque(64));
    const toName = r.string(1024);
    const two = async (status: number, fidelity: Fidelity, path?: string): Promise<Reply> => {
      const w = new XdrWriter().u32(status);
      await wcc(w, isPath(from) ? from.path : undefined);
      await wcc(w, isPath(to) ? to.path : undefined);
      return { status, body: w, ...(path === undefined ? {} : { path }), fidelity };
    };
    if (!isPath(from)) return two(from.status, native);
    if (!isPath(to)) return two(to.status, native);
    const denied = modify(from.path);
    if (denied !== undefined) return two(denied.status, denied.fidelity, from.path);
    const bad = nameError(fromName) ?? nameError(toName);
    if (bad !== undefined) return two(bad, refusedBy("not-in-model", "the name is not one the store keeps"));
    const src = joinPosix(from.path, fromName);
    const dst = joinPosix(to.path, toName);
    const flushed = await flushBelow(src);
    if (flushed !== undefined) return two(nfsStatusOfErrno(flushed.errno), flushed.fidelity, src);
    dropBelow(dst);
    const done = await view.rename(src, dst);
    if (done.kind === "err") return two(nfsStatusOfErrno(done.error.errno), done.error.fidelity, src);
    handles.moved(src, dst);
    return { ...(await two(0, done.value.fidelity, src)) };
  };

  const readdir = (plus: boolean): Handler => async (r) => {
    const dir = await dirOf(r.opaque(64));
    const cookie = r.u64();
    r.fixed(8);
    const dircount = r.u32();
    const maxcount = plus ? r.u32() : dircount;
    void dircount;
    if (!isPath(dir)) {
      const w = new XdrWriter().u32(dir.status);
      w.bool(false);
      return { ...dir, body: w };
    }
    const listed = await view.readdir(dir.path);
    if (listed.kind === "err") {
      const w = new XdrWriter().u32(nfsStatusOfErrno(listed.error.errno));
      await postOp(w, dir.path);
      return { status: nfsStatusOfErrno(listed.error.errno), body: w, path: dir.path, fidelity: listed.error.fidelity };
    }
    const names = [...listed.value.value].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    type Item = { readonly name: string; readonly attr: Attr };
    const items: Item[] = [
      { name: ".", attr: attrOfStat(dir.path, { type: "dir" }) },
      { name: "..", attr: attrOfStat(dir.path === root ? dir.path : parentPosix(dir.path), { type: "dir" }) },
      ...names.map((e) => ({ name: e.name, attr: attrOfStat(joinPosix(dir.path, e.name), e) })),
    ];
    if (cookie > items.length) {
      const w = new XdrWriter().u32(NFS_STATUS.BAD_COOKIE);
      await postOp(w, dir.path);
      return { status: NFS_STATUS.BAD_COOKIE, body: w, path: dir.path, fidelity: native };
    }
    const w = new XdrWriter().u32(0);
    await postOp(w, dir.path);
    w.fixed(new Uint8Array(8));
    let used = 8 + 4 + 4 + 8;
    let i = cookie;
    let taken = 0;
    for (; i < items.length; i++) {
      const item = items[i];
      if (item === undefined) break;
      const nameBytes = new TextEncoder().encode(item.name).length;
      const size = 4 + 8 + 4 + nameBytes + ((4 - (nameBytes % 4)) % 4) + 8 + (plus ? 4 + 84 + 4 : 0);
      if (used + size > Math.min(maxcount, TRANSFER.rtmax)) break;
      used += size;
      w.bool(true).u64(item.attr.fileid).string(item.name).u64(i + 1);
      if (plus) {
        w.bool(true);
        writeAttr(w, item.attr);
        w.bool(false);
      }
      taken++;
    }
    if (taken === 0 && i < items.length) {
      const e = new XdrWriter().u32(NFS_STATUS.TOOSMALL);
      await postOp(e, dir.path);
      return { status: NFS_STATUS.TOOSMALL, body: e, path: dir.path, fidelity: native };
    }
    w.bool(false).bool(i >= items.length);
    return { status: 0, body: w, path: dir.path, fidelity: listed.value.fidelity };
  };

  const fsstat: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    if ("status" in h) return failure(h.status);
    const w = new XdrWriter().u32(0);
    await postOp(w, h.path);
    const big = 2 ** 40;
    w.u64(big).u64(big).u64(big).u64(2 ** 32).u64(2 ** 32).u64(2 ** 32).u32(0);
    return { status: 0, body: w, path: h.path, fidelity: emulated("whole-object-range", "a store keeps no count of what is free: the sizes say a large number") };
  };

  const fsinfo: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    if ("status" in h) return failure(h.status);
    const w = new XdrWriter().u32(0);
    await postOp(w, h.path);
    w.u32(TRANSFER.rtmax).u32(TRANSFER.rtpref).u32(TRANSFER.rtmult).u32(TRANSFER.wtmax).u32(TRANSFER.wtpref).u32(TRANSFER.wtmult).u32(TRANSFER.dtpref).u64(maxFile).u32(1).u32(0).u32(0x08);
    return { status: 0, body: w, path: h.path, fidelity: native };
  };

  const pathconf: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    if ("status" in h) return failure(h.status);
    const w = new XdrWriter().u32(0);
    await postOp(w, h.path);
    w.u32(1).u32(255).bool(true).bool(true).bool(false).bool(true);
    return { status: 0, body: w, path: h.path, fidelity: native };
  };

  const commit: Handler = async (r) => {
    const h = resolveHandle(r.opaque(64));
    r.u64();
    r.u32();
    if ("status" in h) return failure(h.status);
    const e = await flush(h.path);
    const w = new XdrWriter().u32(e === undefined ? 0 : nfsStatusOfErrno(e.errno));
    await wcc(w, h.path);
    if (e !== undefined) return { status: nfsStatusOfErrno(e.errno), body: w, path: h.path, fidelity: e.fidelity };
    w.fixed(boot);
    return { status: 0, body: w, path: h.path, fidelity: emulated("read-modify-write", "the buffer of the writes is put as one object") };
  };

  const nfs: Readonly<Record<NfsProcedure, Handler>> = {
    NULL: () => Promise.resolve({ status: 0, body: new XdrWriter(), fidelity: native }),
    GETATTR: getattr,
    SETATTR: setattr,
    LOOKUP: lookup,
    ACCESS: access,
    READLINK: readlink,
    READ: read,
    WRITE: write,
    CREATE: create,
    MKDIR: mkdir,
    SYMLINK: unsupported(NFS_STATUS.NOTSUPP, "the store has no symbolic links"),
    MKNOD: unsupported(NFS_STATUS.BADTYPE, "the store has files and directories only"),
    REMOVE: remove("file"),
    RMDIR: remove("dir"),
    RENAME: rename,
    LINK: unsupported(NFS_STATUS.NOTSUPP, "the store has no hard links", true),
    READDIR: readdir(false),
    READDIRPLUS: readdir(true),
    FSSTAT: fsstat,
    FSINFO: fsinfo,
    PATHCONF: pathconf,
    COMMIT: commit,
  };

  // ---- the mount protocol ----
  const mounts = new Set<string>();
  const mountProcedure = async (proc: (typeof MOUNT_PROCEDURES)[number], r: XdrReader, call: RpcCall): Promise<{ readonly reply: Reply; readonly event: NfsEvent["proc"] } | undefined> => {
    switch (proc) {
      case "NULL":
        return undefined;
      case "MNT": {
        const dirpath = r.string(1024);
        const asked = resolvePosix(ROOT_PATH, dirpath.startsWith("/") ? dirpath : `/${dirpath}`);
        if (!allowed(call)) return { reply: failure(MOUNT_STATUS.ACCES, dirpath, refusedBy("read-only", "the caller is not one that may mount")), event: "MNT" };
        if (asked.kind === "err" || asked.value !== root) return { reply: failure(MOUNT_STATUS.NOENT, dirpath), event: "MNT" };
        const s = await view.stat(root);
        if (s.kind === "err" || s.value.value.type !== "dir") return { reply: failure(MOUNT_STATUS.NOENT, dirpath), event: "MNT" };
        mounts.add(call.cred.machine ?? "");
        const w = new XdrWriter().u32(0).opaque(handleOf(root)).u32(2).u32(AUTH.SYS).u32(AUTH.NONE);
        return { reply: { status: 0, body: w, path: root, fidelity: native }, event: "MNT" };
      }
      case "DUMP":
        return { reply: { status: 0, body: new XdrWriter().bool(false), fidelity: native }, event: "DUMP" };
      case "UMNT":
        r.string(1024);
        return { reply: { status: 0, body: new XdrWriter(), fidelity: native }, event: "UMNT" };
      case "UMNTALL":
        return { reply: { status: 0, body: new XdrWriter(), fidelity: native }, event: "UMNTALL" };
      case "EXPORT":
        return { reply: { status: 0, body: new XdrWriter().bool(true).string(root).bool(false).bool(false), path: root, fidelity: native }, event: "EXPORT" };
    }
  };

  const tell = (e: NfsEvent): void => options.onEvent?.(e);

  return {
    boot,
    dropped: () => dropped,
    async flushAll() {
      const failures: string[] = [];
      for (const p of [...buffers.keys()]) {
        const e = await flush(p);
        if (e !== undefined) failures.push(`${p}: ${e.errno}`);
      }
      return failures;
    },
    async handle(call) {
      try {
        if (call.prog !== NFS_PROGRAM && call.prog !== MOUNT_PROGRAM) return failed(call.xid, ACCEPT.PROG_UNAVAIL);
        const version = call.prog === NFS_PROGRAM ? NFS_VERSION : MOUNT_VERSION;
        if (call.vers !== version) return progMismatch(call.xid, version, version);
        const r = new XdrReader(call.args);
        const uid = call.cred.uid;
        if (call.prog === MOUNT_PROGRAM) {
          const proc = MOUNT_PROCEDURES[call.proc];
          if (proc === undefined) return failed(call.xid, ACCEPT.PROC_UNAVAIL);
          const out = await mountProcedure(proc, r, call);
          if (out === undefined) return accepted(call.xid);
          tell({ proc: out.event, ...(out.reply.path === undefined ? {} : { path: out.reply.path }), status: out.reply.status, fidelity: out.reply.fidelity, ...(uid === undefined ? {} : { uid }) });
          return accepted(call.xid, out.reply.body.bytes());
        }
        const proc = NFS_PROCEDURES[call.proc];
        if (proc === undefined) return failed(call.xid, ACCEPT.PROC_UNAVAIL);
        if (proc !== "NULL" && !allowed(call)) {
          const status = NFS_STATUS.ACCES;
          tell({ proc, status, fidelity: refusedBy("read-only", "the caller is not one that may ask"), ...(uid === undefined ? {} : { uid }) });
          return accepted(call.xid, new XdrWriter().u32(status).bool(false).bool(false).bool(false).bool(false).bytes());
        }
        const reply = await nfs[proc](r, call);
        tell({ proc, ...(reply.path === undefined ? {} : { path: reply.path }), status: reply.status, fidelity: reply.fidelity, ...(uid === undefined ? {} : { uid }), ...(reply.note === undefined ? {} : { note: reply.note }) });
        return accepted(call.xid, reply.body.bytes());
      } catch (e) {
        if (e instanceof XdrError) return failed(call.xid, ACCEPT.GARBAGE_ARGS);
        return failed(call.xid, ACCEPT.SYSTEM_ERR);
      }
    },
  };
}

