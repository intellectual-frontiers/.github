// Spec: 0046-arcactl FR-011
/**
 * The package `@intellectual-frontiers/arcactl` that `tools/pack.ts` builds from this library (commons data 0046-arcactl FR-011): the manifest that is published, the one bundled file, and that file run
 * from an empty folder, as installed from the tarball, on Bun and on Node, against PGlite served on a socket, giving the report the sources give.
 *
 * @module
 */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { invariants } from "@intellectual-frontiers/data/sql/extensions/invariants";
import { bind } from "@intellectual-frontiers/data/sql/physical";
import { schemaOf, settingsOf } from "@intellectual-frontiers/data/sql/cli";
import { publishedManifest, PACKAGE, stage } from "../tools/pack.ts";
import { library } from "../library.ts";
import { bunPath, pgliteServer, run, which } from "./net-fixtures.ts";
import { same } from "./governance-fixture.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const bun = bunPath();
const node = which("node");
const npm = which("npm");
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

proves(
  ["0046-arcactl FR-011"],
  "the package that is published is named arcactl, has the version of the library, one file as its bin, `pg` as an optional dependency and nothing of the repository's own, the folder's own package.json stays private, and the file is one bundle that holds none of the test tools",
  async () => {
    const own = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Record<string, unknown>;
    same(own["private"], true, "nothing is published from this folder by hand");
    const m = publishedManifest(own);
    same([m["name"], m["version"]], [PACKAGE, own["version"]]);
    same(PACKAGE, "@intellectual-frontiers/arcactl");
    same(m["version"], library.version, "the version of the library is the version of the package");
    same(m["bin"], { arcactl: "./arcactl.mjs" });
    assert(!("dependencies" in m) && !("devDependencies" in m) && !("private" in m) && !("scripts" in m) && !("peerDependencies" in m), "nothing of this folder's own");
    same(m["optionalDependencies"], { pg: "^8.23.1" });
    same(m["publishConfig"], { access: "public" });
    same((m["repository"] as { directory: string }).directory, "commons/data");
    same(m["files"], ["arcactl.mjs", "README.md", "LICENSE"]);
    assert(library.distribution.includes("npm") && library.distribution.includes("github"), "published to both");
    const dir = await stage();
    const file = join(dir, "arcactl.mjs");
    const text = readFileSync(file, "utf8");
    assert(text.startsWith("#!/usr/bin/env node\n") && (statSync(file).mode & 0o111) !== 0, "an executable that starts from the shebang of Node");
    assert(!text.includes("/home/") && !text.includes(ROOT) && !text.includes("pglite") && !text.includes("duckdb") && !/from ["']bun:test/.test(text), "none of this machine and none of the test tools");
    assert(statSync(file).size < 1_000_000, `${statSync(file).size} bytes`);
    same(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")), m);
    assert(readFileSync(join(dir, "LICENSE"), "utf8").startsWith("MIT License") && readFileSync(join(dir, "README.md"), "utf8").includes("arcactl doctor"));
  },
);

proves(
  ["0046-arcactl FR-011"],
  "the tarball installs into an empty project and its command runs there, on Bun with Bun's own client and on Node with pg, and gives the report the sources give against a database on a socket, and on Node without pg says what to install",
  async () => {
    const config = must(settingsOf({ models: ["identityAgent"] }));
    const schema = must(schemaOf(config)).schema;
    const statements = must(bind(schema, { dialect: postgres, schema: "arca", sources: [invariants()] })).statements.map((s) => s.sql);
    const db = await pgliteServer(statements);
    const work = mkdtempSync(join(tmpdir(), "arcactl-package-"));
    try {
      const staged = await stage();
      const pack = await run(bun, ["pm", "pack", "--destination", work], { PATH: dirname(bun) }, undefined, 120000, staged);
      assert(pack.code === 0, pack.err);
      const tgz = join(work, `intellectual-frontiers-arcactl-${library.version}.tgz`);
      assert(existsSync(tgz), `${tgz} is made`);
      const url = `postgres://postgres@127.0.0.1:${db.port}/postgres?sslmode=disable`;
      const args = ["doctor", "--models", "identityAgent", "--url", url, "--json"];
      const env = { PATH: `${dirname(bun)}:${node === undefined ? "" : dirname(node)}:/usr/bin:/bin`, HOME: work };
      // installed as a person would, with nothing else (npm, from the tarball, without the optional pg)
      assert(npm !== undefined, "npm is here");
      const project = join(work, "project");
      mkdirSync(project);
      const install = await run(npm as string, ["install", tgz, "--omit=optional", "--ignore-scripts", "--no-audit", "--no-fund", "--offline", "--prefix", project], { ...env, npm_config_cache: join(work, "cache") }, undefined, 120000);
      assert(install.code === 0, install.err);
      const command = join(project, "node_modules", ".bin", "arcactl");
      assert(existsSync(command), "npm made the command");
      same(readFileSync(join(project, "node_modules", PACKAGE, "package.json"), "utf8").includes(`"version": "${library.version}"`), true);
      // on Bun: the command, which `bun` runs from the file
      const bundle = join(project, "node_modules", PACKAGE, "arcactl.mjs");
      const help = await run(bun, [bundle, "--help"], env);
      assert(help.code === 0 && help.out.includes("arcactl doctor") && help.out.includes("arcactl shell"), help.err);
      const onBun = await run(bun, [bundle, ...args], env);
      const parsedBun = JSON.parse(onBun.out) as { summary: Record<string, number>; mode: string };
      same([onBun.code, parsedBun.summary], [1, { pass: 8, warn: 1, fail: 0, unknown: 0 }], `bun: ${onBun.err}`);
      same(parsedBun.mode, "server", "no terminal, so the server model");
      // on Node: with pg beside it
      if (node === undefined) throw new Error("node is required for this test");
      const withPg = join(project, "node_modules", "pg");
      symlinkSync(join(ROOT, "node_modules", "pg"), withPg);
      const nodeHelp = await run(node, [bundle, "--help"], env);
      assert(nodeHelp.code === 0 && nodeHelp.out.includes("arcactl doctor"), nodeHelp.err);
      const onNode = await run(node, [bundle, ...args], env);
      const parsedNode = JSON.parse(onNode.out) as { summary: Record<string, number> };
      same([onNode.code, parsedNode.summary], [1, { pass: 8, warn: 1, fail: 0, unknown: 0 }], `node ${process.version}: ${onNode.err}`);
      // on Node without pg: it says what to install, and exits 2
      rmSync(withPg);
      const bare = await run(node, [bundle, ...args], env);
      assert(bare.code === 2 && bare.err.includes("pg"), bare.err);
      // the command the package installs is the same file
      const viaBin = await run(command, ["--help"], env);
      assert(viaBin.code === 0 && viaBin.out.includes("arcactl doctor"), viaBin.err);
      chmodSync(work, 0o755);
    } finally {
      await db.close();
      rmSync(work, { recursive: true, force: true });
    }
  },
);
