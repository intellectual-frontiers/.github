/**
 * Tests of the verbs that bring directories of two stores together (commons anyfs-cli 0004-anyfs-cli-surfaces FR-012, FR-013): `sync` plans first with a hash and applies only what the hash approves; `check` changes
 * nothing; `bisync` needs a base and keeps the one it ends with; a mirror keeps its ledger, never touches what the replica changed itself, and refuses to promote a replica that is behind or diverged unless told.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { fill, lab, type Lab } from "./world.ts";

async function withLab<T>(body: (l: Lab) => Promise<T>): Promise<T> {
  const l = await lab();
  try {
    await fill(l.dir, { "a/one.txt": "one\n", "a/dir/two.txt": "two\n" });
    await fs.mkdir(path.join(l.dir, "b"), { recursive: true });
    await l.config(
      `export default { mounts: [\n  { name: "left", place: ${JSON.stringify(`file://${path.join(l.dir, "a")}`)} },\n  { name: "right", place: ${JSON.stringify(`file://${path.join(l.dir, "b")}`)} },\n] };\n`,
    );
    return await body(l);
  } finally {
    await l.cleanup();
  }
}

const has = (l: Lab, rel: string): Promise<boolean> => fs.exists(path.join(l.dir, rel));
const read = (l: Lab, rel: string): Promise<string> => fs.readTextFile(path.join(l.dir, rel));
const hashOf = (out: string): string => {
  const h = /(?:plan|state) ([0-9a-f]{64})/.exec(out)?.[1];
  assert(h !== undefined, out);
  return h;
};

proves(["0004-anyfs-cli-surfaces FR-012"], "sync plans first with a hash, applies only with the confirmation and the hash, and a second plan is empty", () =>
  withLab(async (l) => {
    const dry = await l.run(["sync", "--dry-run", "left:/", "right:/"]);
    assertEquals(dry.code, 0);
    assertStringIncludes(dry.out, "2 create");
    assertStringIncludes(dry.err, "--yes --plan-hash");
    assertEquals(await has(l, "b/one.txt"), false);
    assertEquals((await l.run(["sync", "left:/", "right:/"])).code, 2);
    assertEquals(await has(l, "b/one.txt"), false);
    const stale = await l.run(["sync", "--yes", "--plan-hash", "1".repeat(64), "left:/", "right:/"]);
    assertEquals(stale.code, 1);
    assertStringIncludes(stale.err, "E-PLAN-STALE");
    const done = await l.run(["sync", "--yes", "--plan-hash", hashOf(dry.out), "left:/", "right:/"]);
    assertEquals(done.code, 0);
    assertStringIncludes(done.out, "2 done, 0 failed, 0 skipped");
    assertEquals(await read(l, "b/dir/two.txt"), "two\n");
    const again = await l.run(["sync", "--dry-run", "left:/", "right:/"]);
    assertStringIncludes(again.out, "nothing to do");
    assertEquals(again.err.includes("--plan-hash"), false);
  }),
);

proves(["0004-anyfs-cli-surfaces FR-012"], "sync deletes only up to --max-deletes, and check changes nothing and ends with E-DIFFERENT where the sides differ", () =>
  withLab(async (l) => {
    await l.run(["sync", "--yes", "left:/", "right:/"]);
    await fill(l.dir, { "b/extra.txt": "extra\n" });
    const none = await l.run(["sync", "--dry-run", "left:/", "right:/"]);
    assertEquals(none.out.includes("delete extra.txt"), false);
    assertStringIncludes(none.out, "delete-not-allowed");
    const budget = await l.run(["sync", "--dry-run", "--max-deletes", "5", "left:/", "right:/"]);
    assertStringIncludes(budget.out, "delete extra.txt");
    const differs = await l.run(["check", "left:/", "right:/"]);
    assertEquals(differs.code, 1);
    assertStringIncludes(differs.err, "E-DIFFERENT");
    assertEquals(await has(l, "b/extra.txt"), true);
    const removed = await l.run(["sync", "--yes", "--max-deletes", "5", "left:/", "right:/"]);
    assertEquals(removed.code, 0);
    assertEquals(await has(l, "b/extra.txt"), false);
    const same = await l.run(["check", "left:/", "right:/"]);
    assertEquals(same.code, 0);
    assertStringIncludes(same.out, "nothing to do");
    await fill(l.dir, { "b/one.txt": "changed\n" });
    assertEquals((await l.run(["check", "left:/", "right:/"])).code, 1);
    assertEquals(await read(l, "a/one.txt"), "one\n");
  }),
);

proves(["0004-anyfs-cli-surfaces FR-013"], "bisync needs a base or --seed, records the base, and leaves a conflict for the person unless a rule settles it", () =>
  withLab(async (l) => {
    const noBase = await l.run(["bisync", "--dry-run", "left:/", "right:/"]);
    assertEquals(noBase.code, 2);
    assertStringIncludes(noBase.err, "--seed");
    const seeded = await l.run(["bisync", "--seed", "--yes", "left:/", "right:/"]);
    assertEquals(seeded.code, 0);
    assertEquals(await read(l, "b/one.txt"), "one\n");
    const bases = (await fs.exists(l.state)) ? [...(await collect(l.state))].filter((f) => f.startsWith("bisync-")) : [];
    assertEquals(bases.length, 1);
    await fill(l.dir, { "a/only-a.txt": "a\n", "b/only-b.txt": "b\n" });
    const later = await l.run(["bisync", "--yes", "left:/", "right:/"]);
    assertEquals(later.code, 0);
    assertEquals([await has(l, "b/only-a.txt"), await has(l, "a/only-b.txt")], [true, true]);
    await fill(l.dir, { "a/one.txt": "from a\n", "b/one.txt": "from b\n" });
    const conflict = await l.run(["bisync", "--yes", "left:/", "right:/"]);
    assertEquals(conflict.code, 1);
    assertStringIncludes(conflict.err, "E-CONFLICTS");
    assertEquals([await read(l, "a/one.txt"), await read(l, "b/one.txt")], ["from a\n", "from b\n"]);
    const kept = await l.run(["bisync", "--yes", "--conflict", "keep-both", "left:/", "right:/"]);
    assertEquals(kept.code, 0);
    const files = await collect(path.join(l.dir, "a"));
    assert(files.some((f) => f.includes("one.conflict-")), files.join(","));
  }),
);

/** The names of the files directly in a folder. */
async function collect(dir: string): Promise<string[]> {
  const out: string[] = [];
  for await (const e of fs.readDir(dir)) out.push(e.name);
  return out;
}

proves(["0004-anyfs-cli-surfaces FR-013"], "a mirror keeps its ledger, never touches what the replica changed itself, and refuses to promote a replica that is behind or diverged", () =>
  withLab(async (l) => {
    const first = await l.run(["mirror", "status", "left:/", "right:/"]);
    assertStringIncludes(first.out, "behind by 2 paths");
    const dry = await l.run(["mirror", "sync", "--dry-run", "left:/", "right:/"]);
    const done = await l.run(["mirror", "sync", "--yes", "--plan-hash", hashOf(dry.out), "left:/", "right:/"]);
    assertEquals(done.code, 0);
    assertEquals((await l.run(["mirror", "status", "left:/", "right:/"])).out, "in sync");
    await fill(l.dir, { "b/one.txt": "the replica's own change\n" });
    const diverged = await l.run(["mirror", "status", "left:/", "right:/"]);
    assertEquals(diverged.code, 1);
    assertStringIncludes(diverged.err, "E-REPLICA-DIVERGED");
    assertStringIncludes(diverged.out, "one.txt");
    await fill(l.dir, { "a/new.txt": "new\n" });
    const synced = await l.run(["mirror", "sync", "--yes", "left:/", "right:/"]);
    assertStringIncludes(synced.err, "E-REPLICA-DIVERGED");
    assertEquals(await read(l, "b/one.txt"), "the replica's own change\n");
    assertEquals(await read(l, "b/new.txt"), "new\n");
    const refused = await l.run(["mirror", "promote", "--yes", "left:/", "right:/"]);
    assertEquals(refused.code, 1);
    assertStringIncludes(refused.err, "accept");
    const preview = await l.run(["mirror", "promote", "--dry-run", "left:/", "right:/"]);
    assertEquals(preview.code, 0);
    assertStringIncludes(preview.out, "diverged");
    const accepted = await l.run(["mirror", "promote", "--yes", "--accept-divergence", "--accept-loss", "5", "left:/", "right:/"]);
    assertEquals(accepted.code, 0);
    assertStringIncludes(accepted.out, "right:/ is now the primary");
  }),
);
