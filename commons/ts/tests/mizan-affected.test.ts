/**
 * What a change affects (commons 0027-commons-libraries FR-019 to FR-022): a repository of real files in a temporary folder, with a package of commons that exports a kernel and a runtime and two libraries that
 * depend on it and on each other by path, gives the inputs of each library and the libraries that a change affects; the real repository's data workflow runs on every input of the library.
 *
 * @module
 */
import { affectedBy, changedSince, inputsOf, main, matches, matrixOf } from "../mizan/affected.ts";
import { readLibraries } from "../mizan/libraries.ts";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { main as generate } from "../tools/generate-workflows.ts";

const SPEC = "0027-commons-libraries";
const ROOT = resolve(fromFileUrl(new URL("../../..", import.meta.url)));

const put = (root: string, file: string, text: string): void => {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeTextFileSync(join(root, file), text);
};
const lib = (name: string, extra: Readonly<Record<string, unknown>> = {}): string =>
  `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: "0.1.0", exports: [], ...extra })};\n`;

/** commons/ts (the kernel, the runtime, a tool), commons/alpha (imports the kernel, runs a tool) and commons/beta (imports alpha and the runtime's whole package). */
function repo(root: string): void {
  put(
    root,
    "commons/ts/package.json",
    JSON.stringify({ name: "@x/commons", exports: { "./ts/kernel": "./kernel/mod.ts", "./ts/runtime": "./runtime/mod.ts" } }),
  );
  put(root, "commons/ts/kernel/mod.ts", 'export { util } from "./util.ts";\n');
  put(root, "commons/ts/kernel/util.ts", "export const util = 1;\n");
  put(root, "commons/ts/runtime/mod.ts", "export const rt = 1;\n");
  put(root, "commons/ts/other/thing.ts", "export const thing = 1;\n");
  put(root, "commons/tools/check.ts", 'import { util } from "../ts/kernel/util.ts";\nexport const c = util;\n');
  put(root, "commons/alpha/library.ts", lib("alpha"));
  put(
    root,
    "commons/alpha/package.json",
    JSON.stringify({
      name: "@x/alpha",
      exports: { "./api": "./api.ts" },
      devDependencies: { "@x/commons": "link:../ts", left: "^1.0.0" },
      scripts: { verify: "bun ../tools/check.ts" },
    }),
  );
  put(root, "commons/alpha/api.ts", 'import { util } from "@x/commons/ts/kernel";\nexport const a = util;\n');
  put(root, "commons/beta/library.ts", lib("beta"));
  put(
    root,
    "commons/beta/package.json",
    JSON.stringify({ name: "@x/beta", devDependencies: { "@x/alpha": "link:../alpha", "@x/commons": "link:../ts" } }),
  );
  put(
    root,
    "commons/beta/main.ts",
    'import { a } from "@x/alpha/api";\nimport { x } from "@x/commons/ts/unlisted";\nexport const b = [a, x];\n',
  );
}

proves(
  [`${SPEC} FR-019`, `${SPEC} FR-020`],
  "a library's dependencies are read from its package (link: to a folder, a registry version none), and its inputs are its folder, the shared tools, the entries it imports with what they import by relative paths, the files its scripts run, and a whole dependency where an import has no export",
  async () => {
    await withTempDir((dir) => {
      repo(dir);
      const a = inputsOf(dir, "alpha");
      assertEquals(a.dependsOn, ["ts"], "link:../ts is a dependency and ^1.0.0 is not");
      assertEquals(a.files, ["commons/tools/check.ts", "commons/ts/kernel/mod.ts", "commons/ts/kernel/util.ts"]);
      assert(a.paths.includes("commons/alpha/**") && a.paths.includes("commons/ts/kernel/**") && a.paths.includes("commons/tools/**"));
      assert(a.paths.includes(".github/actions/**") && a.paths.includes(".github/workflows/alpha.auto.yml"));
      assert(!a.paths.includes("commons/ts/runtime/**") && !a.paths.includes("commons/ts/**"), "the runtime is not imported");
      const b = inputsOf(dir, "beta");
      assertEquals(b.dependsOn, ["alpha", "ts"]);
      assert(b.paths.includes("commons/ts/**"), "an import the exports do not give takes the whole dependency");
      assert(b.paths.includes("commons/alpha/**"), "a dependency library's entry is an input");
      assertEquals(matches(a.paths, "commons/ts/kernel/util.ts"), true);
      assertEquals(matches(a.paths, "commons/ts/runtime/mod.ts"), false);
      return Promise.resolve();
    });
  },
);

proves(
  [`${SPEC} FR-021`],
  "a changed file affects the libraries that read it and those that depend on them, a shared file every library and a file no library reads none; the matrix, --files, --all, and a base that Git does not know",
  async () => {
    await withTempDir(async (dir) => {
      repo(dir);
      const names = (files: readonly string[]): readonly string[] => affectedBy(dir, files).map((l) => l.name);
      assertEquals(
        names(["commons/ts/kernel/util.ts"]),
        ["alpha", "beta"],
        "a file of what alpha imports; beta depends on alpha and on the whole of commons/ts",
      );
      assertEquals(names(["commons/alpha/api.ts"]), ["alpha", "beta"], "the library's own file, and the library that depends on it");
      assertEquals(names(["commons/beta/main.ts"]), ["beta"]);
      assertEquals(names(["commons/ts/other/thing.ts"]), ["beta"], "only the library that takes the whole dependency");
      assertEquals(names([".github/actions/bun/action.yml"]), ["alpha", "beta"]);
      assertEquals(names(["commons/tools/check.ts"]), ["alpha", "beta"]);
      assertEquals(names(["README.md", "commons/spec-kit/x.md"]), [], "no library reads these");
      assertEquals(
        matrixOf(affectedBy(dir, ["commons/beta/main.ts"])),
        '{"include":[{"name":"beta","folder":"commons/beta","verify":"bun run verify"}]}',
      );
      assertEquals(matrixOf([]), '{"include":[]}');
      assertEquals(await main(["--repo", dir, "--files", "commons/beta/main.ts"]), 0);
      assertEquals(await main(["--repo", dir, "--all"]), 0);
      assertEquals(await main(["--repo", dir]), 2, "no flag is a usage error");
      assertEquals(await changedSince(dir, "origin/nothing"), undefined, "no repository and no base: Git cannot say");
      assertEquals(await main(["--repo", dir, "--base", "origin/nothing"]), 0, "every library is affected where Git cannot say");
    });
    // a real Git repository: what changed since the base is what is affected
    const git = proc.which("git");
    if (git === undefined) return;
    await withTempDir(async (dir) => {
      repo(dir);
      const g = (...a: string[]) => proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
      await g("init", "-q", "-b", "main");
      await g("add", ".");
      await g("commit", "-q", "-m", "base");
      await g("checkout", "-q", "-b", "work");
      writeTextFileSync(join(dir, "commons/beta/main.ts"), `${readTextFileSync(join(dir, "commons/beta/main.ts"))}// changed\n`);
      assertEquals(await changedSince(dir, "main"), ["commons/beta/main.ts"]);
      await g("add", ".");
      await g("commit", "-q", "-m", "change");
      assertEquals(await changedSince(dir, "main"), ["commons/beta/main.ts"]);
      assertEquals(
        affectedBy(dir, (await changedSince(dir, "main")) ?? []).map((l) => l.name),
        ["beta"],
      );
    });
  },
);

proves(
  [`${SPEC} FR-022`],
  "a library's generated workflow runs on its inputs as folders, and this repository's data workflow runs on every one of data's inputs",
  async () => {
    await withTempDir((dir) => {
      repo(dir);
      assertEquals(generate(["--repo", dir]), 0);
      const w = readTextFileSync(join(dir, ".github", "workflows", "alpha.auto.yml"));
      for (const p of inputsOf(dir, "alpha").paths) assertStringIncludes(w, p);
      assert(!w.includes("commons/ts/runtime/**"), "the workflow does not run on what the library does not read");
      return Promise.resolve();
    });
    const data = readTextFileSync(join(ROOT, ".github", "workflows", "data.auto.yml"));
    assert(readLibraries(ROOT).some((f) => f.dir === "data"));
    for (const p of inputsOf(ROOT, "data").paths) assertStringIncludes(data, p);
    assertStringIncludes(data, "commons/ts/mizan/**");
    await Promise.resolve();
  },
);
