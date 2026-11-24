/**
 * Tests of the verbs that change a store (commons anyfs-cli 0004-anyfs-cli-surfaces FR-010, FR-011): the verbs are run through `main` against folders that persist between runs; `--dry-run` changes nothing and says
 * what it would do; a file copy is checked; a directory copy or a cross-store move is a plan of the bridge whose hash pins the apply; and `rm -r` lists the names it would remove with the hash of that list.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { fill, lab, textOf, type Lab } from "./world.ts";

async function withLab<T>(body: (l: Lab) => Promise<T>): Promise<T> {
  const l = await lab();
  try {
    await fill(l.dir, { "src/a.txt": "alpha\n", "src/dir/b.txt": "beta\n", "src/dir/deep/c.txt": "gamma\n", "dst/.keep": "", "other/.keep": "" });
    await l.config(
      `export default { mounts: [\n  { name: "src", place: ${JSON.stringify(`file://${path.join(l.dir, "src")}`)} },\n  { name: "dst", place: ${JSON.stringify(`file://${path.join(l.dir, "dst")}`)} },\n  { name: "other", place: ${JSON.stringify(`file://${path.join(l.dir, "other")}`)} },\n] };\n`,
    );
    return await body(l);
  } finally {
    await l.cleanup();
  }
}

const has = (l: Lab, rel: string): Promise<boolean> => fs.exists(path.join(l.dir, rel));
const read = (l: Lab, rel: string): Promise<string> => fs.readTextFile(path.join(l.dir, rel));

proves(["0004-anyfs-cli-surfaces FR-011"], "put writes standard input or a local file, and --dry-run, mkdir and touch say what they would do and change nothing", () =>
  withLab(async (l) => {
    const dry = await l.run(["put", "--dry-run", "dst:/new.txt", "-"], { stdin: new TextEncoder().encode("hi\n") });
    assertEquals(dry.code, 0);
    assertStringIncludes(dry.out, "would write 3 bytes to dst:/new.txt");
    assertEquals(await has(l, "dst/new.txt"), false);
    const wrote = await l.run(["put", "dst:/new.txt", "-"], { stdin: new TextEncoder().encode("hi\n") });
    assertEquals(wrote.code, 0);
    assertEquals(await read(l, "dst/new.txt"), "hi\n");
    assertEquals((await l.run(["put", "dst:/from-file.txt", path.join(l.dir, "src/a.txt")])).code, 0);
    assertEquals(await read(l, "dst/from-file.txt"), "alpha\n");
    const again = await l.run(["put", "--exclusive", "dst:/new.txt", "-"], { stdin: new TextEncoder().encode("x") });
    assertEquals(again.code, 1);
    assertStringIncludes(again.err, "EEXIST");
    assertEquals(await read(l, "dst/new.txt"), "hi\n");
    assertEquals((await l.run(["put", "dst:/x.txt", path.join(l.dir, "missing")])).code, 1);
    assertEquals((await l.run(["touch", "--dry-run", "dst:/t.txt"])).out, "would touch dst:/t.txt");
    assertEquals(await has(l, "dst/t.txt"), false);
    assertEquals((await l.run(["touch", "dst:/t.txt"])).code, 0);
    assertEquals(await read(l, "dst/t.txt"), "");
    assertEquals((await l.run(["mkdir", "--dry-run", "dst:/made"])).out, "would make dst:/made");
  }),
);

proves(["0004-anyfs-cli-surfaces FR-011"], "cp copies files by a checked read and write, into a directory, and a directory only with -r by a plan", () =>
  withLab(async (l) => {
    assertEquals((await l.run(["cp", "src:/a.txt", "dst:/copy.txt"])).code, 0);
    assertEquals(await read(l, "dst/copy.txt"), "alpha\n");
    assertEquals((await l.run(["cp", "src:/a.txt", "dst:/into/"])).out, "src:/a.txt -> dst:/into/a.txt (6 bytes)");
    assertEquals(await read(l, "dst/into/a.txt"), "alpha\n");
    assertEquals((await l.run(["cp", "--dry-run", "src:/a.txt", "dst:/never.txt"])).out, "would copy src:/a.txt -> /never.txt");
    assertEquals(await has(l, "dst/never.txt"), false);
    const many = await l.run(["cp", "src:/a.txt", "src:/dir/b.txt", "dst:/nodir.txt"]);
    assertEquals(many.code, 2);
    const dir = await l.run(["cp", "src:/dir", "dst:/dir"]);
    assertEquals(dir.code, 1);
    assertStringIncludes(dir.err, "EISDIR");
    const plan = await l.run(["cp", "-r", "--dry-run", "src:/dir", "dst:/dir"]);
    assertEquals(plan.code, 0);
    assertStringIncludes(plan.out, "2 create");
    assertEquals(await has(l, "dst/dir/b.txt"), false);
    const hash = /plan ([0-9a-f]{64})/.exec(plan.out)?.[1];
    assert(hash !== undefined);
    const stale = await l.run(["cp", "-r", "--plan-hash", "0".repeat(64), "src:/dir", "dst:/dir"]);
    assertEquals(stale.code, 1);
    assertStringIncludes(stale.err, "E-PLAN-STALE");
    assertEquals(await has(l, "dst/dir/b.txt"), false);
    const done = await l.run(["cp", "-r", "--plan-hash", hash, "src:/dir", "dst:/dir"]);
    assertEquals(done.code, 0);
    assertStringIncludes(done.out, "2 done, 0 failed");
    assertEquals(await read(l, "dst/dir/deep/c.txt"), "gamma\n");
  }),
);

proves(["0004-anyfs-cli-surfaces FR-010"], "a plan that is applied is the plan whose hash was named: a store that changed in between makes it a refusal and nothing is written", () =>
  withLab(async (l) => {
    const plan = await l.run(["cp", "-r", "--dry-run", "src:/dir", "dst:/dir"]);
    const hash = /plan ([0-9a-f]{64})/.exec(plan.out)?.[1];
    assert(hash !== undefined);
    await fill(l.dir, { "src/dir/late.txt": "added after the plan\n" });
    const stale = await l.run(["cp", "-r", "--plan-hash", hash, "src:/dir", "dst:/dir"]);
    assertEquals(stale.code, 1);
    assertStringIncludes(stale.err, "E-PLAN-STALE");
    assertEquals(await has(l, "dst/dir/b.txt"), false);
    const limits = await l.run(["cp", "-r", "--dry-run", "--max-files", "1", "src:/dir", "dst:/dir"]);
    assertEquals(limits.code, 1);
    assertStringIncludes(limits.err, "E-PLAN-REFUSED");
    const only = await l.run(["cp", "-r", "--dry-run", "--include", "**/c.txt", "src:/dir", "dst:/dir"]);
    assertStringIncludes(only.out, "1 create");
    const excluded = await l.run(["cp", "-r", "--dry-run", "--exclude", "deep/**", "src:/dir", "dst:/dir"]);
    assertStringIncludes(excluded.out, "create b.txt");
    assert(!excluded.out.includes("c.txt"), excluded.out);
  }),
);

proves(["0004-anyfs-cli-surfaces FR-011"], "mv renames within a store, copies then removes across stores, and a destruction needs its confirmation", () =>
  withLab(async (l) => {
    const unconfirmed = await l.run(["mv", "src:/a.txt", "src:/moved.txt"]);
    assertEquals(unconfirmed.code, 2);
    assertEquals(await has(l, "src/a.txt"), true);
    const renamed = await l.run(["mv", "--yes", "src:/a.txt", "src:/moved.txt"]);
    assertEquals(renamed.code, 0);
    assertEquals([await has(l, "src/a.txt"), await read(l, "src/moved.txt")], [false, "alpha\n"]);
    const across = await l.run(["mv", "--yes", "src:/moved.txt", "dst:/across.txt"]);
    assertEquals(across.code, 0);
    assertEquals([await has(l, "src/moved.txt"), await read(l, "dst/across.txt")], [false, "alpha\n"]);
    const plan = await l.run(["mv", "--dry-run", "src:/dir", "other:/dir"]);
    assertStringIncludes(plan.out, "move ");
    assertEquals(await has(l, "other/dir/b.txt"), false);
    const moved = await l.run(["mv", "--yes", "src:/dir", "other:/dir"]);
    assertEquals(moved.code, 0);
    assertEquals(await read(l, "other/dir/deep/c.txt"), "gamma\n");
    assertEquals(await has(l, "src/dir/b.txt"), false);
  }),
);

proves(["0004-anyfs-cli-surfaces FR-011"], "rm lists the names a recursive removal would take with the hash of that list, and removes exactly that list", () =>
  withLab(async (l) => {
    assertEquals((await l.run(["rm", "src:/a.txt"])).code, 2);
    assertEquals(await has(l, "src/a.txt"), true);
    const eisdir = await l.run(["rm", "--yes", "src:/dir"]);
    assertEquals(eisdir.code, 1);
    assertStringIncludes(eisdir.err, "EISDIR");
    const dry = await l.run(["rm", "-r", "--dry-run", "src:/dir"]);
    assertEquals(dry.code, 0);
    assertStringIncludes(dry.out, "would remove src:/dir/b.txt");
    assertStringIncludes(dry.out, "2 names");
    assertEquals(await has(l, "src/dir/b.txt"), true);
    const hash = /plan ([0-9a-f]{64})/.exec(dry.out)?.[1];
    assert(hash !== undefined);
    await fill(l.dir, { "src/dir/new.txt": "x" });
    const stale = await l.run(["rm", "-r", "--yes", "--plan-hash", hash, "src:/dir"]);
    assertEquals(stale.code, 1);
    assertStringIncludes(stale.err, "E-PLAN-STALE");
    assertEquals(await has(l, "src/dir/b.txt"), true);
    const fresh = /plan ([0-9a-f]{64})/.exec((await l.run(["rm", "-r", "--dry-run", "src:/dir"])).out)?.[1];
    assert(fresh !== undefined && fresh !== hash);
    const gone = await l.run(["rm", "-r", "--yes", "--plan-hash", fresh, "src:/dir"]);
    assertEquals(gone.code, 0);
    assertStringIncludes(gone.out, "removed 3 names");
    assertEquals(await has(l, "src/dir/b.txt"), false);
    assertEquals((await l.run(["rm", "--yes", "src:/a.txt"])).code, 0);
    assertEquals(await has(l, "src/a.txt"), false);
    assertEquals((await l.run(["rm", "--yes", "src:/a.txt"])).code, 1);
    assertEquals((await l.run(["rm", "--yes", "-f", "src:/a.txt"])).code, 0);
    assertEquals(textOf(new Uint8Array()), "");
  }),
);
