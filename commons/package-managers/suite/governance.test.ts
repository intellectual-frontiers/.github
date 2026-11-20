/**
 * Tests of the governance of the kit (commons package-managers 0002-package-managers-governance FR-001 to FR-003): the operations and the command of one, the ways a manager writes a version, and
 * the names and versions that are safe in a command. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { OPERATIONS, isSafeName, isSafeVersion, type CommandSpec, type Versioning } from "../src/governance/mod.ts";

proves(["0002-package-managers-governance FR-001"], "the operations are the four a dialect uses, and a command carries what the ontology states of it", () => {
  assertEquals([...OPERATIONS], ["Install", "QueryInstalled", "QueryVersion", "Refresh"]);
  const c: CommandSpec = { manager: "manager-x", executable: "x", environment: "X=1", needsAdministrator: true, template: "x install {packages}", nonInteractive: "x install -y {packages}", verified: false };
  assertEquals(Object.keys(c).sort(), ["environment", "executable", "manager", "needsAdministrator", "nonInteractive", "template", "verified"]);
});

proves(["0002-package-managers-governance FR-002"], "a manager writes an exact version joined, as flags, or not at all with the reason", () => {
  const all: Versioning[] = [
    { kind: "joined", joiner: "=" },
    { kind: "joined", joiner: "@" },
    { kind: "flags", packageFlags: ["--id"], exactFlags: ["--exact"], versionFlag: "--version" },
    { kind: "none", reason: "it installs the latest" },
  ];
  assertEquals(all.map((v) => v.kind), ["joined", "joined", "flags", "none"]);
});

proves(["0002-package-managers-governance FR-003"], "a name is safe only if it cannot be taken for an option or hold a shell word, and so is a version", () => {
  for (const ok of ["xz-utils", "Vendor.Tool", "aqua:org/tool", "libstdc++6", "git"]) assert(isSafeName(ok), ok);
  for (const bad of ["-rf", "a;b", "a b", "a/../b", "", "a$(x)", "a`b`", "a|b", "a\nb", "x".repeat(201)]) assertEquals(isSafeName(bad), false, JSON.stringify(bad));
  for (const ok of ["1.7.1", "2.43.0-1ubuntu7", "1:2.43.0~rc1", "v1.2"]) assert(isSafeVersion(ok), ok);
  for (const bad of ["-1", "1 2", "1;2", "", "1$2", "1".repeat(101)]) assertEquals(isSafeVersion(bad), false, JSON.stringify(bad));
});
