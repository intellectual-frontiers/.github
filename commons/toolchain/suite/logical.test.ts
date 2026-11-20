/**
 * Tests of the Logical layer of Toolchain (commons toolchain 0003-toolchain-logical FR-001 to FR-006): the guarantees of a dialect as data, the control `toolIntegrity` and every reason a dialect does
 * not meet it, the resolution of tools in the order of needs to the first dialect that can, the refusal of a tool no dialect can carry out, the plan against what is installed, and the requirements of
 * Archon, from which an order is built. The dialects here are values of the port (the dialects with real tools are tested in their own packages); every address, hash and name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parseDialectId, parseSubjectName, type DialectId, type JsonValue } from "@intellectual-frontiers/archon/governance";
import { buildOrder } from "@intellectual-frontiers/archon/logical";
import {
  defineCatalog,
  defineTool,
  meetsIntegrity,
  planTools,
  requirementsFor,
  resolveTools,
  type Catalog,
  type Context,
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

const ALL = ["linux-x64", "linux-arm64", "macos-x64", "macos-arm64", "windows-x64"] as const;
const SHA = "b".repeat(64);
const art = (name: string) => ({ url: `https://example.test/${name}`, sha256: SHA, format: "file", bin: "" });

function dialect(name: string, g: Partial<ToolGuarantees> = {}): ToolDialect {
  return { id: id(name), guarantees: { pin: "exact", integrity: "hash", scopes: ["user", "system"], platforms: [...ALL], binds: "artifact", sourceBuild: false, ...g } };
}

const PINNED = dialect("native-pinned");
const BREW = dialect("homebrew", { pin: "rolling", integrity: "none", scopes: ["user"], platforms: ["macos-arm64", "macos-x64", "linux-x64", "linux-arm64"], binds: "package" });
const APT = dialect("apt", { pin: "release-line", integrity: "signature", scopes: ["system"], platforms: ["linux-x64", "linux-arm64"], binds: "package" });
const BUILDER = dialect("builder", { binds: "package", sourceBuild: true });

function tool(name: string, more: Partial<ToolInput> = {}) {
  const r = defineTool({
    name,
    summary: `${name}.`,
    version: "1.0.0",
    pin: "exact",
    program: name,
    versionArgs: ["--version"],
    phases: ["core"],
    scope: "user",
    bindings: [{ kind: "artifact", artifacts: { "linux-x64": art(`${name}-linux`), "macos-arm64": art(`${name}-macos`) } }, { kind: "package", dialect: "homebrew", packages: [name] }, { kind: "package", dialect: "builder", packages: [name] }],
    ...more,
  });
  if (r.kind === "err") throw new Error(r.error.join("; "));
  return r.value;
}

function catalog(): Catalog {
  const c = defineCatalog([tool("jq"), tool("git", { bindings: [{ kind: "package", dialect: "apt", packages: ["git"] }], pin: "release-line", scope: "system" }), tool("gh", { needs: ["git"], minimum: "0.9.0" })]);
  if (c.kind === "err") throw new Error(c.error.join("; "));
  return c.value;
}

/** Whether data is an object (a read-only list does not narrow away with Array.isArray). */
function isRecord(v: JsonValue | undefined): v is { readonly [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const CTX: Context = { platform: "linux-x64", preference: [id("native-pinned"), id("homebrew"), id("apt")], integrity: "rolling", systemCopy: "minimum" };

proves(["0003-toolchain-logical FR-001"], "a dialect declares its guarantees as data", () => {
  assertEquals(Object.keys(PINNED.guarantees).sort(), ["binds", "integrity", "pin", "platforms", "scopes", "sourceBuild"]);
  assertEquals([PINNED.guarantees.pin, PINNED.guarantees.integrity, PINNED.guarantees.binds, PINNED.guarantees.sourceBuild], ["exact", "hash", "artifact", false]);
  assertEquals([BREW.guarantees.pin, BREW.guarantees.integrity, BREW.guarantees.binds], ["rolling", "none", "package"]);
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
  const r = resolveTools(catalog(), ["gh", "jq"], [PINNED, BREW, APT], CTX);
  assert(r.kind === "ok");
  assertEquals(r.value.entries.map((e) => `${e.tool.name}:${e.dialect}`), ["git:apt", "gh:native-pinned", "jq:native-pinned"]);
  const rolling = defineCatalog([tool("curl", { pin: "rolling" })]);
  assert(rolling.kind === "ok");
  const prefer = resolveTools(rolling.value, ["curl"], [PINNED, BREW, APT], { ...CTX, preference: [id("homebrew"), id("native-pinned")] });
  assert(prefer.kind === "ok" && prefer.value.entries[0]?.dialect === "homebrew");
  const exact = resolveTools(catalog(), ["jq"], [PINNED, BREW, APT], { ...CTX, preference: [id("homebrew"), id("native-pinned")] });
  assert(exact.kind === "ok" && exact.value.entries[0]?.dialect === "native-pinned", "an exactly pinned tool is not carried out by a rolling dialect, whatever the preference");
  const mac = resolveTools(catalog(), ["jq"], [PINNED, BREW, APT], { ...CTX, platform: "macos-arm64" });
  assert(mac.kind === "ok" && mac.value.entries[0]?.source.kind === "artifact");
  const unknown = resolveTools(catalog(), ["nothing"], [PINNED], CTX);
  assert(unknown.kind === "err" && unknown.error[0]?.kind === "unknown-tool");
});


proves(["0003-toolchain-logical FR-004"], "a tool no dialect can carry out is refused with every reason, and a dialect that builds from source is never chosen", () => {
  const strict = resolveTools(catalog(), ["jq"], [PINNED, BREW, APT], { ...CTX, platform: "windows-x64", integrity: "exact-hashed" });
  assert(strict.kind === "err");
  const p = strict.error[0];
  assert(p?.kind === "unexpressed" && p.tool === "jq");
  assertEquals(p.reasons.map((r) => r.dialect), ["native-pinned", "homebrew", "apt"]);
  assert(p.reasons[0]?.reason.includes("windows-x64"));
  assert(p.reasons[1]?.reason.includes("windows-x64"));
  const hashed = resolveTools(catalog(), ["jq"], [BREW], { ...CTX, preference: [id("homebrew")], integrity: "exact-hashed" });
  assert(hashed.kind === "err");
  const reason = hashed.error[0];
  assert(reason?.kind === "unexpressed" && reason.reasons[0]?.reason.includes("exact"));
  const builder = resolveTools(catalog(), ["jq"], [BUILDER], { ...CTX, preference: [id("builder")] });
  assert(builder.kind === "err");
  const b = builder.error[0];
  assert(b?.kind === "unexpressed" && b.reasons[0]?.reason.includes("build from source"));
  const zed = defineCatalog([tool("zed", { bindings: [{ kind: "package", dialect: "apt", packages: ["zed"] }], scope: "user" })]);
  assert(zed.kind === "ok");
  const scope = resolveTools(zed.value, ["zed"], [APT], { ...CTX, preference: [id("apt")] });
  assert(scope.kind === "err" && scope.error[0]?.kind === "unexpressed" && scope.error[0].reasons[0]?.reason.includes("user scope"));
  const missingDialect = resolveTools(catalog(), ["jq"], [PINNED], { ...CTX, preference: [id("homebrew")] });
  assert(missingDialect.kind === "err");
});

proves(["0003-toolchain-logical FR-005"], "the plan says none, install or replace, and a copy on the path counts only where the policy allows", () => {
  const res = resolveTools(catalog(), ["jq", "gh"], [PINNED, APT], { ...CTX, preference: [id("native-pinned"), id("apt")] });
  assert(res.kind === "ok");
  const name = (n: string) => n as ToolName;
  const act = (observed: ReadonlyMap<ToolName, { version: string; from: "path" | "store" | "manager" }>, ctx: Context = CTX) => Object.fromEntries(planTools(res.value, observed, ctx).entries.map((e) => [e.tool, e.action]));
  assertEquals(act(new Map()), { git: "install", gh: "install", jq: "install" });
  assertEquals(act(new Map([[name("jq"), { version: "1.0.0", from: "store" as const }], [name("gh"), { version: "1.0.0", from: "store" as const }], [name("git"), { version: "1.0.0", from: "manager" as const }]])), { git: "none", gh: "none", jq: "none" });
  assertEquals(act(new Map([[name("jq"), { version: "0.9.0", from: "store" as const }]]))["jq"], "replace");
  assertEquals(act(new Map([[name("gh"), { version: "0.9.5", from: "path" as const }]]))["gh"], "none", "a path copy at the least version counts under minimum");
  assertEquals(act(new Map([[name("gh"), { version: "0.8.0", from: "path" as const }]]))["gh"], "replace");
  assertEquals(act(new Map([[name("gh"), { version: "1.0.0", from: "path" as const }]]), { ...CTX, systemCopy: "never" })["gh"], "replace");
  assertEquals(act(new Map([[name("gh"), { version: "1.0.0", from: "path" as const }]]), { ...CTX, integrity: "exact-hashed" })["gh"], "replace", "exact and hashed never takes a path copy");
  assertEquals(act(new Map([[name("jq"), { version: "1.0.0", from: "path" as const }]]))["jq"], "none", "a tool with no stated minimum is taken at its version");
});

proves(["0003-toolchain-logical FR-006"], "the requirements of kind tool are valid for Archon, depend on the tools needed, hold no secret, and an order is built from them", () => {
  const res = resolveTools(catalog(), ["gh", "jq"], [PINNED, APT], { ...CTX, preference: [id("native-pinned"), id("apt")] });
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
  assertEquals(desired["dialect"], "native-pinned");
  const source = desired["source"];
  assert(isRecord(source) && source["kind"] === "artifact" && source["sha256"] === SHA);
  const name = parseSubjectName("build-01.example.test");
  assert(name.kind === "ok");
  const order = buildOrder({ subject: { name: name.value, class: "workstation" }, assurance: "solo", layers: [{ layer: "baseline", requirements: reqs.value }] });
  assert(order.kind === "ok");
  assertEquals(order.value.requirements.map((r) => String(r.id)), ["tool.git", "tool.gh", "tool.jq"]);
  assertEquals(requirementsFor(res.value, { by: "class", class: "dns" }).kind, "err");
});
