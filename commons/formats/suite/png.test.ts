/**
 * Tests of `png.ts`: pictures written and read back are the same (property-tested), every filter type and every colour type and
 * bit depth is read from PNGs built here by hand (stored zlib blocks, CRCs computed), corrupt and hostile files are refused with the right
 * kind of error, and the laws of resizing, premultiplying, compositing and icon files hold.
 *
 * @module
 */
import fc from "fast-check";
import { crc32 } from "../src/archive.ts";
import {
  composite,
  filled,
  flatOn,
  formatPngError,
  hexRgb,
  luminance,
  MAX_PIXELS,
  type Picture,
  type PngError,
  premultiply,
  readIco,
  readPng,
  resize,
  resizeChannels,
  rgbaOf,
  rgbOf,
  samePicture,
  samePixels,
  thumbnailSize,
  unpremultiply,
  writeIco,
  writePng,
} from "../src/png.ts";
import type { Result } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertRejects, assertThrows, proves } from "@intellectual-frontiers/test";

const FR = "0001-formats FR-012";
const LAW = "0005-typescript-runtime FR-014";

/* ---- PNGs by hand ---- */

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function join(parts: readonly (Uint8Array | readonly number[])[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A zlib stream of stored deflate blocks, with its Adler-32. */
function zlibStored(data: Uint8Array): Uint8Array {
  const parts: (Uint8Array | number[])[] = [[0x78, 0x01]];
  for (let at = 0; at < data.length || at === 0; at += 65535) {
    const block = data.subarray(at, at + 65535);
    const last = at + 65535 >= data.length ? 1 : 0;
    parts.push([last, block.length & 0xff, block.length >> 8, ~block.length & 0xff, (~block.length >> 8) & 0xff], block);
    if (data.length === 0) break;
  }
  let a = 1;
  let b = 0;
  for (const x of data) {
    a = (a + x) % 65521;
    b = (b + a) % 65521;
  }
  parts.push(u32(((b << 16) | a) >>> 0));
  return join(parts);
}

function chunk(type: string, data: Uint8Array | readonly number[]): Uint8Array {
  const body = join([new TextEncoder().encode(type), data]);
  return join([u32(body.length - 4), body, u32(crc32(body))]);
}

type Ihdr = {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly colour: number;
  readonly interlace?: number;
};

function ihdr(h: Ihdr): Uint8Array {
  return chunk("IHDR", [...u32(h.width), ...u32(h.height), h.depth, h.colour, 0, 0, h.interlace ?? 0]);
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG of the given header and filtered scanlines (each row its filter byte, then its bytes), with extra chunks before its IDAT. */
function png(h: Ihdr, scanlines: readonly (readonly number[])[], extra: readonly Uint8Array[] = []): Uint8Array {
  return join([SIGNATURE, ihdr(h), ...extra, chunk("IDAT", zlibStored(Uint8Array.from(scanlines.flat()))), chunk("IEND", [])]);
}

function rgba(p: Result<Picture, PngError>): number[] {
  if (p.kind === "err") throw new Error(formatPngError(p.error));
  return [...p.value.data];
}

function kindOf<T>(r: Result<T, PngError>): string {
  return r.kind === "ok" ? "ok" : r.error.kind;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Rows filtered by the encoder's rule, each with its filter type in front. */
function filterRows(rows: readonly Uint8Array[], filters: readonly number[], bpp: number): number[][] {
  return rows.map((row, y) => {
    const prev = rows[y - 1];
    const f = filters[y] ?? 0;
    const out = [f];
    for (let x = 0; x < row.length; x++) {
      const a = x >= bpp ? (row[x - bpp] ?? 0) : 0;
      const b = prev?.[x] ?? 0;
      const c = x >= bpp ? (prev?.[x - bpp] ?? 0) : 0;
      const p = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
      out.push(((row[x] ?? 0) - p) & 0xff);
    }
    return out;
  });
}

/* ---- arbitraries ---- */

const picture = (channels: 3 | 4, max = 12): fc.Arbitrary<Picture> =>
  fc
    .record({ width: fc.integer({ min: 1, max }), height: fc.integer({ min: 1, max }) }, { noNullPrototype: true })
    .chain(({ width, height }) =>
      fc
        .uint8Array({ minLength: width * height * channels, maxLength: width * height * channels })
        .map((data): Picture => ({ width, height, channels, data })),
    );

const anyPicture = fc.oneof(picture(3), picture(4));

const opaque = picture(4).map((p): Picture => {
  const data = p.data.slice();
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return { ...p, data };
});

/* ---- laws ---- */

proves([FR, LAW], "a picture written and read back is the same picture, as RGBA", async () => {
  await fc.assert(
    fc.asyncProperty(anyPicture, async (p) => {
      const back = await readPng(await writePng(p));
      assertEquals(rgba(back), [...rgbaOf(p).data]);
      assert(back.kind === "ok" && samePixels(back.value, p));
    }),
    { numRuns: 80 },
  );
});

proves([FR, LAW], "random pixels filtered row by row with any filter types are read back exactly", async () => {
  const filtered = fc
    .record(
      { samples: fc.constantFrom(1, 2, 3, 4), width: fc.integer({ min: 1, max: 9 }), height: fc.integer({ min: 1, max: 9 }) },
      { noNullPrototype: true },
    )
    .chain(({ samples, width, height }) =>
      fc.record(
        {
          samples: fc.constant(samples),
          width: fc.constant(width),
          height: fc.constant(height),
          data: fc.uint8Array({ minLength: width * height * samples, maxLength: width * height * samples }),
          filters: fc.array(fc.integer({ min: 0, max: 4 }), { minLength: height, maxLength: height }),
        },
        { noNullPrototype: true },
      ),
    );
  await fc.assert(
    fc.asyncProperty(filtered, async ({ samples, width, height, data, filters }) => {
      const colour = [0, 0, 4, 2, 6][samples] ?? 0;
      const rows = Array.from({ length: height }, (_, y) => data.subarray(y * width * samples, (y + 1) * width * samples));
      const read = rgba(await readPng(png({ width, height, depth: 8, colour }, filterRows(rows, filters, samples))));
      const expected: number[] = [];
      for (let i = 0; i < width * height; i++) {
        const s = (k: number): number => data[i * samples + k] ?? 0;
        if (samples === 1) expected.push(s(0), s(0), s(0), 255);
        else if (samples === 2) expected.push(s(0), s(0), s(0), s(1));
        else if (samples === 3) expected.push(s(0), s(1), s(2), 255);
        else expected.push(s(0), s(1), s(2), s(3));
      }
      assertEquals(read, expected);
    }),
    { numRuns: 100 },
  );
});

proves([FR, LAW], "a resize gives the size asked, and a picture of one colour stays that colour", () => {
  const colour = fc.tuple(fc.nat(255), fc.nat(255), fc.nat(255), fc.nat(255));
  const size = fc.integer({ min: 1, max: 40 });
  fc.assert(
    fc.property(colour, size, size, size, size, (c, w, h, w2, h2) => {
      const p = filled(w, h, c);
      const raw = resizeChannels(p, w2, h2);
      assertEquals([raw.width, raw.height, raw.channels, raw.data.length], [w2, h2, 4, w2 * h2 * 4]);
      assertEquals(raw.data, filled(w2, h2, c).data);
      const opaqueColour = [c[0], c[1], c[2], 255] as const;
      assertEquals(resize(filled(w, h, opaqueColour), w2, h2).data, filled(w2, h2, opaqueColour).data);
      const pre = resize(p, w2, h2);
      assertEquals([pre.width, pre.height], [w2, h2]);
      const first = [...pre.data.subarray(0, 4)];
      for (let i = 0; i < w2 * h2; i++) assertEquals([...pre.data.subarray(i * 4, i * 4 + 4)], first);
    }),
    { numRuns: 60 },
  );
  fc.assert(
    fc.property(anyPicture, size, size, (p, w, h) => {
      const r = resize(p, w, h);
      assertEquals([r.width, r.height, r.channels, r.data.length], [w, h, p.channels, w * h * p.channels]);
    }),
    { numRuns: 60 },
  );
});

proves([FR, LAW], "premultiply then unpremultiply gives an opaque picture back, and a picture without alpha is untouched", () => {
  fc.assert(
    fc.property(opaque, (p) => {
      assertEquals(premultiply(p).data, p.data);
      assertEquals(unpremultiply(premultiply(p)).data, p.data);
    }),
    { numRuns: 60 },
  );
  fc.assert(
    fc.property(picture(3), (p) => {
      assertEquals(premultiply(p), p);
      assertEquals(unpremultiply(p), p);
    }),
    { numRuns: 20 },
  );
});

proves([FR, LAW], "a fully transparent overlay, wherever it is laid, changes nothing", () => {
  const offset = fc.integer({ min: -15, max: 15 });
  fc.assert(
    fc.property(picture(4), picture(4), offset, offset, (base, over, left, top) => {
      const clear = { ...over, data: over.data.map((v, i) => (i % 4 === 3 ? 0 : v)) };
      assertEquals(composite(base, clear, left, top), base);
    }),
    { numRuns: 80 },
  );
});

proves([FR, LAW], "an opaque overlay replaces the pixels it covers", () => {
  fc.assert(
    fc.property(picture(4), opaque, (base, over) => {
      const out = composite(base, over, 0, 0);
      for (let y = 0; y < Math.min(base.height, over.height); y++) {
        for (let x = 0; x < Math.min(base.width, over.width); x++) {
          const i = (y * base.width + x) * 4;
          const j = (y * over.width + x) * 4;
          assertEquals([...out.data.subarray(i, i + 4)], [...over.data.subarray(j, j + 4)]);
        }
      }
    }),
    { numRuns: 60 },
  );
});

proves(
  [FR, LAW],
  "an icon file written and read back holds one frame per size that fits, the full-size one the picture itself",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 40 }), picture(4, 40), async (side, p) => {
        const square = filled(side, side, [1, 2, 3, 4]);
        const sq = await readIco(await writeIco(square, [side]));
        assert(sq.kind === "ok");
        assertEquals(sq.value, [square]);
        const sizes = [16, 8, 32, 8, 4];
        const frames = await readIco(await writeIco(p, sizes));
        assert(frames.kind === "ok");
        const fit = [4, 8, 16, 32].filter((s) => s <= p.width && s <= p.height);
        assertEquals(frames.value.length, fit.length);
        frames.value.forEach((f, i) => {
          const s = fit[i] ?? 0;
          assertEquals(Math.max(f.width, f.height), s === p.width && s === p.height ? p.width : s);
        });
      }),
      { numRuns: 40 },
    );
  },
);

/* ---- fixed vectors ---- */

proves([FR], "each filter type (None, Sub, Up, Average, Paeth) is undone as the PNG specification defines", async () => {
  const scan = [
    [0, 7, 8, 9],
    [1, 10, 20, 30],
    [2, 1, 1, 1],
    [3, 5, 5, 5],
    [4, 1, 1, 1],
    [1, 200, 100, 0],
  ];
  const p = await readPng(png({ width: 3, height: 6, depth: 8, colour: 0 }, scan));
  const greys = rgba(p).filter((_, i) => i % 4 === 0);
  assertEquals(greys, [7, 8, 9, 10, 30, 60, 11, 31, 61, 10, 25, 48, 11, 26, 49, 200, 44, 44]);
});

proves([FR], "greyscale at 1, 2, 4, 8 and 16 bits is scaled to eight bits, and its tRNS colour made transparent", async () => {
  const grey = async (depth: number, width: number, row: readonly number[], extra: readonly Uint8Array[] = []): Promise<number[]> =>
    rgba(await readPng(png({ width, height: 1, depth, colour: 0 }, [[0, ...row]], extra)));
  assertEquals(await grey(1, 4, [0b10110000]), [255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  assertEquals(await grey(2, 3, [0b00011000]), [0, 0, 0, 255, 85, 85, 85, 255, 170, 170, 170, 255]);
  assertEquals(await grey(4, 2, [0x0f]), [0, 0, 0, 255, 255, 255, 255, 255]);
  assertEquals(await grey(16, 1, [0x12, 0x34]), [0x12, 0x12, 0x12, 255]);
  assertEquals(await grey(8, 2, [7, 8], [chunk("tRNS", [0, 7])]), [7, 7, 7, 0, 8, 8, 8, 255]);
  assertEquals(await grey(2, 2, [0b01100000], [chunk("tRNS", [0, 1])]), [85, 85, 85, 0, 170, 170, 170, 255]);
});

proves([FR], "greyscale with alpha, RGB (with its tRNS colour) and RGBA are read at 8 and 16 bits", async () => {
  const one = async (h: Ihdr, row: readonly number[], extra: readonly Uint8Array[] = []): Promise<number[]> =>
    rgba(await readPng(png(h, [[0, ...row]], extra)));
  assertEquals(await one({ width: 1, height: 1, depth: 8, colour: 4 }, [50, 128]), [50, 50, 50, 128]);
  assertEquals(await one({ width: 1, height: 1, depth: 16, colour: 4 }, [50, 1, 128, 2]), [50, 50, 50, 128]);
  assertEquals(
    await one({ width: 2, height: 1, depth: 8, colour: 2 }, [1, 2, 3, 4, 5, 6], [chunk("tRNS", [0, 4, 0, 5, 0, 6])]),
    [1, 2, 3, 255, 4, 5, 6, 0],
  );
  assertEquals(await one({ width: 1, height: 1, depth: 16, colour: 2 }, [0xab, 0, 0xcd, 0, 0xef, 0]), [0xab, 0xcd, 0xef, 255]);
  assertEquals(await one({ width: 1, height: 1, depth: 8, colour: 6 }, [9, 8, 7, 6]), [9, 8, 7, 6]);
  assertEquals(await one({ width: 1, height: 1, depth: 16, colour: 6 }, [9, 0, 8, 0, 7, 0, 6, 0xff]), [9, 8, 7, 6]);
});

proves([FR], "a palette picture at 8 and 2 bits takes its colours from PLTE and its alpha from tRNS", async () => {
  const plte = chunk("PLTE", [255, 0, 0, 0, 255, 0, 0, 0, 255]);
  const trns = chunk("tRNS", [0x80]);
  assertEquals(
    rgba(await readPng(png({ width: 3, height: 1, depth: 8, colour: 3 }, [[0, 0, 1, 2]], [plte, trns]))),
    [255, 0, 0, 128, 0, 255, 0, 255, 0, 0, 255, 255],
  );
  assertEquals(
    rgba(await readPng(png({ width: 3, height: 1, depth: 2, colour: 3 }, [[0, 0b10010000]], [plte]))),
    [0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255],
  );
});

proves([FR], "corrupt and hostile files are refused with the kind of error that says what is wrong", async () => {
  const good = png({ width: 2, height: 1, depth: 8, colour: 0 }, [[0, 1, 2]]);
  assertEquals(kindOf(await readPng(good)), "ok");
  const flipped = good.slice();
  flipped[29] = (flipped[29] ?? 0) ^ 1;
  const crc = await readPng(flipped);
  assertEquals(crc.kind === "err" ? crc.error : undefined, { kind: "crc", chunk: "IHDR", at: 8 });
  assertEquals(kindOf(await readPng(good.subarray(0, good.length - 5))), "truncated");
  assertEquals(kindOf(await readPng(good.subarray(0, 40))), "truncated");
  assertEquals(kindOf(await readPng(new Uint8Array())), "signature");
  assertEquals(kindOf(await readPng(join([[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00], good.subarray(8)]))), "signature");
  assertEquals(kindOf(await readPng(png({ width: 2, height: 1, depth: 8, colour: 0, interlace: 1 }, [[0, 1, 2]]))), "interlaced");
  const huge = await readPng(png({ width: 100_000, height: 100_000, depth: 8, colour: 6 }, [[0]]));
  assertEquals(huge.kind === "err" ? huge.error : undefined, { kind: "too-large", width: 100_000, height: 100_000, limit: MAX_PIXELS });
  assertEquals(kindOf(await readPng(png({ width: 0x7fffffff, height: 0x7fffffff, depth: 16, colour: 6 }, [[0]]))), "too-large");
  assertEquals(kindOf(await readPng(png({ width: 1, height: 1, depth: 4, colour: 2 }, [[0, 0]]))), "unsupported");
  assertEquals(kindOf(await readPng(png({ width: 1, height: 1, depth: 8, colour: 5 }, [[0, 0]]))), "unsupported");
  assertEquals(kindOf(await readPng(png({ width: 1, height: 1, depth: 8, colour: 0 }, [[0, 0]], [chunk("ABCD", [])]))), "unsupported");
  assertEquals(kindOf(await readPng(png({ width: 1, height: 1, depth: 8, colour: 0 }, [[0, 0]], [chunk("abCD", [1])]))), "ok");
  assertEquals(kindOf(await readPng(png({ width: 0, height: 1, depth: 8, colour: 0 }, [[0]]))), "malformed");
  assertEquals(kindOf(await readPng(png({ width: 2, height: 1, depth: 8, colour: 0 }, [[5, 1, 2]]))), "malformed");
  assertEquals(kindOf(await readPng(png({ width: 2, height: 1, depth: 8, colour: 0 }, [[0, 1]]))), "truncated");
  assertEquals(kindOf(await readPng(png({ width: 2, height: 1, depth: 8, colour: 0 }, [[0, 1, 2, 3]]))), "malformed");
  assertEquals(kindOf(await readPng(png({ width: 1, height: 1, depth: 8, colour: 3 }, [[0, 0]]))), "malformed");
  assertEquals(kindOf(await readPng(png({ width: 1, height: 1, depth: 8, colour: 3 }, [[0, 1]], [chunk("PLTE", [1, 2, 3])]))), "malformed");
  const garbage = join([SIGNATURE, ihdr({ width: 1, height: 1, depth: 8, colour: 0 }), chunk("IDAT", [1, 2, 3, 4]), chunk("IEND", [])]);
  assertEquals(kindOf(await readPng(garbage)), "malformed");
  const noIdat = join([SIGNATURE, ihdr({ width: 1, height: 1, depth: 8, colour: 0 }), chunk("IEND", [])]);
  assertEquals(kindOf(await readPng(noIdat)), "malformed");
  const kinds: readonly PngError[] = [
    { kind: "signature", format: "ico" },
    { kind: "interlaced" },
    { kind: "ico-frame", index: 2, error: { kind: "truncated", message: "x" } },
  ];
  for (const e of kinds) assert(formatPngError(e).length > 0);
});

proves([FR], "a damaged icon file is refused: no header, a frame past the end, a frame that is not a PNG, a damaged frame", async () => {
  const ico = await writeIco(filled(4, 4, [1, 2, 3, 4]), [4]);
  assertEquals(kindOf(await readIco(ico)), "ok");
  assertEquals(kindOf(await readIco(Uint8Array.of(0, 0, 2, 0, 0, 0))), "signature");
  assertEquals(kindOf(await readIco(ico.subarray(0, ico.length - 1))), "truncated");
  const bmp = ico.slice();
  bmp[22] = 0x28;
  assertEquals(kindOf(await readIco(bmp)), "unsupported");
  const damaged = ico.slice();
  damaged[22 + 30] = (damaged[22 + 30] ?? 0) ^ 1;
  const r = await readIco(damaged);
  assertEquals(r.kind === "err" ? [r.error.kind, r.error.kind === "ico-frame" ? r.error.error.kind : ""] : [], ["ico-frame", "crc"]);
});

proves([FR], "two files are the same picture when their pixels are, whatever their zlib streams", async () => {
  const p: Picture = { width: 2, height: 1, channels: 4, data: Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8) };
  const byHand = png({ width: 2, height: 1, depth: 8, colour: 6 }, [[0, 1, 2, 3, 4, 5, 6, 7, 8]]);
  const ours = await writePng(p);
  assert(await samePicture(byHand, ours));
  assert(!(await samePicture(byHand, await writePng(filled(2, 1, [1, 2, 3, 4])))));
  assert(await samePicture(await writeIco(filled(8, 8, [9, 9, 9, 9]), [8, 4]), await writeIco(filled(8, 8, [9, 9, 9, 9]), [4, 8])));
  assert(!(await samePicture(Uint8Array.of(1), Uint8Array.of(2))));
});

proves([FR], "thumbnail sizes, flattening on a colour and the conversions between RGB and RGBA", () => {
  const wide = filled(100, 50, [0, 0, 0, 255]);
  assertEquals(thumbnailSize(wide, 32, 32), [32, 16]);
  assertEquals(thumbnailSize(filled(50, 100, [0, 0, 0, 255]), 32, 32), [16, 32]);
  assertEquals(thumbnailSize(wide, 100, 50), undefined);
  const art = filled(1, 1, [255, 255, 255, 0]);
  const flat = flatOn([10, 20, 30], 2, 1, art, 1, 0);
  assertEquals(flat, { width: 2, height: 1, channels: 3, data: Uint8Array.of(10, 20, 30, 10, 20, 30) });
  assertEquals(rgbOf(rgbaOf(flat)), flat);
  const half = composite(filled(1, 1, [0, 0, 0, 255]), filled(1, 1, [255, 255, 255, 128]), 0, 0);
  assertEquals([...half.data], [128, 128, 128, 255]);
  assertThrows(() => filled(0, 1, [0, 0, 0, 0]), RangeError);
  assertThrows(() => resize(wide, 0, 3), RangeError);
});

proves([FR], "writing a malformed picture is a programming error", async () => {
  await assertRejects(() => writePng({ width: 2, height: 2, channels: 4, data: new Uint8Array(3) }), RangeError);
});

proves([FR], "hex colours are read into channels, and their luminance is WCAG's", () => {
  assertEquals(hexRgb("#ff8000"), [255, 128, 0]);
  assertEquals(hexRgb("FF8000"), [255, 128, 0]);
  assertEquals(hexRgb("#f80"), [255, 136, 0]);
  assertEquals(hexRgb("#ff800"), undefined);
  assertEquals(hexRgb("#gg0000"), undefined);
  assertEquals(luminance([0, 0, 0]), 0);
  assert(Math.abs(luminance([255, 255, 255]) - 1) < 1e-12);
  assert(Math.abs(luminance([255, 0, 0]) - 0.2126) < 1e-12);
  fc.assert(
    fc.property(fc.tuple(fc.nat(255), fc.nat(255), fc.nat(255)), (c) => {
      const hex = `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      assertEquals(hexRgb(hex), c);
      const l = luminance(c);
      assert(l >= 0 && l <= 1 + 1e-12);
    }),
  );
});
