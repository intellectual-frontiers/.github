/**
 * Tests of the adapter over the packaging ontology (commons toolchain 0004-toolchain-ontology FR-001 to FR-004), against the real data of the ontology (never a copy of it): a download for a
 * pinned program on a platform, the ontology's reason where there is none, the check that every download given is valid, that no source of this library holds a version, an address or a
 * hash, and a tool resolved at the version of the ontology's pin.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { parseDialectId } from "@intellectual-frontiers/desired-os-state/governance";
import { pinIds, platformNames } from "@intellectual-frontiers/ontology/supply-chain/downloads";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { path } from "@intellectual-frontiers/system";
import { defineCatalog, defineDownload, defineTool, parsePinId, resolveTools, type Platform, type ToolDialect } from "../src/mod.ts";
import { pinSourceFromOntology } from "../src/physical/ontology/mod.ts";

const PINS = pinSourceFromOntology();

function pin(name: string) {
  const r = parsePinId(name);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

proves(["0004-toolchain-ontology FR-001"], "a pinned program on a platform gives its version, address, SHA-256, format and folder", () => {
  const d = PINS.lookup(pin("bun"), "linux-x64");
  assert(d.kind === "ok", d.kind === "err" ? d.error : "");
  assert(/^\d+\.\d+/.test(d.value.version));
  assert(d.value.downloadUrl.startsWith("https://"));
  assert(d.value.downloadUrl.includes(d.value.version), "the version is in the address");
  assert(/^[0-9a-f]{64}$/.test(d.value.sha256));
  assertEquals(d.value.archiveFormat, "zip");
  const all: Platform[] = ["linux-x64", "linux-arm64", "macos-x64", "macos-arm64", "windows-x64"];
  for (const p of all) assertEquals(PINS.lookup(pin("bun"), p).kind, "ok", `bun on ${p}`);
});

proves(["0004-toolchain-ontology FR-002"], "where the ontology gives no download the reason names the pin and the platform", () => {
  const unknown = PINS.lookup(pin("nothing-here"), "linux-x64");
  assert(unknown.kind === "err" && unknown.error.includes("nothing-here"));
  const unpinned = PINS.lookup(pin("jq"), "linux-x64");
  assert(unpinned.kind === "err" && unpinned.error.includes("jq") && unpinned.error.includes("linux-x64"), unpinned.kind === "err" ? unpinned.error : "jq is pinned");
  const none = PINS.lookup(pin("python"), "linux-x64");
  assert(none.kind === "err" && none.error.includes("python"));
  const partial = PINS.lookup(pin("rustup-init"), "windows-x64");
  assert(partial.kind === "err" && partial.error.includes("windows-x64"));
  const platform = PINS.lookup(pin("bun"), "linux-x64" as Platform);
  assertEquals(platform.kind, "ok");
});

proves(["0004-toolchain-ontology FR-003"], "every download the source gives is valid under defineDownload", () => {
  let given = 0;
  for (const p of pinIds()) {
    for (const w of platformNames()) {
      const r = PINS.lookup(pin(String(p)), w as Platform);
      if (r.kind === "err") continue;
      given++;
      const again = defineDownload({ version: r.value.version, downloadUrl: r.value.downloadUrl, sha256: r.value.sha256, archiveFormat: r.value.archiveFormat, binPath: r.value.binPath });
      assertEquals(again.kind, "ok", `${p} on ${w}`);
    }
  }
  assert(given >= 5, "the ontology gives downloads");
});

proves(["0004-toolchain-ontology FR-004"], "no source of this library holds a version, an address or a hash of a pin", async () => {
  const root = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
  const files = await runtime.readSources(root, ["src"]);
  assert(files.length >= 8);
  for (const f of files) {
    const code = f.text.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/*"));
    for (const line of code) {
      assertEquals(/[0-9a-f]{64}/.test(line), false, `${f.path} holds a hash: ${line.trim()}`);
      assertEquals(/https:\/\/[a-z0-9.-]+\//.test(line), false, `${f.path} holds an address: ${line.trim()}`);
    }
  }
});

proves(["0004-toolchain-ontology FR-001"], "a tool that is pinned in the ontology resolves at the version of its pin", () => {
  const d = parseDialectId("pinned-downloads");
  assert(d.kind === "ok");
  const dialect: ToolDialect = { id: d.value, guarantees: { pin: "exact", integrity: "hash", scopes: ["user"], platforms: ["linux-x64", "linux-arm64", "macos-x64", "macos-arm64", "windows-x64"], binds: "pin", sourceBuild: false } };
  const bun = defineTool({ name: "bun", summary: "Bun.", pin: "exact", program: "bun", versionArgs: ["--version"], phases: ["core"], scope: "user", bindings: [{ kind: "pin", pin: "bun" }] });
  assert(bun.kind === "ok");
  const catalog = defineCatalog([bun.value]);
  assert(catalog.kind === "ok");
  const res = resolveTools(catalog.value, ["bun"], [dialect], PINS, { platform: "linux-x64", preference: [d.value], integrity: "exact-hashed", systemCopy: "never" });
  assert(res.kind === "ok");
  const direct = PINS.lookup(pin("bun"), "linux-x64");
  assert(direct.kind === "ok");
  assertEquals(res.value.entries[0]?.version, direct.value.version);
  const jq = defineTool({ name: "jq", summary: "jq.", pin: "exact", program: "jq", versionArgs: ["--version"], phases: ["core"], scope: "user", bindings: [{ kind: "pin", pin: "jq" }] });
  assert(jq.kind === "ok");
  const c2 = defineCatalog([jq.value]);
  assert(c2.kind === "ok");
  const refused = resolveTools(c2.value, ["jq"], [dialect], PINS, { platform: "linux-x64", preference: [d.value], integrity: "exact-hashed", systemCopy: "never" });
  assert(refused.kind === "err" && refused.error[0]?.kind === "unexpressed" && refused.error[0].reasons[0]?.reason.includes("jq"));
});
