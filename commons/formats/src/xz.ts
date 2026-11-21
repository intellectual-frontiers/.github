// Spec: 0001-formats FR-021, FR-022
/**
 * The xz format read in pure code (commons 0001-formats FR-021 to FR-023): the container of `.xz` files (one stream or several, each with its blocks, its index and its footer), the LZMA2
 * filter that every xz file made with the default settings uses, and the checks the container carries (CRC-32, CRC-64 and SHA-256 of what a block holds, the CRC-32 of each header and of the index,
 * and the sizes the headers and the index state). It reads bytes in memory and reaches no file, network or program; its one outside call is the web standard `crypto.subtle` for SHA-256.
 *
 * @remarks
 * A file that a reader cannot trust is refused whole and nothing is returned: a header or an index that is not what its CRC-32 says, a block whose check differs from its data, an index that does not
 * list the blocks that were read, a filter other than LZMA2, a match that reaches before the start of the data of its block or past its dictionary, a chunk whose compressed size is not the bytes the
 * range decoder consumed, and data that would be larger than `maxBytes` (a gigabyte unless the caller says another limit) are each `damaged` or `unsupported`, and the output never grows past
 * the limit while it is being made, so that a few bytes that expand without end cannot exhaust memory.
 *
 * @example
 * ```ts
 * import { unxz } from "./xz.ts";
 * const r = await unxz(bytesOfATarXz);
 * if (r.kind === "ok") r.value.length; // the length of the tar the file holds
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type ArchiveError, crc32 } from "./archive.ts";

/** What `unxz` is given besides the bytes. */
export type UnxzOptions = {
  /** The most bytes the data may have once it is read; a gigabyte where none is given. */
  readonly maxBytes?: number;
};

/** The most bytes `unxz` makes where its caller names no limit. */
export const DEFAULT_MAX_BYTES: number = 1024 * 1024 * 1024;

const MAGIC = [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] as const;
const FOOTER_MAGIC = [0x59, 0x5a] as const;

/** Whether bytes begin as an xz file. */
export function isXz(data: Uint8Array): boolean {
  return data.length >= 6 && MAGIC.every((b, i) => data[i] === b);
}

const damaged = (message: string): Result<never, ArchiveError> => err({ kind: "damaged", message });
const unsupported = (message: string): Result<never, ArchiveError> => err({ kind: "unsupported", message });

/** A failure inside the decoder, caught at its one boundary and made a typed result. */
class XzFailure extends Error {
  readonly error: ArchiveError;
  constructor(error: ArchiveError) {
    super(error.kind === "damaged" || error.kind === "unsupported" ? error.message : error.kind);
    this.error = error;
  }
}

const bad = (message: string): XzFailure => new XzFailure({ kind: "damaged", message: `xz: ${message}` });
const notSupported = (message: string): XzFailure => new XzFailure({ kind: "unsupported", message: `xz: ${message}` });

// ---- checks -------------------------------------------------------------------------------------------------------------------------------------

const CRC64_LOW = new Uint32Array(256);
const CRC64_HIGH = new Uint32Array(256);
{
  // ECMA-182, reflected: the polynomial 0xC96C5795D7870F42 as two 32-bit halves
  const polyHigh = 0xc96c5795;
  const polyLow = 0xd7870f42;
  for (let i = 0; i < 256; i++) {
    let low = i;
    let high = 0;
    for (let k = 0; k < 8; k++) {
      const carry = low & 1;
      low = ((low >>> 1) | (high << 31)) >>> 0;
      high >>>= 1;
      if (carry === 1) {
        low = (low ^ polyLow) >>> 0;
        high = (high ^ polyHigh) >>> 0;
      }
    }
    CRC64_LOW[i] = low;
    CRC64_HIGH[i] = high;
  }
}

/** The CRC-64 (ECMA-182) of bytes, as its two 32-bit halves, low then high. */
function crc64(bytes: Uint8Array): readonly [number, number] {
  let low = 0xffffffff;
  let high = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const index = (low ^ (bytes[i] ?? 0)) & 0xff;
    low = (((low >>> 8) | (high << 24)) ^ (CRC64_LOW[index] ?? 0)) >>> 0;
    high = ((high >>> 8) ^ (CRC64_HIGH[index] ?? 0)) >>> 0;
  }
  return [(low ^ 0xffffffff) >>> 0, (high ^ 0xffffffff) >>> 0];
}

function readU32(data: Uint8Array, at: number): number {
  return ((data[at] ?? 0) | ((data[at + 1] ?? 0) << 8) | ((data[at + 2] ?? 0) << 16) | ((data[at + 3] ?? 0) << 24)) >>> 0;
}

/** The size of the check a stream carries, by its identifier, where the identifier is one this reader checks. */
function checkSize(id: number): number | undefined {
  switch (id) {
    case 0x00:
      return 0;
    case 0x01:
      return 4;
    case 0x04:
      return 8;
    case 0x0a:
      return 32;
    default:
      return undefined;
  }
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", copy));
}

// ---- variable-length integers ---------------------------------------------------------------------------------------------------------------

type Cursor = { at: number };

/** A multibyte integer of the container (up to nine bytes, seven bits each, least significant first), as a safe number. */
function readVarint(data: Uint8Array, c: Cursor, end: number): number {
  let value = 0;
  let scale = 1;
  for (let i = 0; i < 9; i++) {
    if (c.at >= end) throw bad("a number runs past the end of its header");
    const b = data[c.at++] ?? 0;
    value += (b & 0x7f) * scale;
    if (!Number.isSafeInteger(value)) throw notSupported("a number is larger than this reader holds");
    if ((b & 0x80) === 0) {
      if (b === 0 && i > 0) throw bad("a number is not in its shortest form");
      return value;
    }
    scale *= 128;
  }
  throw bad("a number is longer than nine bytes");
}

// ---- the output ---------------------------------------------------------------------------------------------------------------------------

/** The data made so far: a buffer that grows by doubling up to a limit, which doubles as the dictionary of the decoder. */
class Out {
  buf: Uint8Array;
  length = 0;
  readonly limit: number;
  constructor(limit: number, initial: number) {
    this.limit = limit;
    this.buf = new Uint8Array(Math.max(1024, Math.min(initial, limit)));
  }
  /** Makes room for `more` bytes, or fails where the data would pass the limit. */
  reserve(more: number): void {
    const need = this.length + more;
    if (need > this.limit) throw notSupported(`the data is larger than the limit of ${this.limit} bytes`);
    if (need <= this.buf.length) return;
    let size = this.buf.length;
    while (size < need) size = Math.min(this.limit, size * 2);
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }
}

// ---- LZMA ---------------------------------------------------------------------------------------------------------------------------------

const PROB_INIT = 1024;
const NUM_STATES = 12;
const POS_STATES_MAX = 16;
const LEN_TO_POS_STATES = 4;
const END_POS_MODEL_INDEX = 14;
const FULL_DISTANCES = 128;
const ALIGN_BITS = 4;
const MATCH_MIN_LEN = 2;

/** The probabilities of a length decoder: a choice, a second choice and the low, mid and high trees. */
type LenProbs = { readonly choice: Uint16Array; readonly low: Uint16Array; readonly mid: Uint16Array; readonly high: Uint16Array };

const lenProbs = (): LenProbs => ({
  choice: new Uint16Array(2).fill(PROB_INIT),
  low: new Uint16Array(POS_STATES_MAX << 3).fill(PROB_INIT),
  mid: new Uint16Array(POS_STATES_MAX << 3).fill(PROB_INIT),
  high: new Uint16Array(256).fill(PROB_INIT),
});

/** The decoder of the LZMA data inside LZMA2 chunks: its state lives across chunks until a chunk resets it. */
class Lzma {
  // properties
  lc = 0;
  lp = 0;
  pb = 0;
  // state
  state = 0;
  rep0 = 0;
  rep1 = 0;
  rep2 = 0;
  rep3 = 0;
  // probabilities
  literal = new Uint16Array(0);
  isMatch = new Uint16Array(NUM_STATES << 4);
  isRep = new Uint16Array(NUM_STATES);
  isRepG0 = new Uint16Array(NUM_STATES);
  isRepG1 = new Uint16Array(NUM_STATES);
  isRepG2 = new Uint16Array(NUM_STATES);
  isRep0Long = new Uint16Array(NUM_STATES << 4);
  posSlot = new Uint16Array(LEN_TO_POS_STATES << 6);
  posSpecial = new Uint16Array(1 + FULL_DISTANCES - END_POS_MODEL_INDEX);
  align = new Uint16Array(1 << ALIGN_BITS);
  len = lenProbs();
  repLen = lenProbs();
  // range decoder
  input: Uint8Array = new Uint8Array(0);
  pos = 0;
  end = 0;
  range = 0;
  code = 0;

  /** Sets the lc, lp and pb of a properties byte, or fails where the byte is not one of LZMA2. */
  setProperties(byte: number): void {
    if (byte >= 9 * 5 * 5) throw bad("a chunk names properties that are not valid");
    this.lc = byte % 9;
    const rest = Math.floor(byte / 9);
    this.lp = rest % 5;
    this.pb = Math.floor(rest / 5);
    if (this.lc + this.lp > 4) throw bad("a chunk names more than four bits of literal context and position");
  }

  /** Puts the state and every probability back to their start. */
  resetState(): void {
    this.state = 0;
    this.rep0 = this.rep1 = this.rep2 = this.rep3 = 0;
    this.literal = new Uint16Array(0x300 << (this.lc + this.lp)).fill(PROB_INIT);
    for (const p of [this.isMatch, this.isRep, this.isRepG0, this.isRepG1, this.isRepG2, this.isRep0Long, this.posSlot, this.posSpecial, this.align]) p.fill(PROB_INIT);
    this.len = lenProbs();
    this.repLen = lenProbs();
  }

  private nextByte(): number {
    if (this.pos >= this.end) throw bad("a chunk's data runs past its compressed size");
    return this.input[this.pos++] ?? 0;
  }

  private startRange(input: Uint8Array, from: number, end: number): void {
    this.input = input;
    this.pos = from;
    this.end = end;
    if (end - from < 5) throw bad("a chunk is shorter than its range coder's start");
    if (this.nextByte() !== 0) throw bad("a chunk's range coder does not begin with a zero byte");
    this.range = 0xffffffff;
    this.code = 0;
    for (let i = 0; i < 4; i++) this.code = ((this.code << 8) | this.nextByte()) >>> 0;
    if (this.code === this.range) throw bad("a chunk's range coder starts at an impossible value");
  }

  private normalize(): void {
    if (this.range < 0x1000000) {
      this.range = (this.range * 256) >>> 0;
      this.code = ((this.code << 8) | this.nextByte()) >>> 0;
    }
  }

  private bit(probs: Uint16Array, index: number): number {
    const p = probs[index] ?? PROB_INIT;
    const bound = (this.range >>> 11) * p;
    let result: number;
    if (this.code < bound) {
      this.range = bound;
      probs[index] = p + ((2048 - p) >>> 5);
      result = 0;
    } else {
      this.range -= bound;
      this.code -= bound;
      probs[index] = p - (p >>> 5);
      result = 1;
    }
    this.normalize();
    return result;
  }

  private direct(count: number): number {
    let result = 0;
    for (let i = 0; i < count; i++) {
      this.range >>>= 1;
      let b = 0;
      if (this.code >= this.range) {
        this.code -= this.range;
        b = 1;
      }
      result = ((result << 1) | b) >>> 0;
      this.normalize();
    }
    return result;
  }

  private tree(probs: Uint16Array, offset: number, bits: number): number {
    let m = 1;
    for (let i = 0; i < bits; i++) m = (m << 1) | this.bit(probs, offset + m);
    return m - (1 << bits);
  }

  private reverseTree(probs: Uint16Array, offset: number, bits: number): number {
    let m = 1;
    let result = 0;
    for (let i = 0; i < bits; i++) {
      const b = this.bit(probs, offset + m);
      m = (m << 1) | b;
      result |= b << i;
    }
    return result;
  }

  private length(p: LenProbs, posState: number): number {
    if (this.bit(p.choice, 0) === 0) return this.tree(p.low, posState << 3, 3);
    if (this.bit(p.choice, 1) === 0) return 8 + this.tree(p.mid, posState << 3, 3);
    return 16 + this.tree(p.high, 0, 8);
  }

  /**
   * Decodes one LZMA2 chunk's symbols from `input[from, end)` into `out` until `size` bytes are made. `dictStart` is where the data of the dictionary begins in `out` and `dictSize` how far back a
   * match may reach; both bounds are checked on every match.
   */
  decode(input: Uint8Array, from: number, end: number, out: Out, size: number, dictStart: number, dictSize: number): void {
    this.startRange(input, from, end);
    out.reserve(size);
    const stop = out.length + size;
    const posMask = (1 << this.pb) - 1;
    const litPosMask = (1 << this.lp) - 1;
    while (out.length < stop) {
      const posState = (out.length - dictStart) & posMask;
      const stateIndex = (this.state << 4) + posState;
      if (this.bit(this.isMatch, stateIndex) === 0) {
        const prev = out.length > dictStart ? (out.buf[out.length - 1] ?? 0) : 0;
        const litState = (((out.length - dictStart) & litPosMask) << this.lc) + (prev >>> (8 - this.lc));
        const base = 0x300 * litState;
        let symbol = 1;
        if (this.state >= 7) {
          if (out.length - this.rep0 - 1 < dictStart) throw bad("a literal reads before the start of its dictionary");
          let matchByte = out.buf[out.length - this.rep0 - 1] ?? 0;
          do {
            const matchBit = (matchByte >>> 7) & 1;
            matchByte = (matchByte << 1) & 0xff;
            const b = this.bit(this.literal, base + ((1 + matchBit) << 8) + symbol);
            symbol = (symbol << 1) | b;
            if (matchBit !== b) break;
          } while (symbol < 0x100);
        }
        while (symbol < 0x100) symbol = (symbol << 1) | this.bit(this.literal, base + symbol);
        out.buf[out.length++] = symbol & 0xff;
        this.state = this.state < 4 ? 0 : this.state < 10 ? this.state - 3 : this.state - 6;
        continue;
      }
      let length: number;
      if (this.bit(this.isRep, this.state) === 0) {
        this.rep3 = this.rep2;
        this.rep2 = this.rep1;
        this.rep1 = this.rep0;
        length = this.length(this.len, posState);
        this.state = this.state < 7 ? 7 : 10;
        const lenState = Math.min(length, LEN_TO_POS_STATES - 1);
        const slot = this.tree(this.posSlot, lenState << 6, 6);
        if (slot < 4) {
          this.rep0 = slot;
        } else {
          const direct = (slot >>> 1) - 1;
          let distance = ((2 | (slot & 1)) << direct) >>> 0;
          if (slot < END_POS_MODEL_INDEX) {
            distance = (distance + this.reverseTree(this.posSpecial, distance - slot, direct)) >>> 0;
          } else {
            distance = (distance + ((this.direct(direct - ALIGN_BITS) << ALIGN_BITS) >>> 0)) >>> 0;
            distance = (distance + this.reverseTree(this.align, 0, ALIGN_BITS)) >>> 0;
            if (distance === 0xffffffff) throw bad("a chunk holds the end marker, which LZMA2 does not use");
          }
          this.rep0 = distance;
        }
      } else {
        if (out.length === dictStart) throw bad("a repeated match comes before any data");
        if (this.bit(this.isRepG0, this.state) === 0) {
          if (this.bit(this.isRep0Long, stateIndex) === 0) {
            this.state = this.state < 7 ? 9 : 11;
            const from0 = out.length - this.rep0 - 1;
            if (from0 < dictStart || this.rep0 >= dictSize) throw bad("a match reaches before its dictionary");
            out.buf[out.length] = out.buf[from0] ?? 0;
            out.length++;
            continue;
          }
        } else {
          let distance: number;
          if (this.bit(this.isRepG1, this.state) === 0) {
            distance = this.rep1;
          } else {
            if (this.bit(this.isRepG2, this.state) === 0) {
              distance = this.rep2;
            } else {
              distance = this.rep3;
              this.rep3 = this.rep2;
            }
            this.rep2 = this.rep1;
          }
          this.rep1 = this.rep0;
          this.rep0 = distance;
        }
        length = this.length(this.repLen, posState);
        this.state = this.state < 7 ? 8 : 11;
      }
      length += MATCH_MIN_LEN;
      const distance = this.rep0;
      if (distance >= dictSize || out.length - distance - 1 < dictStart) throw bad("a match reaches before its dictionary");
      if (out.length + length > stop) throw bad("a match runs past the end of its chunk");
      let source = out.length - distance - 1;
      const buf = out.buf;
      let to = out.length;
      for (let i = 0; i < length; i++) buf[to++] = buf[source++] ?? 0;
      out.length = to;
    }
    if (this.pos !== this.end) throw bad("a chunk's compressed size is not the bytes its data used");
    if (this.code !== 0) throw bad("a chunk's range coder does not end at zero");
  }
}

// ---- LZMA2 --------------------------------------------------------------------------------------------------------------------------------

/** The dictionary size an LZMA2 properties byte names. */
function dictionarySize(byte: number): number {
  if (byte > 40) throw bad("the LZMA2 filter names a dictionary larger than the format allows");
  if (byte === 40) return 0xffffffff;
  return (2 | (byte & 1)) * 2 ** (11 + (byte >>> 1));
}

/** Reads the LZMA2 chunks of `data[from, end)` into `out`, where `dictStart` is the start of the block's data in `out`; returns where the chunks end (past the end marker). */
function lzma2(data: Uint8Array, from: number, end: number, out: Out, blockStart: number, dictSize: number): number {
  const lzma = new Lzma();
  let dictStart = blockStart;
  let at = from;
  let needProps = true;
  let needDictReset = true;
  for (;;) {
    if (at >= end) throw bad("a block ends without the end marker of its LZMA2 data");
    const control = data[at++] ?? 0;
    if (control === 0) return at;
    if (control < 0x80) {
      if (control > 2) throw bad("a chunk begins with a control byte that LZMA2 does not use");
      if (control === 1) {
        needDictReset = false;
        dictStart = out.length;
      } else if (needDictReset) throw bad("the first chunk of a block does not reset the dictionary");
      if (at + 2 > end) throw bad("a chunk's header runs past the end of its block");
      const size = (((data[at] ?? 0) << 8) | (data[at + 1] ?? 0)) + 1;
      at += 2;
      if (at + size > end) throw bad("an uncompressed chunk runs past the end of its block");
      out.reserve(size);
      out.buf.set(data.subarray(at, at + size), out.length);
      out.length += size;
      at += size;
      continue;
    }
    if (at + 4 > end) throw bad("a chunk's header runs past the end of its block");
    const mode = (control >>> 5) & 3;
    const size = (((control & 0x1f) << 16) | ((data[at] ?? 0) << 8) | (data[at + 1] ?? 0)) + 1;
    const packed = (((data[at + 2] ?? 0) << 8) | (data[at + 3] ?? 0)) + 1;
    at += 4;
    if (mode === 3) {
      needDictReset = false;
      dictStart = out.length;
    } else if (needDictReset) throw bad("the first chunk of a block does not reset the dictionary");
    if (mode >= 2) {
      if (at >= end) throw bad("a chunk's header runs past the end of its block");
      lzma.setProperties(data[at++] ?? 0);
      needProps = false;
    } else if (needProps) {
      throw bad("a chunk uses properties before any chunk has set them");
    }
    if (mode >= 1) lzma.resetState();
    if (at + packed > end) throw bad("a compressed chunk runs past the end of its block");
    lzma.decode(data, at, at + packed, out, size, dictStart, dictSize);
    at += packed;
  }
}

// ---- the container -----------------------------------------------------------------------------------------------------------------------

type BlockRecord = { readonly unpadded: number; readonly uncompressed: number };

async function readBlock(data: Uint8Array, start: number, checkId: number, out: Out): Promise<{ readonly next: number; readonly record: BlockRecord }> {
  const headerSize = ((data[start] ?? 0) + 1) * 4;
  if (headerSize < 8 || start + headerSize > data.length) throw bad("a block header runs past the end of the file");
  const headerEnd = start + headerSize - 4;
  if (crc32(data.subarray(start, headerEnd)) !== readU32(data, headerEnd)) throw bad("a block header is not what its CRC-32 says");
  const c: Cursor = { at: start + 1 };
  const flags = data[c.at++] ?? 0;
  if ((flags & 0x3c) !== 0) throw notSupported("a block header sets flags that this reader does not know");
  const filters = (flags & 3) + 1;
  const declaredPacked = (flags & 0x40) !== 0 ? readVarint(data, c, headerEnd) : undefined;
  const declaredSize = (flags & 0x80) !== 0 ? readVarint(data, c, headerEnd) : undefined;
  if (filters !== 1) throw notSupported("a block uses a filter besides LZMA2");
  const id = readVarint(data, c, headerEnd);
  if (id !== 0x21) throw notSupported(`a block uses the filter ${id.toString(16)}, and this reader reads LZMA2`);
  const propsSize = readVarint(data, c, headerEnd);
  if (propsSize !== 1 || c.at + 1 > headerEnd) throw bad("the LZMA2 filter does not have its one properties byte");
  const dictSize = dictionarySize(data[c.at++] ?? 0);
  for (let i = c.at; i < headerEnd; i++) if ((data[i] ?? 0) !== 0) throw bad("a block header's padding is not zero");

  const bodyStart = start + headerSize;
  const dictStart = out.length;
  const bodyEnd = lzma2(data, bodyStart, data.length, out, dictStart, dictSize);
  const packed = bodyEnd - bodyStart;
  const size = out.length - dictStart;
  if (declaredPacked !== undefined && declaredPacked !== packed) throw bad("a block's compressed size is not what its header says");
  if (declaredSize !== undefined && declaredSize !== size) throw bad("a block's uncompressed size is not what its header says");

  let at = bodyEnd;
  const padding = (4 - ((headerSize + packed) % 4)) % 4;
  for (let i = 0; i < padding; i++) if ((data[at + i] ?? 0) !== 0 || at + i >= data.length) throw bad("a block's padding is not zero");
  at += padding;
  const checkLength = checkSize(checkId) ?? 0;
  if (at + checkLength > data.length) throw bad("a block's check runs past the end of the file");
  const made = out.buf.subarray(dictStart, out.length);
  switch (checkId) {
    case 0x00:
      break;
    case 0x01:
      if (crc32(made) !== readU32(data, at)) throw bad("a block's data is not what its CRC-32 says");
      break;
    case 0x04: {
      const [low, high] = crc64(made);
      if (low !== readU32(data, at) || high !== readU32(data, at + 4)) throw bad("a block's data is not what its CRC-64 says");
      break;
    }
    case 0x0a: {
      const digest = await sha256(made);
      for (let i = 0; i < 32; i++) if (digest[i] !== data[at + i]) throw bad("a block's data is not what its SHA-256 says");
      break;
    }
    default:
      throw notSupported("a stream carries a check that this reader does not know");
  }
  at += checkLength;
  return { next: at, record: { unpadded: headerSize + packed + checkLength, uncompressed: size } };
}

async function readStream(data: Uint8Array, start: number, out: Out): Promise<number> {
  if (start + 12 > data.length) throw bad("a stream is shorter than its header and footer");
  if (!MAGIC.every((b, i) => data[start + i] === b)) throw bad("a stream does not begin with the xz signature");
  if ((data[start + 6] ?? 0) !== 0 || ((data[start + 7] ?? 0) & 0xf0) !== 0) throw notSupported("a stream header sets flags that this reader does not know");
  if (crc32(data.subarray(start + 6, start + 8)) !== readU32(data, start + 8)) throw bad("a stream header is not what its CRC-32 says");
  const checkId = (data[start + 7] ?? 0) & 0x0f;
  if (checkSize(checkId) === undefined) throw notSupported("a stream carries a check that this reader does not know");
  let at = start + 12;
  const records: BlockRecord[] = [];
  while ((data[at] ?? 0) !== 0) {
    if (at >= data.length) throw bad("a stream ends before its index");
    const block = await readBlock(data, at, checkId, out);
    records.push(block.record);
    at = block.next;
  }
  // the index
  const indexStart = at;
  const c: Cursor = { at: at + 1 };
  const count = readVarint(data, c, data.length);
  if (count !== records.length) throw bad("the index lists a number of blocks other than the blocks that were read");
  for (const r of records) {
    const unpadded = readVarint(data, c, data.length);
    const uncompressed = readVarint(data, c, data.length);
    if (unpadded !== r.unpadded || uncompressed !== r.uncompressed) throw bad("the index does not list the sizes of the blocks that were read");
  }
  while ((c.at - indexStart) % 4 !== 0) {
    if ((data[c.at] ?? 0) !== 0) throw bad("the index's padding is not zero");
    c.at++;
  }
  if (c.at + 4 > data.length || crc32(data.subarray(indexStart, c.at)) !== readU32(data, c.at)) throw bad("the index is not what its CRC-32 says");
  c.at += 4;
  const indexSize = c.at - indexStart;
  // the footer
  if (c.at + 12 > data.length) throw bad("a stream ends before its footer");
  const footer = c.at;
  if (crc32(data.subarray(footer + 4, footer + 10)) !== readU32(data, footer)) throw bad("a stream footer is not what its CRC-32 says");
  if ((readU32(data, footer + 4) + 1) * 4 !== indexSize) throw bad("the footer's size of the index is not the index's size");
  if ((data[footer + 8] ?? 0) !== 0 || ((data[footer + 9] ?? 0) & 0x0f) !== checkId || ((data[footer + 9] ?? 0) & 0xf0) !== 0) throw bad("the footer's flags are not the header's");
  if (data[footer + 10] !== FOOTER_MAGIC[0] || data[footer + 11] !== FOOTER_MAGIC[1]) throw bad("a stream does not end with the xz footer signature");
  return footer + 12;
}

/**
 * The bytes an xz file holds (one stream, or several one after another with zero padding between them), every header, index and check verified. The result is a new array; nothing is returned for
 * a file that fails a check, and the data never grows past `options.maxBytes` (a gigabyte by default) while it is being made.
 */
export async function unxz(data: Uint8Array, options: UnxzOptions = {}): Promise<Result<Uint8Array, ArchiveError>> {
  const limit = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isSafeInteger(limit) || limit < 0) return unsupported("xz: the limit is not a whole number of bytes");
  if (!isXz(data)) return damaged("it does not begin as an xz file");
  const out = new Out(limit, Math.min(data.length * 4, limit));
  try {
    let at = 0;
    for (;;) {
      at = await readStream(data, at, out);
      let pad = at;
      while (pad < data.length && (data[pad] ?? 0) === 0) pad++;
      if ((pad - at) % 4 !== 0) throw bad("the padding between streams is not a multiple of four bytes");
      if (pad >= data.length) break;
      at = pad;
    }
    return ok(out.buf.slice(0, out.length));
  } catch (e) {
    if (e instanceof XzFailure) return err(e.error);
    if (e instanceof RangeError) return unsupported("xz: the data is larger than this runtime can hold");
    throw e;
  }
}
