/**
 * Tests of the layers check (`tools/layers.ts`) and of the check that runs it (`tools/check.ts`): every file is in one unit, imports point one way, units reach
 * each other only through the package's `exports`, each unit imports only what its row allows, the pure layers name no vendor, and the manifest agrees with the
 * package (commons integrations 0001-integrations-layers FR-001 to FR-008).
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { library } from "../library.ts";
import { layerFindings, unitOf, type LayerFinding } from "../tools/layers.ts";

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
const rules = (files: readonly { path: string; text: string }[]): string[] => layerFindings(files, EXPORTS).map((f: LayerFinding) => f.rule);

async function realFiles(): Promise<readonly { path: string; text: string }[]> {
  return [...(await runtime.readSources(ROOT, ["about.ts", "src", "tools"])), ...(await runtime.readSources(ROOT, ["suite"]))];
}

proves(["0001-integrations-layers FR-001", "0001-integrations-layers FR-002", "0001-integrations-layers FR-005", "0001-integrations-layers FR-006", "0001-integrations-layers FR-007"], "the real tree has no finding of the layers check, and the table's entries are the package's exports", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
  assertEquals(pkg.exports, EXPORTS);
  const files = await realFiles();
  assert(files.length > 30, "the check read the library");
  assertEquals(layerFindings(files, pkg.exports), []);
  assertEquals(unitOf("src/physical/ftp/mod.ts"), undefined, "a folder with no row is in no unit");
  assertEquals(unitOf("src/governance/ids.ts")?.class, "governance");
  assertEquals(unitOf("src/physical/http/mod.ts")?.name, "src/physical/http/");
});

proves(["0001-integrations-layers FR-001"], "a file in no unit is layers/unclassified", () => {
  assertEquals(rules([at("src/physical/ftp/mod.ts", "export {};\n")]), ["layers/unclassified"]);
  assertEquals(rules([at("src/other/x.ts", "export {};\n")]), ["layers/unclassified"]);
});

proves(["0001-integrations-layers FR-002"], "below may not import above, and a unit reaches another only through exports", () => {
  assertEquals(rules([at("src/logical/a.ts", `import { x } from "${PKG}/http";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/governance/a.ts", `import { x } from "${PKG}/logical";\n`)]), ["layers/above"]);
  assertEquals(rules([at("src/physical/http/a.ts", `import { x } from "${PKG}/transport";\n`)]), ["layers/around"]);
  assertEquals(rules([at("src/surfaces/headless/a.ts", `import { x } from "${PKG}/transport";\n`)]), []);
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
});
