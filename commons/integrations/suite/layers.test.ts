/**
 * Tests of the layers of Integrations over the shared checker of Kanon (commons integrations 0001-integrations-layers FR-001 to FR-008): the table in the manifest holds
 * every file of the real tree with no finding, the same table finds each way an import can break it, the pure layers name no vendor, and the manifest agrees with the package.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { decodeTable, importFindings, unitOf, type Table } from "@intellectual-frontiers/kanon";
import { findings as hostFindings, readTable } from "@intellectual-frontiers/kanon/host";
import { fs, path } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { library } from "../library.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const EXPORTS: Record<string, string> = {
  ".": "./src/mod.ts",
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./http": "./src/physical/http/mod.ts",
  "./transport": "./src/physical/transport/mod.ts",
  "./headless": "./src/surfaces/headless/mod.ts",
};
const PKG = "@intellectual-frontiers/integrations";
const at = (path: string, text: string) => ({ path, text });

function table(): Table {
  const t = decodeTable(library.kanon);
  if (t.kind === "err") throw new Error(t.error);
  return t.value;
}
const rules = (files: readonly { path: string; text: string }[]): string[] => importFindings(table(), files, EXPORTS).map((f) => f.rule);

proves(["0001-integrations-layers FR-001", "0001-integrations-layers FR-002", "0001-integrations-layers FR-005", "0001-integrations-layers FR-006", "0001-integrations-layers FR-007"], "the shared checker finds nothing in the real tree, and the table's entries are the package's exports", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string>; scripts: Record<string, string> };
  assertEquals(pkg.exports, EXPORTS);
  assert(pkg.scripts["verify"]?.includes("bun ../kanon/src/check.ts"), "verify runs the shared checker");
  assertEquals(readTable(ROOT).kind, "ok");
  const found = hostFindings(ROOT);
  assert(found.kind === "ok", "the real tree is read");
  assertEquals(found.value.map((f) => `${f.rule} ${f.file}`), []);
});

proves(["0001-integrations-layers FR-001"], "a file in no unit is layers/unclassified", () => {
  assertEquals(rules([at("lib/x.ts", "export {};\n")]), ["layers/unclassified"]);
  assertEquals(unitOf(table(), "src/governance/ids.ts")?.name, "src/governance/");
});

proves(["0001-integrations-layers FR-002"], "below may not import above, and a unit reaches another only through exports", () => {
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/http";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/physical/http/a.ts", `import { x } from "${PKG}/transport";\n`)]), ["layers/around"]);
  assertEquals(rules([at("src/surfaces/headless/a.ts", `import { x } from "${PKG}/transport";\n`)]), []);
  assertEquals(rules([at("src/surfaces/headless/a.ts", `import { x } from "${PKG}/http";\n`)]), ["layers/around"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "../governance/ids.ts";\n`)]), ["layers/relative"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/internal";\n`)]), ["layers/private"]);
  assertEquals(rules([at("suite/a.test.ts", `import { x } from "../src/logical/mod.ts";\n`)]), []);
});

proves(["0001-integrations-layers FR-003"], "each unit imports only what its row allows, and the pure layers import Core alone", () => {
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "@intellectual-frontiers/net/http-client";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "node:fs";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/physical/http/a.ts", `import { x } from "@intellectual-frontiers/net/http-client";\n`)]), []);
  assertEquals(rules([at("src/physical/http/a.ts", `import { x } from "@intellectual-frontiers/headless/cli";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/surfaces/headless/a.ts", `import { x } from "@intellectual-frontiers/headless/cli";\n`)]), ["layers/external"]);
  assertEquals(rules([at("src/logical/a.ts", `import { absurd } from "@intellectual-frontiers/core";\n`)]), []);
});

async function realFiles(): Promise<readonly { path: string; text: string }[]> {
  return [...(await runtime.readSources(ROOT, ["about.ts", "src", "tools"])), ...(await runtime.readSources(ROOT, ["suite"]))];
}

proves(["0001-integrations-layers FR-004"], "no source of the two pure layers names a vendor", async () => {
  const vendors = /\b(github|gitlab|bitbucket|aws|azure|gcp|okta|bamboohr|rippling|unifi|epic|cerner|availity|change healthcare|office365|salesforce)\b/i;
  const files = (await realFiles()).filter((f) => f.path.startsWith("src/governance/") || f.path.startsWith("src/logical/"));
  assert(files.length > 10);
  for (const f of files) {
    const code = f.text.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/*"));
    const hit = code.find((l) => vendors.test(l));
    assertEquals(hit, undefined, `${f.path} names a vendor`);
  }
});

proves(["0001-integrations-layers FR-008"], "the manifest agrees with the package", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { name: string; version: string; exports: Record<string, string> };
  assertEquals(pkg.name, `@intellectual-frontiers/${library.name}`);
  assertEquals(pkg.version, library.version);
  assertEquals(Object.keys(pkg.exports), [...library.exports]);
  assertEquals(table().package, pkg.name);
});

proves(["0001-integrations-layers FR-009"], "the host declares the family rule and a noun for each plugin, and each plugin declares the family and extends the host", async () => {
  assertEquals(library.family, { host: "integrations", role: "host" });
  const t = table();
  assertEquals(t.family?.plugin, "{host}-{name}");
  assertEquals(t.family?.contract, "./logical");
  const nouns = t.plugins.map((p) => p.noun).sort();
  assertEquals(nouns, ["fhir", "github", "identity", "otel", "redfish", "snmp", "x12"]);
  for (const noun of nouns) {
    const text = await fs.readTextFile(path.join(ROOT, "..", `integrations-${noun}`, "library.ts"));
    assert(text.includes('family: { host: "integrations", role: "plugin" }'), `${noun} declares the family`);
    assert(text.includes('extends: "@intellectual-frontiers/integrations"'), `${noun} extends the host`);
  }
});
