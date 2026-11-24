// Spec: 0006-anyfs-serve-nfs FR-002
/**
 * ONC RPC version 2 (RFC 5531) over TCP, as far as a server of NFS needs it: the record marking that frames messages on a stream (a record is one or more fragments, the last marked), a call read from a record with its
 * credential (`AUTH_NONE` or `AUTH_SYS` with the uid and gid), and the replies a server gives: accepted with a result, accepted with the failure it names (`PROG_UNAVAIL`, `PROG_MISMATCH`, `PROC_UNAVAIL`, `GARBAGE_ARGS`,
 * `SYSTEM_ERR`) and denied (`RPC_MISMATCH`, an authentication error). Pure: bytes in, bytes out.
 *
 * @example
 * ```ts
 * import { frame, RecordReader } from "./rpc.ts";
 * const reader = new RecordReader(1024);
 * const records = reader.push(frame(new Uint8Array([1, 2, 3, 4])));
 * records.kind === "ok" && records.value.length; // 1
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { decode, XdrReader, XdrWriter } from "./xdr.ts";

/** The authentication flavors the server reads. */
export const AUTH = { NONE: 0, SYS: 1 } as const;

/** Who a call says it is: nothing, or a uid and a gid of the caller's computer. */
export type Cred = { readonly flavor: number; readonly uid?: number; readonly gid?: number; readonly machine?: string };

/** A call, read from a record. */
export type RpcCall = {
  readonly xid: number;
  readonly prog: number;
  readonly vers: number;
  readonly proc: number;
  readonly cred: Cred;
  /** The bytes of the arguments of the procedure. */
  readonly args: Uint8Array;
};

/** What a record was: a call, or what to answer (or nothing) where it was not one the server can serve. */
export type Parsed = { readonly kind: "call"; readonly call: RpcCall } | { readonly kind: "reply"; readonly reply: Uint8Array } | { readonly kind: "drop" };

/** The accept statuses of a reply. */
export const ACCEPT = { SUCCESS: 0, PROG_UNAVAIL: 1, PROG_MISMATCH: 2, PROC_UNAVAIL: 3, GARBAGE_ARGS: 4, SYSTEM_ERR: 5 } as const;

/** The reasons of an authentication error. */
export const AUTH_STAT = { BADCRED: 1, REJECTEDCRED: 2, BADVERF: 3, REJECTEDVERF: 4, TOOWEAK: 5 } as const;

const header = (xid: number): XdrWriter => new XdrWriter().u32(xid).u32(1);

/** An accepted reply with a result: `result` is the XDR of what the procedure returns. */
export function accepted(xid: number, result: Uint8Array = new Uint8Array()): Uint8Array {
  const w = header(xid).u32(0).u32(AUTH.NONE).u32(0).u32(ACCEPT.SUCCESS);
  const head = w.bytes();
  const out = new Uint8Array(head.length + result.length);
  out.set(head);
  out.set(result, head.length);
  return out;
}

/** An accepted reply that says why there is no result. */
export function failed(xid: number, stat: Exclude<(typeof ACCEPT)[keyof typeof ACCEPT], 0 | 2>): Uint8Array {
  return header(xid).u32(0).u32(AUTH.NONE).u32(0).u32(stat).bytes();
}

/** The reply to a call for a version the server does not have: the versions it has. */
export function progMismatch(xid: number, low: number, high: number): Uint8Array {
  return header(xid).u32(0).u32(AUTH.NONE).u32(0).u32(ACCEPT.PROG_MISMATCH).u32(low).u32(high).bytes();
}

/** The denial of a call of another version of RPC than 2. */
export function rpcMismatch(xid: number): Uint8Array {
  return header(xid).u32(1).u32(0).u32(2).u32(2).bytes();
}

/** The denial of a call whose authentication is refused. */
export function authError(xid: number, stat: (typeof AUTH_STAT)[keyof typeof AUTH_STAT]): Uint8Array {
  return header(xid).u32(1).u32(1).u32(stat).bytes();
}

function credOf(flavor: number, body: Uint8Array): Result<Cred, string> {
  if (flavor !== AUTH.SYS) return ok({ flavor });
  return decode(body, (r) => {
    r.u32();
    const machine = r.string(255);
    const uid = r.u32();
    const gid = r.u32();
    const n = r.u32();
    if (n > 16) throw new Error("too many groups");
    return { flavor, uid, gid, machine } satisfies Cred;
  });
}

/** Reads a record as a call, or says what to do with it. */
export function parseCall(record: Uint8Array): Parsed {
  const r = new XdrReader(record);
  let xid: number;
  try {
    xid = r.u32();
    if (r.u32() !== 0) return { kind: "drop" };
  } catch {
    return { kind: "drop" };
  }
  const read = decode(record, (x) => {
    x.u32();
    x.u32();
    const rpcvers = x.u32();
    if (rpcvers !== 2) return { rpcvers, prog: 0, vers: 0, proc: 0, flavor: 0, body: new Uint8Array(), args: new Uint8Array() };
    const prog = x.u32();
    const vers = x.u32();
    const proc = x.u32();
    const flavor = x.u32();
    const body = x.opaque(400);
    x.u32();
    x.opaque(400);
    return { rpcvers, prog, vers, proc, flavor, body, args: x.rest() };
  });
  if (read.kind === "err") return { kind: "reply", reply: failed(xid, ACCEPT.GARBAGE_ARGS) };
  const c = read.value;
  if (c.rpcvers !== 2) return { kind: "reply", reply: rpcMismatch(xid) };
  const cred = credOf(c.flavor, c.body);
  if (cred.kind === "err") return { kind: "reply", reply: authError(xid, AUTH_STAT.BADCRED) };
  return { kind: "call", call: { xid, prog: c.prog, vers: c.vers, proc: c.proc, cred: cred.value, args: c.args } };
}

/** A record of one fragment, for sending. */
export function frame(record: Uint8Array): Uint8Array {
  const out = new Uint8Array(record.length + 4);
  new DataView(out.buffer).setUint32(0, (0x80000000 | record.length) >>> 0);
  out.set(record, 4);
  return out;
}

/** Joins what arrives on a stream into records: fragments are joined, a record longer than the limit is refused. */
export class RecordReader {
  readonly #max: number;
  #pending = new Uint8Array(0);
  #fragments: Uint8Array[] = [];
  #size = 0;

  constructor(maxRecord: number) {
    this.#max = maxRecord;
  }

  /** Takes bytes; gives the records they complete, or the reason the stream is not one a server can read. */
  push(chunk: Uint8Array): Result<readonly Uint8Array[], string> {
    const joined = new Uint8Array(this.#pending.length + chunk.length);
    joined.set(this.#pending);
    joined.set(chunk, this.#pending.length);
    let at = 0;
    const out: Uint8Array[] = [];
    for (;;) {
      if (joined.length - at < 4) break;
      const head = new DataView(joined.buffer, joined.byteOffset + at, 4).getUint32(0);
      const last = (head & 0x80000000) !== 0;
      const length = head & 0x7fffffff;
      if (this.#size + length > this.#max) return err(`a record is longer than the ${this.#max} bytes this takes`);
      if (joined.length - at - 4 < length) break;
      this.#fragments.push(joined.slice(at + 4, at + 4 + length));
      this.#size += length;
      at += 4 + length;
      if (last) {
        const record = new Uint8Array(this.#size);
        let o = 0;
        for (const f of this.#fragments) {
          record.set(f, o);
          o += f.length;
        }
        out.push(record);
        this.#fragments = [];
        this.#size = 0;
      }
    }
    this.#pending = joined.slice(at);
    return ok(out);
  }
}
