/**
 * The package of Repoctl (commons repoctl 0010-repoctl-host FR-003): the tarball made by the packer of commons is installed under the `node_modules` of an empty project and run by Node with no network and no configuration: `repoctl --help`
 * lists the verbs, `repoctl doctor` says there is no configuration, and the entry exports the host, `defineConfig` and the types of the configuration, with the license. In `single` distribution mode (the mode of the repository) the tarball is the one package
 * `@intellectual-frontiers/commons`, which holds Repoctl, names the command `repoctl` in its `bin` and exports it as `@intellectual-frontiers/commons/repoctl`; in `per-library` mode (`IFC_DISTRIBUTION=per-library` for the packer of this test) it is the package of Repoctl alone, with the optional peer.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { CAN_RUN, CHECKOUT, git } from "./world.ts";

const ROOT = path.join(CHECKOUT, "commons/repoctl");
const COMMONS = path.join(CHECKOUT, "commons/commons");

/** No proxy and no registry are reachable by the variables this run is given. */
const offline = (home: string): Record<string, string> => ({ PATH: process.env["PATH"] ?? "", HOME: home, HTTPS_PROXY: "http://127.0.0.1:9", HTTP_PROXY: "http://127.0.0.1:9", NPM_CONFIG_OFFLINE: "true" });

/** Unpacks a tarball as the package `name` under the `node_modules` of an empty scratch project and says where. */
async function install(tar: string, tarball: string, dir: string, name: string): Promise<string> {
  const installed = path.join(dir, "node_modules", name);
  await fs.mkdir(installed, { recursive: true });
  const unpacked = await proc.run([tar, "-xzf", tarball, "-C", installed, "--strip-components=1"]);
  assertEquals(unpacked.code, 0, unpacked.stderr);
  await fs.writeTextFile(path.join(dir, "package.json"), '{ "name": "scratch", "private": true, "type": "module" }\n');
  await git(dir, "init", "-q");
  return installed;
}

/** `repoctl --help`, `doctor` and `check` run by Node from the installed launcher with no network, and the entry imported by the package name `specifier`. */
async function runInstalled(node: string, dir: string, bin: string, specifier: string): Promise<void> {
  const env = offline(dir);
  const help = await proc.run([node, bin, "--help"], { cwd: dir, env });
  assertEquals(help.code, 0, help.stderr);
  for (const verb of ["check", "sync", "merge", "commit", "doctor"]) assert(new RegExp(`^\\s+${verb}\\b`, "m").test(help.stdout), `${verb} is listed`);
  const doctor = await proc.run([node, bin, "doctor"], { cwd: dir, env });
  assertEquals(doctor.code, 1, doctor.stdout + doctor.stderr);
  assertStringIncludes(doctor.stdout + doctor.stderr, "E-CONFIG-MISSING");
  const check = await proc.run([node, bin, "check"], { cwd: dir, env });
  assertEquals(check.code, 3);
  // the entry is importable by Node and defineConfig reads a configuration
  const probe = `import { defineConfig, governance, main } from ${JSON.stringify(specifier)}; const c = defineConfig({ repo: "x", commit: { identity: { name: "A", email: "a@example.test" } } }); console.log(typeof main, governance.parseConfig(c).kind);`;
  const imported = await proc.run([node, "--input-type=module", "-e", probe], { cwd: dir, env });
  assertEquals(imported.stdout.trim(), "function ok", imported.stderr);
}

type Json = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Json => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : {});

proves(["0010-repoctl-host FR-003"], "in single mode the packed commons tarball holds Repoctl, its bin map names repoctl, and the tarball installed into a scratch project runs repoctl --help and repoctl doctor offline, and its repoctl entry exports the host, defineConfig and the types", async () => {
  const node = proc.which("node");
  const tar = proc.which("tar");
  if (!CAN_RUN || node === undefined || tar === undefined) return;
  const install0 = await proc.run(["bun", "install", "--frozen-lockfile"], { cwd: COMMONS });
  assertEquals(install0.code, 0, `${install0.stdout}${install0.stderr}`);
  const packed = await proc.run(["bun", "tools/pack.ts"], { cwd: COMMONS, env: { IFC_DISTRIBUTION: "single" } });
  assertEquals(packed.code, 0, `${packed.stdout}${packed.stderr}`);
  const version = (JSON.parse(await fs.readTextFile(path.join(COMMONS, "package.json"))) as { version: string }).version;
  const tarball = path.join(COMMONS, `dist/intellectual-frontiers-commons-${version}.tgz`);
  assert(await fs.exists(tarball), tarball);
  await fs.withTempDir(async (dir) => {
    const installed = await install(tar, tarball, dir, "@intellectual-frontiers/commons");
    const manifest = JSON.parse(await fs.readTextFile(path.join(installed, "package.json"))) as { bin: Record<string, string>; exports: Record<string, unknown>; license: string };
    assertEquals(manifest.bin["repoctl"], "./bin/repoctl.mjs");
    assert(manifest.exports["./repoctl"] !== undefined, "the entry ./repoctl is exported");
    assertStringIncludes(manifest.license, "PolyForm");
    assert(await fs.exists(path.join(installed, "LICENSE")));
    assert(await fs.exists(path.join(installed, "repoctl/src/mod.ts")), "the sources of Repoctl are in the package");
    const entry = await fs.readTextFile(path.join(installed, "repoctl/dist/src/mod.d.ts"));
    for (const name of ["main", "repoctlProgram"]) assertStringIncludes(entry, name);
    assertStringIncludes(await fs.readTextFile(path.join(installed, "repoctl/dist/src/governance/config.d.ts")), "defineConfig");
    await runInstalled(node, dir, path.join(installed, "bin/repoctl.mjs"), "@intellectual-frontiers/commons/repoctl");
  });
}, { timeout: 180_000 });

proves(["0010-repoctl-host FR-003"], "in per-library mode (IFC_DISTRIBUTION=per-library for the packer) the package of Repoctl alone installed into a scratch project runs repoctl --help and repoctl doctor offline, and its entry exports the host, defineConfig and the types", async () => {
  const node = proc.which("node");
  const tar = proc.which("tar");
  if (!CAN_RUN || node === undefined || tar === undefined) return;
  const packed = await proc.run(["bun", "tools/pack.ts"], { cwd: ROOT, env: { IFC_DISTRIBUTION: "per-library" } });
  assertEquals(packed.code, 0, `${packed.stdout}${packed.stderr}`);
  const version = (JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { version: string }).version;
  const tarball = path.join(ROOT, `dist/intellectual-frontiers-repoctl-${version}.tgz`);
  assert(await fs.exists(tarball), tarball);
  await fs.withTempDir(async (dir) => {
    const installed = await install(tar, tarball, dir, "@intellectual-frontiers/repoctl");
    const manifest = obj(JSON.parse(await fs.readTextFile(path.join(installed, "package.json"))));
    assertEquals(Object.keys(obj(manifest["bin"])), ["repoctl"]);
    assertEquals(obj(obj(manifest["peerDependenciesMeta"])["@intellectual-frontiers/docs"])["optional"], true);
    assertStringIncludes(String(manifest["license"]), "PolyForm");
    assert(await fs.exists(path.join(installed, "LICENSE")));
    const entry = await fs.readTextFile(path.join(installed, "dist/mod.d.ts"));
    for (const name of ["main", "repoctlProgram"]) assertStringIncludes(entry, name);
    assertStringIncludes(await fs.readTextFile(path.join(installed, "dist/governance/config.d.ts")), "defineConfig");
    await runInstalled(node, dir, path.join(installed, "repoctl.mjs"), "@intellectual-frontiers/repoctl");
  });
}, { timeout: 120_000 });
