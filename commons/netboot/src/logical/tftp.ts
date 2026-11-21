// Spec: 0003-netboot-logical FR-004
/**
 * The packets of TFTP (RFC 1350) with the options of RFC 2347 to 2349 (`blksize`, `tsize`, `timeout`), as bytes: a read request is parsed, and the data, acknowledgement, option acknowledgement and error packets are made. Block numbers are 16 bits and roll over past 65535
 * (Ubuntu's initrd is about 100 MB). Pure.
 *
 * @example
 * ```ts
 * import { dataPacket, parseRequest } from "./tftp.ts";
 * dataPacket(1, new Uint8Array([1, 2]))[1]; // 3
 * ```
 *
 * @module
 */

/** The opcodes. */
export const OP = { RRQ: 1, WRQ: 2, DATA: 3, ACK: 4, ERROR: 5, OACK: 6 } as const;

/** The error codes this server gives. */
export const ERR = { NOT_FOUND: 1, ACCESS: 2, ILLEGAL: 4, OPTION: 8 } as const;

const enc = new TextEncoder();

/** A read request, or why the packet is not one. */
export type ReadRequest = { readonly file: string; readonly mode: string; readonly options: Readonly<Record<string, string>> };

/** Parses a request packet: the opcode and the NUL-separated strings. */
export function parseRequest(p: Uint8Array): { readonly op: number; readonly request?: ReadRequest } {
  if (p.length < 4) return { op: -1 };
  const op = (p[0] ?? 0) * 256 + (p[1] ?? 0);
  if (op !== OP.RRQ && op !== OP.WRQ) return { op };
  const parts = new TextDecoder().decode(p.subarray(2)).split("\0");
  if (parts.length < 3) return { op };
  const [file = "", mode = "", ...rest] = parts;
  const options: Record<string, string> = {};
  for (let i = 0; i + 1 < rest.length; i += 2) options[(rest[i] ?? "").toLowerCase()] = rest[i + 1] ?? "";
  return { op, request: { file, mode: mode.toLowerCase(), options } };
}

/** A data packet: the block number (taken modulo 65536) and its bytes. */
export function dataPacket(block: number, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + data.length);
  out[1] = OP.DATA;
  out[2] = (block >> 8) & 0xff;
  out[3] = block & 0xff;
  out.set(data, 4);
  return out;
}

/** An acknowledgement packet. */
export function ackPacket(block: number): Uint8Array {
  return new Uint8Array([0, OP.ACK, (block >> 8) & 0xff, block & 0xff]);
}

/** An error packet. */
export function errorPacket(code: number, message: string): Uint8Array {
  const m = enc.encode(`${message}\0`);
  const out = new Uint8Array(4 + m.length);
  out[1] = OP.ERROR;
  out[3] = code;
  out.set(m, 4);
  return out;
}

/** An option acknowledgement. */
export function oackPacket(options: Readonly<Record<string, string>>): Uint8Array {
  const body = enc.encode(Object.entries(options).map(([k, v]) => `${k}\0${v}\0`).join(""));
  const out = new Uint8Array(2 + body.length);
  out[1] = OP.OACK;
  out.set(body, 2);
  return out;
}

/** The options this server agrees to, from those asked for: a block size from 8 to 65464 (and at most `maxBlock`), the size of the file where it is asked, and a timeout from 1 to 255 seconds. */
export function agreedOptions(asked: Readonly<Record<string, string>>, size: number, maxBlock = 1468): { readonly blksize: number; readonly timeoutMs: number; readonly oack: Readonly<Record<string, string>> } {
  let blksize = 512;
  let timeoutMs = 1000;
  const oack: Record<string, string> = {};
  const b = Number(asked["blksize"]);
  if (asked["blksize"] !== undefined && Number.isInteger(b) && b >= 8) {
    blksize = Math.min(b, maxBlock, 65464);
    oack["blksize"] = String(blksize);
  }
  if (asked["tsize"] !== undefined) oack["tsize"] = String(size);
  const t = Number(asked["timeout"]);
  if (asked["timeout"] !== undefined && Number.isInteger(t) && t >= 1 && t <= 255) {
    timeoutMs = t * 1000;
    oack["timeout"] = String(t);
  }
  return { blksize, timeoutMs, oack };
}

/** The path a request names, as a path of the served tree: leading slashes dropped, and refused (undefined) where it climbs out of it or holds a NUL. */
export function servedPath(file: string): string | undefined {
  if (file.includes("\0") || file.includes("\\")) return undefined;
  const parts = file.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.some((p) => p === "..")) return undefined;
  return `/${parts.join("/")}`;
}
