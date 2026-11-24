/**
 * Tests of the layers of AnyFS S3 over the shared checker of Kanon (commons anyfs-s3 0001-anyfs-s3-layers FR-001 to FR-005): the table in the manifest holds every file of the real tree with no finding, `verify` runs
 * every check of the library, the network is reached only by the transport, no outside package signs a request, and the library is held from the registries.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import { library } from "../library.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

async function sources(folder: string): Promise<readonly { readonly file: string; readonly text: string }[]> {
  const out: { file: string; text: string }[] = [];
  for await (const e of fs.readDir(path.join(ROOT, folder))) {
    if (e.isFile && e.name.endsWith(".ts")) out.push({ file: `${folder}/${e.name}`, text: await fs.readTextFile(path.join(ROOT, folder, e.name)) });
  }
  return out;
}

proves(["0001-anyfs-s3-layers FR-001"], "the shared checker finds nothing in the real tree", () => {
  assertEquals(readTable(ROOT).kind, "ok");
  assertEquals(decodeTable(library.kanon).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
  assertEquals(library.family, { host: "anyfs", role: "plugin" });
});

proves(["0001-anyfs-s3-layers FR-002"], "verify runs every check of the library", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { scripts: Record<string, string> };
  const verify = pkg.scripts["verify"] ?? "";
  for (const step of ["tsc -p tsconfig.json", "mizan-check.ts --root spec-kit", "check.ts --root spec-kit --level L1", "bun ../../kanon/src/check.ts", "bun tools/check.ts", "bun test suite/", "bun tools/pack.ts --check"]) {
    assert(verify.includes(step), `verify runs ${step}`);
  }
});

proves(["0001-anyfs-s3-layers FR-003"], "no source reaches the network but the transport, none imports a package that signs or sends for it, and no manifest names one", async () => {
  const src = await sources("src");
  const direct = src.filter((s) => s.file !== "src/transport.ts" && /(?<![.\w])fetch\s*\(|\bXMLHttpRequest\b|from "node:(?:http|https|net|tls)"/u.test(s.text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "")));
  assertEquals(direct.map((s) => s.file), []);
  for (const s of src) assertEquals(/from "@aws-sdk|from "aws4|from "aws-sdk|from "minio|from "@smithy/u.test(s.text), false, s.file);
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) assertEquals(/^(?:@aws-sdk|aws-sdk|aws4|minio|@smithy)/u.test(name), false, name);
});

proves(["0001-anyfs-s3-layers FR-004"], "the manifest holds the library from the registries and names the reason", () => {
  assertEquals(library.held.kind, "unfinished");
  assert(library.held.reason.length > 10);
  assertEquals(library.distribution, ["github"]);
});

proves(["0001-anyfs-s3-layers FR-005"], "the packer is the library's own and verify runs it", async () => {
  assert(await fs.exists(path.join(ROOT, "tools/pack.ts")));
});
