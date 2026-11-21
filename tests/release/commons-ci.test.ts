/**
 * What the release workflow's `build` job does to the one package, in a fresh clone (commons 0036-distribution FR-029): a shallow clone of the committed state of this repository into an empty folder, `bun install --frozen-lockfile` in `commons/commons` alone
 * (no install at the root, so no other library's development dependencies), `bun run verify` there and `bun tools/pack.ts`, with the tarball it makes. It also reads the generated workflows: the cell of `commons/commons` in `ci.auto.yml` and the `build` job of
 * `release.auto.yml` install in the folder of the package alone and run its `verify`. It proves the committed state, so a change is committed before it is proved. It needs `git`, `bun` and the network of a package manager (or its cache).
 *
 * @module
 */
import { fs, path, proc } from "../../commons/system/src/mod.ts";
import { assert, assertEquals, proves } from "../../commons/test/src/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..");

async function sh(argv: readonly string[], cwd: string): Promise<{ readonly code: number; readonly out: string }> {
  const r = await proc.run(argv, { cwd });
  return { code: r.code, out: `${r.stdout}${r.stderr}` };
}

proves(
  ["0036-distribution FR-029"],
  "a fresh clone with only commons/commons installed passes bun install --frozen-lockfile, bun run verify and bun tools/pack.ts, as the release workflow's build job runs them, and the workflows install in that folder alone",
  async () => {
    const bun = proc.which("bun") ?? "bun";
    const git = proc.which("git") ?? "git";
    // the workflows: the cell of the package and the build job install in its folder, run its verify, and install nothing at the root before it
    const ci = await fs.readTextFile(path.join(ROOT, ".github", "workflows", "ci.auto.yml"));
    const release = await fs.readTextFile(path.join(ROOT, ".github", "workflows", "release.auto.yml"));
    for (const [name, text, job] of [["ci.auto.yml", ci, "verify (${{ matrix.name }})"], ["release.auto.yml", release, "build (${{ matrix.slug }} ${{ matrix.version }})"]] as const) {
      const lines = text.split("\n");
      const start = lines.findIndex((l) => l.trim() === `name: ${job}`);
      assert(start >= 0, `${name} has the job ${job}`);
      const end = lines.findIndex((l, i) => i > start && /^ {2}[\w-]+:$/.test(l));
      const block = lines.slice(start, end === -1 ? undefined : end);
      const installs = block.flatMap((l, i) => (l.includes("run: bun install --frozen-lockfile") ? [block[i + 1] ?? ""] : []));
      assertEquals(installs.length, 1, `${name}: the job ${job} installs once`);
      assertEquals((installs[0] ?? "").trim(), "working-directory: ${{ matrix.folder }}", `${name}: the install is in the folder of the package, not at the root`);
    }
    const scratch = await fs.makeTempDir({ prefix: "commons-ci-" });
    try {
      const clone = path.join(scratch, "clone");
      const cloned = await sh([git, "clone", "--quiet", "--depth", "1", `file://${ROOT}`, clone], scratch);
      assertEquals(cloned.code, 0, `git clone: ${cloned.out}`);
      const folder = path.join(clone, "commons", "commons");
      const cache = path.join(scratch, "cache");
      const env = { BUN_INSTALL_CACHE_DIR: cache };
      const run = async (argv: readonly string[]): Promise<{ readonly code: number; readonly out: string }> => {
        const r = await proc.run(argv, { cwd: folder, env });
        return { code: r.code, out: `${r.stdout}${r.stderr}` };
      };
      const installed = await run([bun, "install", "--frozen-lockfile"]);
      assertEquals(installed.code, 0, `bun install --frozen-lockfile in commons/commons: ${installed.out}`);
      assert(!fs.existsSync(path.join(clone, "node_modules")), "nothing was installed at the root");
      const verified = await run([bun, "run", "verify"]);
      assertEquals(verified.code, 0, `bun run verify in commons/commons: ${verified.out.slice(0, 4000)}`);
      const packed = await run([bun, "tools/pack.ts"]);
      assertEquals(packed.code, 0, `bun tools/pack.ts in commons/commons: ${packed.out.slice(0, 4000)}`);
      const tarball = (packed.out.match(/\S+\.tgz/g) ?? []).at(-1) ?? "";
      assert(tarball.endsWith(".tgz") && fs.existsSync(tarball), `no tarball in ${packed.out}`);
      console.log(`commons ci: ${JSON.stringify({ tarballBytes: (await fs.stat(tarball)).size })}`);
    } finally {
      await fs.remove(scratch, { recursive: true });
    }
  },
  { timeout: 900_000 },
);
