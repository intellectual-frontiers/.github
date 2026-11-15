/**
 * Archives in memory, with no outside package (commons 0005-typescript-runtime FR-010). Writing: a POSIX ustar archive, a gzip stream of
 * stored deflate blocks and a zip of stored entries, each entry with a fixed time and mode and in the byte order of its path, so the bytes
 * depend on the files alone (taken from erga's `lib/ts/archive`). Reading: a tar (ustar, pax and GNU long names), a gzip and a zip whose
 * entries are stored or deflated (through the web standard `DecompressionStream`), each checked (header checksums, CRC-32) and every path
 * refused that would leave the folder it is unpacked into. This is what lets Stolos drop `fflate` and unpack a verified copy of its engine.
 *
 * @example
 * ```ts
 * import { tar, untar, zip, unzip } from "./archive.ts";
 * const files = new Map([["a/b.txt", new TextEncoder().encode("hello")]]);
 * const z = zip(files);
 * const back = await unzip(z); // { kind: "ok", value: Map { "a/b.txt" => Uint8Array [104, 101, 108, 108, 111] } }
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "./result.ts";

/** The files of an archive, by their path inside it. */
export type Files = ReadonlyMap<string, Uint8Array>;

/** Why an archive could not be read or written. */
export type ArchiveError =
  | { readonly kind: "damaged"; readonly message: string }
  | { readonly kind: "unsupported"; readonly message: string }
  | { readonly kind: "unsafe-path"; readonly path: string }
  | { readonly kind: "too-long"; readonly path: string };

/** An archive error as one sentence. */
export function formatArchiveError(e: ArchiveError): string {
  switch (e.kind) {
    case "damaged":
      return `the archive is damaged: ${e.message}`;
    case "unsupported":
      return `the archive uses what is not supported: ${e.message}`;
    case "unsafe-path":
      return `the archive holds a path that would leave its folder: ${JSON.stringify(e.path)}`;
    case "too-long":
      return `the path is too long for a ustar header: ${JSON.stringify(e.path)}`;
  }
}

const damaged = (message: string): Result<never, ArchiveError> => err({ kind: "damaged", message });
const unsupported = (message: string): Result<never, ArchiveError> => err({ kind: "unsupported", message });

const CRC_TABLE: readonly number[] = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** The CRC-32 (ISO 3309) that gzip and zip both carry. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = ((CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Whether a path inside an archive stays inside the folder it is unpacked into: relative, with `/` between its parts, no part `..`, no
 * empty part but a trailing one, no backslash, no drive letter and no NUL.
 */
export function isSafePath(path: string): boolean {
  if (path === "" || path.startsWith("/") || path.includes("\\") || path.includes("\0") || /^[A-Za-z]:/.test(path)) return false;
  const parts = path.replace(/\/$/, "").split("/");
  return parts.every((p) => p !== "" && p !== ".." && p !== ".");
}

/** The paths of the files in the byte order of their UTF-8, the order every writer here uses. */
export function sortedPaths(paths: Iterable<string>): readonly string[] {
  const enc = new TextEncoder();
  return [...paths].sort((a, b) => {
    const x = enc.encode(a);
    const y = enc.encode(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const d = (x[i] ?? 0) - (y[i] ?? 0);
      if (d !== 0) return d;
    }
    return x.length - y.length;
  });
}

class Bytes {
  #parts: Uint8Array[] = [];
  length = 0;
  push(b: Uint8Array): void {
    this.#parts.push(b);
    this.length += b.length;
  }
  u16(n: number): void {
    this.push(new Uint8Array([n & 0xff, (n >>> 8) & 0xff]));
  }
  u32(n: number): void {
    this.push(new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]));
  }
  done(): Uint8Array {
    return concat(this.#parts);
  }
}

/** Byte arrays joined end to end. */
export function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function octal(h: Uint8Array, at: number, width: number, value: number): void {
  const digits = width - 1;
  const text = value.toString(8).padStart(digits, "0").slice(-digits);
  h.set(new TextEncoder().encode(text), at);
  h[at + digits] = 0;
}

/** A path too long for the 100 bytes of a ustar name, split into its prefix (up to 155 bytes) and name; undefined where it cannot be. */
export function splitName(path: string): readonly [string, string] | undefined {
  const bytes = (s: string): number => new TextEncoder().encode(s).length;
  if (bytes(path) <= 100) return ["", path];
  let cut: number | undefined;
  for (let i = 0; i < path.length; i++) if (path[i] === "/" && bytes(path.slice(0, i)) <= 155 && bytes(path.slice(i + 1)) <= 100) cut = i;
  return cut === undefined ? undefined : [path.slice(0, cut), path.slice(cut + 1)];
}

/** One ustar header block of a file (mode 0644) or a folder (0755), owned by user 0, dated 0; undefined where the path does not fit. */
export function tarHeader(path: string, size: number, dir: boolean): Uint8Array | undefined {
  const split = splitName(path);
  if (split === undefined) return undefined;
  const enc = new TextEncoder();
  const h = new Uint8Array(512);
  h.set(enc.encode(split[1]), 0);
  octal(h, 100, 8, dir ? 0o755 : 0o644);
  octal(h, 108, 8, 0);
  octal(h, 116, 8, 0);
  octal(h, 124, 12, size);
  octal(h, 136, 12, 0);
  h.set(enc.encode("        "), 148);
  h[156] = dir ? 0x35 : 0x30;
  h.set(enc.encode("ustar\0"), 257);
  h.set(enc.encode("00"), 263);
  h.set(enc.encode(split[0]), 345);
  const sum = h.reduce((s, b) => s + b, 0);
  h.set(enc.encode(`${sum.toString(8).padStart(6, "0")}\0 `), 148);
  return h;
}

/** A ustar archive of the files, each folder they lie in first given its own entry; or the path that does not fit or is not safe. */
export function tar(files: Files): Result<Uint8Array, ArchiveError> {
  const dirs = new Set<string>();
  for (const path of files.keys()) {
    if (!isSafePath(path)) return err({ kind: "unsafe-path", path });
    for (let i = path.indexOf("/"); i >= 0; i = path.indexOf("/", i + 1)) dirs.add(`${path.slice(0, i)}/`);
  }
  const out = new Bytes();
  for (const d of sortedPaths(dirs)) {
    const h = tarHeader(d, 0, true);
    if (h === undefined) return err({ kind: "too-long", path: d });
    out.push(h);
  }
  for (const path of sortedPaths(files.keys())) {
    const data = files.get(path) ?? new Uint8Array();
    const h = tarHeader(path, data.length, false);
    if (h === undefined) return err({ kind: "too-long", path });
    out.push(h);
    out.push(data);
    out.push(new Uint8Array((512 - (data.length % 512)) % 512));
  }
  out.push(new Uint8Array(1024));
  return ok(out.done());
}

/** A gzip stream (RFC 1952) of the bytes in stored deflate blocks (RFC 1951 §3.2.4), with no name and no time: the same bytes every time. */
export function gzip(data: Uint8Array): Uint8Array {
  const out = new Bytes();
  out.push(new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff]));
  if (data.length === 0) out.push(new Uint8Array([1, 0, 0, 0xff, 0xff]));
  for (let at = 0; at < data.length; at += 0xffff) {
    const chunk = data.subarray(at, Math.min(at + 0xffff, data.length));
    out.push(new Uint8Array([at + 0xffff >= data.length ? 1 : 0]));
    out.u16(chunk.length);
    out.u16(~chunk.length & 0xffff);
    out.push(chunk);
  }
  out.u32(crc32(data));
  out.u32(data.length >>> 0);
  return out.done();
}

/** A date as a zip writes it (MS-DOS): `(year - 1980) << 9 | month << 5 | day`. */
export function dosDate(year: number, month: number, day: number): number {
  return ((year - 1980) << 9) | (month << 5) | day;
}

/** The zip's fixed date: 1980-01-01, the first a zip can hold. */
export const ZIP_EPOCH: number = dosDate(1980, 1, 1);

/** A zip (APPNOTE 6.3) of the files, each stored, dated `date` (1980-01-01 unless another is given) at midnight and readable by everyone. */
export function zip(files: Files, date: number = ZIP_EPOCH): Uint8Array {
  const out = new Bytes();
  const central = new Bytes();
  const enc = new TextEncoder();
  const paths = sortedPaths(files.keys());
  for (const path of paths) {
    const data = files.get(path) ?? new Uint8Array();
    const offset = out.length;
    const crc = crc32(data);
    const name = enc.encode(path);
    const common = (v: Bytes): void => {
      v.u16(20);
      v.u16(0x0800);
      v.u16(0);
      v.u16(0);
      v.u16(date);
      v.u32(crc);
      v.u32(data.length);
      v.u32(data.length);
      v.u16(name.length);
      v.u16(0);
    };
    out.u32(0x04034b50);
    common(out);
    out.push(name);
    out.push(data);
    central.u32(0x02014b50);
    central.u16((3 << 8) | 20);
    common(central);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u32((0o100644 << 16) >>> 0);
    central.u32(offset);
    central.push(name);
  }
  const start = out.length;
  const size = central.length;
  out.push(central.done());
  out.u32(0x06054b50);
  out.u16(0);
  out.u16(0);
  out.u16(paths.length);
  out.u16(paths.length);
  out.u32(size);
  out.u32(start);
  out.u16(0);
  return out.done();
}

/** The bytes a web `DecompressionStream` gives for the input, or the error it raised. */
async function decompress(format: "gzip" | "deflate-raw", data: Uint8Array): Promise<Result<Uint8Array, ArchiveError>> {
  try {
    const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream(format));
    const reader = stream.getReader();
    const parts: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    return ok(concat(parts));
  } catch (e) {
    return damaged(`${format}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The bytes of a gzip stream, stored or deflated, its CRC checked by the decompressor. */
export function gunzip(data: Uint8Array): Promise<Result<Uint8Array, ArchiveError>> {
  if (data.length < 18 || data[0] !== 0x1f || data[1] !== 0x8b) return Promise.resolve(damaged("it does not begin as a gzip stream"));
  return decompress("gzip", data);
}

/** One entry of a tar archive. A folder's path has no trailing `/`; a link's target is in `linkName`. */
export type TarEntry = {
  readonly path: string;
  readonly kind: "file" | "directory" | "symlink" | "hardlink";
  readonly mode: number;
  readonly data: Uint8Array;
  readonly linkName: string;
};

const cstring = (b: Uint8Array): string => {
  const end = b.indexOf(0);
  return new TextDecoder().decode(end < 0 ? b : b.subarray(0, end));
};

function readNumber(field: Uint8Array): number | undefined {
  if (((field[0] ?? 0) & 0x80) !== 0) {
    let n = 0;
    for (let i = 1; i < field.length; i++) n = n * 256 + (field[i] ?? 0);
    return Number.isSafeInteger(n) ? n : undefined;
  }
  const text = cstring(field).trim();
  if (text === "") return 0;
  return /^[0-7]+$/.test(text) ? Number.parseInt(text, 8) : undefined;
}

function paxRecords(data: Uint8Array): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const text = new TextDecoder().decode(data);
  let at = 0;
  while (at < text.length) {
    const space = text.indexOf(" ", at);
    const length = Number.parseInt(text.slice(at, space), 10);
    if (space < 0 || !Number.isInteger(length) || length <= 0) break;
    const record = text.slice(space + 1, at + length - 1);
    const eq = record.indexOf("=");
    if (eq > 0) out.set(record.slice(0, eq), record.slice(eq + 1));
    at += length;
  }
  return out;
}

/** The entries of a tar archive (ustar, with pax extended headers and GNU long names), each header's checksum checked and each path checked safe. */
export function untar(data: Uint8Array): Result<readonly TarEntry[], ArchiveError> {
  const entries: TarEntry[] = [];
  let at = 0;
  let longName: string | undefined;
  let longLink: string | undefined;
  let pax: ReadonlyMap<string, string> = new Map();
  while (at + 512 <= data.length) {
    const h = data.subarray(at, at + 512);
    if (h.every((b) => b === 0)) return ok(entries);
    const stored = readNumber(h.subarray(148, 156));
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : (h[i] ?? 0);
    if (stored !== sum) return damaged(`the header at byte ${at} has a wrong checksum`);
    const size = readNumber(h.subarray(124, 136));
    const mode = readNumber(h.subarray(100, 108));
    if (size === undefined || mode === undefined) return damaged(`the header at byte ${at} has a field that is not a number`);
    const type = String.fromCharCode(h[156] ?? 0);
    const bodyAt = at + 512;
    const paxSize = pax.get("size");
    const length = paxSize === undefined ? size : Number.parseInt(paxSize, 10);
    if (bodyAt + length > data.length) return damaged(`the entry at byte ${at} runs past the end`);
    const body = data.subarray(bodyAt, bodyAt + length);
    at = bodyAt + Math.ceil(length / 512) * 512;
    switch (type) {
      case "x":
        pax = paxRecords(body);
        continue;
      case "g":
        continue;
      case "L":
        longName = cstring(body);
        continue;
      case "K":
        longLink = cstring(body);
        continue;
    }
    const isUstar = cstring(h.subarray(257, 263)).startsWith("ustar");
    const prefix = isUstar ? cstring(h.subarray(345, 500)) : "";
    const name = pax.get("path") ?? longName ?? (prefix === "" ? cstring(h.subarray(0, 100)) : `${prefix}/${cstring(h.subarray(0, 100))}`);
    const linkName = pax.get("linkpath") ?? longLink ?? cstring(h.subarray(157, 257));
    pax = new Map();
    longName = undefined;
    longLink = undefined;
    const path = name.replace(/^\.\//, "").replace(/\/$/, "");
    if (path === "" || path === ".") continue;
    if (!isSafePath(path)) return err({ kind: "unsafe-path", path: name });
    let kind: TarEntry["kind"];
    switch (type) {
      case "0":
      case "\0":
      case "7":
        kind = name.endsWith("/") ? "directory" : "file";
        break;
      case "5":
        kind = "directory";
        break;
      case "2":
        kind = "symlink";
        break;
      case "1":
        kind = "hardlink";
        break;
      default:
        return unsupported(`the entry ${JSON.stringify(path)} has type ${JSON.stringify(type)}`);
    }
    entries.push({ path, kind, mode, data: kind === "file" ? body : new Uint8Array(), linkName });
  }
  return damaged("it ends without the two zero blocks of a tar archive");
}

/** The files of a list of tar entries, by path: folders and links left out. */
export function filesOf(entries: readonly TarEntry[]): Files {
  return new Map(entries.filter((e) => e.kind === "file").map((e) => [e.path, e.data]));
}

/** One entry of a zip's central directory. */
export type ZipEntry = {
  readonly name: string;
  readonly method: number;
  readonly crc: number;
  readonly compressed: number;
  readonly size: number;
  readonly offset: number;
};

/** The entries of a zip, from its central directory; or why they cannot be read (a ZIP64 archive among the reasons). */
export function zipEntries(data: Uint8Array): Result<readonly ZipEntry[], ArchiveError> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return damaged("it has no zip directory at its end");
  const count = view.getUint16(end + 10, true);
  const length = view.getUint32(end + 12, true);
  const offset = view.getUint32(end + 16, true);
  if (offset === 0xffffffff || count === 0xffff) return unsupported("it is a ZIP64 archive");
  if (offset + length > data.length) return damaged("its directory runs past the end");
  const entries: ZipEntry[] = [];
  let at = offset;
  for (let i = 0; i < count; i++) {
    if (at + 46 > data.length || view.getUint32(at, true) !== 0x02014b50) return damaged("its directory is damaged");
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    entries.push({
      name: new TextDecoder().decode(data.subarray(at + 46, at + 46 + nameLength)),
      method: view.getUint16(at + 10, true),
      crc: view.getUint32(at + 16, true),
      compressed: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      offset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return ok(entries);
}

/** The bytes of one entry of a zip, stored (method 0) or deflated (method 8), its size and CRC-32 checked. */
export async function zipRead(data: Uint8Array, e: ZipEntry): Promise<Result<Uint8Array, ArchiveError>> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (e.offset + 30 > data.length || view.getUint32(e.offset, true) !== 0x04034b50) return damaged(`the entry ${JSON.stringify(e.name)} has no local header`);
  const start = e.offset + 30 + view.getUint16(e.offset + 26, true) + view.getUint16(e.offset + 28, true);
  if (start + e.compressed > data.length) return damaged(`the entry ${JSON.stringify(e.name)} runs past the end`);
  const raw = data.subarray(start, start + e.compressed);
  let bytes: Uint8Array;
  if (e.method === 0) bytes = raw;
  else if (e.method === 8) {
    const r = await decompress("deflate-raw", raw);
    if (r.kind === "err") return r;
    bytes = r.value;
  } else return unsupported(`the entry ${JSON.stringify(e.name)} uses compression method ${e.method}`);
  if (bytes.length !== e.size || crc32(bytes) !== e.crc) return damaged(`the entry ${JSON.stringify(e.name)} does not match its size and CRC-32`);
  return ok(bytes);
}

/** Every file of a zip by its path, folders left out, each read and checked, and every path checked safe. */
export async function unzip(data: Uint8Array): Promise<Result<Files, ArchiveError>> {
  const entries = zipEntries(data);
  if (entries.kind === "err") return entries;
  const out = new Map<string, Uint8Array>();
  for (const e of entries.value) {
    if (!isSafePath(e.name)) return err({ kind: "unsafe-path", path: e.name });
    if (e.name.endsWith("/")) continue;
    const r = await zipRead(data, e);
    if (r.kind === "err") return r;
    out.set(e.name, r.value);
  }
  return ok(out);
}
