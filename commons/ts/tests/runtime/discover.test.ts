/**
 * Tests of `runtime/discover.ts`: programs found by the prefix of their name on a search path given to it, the first of a name winning,
 * directories and files that may not be run passed over with why, and Windows' rules (`;`, PATHEXT in its order, the extension left out
 * of the name, case ignored) proven on any system by giving the platform.
 *
 * @module
 */
import { chmod, mkdir, withTempDir, writeTextFile } from "../../runtime/fs.ts";
import { discoverPrograms, pathExtensions, skipReasonText } from "../../runtime/discover.ts";
import { join } from "../../runtime/path.ts";
import { build } from "../../runtime/proc.ts";
import { assertEquals, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-071";

/** A file that this account may run. */
async function program(file: string): Promise<void> {
  await writeTextFile(file, "#!/bin/sh\necho hello\n");
  await chmod(file, 0o755);
}

proves([FR], "POSIX rules: first of a name wins; a directory and a file that may not be run are passed over with why", async () => {
  if (build.os === "windows") return;
  await withTempDir(async (dir) => {
    const a = join(dir, "a");
    const b = join(dir, "b");
    await mkdir(a);
    await mkdir(b);
    await program(join(a, "tool-hello"));
    await program(join(b, "tool-hello"));
    await program(join(b, "tool-other"));
    await mkdir(join(a, "tool-dir"));
    await writeTextFile(join(a, "tool-plain"), "not a program");
    await chmod(join(a, "tool-plain"), 0o644);
    await program(join(a, "other-x"));
    const r = await discoverPrograms("tool-", { path: [a, join(dir, "missing"), "", b].join(":"), platform: "posix" });
    assertEquals(r.found, [
      { name: "hello", file: join(a, "tool-hello") },
      { name: "other", file: join(b, "tool-other") },
    ]);
    assertEquals(r.skipped, [
      { file: join(a, "tool-dir"), why: { kind: "directory" } },
      { file: join(a, "tool-plain"), why: { kind: "not-executable" } },
      { file: join(b, "tool-hello"), why: { kind: "shadowed", by: join(a, "tool-hello") } },
    ]);
    assertEquals(skipReasonText({ kind: "shadowed", by: "x" }), "shadowed by x");
  });
});

proves(
  [FR],
  "Windows rules given as the platform: ';' between folders, PATHEXT in its order, the extension left out, case ignored",
  async () => {
    await withTempDir(async (dir) => {
      const a = join(dir, "a");
      const b = join(dir, "b");
      await mkdir(a);
      await mkdir(b);
      await writeTextFile(join(a, "tool-hello.cmd"), "@echo hello");
      await writeTextFile(join(a, "tool-hello.EXE"), "MZ");
      await writeTextFile(join(a, "tool-notes.txt"), "text");
      await writeTextFile(join(b, "tool-HELLO.Cmd"), "@echo hello");
      await writeTextFile(join(b, "tool-world.CMD"), "@echo world");
      const r = await discoverPrograms("tool-", { path: `${a};${b}`, pathext: ".EXE;.CMD", platform: "windows" });
      assertEquals(
        r.found.map((f) => f.name),
        ["hello", "world"],
      );
      assertEquals(r.found[0]?.file.endsWith("tool-hello.EXE"), true);
      assertEquals(
        r.skipped.map((s) => [s.file.slice(dir.length + 1).replaceAll("\\", "/"), s.why.kind]),
        [
          ["a/tool-hello.cmd", "shadowed"],
          ["a/tool-notes.txt", "not-executable"],
          ["b/tool-HELLO.Cmd", "shadowed"],
        ],
      );
      assertEquals(pathExtensions(undefined), [".EXE", ".CMD", ".BAT", ".COM"]);
      assertEquals(pathExtensions(".exe; .Ps1;"), [".EXE", ".PS1"]);
    });
  },
);
