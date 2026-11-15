/**
 * Tests of `runtime/compile.ts` (commons 0005-typescript-runtime FR-062) and, from a compiled binary, of `proc.selfCommand` (FR-053): the
 * argument vector asked of Bun for every target, built purely (a Windows target named `.exe`, the embedded files after the entry point);
 * the targets of the systems; and, where Bun is on `PATH`, a small program built for this computer with a file embedded, run, its SHA-256
 * checked, and running itself again as the binary alone; a missing Bun, a Bun that is not the pinned version, and a build that fails are
 * each a `CompileError`. Building for another system needs Bun to fetch that system's runtime, so it is shown by the argument vector,
 * not run.
 *
 * @module
 */
import { readFile, realPath, sha256File, withTempDir, writeTextFile } from "../../runtime/fs.ts";
import {
  binaryPath,
  compile,
  compileArgv,
  type CompileError,
  describeCompileError,
  hostTarget,
  isWindows,
  type Target,
  TARGETS,
  targetOf,
} from "../../runtime/compile.ts";
import { fromFileUrl, join } from "../../runtime/path.ts";
import * as proc from "../../runtime/proc.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-062";
const SELF = "0005-typescript-runtime FR-053";

const BUN = proc.which("bun");
const NO_BUN = BUN === undefined ? { skip: "no bun on PATH: the build for this computer is shown where Bun is (CI has it)" } : {};
const HOST = hostTarget();

proves(
  [FR],
  "the argument vector for each target: --target=bun-<target>, the outfile, extra options, the entry, the embedded files",
  () => {
    const base = { entry: "src/main.ts", outfile: "dist/tool", files: ["assets/a.txt", "assets/b.png"] } as const;
    for (const target of TARGETS) {
      const out = binaryPath(base.outfile, target);
      assertEquals(compileArgv("/opt/bun", { ...base, target, extraArgs: ["--minify"] }, out), [
        "/opt/bun",
        "build",
        "--compile",
        `--target=bun-${target}`,
        `--outfile=${out}`,
        "--minify",
        "src/main.ts",
        "assets/a.txt",
        "assets/b.png",
      ]);
    }
    assertEquals(
      compileArgv("bun", { entry: "m.ts", outfile: "m" }, "m"),
      ["bun", "build", "--compile", "--outfile=m", "m.ts"],
      "no target: this computer",
    );
  },
);

proves([FR], "compile asked for windows-x64 names an .exe; the other targets keep the name; targets of the systems", () => {
  assertEquals(binaryPath("dist/tool", "windows-x64"), "dist/tool.exe");
  assertEquals(binaryPath("dist/tool.EXE", "windows-x64"), "dist/tool.EXE");
  assertEquals(binaryPath("dist/tool", "linux-arm64"), "dist/tool");
  assertEquals(
    TARGETS.map((t) => isWindows(t)),
    [false, false, false, false, true],
  );
  assertEquals(
    [targetOf("linux", "x86_64"), targetOf("linux", "aarch64"), targetOf("darwin", "x86_64"), targetOf("darwin", "aarch64")],
    ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"],
  );
  assertEquals(
    [targetOf("windows", "x86_64"), targetOf("windows", "aarch64"), targetOf("freebsd", "x86_64")],
    ["windows-x64", undefined, undefined],
  );
  assertEquals(HOST, targetOf(proc.build.os, proc.build.arch));
  const errors: readonly CompileError[] = [
    { kind: "no-bun", message: "no bun on PATH" },
    { kind: "wrong-bun", expected: "1.4.4", found: "1.3.0" },
    { kind: "no-target", message: "none" },
    { kind: "failed", code: 1, stderr: "boom\n" },
    { kind: "no-binary", path: "/x" },
  ];
  assertEquals(errors.map(describeCompileError), [
    "no bun on PATH",
    "Bun 1.3.0 is not the pinned 1.4.4",
    "none",
    "bun build --compile failed (1): boom",
    "bun build --compile wrote no binary at /x",
  ]);
  const all: readonly Target[] = TARGETS;
  assertEquals(new Set(all).size, 5);
});

const MARK = "ifc-embedded-mark-5f0c";

/** A small program: it reads a file it imports, says whether it is compiled and how it would run itself again, with its arguments. */
const PROGRAM = (procPath: string): string => `
import process from "node:process";
import { readFileSync } from "node:fs";
import { isCompiled, selfCommand, selfFacts } from ${JSON.stringify(procPath)};
import note from "./note.txt" with { type: "file" };
process.stdout.write(JSON.stringify({
  note: readFileSync(note, "utf8"),
  compiled: isCompiled(selfFacts()),
  self: selfCommand(["again"]),
  args: process.argv.slice(2),
}));
`;

proves(
  [FR, SELF],
  "a program built for this computer runs, its SHA-256 is given, its files are embedded, and selfCommand is the binary alone",
  async () => {
    await withTempDir(async (dir) => {
      await writeTextFile(join(dir, "note.txt"), "a note");
      await writeTextFile(join(dir, "extra.txt"), MARK);
      await writeTextFile(join(dir, "main.ts"), PROGRAM(fromFileUrl(new URL("../../runtime/proc.ts", import.meta.url))));
      const r = await compile({ entry: "main.ts", outfile: "out/tool", files: ["extra.txt"], cwd: dir });
      assert(r.kind === "ok", r.kind === "err" ? describeCompileError(r.error) : "");
      const built = r.value;
      assertEquals(built.target, HOST);
      assertEquals(built.path, join(dir, proc.build.os === "windows" ? "out/tool.exe" : "out/tool"));
      assertEquals(built.sha256, await sha256File(built.path));
      assertEquals(built.bunVersion, (await proc.must([BUN ?? "bun", "--version"])).trim());
      const ran = await proc.run([built.path, "one", "two words"]);
      assertEquals(ran.code, 0, ran.stderr);
      const out: { readonly self: readonly string[] } & Record<string, unknown> = JSON.parse(ran.stdout);
      // The binary sees its own path resolved (macOS's /var is /private/var), so the two are compared as real paths.
      assertEquals(await realPath(out.self[0] ?? ""), await realPath(built.path));
      assertEquals({ ...out, self: out.self.slice(1) }, { note: "a note", compiled: true, self: ["again"], args: ["one", "two words"] });
      const binary = new TextDecoder("latin1").decode(await readFile(built.path));
      assert(binary.includes(MARK), "the file given is embedded");
    });
  },
  { ...NO_BUN, timeout: 120_000 },
);

proves(
  [FR],
  "a missing Bun, a Bun that is not the pinned version, and a build that fails are each a CompileError",
  async () => {
    await withTempDir(async (dir) => {
      const missing = await compile({ entry: "main.ts", outfile: "x", cwd: dir, bun: join(dir, "no-such-bun") });
      assertEquals(missing.kind === "err" ? missing.error.kind : missing.kind, "no-bun");
      const wrong = await compile({ entry: "main.ts", outfile: "x", cwd: dir, bunVersion: "0.0.0-not-pinned" });
      assertEquals(wrong.kind === "err" ? wrong.error.kind : wrong.kind, "wrong-bun");
      const failed = await compile({ entry: "no-such-entry.ts", outfile: "x", cwd: dir });
      assert(failed.kind === "err" && failed.error.kind === "failed", JSON.stringify(failed));
    });
  },
  { ...NO_BUN, timeout: 60_000 },
);
