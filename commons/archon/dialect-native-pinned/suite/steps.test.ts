/**
 * Tests of the steps of an install of a pinned tool (commons archon-dialect-native-pinned 0006-native-pinned-steps FR-001 to FR-004): a fetch, a verify and the extraction by the tool of the platform as words of
 * core, with no shell string, and the hash check kept in TypeScript. Every name is made up.
 *
 * @module
 */
import { argvFindings } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { installStepsOf, verifyFileBytes, type InstallSpec, type VerifyStep } from "../src/mod.ts";

const bytes = new TextEncoder().encode("a made-up artifact\n");
async function spec(more: Partial<InstallSpec> = {}): Promise<InstallSpec> {
  return { tool: "synthetic-tool-01", version: "1.0.0", platform: "linux-x64", os: "linux", program: "synthetic", downloadUrl: "https://example.test/synthetic-01.tar.gz", sha256: await sha256(bytes), archiveFormat: "tar", binPath: "bin", ...more };
}
const stepsOf = async (more: Partial<InstallSpec>, installer?: "msi" | "pkg") => {
  const r = installStepsOf(await spec(more), "/opt/tools/synthetic", installer);
  assert(r.kind === "ok", JSON.stringify(r));
  return r.value;
};

proves(["0006-native-pinned-steps FR-001", "0006-native-pinned-steps FR-002"], "the steps are a fetch, a verify and the extraction by the tool of the platform", async () => {
  const s = await spec();
  const tar = await stepsOf({});
  assertEquals(tar.map((x) => x.kind), ["fetch", "verify", "argv"]);
  assertEquals(tar[0], { kind: "fetch", url: s.downloadUrl, sha256: s.sha256, dest: "/opt/tools/synthetic/artifact" });
  assertEquals(tar[1], { kind: "verify", file: "/opt/tools/synthetic/artifact", sha256: s.sha256 });
  assertEquals(tar[2], { kind: "argv", argv: ["tar", "-xf", "/opt/tools/synthetic/artifact", "-C", "/opt/tools/synthetic"], as: "user", expect: [0] });
  assertEquals((await stepsOf({ archiveFormat: "zip" }))[2], { kind: "argv", argv: ["unzip", "-q", "-o", "/opt/tools/synthetic/artifact", "-d", "/opt/tools/synthetic"], as: "user", expect: [0] });
  const winZip = (await stepsOf({ archiveFormat: "zip", os: "windows", platform: "windows-x64" }))[2];
  assert(winZip?.kind === "argv" && winZip.argv[0] === "tar", "a zip is read by the tar of Windows");
  assertEquals((await stepsOf({ archiveFormat: "file" }))[2], { kind: "argv", argv: ["install", "-m", "0755", "/opt/tools/synthetic/artifact", "/opt/tools/synthetic/bin/synthetic"], as: "user", expect: [0] });
  assertEquals((await stepsOf({ archiveFormat: "file", os: "windows", platform: "windows-x64" })).length, 2, "the fetch writes the program itself");
  assertEquals((await stepsOf({}, "msi"))[2], { kind: "argv", argv: ["msiexec", "/i", "/opt/tools/synthetic/artifact", "/qn", "/norestart"], as: "root", expect: [0] });
  assertEquals((await stepsOf({}, "pkg"))[2], { kind: "argv", argv: ["installer", "-pkg", "/opt/tools/synthetic/artifact", "-target", "/"], as: "root", expect: [0] });
});

proves(["0006-native-pinned-steps FR-003"], "no step is a shell string, and a folder that begins with a dash is refused", async () => {
  for (const archiveFormat of ["tar", "zip", "file"] as const)
    for (const os of ["linux", "macos", "windows"] as const)
      for (const installer of [undefined, "msi", "pkg"] as const)
        for (const s of await stepsOf({ archiveFormat, os }, installer)) if (s.kind === "argv") assertEquals(argvFindings(s), [], `${archiveFormat} ${os} ${installer}`);
  assertEquals(installStepsOf(await spec(), "-rf").kind, "err");
  assertEquals(installStepsOf(await spec(), "").kind, "err");
  assertEquals(installStepsOf(await spec(), "a\0b").kind, "err");
});

proves(["0006-native-pinned-steps FR-004"], "the hash check stays in TypeScript: the bytes are the pinned ones or both hashes are named", async () => {
  const s = await spec();
  const step: VerifyStep = { kind: "verify", file: "/opt/tools/synthetic/artifact", sha256: s.sha256 };
  assertEquals(await verifyFileBytes(step, bytes), { kind: "ok", value: true });
  const bad = await verifyFileBytes(step, new TextEncoder().encode("changed"));
  assert(bad.kind === "err" && bad.error.includes(s.sha256) && bad.error.includes("are SHA-256"));
});
