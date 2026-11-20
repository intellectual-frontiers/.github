// Spec: 0001-formats FR-012
/**
 * Pictures with no outside package (commons 0001-formats FR-012): a PNG read into eight-bit RGBA and written back, a picture
 * resized with Pillow's Lanczos filter in its fixed point (on premultiplied alpha for RGBA), laid over another as Pillow's `alpha_composite`
 * lays it, fitted as Pillow's `thumbnail` fits it, gathered into a multi-size icon file of PNG frames and read back from one, and two files
 * compared by their pixels rather than their bytes (two zlib encoders give different bytes for one picture). Also a `#rrggbb` colour read
 * into its channels and its relative luminance as WCAG measures it.
 *
 * The reader takes every PNG that is not interlaced: greyscale at 1, 2, 4, 8 and 16 bits, palette at 1, 2, 4 and 8 bits, and RGB,
 * greyscale with alpha and RGBA at 8 and 16 bits, with `tRNS` transparency for greyscale, RGB and palette, and every filter (None, Sub,
 * Up, Average, Paeth). Sixteen-bit samples keep their high byte. It refuses what is not a PNG it can trust, with a typed `PngError`: a bad
 * signature, a chunk whose CRC-32 is wrong, data cut short, a colour type and bit depth PNG does not define, an interlaced (Adam7) picture,
 * an unknown critical chunk, and a picture of more than `MAX_PIXELS` pixels, refused before anything is allocated or inflated for it; the
 * inflater is stopped as soon as it gives more bytes than the picture needs, so a small hostile file cannot make it allocate more.
 * Writers take a well-formed picture; a malformed one (a size that is not a positive integer, data of the wrong length) is a programming
 * error and throws a `RangeError`.
 *
 * Taken from erga's `lib/ts/png`. What changed: readers return a typed error rather than a sentence, check every chunk's CRC and the
 * picture's size, read the sub-byte depths and the `tRNS` of greyscale and RGB that erga ignored, and refuse an out-of-range palette index;
 * erga's `resize` (each channel alone) is `resizeChannels` and its `resized` (on premultiplied alpha) is `resize`; `hexRgb` returns
 * `undefined` for what is not a colour rather than black, and `luminance` takes channels rather than a hex string; `composite` clips an
 * overlay that starts left of or above its base, and `premultiply` leaves a picture without alpha as it is.
 *
 * @example
 * ```ts
 * import { filled, readPng, writePng } from "./png.ts";
 * const png = await writePng(filled(2, 2, [255, 0, 0, 128]));
 * await readPng(png); // { kind: "ok", value: { width: 2, height: 2, channels: 4, data: Uint8Array [255, 0, 0, 128, ...] } }
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { concat, crc32 } from "./archive.ts";

/** A raster: its size, its channels (3 for RGB, 4 for RGBA) and its bytes, row by row, eight bits a channel. */
export type Picture = { readonly width: number; readonly height: number; readonly channels: 3 | 4; readonly data: Uint8Array };

/** A colour's red, green and blue, each 0 to 255. */
export type Rgb = readonly [number, number, number];

/** A colour's red, green, blue and alpha, each 0 to 255. */
export type Rgba = readonly [number, number, number, number];

/**
 * The most pixels a picture read may have: 2^24 (16,777,216, a 4096 by 4096 square). Its RGBA is then at most 64 MiB, and the inflated
 * data of the largest kind (16-bit RGBA) at most 128 MiB. A file that declares more is refused as `too-large` before anything is read.
 */
export const MAX_PIXELS: number = 2 ** 24;

/** Why bytes are not a PNG or icon file this reader takes. */
export type PngError =
  | { readonly kind: "signature"; readonly format: "png" | "ico" }
  | { readonly kind: "crc"; readonly chunk: string; readonly at: number }
  | { readonly kind: "truncated"; readonly message: string }
  | { readonly kind: "malformed"; readonly message: string }
  | { readonly kind: "unsupported"; readonly message: string }
  | { readonly kind: "interlaced" }
  | { readonly kind: "too-large"; readonly width: number; readonly height: number; readonly limit: number }
  | { readonly kind: "ico-frame"; readonly index: number; readonly error: PngError };

/** A PNG error as one sentence. */
export function formatPngError(e: PngError): string {
  switch (e.kind) {
    case "signature":
      return e.format === "png"
        ? "it is not a PNG: it does not begin with the PNG signature"
        : "it is not an icon file: its header is not 0, 1";
    case "crc":
      return `the PNG is damaged: the CRC-32 of its ${JSON.stringify(e.chunk)} chunk at byte ${e.at} is wrong`;
    case "truncated":
      return `the PNG is cut short: ${e.message}`;
    case "malformed":
      return `the PNG is malformed: ${e.message}`;
    case "unsupported":
      return `the PNG uses what is not supported: ${e.message}`;
    case "interlaced":
      return "the PNG is interlaced (Adam7), which is not supported";
    case "too-large":
      return `the picture is too large: ${e.width} by ${e.height} pixels is more than ${e.limit}`;
    case "ico-frame":
      return `frame ${e.index} of the icon file: ${formatPngError(e.error)}`;
    default:
      return absurd(e);
  }
}

const truncated = (message: string): Result<never, PngError> => err({ kind: "truncated", message });
const malformed = (message: string): Result<never, PngError> => err({ kind: "malformed", message });
const unsupported = (message: string): Result<never, PngError> => err({ kind: "unsupported", message });

const SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isSize(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0;
}

function checkPicture(p: Picture): void {
  if (!isSize(p.width) || !isSize(p.height)) throw new RangeError(`a picture of ${p.width} by ${p.height} pixels`);
  if (p.data.length !== p.width * p.height * p.channels)
    throw new RangeError(`a picture of ${p.width} by ${p.height} by ${p.channels} with ${p.data.length} bytes`);
}

/** A picture of one colour, RGBA. A size that is not a positive integer throws a `RangeError`. */
export function filled(width: number, height: number, rgba: Rgba): Picture {
  if (!isSize(width) || !isSize(height)) throw new RangeError(`a picture of ${width} by ${height} pixels`);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(rgba, i * 4);
  return { width, height, channels: 4, data };
}

/** The picture without its alpha; a picture without alpha as it is. */
export function rgbOf(p: Picture): Picture {
  if (p.channels === 3) return p;
  const data = new Uint8Array(p.width * p.height * 3);
  for (let i = 0; i < p.width * p.height; i++) data.set(p.data.subarray(i * 4, i * 4 + 3), i * 3);
  return { width: p.width, height: p.height, channels: 3, data };
}

/** The picture with alpha, opaque where it had none; a picture with alpha as it is. */
export function rgbaOf(p: Picture): Picture {
  if (p.channels === 4) return p;
  const data = new Uint8Array(p.width * p.height * 4);
  for (let i = 0; i < p.width * p.height; i++) {
    data.set(p.data.subarray(i * 3, i * 3 + 3), i * 4);
    data[i * 4 + 3] = 255;
  }
  return { width: p.width, height: p.height, channels: 4, data };
}

/** The colour types PNG defines, with their samples per pixel and the bit depths each allows. */
const COLOUR_TYPES: ReadonlyMap<number, { readonly samples: number; readonly depths: readonly number[]; readonly name: string }> = new Map([
  [0, { samples: 1, depths: [1, 2, 4, 8, 16], name: "greyscale" }],
  [2, { samples: 3, depths: [8, 16], name: "RGB" }],
  [3, { samples: 1, depths: [1, 2, 4, 8], name: "palette" }],
  [4, { samples: 2, depths: [8, 16], name: "greyscale with alpha" }],
  [6, { samples: 4, depths: [8, 16], name: "RGBA" }],
]);

/** The PNG header. */
type Header = {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly colour: number;
  readonly samples: number;
};

function readHeader(data: Uint8Array): Result<Header, PngError> {
  if (data.length !== 13) return malformed(`its IHDR chunk holds ${data.length} bytes, not 13`);
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = v.getUint32(0);
  const height = v.getUint32(4);
  const depth = data[8] ?? 0;
  const colour = data[9] ?? 0;
  if (width === 0 || height === 0 || width > 0x7fffffff || height > 0x7fffffff) return malformed(`a size of ${width} by ${height} pixels`);
  if (data[10] !== 0) return malformed(`compression method ${data[10] ?? 0}`);
  if (data[11] !== 0) return malformed(`filter method ${data[11] ?? 0}`);
  if (data[12] === 1) return err({ kind: "interlaced" });
  if (data[12] !== 0) return malformed(`interlace method ${data[12] ?? 0}`);
  const type = COLOUR_TYPES.get(colour);
  if (type === undefined) return unsupported(`colour type ${colour}`);
  if (!type.depths.includes(depth)) return unsupported(`a bit depth of ${depth} for colour type ${colour} (${type.name})`);
  if (width * height > MAX_PIXELS) return err({ kind: "too-large", width, height, limit: MAX_PIXELS });
  return ok({ width, height, depth, colour, samples: type.samples });
}

/** The chunks of a PNG that matter to its pixels, each checked against its CRC-32. */
type Chunks = { readonly header: Header; readonly palette: Uint8Array; readonly trns: Uint8Array | undefined; readonly idat: Uint8Array };

function readChunks(bytes: Uint8Array): Result<Chunks, PngError> {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) return err({ kind: "signature", format: "png" });
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let header: Header | undefined;
  let palette: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  for (let at = 8; ;) {
    if (at + 12 > bytes.length) return truncated(`it ends at byte ${bytes.length} before its IEND chunk`);
    const length = v.getUint32(at);
    if (length > 0x7fffffff) return malformed(`a chunk at byte ${at} declares ${length} bytes`);
    const typeBytes = bytes.subarray(at + 4, at + 8);
    if (!typeBytes.every((b) => (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a)))
      return malformed(`the chunk at byte ${at} has a type that is not four letters`);
    const type = String.fromCharCode(...typeBytes);
    if (at + 12 + length > bytes.length) return truncated(`its ${JSON.stringify(type)} chunk at byte ${at} runs past the end`);
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (crc32(bytes.subarray(at + 4, at + 8 + length)) !== v.getUint32(at + 8 + length)) return err({ kind: "crc", chunk: type, at });
    if (header === undefined && type !== "IHDR") return malformed(`its first chunk is ${JSON.stringify(type)}, not IHDR`);
    switch (type) {
      case "IHDR": {
        if (header !== undefined) return malformed("it has a second IHDR chunk");
        const h = readHeader(data);
        if (h.kind === "err") return h;
        header = h.value;
        break;
      }
      case "PLTE":
        if (length === 0 || length % 3 !== 0 || length > 768) return malformed(`its PLTE chunk holds ${length} bytes`);
        palette = data;
        break;
      case "tRNS":
        trns = data;
        break;
      case "IDAT":
        idat.push(data);
        break;
      case "IEND":
        if (header === undefined) return malformed("it has no IHDR chunk");
        if (idat.length === 0) return malformed("it has no IDAT chunk");
        if (header.colour === 3 && palette === undefined) return malformed("it is a palette picture with no PLTE chunk");
        return ok({ header, palette: palette ?? new Uint8Array(), trns, idat: concat(idat) });
      default:
        if (((typeBytes[0] ?? 0) & 0x20) === 0) return unsupported(`the critical chunk ${JSON.stringify(type)}`);
    }
    at += 12 + length;
  }
}

/** The zlib data inflated by the web standard `DecompressionStream`, which must give exactly `expected` bytes; it is stopped beyond. */
async function inflate(data: Uint8Array, expected: number): Promise<Result<Uint8Array, PngError>> {
  const out = new Uint8Array(expected);
  let at = 0;
  try {
    const reader = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (at + value.length > expected) {
        await reader.cancel().catch(() => undefined);
        return malformed(`its image data inflates to more than the ${expected} bytes its size needs`);
      }
      out.set(value, at);
      at += value.length;
    }
  } catch (e) {
    return malformed(`its image data is not a zlib stream that inflates: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (at < expected) return truncated(`its image data inflates to ${at} bytes where its size needs ${expected}`);
  return ok(out);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** The scanlines with their filters undone: `height` rows of `stride` bytes, `bpp` bytes back to the byte on the left. */
function unfilter(raw: Uint8Array, height: number, stride: number, bpp: number): Result<Uint8Array, PngError> {
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    if (filter > 4) return malformed(`row ${y} has filter type ${filter}`);
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const s = raw[src + x] ?? 0;
      const a = x >= bpp ? (px[row + x - bpp] ?? 0) : 0;
      const b = y > 0 ? (px[row - stride + x] ?? 0) : 0;
      const c = x >= bpp && y > 0 ? (px[row - stride + x - bpp] ?? 0) : 0;
      const predicted = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
      px[row + x] = (s + predicted) & 0xff;
    }
  }
  return ok(px);
}

/** The unfiltered samples expanded to eight-bit RGBA: palette and `tRNS` applied, sub-byte greyscale scaled, 16-bit samples cut to their high byte. */
function expand(px: Uint8Array, c: Chunks, stride: number): Result<Uint8Array, PngError> {
  const { width, height, depth, colour, samples } = c.header;
  const out = new Uint8Array(width * height * 4);
  const max = (1 << Math.min(depth, 8)) - 1;
  const trns = c.trns;
  const key = (k: number): number => (trns === undefined ? -1 : ((trns[k * 2] ?? 0) << 8) | (trns[k * 2 + 1] ?? 0));
  const entries = c.palette.length / 3;
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    /** Sample `k` of pixel `x`, at its full depth. */
    const sample = (x: number, k: number): number => {
      if (depth === 16) {
        const i = row + (x * samples + k) * 2;
        return ((px[i] ?? 0) << 8) | (px[i + 1] ?? 0);
      }
      if (depth === 8) return px[row + x * samples + k] ?? 0;
      const bit = x * depth;
      return ((px[row + (bit >> 3)] ?? 0) >> (8 - depth - (bit & 7))) & max;
    };
    const eight = (v: number): number => (depth === 16 ? v >> 8 : depth === 8 ? v : Math.round((v * 255) / max));
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      switch (colour) {
        case 0: {
          const g = sample(x, 0);
          out.set([eight(g), eight(g), eight(g), trns !== undefined && trns.length >= 2 && g === key(0) ? 0 : 255], o);
          break;
        }
        case 2: {
          const [r, g, b] = [sample(x, 0), sample(x, 1), sample(x, 2)];
          const clear = trns !== undefined && trns.length >= 6 && r === key(0) && g === key(1) && b === key(2);
          out.set([eight(r), eight(g), eight(b), clear ? 0 : 255], o);
          break;
        }
        case 3: {
          const k = sample(x, 0);
          if (k >= entries) return malformed(`pixel ${x}, ${y} has palette index ${k} of a palette of ${entries}`);
          out.set([c.palette[k * 3] ?? 0, c.palette[k * 3 + 1] ?? 0, c.palette[k * 3 + 2] ?? 0, trns?.[k] ?? 255], o);
          break;
        }
        case 4: {
          const g = eight(sample(x, 0));
          out.set([g, g, g, eight(sample(x, 1))], o);
          break;
        }
        default:
          out.set([eight(sample(x, 0)), eight(sample(x, 1)), eight(sample(x, 2)), eight(sample(x, 3))], o);
      }
    }
  }
  return ok(out);
}

/** A PNG read into eight-bit RGBA, its filters undone and its palette and transparency applied; or why it cannot be. */
export async function readPng(bytes: Uint8Array): Promise<Result<Picture, PngError>> {
  const chunks = readChunks(bytes);
  if (chunks.kind === "err") return chunks;
  const { width, height, depth, samples } = chunks.value.header;
  const bits = samples * depth;
  const stride = Math.ceil((width * bits) / 8);
  const raw = await inflate(chunks.value.idat, (stride + 1) * height);
  if (raw.kind === "err") return raw;
  const px = unfilter(raw.value, height, stride, Math.max(1, bits >> 3));
  if (px.kind === "err") return px;
  const data = expand(px.value, chunks.value, stride);
  if (data.kind === "err") return data;
  return ok({ width, height, channels: 4, data: data.value });
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0);
  return b;
}

/** A PNG chunk: its length, its type, its data and the CRC-32 of its type and data. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = concat([new TextEncoder().encode(type), data]);
  return concat([u32be(data.length), body, u32be(crc32(body))]);
}

/** A picture written as an eight-bit RGB or RGBA PNG, each row unfiltered, its zlib stream the platform's `CompressionStream`. */
export async function writePng(p: Picture): Promise<Uint8Array> {
  checkPicture(p);
  const stride = p.width * p.channels;
  const raw = new Uint8Array((stride + 1) * p.height);
  for (let y = 0; y < p.height; y++) raw.set(p.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, p.width);
  v.setUint32(4, p.height);
  ihdr.set([8, p.channels === 4 ? 6 : 2, 0, 0, 0], 8);
  return concat([Uint8Array.from(SIGNATURE), chunk("IHDR", ihdr), chunk("IDAT", await deflate(raw)), chunk("IEND", new Uint8Array())]);
}

/** `a / 255` rounded down, the way Pillow computes it in integers: `((a >> 8) + a) >> 8`. */
const div255 = (a: number): number => Math.floor((Math.floor(a / 256) + a) / 256);

/** The picture with each colour channel multiplied by its alpha, rounded as Pillow rounds; a picture without alpha as it is. */
export function premultiply(p: Picture): Picture {
  if (p.channels === 3) return p;
  const data = p.data.slice();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    for (let c = 0; c < 3; c++) data[i + c] = div255((data[i + c] ?? 0) * a + 128);
  }
  return { ...p, data };
}

/** The picture with each colour channel divided by its alpha again, as Pillow divides; a picture without alpha as it is. */
export function unpremultiply(p: Picture): Picture {
  if (p.channels === 3) return p;
  const data = p.data.slice();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    if (a !== 0 && a !== 255) for (let c = 0; c < 3; c++) data[i + c] = Math.min(255, Math.floor((255 * (data[i + c] ?? 0)) / a));
  }
  return { ...p, data };
}

const PRECISION_BITS = 32 - 8 - 2;
const ONE = 2 ** PRECISION_BITS;

function lanczos(x: number): number {
  const sinc = (v: number): number => (v === 0 ? 1 : Math.sin(v * Math.PI) / (v * Math.PI));
  return x >= -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0;
}

/** For each output pixel along one axis, the first input pixel it reads and its fixed-point weights, as Pillow computes them. */
function coefficients(inSize: number, outSize: number): readonly (readonly [number, readonly number[]])[] {
  const scale = Math.fround(inSize) / outSize;
  const filterscale = Math.max(scale, 1);
  const support = 3 * filterscale;
  const inv = 1 / filterscale;
  const out: (readonly [number, readonly number[]])[] = [];
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    const xmin = Math.max(Math.trunc(center - support + 0.5), 0);
    const xmax = Math.min(Math.trunc(center + support + 0.5), inSize) - xmin;
    const k: number[] = [];
    for (let x = 0; x < xmax; x++) k.push(lanczos((x + xmin - center + 0.5) * inv));
    const ww = k.reduce((a, b) => a + b, 0);
    const norm = ww !== 0 ? k.map((w) => w / ww) : k;
    out.push([xmin, norm.map((w) => (w < 0 ? Math.trunc(-0.5 + w * ONE) : Math.trunc(0.5 + w * ONE)))]);
  }
  return out;
}

const clip8 = (ss: number): number => Math.min(255, Math.max(0, Math.floor(ss / ONE)));

/**
 * A picture resized with Pillow's Lanczos filter in its fixed point, each channel filtered on its own (alpha too, and the colour channels
 * without regard to it). A size that is not a positive integer throws a `RangeError`.
 */
export function resizeChannels(p: Picture, width: number, height: number): Picture {
  if (!isSize(width) || !isSize(height)) throw new RangeError(`a resize to ${width} by ${height} pixels`);
  const ch = p.channels;
  const vert = coefficients(p.height, height);
  const first = vert[0]?.[0] ?? 0;
  const lastV = vert[vert.length - 1];
  const last = lastV === undefined ? p.height : lastV[0] + lastV[1].length;
  let cur = p;
  let offset = 0;
  if (width !== p.width) {
    const horiz = coefficients(p.width, width);
    const rows = last - first;
    const data = new Uint8Array(width * rows * ch);
    for (let y = 0; y < rows; y++) {
      const base = (y + first) * p.width * ch;
      horiz.forEach(([xmin, k], xx) => {
        for (let c = 0; c < ch; c++) {
          let ss = ONE / 2;
          k.forEach((w, x) => (ss += (p.data[base + (x + xmin) * ch + c] ?? 0) * w));
          data[(y * width + xx) * ch + c] = clip8(ss);
        }
      });
    }
    cur = { width, height: rows, channels: ch, data };
    offset = first;
  }
  if (height !== p.height) {
    const w = cur.width;
    const src = cur.data;
    const data = new Uint8Array(w * height * ch);
    vert.forEach(([ymin0, k], yy) => {
      const ymin = ymin0 - offset;
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < ch; c++) {
          let ss = ONE / 2;
          k.forEach((wt, y) => (ss += (src[((y + ymin) * w + x) * ch + c] ?? 0) * wt));
          data[(yy * w + x) * ch + c] = clip8(ss);
        }
      }
    });
    cur = { width: w, height, channels: ch, data };
  }
  return cur;
}

/** A picture resized as Pillow resizes it with its Lanczos filter: an RGBA picture on premultiplied alpha. The same size gives it back. */
export function resize(p: Picture, width: number, height: number): Picture {
  if (width === p.width && height === p.height) return p;
  return p.channels === 3 ? resizeChannels(p, width, height) : unpremultiply(resizeChannels(premultiply(p), width, height));
}

/**
 * `over` laid on `base` with its top left corner at `(left, top)`, as Pillow's `alpha_composite` lays it; what falls outside `base` is
 * cut off. The result has alpha; a picture without alpha is taken as opaque.
 */
export function composite(base: Picture, over: Picture, left: number, top: number): Picture {
  const b = rgbaOf(base);
  const o = rgbaOf(over);
  const P = 128;
  const data = b.data.slice();
  for (let y = Math.max(0, -top); y < o.height && y + top < b.height; y++) {
    for (let x = Math.max(0, -left); x < o.width && x + left < b.width; x++) {
      const s = (y * o.width + x) * 4;
      const i = ((y + top) * b.width + x + left) * 4;
      const sa = o.data[s + 3] ?? 0;
      if (sa === 0) continue;
      const da = data[i + 3] ?? 0;
      const outa255 = sa * 255 + da * (255 - sa);
      const coef1 = Math.floor((sa * 255 * 255 * P) / outa255);
      const coef2 = 255 * P - coef1;
      for (let c = 0; c < 3; c++)
        data[i + c] = Math.floor(div255((o.data[s + c] ?? 0) * coef1 + (data[i + c] ?? 0) * coef2 + 0x80 * P) / P);
      data[i + 3] = div255(outa255 + 0x80);
    }
  }
  return { ...b, data };
}

/** `art` laid at `(left, top)` on an opaque canvas of `colour`, the result without alpha. */
export function flatOn(colour: Rgb, width: number, height: number, art: Picture, left: number, top: number): Picture {
  return rgbOf(composite(filled(width, height, [colour[0], colour[1], colour[2], 255]), art, left, top));
}

/** The size Pillow's `thumbnail` gives a picture fitted in `width` by `height`, its aspect kept; `undefined` where it already fits. */
export function thumbnailSize(p: Picture, width: number, height: number): readonly [number, number] | undefined {
  if (width >= p.width && height >= p.height) return undefined;
  const aspect = p.width / p.height;
  const pick = (n: number, key: (v: number) => number): number => {
    const lo = Math.floor(n);
    const hi = Math.ceil(n);
    return Math.max(key(hi) < key(lo) ? hi : lo, 1);
  };
  return width / height >= aspect
    ? [pick(height * aspect, (n) => Math.abs(aspect - n / height)), height]
    : [width, pick(width / aspect, (n) => (n === 0 ? 0 : Math.abs(aspect - width / n)))];
}

/**
 * A multi-size icon file of PNG frames, as Pillow writes one: one frame for each size asked that is at most the picture's width, height
 * and 256, smallest first, each the picture fitted in that square (`thumbnailSize`) and resized (`resize`).
 */
export async function writeIco(p: Picture, sizes: readonly number[]): Promise<Uint8Array> {
  const frames: Picture[] = [];
  for (const s of [...new Set(sizes)].sort((a, b) => a - b).filter((s) => isSize(s) && s <= p.width && s <= p.height && s <= 256)) {
    const t = s === p.width && s === p.height ? undefined : thumbnailSize(p, s, s);
    frames.push(t === undefined ? p : resize(p, t[0], t[1]));
  }
  const pngs = await Promise.all(frames.map(writePng));
  const head = new Uint8Array(6 + 16 * frames.length);
  const v = new DataView(head.buffer);
  v.setUint16(2, 1, true);
  v.setUint16(4, frames.length, true);
  let offset = head.length;
  frames.forEach((f, i) => {
    const e = 6 + 16 * i;
    const size = pngs[i]?.length ?? 0;
    head[e] = f.width < 256 ? f.width : 0;
    head[e + 1] = f.height < 256 ? f.height : 0;
    v.setUint16(e + 6, 32, true);
    v.setUint32(e + 8, size, true);
    v.setUint32(e + 12, offset, true);
    offset += size;
  });
  return concat([head, ...pngs]);
}

/** Every frame of an icon file whose frames are PNGs, in the order of its directory; or why it cannot be read. */
export async function readIco(bytes: Uint8Array): Promise<Result<readonly Picture[], PngError>> {
  if (bytes.length < 6 || bytes[0] !== 0 || bytes[1] !== 0 || bytes[2] !== 1 || bytes[3] !== 0)
    return err({ kind: "signature", format: "ico" });
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = v.getUint16(4, true);
  if (6 + 16 * count > bytes.length) return truncated(`the icon directory of ${count} frames runs past the end`);
  const out: Picture[] = [];
  for (let i = 0; i < count; i++) {
    const e = 6 + 16 * i;
    const size = v.getUint32(e + 8, true);
    const offset = v.getUint32(e + 12, true);
    if (offset + size > bytes.length) return truncated(`frame ${i} of the icon file runs past the end`);
    const frame = bytes.subarray(offset, offset + size);
    if (SIGNATURE.some((b, k) => frame[k] !== b)) return unsupported(`frame ${i} of the icon file is not a PNG (a BMP frame)`);
    const p = await readPng(frame);
    if (p.kind === "err") return err({ kind: "ico-frame", index: i, error: p.error });
    out.push(p.value);
  }
  return ok(out);
}

/** Whether two pictures have the same size and the same RGBA pixels (a picture without alpha taken as opaque). */
export function samePixels(a: Picture, b: Picture): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  const x = rgbaOf(a).data;
  const y = rgbaOf(b).data;
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** Whether two PNG files, or two icon files, hold the same pictures pixel for pixel, whatever their zlib streams; false where either cannot be read. */
export async function samePicture(a: Uint8Array, b: Uint8Array): Promise<boolean> {
  if (a.length === b.length && a.every((x, i) => x === b[i])) return true;
  const isIco = (x: Uint8Array): boolean => x[0] === 0 && x[1] === 0 && x[2] === 1 && x[3] === 0;
  if (isIco(a) && isIco(b)) {
    const [x, y] = [await readIco(a), await readIco(b)];
    return (
      x.kind === "ok" &&
      y.kind === "ok" &&
      x.value.length === y.value.length &&
      x.value.every((f, i) => {
        const g = y.value[i];
        return g !== undefined && samePixels(f, g);
      })
    );
  }
  const [x, y] = [await readPng(a), await readPng(b)];
  return x.kind === "ok" && y.kind === "ok" && samePixels(x.value, y.value);
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A `#rrggbb` or `#rgb` colour (the `#` optional, any case) as its channels; `undefined` for what is not one. */
export function hexRgb(hex: string): Rgb | undefined {
  const digits = HEX.exec(hex)?.[1];
  if (digits === undefined) return undefined;
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits;
  const c = (i: number): number => Number.parseInt(full.slice(i, i + 2), 16);
  return [c(0), c(2), c(4)];
}

/** A colour's relative luminance as WCAG 2 measures it, from 0 (black) to 1 (white). */
export function luminance(rgb: Rgb): number {
  const linear = (v: number): number => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}
