/**
 * Tests of the Logical layer of Toolchain (commons toolchain 0003-toolchain-logical FR-001 to FR-007): the guarantees of a dialect as data, the control `toolIntegrity` and every reason a dialect does
 * not meet it, the resolution of tools in the order of needs to the first dialect that can with the downloads of a source of pins, the refusal of a tool no dialect can carry out, the plan against
 * what is installed, the requirements of Desired OS State from which an order is built, and that the library does not read the ontology. The dialects and the source of pins here are values of their ports
 * (the dialects with real tools are tested in their own packages); every address, hash and name is made up.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parseDialectId, parseSubjectName, type DialectId, type JsonValue } from "@intellectual-frontiers/desired-os-state/governance";
import { buildOrder } from "@intellectual-frontiers/desired-os-state/logical";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { path } from "@intellectual-frontiers/system";
import {
  defineCatalog,
  defineDownload,
  defineTool,
  meetsIntegrity,
  parseManagerId,
  actionFor,
  planTools,
  requirementsFor,
  resolveTools,
  type Catalog,
  type Context,
  type Download,
  type PinSource,
  type ToolDialect,
  type ToolGuarantees,
  type ToolInput,
  type ToolName,
} from "../src/mod.ts";

function id(text: string): DialectId {
  const r = parseDialectId(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

function manager(text: string) {
  const r = parseManagerId(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

const ALL = ["linux-x64", "linux-arm64", "macos-x64", "macos-arm64", "windows-x64"] as const;
const SHA = "b".repeat(64);

function download(name: string, version = "1.0.0"): Download {
  const r = defineDownload({ version, downloadUrl: `https://example.test/${name}`, sha256: SHA, archiveFormat: "file", binPath: "" });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

/** A source of pins with made-up downloads: jq, gh and old on linux-x64 and macos-arm64. */
const PINS: PinSource = {
  lookup: (pin, platform) => {
    if (platform !== "linux-x64" && platform !== "macos-arm64") return err(`the source has no download on ${platform}`);
    return pin === "jq" || pin === "gh" || pin === "old" ? ok(download(pin, pin === "old" ? "0.5.0" : "1.0.0")) : err(`the source has no pin called ${pin}`);
  },
};

function dialect(name: string, g: Partial<ToolGuarantees> = {}, managerId?: string): ToolDialect {
  const base = { id: id(name), guarantees: { pin: "exact", integrity: "hash", scopes: ["user", "system"], platforms: [...ALL], binds: "pin", sourceBuild: false, ...g } satisfies ToolGuarantees };
  return managerId === undefined ? base : { ...base, manager: manager(managerId) };
}

const PINNED = dialect("pinned-downloads");
const BREW = dialect("homebrew", { pin: "rolling", integrity: "none", scopes: ["user"], platforms: ["macos-arm64", "macos-x64", "linux-x64", "linux-arm64"], binds: "package" }, "manager-brew");
const APT = dialect("apt", { pin: "release-line", integrity: "signature", scopes: ["system"], platforms: ["linux-x64", "linux-arm64"], binds: "package" }, "manager-apt");
const BUILDER = dialect("builder", { binds: "package", sourceBuild: true }, "manager-builder");

function tool(name: string, more: Partial<ToolInput> = {}) {
  const r = defineTool({
    name,
    summary: `${name}.`,
    pin: "exact",
    program: name,
    versionArgs: ["--version"],
    phases: ["core"],
    scope: "user",
    bindings: [{ kind: "pin", pin: name }, { kind: "package", manager: "manager-brew", packages: [name] }, { kind: "package", manager: "manager-builder", packages: [name] }],
    ...more,
  });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

function catalog(): Catalog {
  const c = defineCatalog([
    tool("jq"),
    tool("git", { bindings: [{ kind: "package", manager: "manager-apt", packages: ["git"] }], pin: "release-line", scope: "system" }),
    tool("gh", { needs: ["git"], minimum: "0.9.0" }),
  ]);
  if (c.kind === "err") throw new Error(c.error.join("; "));
  return c.value;
}

/** Whether data is an object (a read-only list does not narrow away with Array.isArray). */
function isRecord(v: JsonValue | undefined): v is { readonly [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const CTX: Context = { platform: "linux-x64", preference: [id("pinned-downloads"), id("homebrew"), id("apt")], integrity: "rolling", systemCopy: "minimum" };

proves(["0003-toolchain-logical FR-001"], "a dialect declares its guarantees as data", () => {
  assertEquals(Object.keys(PINNED.guarantees).sort(), ["binds", "integrity", "pin", "platforms", "scopes", "sourceBuild"]);
  assertEquals([PINNED.guarantees.pin, PINNED.guarantees.integrity, PINNED.guarantees.binds, PINNED.guarantees.sourceBuild], ["exact", "hash", "pin", false]);
  assertEquals([BREW.guarantees.pin, BREW.guarantees.integrity, BREW.guarantees.binds], ["rolling", "none", "package"]);
  assertEquals(String(BREW.manager), "manager-brew");
  assertEquals(PINNED.manager, undefined);
});

proves(["0003-toolchain-logical FR-002"], "meetsIntegrity names every reason a dialect does not meet the control", () => {
  assertEquals(meetsIntegrity("rolling", BREW.guarantees), []);
  assertEquals(meetsIntegrity("release-line", APT.guarantees), []);
  assert(meetsIntegrity("release-line", BREW.guarantees).some((m) => m.includes("rolling")));
  assertEquals(meetsIntegrity("exact-hashed", PINNED.guarantees), []);
  const apt = meetsIntegrity("exact-hashed", APT.guarantees);
  assertEquals(apt.length, 2);
  assert(apt.some((m) => m.includes("hash")) && apt.some((m) => m.includes("exact")));
});

proves(["0003-toolchain-logical FR-003"], "tools and what they need are resolved in the order of needs, each to the first dialect that can", () => {
  const r = resolveTools(catalog(), ["gh", "jq"], [PINNED, BREW, APT], PINS, CTX);
  assert(r.kind === "ok");
  assertEquals(r.value.entries.map((e) => `${e.tool.name}:${e.dialect}`), ["git:apt", "gh:pinned-downloads", "jq:pinned-downloads"]);
  assertEquals(r.value.entries.map((e) => e.version), [undefined, "1.0.0", "1.0.0"]);
  const rolling = defineCatalog([tool("curl", { pin: "rolling" })]);
  assert(rolling.kind === "ok");
  const prefer = resolveTools(rolling.value, ["curl"], [PINNED, BREW, APT], PINS, { ...CTX, preference: [id("homebrew"), id("pinned-downloads")] });
  assert(prefer.kind === "ok" && prefer.value.entries[0]?.dialect === "homebrew");
  const exact = resolveTools(catalog(), ["jq"], [PINNED, BREW, APT], PINS, { ...CTX, preference: [id("homebrew"), id("pinned-downloads")] });
  assert(exact.kind === "ok" && exact.value.entries[0]?.dialect === "pinned-downloads", "an exactly pinned tool is not carried out by a rolling dialect, whatever the preference");
  const mac = resolveTools(catalog(), ["jq"], [PINNED, BREW, APT], PINS, { ...CTX, platform: "macos-arm64" });
  assert(mac.kind === "ok" && mac.value.entries[0]?.source.kind === "download");
  const unknown = resolveTools(catalog(), ["nothing"], [PINNED], PINS, CTX);
  assert(unknown.kind === "err" && unknown.error[0]?.kind === "unknown-tool");
});

proves(["0003-toolchain-logical FR-004"], "a tool no dialect can carry out is refused with every reason, and a dialect that builds from source is never chosen", () => {
  const strict = resolveTools(catalog(), ["jq"], [PINNED, BREW, APT], PINS, { ...CTX, platform: "windows-x64", integrity: "exact-hashed" });
  assert(strict.kind === "err");
  const p = strict.error[0];
  assert(p?.kind === "unexpressed" && p.tool === "jq");
  assertEquals(p.reasons.map((r) => r.dialect), ["pinned-downloads", "homebrew", "apt"]);
  assert(p.reasons[0]?.reason.includes("windows-x64"));
  assert(p.reasons[1]?.reason.includes("windows-x64"));
  const hashed = resolveTools(catalog(), ["jq"], [BREW], PINS, { ...CTX, preference: [id("homebrew")], integrity: "exact-hashed" });
  assert(hashed.kind === "err");
  const reason = hashed.error[0];
  assert(reason?.kind === "unexpressed" && reason.reasons[0]?.reason.includes("exact"));
  const builder = resolveTools(catalog(), ["jq"], [BUILDER], PINS, { ...CTX, preference: [id("builder")] });
  assert(builder.kind === "err");
  const b = builder.error[0];
  assert(b?.kind === "unexpressed" && b.reasons[0]?.reason.includes("build from source"));
  const approved = resolveTools(catalog(), ["jq"], [BUILDER], PINS, { ...CTX, preference: [id("builder")], sourceBuild: "approved" });
  assert(approved.kind === "ok" && approved.value.entries[0]?.dialect === id("builder"), "a fleet that approved source builds may use a dialect that can build");
  const refused = resolveTools(catalog(), ["jq"], [BUILDER], PINS, { ...CTX, preference: [id("builder")], sourceBuild: "refuse" });
  assert(refused.kind === "err");
  const zed = defineCatalog([tool("zed", { bindings: [{ kind: "package", manager: "manager-apt", packages: ["zed"] }], scope: "user" })]);
  assert(zed.kind === "ok");
  const scope = resolveTools(zed.value, ["zed"], [APT], PINS, { ...CTX, preference: [id("apt")] });
  assert(scope.kind === "err" && scope.error[0]?.kind === "unexpressed" && scope.error[0].reasons[0]?.reason.includes("user scope"));
  const missingDialect = resolveTools(catalog(), ["jq"], [PINNED], PINS, { ...CTX, preference: [id("homebrew")] });
  assert(missingDialect.kind === "err");
  const noManager = resolveTools(zed.value, ["zed"], [dialect("anon", { binds: "package" })], PINS, { ...CTX, preference: [id("anon")] });
  assert(noManager.kind === "err" && noManager.error[0]?.kind === "unexpressed" && noManager.error[0].reasons[0]?.reason.includes("no package manager"));
});

proves(["0003-toolchain-logical FR-005"], "the plan says none, install or replace, and a copy on the path counts only where the policy allows", () => {
  const res = resolveTools(catalog(), ["jq", "gh"], [PINNED, APT], PINS, { ...CTX, preference: [id("pinned-downloads"), id("apt")] });
  assert(res.kind === "ok");
  const name = (n: string) => n as ToolName;
  const act = (observed: ReadonlyMap<ToolName, { version: string; from: "path" | "store" | "manager" }>, ctx: Context = CTX) => Object.fromEntries(planTools(res.value, observed, ctx).entries.map((e) => [e.tool, e.action]));
  assertEquals(act(new Map()), { git: "install", gh: "install", jq: "install" });
  assertEquals(act(new Map([[name("jq"), { version: "1.0.0", from: "store" as const }], [name("gh"), { version: "1.0.0", from: "store" as const }], [name("git"), { version: "7.7.7", from: "manager" as const }]])), { git: "none", gh: "none", jq: "none" });
  assertEquals(act(new Map([[name("jq"), { version: "0.9.0", from: "store" as const }]]))["jq"], "replace");
  assertEquals(act(new Map([[name("gh"), { version: "0.9.5", from: "path" as const }]]))["gh"], "none", "a path copy at the least version counts under minimum");
  assertEquals(act(new Map([[name("gh"), { version: "0.8.0", from: "path" as const }]]))["gh"], "replace");
  assertEquals(act(new Map([[name("gh"), { version: "1.0.0", from: "path" as const }]]), { ...CTX, systemCopy: "never" })["gh"], "replace");
  assertEquals(act(new Map([[name("gh"), { version: "1.0.0", from: "path" as const }]]), { ...CTX, integrity: "exact-hashed" })["gh"], "replace", "exact and hashed never takes a path copy");
  assertEquals(act(new Map([[name("jq"), { version: "1.0.0", from: "path" as const }]]))["jq"], "none", "a tool with no stated minimum is taken at the version of its pin");
  assertEquals(act(new Map([[name("git"), { version: "0.0.1", from: "path" as const }]]))["git"], "none", "where nothing pins a version any version counts");
});

proves(["0003-toolchain-logical FR-005"], "actionFor is the one rule, for a dialect that holds no tool declaration", () => {
  const base = { version: "1.0.0", minimum: undefined, systemCopy: "minimum" as const, integrity: "rolling" as const };
  assertEquals(actionFor({ ...base, seen: undefined }), "install");
  assertEquals(actionFor({ ...base, seen: { version: "1.0.0", from: "store" } }), "none");
  assertEquals(actionFor({ ...base, seen: { version: "0.9.0", from: "store" } }), "replace");
  assertEquals(actionFor({ ...base, seen: { version: "2.0.0", from: "path" } }), "none");
  assertEquals(actionFor({ ...base, seen: { version: "2.0.0", from: "path" }, integrity: "exact-hashed" }), "replace");
  assertEquals(actionFor({ ...base, version: undefined, seen: { version: "0.0.1", from: "manager" } }), "none");
});

proves(["0003-toolchain-logical FR-006"], "the requirements of kind tool are valid for Desired OS State, depend on the tools needed, hold no secret, and an order is built from them", () => {
  const res = resolveTools(catalog(), ["gh", "jq"], [PINNED, APT], PINS, { ...CTX, preference: [id("pinned-downloads"), id("apt")] });
  assert(res.kind === "ok");
  const reqs = requirementsFor(res.value, { by: "all" });
  assert(reqs.kind === "ok");
  assertEquals(reqs.value.map((r) => String(r.id)), ["tool.git", "tool.gh", "tool.jq"]);
  const gh = reqs.value.find((r) => r.id === "tool.gh");
  assertEquals(gh?.dependsOn.map(String), ["tool.git"]);
  assertEquals(gh?.kind, "tool");
  const desired = gh?.desired;
  assert(isRecord(desired));
  assertEquals(desired["tool"], "gh");
  assertEquals(desired["dialect"], "pinned-downloads");
  assertEquals(desired["version"], "1.0.0");
  const source = desired["source"];
  assert(isRecord(source) && source["kind"] === "download" && source["pin"] === "gh" && source["sha256"] === SHA);
  const git = reqs.value.find((r) => r.id === "tool.git")?.desired;
  assert(isRecord(git) && git["version"] === null);
  const name = parseSubjectName("build-01.example.test");
  assert(name.kind === "ok");
  const order = buildOrder({ subject: { name: name.value, class: "workstation" }, assurance: "solo", layers: [{ layer: "baseline", requirements: reqs.value }] });
  assert(order.kind === "ok");
  assertEquals(order.value.requirements.map((r) => String(r.id)), ["tool.git", "tool.gh", "tool.jq"]);
  assertEquals(requirementsFor(res.value, { by: "class", class: "dns" }).kind, "err");
});

proves(["0003-toolchain-logical FR-007"], "downloads come from a source of pins; a pin with no download, or a version below the minimum, is a reason; the library does not read the ontology", async () => {
  const noDownload = resolveTools(catalog(), ["jq"], [PINNED], PINS, { ...CTX, platform: "linux-arm64", preference: [id("pinned-downloads")] });
  assert(noDownload.kind === "err");
  const nd = noDownload.error[0];
  assert(nd?.kind === "unexpressed" && nd.reasons[0]?.reason.includes("jq") && nd.reasons[0].reason.includes("linux-arm64"));
  const old = defineCatalog([tool("old", { minimum: "1.0.0" })]);
  assert(old.kind === "ok");
  const below = resolveTools(old.value, ["old"], [PINNED], PINS, { ...CTX, preference: [id("pinned-downloads")] });
  assert(below.kind === "err");
  const b = below.error[0];
  assert(b?.kind === "unexpressed" && b.reasons[0]?.reason.includes("below the minimum"));
  let asked = 0;
  const counting: PinSource = { lookup: (pin, platform) => { asked++; return PINS.lookup(pin, platform); } };
  resolveTools(catalog(), ["jq"], [PINNED], counting, { ...CTX, preference: [id("pinned-downloads")] });
  assertEquals(asked, 1);
  const root = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
  const files = await runtime.readSources(root, ["src"]);
  for (const f of files.filter((x) => x.path.startsWith("src/governance/") || x.path.startsWith("src/logical/"))) assertEquals(f.text.includes("@intellectual-frontiers/ontology"), false, `${f.path} reads the ontology`);
});
