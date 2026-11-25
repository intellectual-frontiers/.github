/**
 * Tests of `runtime/fs.ts` and `runtime/errors.ts`: the calls on a real temporary folder, each failure thrown as its typed error,
 * and the helpers over them.
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { errors, mapError, RuntimeError } from "../src/errors.ts";
import * as fs from "../src/fs.ts";
import { tmpdir } from "node:os";
import { dirname, join, resolve, toFileUrl } from "../src/path.ts";
import { build } from "../src/proc.ts";
import { assert, assertEquals, assertInstanceOf, assertRejects, assertThrows, proves } from "@intellectual-frontiers/test";

const FR = "0001-system FR-002";
const ERR = "0001-system FR-001";
const posix = build.os !== "windows";

proves([ERR], "a Node error code becomes its class, keeping the code, the path and the cause; anything else is unchanged", () => {
  const e = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT", path: "/x" });
  const mapped = mapError(e);
  assertInstanceOf(mapped, errors.NotFound);
  assertInstanceOf(mapped, RuntimeError);
  assertEquals([mapped.code, mapped.path, mapped.cause, mapped.name], ["ENOENT", "/x", e, "NotFound"]);
  assertInstanceOf(mapError(Object.assign(new Error(""), { code: "EACCES" })), errors.PermissionDenied);
  assertInstanceOf(mapError(Object.assign(new Error(""), { code: "EPERM" })), errors.PermissionDenied);
  assertInstanceOf(mapError(Object.assign(new Error(""), { code: "EADDRINUSE", address: "127.0.0.1" })), errors.AddrInUse);
  const other = new Error("plain");
  assertEquals(mapError(other), other);
  const wrapped = mapError("text");
  assertEquals([wrapped instanceof Error, wrapped.cause], [true, "text"]);
  assertEquals(mapError(mapped), mapped);
});

proves([FR, ERR], "text and bytes written, appended and read; createNew and create:false refuse", async () => {
  await fs.withTempDir(async (dir) => {
    const f = join(dir, "a.txt");
    await fs.writeTextFile(f, "héllo");
    assertEquals(await fs.readTextFile(f), "héllo");
    assertEquals(await fs.readTextFile(toFileUrl(f)), "héllo");
    await fs.writeTextFile(f, "!", { append: true });
    assertEquals(fs.readTextFileSync(f), "héllo!");
    await assertRejects(() => fs.writeTextFile(f, "x", { createNew: true }), errors.AlreadyExists);
    await assertRejects(() => fs.writeTextFile(join(dir, "none.txt"), "x", { create: false }), errors.NotFound);
    await fs.writeFile(join(dir, "b.bin"), new Uint8Array([0, 1, 255]));
    assertEquals(await fs.readFile(join(dir, "b.bin")), new Uint8Array([0, 1, 255]));
    fs.writeFileSync(join(dir, "c.bin"), new Uint8Array([7]));
    assertEquals(fs.readFileSync(join(dir, "c.bin")), new Uint8Array([7]));
    fs.writeTextFileSync(join(dir, "d.txt"), "d", { mode: 0o600 });
    if (posix) assertEquals(((await fs.stat(join(dir, "d.txt"))).mode ?? 0) & 0o777, 0o600);
    await assertRejects(() => fs.readTextFile(join(dir, "missing")), errors.NotFound);
    assertThrows(() => fs.readTextFileSync(join(dir, "missing")), errors.NotFound);
    await assertRejects(() => fs.readTextFile(dir), errors.IsADirectory);
  });
});

proves([FR, ERR], "folders made, listed, stat'd and removed; removing what is not there is NotFound", async () => {
  await fs.withTempDir(async (dir) => {
    await fs.mkdir(join(dir, "a", "b"), { recursive: true });
    await fs.mkdir(join(dir, "a", "b"), { recursive: true });
    await assertRejects(() => fs.mkdir(join(dir, "a")), errors.AlreadyExists);
    fs.mkdirSync(join(dir, "s"));
    await fs.writeTextFile(join(dir, "a", "f.txt"), "f");
    const names: string[] = [];
    for await (const e of fs.readDir(join(dir, "a"))) names.push(`${e.name}:${e.isFile ? "f" : e.isDirectory ? "d" : "?"}`);
    assertEquals(names.sort(), ["b:d", "f.txt:f"]);
    assertEquals(
      fs
        .readDirSync(dir)
        .map((e) => e.name)
        .sort(),
      ["a", "s"],
    );
    const st = await fs.stat(join(dir, "a", "f.txt"));
    assert(st.isFile && !st.isDirectory && !st.isSymlink);
    assertEquals(st.size, 1);
    assertInstanceOf(st.mtime, Date);
    assert(fs.statSync(dir).isDirectory);
    const e = await assertRejects(() => fs.remove(join(dir, "a")), RuntimeError);
    assert(e instanceof errors.DirectoryNotEmpty || e instanceof errors.AlreadyExists, `${e.name} ${e.code}`);
    await fs.remove(join(dir, "a"), { recursive: true });
    fs.removeSync(join(dir, "s"));
    await assertRejects(() => fs.remove(join(dir, "a")), errors.NotFound);
    assertThrows(() => fs.removeSync(join(dir, "a")), errors.NotFound);
    await assertRejects(() => fs.stat(join(dir, "a")), errors.NotFound);
    await assertRejects(() => fs.writeTextFile(join(dir, "no", "such", "f"), ""), errors.NotFound);
  });
});

proves([FR], "regression: a temporary folder with no prefix is made inside the temporary folder, not beside it", async () => {
  const dir = await fs.makeTempDir();
  const sync = fs.makeTempDirSync();
  try {
    assertEquals([dirname(dir), dirname(sync)], [resolve(tmpdir()), resolve(tmpdir())]);
  } finally {
    await fs.remove(dir);
    await fs.remove(sync);
  }
});

proves([FR], "temporary folders and files, rename, copy, chmod, links, realPath, truncate, utime", async () => {
  const dir = await fs.makeTempDir({ prefix: "ifc-ts-", suffix: "-x" });
  try {
    assert(/ifc-ts-.*-x$/.test(dir), dir);
    const other = fs.makeTempDirSync({ dir, prefix: "sub-" });
    assert(fs.statSync(other).isDirectory);
    const t = await fs.makeTempFile({ dir, prefix: "t-", suffix: ".txt" });
    assert(t.endsWith(".txt") && (await fs.readTextFile(t)) === "");
    await fs.rename(t, join(dir, "moved.txt"));
    assert(!(await fs.exists(t)) && fs.existsSync(join(dir, "moved.txt")));
    fs.renameSync(join(dir, "moved.txt"), join(dir, "m.txt"));
    await fs.writeTextFile(join(dir, "m.txt"), "content");
    await fs.copyFile(join(dir, "m.txt"), join(dir, "copy.txt"));
    assertEquals(await fs.readTextFile(join(dir, "copy.txt")), "content");
    await fs.link(join(dir, "m.txt"), join(dir, "second.txt"));
    assertEquals(await fs.readTextFile(join(dir, "second.txt")), "content");
    await assertRejects(() => fs.link(join(dir, "m.txt"), join(dir, "copy.txt")), errors.AlreadyExists);
    await fs.remove(join(dir, "second.txt"));
    await fs.truncate(join(dir, "copy.txt"), 3);
    assertEquals(await fs.readTextFile(join(dir, "copy.txt")), "con");
    await fs.utime(join(dir, "copy.txt"), new Date(1_000_000_000_000), new Date(1_000_000_000_000));
    assertEquals((await fs.stat(join(dir, "copy.txt"))).mtime?.getTime(), 1_000_000_000_000);
    if (posix) {
      await fs.chmod(join(dir, "m.txt"), 0o640);
      assertEquals((fs.statSync(join(dir, "m.txt")).mode ?? 0) & 0o777, 0o640);
      await fs.symlink("m.txt", join(dir, "link"));
      assertEquals(await fs.readLink(join(dir, "link")), "m.txt");
      assert((await fs.lstat(join(dir, "link"))).isSymlink);
      assert(fs.lstatSync(join(dir, "link")).isSymlink);
      assert((await fs.stat(join(dir, "link"))).isFile);
      assertEquals(await fs.realPath(join(dir, "link")), await fs.realPath(join(dir, "m.txt")));
      await fs.symlink("nowhere", join(dir, "broken"));
      assert(await fs.exists(join(dir, "broken")));
    }
  } finally {
    await fs.remove(dir, { recursive: true });
  }
  assert(!(await fs.exists(dir)));
});

proves(
  [FR],
  "the helpers: readTextOr, ensureDir, writeIfChanged, listDirs, listFiles, walkFiles, sha256File, withTempDir",
  async () => {
    let kept = "";
    await fs.withTempDir(async (dir) => {
      kept = dir;
      assertEquals(await fs.readTextOr(join(dir, "none")), undefined);
      assertEquals(await fs.readTextOr(join(dir, "none"), "fallback"), "fallback");
      assert(await fs.writeIfChanged(join(dir, "deep", "x.txt"), "1"));
      assert(!(await fs.writeIfChanged(join(dir, "deep", "x.txt"), "1")));
      assert(await fs.writeIfChanged(join(dir, "deep", "x.txt"), "2"));
      assertEquals(await fs.listFiles(join(dir, "deep")), ["x.txt"]);
      await fs.ensureDir(join(dir, "b", "c"));
      await fs.writeTextFile(join(dir, "b", "c", "y.md"), "y");
      await fs.writeTextFile(join(dir, "b", "z.txt"), "z");
      assertEquals(await fs.listDirs(dir), ["b", "deep"]);
      assertEquals(await fs.listFiles(join(dir, "b"), ".txt"), ["z.txt"]);
      assertEquals(await fs.walkFiles(dir), ["b/c/y.md", "b/z.txt", "deep/x.txt"]);
      assertEquals(await fs.listDirs(join(dir, "none")), []);
      assertEquals(await fs.walkFiles(join(dir, "none")), []);
      const big = new Uint8Array(300_000).map((_, i) => i % 251);
      await fs.writeFile(join(dir, "big"), big);
      assertEquals(await fs.sha256File(join(dir, "big")), await sha256(big));
      await assertRejects(() => fs.sha256File(join(dir, "none")), errors.NotFound);
    });
    assert(!(await fs.exists(kept)));
  },
);

proves(["0001-system FR-007"], "a folder linked as a junction is read through it, with no administrator rights on Windows", async () => {
  const dir = await fs.makeTempDir({ prefix: "ifc-junction-" });
  try {
    await fs.mkdir(join(dir, "modules"));
    await fs.writeTextFile(join(dir, "modules", "a.txt"), "inside");
    await fs.mkdir(join(dir, "tree"));
    await fs.symlink(join(dir, "modules"), join(dir, "tree", "node_modules"), { type: "junction" });
    assertEquals(await fs.readTextFile(join(dir, "tree", "node_modules", "a.txt")), "inside");
    assert((await fs.lstat(join(dir, "tree", "node_modules"))).isSymlink);
    fs.symlinkSync(join(dir, "modules"), join(dir, "tree", "again"), { type: "junction" });
    assertEquals(await fs.readTextFile(join(dir, "tree", "again", "a.txt")), "inside");
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});
