/**
 * Tests of the verbs that read, and of the binding of a word to a store (commons anyfs-cli 0004-anyfs-cli-surfaces FR-005, FR-007, FR-008): the verbs are run through `main` against a folder, a mount of
 * memory and a mount that is read-only, and what they write is what a person sees, with the exits of Headless; a file of every byte value is written as it is; and `--explain` and `--strict` say how a store carries
 * an operation out.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { path } from "@intellectual-frontiers/system";
import { fill, lab, textOf, type Lab } from "./world.ts";

const allBytes = Uint8Array.from({ length: 256 }, (_, i) => i);

async function withLab<T>(body: (l: Lab) => Promise<T>): Promise<T> {
  const l = await lab();
  try {
    await fill(l.dir, { "bak/.keep": "", "fleet/a.txt": "alpha\nbeta\nGamma\n", "fleet/bin.dat": allBytes, "fleet/sub/b.txt": "beta two\n", "fleet/sub/deep/c.txt": "gamma\n", "ro/r.txt": "read me\n" });
    await l.config(
      `export default { mounts: [\n  { name: "fleet", place: ${JSON.stringify(`file://${path.join(l.dir, "fleet")}`)} },\n  { name: "ro", place: ${JSON.stringify(`file://${path.join(l.dir, "ro")}`)}, readOnly: true },\n  { name: "bak", place: ${JSON.stringify(`file://${path.join(l.dir, "bak")}`)} },\n  { name: "gone", place: ${JSON.stringify(`file://${path.join(l.dir, "nowhere")}`)} },\n  { name: "bucket", place: "s3://example-bucket/fleet" },\n  { name: "scratch", place: "memory:scratch" },\n] };\n`,
    );
    return await body(l);
  } finally {
    await l.cleanup();
  }
}

proves(["0004-anyfs-cli-surfaces FR-008"], "ls, tree, find, du, stat, head, tail and sha256sum say what is in a store", () =>
  withLab(async (l) => {
    assertEquals((await l.run(["ls", "fleet:/"])).out, "a.txt\nbin.dat\nsub/");
    const long = await l.run(["ls", "-l", "fleet:/"]);
    assertStringIncludes(long.out, "-rw-");
    assertStringIncludes(long.out, "drwx");
    assertEquals((await l.run(["ls", "-R", "fleet:/sub"])).out.split("\n"), ["fleet:/sub/b.txt", "fleet:/sub/deep/", "fleet:/sub/deep/c.txt"]);
    const tree = await l.run(["tree", "fleet:/"]);
    assertStringIncludes(tree.out, "├── a.txt");
    assertStringIncludes(tree.out, "2 directories, 4 files");
    assertEquals((await l.run(["tree", "-L", "1", "fleet:/"])).out.split("\n").slice(-1)[0], "1 directory, 2 files");
    assertEquals((await l.run(["find", "fleet:/", "--name", "*.txt", "--type", "f"])).out.split("\n"), ["fleet:/a.txt", "fleet:/sub/b.txt", "fleet:/sub/deep/c.txt"]);
    assertEquals((await l.run(["find", "fleet:/", "--size", "+100"])).out, "fleet:/bin.dat");
    assertEquals((await l.run(["du", "-s", "fleet:/sub"])).out, `${"beta two\n".length + "gamma\n".length}\tfleet:/sub`);
    const stat = await l.run(["stat", "fleet:/a.txt"]);
    assertStringIncludes(stat.out, "type file  size 17");
    assertEquals((await l.run(["head", "-n", "1", "fleet:/a.txt"])).bytes, new TextEncoder().encode("alpha\n"));
    assertEquals(textOf((await l.run(["tail", "-n", "1", "fleet:/a.txt"])).bytes), "Gamma\n");
    assertEquals(textOf((await l.run(["head", "-c", "3", "fleet:/a.txt"])).bytes), "alp");
    const sum = await l.run(["sha256sum", "fleet:/a.txt"]);
    assertEquals(sum.out.split("  ")[1], "fleet:/a.txt");
    assertEquals(sum.out.split("  ")[0]?.length, 64);
  }),
);

proves(["0004-anyfs-cli-surfaces FR-008"], "grep looks for a literal text within limits, and diff says how two files differ with the exit of a finding", () =>
  withLab(async (l) => {
    const hit = await l.run(["grep", "-rn", "beta", "fleet:/"]);
    assertEquals(hit.out.split("\n"), ["fleet:/a.txt:2:beta", "fleet:/sub/b.txt:1:beta two"]);
    assertEquals((await l.run(["grep", "-ril", "GAMMA", "fleet:/"])).out.split("\n"), ["fleet:/a.txt", "fleet:/sub/deep/c.txt"]);
    assertEquals((await l.run(["grep", "-rc", "beta", "fleet:/"])).out.split("\n"), ["fleet:/a.txt:1", "fleet:/sub/b.txt:1"]);
    const none = await l.run(["grep", "-r", "absent", "fleet:/"]);
    assertEquals(none.code, 1);
    assertEquals((await l.run(["grep", "beta", "fleet:/sub"])).code, 1);
    const same = await l.run(["diff", "fleet:/a.txt", "fleet:/a.txt"]);
    assertEquals([same.code, same.out], [0, "the files are the same"]);
    await l.run(["put", "bak:/a.txt", "-"], { stdin: new TextEncoder().encode("alpha\nBETA\nGamma\n") });
    const differ = await l.run(["diff", "fleet:/a.txt", "bak:/a.txt"]);
    assertEquals(differ.code, 1);
    assertStringIncludes(differ.out, "-beta\n+BETA");
    assertStringIncludes(differ.err, "E-DIFFERENT");
  }),
);

proves(["0004-anyfs-cli-surfaces FR-008"], "cat writes the bytes of a file as they are, and none where the output is the one JSON document", () =>
  withLab(async (l) => {
    const ran = await l.run(["cat", "fleet:/bin.dat"]);
    assertEquals(ran.code, 0);
    assertEquals(ran.bytes, allBytes);
    assertEquals(ran.out, "");
    const two = await l.run(["cat", "fleet:/a.txt", "fleet:/sub/b.txt"]);
    assertEquals(textOf(two.bytes), "alpha\nbeta\nGamma\nbeta two\n");
    const json = await l.run(["cat", "--json", "fleet:/bin.dat"]);
    assertEquals(json.bytes.length, 0);
    const doc = JSON.parse(json.out) as { ok: boolean; data: { size: number }[] };
    assertEquals([doc.ok, doc.data[0]?.size], [true, 256]);
    const missing = await l.run(["cat", "fleet:/nothing.txt"]);
    assertEquals(missing.code, 1);
    assertStringIncludes(missing.err, "E-FILESYSTEM");
    assertStringIncludes(missing.err, "ENOENT");
  }),
);

proves(["0004-anyfs-cli-surfaces FR-005"], "a word that is no place is a usage error, a store that cannot be opened is a problem of the computer, and a read-only mount cannot be changed", () =>
  withLab(async (l) => {
    const unknown = await l.run(["ls", "other:/"]);
    assertEquals(unknown.code, 2);
    assertStringIncludes(unknown.err, "E-MOUNT-UNKNOWN");
    const gone = await l.run(["ls", "gone:/"]);
    assertEquals(gone.code, 3);
    assertStringIncludes(gone.err, "E-OPEN");
    const s3 = await l.run(["ls", "bucket:/"]);
    assertEquals(s3.code, 3);
    assertStringIncludes(s3.err, "E-PLACE-UNAVAILABLE");
    const rm = await l.run(["rm", "--yes", "ro:/r.txt"]);
    assertEquals(rm.code, 1);
    assertStringIncludes(rm.err, "EROFS");
    assertEquals(textOf((await l.run(["cat", "ro:/r.txt"])).bytes), "read me\n");
    assertEquals((await l.run(["ls", "--nonsense"])).code, 2);
  }),
);

proves(["0004-anyfs-cli-surfaces FR-007"], "--explain says how the store carries an operation out and does nothing, and --strict stops at an emulation that can lose what was meant", () =>
  withLab(async (l) => {
    const explained = await l.run(["ls", "--explain", "fleet:/"]);
    assertEquals(explained.code, 0);
    assertStringIncludes(explained.out, "readdir: emulated (derived-directory");
    assertStringIncludes(explained.out, "stat-file: native");
    const made = await l.run(["mkdir", "--explain", "scratch:/d"]);
    assertStringIncludes(made.out, "mkdir: emulated (no-marker");
    assertEquals((await l.run(["ls", "scratch:/"])).out, "");
    const strict = await l.run(["mkdir", "--strict", "scratch:/d"]);
    assertEquals(strict.code, 1);
    assertStringIncludes(strict.err, "E-STRICT");
    const lenient = await l.run(["mkdir", "-v", "scratch:/d"]);
    assertEquals(lenient.code, 0);
    assertStringIncludes(lenient.out + lenient.err, "mkdir: emulated (no-marker");
    const read = await l.run(["cat", "--strict", "fleet:/a.txt"]);
    assertEquals(read.code, 0);
    assert(read.bytes.length > 0);
  }),
);
