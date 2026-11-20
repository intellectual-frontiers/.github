/**
 * Tests of the Governance layer of Toolchain (commons toolchain 0002-toolchain-governance FR-001 to FR-007): names and versions, the tool and every way it is refused, the pin policy and the
 * minimum, artifacts, bindings, the guard against a secret, and the catalog. Every address, hash and name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { compareVersions, defineCatalog, defineTool, parseToolName, parseVersion, type Tool, type ToolInput } from "../src/mod.ts";

const SHA = "a".repeat(64);
const ARTIFACT = { url: "https://example.test/jq-1.7.1-linux-amd64", sha256: SHA, format: "file", bin: "" };

const JQ: ToolInput = {
  name: "jq",
  summary: "A command line JSON processor.",
  version: "1.7.1",
  pin: "exact",
  program: "jq",
  versionArgs: ["--version"],
  phases: ["core"],
  scope: "user",
  bindings: [{ kind: "artifact", artifacts: { "linux-x64": ARTIFACT } }, { kind: "package", dialect: "homebrew", packages: ["jq"] }],
};

function tool(more: Partial<ToolInput> = {}): Tool {
  const r = defineTool({ ...JQ, ...more });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

function refused(more: Partial<ToolInput>): readonly string[] {
  const r = defineTool({ ...JQ, ...more });
  assert(r.kind === "err", "the tool is refused");
  return r.error;
}

proves(["0002-toolchain-governance FR-001"], "names and versions are made only by their functions, never latest or a range, and versions are ordered by their numbers", () => {
  assertEquals(parseToolName("jq").kind, "ok");
  assertEquals(parseToolName("Jq").kind, "err");
  assertEquals(parseToolName("a".repeat(61)).kind, "err");
  for (const good of ["1.10.0", "157.0.8103.50", "2", "2.0.0-rc.1", "1.2.3+build5"]) assertEquals(parseVersion(good).kind, "ok", good);
  for (const bad of ["latest", "", "^1.2.3", "~1.2", "1.x", "*", ">=1.0", "1.2 || 2.0", "1 2", "v1.0"]) assertEquals(parseVersion(bad).kind, "err", bad);
  const latest = parseVersion("latest");
  assert(latest.kind === "err" && latest.error.includes("never latest"));
  assert(compareVersions("1.10.0", "1.9.9") > 0);
  assert(compareVersions("1.2", "1.2.0") === 0);
  assert(compareVersions("2.0.0-rc.1", "2.0.0") < 0);
  assert(compareVersions("2.0.0", "2.0.0-rc.1") > 0);
  assert(compareVersions("157.0.8103.50", "157.0.8103.9") > 0);
});

proves(["0002-toolchain-governance FR-002"], "a tool is defined, or refused with every reason", () => {
  const t = tool();
  assertEquals([t.name, t.version, t.pin, t.scope, t.phases, t.needs, t.provides], ["jq", "1.7.1", "exact", "user", ["core"], [], []]);
  assert(refused({ summary: " " }).some((m) => m.includes("summary")));
  assert(refused({ program: "" }).some((m) => m.includes("program")));
  assert(refused({ phases: [] }).some((m) => m.includes("phase")));
  assert(refused({ phases: ["deploy"] }).some((m) => m.includes("not a phase")));
  assert(refused({ scope: "global" }).some((m) => m.includes("scope")));
  assert(refused({ bindings: [] }).some((m) => m.includes("binding")));
  assert(refused({ needs: ["Bad Name"] }).some((m) => m.includes("need")));
  assert(refused({ env: { path: "x" } }).some((m) => m.includes("variable")));
  assert(refused({ version: "latest" }).some((m) => m.includes("latest")));
  assert(refused({ name: "Bad", summary: "", phases: [], bindings: [] }).length >= 4, "every reason is given");
});

proves(["0002-toolchain-governance FR-003"], "a tool states how strictly it is pinned, and a minimum is not above its version", () => {
  assertEquals(tool({ pin: "release-line", minimum: "1.6.0" }).minimum, "1.6.0");
  assert(refused({ pin: "fixed" }).some((m) => m.includes("pin policy")));
  assert(refused({ minimum: "2.0.0" }).some((m) => m.includes("above")));
  assert(refused({ minimum: "latest" }).some((m) => m.includes("minimum")));
  assertEquals(tool().minimum, undefined);
});

proves(["0002-toolchain-governance FR-004"], "an artifact has an https address with no credentials, a SHA-256, a format, a folder inside and a platform", () => {
  const withArtifact = (a: Partial<typeof ARTIFACT>, platform = "linux-x64") => refused({ bindings: [{ kind: "artifact", artifacts: { [platform]: { ...ARTIFACT, ...a } } }] });
  assert(withArtifact({ url: "http://example.test/jq" }).some((m) => m.includes("https")));
  assert(withArtifact({ url: "https://user:secret@example.test/jq" }).some((m) => m.includes("user name or a password")));
  assert(withArtifact({ url: "not an address" }).some((m) => m.includes("not an address")));
  assert(withArtifact({ sha256: "a".repeat(63) }).some((m) => m.includes("SHA-256")));
  assert(withArtifact({ format: "rar" }).some((m) => m.includes("format")));
  assert(withArtifact({ bin: "../out" }).some((m) => m.includes("inside")));
  assert(withArtifact({ bin: "/abs" }).some((m) => m.includes("inside")));
  assert(withArtifact({}, "linux-riscv").some((m) => m.includes("platform")));
  const ok = tool({ bindings: [{ kind: "artifact", artifacts: { "windows-x64": { ...ARTIFACT, format: "zip", bin: "bin" } } }] });
  const b = ok.bindings[0];
  assert(b?.kind === "artifact" && b.artifacts["windows-x64"]?.bin === "bin");
});

proves(["0002-toolchain-governance FR-005"], "a tool has bindings, and no more than one artifact binding or one package binding for a dialect", () => {
  assert(refused({ bindings: [{ kind: "artifact", artifacts: {} }] }).some((m) => m.includes("at least one platform")));
  assert(refused({ bindings: [{ kind: "package", dialect: "homebrew", packages: [] }] }).some((m) => m.includes("at least one package")));
  assert(refused({ bindings: [{ kind: "package", dialect: "Homebrew", packages: ["jq"] }] }).some((m) => m.includes("dialect id")));
  assert(refused({ bindings: [{ kind: "package", dialect: "apt", packages: ["jq"] }, { kind: "package", dialect: "apt", packages: ["jq2"] }] }).some((m) => m.includes("one package binding for apt")));
  assert(refused({ bindings: [{ kind: "artifact", artifacts: { "linux-x64": ARTIFACT } }, { kind: "artifact", artifacts: { "macos-arm64": ARTIFACT } }] }).some((m) => m.includes("one artifact binding")));
  assertEquals(tool({ bindings: [{ kind: "package", dialect: "apt", packages: ["jq"] }, { kind: "package", dialect: "homebrew", packages: ["jq"] }] }).bindings.length, 2);
});

proves(["0002-toolchain-governance FR-006"], "no secret in the environment or the program", () => {
  assert(refused({ env: { KEY: "-----BEGIN PRIVATE KEY-----" } }).some((m) => m.includes("secret")));
  assert(refused({ env: { API_TOKEN: "hunter2" } }).some((m) => m.includes("secret")));
  assert(refused({ program: "ghp_" + "a".repeat(36) }).some((m) => m.includes("secret")));
  assertEquals(tool({ env: { JQ_COLORS: "0;90:0;37" } }).env, { JQ_COLORS: "0;90:0;37" });
});

proves(["0002-toolchain-governance FR-007"], "a catalog refuses a tool twice, a missing need, a cycle and a program provided twice, and is in the order of needs", () => {
  const git = tool({ name: "git", program: "git", bindings: [{ kind: "package", dialect: "apt", packages: ["git"] }] });
  const gh = tool({ name: "gh", program: "gh", needs: ["git"], bindings: [{ kind: "package", dialect: "apt", packages: ["gh"] }] });
  const ok = defineCatalog([gh, git]);
  assert(ok.kind === "ok");
  assertEquals(ok.value.sequence.map(String), ["git", "gh"]);
  const twice = defineCatalog([git, git]);
  assert(twice.kind === "err" && twice.error.some((m) => m.includes("twice")));
  const missing = defineCatalog([gh]);
  assert(missing.kind === "err" && missing.error.some((m) => m.includes("needs git")));
  const a = tool({ name: "aa", program: "aa", needs: ["bb"] });
  const b = tool({ name: "bb", program: "bb", needs: ["aa"] });
  const cycle = defineCatalog([a, b]);
  assert(cycle.kind === "err" && cycle.error.some((m) => m.includes("cycle") && m.includes("aa") && m.includes("bb")));
  const same = defineCatalog([tool({ name: "one", program: "x" }), tool({ name: "two", program: "x" })]);
  assert(same.kind === "err" && same.error.some((m) => m.includes("provided by")));
  const provided = defineCatalog([tool({ name: "one", program: "one", provides: ["two"] }), tool({ name: "other", program: "two" })]);
  assert(provided.kind === "err");
});
