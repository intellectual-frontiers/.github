/**
 * Tests of `kernel/archive.ts`: archives written and read back are the files they hold (property-tested), the same files give the same
 * bytes, a damaged or unsafe archive is refused, and a deflated zip and a gzip made by the platform's own `CompressionStream` are read.
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
  untar,
  unzip,
  zip,
  zipEntries,
} from "../../kernel/archive.ts";
import { ok } from "../../kernel/result.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-010";
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

proves([FR], "a tar with a pax path and a GNU long name is read", () => {
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
  const record = (key: string, value: string): string => {
    const tail = ` ${key}=${value}\n`;
    let n = tail.length + 1;
    while (`${n}${tail}`.length !== n) n++;
    return `${n}${tail}`;
  };
  const longName = `deep/${"x".repeat(200)}.txt`;
  const archive = new Uint8Array([
    ...block("pax_global_header", "g", enc.encode(record("comment", "a commit"))),
    ...block("PaxHeader", "x", enc.encode(record("path", "pax/named.txt"))),
    ...block("short", "0", enc.encode("one")),
    ...block("././@LongLink", "L", enc.encode(`${longName}\0`)),
    ...block("trunc", "0", enc.encode("two")),
    ...block("link", "2", new Uint8Array()),
    ...new Uint8Array(1024),
  ]);
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
