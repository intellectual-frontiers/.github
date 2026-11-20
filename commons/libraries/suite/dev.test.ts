/**
 * The development loop (commons 0001-libraries FR-011): the counts and the failures read from what `bun test` prints, the packages a library must install itself, the libraries linked by name, what each scope affects, the summary
 * in the terminal's marks, and a real run on a repository of real files in a temporary folder (a library with a type error, a failing test and a passing one), whose compiler and runtime are this repository's.
 *
 * @module
 */
import {
  addCounts,
  affectedOf,
  bunCounts,
  failureLines,
  head,
  linkLibraries,
  main,
  ownPackages,
  pool,
  repoRootOf,
  summaryLines,
} from "../src/dev.ts";
import { copyFile, existsSync, mkdirSync, readLink, symlinkSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { linksOf } from "../src/link.ts";
import { fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { proc } from "@intellectual-frontiers/system";
import { build } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const SPEC = "0001-libraries";
const ROOT = resolve(fromFileUrl(new URL("../../..", import.meta.url)));
const PLAIN = { tty: false, colour: false, emoji: false, columns: 80 } as const;

const put = (root: string, file: string, text: string): void => {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeTextFileSync(join(root, file), text);
};
const manifest = (name: string): string =>
  `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: "0.1.0", exports: ["."] })};\n`;

/** Two libraries of a repository: `base` and `top`, whose own code imports `base` by its package name. */
function repo(root: string): void {
  for (const [name, deps] of [
    ["base", {}],
    ["top", { "@intellectual-frontiers/base": "link:../base" }],
  ] as const) {
    put(root, `commons/${name}/library.ts`, manifest(name));
    put(
      root,
      `commons/${name}/package.json`,
      JSON.stringify({ name: `@intellectual-frontiers/${name}`, exports: { ".": "./src/mod.ts" }, devDependencies: { ...deps, typescript: "7.0.2" } }),
    );
    put(root, `commons/${name}/tsconfig.json`, JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: "nodenext", allowImportingTsExtensions: true }, include: ["src/**/*.ts"] }));
  }
  put(root, "commons/base/src/mod.ts", "export const one: number = 1;\n");
  put(root, "commons/top/src/mod.ts", 'import { one } from "@intellectual-frontiers/base";\nexport const two: number = one + 1;\n');
  put(root, "package.json", JSON.stringify({ name: "@x/root", devDependencies: { typescript: "7.0.2" } }));
}

proves(
  [`${SPEC} FR-011`],
  "the counts and the failures are read from what bun test prints, a count with no summary is none, and the counts add",
  () => {
    const out = "bun test v1.4.4\n\n 913 pass\n 3 skip\n 0 fail\nRan 917 tests across 141 files. [55.88s]\n";
    assertEquals(bunCounts(out), { pass: 913, skip: 3, fail: 0, files: 141 });
    assertEquals(bunCounts("1 | throw\nerror: boom\n"), undefined);
    assertEquals(addCounts({ pass: 1, skip: 2, fail: 3, files: 4 }, { pass: 10, skip: 20, fail: 30, files: 40 }), { pass: 11, skip: 22, fail: 33, files: 44 });
    const bad = ["x", "error: expected 1", "      at a.ts:1", "(fail) a test [1.00ms]", "y"].join("\n");
    assertEquals(failureLines(bad), ["error: expected 1", "      at a.ts:1", "(fail) a test [1.00ms]"]);
    assertEquals(failureLines("a\nb").length, 2, "with no marked failure the end of the output is shown");
    assertEquals(head(["a", "b", "c"], 2), ["a", "b", "... and 1 more"]);
    assertEquals(head(["a"], 2), ["a"]);
    return Promise.resolve();
  },
);

proves(
  [`${SPEC} FR-011`],
  "a library installs only what the root does not share: a link is a library, a package the root has is shared and any other is the library's own; the work is shared out several at a time and comes back in order",
  async () => {
    const shared = new Set(["typescript", "fast-check"]);
    assertEquals(
      ownPackages({ devDependencies: { typescript: "7.0.2", "@intellectual-frontiers/core": "link:../core", pg: "8.23.1" }, dependencies: { zod: "4.1.12" } }, shared),
      ["pg", "zod"],
    );
    assertEquals(ownPackages({}, shared), []);
    let running = 0;
    let most = 0;
    const out = await pool([5, 1, 4, 2, 3], 2, async (n) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise<void>((done) => setTimeout(done, n));
      running -= 1;
      return n * 10;
    });
    assertEquals(out, [50, 10, 40, 20, 30]);
    assertEquals(most, 2);
    assertEquals(await pool([], 4, (n: number) => Promise.resolve(n)), []);
  },
);

proves(
  [`${SPEC} FR-011`],
  "every package of commons is linked under commons/node_modules by its name, commons/ts as @intellectual-frontiers/commons, and a second run links nothing",
  async () => {
    await withTempDir(async (dir) => {
      repo(dir);
      put(dir, "commons/ts/package.json", JSON.stringify({ name: "@intellectual-frontiers/commons" }));
      put(dir, "commons/docs/package.json", JSON.stringify({ name: "@intellectual-frontiers/commons" }));
      put(dir, "commons/elsewhere/package.json", JSON.stringify({ name: "@other/thing" }));
      assertEquals([...linksOf(dir).keys()].sort(), ["@intellectual-frontiers/base", "@intellectual-frontiers/commons", "@intellectual-frontiers/top"]);
      assertEquals(linksOf(dir).get("@intellectual-frontiers/commons"), join(dir, "commons", "ts"), "commons/ts wins the name it shares with commons/docs");
      assertEquals(linkLibraries(dir), { kind: "ok", value: 3 });
      const scope = join(dir, "commons", "node_modules", "@intellectual-frontiers");
      assert(existsSync(join(scope, "base", "package.json")) && existsSync(join(scope, "top", "package.json")));
      assertEquals(await readLink(join(scope, "commons")), join(dir, "commons", "ts"));
      assertEquals(linkLibraries(dir), { kind: "ok", value: 0 });
    });
  },
);

proves(
  [`${SPEC} FR-011`],
  "a scope affects the libraries of what it names: a file, a library and the libraries whose own code imports it, every library, or every library where Git cannot say; an unknown library is refused naming the known ones",
  async () => {
    await withTempDir(async (dir) => {
      repo(dir);
      const names = async (scope: Parameters<typeof affectedOf>[1]): Promise<readonly string[] | string> => {
        const r = await affectedOf(dir, scope);
        return r.kind === "ok" ? r.value.libs.map((l) => l.name) : r.error;
      };
      assertEquals(await names({ kind: "files", files: ["commons/base/src/mod.ts"] }), ["base", "top"], "top imports base");
      assertEquals(await names({ kind: "files", files: ["commons/top/src/mod.ts"] }), ["top"]);
      assertEquals(await names({ kind: "only", names: ["base"] }), ["base", "top"]);
      assertEquals(await names({ kind: "all" }), ["base", "top"]);
      assertEquals(await names({ kind: "files", files: ["README.md"] }), []);
      assertEquals(await names({ kind: "since", base: "origin/nothing" }), ["base", "top"], "no repository: every library, and the reason is said");
      const unknown = await names({ kind: "only", names: ["nope"] });
      assert(typeof unknown === "string" && unknown.includes("no library named nope") && unknown.includes("base, top"));
    });
    assertEquals(repoRootOf(join(ROOT, "commons", "libraries", "src")), ROOT);
  },
);

proves([`${SPEC} FR-011`], "the summary is a line for what was looked at, one for each stage with the terminal's marks, and what failed under it", () => {
  const out = summaryLines(
    PLAIN,
    { why: "3 files changed since origin/main", libs: ["base", "top"] },
    [
      { name: "types", outcome: { kind: "passed", detail: "2 libraries in 0.4s" } },
      { name: "tests", outcome: { kind: "failed", detail: "1 fail", output: ["top: (fail) a test"] } },
    ],
    ["linked 2 packages under commons/node_modules"],
    "1.2s",
  );
  assertEquals(out, [
    "dev:check  3 files changed since origin/main",
    "  -> linked 2 packages under commons/node_modules",
    "  affected  2 libraries: base, top",
    "  [ok] types  2 libraries in 0.4s",
    "  [x] tests  1 fail",
    "      top: (fail) a test",
    "  [x] not ready to push (1.2s)",
  ]);
  assertEquals(summaryLines(PLAIN, { why: "x", libs: [] }, [], [], "0s"), ["dev:check  x", "  [skip] nothing is affected: no library reads what changed"]);
  const calm = summaryLines(PLAIN, { why: "x", libs: ["a"] }, [{ name: "types", outcome: { kind: "skipped", detail: "--no-types" } }], [], "0.1s");
  assertEquals(calm.at(-1), "  [ok] ready to push (0.1s)");
  assertStringIncludes(summaryLines({ ...PLAIN, colour: true, emoji: true }, { why: "x", libs: ["a"] }, [], [], "0s").join("\n"), "\u001b[");
  return Promise.resolve();
});

proves(
  [`${SPEC} FR-011`],
  "a real run on real files: the libraries a file affects are type-checked and tested, a type error and a failing test fail the run with the exit status 1 and say where, and a usage error is 2",
  async () => {
    // Windows is left untested here: the temporary repository borrows this library's compiler by a folder link and its tests by `bun:test`, which the runners' Windows has no fixture for; the pure parts above run there
    if (build.os === "windows") return;
    await withTempDir(async (dir) => {
      repo(dir);
      put(dir, "commons/base/suite/one.test.ts", 'import { expect, test } from "bun:test";\nimport { one } from "../src/mod.ts";\ntest("one", () => expect(one).toBe(1));\n');
      put(dir, "commons/top/suite/two.test.ts", 'import { expect, test } from "bun:test";\nimport { two } from "../src/mod.ts";\ntest("two", () => expect(two).toBe(2));\n');
      // the compiler this library is developed with serves the temporary repository, as the root's install serves the real one
      symlinkSync(join(ROOT, "commons", "libraries", "node_modules"), join(dir, "node_modules"), { type: "junction" });
      assertEquals(await main(["--repo", dir, "--no-license", "--files", "commons/base/src/mod.ts"]), 0);
      assertEquals(await main(["--repo", dir, "--no-license", "--files", "commons/base/src/mod.ts", "--list"]), 0);
      put(dir, "commons/top/suite/two.test.ts", 'import { expect, test } from "bun:test";\nimport { two } from "../src/mod.ts";\ntest("two", () => expect(two).toBe(3));\n');
      assertEquals(await main(["--repo", dir, "--no-license", "--only", "top", "--no-types"]), 1, "a failing test");
      put(dir, "commons/top/src/mod.ts", 'import { one } from "@intellectual-frontiers/base";\nexport const two: number = one + "x";\n');
      assertEquals(await main(["--repo", dir, "--no-license", "--only", "top", "--no-tests"]), 1, "a type error");
      assertEquals(await main(["--repo", dir, "--no-license", "--nonsense"]), 2);
      assertEquals(await main(["--repo", dir, "--no-license", "--only", "nope"]), 2);
    });
  },
);

proves(
  [`${SPEC} FR-011`],
  "a fresh checkout, with no link under commons/node_modules and only the root's packages installed, links the libraries by name with a command that imports none, and then runs dev:check --list and release plan --offline",
  async () => {
    // Left untested where the root has no install (the libraries' own CI job installs only the library's packages): there is no root `node_modules` to lend the copy.
    if (!existsSync(join(ROOT, "node_modules", "typescript")) || build.os === "windows") return;
    const git = proc.which("git");
    if (git === undefined) return;
    const listed = await proc.run([git, "-C", ROOT, "ls-files", "-co", "--exclude-standard"]);
    assertEquals(listed.code, 0);
    await withTempDir(async (dir) => {
      for (const f of listed.stdout.split("\n").filter((x) => x !== "" && existsSync(join(ROOT, x)))) {
        mkdirSync(join(dir, f, ".."), { recursive: true });
        await copyFile(join(ROOT, f), join(dir, f));
      }
      assert(!existsSync(join(dir, "commons", "node_modules")), "a fresh checkout has no links");
      // what a fresh clone has after `bun install` at the root: its packages, which are old copies of the libraries and have no kanon
      symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"), { type: "junction" });
      const g = (...a: string[]) => proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a]);
      await g("init", "-q", "-b", "main");
      await g("add", "-A", "--", ".", ":!node_modules");
      await g("commit", "-q", "-m", "fresh");
      const bun = proc.execPath();
      const before = await proc.run([bun, "commons/libraries/src/dev.ts", "--list"], { cwd: dir });
      assert(before.code !== 0 || before.stdout.includes("affected"), "without the links it either fails or, where the root has them, works");
      const linked = await proc.run([bun, "commons/libraries/src/link.ts"], { cwd: dir });
      assertEquals(linked.code, 0, linked.stderr);
      assert(existsSync(join(dir, "commons", "node_modules", "@intellectual-frontiers", "kanon", "package.json")));
      assert(existsSync(join(dir, "commons", "node_modules", "@intellectual-frontiers", "commons", "package.json")), "commons/ts is linked as commons");
      const list = await proc.run([bun, "commons/libraries/src/dev.ts", "--list", "--all"], { cwd: dir });
      assertEquals(list.code, 0, list.stderr);
      assertStringIncludes(list.stdout, "affected");
      const plan = await proc.run([bun, "commons/libraries/src/releasing.ts", "plan", "--offline"], { cwd: dir });
      assertEquals(plan.code, 0, plan.stderr);
      assertStringIncludes(plan.stdout, "released as it is");
    });
  },
);
