/**
 * Tests of the rest of `runtime/fs.ts` (commons 0001-system FR-004 to FR-050, FR-058): `readDir` as an async iterable, `chown`
 * and `symlinkSync`; `open` and its `FsFile`; `copy` and `walk` as `@std/fs` gives them; `expandGlob`. Everything runs on a real temporary
 * folder; file modes, owners and symbolic links are POSIX-only and skipped on Windows (FR-018), the rest runs everywhere.
 *
 * @module
 */
import fc from "fast-check";
import process from "node:process";
import { errors } from "../src/errors.ts";
import * as fs from "../src/fs.ts";
import { join } from "../src/path.ts";
import { build } from "../src/proc.ts";
import { assert, assertEquals, assertRejects, assertThrows, proves } from "@intellectual-frontiers/test";

const R48 = "0001-system FR-004";
const R49 = "0001-system FR-005";
const R50 = "0001-system FR-006";
const R58 = "0001-formats FR-015";
/** File modes, owners and symbolic links (which need a privilege on Windows) are tested on POSIX only (FR-018). */
const posix = build.os !== "windows";
const enc = new TextEncoder();
const dec = new TextDecoder();

/** A tree of files under `dir`, by `/` path to content (a path ending in `/` is a folder). */
async function tree(dir: string, files: readonly string[]): Promise<void> {
  for (const f of files) {
    if (f.endsWith("/")) await fs.mkdir(join(dir, ...f.split("/")), { recursive: true });
    else {
      const parts = f.split("/");
      await fs.mkdir(join(dir, ...parts.slice(0, -1)), { recursive: true });
      await fs.writeTextFile(join(dir, ...parts), f);
    }
  }
}

/** Everything an async iterable gives, as `Array.fromAsync` would (not in the ES2024 library). */
async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of items) out.push(x);
  return out;
}

/** Paths relative to `dir`, with `/`. */
const rel = (dir: string, path: string): string =>
  path === dir
    ? "."
    : path
        .slice(dir.length + 1)
        .split("\\")
        .join("/");

proves([R48], "readDir is an async iterable of entries (as Array.fromAsync takes); a folder that is not there is NotFound", async () => {
  await fs.withTempDir(async (dir) => {
    await tree(dir, ["b.txt", "a/", "c.txt"]);
    const entries = await collect(fs.readDir(dir));
    assertEquals(
      entries.map((e) => [e.name, e.isFile, e.isDirectory, e.isSymlink]).sort(),
      [
        ["a", false, true, false],
        ["b.txt", true, false, false],
        ["c.txt", true, false, false],
      ].sort(),
    );
    await assertRejects(() => collect(fs.readDir(join(dir, "none"))), errors.NotFound);
  });
});

proves([R48], "chown keeps or sets the owner and group, and symlinkSync makes a link (POSIX only, FR-018)", async () => {
  await fs.withTempDir(async (dir) => {
    const f = join(dir, "f.txt");
    await fs.writeTextFile(f, "x");
    const before = await fs.stat(f);
    await fs.chown(f, null, null);
    await fs.chown(f, before.uid, before.gid);
    const after = await fs.stat(f);
    assertEquals([after.uid, after.gid], [before.uid, before.gid]);
    if (!posix) return;
    fs.symlinkSync("f.txt", join(dir, "link"));
    assertEquals(await fs.readLink(join(dir, "link")), "f.txt");
    assertThrows(() => fs.symlinkSync("f.txt", join(dir, "link")), errors.AlreadyExists);
    await assertRejects(() => fs.chown(join(dir, "none"), null, null), errors.NotFound);
  });
});

proves(
  [R49],
  "an FsFile reads and writes at its position, seeks from the start, the position and the end, truncates and stats",
  async () => {
    await fs.withTempDir(async (dir) => {
      const path = join(dir, "f.bin");
      const f = await fs.open(path, { read: true, write: true, create: true });
      assertEquals(await f.write(enc.encode("hello world")), 11);
      assertEquals(await f.seek(0, "start"), 0);
      const five = new Uint8Array(5);
      assertEquals(await f.read(five), 5);
      assertEquals(dec.decode(five), "hello");
      assertEquals(await f.seek(1, "current"), 6);
      assertEquals(f.readSync(five), 5);
      assertEquals(dec.decode(five), "world");
      assertEquals(await f.read(five), null);
      assertEquals(await f.seek(-5, "end"), 6);
      assertEquals(f.writeSync(enc.encode("WORLD")), 5);
      assertEquals(f.seekSync(0, "start"), 0);
      const all = new Uint8Array(32);
      assertEquals(dec.decode(all.subarray(0, (await f.read(all)) ?? 0)), "hello WORLD");
      await f.truncate(5);
      assertEquals((await f.stat()).size, 5);
      f.truncateSync(2);
      assertEquals(f.statSync().size, 2);
      assert((await f.stat()).isFile);
      await f.sync();
      f.syncSync();
      await assertRejects(() => f.seek(-1, "start"), errors.InvalidData);
      f.close();
      f.close();
      await assertRejects(() => f.read(five), errors.InvalidData);
      assertEquals(await fs.readTextFile(path), "he");
      // @ts-expect-error an FsFile has no lock: one run at a time is runtime/lock (FR-039)
      assertEquals(f.lock, undefined);
    });
  },
);

proves([R49], "open refuses: createNew where it exists, a missing file without create, no access asked for", async () => {
  await fs.withTempDir(async (dir) => {
    const path = join(dir, "f.txt");
    await fs.writeTextFile(path, "abc");
    await assertRejects(() => fs.open(path, { write: true, createNew: true }), errors.AlreadyExists);
    await assertRejects(() => fs.open(join(dir, "none")), errors.NotFound);
    assertThrows(() => fs.openSync(join(dir, "none")), errors.NotFound);
    await assertRejects(() => fs.open(path, {}), errors.InvalidData);
    await assertRejects(() => fs.open(path, { read: true, create: true }), errors.InvalidData);
    await assertRejects(() => fs.open(path, { append: true, truncate: true }), errors.InvalidData);
    const t = await fs.open(path, { write: true, truncate: true });
    t.close();
    assertEquals(await fs.readTextFile(path), "");
    const n = fs.openSync(join(dir, "new.txt"), { write: true, createNew: true, mode: 0o600 });
    n.writeSync(enc.encode("n"));
    n.close();
    assertEquals(await fs.readTextFile(join(dir, "new.txt")), "n");
    if (posix) assertEquals(((await fs.stat(join(dir, "new.txt"))).mode ?? 0) & 0o777, 0o600);
  });
});

proves([R49], "a file opened with append and written from two handles keeps both writes, each at the end", async () => {
  await fs.withTempDir(async (dir) => {
    const path = join(dir, "log.txt");
    await fs.writeTextFile(path, "0");
    const a = await fs.open(path, { append: true });
    const b = fs.openSync(path, { create: true, append: true });
    await a.write(enc.encode("a"));
    b.writeSync(enc.encode("b"));
    await a.write(enc.encode("A"));
    a.close();
    b.close();
    assertEquals(await fs.readTextFile(path), "0abA");
  });
});

proves(
  [R49],
  "a handle's bytes as a ReadableStream and into a WritableStream, each closing the file; using and await using close it",
  async () => {
    await fs.withTempDir(async (dir) => {
      const path = join(dir, "big.bin");
      const data = new Uint8Array(200_000).map((_, i) => i % 251);
      const w = await fs.open(path, { write: true, create: true });
      await new Blob([data]).stream().pipeTo(w.writable);
      await assertRejects(() => w.write(data), errors.InvalidData);
      const r = await fs.open(path);
      await r.seek(10);
      const got = new Uint8Array(await new Response(r.readable).arrayBuffer());
      assertEquals(got, data.subarray(10));
      await assertRejects(() => r.read(new Uint8Array(1)), errors.InvalidData);
      let kept: fs.FsFile | undefined;
      {
        using f = fs.openSync(path);
        kept = f;
        assertEquals(f.readSync(new Uint8Array(1)), 1);
      }
      assertThrows(() => kept?.readSync(new Uint8Array(1)), errors.InvalidData);
      {
        await using f = await fs.open(path);
        kept = f;
      }
      await assertRejects(() => (kept === undefined ? Promise.resolve(null) : kept.read(new Uint8Array(1))), errors.InvalidData);
    });
  },
);

proves([R50], "copy copies a file and a folder recursively, refuses a destination that exists unless overwrite, keeps modes", async () => {
  await fs.withTempDir(async (dir) => {
    const src = join(dir, "src");
    await tree(src, ["a.txt", "sub/b.txt", "sub/deeper/c.txt", "empty/"]);
    if (posix) await fs.chmod(join(src, "a.txt"), 0o751);
    const dest = join(dir, "dest");
    await fs.copy(src, dest);
    assertEquals(await fs.walkFiles(dest), ["a.txt", "sub/b.txt", "sub/deeper/c.txt"]);
    assert((await fs.stat(join(dest, "empty"))).isDirectory);
    assertEquals(await fs.readTextFile(join(dest, "sub", "deeper", "c.txt")), "sub/deeper/c.txt");
    if (posix) assertEquals(((await fs.stat(join(dest, "a.txt"))).mode ?? 0) & 0o777, 0o751);
    // Onto a folder that exists, without overwrite: AlreadyExists, and nothing copied.
    const other = join(dir, "other");
    await tree(other, ["keep.txt"]);
    await assertRejects(() => fs.copy(src, other), errors.AlreadyExists);
    assertEquals(await fs.walkFiles(other), ["keep.txt"]);
    await fs.copy(src, other, { overwrite: true });
    assertEquals(await fs.walkFiles(other), ["a.txt", "keep.txt", "sub/b.txt", "sub/deeper/c.txt"]);
    // A file, onto a file, and with its times.
    await fs.writeTextFile(join(dir, "one.txt"), "new");
    await fs.utime(join(dir, "one.txt"), new Date(1_000_000_000_000), new Date(1_000_000_000_000));
    await fs.writeTextFile(join(dir, "two.txt"), "old");
    await assertRejects(() => fs.copy(join(dir, "one.txt"), join(dir, "two.txt")), errors.AlreadyExists);
    await fs.copy(join(dir, "one.txt"), join(dir, "two.txt"), { overwrite: true, preserveTimestamps: true });
    assertEquals(await fs.readTextFile(join(dir, "two.txt")), "new");
    assertEquals((await fs.stat(join(dir, "two.txt"))).mtime?.getTime(), 1_000_000_000_000);
    // Into itself, onto itself, from nothing.
    await assertRejects(() => fs.copy(src, join(src, "sub", "inside")), errors.InvalidData);
    await assertRejects(() => fs.copy(src, src), errors.InvalidData);
    await assertRejects(() => fs.copy(join(dir, "none"), join(dir, "x")), errors.NotFound);
    await assertRejects(() => fs.copy(src, join(dir, "one.txt"), { overwrite: true }), errors.NotADirectory);
  });
});

proves([R50], "copy copies a symbolic link as a link (POSIX only, FR-018)", async () => {
  if (!posix) return;
  await fs.withTempDir(async (dir) => {
    await tree(dir, ["src/t.txt"]);
    await fs.symlink("t.txt", join(dir, "src", "link"));
    await fs.copy(join(dir, "src"), join(dir, "dest"));
    assert((await fs.lstat(join(dir, "dest", "link"))).isSymlink);
    assertEquals(await fs.readLink(join(dir, "dest", "link")), "t.txt");
    await fs.copy(join(dir, "src", "link"), join(dir, "dest", "link"), { overwrite: true });
    assertEquals(await fs.readLink(join(dir, "dest", "link")), "t.txt");
  });
});

const TREE = ["B.md", "a/z.ts", "a/y.md", "a/deep/x.ts", "a-b.ts", "a.txt", "c/"];

proves([R50], "walk goes depth first in the byte order of the names at each level, the root first, as @std/fs's walk does", async () => {
  await fs.withTempDir(async (dir) => {
    await tree(dir, TREE);
    const all = (await collect(fs.walk(dir))).map((e) => rel(dir, e.path));
    assertEquals(all, [".", "B.md", "a", "a/deep", "a/deep/x.ts", "a/y.md", "a/z.ts", "a-b.ts", "a.txt", "c"]);
    const root = await collect(fs.walk(dir, { maxDepth: 0 }));
    assertEquals(
      root.map((e) => [rel(dir, e.path), e.isDirectory]),
      [[".", true]],
    );
    const one = (await collect(fs.walk(dir, { maxDepth: 1, includeDirs: false }))).map((e) => e.name);
    assertEquals(one, ["B.md", "a-b.ts", "a.txt"]);
    const dirs = (await collect(fs.walk(dir, { includeFiles: false }))).map((e) => rel(dir, e.path));
    assertEquals(dirs, [".", "a", "a/deep", "c"]);
    const ts = (await collect(fs.walk(dir, { exts: ["ts"], includeDirs: false }))).map((e) => rel(dir, e.path));
    assertEquals(ts, ["a/deep/x.ts", "a/z.ts", "a-b.ts"]);
    const matched = (await collect(fs.walk(dir, { match: [/\/a\/[^/]*$/], includeDirs: false }))).map((e) => rel(dir, e.path));
    assertEquals(matched, ["a/y.md", "a/z.ts"]);
    const skipped = (await collect(fs.walk(dir, { skip: [/\/deep(\/|$)/], includeDirs: false }))).map((e) => rel(dir, e.path));
    assertEquals(skipped, ["B.md", "a/y.md", "a/z.ts", "a-b.ts", "a.txt"]);
    const file = await collect(fs.walk(join(dir, "a.txt")));
    assertEquals(
      file.map((e) => [e.name, e.isFile]),
      [["a.txt", true]],
    );
    assertEquals(await collect(fs.walk(join(dir, "a.txt"), { includeFiles: false })), []);
    await assertRejects(() => collect(fs.walk(join(dir, "none"))), errors.NotFound);
  });
});

proves([R50], "walk gives the same order every time, whatever order the names were made in", async () => {
  // Names every platform keeps as written: not ending in "." (Windows drops it) and none of Windows's device names.
  const name = fc.stringMatching(/^[a-z0-9._-]{1,6}$/).filter((s) => !s.endsWith(".") && !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/.test(s));
  await fc.assert(
    fc.asyncProperty(fc.uniqueArray(name, { minLength: 1, maxLength: 8 }), async (names) => {
      await fs.withTempDir(async (dir) => {
        for (const n of names) await fs.writeTextFile(join(dir, n), n);
        const once = (await collect(fs.walk(dir, { includeDirs: false }))).map((e) => e.name);
        const twice = (await collect(fs.walk(dir, { includeDirs: false }))).map((e) => e.name);
        assertEquals(once, [...names].sort());
        assertEquals(twice, once);
      });
    }),
    { numRuns: 15 },
  );
});

proves(
  [R50],
  "walk gives links as links, or follows them where asked, and does not loop on a link to its own folder (POSIX only)",
  async () => {
    if (!posix) return;
    await fs.withTempDir(async (dir) => {
      await tree(dir, ["t/in.txt", "w/file.txt"]);
      await fs.symlink(join(dir, "t"), join(dir, "w", "link"));
      await fs.symlink(join(dir, "w"), join(dir, "w", "loop"));
      const w = join(dir, "w");
      const plain = await collect(fs.walk(w, { includeDirs: false }));
      assertEquals(
        plain.map((e) => [e.name, e.isSymlink]),
        [
          ["file.txt", false],
          ["link", true],
          ["loop", true],
        ],
      );
      const none = await collect(fs.walk(w, { includeDirs: false, includeSymlinks: false }));
      assertEquals(
        none.map((e) => e.name),
        ["file.txt"],
      );
      const followed = await collect(fs.walk(w, { includeDirs: false, followSymlinks: true, canonicalize: false }));
      assertEquals(
        followed.map((e) => rel(w, e.path)),
        ["file.txt", "link/in.txt", "loop"],
      );
      const canonical = await collect(fs.walk(w, { includeDirs: false, followSymlinks: true, includeSymlinks: false }));
      assertEquals(
        canonical.map((e) => e.path),
        // As @std/fs's walk: a link followed is given by its real path, what is not a link keeps the path walked (macOS's /var, not
        // /private/var).
        [join(w, "file.txt"), join(await fs.realPath(join(dir, "t")), "in.txt")],
      );
    });
  },
);

proves([R58], "expandGlob gives what src/**/*.ts matches, in byte order, and not srcx/a.ts", async () => {
  await fs.withTempDir(async (dir) => {
    await tree(dir, ["src/a/b/c.ts", "src/x.ts", "src/y.md", "src/a/B.ts", "srcx/a.ts", "top.ts", "node_modules/m/i.ts"]);
    const of = async (glob: string, options: fs.ExpandGlobOptions = {}): Promise<string[]> =>
      (await collect(fs.expandGlob(glob, { root: dir, ...options }))).map((e) => rel(dir, e.path));
    assertEquals(await of("src/**/*.ts"), ["src/a/B.ts", "src/a/b/c.ts", "src/x.ts"]);
    assertEquals(await of("*.ts"), ["top.ts"]);
    assertEquals(await of("src/*"), ["src/a", "src/x.ts", "src/y.md"]);
    assertEquals(await of("src/*", { includeDirs: false }), ["src/x.ts", "src/y.md"]);
    assertEquals(await of("**/*.ts", { exclude: ["node_modules", "srcx"] }), ["src/a/B.ts", "src/a/b/c.ts", "src/x.ts", "top.ts"]);
    assertEquals(await of("src/{x,y}.*"), ["src/x.ts", "src/y.md"]);
    assertEquals(await of("src/a/*.TS", { caseInsensitive: true }), ["src/a/B.ts"]);
    assertEquals(await of("none/**/*.ts"), []);
    assertEquals(await of("src/x.ts"), ["src/x.ts"]);
    const absolute = (await collect(fs.expandGlob(`${dir.split("\\").join("/")}/src/*.md`))).map((e) => rel(dir, e.path));
    assertEquals(absolute, ["src/y.md"]);
    const fromSrc = (await collect(fs.expandGlob("../top.*", { root: join(dir, "src") }))).map((e) => e.name);
    assertEquals(fromSrc, ["top.ts"]);
    await assertRejects(() => collect(fs.expandGlob("!x", { root: dir })), errors.InvalidData);
    assert(process.cwd() !== "");
  });
});
