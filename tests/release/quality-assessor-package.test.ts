/**
 * The assessor of the published package (commons 0001-quality-evidence FR-069): Quality is packed, installed with the packed libraries it depends on into an empty project, and the assessor's own reading of the
 * verifier's two source files (`verifierSources` of `@intellectual-frontiers/quality/assessor/host`, what `packSourceOf` makes a pack with) is run under Node 26 (downloaded into a temporary folder
 * where the `node` on the path is not 26) and under Bun. Under Node the module is the compiled `dist/assessor/host.js`, beside which no `.ts` exists. Needs the network only for Node 26 and for the packages of npm.
 *
 * @module
 */
import { fs, path, proc } from "../../commons/system/src/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../commons/test/src/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..");
const NODE_VERSION = "v26.13.1";

type Json = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Json => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : {});

async function sh(
  argv: readonly string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<{ readonly code: number; readonly out: string }> {
  const r = await proc.run(argv, env === undefined ? { cwd } : { cwd, env });
  return { code: r.code, out: `${r.stdout}${r.stderr}` };
}

/** A Node 26 binary: the one on the path where it is 26, else the release downloaded into the folder. */
async function node26(tmp: string): Promise<string | undefined> {
  const have = proc.which("node");
  if (have !== undefined && (await sh([have, "--version"], tmp)).out.startsWith("v26")) return have;
  const dir = path.join(tmp, "node26");
  await fs.mkdir(dir, { recursive: true });
  const archive = path.join(dir, "node.tar.xz");
  const got = await sh(
    ["curl", "-fsSL", "-o", archive, `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz`],
    dir,
  );
  if (got.code !== 0) return undefined;
  const unpacked = await sh(["tar", "-xJf", archive, "-C", dir, "--strip-components=1"], dir);
  return unpacked.code === 0 ? path.join(dir, "bin", "node") : undefined;
}

/** The libraries of this repository that the package depends on, with those they depend on, as folders. */
function linkedFolders(dir: string, seen: Map<string, string>): void {
  const manifest = obj(JSON.parse(fs.readTextFileSync(path.join(dir, "package.json"))));
  for (const group of ["dependencies", "devDependencies"]) {
    for (const [dep, spec] of Object.entries(obj(manifest[group]))) {
      if (typeof spec !== "string" || !spec.startsWith("link:") || seen.has(dep)) continue;
      const at = path.resolve(dir, spec.slice("link:".length));
      seen.set(dep, at);
      linkedFolders(at, seen);
    }
  }
}

proves(
  ["0001-quality-evidence FR-069", "0001-quality-evidence FR-066"],
  "the packed and installed Quality finds the verifier's two files from dist/assessor under Node 26 and under Bun",
  async () => {
    const bun = proc.which("bun") ?? "bun";
    const tmp = await fs.makeTempDir({ prefix: "quality-assessor-package-" });
    try {
      const project = path.join(tmp, "project");
      await fs.mkdir(path.join(project, "node_modules"), { recursive: true });
      await fs.writeTextFile(path.join(project, "package.json"), '{ "name": "consumer", "private": true, "type": "module" }\n');
      const quality = path.join(ROOT, "commons", "quality");
      // Quality and every library it links to are packed (a library of npm that is a `link:` here is a package of the registry for the consumer)
      const folders = new Map<string, string>([["@intellectual-frontiers/quality", quality]]);
      linkedFolders(quality, folders);
      const external: Record<string, string> = {};
      for (const [name, dir] of folders) {
        if (!fs.existsSync(path.join(dir, "tools", "pack.ts"))) continue;
        const installed = await sh([bun, "install", "--frozen-lockfile"], dir);
        assertEquals(installed.code, 0, `${name}: bun install: ${installed.out}`);
        const packed = await sh([bun, "tools/pack.ts"], dir);
        assertEquals(packed.code, 0, `${name}: ${packed.out.slice(0, 1500)}`);
        const tarball = (packed.out.match(/\S+\.tgz/g) ?? []).at(-1) ?? "";
        assert(tarball.endsWith(".tgz") && fs.existsSync(tarball), `${name}: no tarball in ${packed.out}`);
        const into = path.join(project, "node_modules", ...name.split("/"));
        await fs.mkdir(into, { recursive: true });
        const unpacked = await sh(["tar", "-xzf", tarball, "-C", into, "--strip-components=1"], dir);
        assertEquals(unpacked.code, 0, unpacked.out);
        const manifest = obj(JSON.parse(await fs.readTextFile(path.join(into, "package.json"))));
        for (const [dep, version] of Object.entries(obj(manifest["dependencies"]))) {
          if (!dep.startsWith("@intellectual-frontiers/") && typeof version === "string") external[dep] = version;
        }
      }
      // the package ships the two files the assessor reads, and compiles none of them beside its compiled module
      const installedQuality = path.join(project, "node_modules", "@intellectual-frontiers", "quality");
      for (const f of ["verify-pack.ts", "verify.ts"]) {
        assert(fs.existsSync(path.join(installedQuality, "src", "assessor", f)), `the package ships src/assessor/${f}`);
        assert(!fs.existsSync(path.join(installedQuality, "dist", "assessor", f)), `dist/assessor has no ${f}`);
      }
      if (Object.keys(external).length > 0) {
        await fs.writeTextFile(
          path.join(project, "package.json"),
          `${JSON.stringify({ name: "consumer", private: true, type: "module", dependencies: external }, null, 2)}\n`,
        );
        const npm = await sh([bun, "install"], project);
        assertEquals(npm.code, 0, `the packages of npm: ${npm.out}`);
      }
      // the assessor's reading of the verifier's files, from the installed module
      await fs.writeTextFile(
        path.join(project, "read.mjs"),
        [
          'import { verifierSources } from "@intellectual-frontiers/quality/assessor/host";',
          'import { dirname } from "node:path";',
          'import { fileURLToPath } from "node:url";',
          'const here = dirname(fileURLToPath(import.meta.resolve("@intellectual-frontiers/quality/assessor/host")));',
          "const r = await verifierSources(here);",
          'if (r.kind !== "ok") throw new Error(JSON.stringify(r.error));',
          'if (!r.value.main.includes("verifyPack") || r.value.pack.length < 1000) throw new Error("the verifier files are not the verifier");',
          'console.log("verifier read from " + here);',
          "",
        ].join("\n"),
      );
      const onBun = await sh([bun, "read.mjs"], project);
      assertEquals(onBun.code, 0, `Bun: ${onBun.out}`);
      assertStringIncludes(onBun.out, "verifier read from");
      const node = await node26(tmp);
      assert(node !== undefined, "Node 26 is neither on the path nor downloadable");
      const onNode = await sh([node, "read.mjs"], project);
      assertEquals(onNode.code, 0, `Node 26: ${onNode.out}`);
      assertStringIncludes(onNode.out, path.join("dist", "assessor"));
    } finally {
      await fs.remove(tmp, { recursive: true });
    }
  },
);
