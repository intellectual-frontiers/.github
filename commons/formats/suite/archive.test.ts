/**
 * Tests of `archive.ts`: archives written and read back are the files they hold (property-tested), the same files give the same
 * bytes, a damaged or unsafe archive is refused, and a deflated zip and a gzip made by the platform's own `CompressionStream` are read; a
 * zip of deflated entries is written through that `CompressionStream`, the same bytes twice on one runtime and the files back everywhere;
 * a tar read as a stream gives what `untar` gives, refuses what it refuses, and reads a large archive fed in small chunks.
 *
 * @module
 */
import fc from "fast-check";
import {
  crc32,
  filesOf,
  formatArchiveError,
  gunzip,
  gzip,
  isSafePath,
  sortedPaths,
  splitName,
  tar,
  ArchiveFailure,
  type ArchiveError,
  untar,
  untarStream,
  unzip,
  zip,
  zipDeflated,
  zipEntries,
} from "../src/archive.ts";
import { createHash } from "node:crypto";
import { ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertInstanceOf, assertRejects, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const FR = "0001-formats FR-010";
const enc = new TextEncoder();

const segment = fc.stringMatching(/^[A-Za-z0-9_.-]{1,20}$/).filter((s) => s !== "." && s !== "..");
const path = fc.array(segment, { minLength: 1, maxLength: 4 }).map((xs) => xs.join("/"));
/** Files whose paths are not a folder of another file. */
const files = fc
  .uniqueArray(fc.tuple(path, fc.uint8Array({ maxLength: 2000 })), { selector: ([p]) => p, maxLength: 8 })
  .filter((entries) => entries.every(([p]) => !entries.some(([q]) => q.startsWith(`${p}/`))))
  .map((entries) => new Map(entries));

const sorted = (m: ReadonlyMap<string, Uint8Array>): [string, Uint8Array][] =>
  sortedPaths(m.keys()).map((k) => [k, m.get(k) ?? new Uint8Array()]);

proves([FR, "0005-typescript-runtime FR-014"], "tar then untar gives the files back, the same bytes every time", () => {
  fc.assert(
    fc.property(files, (fs) => {
      const t = tar(fs);
      if (t.kind === "err") throw new Error(formatArchiveError(t.error));
      assertEquals(t, tar(fs));
      assertEquals(t.value.length % 512, 0);
      const back = untar(t.value);
      if (back.kind === "err") throw new Error(formatArchiveError(back.error));
      assertEquals(sorted(filesOf(back.value)), sorted(fs));
    }),
    { numRuns: 60 },
  );
});

proves([FR, "0005-typescript-runtime FR-014"], "zip then unzip, and gzip then gunzip, give the bytes back", async () => {
  await fc.assert(
    fc.asyncProperty(files, async (fs) => {
      const z = zip(fs);
      assertEquals(z, zip(fs));
      const back = await unzip(z);
      if (back.kind === "err") throw new Error(formatArchiveError(back.error));
      assertEquals(sorted(back.value), sorted(fs));
    }),
    { numRuns: 40 },
  );
  await fc.assert(
    fc.asyncProperty(fc.uint8Array({ maxLength: 140_000 }), async (data) => {
      assertEquals(await gunzip(gzip(data)), ok(data));
    }),
    { numRuns: 15 },
  );
});

proves([FR], "the CRC-32 check value, and the gzip of stored blocks byte for byte", () => {
  assertEquals(crc32(enc.encode("123456789")), 0xcbf43926);
  assertEquals(crc32(new Uint8Array()), 0);
  const data = new Uint8Array(70_000).fill(7);
  const g = gzip(data);
  const u32 = (b: Uint8Array, at: number): number => new DataView(b.buffer, b.byteOffset).getUint32(at, true);
  assertEquals([...g.subarray(0, 3)], [0x1f, 0x8b, 8]);
  assertEquals(u32(g, g.length - 4), 70_000);
  assertEquals(u32(g, g.length - 8), crc32(data));
  assertEquals(g.length, 10 + 5 + 65_535 + 5 + (70_000 - 65_535) + 8);
});

proves([FR], "a long path is split into the ustar prefix and name; one that cannot be is refused", () => {
  const long = `${"a".repeat(120)}/${"b".repeat(90)}`;
  assertEquals(splitName(long), ["a".repeat(120), "b".repeat(90)]);
  const t = tar(new Map([[long, enc.encode("x")]]));
  assert(t.kind === "ok");
  const back = untar(t.value);
  assert(back.kind === "ok");
  assertEquals([...filesOf(back.value).keys()], [long]);
  assertEquals(tar(new Map([["c".repeat(300), new Uint8Array()]])), { kind: "err", error: { kind: "too-long", path: "c".repeat(300) } });
});

proves([FR], "a path that would leave its folder is refused, in writing and in reading", async () => {
  for (const bad of ["/etc/passwd", "../x", "a/../../x", "a\\b", "C:/x", "a//b", "", "./a"]) assert(!isSafePath(bad), bad);
  for (const good of ["a", "a/b.txt", "a/b/", ".hidden/x"]) assert(isSafePath(good), good);
  assertEquals(tar(new Map([["../evil", new Uint8Array()]])).kind, "err");
  const z = zip(new Map([["../evil", enc.encode("x")]]));
  assertEquals(await unzip(z), { kind: "err", error: { kind: "unsafe-path", path: "../evil" } });
});

proves([FR], "a damaged archive is refused: a tar checksum, a zip CRC, a truncated stream", async () => {
  const t = tar(new Map([["a.txt", enc.encode("hello")]]));
  assert(t.kind === "ok");
  const bad = new Uint8Array(t.value);
  bad[0] = (bad[0] ?? 0) ^ 1;
  assertEquals(untar(bad).kind, "err");
  assertEquals(untar(t.value.subarray(0, 512)).kind, "err");
  const z = zip(new Map([["a.txt", enc.encode("hello")]]));
  const zb = new Uint8Array(z);
  zb[30 + 5] = (zb[30 + 5] ?? 0) ^ 1;
  const r = await unzip(zb);
  assertEquals(r.kind === "err" ? r.error.kind : "ok", "damaged");
  assertEquals(zipEntries(new Uint8Array(10)).kind, "err");
  assertEquals((await gunzip(gzip(enc.encode("hello")).subarray(0, 20))).kind, "err");
  assertEquals((await gunzip(new Uint8Array(30))).kind, "err");
});

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

proves([FR], "a zip whose entry is deflated, and a gzip the platform compressed, are read", async () => {
  const text = enc.encode("hello hello hello hello hello");
  const deflated = await deflateRaw(text);
  const name = enc.encode("d.txt");
  const head = new Uint8Array(30 + name.length);
  const v = new DataView(head.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(8, 8, true);
  v.setUint32(14, crc32(text), true);
  v.setUint32(18, deflated.length, true);
  v.setUint32(22, text.length, true);
  v.setUint16(26, name.length, true);
  head.set(name, 30);
  const cd = new Uint8Array(46 + name.length);
  const c = new DataView(cd.buffer);
  c.setUint32(0, 0x02014b50, true);
  c.setUint16(10, 8, true);
  c.setUint32(16, crc32(text), true);
  c.setUint32(20, deflated.length, true);
  c.setUint32(24, text.length, true);
  c.setUint16(28, name.length, true);
  c.setUint32(42, 0, true);
  cd.set(name, 46);
  const eocd = new Uint8Array(22);
  const e = new DataView(eocd.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, 1, true);
  e.setUint16(10, 1, true);
  e.setUint32(12, cd.length, true);
  e.setUint32(16, head.length + deflated.length, true);
  const archive = new Uint8Array([...head, ...deflated, ...cd, ...eocd]);
  const r = await unzip(archive);
  assert(r.kind === "ok");
  assertEquals(r.value.get("d.txt"), text);
  const gz = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  assertEquals(await gunzip(gz), ok(text));
});

proves(
  [FR, "0005-typescript-runtime FR-014"],
  "a zip of deflated entries: the files back, the same bytes twice, stored where deflate would not shrink",
  async () => {
    await fc.assert(
      fc.asyncProperty(files, async (fs) => {
        const z = await zipDeflated(fs);
        assertEquals(z, await zipDeflated(fs));
        const back = await unzip(z);
        if (back.kind === "err") throw new Error(formatArchiveError(back.error));
        assertEquals(sorted(back.value), sorted(fs));
      }),
      { numRuns: 30 },
    );
    const text = enc.encode("the same line again\n".repeat(200));
    const noise = Uint8Array.from({ length: 16 }, (_, i) => (i * 167 + 13) & 0xff);
    const z = await zipDeflated(
      new Map([
        ["text.txt", text],
        ["noise.bin", noise],
        ["empty", new Uint8Array()],
      ]),
    );
    const entries = zipEntries(z);
    assert(entries.kind === "ok");
    assertEquals(
      entries.value.map((e) => [e.name, e.method, e.size]),
      [
        ["empty", 0, 0],
        ["noise.bin", 0, 16],
        ["text.txt", 8, text.length],
      ],
    );
    const deflated = entries.value[2];
    assert(deflated !== undefined && deflated.compressed < deflated.size / 10);
    assertEquals((await unzip(z)).kind, "ok");
    // Where nothing shrinks, the deflating writer lays out the same bytes as the stored one.
    const stored = new Map([
      ["noise.bin", noise],
      ["empty", new Uint8Array()],
    ]);
    assertEquals(await zipDeflated(stored), zip(stored));
  },
);

/** One tar header of a name, type and body (mode 0644), with its body padded. */
const block = (name: string, type: string, body: Uint8Array): Uint8Array => {
  const h = new Uint8Array(512);
  h.set(enc.encode(name), 0);
  h.set(enc.encode("0000644\0"), 100);
  h.set(enc.encode(`${body.length.toString(8).padStart(11, "0")}\0`), 124);
  h.set(enc.encode("        "), 148);
  h[156] = type.charCodeAt(0);
  h.set(enc.encode("ustar\0"), 257);
  h.set(enc.encode("00"), 263);
  const sum = h.reduce((s, b) => s + b, 0);
  h.set(enc.encode(`${sum.toString(8).padStart(6, "0")}\0 `), 148);
  const pad = new Uint8Array((512 - (body.length % 512)) % 512);
  return new Uint8Array([...h, ...body, ...pad]);
};
/** One pax record, its length counted in itself. */
const record = (key: string, value: string): string => {
  const tail = ` ${key}=${value}\n`;
  let n = tail.length + 1;
  while (`${n}${tail}`.length !== n) n++;
  return `${n}${tail}`;
};
/** A tar with a pax global header, a pax path, a GNU long name and a symlink. */
const paxArchive = (longName: string): Uint8Array =>
  new Uint8Array([
    ...block("pax_global_header", "g", enc.encode(record("comment", "a commit"))),
    ...block("PaxHeader", "x", enc.encode(record("path", "pax/named.txt"))),
    ...block("short", "0", enc.encode("one")),
    ...block("././@LongLink", "L", enc.encode(`${longName}\0`)),
    ...block("trunc", "0", enc.encode("two")),
    ...block("link", "2", new Uint8Array()),
    ...new Uint8Array(1024),
  ]);

proves([FR], "a tar with a pax path and a GNU long name is read", () => {
  const longName = `deep/${"x".repeat(200)}.txt`;
  const archive = paxArchive(longName);
  const r = untar(archive);
  assert(r.kind === "ok", r.kind === "err" ? formatArchiveError(r.error) : "");
  assertEquals(
    r.value.map((e) => [e.path, e.kind]),
    [
      ["pax/named.txt", "file"],
      [longName, "file"],
      ["link", "symlink"],
    ],
  );
  assertEquals(filesOf(r.value).get(longName), enc.encode("two"));
});

const STREAM = "0001-formats FR-011";

/** The bytes as a stream, cut into chunks of the sizes given in turn (each at least 1). */
const chunked = (bytes: Uint8Array, sizes: readonly number[]): ReadableStream<Uint8Array> => {
  let at = 0;
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= bytes.length) {
        controller.close();
        return;
      }
      const n = Math.max(1, sizes[i++ % Math.max(1, sizes.length)] ?? bytes.length);
      controller.enqueue(bytes.slice(at, at + n));
      at += n;
    },
  });
};

/** Every entry of a tar read as a stream, as `untar` gives its entries, each body read to its end. */
async function streamed(
  stream: ReadableStream<Uint8Array>,
): Promise<
  { readonly path: string; readonly kind: string; readonly mode: number; readonly data: Uint8Array; readonly linkName: string }[]
> {
  const out = [];
  const reader = stream.pipeThrough(untarStream()).getReader();
  for (;;) {
    const r = await reader.read();
    if (r.done) return out;
    const { path, kind, mode, linkName, size } = r.value;
    const data = new Uint8Array(await new Response(r.value.readable).arrayBuffer());
    assertEquals(data.length, kind === "file" ? size : 0);
    out.push({ path, kind, mode, data, linkName });
  }
}

/** The archive error a stream of entries failed with. */
async function streamError(stream: ReadableStream<Uint8Array>): Promise<ArchiveError> {
  const e = await assertRejects(() => streamed(stream));
  assertInstanceOf(e, ArchiveFailure);
  return e.error;
}

proves([STREAM, FR], "untarStream gives the entries and bytes untar gives, gzipped or not, however the bytes are cut", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.oneof(
        files.map((f) => tar(f)),
        fc.constant(ok(paxArchive(`deep/${"y".repeat(150)}`))),
      ),
      fc.boolean(),
      fc.array(fc.integer({ min: 1, max: 1500 }), { minLength: 1, maxLength: 5 }),
      async (t, gzipped, sizes) => {
        assert(t.kind === "ok");
        const expected = untar(t.value);
        assert(expected.kind === "ok");
        const bytes = gzipped ? gzip(t.value) : t.value;
        assertEquals(
          await streamed(chunked(bytes, sizes)),
          expected.value.map((e) => ({ ...e })),
        );
      },
    ),
    { numRuns: 60 },
  );
});

proves([STREAM, FR], "untarStream refuses a damaged header, a truncated archive, an unsafe path and a damaged gzip", async () => {
  const t = tar(
    new Map([
      ["a.txt", enc.encode("hello")],
      ["b/c.txt", enc.encode("world")],
    ]),
  );
  assert(t.kind === "ok");
  const bad = new Uint8Array(t.value);
  bad[512 + 3] = (bad[512 + 3] ?? 0) ^ 1;
  const damaged = await streamError(chunked(bad, [100]));
  assertEquals(damaged.kind, "damaged");
  assertEquals((await streamError(chunked(t.value.subarray(0, 512 + 100), [64]))).kind, "damaged");
  assertEquals((await streamError(chunked(t.value.subarray(0, 1024), [64]))).kind, "damaged");
  assertEquals((await streamError(chunked(new Uint8Array(), []))).kind, "damaged");
  const evil = new Uint8Array([...block("../evil", "0", enc.encode("x")), ...new Uint8Array(1024)]);
  assertEquals(await streamError(chunked(evil, [512])), { kind: "unsafe-path", path: "../evil" });
  const abs = new Uint8Array([
    ...block("ok.txt", "0", enc.encode("x")),
    ...block("/etc/passwd", "0", enc.encode("x")),
    ...new Uint8Array(1024),
  ]);
  assertEquals(await streamError(chunked(abs, [700])), { kind: "unsafe-path", path: "/etc/passwd" });
  const gz = gzip(t.value);
  const gzBad = new Uint8Array(gz);
  gzBad[gz.length - 6] = (gzBad[gz.length - 6] ?? 0) ^ 1;
  assertEquals((await streamError(chunked(gzBad, [333]))).kind, "damaged");
});

proves([STREAM], "a large gzipped archive fed in small chunks is read an entry at a time, a body cancelled skipped", async () => {
  const big = 6 * 1024 * 1024 + 123;
  const bigBytes = new Uint8Array(big).map((_, i) => (i * 31) >>> 3);
  const t = tar(
    new Map([
      ["a/big.bin", bigBytes],
      ["a/skipped.bin", new Uint8Array(100_000).fill(7)],
      ["z.txt", enc.encode("last")],
    ]),
  );
  assert(t.kind === "ok");
  const gz = new Uint8Array(
    await new Response(new Blob([new Uint8Array(t.value)]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer(),
  );
  const reader = chunked(gz, [4093, 17, 1000]).pipeThrough(untarStream()).getReader();
  const seen: string[] = [];
  let digest: Uint8Array | undefined;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    const e = r.value;
    seen.push(`${e.kind} ${e.path} ${e.size}`);
    if (e.path === "a/big.bin") {
      const h = createHash("md5");
      let largest = 0;
      const body = e.readable.getReader();
      for (;;) {
        const c = await body.read();
        if (c.done) break;
        largest = Math.max(largest, c.value.length);
        h.update(c.value);
      }
      assert(largest < 1024 * 1024, `a chunk of ${largest} bytes was held`);
      digest = new Uint8Array(h.digest());
    } else if (e.path === "z.txt") assertEquals(new TextDecoder().decode(await new Response(e.readable).arrayBuffer()), "last");
    else await e.readable.cancel();
  }
  assertEquals(seen, ["directory a 0", `file a/big.bin ${big}`, "file a/skipped.bin 100000", "file z.txt 4"]);
  assertEquals(digest, new Uint8Array(createHash("md5").update(bigBytes).digest()));
});

proves([STREAM], "cancelling the entries cancels the bytes they are read from", async () => {
  const t = tar(
    new Map([
      ["a.txt", enc.encode("hello")],
      ["b.txt", enc.encode("world")],
    ]),
  );
  assert(t.kind === "ok");
  let cancelled: unknown;
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(t.value.slice(0, 1024));
    },
    cancel(reason) {
      cancelled = reason ?? "cancelled";
    },
  });
  const reader = source.pipeThrough(untarStream()).getReader();
  const first = await reader.read();
  assertEquals(first.done ? undefined : first.value.path, "a.txt");
  await reader.cancel("enough");
  assert(cancelled !== undefined);
});
