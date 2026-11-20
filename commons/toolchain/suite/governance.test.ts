/**
 * Tests of the Governance layer of Toolchain (commons toolchain 0002-toolchain-governance FR-001 to FR-008): names and versions, the tool and every way it is refused, the pin policy and the
 * minimum, a download as a pin gives it, bindings, the guard against a secret, the catalog, and that a tool holds no version or hash of a pin. Every address, hash and name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { compareVersions, defineCatalog, defineDownload, defineTool, parseManagerId, parsePinId, parseToolName, parseVersion, type DownloadInput, type Tool, type ToolInput } from "../src/mod.ts";

const SHA = "a".repeat(64);
const DOWNLOAD: DownloadInput = { version: "1.7.1", downloadUrl: "https://example.test/jq-1.7.1-linux-amd64", sha256: SHA, archiveFormat: "file", binPath: "" };

const JQ: ToolInput = {
  name: "jq",
  summary: "A command line JSON processor.",
  pin: "exact",
  program: "jq",
  versionArgs: ["--version"],
  phases: ["core"],
  scope: "user",
  bindings: [{ kind: "pin", pin: "jq" }, { kind: "package", manager: "manager-brew", packages: ["jq"] }],
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
  assertEquals(parsePinId("bun").kind, "ok");
  assertEquals(parsePinId("rustup-init").kind, "ok");
  assertEquals(parsePinId("pin Bun").kind, "err");
  assertEquals(parsePinId("1bun").kind, "err");
  assertEquals(parseManagerId("manager-apt").kind, "ok");
  assertEquals(parseManagerId("apt").kind, "err");
});

proves(["0002-toolchain-governance FR-002"], "a tool is defined, or refused with every reason", () => {
  const t = tool();
  assertEquals([t.name, t.pin, t.scope, t.phases, t.needs, t.provides], ["jq", "exact", "user", ["core"], [], []]);
  assert(refused({ summary: " " }).some((m) => m.includes("summary")));
  assert(refused({ program: "" }).some((m) => m.includes("program")));
  assert(refused({ phases: [] }).some((m) => m.includes("phase")));
  assert(refused({ phases: ["deploy"] }).some((m) => m.includes("not a phase")));
  assert(refused({ scope: "global" }).some((m) => m.includes("scope")));
  assert(refused({ bindings: [] }).some((m) => m.includes("binding")));
  assert(refused({ needs: ["Bad Name"] }).some((m) => m.includes("need")));
  assert(refused({ env: { path: "x" } }).some((m) => m.includes("variable")));
  assert(refused({ name: "Bad", summary: "", phases: [], bindings: [] }).length >= 4, "every reason is given");
});

proves(["0002-toolchain-governance FR-003"], "a tool states how strictly it is pinned, and a minimum is not above the version of a package binding", () => {
  assertEquals(tool({ pin: "release-line", minimum: "1.6.0" }).minimum, "1.6.0");
  assert(refused({ pin: "fixed" }).some((m) => m.includes("pin policy")));
  assert(refused({ minimum: "latest" }).some((m) => m.includes("minimum")));
  assert(refused({ minimum: "2.0.0", bindings: [{ kind: "package", manager: "manager-brew", packages: ["jq"], version: "1.7.1" }] }).some((m) => m.includes("above")));
  assertEquals(tool({ minimum: "1.0.0", bindings: [{ kind: "package", manager: "manager-brew", packages: ["jq"], version: "1.7.1" }] }).minimum, "1.0.0");
  assertEquals(tool().minimum, undefined);
});

proves(["0002-toolchain-governance FR-004"], "a download has a version, an https address with no credentials, a SHA-256, a format and a folder inside", () => {
  const bad = (a: Partial<DownloadInput>) => {
    const r = defineDownload({ ...DOWNLOAD, ...a });
    assert(r.kind === "err", "the download is refused");
    return r.error;
  };
  assert(bad({ downloadUrl: "http://example.test/jq" }).some((m) => m.includes("https")));
  assert(bad({ downloadUrl: "https://user:secret@example.test/jq" }).some((m) => m.includes("user name or a password")));
  assert(bad({ downloadUrl: "not an address" }).some((m) => m.includes("not an address")));
  assert(bad({ sha256: "a".repeat(63) }).some((m) => m.includes("SHA-256")));
  assert(bad({ archiveFormat: "rar" }).some((m) => m.includes("format")));
  assert(bad({ binPath: "../out" }).some((m) => m.includes("inside")));
  assert(bad({ binPath: "/abs" }).some((m) => m.includes("inside")));
  assert(bad({ version: "latest" }).some((m) => m.includes("latest")));
  const ok = defineDownload({ ...DOWNLOAD, archiveFormat: "zip", binPath: "bin" });
  assert(ok.kind === "ok" && ok.value.binPath === "bin" && ok.value.sha256 === SHA && ok.value.version === "1.7.1");
});

proves(["0002-toolchain-governance FR-005"], "a tool has bindings, and no more than one pin binding or one package binding for a manager", () => {
  assert(refused({ bindings: [{ kind: "pin", pin: "Jq 2" }] }).some((m) => m.includes("pin id")));
  assert(refused({ bindings: [{ kind: "package", manager: "manager-brew", packages: [] }] }).some((m) => m.includes("at least one package")));
  assert(refused({ bindings: [{ kind: "package", manager: "brew", packages: ["jq"] }] }).some((m) => m.includes("manager id")));
  assert(refused({ bindings: [{ kind: "package", manager: "manager-apt", packages: ["jq"], version: "latest" }] }).some((m) => m.includes("latest")));
  assert(refused({ bindings: [{ kind: "package", manager: "manager-apt", packages: ["jq"] }, { kind: "package", manager: "manager-apt", packages: ["jq2"] }] }).some((m) => m.includes("one package binding for manager-apt")));
  assert(refused({ bindings: [{ kind: "pin", pin: "jq" }, { kind: "pin", pin: "jq2" }] }).some((m) => m.includes("one pin binding")));
  assertEquals(tool({ bindings: [{ kind: "package", manager: "manager-apt", packages: ["jq"] }, { kind: "package", manager: "manager-brew", packages: ["jq"] }] }).bindings.length, 2);
});

proves(["0002-toolchain-governance FR-006"], "no secret in the environment or the program", () => {
  assert(refused({ env: { KEY: "-----BEGIN PRIVATE KEY-----" } }).some((m) => m.includes("secret")));
  assert(refused({ env: { API_TOKEN: "hunter2" } }).some((m) => m.includes("secret")));
  assert(refused({ program: "ghp_" + "a".repeat(36) }).some((m) => m.includes("secret")));
  assertEquals(tool({ env: { JQ_COLORS: "0;90:0;37" } }).env, { JQ_COLORS: "0;90:0;37" });
});

proves(["0002-toolchain-governance FR-007"], "a catalog refuses a tool twice, a missing need, a cycle and a program provided twice, and is in the order of needs", () => {
  const apt = [{ kind: "package", manager: "manager-apt", packages: ["x"] }] as const;
  const git = tool({ name: "git", program: "git", bindings: apt });
  const gh = tool({ name: "gh", program: "gh", needs: ["git"], bindings: apt });
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

proves(["0002-toolchain-governance FR-008"], "a tool holds no version or hash of a pin, only the id of the pin", () => {
  const t = tool();
  assertEquals(Object.keys(t).sort(), ["alsoNamed", "bindings", "env", "name", "needs", "phases", "pin", "program", "provides", "scope", "summary", "versionArgs"]);
  const pinBinding = t.bindings.find((b) => b.kind === "pin");
  assertEquals(pinBinding && pinBinding.kind === "pin" ? String(pinBinding.pin) : undefined, "jq");
  assertEquals(/[0-9a-f]{64}/.test(JSON.stringify(t)), false, "no hash is in the declaration");
  assertEquals(/https?:\/\//.test(JSON.stringify(t)), false, "no address is in the declaration");
  assertEquals("version" in t, false);
});

proves(["0002-toolchain-governance FR-009"], "a tool may name other names of its program, and a catalog refuses a name that clashes", () => {
  const t = tool({ name: "chromium", program: "chromium", alsoNamed: ["chrome", "google-chrome"] });
  assertEquals(t.alsoNamed, ["chrome", "google-chrome"]);
  assertEquals(tool().alsoNamed, []);
  assert(refused({ alsoNamed: ["bin/chrome"] }).some((m) => m.includes("other name")));
  assert(refused({ alsoNamed: [" "] }).some((m) => m.includes("other name")));
  const apt = [{ kind: "package", manager: "manager-apt", packages: ["x"] }] as const;
  const clash = defineCatalog([tool({ name: "chromium", program: "chromium", alsoNamed: ["chrome"], bindings: apt }), tool({ name: "chrome-tool", program: "chrome", bindings: apt })]);
  assert(clash.kind === "err" && clash.error.some((m) => m.includes("provided by")));
  const twice = defineCatalog([tool({ name: "one", program: "one", alsoNamed: ["x"], bindings: apt }), tool({ name: "two", program: "two", alsoNamed: ["x"], bindings: apt })]);
  assert(twice.kind === "err");
  assertEquals(defineCatalog([t]).kind, "ok");
});
