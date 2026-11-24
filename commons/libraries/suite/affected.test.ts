/**
 * What a change affects (commons 0027-commons-libraries FR-019 to FR-022): a repository of real files in a temporary folder, with a package of commons that exports a kernel and a runtime and two libraries that
 * depend on it and on each other by path, gives the inputs of each library and the libraries that a change affects; the real repository's data workflow runs on every input of the library.
 *
 * @module
 */
import { affectedBy, changedSince, inputsOf, main, matches, matrixOf } from "../src/affected.ts";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SPEC = "0027-commons-libraries";

const put = (root: string, file: string, text: string): void => {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeTextFileSync(join(root, file), text);
};
const lib = (name: string, extra: Readonly<Record<string, unknown>> = {}): string =>
  `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: "0.1.0", exports: [], ...extra })};\n`;

/** commons/base (the kernel, the runtime, a tool), commons/alpha (imports the kernel, runs a tool) and commons/beta (imports alpha and the runtime's whole package). */
function repo(root: string): void {
  put(
    root,
    "commons/base/package.json",
    JSON.stringify({ name: "@x/base", exports: { "./kernel": "./kernel/mod.ts", "./runtime": "./runtime/mod.ts" } }),
  );
  put(root, "commons/base/kernel/mod.ts", 'export { util } from "./util.ts";\n');
  put(root, "commons/base/kernel/util.ts", "export const util = 1;\n");
  put(root, "commons/base/runtime/mod.ts", "export const rt = 1;\n");
  put(root, "commons/base/other/thing.ts", "export const thing = 1;\n");
  put(root, "commons/tools/check.ts", 'import { util } from "../base/kernel/util.ts";\nexport const c = util;\n');
  put(root, "commons/alpha/library.ts", lib("alpha"));
  put(
    root,
    "commons/alpha/package.json",
    JSON.stringify({
      name: "@x/alpha",
      exports: { "./api": "./api.ts" },
      devDependencies: { "@x/base": "link:../base", left: "^1.0.0" },
      scripts: { verify: "bun ../tools/check.ts" },
    }),
  );
  put(root, "commons/alpha/api.ts", 'import { util } from "@x/base/kernel";\nexport const a = util;\n');
  put(root, "commons/alpha/src/mod.ts", 'import { util } from "@x/base/kernel";\nexport const m = util;\n');
  put(root, "commons/beta/src/mod.ts", 'import { a } from "@x/alpha/api";\nexport const b2 = a;\n');
  put(root, "commons/beta/library.ts", lib("beta"));
  put(
    root,
    "commons/beta/package.json",
    JSON.stringify({ name: "@x/beta", devDependencies: { "@x/alpha": "link:../alpha", "@x/base": "link:../base" } }),
  );
  put(
    root,
    "commons/beta/main.ts",
    'import { a } from "@x/alpha/api";\nimport { x } from "@x/base/unlisted";\nexport const b = [a, x];\n',
  );
}

proves(
  [`${SPEC} FR-019`, `${SPEC} FR-020`],
  "a library's dependencies are read from its package (link: to a folder, a registry version none), and its inputs are its folder, the shared tools, the entries it imports with what they import by relative paths, the files its scripts run, and a whole dependency where an import has no export",
  async () => {
    await withTempDir((dir) => {
      repo(dir);
      const a = inputsOf(dir, "alpha");
      assertEquals(a.dependsOn, ["base"], "link:../base is a dependency and ^1.0.0 is not");
      assertEquals(a.files, ["commons/base/kernel/mod.ts", "commons/base/kernel/util.ts", "commons/tools/check.ts"]);
      assert(a.paths.includes("commons/alpha/**") && a.paths.some((x) => x.startsWith("commons/base/kernel/")) && a.paths.includes("commons/tools/**"));
      assert(a.paths.includes(".github/actions/**") && a.paths.includes(".github/workflows/ci.auto.yml"));
      assertEquals(a.imports, [], "the kernel is not a library");
      assert(a.codePaths.some((x) => x.startsWith("commons/base/kernel/")) && !a.codePaths.includes("commons/tools/**"), "the code reads what it imports and no tool");
      assert(!a.paths.includes("commons/base/runtime/**") && !a.paths.includes("commons/base/**"), "the runtime is not imported");
      const b = inputsOf(dir, "beta");
      assertEquals(b.dependsOn, ["alpha", "base"]);
      assertEquals(b.imports, ["alpha"], "the libraries its own code imports by name");
      assert(b.paths.includes("commons/base/**"), "an import the exports do not give takes the whole dependency");
      assert(matches(b.paths, "commons/alpha/api.ts"), "a dependency library's entry is an input");
      assertEquals(matches(a.paths, "commons/base/kernel/util.ts"), true);
      assertEquals(matches(a.paths, "commons/base/runtime/mod.ts"), false);
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
        names(["commons/base/kernel/util.ts"]),
        ["alpha", "beta"],
        "a file of what alpha imports; beta depends on alpha and on the whole of commons/base",
      );
      assertEquals(names(["commons/alpha/api.ts"]), ["alpha", "beta"], "the library's own file, and the library that depends on it");
      assertEquals(names(["commons/beta/main.ts"]), ["beta"]);
      assertEquals(names(["commons/base/other/thing.ts"]), ["beta"], "only the library that takes the whole dependency");
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
  "the development loop reads the same planner with the reach of a library's own code: what its sources import and who imports it, and neither a tool its scripts run nor a workflow",
  async () => {
    await withTempDir((dir) => {
      repo(dir);
      const code = (files: readonly string[]): readonly string[] => affectedBy(dir, files, "code").map((l) => l.name);
      const verify = (files: readonly string[]): readonly string[] => affectedBy(dir, files, "verify").map((l) => l.name);
      assertEquals(code(["commons/base/kernel/util.ts"]), ["alpha", "beta"], "what alpha's own code imports, and beta, which imports alpha");
      assertEquals(code(["commons/alpha/api.ts"]), ["alpha", "beta"]);
      assertEquals(code(["commons/beta/main.ts"]), ["beta"]);
      assertEquals(code(["commons/tools/check.ts"]), [], "a tool that a script runs is read by verify, not by the types and the tests");
      assertEquals(verify(["commons/tools/check.ts"]), ["alpha", "beta"]);
      assertEquals(code([".github/actions/bun/action.yml", ".github/workflows/ci.auto.yml"]), []);
      assertEquals(verify([".github/workflows/ci.auto.yml"]), ["alpha", "beta"], "the workflow of CI is an input of every library's verify");
      assertEquals(code(["commons/base/other/thing.ts"]), [], "beta takes the whole runtime only in a file that is not its own code");
      return Promise.resolve();
    });
  },
);

proves([`${SPEC} FR-020`], "the planner reads template imports and ignores strings with import text", async () => {
  await withTempDir(async (dir) => {
    repo(dir);
    put(dir, "commons/alpha/src/mod.ts", "const example = 'import(\"@x/base/runtime\")';");
    assert(!inputsOf(dir, "alpha").codePaths.includes("commons/base/runtime/**"));
    put(dir, "commons/alpha/src/mod.ts", "await import(`@x/base/runtime`);");
    assert(inputsOf(dir, "alpha").codePaths.some((x) => x.startsWith("commons/base/runtime/")));
    put(dir, "commons/alpha/src/mod.ts", "await import(target);");
    assert(inputsOf(dir, "alpha").codePaths.includes("commons/base/**"));
  });
});

proves(
  [`${SPEC} FR-021`],
  "a library is affected by a file it reads, through the libraries it imports to their last import, and not by a file of a library it links that nothing it reads imports",
  async () => {
    await withTempDir((dir) => {
      repo(dir);
      writeTextFileSync(join(dir, "commons/alpha/unrelated.ts"), "export const unrelated = 1;\n");
      const names = (files: readonly string[]): readonly string[] => affectedBy(dir, files, "verify").map((l) => l.name);
      assertEquals(names(["commons/alpha/unrelated.ts"]), ["alpha"], "beta imports alpha's entry and not this file");
      assertEquals(names(["commons/alpha/api.ts"]), ["alpha", "beta"], "beta imports this entry");
      assertEquals(names(["commons/base/kernel/util.ts"]), ["alpha", "beta"], "beta reaches it through alpha, which imports it");
      return Promise.resolve();
    });
  },
);
