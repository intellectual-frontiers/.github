// Spec: 0001-formats FR-010, FR-023
/**
 * Archives in memory, with no outside package (commons 0001-formats FR-010). Writing: a POSIX ustar archive, a gzip stream of
 * stored deflate blocks and a zip of stored entries (`zip`), each entry with a fixed time and mode and in the byte order of its path, so the
 * bytes depend on the files alone (taken from erga's `lib/ts/archive`); and, where size matters more than the same bytes on every runtime,
 * a zip of deflated entries (`zipDeflated`, through the web standard `CompressionStream`), the same bytes for the same files on one runtime
 * and the same files unzipped on every runtime. Reading: a tar (ustar, pax and GNU long names), a gzip and a zip whose
 * entries are stored or deflated (through the web standard `DecompressionStream`), each checked (header checksums, CRC-32) and every path
 * refused that would leave the folder it is unpacked into. This is what lets Stolos drop `fflate` and unpack a verified copy of its engine.
 * A tar, gzipped or not, is also read as a stream (`untarStream`, `readTarStream`), an entry at a time with each entry's bytes a stream of
 * their own, with the same checks, so that an archive larger than memory can be read (FR-059).
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
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";

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
    default:
      return absurd(e);
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

/** One entry as a zip writer lays it out: its path, CRC-32 and size, and its bytes as written (stored, or deflated). */
type ZipItem = {
  readonly path: string;
  readonly crc: number;
  readonly size: number;
  readonly method: 0 | 8;
  readonly body: Uint8Array;
};

/** A zip of the entries, in their order, each dated `date` at midnight and readable by everyone. */
function zipOf(items: readonly ZipItem[], date: number): Uint8Array {
  const out = new Bytes();
  const central = new Bytes();
  const enc = new TextEncoder();
  for (const item of items) {
    const offset = out.length;
    const name = enc.encode(item.path);
    const common = (v: Bytes): void => {
      v.u16(20);
      v.u16(0x0800);
      v.u16(item.method);
      v.u16(0);
      v.u16(date);
      v.u32(item.crc);
      v.u32(item.body.length);
      v.u32(item.size);
      v.u16(name.length);
      v.u16(0);
    };
    out.u32(0x04034b50);
    common(out);
    out.push(name);
    out.push(item.body);
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
  out.u16(items.length);
  out.u16(items.length);
  out.u32(size);
  out.u32(start);
  out.u16(0);
  return out.done();
}

/** A zip (APPNOTE 6.3) of the files, each stored, dated `date` (1980-01-01 unless another is given) at midnight and readable by everyone. */
export function zip(files: Files, date: number = ZIP_EPOCH): Uint8Array {
  return zipOf(
    sortedPaths(files.keys()).map((path) => {
      const data = files.get(path) ?? new Uint8Array();
      return { path, crc: crc32(data), size: data.length, method: 0, body: data };
    }),
    date,
  );
}

/**
 * A zip (APPNOTE 6.3) of the files as `zip` lays them out, but each entry deflated (method 8) through the web standard
 * `CompressionStream("deflate-raw")`, or stored where deflating would not make it smaller (an empty or incompressible file). The bytes
 * depend on the files alone on one runtime; another runtime's deflater may choose other (equally valid) bytes, so only what they unzip to
 * is the same everywhere.
 */
export async function zipDeflated(files: Files, date: number = ZIP_EPOCH): Promise<Uint8Array> {
  const items: ZipItem[] = [];
  for (const path of sortedPaths(files.keys())) {
    const data = files.get(path) ?? new Uint8Array();
    const packed = await deflateRaw(data);
    items.push(
      packed.length < data.length
        ? { path, crc: crc32(data), size: data.length, method: 8, body: packed }
        : { path, crc: crc32(data), size: data.length, method: 0, body: data },
    );
  }
  return zipOf(items, date);
}

/** The raw deflate stream (RFC 1951) a web `CompressionStream` gives for the bytes. */
export async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  return drain(new Blob([new Uint8Array(data)]).stream().pipeThrough(new CompressionStream("deflate-raw")));
}

/** Every chunk of a stream of bytes, joined. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  return concat(parts);
}

/** The bytes a web `DecompressionStream` gives for the input, or the error it raised. */
async function decompress(format: "gzip" | "deflate-raw", data: Uint8Array): Promise<Result<Uint8Array, ArchiveError>> {
  try {
    return ok(await drain(new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream(format))));
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

/** The fields of one tar header block, its checksum checked: what an entry's header says before pax and GNU long names apply. */
type RawHeader = {
  readonly block: Uint8Array;
  readonly size: number;
  readonly mode: number;
  readonly mtime: number;
  readonly type: string;
};

/** Whether a block of 512 bytes is all zeros, the end of a tar archive. */
const isZeroBlock = (h: Uint8Array): boolean => h.every((b) => b === 0);

/** The 512 bytes of a body of `n` bytes, padded to a whole number of blocks. */
const padded = (n: number): number => Math.ceil(n / 512) * 512;

/** The fields of the header block at byte `at`, or why it is damaged (a wrong checksum, a field that is not a number). */
function readHeader(h: Uint8Array, at: number): Result<RawHeader, ArchiveError> {
  const stored = readNumber(h.subarray(148, 156));
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : (h[i] ?? 0);
  if (stored !== sum) return damaged(`the header at byte ${at} has a wrong checksum`);
  const size = readNumber(h.subarray(124, 136));
  const mode = readNumber(h.subarray(100, 108));
  const mtime = readNumber(h.subarray(136, 148));
  if (size === undefined || mode === undefined || mtime === undefined)
    return damaged(`the header at byte ${at} has a field that is not a number`);
  return ok({ block: h, size, mode, mtime, type: String.fromCharCode(h[156] ?? 0) });
}

/** What pax extended headers and GNU long names and links say of the entry after them. */
type Pending = { readonly pax: ReadonlyMap<string, string>; readonly longName: string | undefined; readonly longLink: string | undefined };

const NO_PENDING: Pending = { pax: new Map(), longName: undefined, longLink: undefined };

/** The length of the body after a header, a pax `size` before it taking the place of the header's. */
function bodyLength(raw: RawHeader, pending: Pending, at: number): Result<number, ArchiveError> {
  const paxSize = pending.pax.get("size");
  if (paxSize === undefined) return ok(raw.size);
  const n = /^[0-9]+$/.test(paxSize) ? Number.parseInt(paxSize, 10) : Number.NaN;
  return Number.isSafeInteger(n) ? ok(n) : damaged(`the pax size before byte ${at} is not a number`);
}

/** Whether a header's type is one that only says something of the entry after it (pax `x` and `g`, GNU `L` and `K`). */
const isMetaType = (type: string): boolean => type === "x" || type === "g" || type === "L" || type === "K";

/** What is pending after a header of a meta type (see `isMetaType`) with its body. */
function pendingAfter(type: string, body: Uint8Array, pending: Pending): Pending {
  switch (type) {
    case "x":
      return { ...pending, pax: paxRecords(body) };
    case "L":
      return { ...pending, longName: cstring(body) };
    case "K":
      return { ...pending, longLink: cstring(body) };
    default:
      return pending;
  }
}

/** The header of one entry of a tar archive: its path (a folder's with no trailing `/`), kind, mode, size of body, time and link target. */
export type TarHeader = {
  readonly path: string;
  readonly kind: TarEntry["kind"];
  readonly mode: number;
  readonly size: number;
  /** Seconds since 1970, as the header (or a pax `mtime`) gives them. */
  readonly mtime: number;
  readonly linkName: string;
};

/** The entry a header names, after what pending headers said; undefined for the archive's own folder (`.`); or why it is refused. */
function entryHeader(raw: RawHeader, pending: Pending, size: number): Result<TarHeader | undefined, ArchiveError> {
  const h = raw.block;
  const isUstar = cstring(h.subarray(257, 263)).startsWith("ustar");
  const prefix = isUstar ? cstring(h.subarray(345, 500)) : "";
  const name =
    pending.pax.get("path") ??
    pending.longName ??
    (prefix === "" ? cstring(h.subarray(0, 100)) : `${prefix}/${cstring(h.subarray(0, 100))}`);
  const linkName = pending.pax.get("linkpath") ?? pending.longLink ?? cstring(h.subarray(157, 257));
  const paxTime = Number.parseFloat(pending.pax.get("mtime") ?? "");
  const mtime = Number.isFinite(paxTime) ? paxTime : raw.mtime;
  const path = name.replace(/^\.\//, "").replace(/\/$/, "");
  if (path === "" || path === ".") return ok(undefined);
  if (!isSafePath(path)) return err({ kind: "unsafe-path", path: name });
  let kind: TarEntry["kind"];
  switch (raw.type) {
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
      return unsupported(`the entry ${JSON.stringify(path)} has type ${JSON.stringify(raw.type)}`);
  }
  return ok({ path, kind, mode: raw.mode, size, mtime, linkName });
}

/** The entries of a tar archive (ustar, with pax extended headers and GNU long names), each header's checksum checked and each path checked safe. */
export function untar(data: Uint8Array): Result<readonly TarEntry[], ArchiveError> {
  const entries: TarEntry[] = [];
  let at = 0;
  let pending = NO_PENDING;
  while (at + 512 <= data.length) {
    const h = data.subarray(at, at + 512);
    if (isZeroBlock(h)) return ok(entries);
    const raw = readHeader(h, at);
    if (raw.kind === "err") return raw;
    const length = bodyLength(raw.value, pending, at);
    if (length.kind === "err") return length;
    const bodyAt = at + 512;
    if (bodyAt + length.value > data.length) return damaged(`the entry at byte ${at} runs past the end`);
    const body = data.subarray(bodyAt, bodyAt + length.value);
    at = bodyAt + padded(length.value);
    if (isMetaType(raw.value.type)) {
      pending = pendingAfter(raw.value.type, body, pending);
      continue;
    }
    const e = entryHeader(raw.value, pending, length.value);
    pending = NO_PENDING;
    if (e.kind === "err") return e;
    if (e.value === undefined) continue;
    const { path, kind, mode, linkName } = e.value;
    entries.push({ path, kind, mode, data: kind === "file" ? body : new Uint8Array(), linkName });
  }
  return damaged("it ends without the two zero blocks of a tar archive");
}

/** An archive error raised as an `Error`, which is how a stream reports one: the error itself is in `error`. */
export class ArchiveFailure extends Error {
  /** Why the archive could not be read. */
  readonly error: ArchiveError;
  /** An `Error` for the archive error, its message the error's sentence. */
  constructor(error: ArchiveError) {
    super(formatArchiveError(error));
    this.name = "ArchiveFailure";
    this.error = error;
  }
}

/**
 * One entry of a tar archive read as a stream: its header and its body as a stream (empty but for a file). The body MUST be read to its
 * end or cancelled before the next entry is given, as with `@std/tar`'s `UntarStream`.
 */
export type TarStreamEntry = TarHeader & { readonly readable: ReadableStream<Uint8Array> };

/** The largest body of a pax or GNU long-name header read: such a header names one entry, and a larger one is refused as damaged. */
const MAX_META = 1 << 20;

/** Bytes read from a stream as they are asked for, a chunk at a time, holding no more than one chunk. */
class ByteSource {
  readonly #reader: ReadableStreamDefaultReader<Uint8Array>;
  #chunk: Uint8Array;
  constructor(reader: ReadableStreamDefaultReader<Uint8Array>, first: Uint8Array = new Uint8Array()) {
    this.#reader = reader;
    this.#chunk = first;
  }
  /** At least one byte and at most `max` (more than 0), or undefined at the end. */
  async some(max: number): Promise<Uint8Array | undefined> {
    while (this.#chunk.length === 0) {
      const r = await this.#reader.read();
      if (r.done) return undefined;
      this.#chunk = r.value;
    }
    const out = this.#chunk.subarray(0, max);
    this.#chunk = this.#chunk.subarray(out.length);
    return out;
  }
  /** `n` bytes, or fewer where the stream ends first. */
  async exactly(n: number): Promise<Uint8Array> {
    const parts: Uint8Array[] = [];
    let got = 0;
    while (got < n) {
      const part = await this.some(n - got);
      if (part === undefined) break;
      parts.push(part);
      got += part.length;
    }
    return parts.length === 1 && parts[0] !== undefined ? parts[0] : concat(parts);
  }
  /** Passes over `n` bytes; false where the stream ends first. */
  async skip(n: number): Promise<boolean> {
    for (let left = n; left > 0;) {
      const part = await this.some(left);
      if (part === undefined) return false;
      left -= part.length;
    }
    return true;
  }
  /** Reads to the end, so that a gzip stream's CRC is checked. */
  async drain(): Promise<void> {
    while ((await this.some(Number.MAX_SAFE_INTEGER)) !== undefined);
  }
  cancel(reason: unknown): Promise<void> {
    return this.#reader.cancel(reason);
  }
  /** The rest of the bytes as a stream of their own, this source no longer read. */
  rest(): ReadableStream<Uint8Array> {
    const reader = this.#reader;
    const first = this.#chunk;
    return new ReadableStream<Uint8Array>(
      {
        start(controller) {
          if (first.length > 0) controller.enqueue(first);
        },
        async pull(controller) {
          const r = await reader.read();
          if (r.done) controller.close();
          else controller.enqueue(r.value);
        },
        cancel(reason) {
          return reader.cancel(reason);
        },
      },
      { highWaterMark: 0 },
    );
  }
}

/** The tar bytes of a stream: the stream itself, or what it decompresses to where it begins with gzip's magic bytes `1f 8b`. */
async function tarBytes(stream: ReadableStream<Uint8Array>): Promise<ByteSource> {
  const peek = new ByteSource(stream.getReader());
  const head = await peek.exactly(2);
  const start = new ByteSource(peek.rest().getReader(), head);
  if (head[0] !== 0x1f || head[1] !== 0x8b) return start;
  const raw = start.rest() as ReadableStream<Uint8Array<ArrayBuffer>>; // what DecompressionStream's writable takes; the bytes are the same
  return new ByteSource(raw.pipeThrough(new DecompressionStream("gzip")).getReader());
}

const failure = (e: unknown): ArchiveFailure =>
  e instanceof ArchiveFailure ? e : new ArchiveFailure({ kind: "damaged", message: e instanceof Error ? e.message : String(e) });

const emptyStream = (): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });

/**
 * The entries of a tar archive given as a stream of bytes, gzipped or not (told by its first two bytes), one at a time as they are asked
 * for, so that an archive larger than memory is read with one chunk held (commons 0001-formats FR-011). Every header is checked
 * as `untar` checks it (checksum, pax and GNU long names, a safe path); a failure errors the stream with an `ArchiveFailure`. Each entry's
 * `readable` MUST be read to its end or cancelled before the next entry is given; cancelling the stream of entries cancels the bytes.
 */
export function readTarStream(stream: ReadableStream<Uint8Array>): ReadableStream<TarStreamEntry> {
  let source: ByteSource | undefined;
  let pending = NO_PENDING;
  let at = 0;
  let skipNext = 0;
  let bodyDone: Promise<void> = Promise.resolve();
  let broken: ArchiveFailure | undefined;
  const next = async (src: ByteSource): Promise<TarStreamEntry | undefined> => {
    await bodyDone;
    if (broken !== undefined) throw broken;
    if (!(await src.skip(skipNext)))
      throw new ArchiveFailure({ kind: "damaged", message: `the entry before byte ${at} runs past the end` });
    skipNext = 0;
    for (;;) {
      const h = await src.exactly(512);
      if (h.length < 512) throw new ArchiveFailure({ kind: "damaged", message: "it ends without the two zero blocks of a tar archive" });
      if (isZeroBlock(h)) {
        await src.drain();
        return undefined;
      }
      const raw = readHeader(h, at);
      if (raw.kind === "err") throw new ArchiveFailure(raw.error);
      const length = bodyLength(raw.value, pending, at);
      if (length.kind === "err") throw new ArchiveFailure(length.error);
      const here = at;
      const size = length.value;
      const pad = padded(size) - size;
      at += 512 + padded(size);
      const pastEnd = new ArchiveFailure({ kind: "damaged", message: `the entry at byte ${here} runs past the end` });
      if (isMetaType(raw.value.type)) {
        if (size > MAX_META)
          throw new ArchiveFailure({ kind: "damaged", message: `the extended header at byte ${here} is larger than 1 MiB` });
        const body = await src.exactly(size);
        if (body.length < size || !(await src.skip(pad))) throw pastEnd;
        pending = pendingAfter(raw.value.type, body, pending);
        continue;
      }
      const e = entryHeader(raw.value, pending, size);
      pending = NO_PENDING;
      if (e.kind === "err") throw new ArchiveFailure(e.error);
      if (e.value === undefined || e.value.kind !== "file" || size === 0) {
        if (!(await src.skip(size + pad))) throw pastEnd;
        if (e.value === undefined) continue;
        return { ...e.value, readable: emptyStream() };
      }
      let remaining = size;
      skipNext = pad;
      let finish = (): void => {};
      bodyDone = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const readable = new ReadableStream<Uint8Array>(
        {
          async pull(controller) {
            let part: Uint8Array | undefined;
            try {
              part = await src.some(remaining);
            } catch (thrown) {
              part = undefined;
              broken = failure(thrown);
            }
            if (part === undefined) {
              broken ??= pastEnd;
              controller.error(broken);
              finish();
              return;
            }
            remaining -= part.length;
            controller.enqueue(part);
            if (remaining === 0) {
              controller.close();
              finish();
            }
          },
          cancel() {
            skipNext += remaining;
            remaining = 0;
            finish();
          },
        },
        { highWaterMark: 0 },
      );
      return { ...e.value, readable };
    }
  };
  return new ReadableStream<TarStreamEntry>(
    {
      async pull(controller) {
        try {
          source ??= await tarBytes(stream);
          const e = await next(source);
          if (e === undefined) controller.close();
          else controller.enqueue(e);
        } catch (thrown) {
          const f = failure(thrown);
          await (source === undefined ? stream.cancel(f) : source.cancel(f)).catch(() => undefined);
          throw f;
        }
      },
      async cancel(reason) {
        await (source === undefined ? stream.cancel(reason) : source.cancel(reason));
      },
    },
    { highWaterMark: 0 },
  );
}

/**
 * A stream from a tar archive's bytes, gzipped or not, to its entries, to put in a `pipeThrough` as `@std/tar`'s `UntarStream` is: see
 * `readTarStream` for what it checks and how each entry's body is read (commons 0001-formats FR-011).
 *
 * @example
 * ```ts
 * for await (const entry of file.readable.pipeThrough(untarStream())) {
 *   if (entry.path === "bin/tool") await save(entry.readable);
 *   else await entry.readable.cancel();
 * }
 * ```
 */
export function untarStream(): ReadableWritablePair<TarStreamEntry, Uint8Array> {
  const input = new TransformStream<Uint8Array, Uint8Array>();
  return { writable: input.writable, readable: readTarStream(input.readable) };
}

/** One link of a tar: a symbolic link names a path (relative to the link's own folder, or absolute), a hard link names the path of another entry of the archive. */
export type TarLink =
  | { readonly kind: "symlink"; readonly path: string; readonly target: string }
  | { readonly kind: "hardlink"; readonly path: string; readonly target: string };

/** The links of a list of tar entries, in the order of the archive, so that a consumer decides what to do with each and finds none among the files. */
export function linksOf(entries: readonly TarEntry[]): readonly TarLink[] {
  const links: TarLink[] = [];
  for (const e of entries) {
    if (e.kind === "symlink") links.push({ kind: "symlink", path: e.path, target: e.linkName });
    else if (e.kind === "hardlink") links.push({ kind: "hardlink", path: e.path, target: e.linkName });
  }
  return links;
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
  if (e.offset + 30 > data.length || view.getUint32(e.offset, true) !== 0x04034b50)
    return damaged(`the entry ${JSON.stringify(e.name)} has no local header`);
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
  if (bytes.length !== e.size || crc32(bytes) !== e.crc)
    return damaged(`the entry ${JSON.stringify(e.name)} does not match its size and CRC-32`);
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
