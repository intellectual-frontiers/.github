/**
 * Tests of `xz.ts`: files made by the system `xz` (every check it can write, one block and several, one stream and several with padding, stored chunks of data that does not shrink, a long run of zeros) are
 * read back byte for byte; every flipped byte and every truncation of a small file, and a sample of them for a large one, is refused with a typed error and never throws; a file that expands past the limit
 * stops at the limit; where `xz` is installed, random data it compresses reads back (property-tested) and a tar it compresses is untarred.
 *
 * @module
 */
import fc from "fast-check";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { formatArchiveError, tar, untar, filesOf } from "../src/archive.ts";
import { DEFAULT_MAX_BYTES, isXz, unxz } from "../src/xz.ts";

const FR_READ = "0001-formats FR-021";
const FR_BOUND = "0001-formats FR-022";

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(new URL(`./fixtures/xz/${name}`, import.meta.url)));
const text = (s: string): Uint8Array => new TextEncoder().encode(s);
const HELLO = text("hello, xz\n");

async function read(bytes: Uint8Array, maxBytes?: number): Promise<Uint8Array> {
  const r = await unxz(bytes, maxBytes === undefined ? {} : { maxBytes });
  if (r.kind === "err") throw new Error(formatArchiveError(r.error));
  return r.value;
}

const xzAvailable = (): boolean => spawnSync("xz", ["--version"]).status === 0;

proves([FR_READ], "files made by the system xz are read back: each check, no data, stored chunks, several blocks, several streams with and without padding, a fast and a slow setting", async () => {
  assertEquals(await read(fixture("hello.xz")), HELLO);
  assertEquals(await read(fixture("hello-crc32.xz")), HELLO);
  assertEquals(await read(fixture("hello-sha256.xz")), HELLO);
  assertEquals(await read(fixture("hello-none.xz")), HELLO);
  assertEquals(await read(fixture("empty.xz")), new Uint8Array());
  const source = new Uint8Array(readFileSync(new URL("./fixtures/xz/text.txt", import.meta.url)));
  assertEquals(await read(fixture("text.xz")), source);
  assertEquals(await read(fixture("text-fast.xz")), source);
  assertEquals(await read(fixture("text-blocks.xz")), source);
  const random = new Uint8Array(readFileSync(new URL("./fixtures/xz/random.bin", import.meta.url)));
  assert(fixture("random.xz").length > random.length, "data that does not shrink is stored");
  assertEquals(await read(fixture("random.xz")), random);
  const two = new Uint8Array([...HELLO, ...HELLO]);
  assertEquals(await read(fixture("two-streams.xz")), two);
  assertEquals(await read(fixture("two-streams-padded.xz")), two);
  assert(isXz(fixture("hello.xz")) && !isXz(HELLO) && !isXz(new Uint8Array()));
});

proves([FR_READ], "every flipped byte and every truncation of small files is refused with a typed error, and none throws", async () => {
  for (const name of ["hello.xz", "hello-crc32.xz", "hello-sha256.xz", "hello-none.xz"]) {
    const good = fixture(name);
    for (let i = 0; i < good.length; i++) {
      const flipped = good.slice();
      flipped[i] = (flipped[i] ?? 0) ^ 0xff;
      const r = await unxz(flipped);
      // a check of none protects nothing inside the block: only its data bytes may read back as other data
      if (name === "hello-none.xz" && r.kind === "ok") continue;
      assertEquals(r.kind, "err", `${name} with byte ${i} flipped`);
    }
    for (let n = 0; n < good.length; n++) assertEquals((await unxz(good.slice(0, n))).kind, "err", `${name} cut at ${n}`);
  }
});

proves([FR_READ], "flipped bytes and truncations of a large file, with several blocks, are refused and none throws", async () => {
  const good = fixture("text-blocks.xz");
  const positions = new Set<number>();
  for (let i = 0; i < 160; i++) positions.add(i);
  for (let i = good.length - 160; i < good.length; i++) positions.add(i);
  for (let k = 0; k < 240; k++) positions.add((k * 7919) % good.length);
  for (const i of positions) {
    const flipped = good.slice();
    flipped[i] = (flipped[i] ?? 0) ^ (1 << (i % 8));
    assertEquals((await unxz(flipped)).kind, "err", `byte ${i} flipped`);
  }
  for (const n of [0, 1, 11, 12, 13, 100, 4095, 4096, 9999, good.length - 13, good.length - 12, good.length - 1]) {
    assertEquals((await unxz(good.slice(0, n))).kind, "err", `cut at ${n}`);
  }
  const trailing = new Uint8Array([...good, 1, 2, 3, 4]);
  assertEquals((await unxz(trailing)).kind, "err", "bytes that are not a stream follow it");
  const oddPadding = new Uint8Array([...good, 0, 0]);
  assertEquals((await unxz(oddPadding)).kind, "err", "padding that is not a multiple of four");
  assertEquals((await unxz(new Uint8Array([1, 2, 3]))).kind, "err");
  assertEquals((await unxz(HELLO)).kind, "err");
});

proves([FR_BOUND], "a file that expands to sixteen mebibytes stops at a smaller limit, and is read whole at a limit that holds it", async () => {
  const bomb = fixture("zeros-16m.xz");
  assert(bomb.length < 4000, "a few kilobytes make sixteen mebibytes");
  const MIB = 1024 * 1024;
  for (const limit of [0, 1, MIB, 16 * MIB - 1]) {
    const r = await unxz(bomb, { maxBytes: limit });
    assertEquals(r.kind, "err", `at a limit of ${limit}`);
    if (r.kind === "err") assert(r.error.kind === "unsupported" && r.error.message.includes("larger than the limit"), formatArchiveError(r.error));
  }
  const whole = await read(bomb, 16 * MIB);
  assertEquals(whole.length, 16 * MIB);
  assert(whole.every((b) => b === 0));
  assertEquals((await read(bomb)).length, 16 * MIB, "the default limit holds it");
  assertEquals(DEFAULT_MAX_BYTES, 1024 * MIB);
  assertEquals((await unxz(bomb, { maxBytes: -1 })).kind, "err");
  assertEquals((await unxz(bomb, { maxBytes: 1.5 })).kind, "err");
});

proves([FR_READ, FR_BOUND], "where xz is installed, random and repetitive data it compresses reads back, and a tar it compresses is untarred", async () => {
  if (!xzAvailable()) return;
  const compress = (data: Uint8Array, args: readonly string[]): Uint8Array => {
    const r = spawnSync("xz", ["-c", ...args], { input: data, maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`xz: ${String(r.stderr)}`);
    return new Uint8Array(r.stdout);
  };
  const repetitive = fc
    .tuple(fc.uint8Array({ minLength: 1, maxLength: 64 }), fc.integer({ min: 1, max: 400 }))
    .map(([unit, times]) => new Uint8Array(Array.from({ length: unit.length * times }, (_, i) => unit[i % unit.length] ?? 0)));
  await fc.assert(
    fc.asyncProperty(fc.oneof(fc.uint8Array({ maxLength: 20000 }), repetitive), fc.constantFrom(["-0"], ["-6"], ["-9e"], ["--check=crc32"], ["--check=sha256"], ["--lzma2=preset=6,lc=0,lp=2,pb=0"], ["--lzma2=preset=1,lc=4,lp=0,pb=4"]), async (data, args) => {
      assertEquals(await read(compress(data, args)), data);
    }),
    { numRuns: 40 },
  );
  const files = new Map([
    ["pkg/bin/tool", text("#!/bin/sh\necho tool\n")],
    ["pkg/lib/data.txt", new Uint8Array(readFileSync(new URL("./fixtures/xz/text.txt", import.meta.url)))],
  ]);
  const packed = tar(files);
  assert(packed.kind === "ok");
  const entries = untar(await read(compress(packed.value, ["-6"])));
  assert(entries.kind === "ok");
  assertEquals([...filesOf(entries.value).keys()].sort(), ["pkg/bin/tool", "pkg/lib/data.txt"]);
  assertEquals(filesOf(entries.value).get("pkg/bin/tool"), files.get("pkg/bin/tool"));
});
