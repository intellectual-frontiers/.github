/**
 * The package of Repoctl (commons repoctl 0010-repoctl-host FR-003): the tarball made by the packer of commons is installed under the `node_modules` of an empty project and run by Node with no network and no configuration: `repoctl --help`
 * lists the verbs, `repoctl doctor` says there is no configuration, and the entry exports the host, `defineConfig` and the types of the configuration, with the license and the optional peer.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { CAN_RUN, CHECKOUT, git } from "./world.ts";

const ROOT = path.join(CHECKOUT, "commons/repoctl");

proves(["0010-repoctl-host FR-003"], "the packed tarball installed into a scratch project runs repoctl --help and repoctl doctor offline, and its entry exports the host, defineConfig and the types", async () => {
  const node = proc.which("node");
  const tar = proc.which("tar");
  if (!CAN_RUN || node === undefined || tar === undefined) return;
  const packed = await proc.run(["bun", "tools/pack.ts"], { cwd: ROOT });
  assertEquals(packed.code, 0, `${packed.stdout}${packed.stderr}`);
  const tarball = path.join(ROOT, "dist/intellectual-frontiers-repoctl-0.1.0.tgz");
  assert(await fs.exists(tarball), tarball);
  await fs.withTempDir(async (dir) => {
    const installed = path.join(dir, "node_modules/@intellectual-frontiers/repoctl");
    await fs.mkdir(installed, { recursive: true });
    const unpacked = await proc.run([tar, "-xzf", tarball, "-C", installed, "--strip-components=1"]);
    assertEquals(unpacked.code, 0, unpacked.stderr);
    await fs.writeTextFile(path.join(dir, "package.json"), '{ "name": "scratch", "private": true, "type": "module" }\n');
    await git(dir, "init", "-q");
    const manifest = JSON.parse(await fs.readTextFile(path.join(installed, "package.json"))) as { bin: Record<string, string>; peerDependenciesMeta: Record<string, { optional: boolean }>; license: string };
    assertEquals(Object.keys(manifest.bin), ["repoctl"]);
    assertEquals(manifest.peerDependenciesMeta["@intellectual-frontiers/docs"]?.optional, true);
    assertStringIncludes(manifest.license, "PolyForm");
    assert(await fs.exists(path.join(installed, "LICENSE")));
    const entry = await fs.readTextFile(path.join(installed, "dist/mod.d.ts"));
    for (const name of ["main", "repoctlProgram"]) assertStringIncludes(entry, name);
    assertStringIncludes(await fs.readTextFile(path.join(installed, "dist/governance/config.d.ts")), "defineConfig");
    // offline: no proxy and no registry are reachable by the variables this run is given
    const env = { PATH: process.env["PATH"] ?? "", HOME: dir, HTTPS_PROXY: "http://127.0.0.1:9", HTTP_PROXY: "http://127.0.0.1:9", NPM_CONFIG_OFFLINE: "true" };
    const bin = path.join(installed, "repoctl.mjs");
    const help = await proc.run([node, bin, "--help"], { cwd: dir, env });
    assertEquals(help.code, 0, help.stderr);
    for (const verb of ["check", "sync", "merge", "commit", "doctor"]) assert(new RegExp(`^\\s+${verb}\\b`, "m").test(help.stdout), `${verb} is listed`);
    const doctor = await proc.run([node, bin, "doctor"], { cwd: dir, env });
    assertEquals(doctor.code, 1, doctor.stdout + doctor.stderr);
    assertStringIncludes(doctor.stdout + doctor.stderr, "E-CONFIG-MISSING");
    const check = await proc.run([node, bin, "check"], { cwd: dir, env });
    assertEquals(check.code, 3);
    // the entry is importable by Node and defineConfig reads a configuration
    const probe = 'import { defineConfig, governance, main } from "@intellectual-frontiers/repoctl"; const c = defineConfig({ repo: "x", commit: { identity: { name: "A", email: "a@example.test" } } }); console.log(typeof main, governance.parseConfig(c).kind);';
    const imported = await proc.run([node, "--input-type=module", "-e", probe], { cwd: dir, env });
    assertEquals(imported.stdout.trim(), "function ok", imported.stderr);
  });
}, { timeout: 120_000 });
