/**
 * The lockfiles of a release (commons 0001-libraries FR-014): `apply` refreshes the lockfile of every library it releases before the tests that pack run, because those install each library from its lockfile and refuse a stale one. A real repository of real Git
 * history in a temporary folder, a library whose `package.json` gained a `link:` dependency its lockfile does not have, the real `bun install` as the refresh and the same frozen install as the gate: the gate passes after `apply`, and the control (an `apply` that
 * does not refresh) fails it with Bun's own sentence. The generators and `repoctl sync` are the repository's, with their own tests, and are replaced here.
 *
 * @module
 */
import { ok, type Result } from "@intellectual-frontiers/core";
import { proc } from "@intellectual-frontiers/system";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { err } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { applyRelease, type Host, offlinePublishedExports, offlineRegistry, REAL } from "../src/releasing.ts";

const SPEC = "0001-libraries";

const library = (root: string, name: string, links: readonly string[] = []): void => {
  const put = (file: string, text: string): void => {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeTextFileSync(join(root, file), text);
  };
  put(`commons/${name}/library.ts`, `export const library = ${JSON.stringify({ name, level: "L0", verify: "bun run verify", version: "0.1.0", exports: ["."], distribution: ["github", "npm"] })};\n`);
  put(
    `commons/${name}/package.json`,
    `${JSON.stringify({ name: `@x/${name}`, version: "0.1.0", exports: { ".": "./src/mod.ts" }, devDependencies: Object.fromEntries(links.map((l) => [`@x/${l}`, `link:../${l}`])) }, null, 2)}\n`,
  );
  put(`commons/${name}/src/mod.ts`, `${links.map((l) => `import "@x/${l}";`).join("\n")}\nexport const ${name} = 1;\n`);
  put(`commons/${name}/release.ts`, `export const release = ${JSON.stringify({ slug: name, kind: "Library", title: name, authors: [{ name: "x" }], version: "0.1.0", repository: "https://example.org/r" })};\n`);
};

const install = async (dir: string, ...args: string[]): Promise<{ readonly code: number; readonly out: string }> => {
  const bun = proc.which("bun") ?? "bun";
  const r = await proc.run([bun, "install", ...args], { cwd: dir });
  return { code: r.code, out: `${r.stdout}${r.stderr}` };
};

/** The gate of a release as `tests/release/` runs it: every library installed from its lockfile, which is frozen. */
const gate = (folders: readonly string[]): Host["prove"] => async (repo) => {
  for (const f of folders) {
    const r = await install(join(repo, f), "--frozen-lockfile");
    if (r.code !== 0) return err(`${f}: bun install --frozen-lockfile: ${r.out.trim().split("\n").slice(-3).join(" ")}`);
  }
  return ok(undefined);
};

const noop = (): Promise<Result<void, string>> => Promise.resolve(ok(undefined));

proves(
  [`${SPEC} FR-014`],
  "apply refreshes the lockfile of each library it releases before the gate that installs it from the lockfile: a bump that leaves a stale lockfile fails the gate without the refresh and passes with it",
  async () => {
    const git = proc.which("git");
    if (git === undefined) return;
    await withTempDir(async (dir) => {
      const g = async (...a: string[]): Promise<void> => {
        const r = await proc.run([git, "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...a]);
        assertEquals(r.code, 0, `${a.join(" ")}: ${r.stderr}`);
      };
      await g("init", "-q", "-b", "main");
      library(dir, "base");
      library(dir, "extra");
      library(dir, "top", ["base"]);
      const first = await install(join(dir, "commons/top"));
      assertEquals(first.code, 0, first.out);
      assert((await install(join(dir, "commons/top"), "--frozen-lockfile")).code === 0, "a fresh lockfile is frozen-installable");
      await g("add", ".");
      await g("commit", "-q", "-m", "Start");
      for (const t of ["base-v0.1.0", "extra-v0.1.0", "top-v0.1.0"]) await g("tag", t);
      // base changes (so it is released, and top with it), and top gained a dependency that its lockfile does not have
      writeTextFileSync(join(dir, "commons/base/src/more.ts"), "export const more = 1;\n");
      const pkg = join(dir, "commons/top/package.json");
      writeTextFileSync(pkg, readTextFileSync(pkg).replace('"@x/base": "link:../base"', '"@x/base": "link:../base",\n    "@x/extra": "link:../extra"'));
      await g("add", ".");
      await g("commit", "-q", "-m", "Change base and top");
      const stale = await install(join(dir, "commons/top"), "--frozen-lockfile");
      assert(stale.code !== 0, "the lockfile is stale before the release");
      assertStringIncludes(stale.out, "lockfile");
      const folders = ["commons/base", "commons/top"];
      const options = { tests: true, registry: offlineRegistry, published: offlinePublishedExports, mode: "per-library" } as const;
      // control: an apply whose refresh does nothing leaves the gate to fail on the stale lockfile
      const lazy: Host = { lock: noop, sync: noop, generate: noop, prove: gate(folders) };
      const failed = await applyRelease(dir, lazy, options);
      assert(failed.kind === "err", "the gate fails on a stale lockfile");
      assertStringIncludes(failed.error, "commons/top: bun install --frozen-lockfile");
      await g("reset", "-q", "--hard");
      // the real refresh (an install with no frozen flag) in each library the plan releases, before the gate
      const order: string[] = [];
      const real: Host = {
        lock: async (repo, folder) => {
          order.push(`lock ${folder}`);
          return REAL.lock(repo, folder);
        },
        generate: noop,
        sync: () => {
          order.push("sync");
          return Promise.resolve(ok(undefined));
        },
        prove: async (repo) => {
          order.push("gate");
          return gate(folders)(repo);
        },
      };
      const done = await applyRelease(dir, real, options);
      assert(done.kind === "ok", done.kind === "err" ? done.error : "");
      assertEquals(order, ["lock commons/base", "lock commons/top", "sync", "gate"]);
      assertStringIncludes(readTextFileSync(join(dir, "commons/top/bun.lock")), "@x/extra");
      assert(done.value.written.includes("commons/top/bun.lock"), "the refreshed lockfile is among the files written");
      assertStringIncludes(readTextFileSync(pkg), '"version": "0.1.1"');
      assertEquals((await install(join(dir, "commons/top"), "--frozen-lockfile")).code, 0);
    });
  },
  { timeout: 120_000 },
);
