/**
 * What the first library of commons found when it took the kernel by package name (commons 0005-typescript-runtime FR-074 to FR-077), run as it was found so that no one repeats
 * it: a throwaway project in a temporary folder, outside the repository, that depends on `commons/ts` by `link:` and by `file:`, installed by the real `bun install`, then run by
 * the runtime that runs this test (Bun, or Node 26) and checked by the real TypeScript 7 compiler of this package.
 *
 * Windows is not run: a symbolic link there is a junction or needs a privilege, and the finding is about Unix's links; the header says so, as a test of this package should.
 *
 * @module
 */
import { layerFindings, type Ladder } from "../../kernel/layers.ts";
import { lstat, makeTempDir, mkdir, realPath, remove, writeTextFile } from "../../runtime/fs.ts";
import { dirname, fromFileUrl, join, resolve } from "../../runtime/path.ts";
import { run, runtimeName, which } from "../../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../runtime/test.ts";

const ROOT = resolve(dirname(fromFileUrl(import.meta.url)), "../..");
const SKIP = process.platform === "win32" ? "symbolic links are not run on Windows" : false;
const OPTIONS = { skip: SKIP } as const;
const LINKED = "node_modules/@intellectual-frontiers/commons";

/** A project outside the repository: a library `@intellectual-frontiers/probe` with one public surface, `./a`, that reaches the kernel by package name. */
async function project(kind: "link" | "file"): Promise<string> {
  const dir = await makeTempDir({ prefix: "ifc-linked-" });
  await mkdir(join(dir, "node_modules"), { recursive: true });
  const put = (name: string, text: string): Promise<void> => writeTextFile(join(dir, name), text);
  await put(
    "package.json",
    JSON.stringify({
      name: "@intellectual-frontiers/probe",
      private: true,
      type: "module",
      exports: { "./a": "./a.ts" },
      devDependencies: { "@intellectual-frontiers/commons": `${kind}:${ROOT}` },
    }),
  );
  await put("a.ts", 'import { ok } from "@intellectual-frontiers/commons/ts/kernel";\nexport const r = ok(42);\n');
  await put("internal.ts", 'export const secret = "internal";\n');
  await put("main.ts", 'import { r } from "@intellectual-frontiers/probe/a";\nconsole.log(`${r.kind}:${r.value}`);\n');
  await put("deep.ts", 'import("@intellectual-frontiers/probe/internal").then(() => process.exit(0), () => process.exit(7));\n');
  await put("bad.ts", 'import { secret } from "@intellectual-frontiers/probe/internal";\nexport const x = secret;\n');
  const tsconfig = (include: readonly string[]): string =>
    JSON.stringify({
      extends: join(ROOT, "tsconfig.kernel.json"),
      compilerOptions: { skipLibCheck: true },
      include,
    });
  await put("tsconfig.json", tsconfig(["a.ts", "main.ts"]));
  await put("tsconfig.bad.json", tsconfig(["a.ts", "bad.ts"]));
  return dir;
}

/** `bun install` in a project, with what the lockfile says where `frozen`. */
async function install(dir: string, frozen = false): Promise<void> {
  const bun = which("bun");
  assert(bun !== undefined, "bun is not on PATH: every job that runs the tests of this package has installed it");
  const r = await run([bun, "install", ...(frozen ? ["--frozen-lockfile"] : [])], { cwd: dir });
  assert(r.success, `bun install failed: ${r.stdout}${r.stderr}`);
}

const tsc = (dir: string, config: string): Promise<{ readonly code: number | null; readonly stdout: string; readonly stderr: string }> =>
  run([join(ROOT, "node_modules", ".bin", "tsc"), "-p", config], { cwd: dir });

proves(
  ["0005-typescript-runtime FR-074"],
  "Bun installs a link: dependency on commons/ts as a symbolic link to it, a file: dependency as a copy, and a lockfile makes the same link again",
  async () => {
    const linked = await project("link");
    const copied = await project("file");
    try {
      await install(linked);
      const link = await lstat(join(linked, LINKED));
      assert(link.isSymlink, "a link: dependency is not a symbolic link");
      assertEquals(await realPath(join(linked, LINKED)), await realPath(ROOT));
      await remove(join(linked, "node_modules"), { recursive: true });
      await mkdir(join(linked, "node_modules"), { recursive: true });
      await install(linked, true);
      assert((await lstat(join(linked, LINKED))).isSymlink, "the lockfile did not make the link again");
      await install(copied);
      const copy = await lstat(join(copied, LINKED));
      assert(!copy.isSymlink && copy.isDirectory, "a file: dependency is not a copy any more: the finding of FR-074 needs a second look");
    } finally {
      await remove(linked, { recursive: true });
      await remove(copied, { recursive: true });
    }
  },
  OPTIONS,
);

proves(
  ["0005-typescript-runtime FR-075"],
  "a linked kernel is imported by package name and run by this runtime with no hook, a copy is refused by Node and run by Bun, and the compiler checks the linked one",
  async () => {
    const linked = await project("link");
    const copied = await project("file");
    try {
      await install(linked);
      await install(copied);
      const here = await run([process.execPath, "main.ts"], { cwd: linked });
      assertEquals([here.code, here.stdout.trim(), here.stderr], [0, "ok:42", ""]);
      const copy = await run([process.execPath, "main.ts"], { cwd: copied });
      if (runtimeName() === "node") {
        assert(!copy.success, "Node runs a copy under node_modules now: the hook of FR-070 may not be needed");
        assertStringIncludes(copy.stderr, "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING");
      } else assertEquals([copy.code, copy.stdout.trim()], [0, "ok:42"]);
      const compiled = await tsc(linked, "tsconfig.json");
      assertEquals(compiled.code, 0, compiled.stdout + compiled.stderr);
    } finally {
      await remove(linked, { recursive: true });
      await remove(copied, { recursive: true });
    }
  },
  OPTIONS,
);

proves(
  ["0005-typescript-runtime FR-076"],
  "a library imports its own module by its package name through exports, and a file that exports does not name is refused by the runtime and by the compiler",
  async () => {
    const dir = await project("link");
    try {
      await install(dir);
      const named = await run([process.execPath, "main.ts"], { cwd: dir });
      assertEquals(named.stdout.trim(), "ok:42");
      const deep = await run([process.execPath, "deep.ts"], { cwd: dir });
      assertEquals(deep.code, 7, "the runtime imported a file that exports does not name");
      const bad = await tsc(dir, "tsconfig.bad.json");
      assert(bad.code !== 0, "the compiler accepted a file that exports does not name");
      assertStringIncludes(bad.stdout + bad.stderr, "TS2307");
    } finally {
      await remove(dir, { recursive: true });
    }
  },
  OPTIONS,
);

proves(
  ["0005-typescript-runtime FR-077"],
  "the layers check finds a climbing import by relative path and never one by package name",
  () => {
    const ladder: Ladder = [
      { number: 1, name: "low", homes: ["low/"], mayRelyOn: [] },
      { number: 5, name: "high", homes: ["high/"], mayRelyOn: [1] },
    ];
    const rule = (text: string): readonly string[] =>
      layerFindings(ladder, [
        { path: "low/x.ts", text },
        { path: "high/y.ts", text: "export const y = 1;\n" },
      ]).map((f) => f.rule);
    assertEquals(rule('import { y } from "../high/y.ts";\n'), ["layers/above"]);
    assertEquals(rule('import { y } from "@intellectual-frontiers/probe/high";\n'), []);
  },
);
