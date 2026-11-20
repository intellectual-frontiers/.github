/**
 * Tests of the layers (0001-grc-layers): the rules of `tools/layers.ts` each shown on a file made to break it, the library's own files held to the table, the registry of typed ports, the document
 * envelope and the refusal of a document of another schema. Registry entries and documents are checked here once; each port's conformance is proved by its own tests.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import * as runtime from "@intellectual-frontiers/mizan/host/trace";
import { createKinds, createRegistry, defineKind, describeReadProblem, readDocument } from "@intellectual-frontiers/grc/governance";
import { standardKinds } from "@intellectual-frontiers/grc/logical";
import { string } from "@intellectual-frontiers/core";
import { layerFindings, unitOf } from "../tools/layers.ts";
import { aResult } from "./fixtures.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const EXPORTS: Record<string, string> = {
  "./governance": "./src/governance/mod.ts",
  "./logical": "./src/logical/mod.ts",
  "./physical": "./src/physical/mod.ts",
  "./runners/sql": "./src/runners/sql/mod.ts",
  "./runners/file": "./src/runners/file/mod.ts",
  "./stores/files": "./src/stores/files/mod.ts",
  "./surfaces/headless": "./src/surfaces/headless/mod.ts",
};
const find = (file: string, text: string) => layerFindings([{ path: file, text }], EXPORTS).map((f) => f.rule);

proves(["0001-grc-layers FR-004"], "governance imports Core only", () => {
  assertEquals(find("src/governance/x.ts", 'import { ok } from "@intellectual-frontiers/core";\n'), []);
  assertEquals(find("src/governance/x.ts", 'import { sha256 } from "@intellectual-frontiers/crypto/sha256";\n'), ["layers/external"]);
  assertEquals(find("src/governance/x.ts", 'import { x } from "@intellectual-frontiers/grc/logical";\n'), ["layers/above"]);
});

proves(["0001-grc-layers FR-005"], "the logical layer imports governance, Core, Crypto and Formats, and nothing of the physical layer", () => {
  assertEquals(find("src/logical/x.ts", 'import { sha256 } from "@intellectual-frontiers/crypto/sha256";\nimport { y } from "@intellectual-frontiers/grc/governance";\n'), []);
  assertEquals(find("src/logical/x.ts", 'import { fs } from "@intellectual-frontiers/system";\n'), ["layers/external"]);
  assertEquals(find("src/logical/x.ts", 'import { y } from "@intellectual-frontiers/grc/physical";\n'), ["layers/above"]);
});

proves(["0001-grc-layers FR-006"], "the physical layer imports the logical layer and governance and no unit that registers into it", () => {
  assertEquals(find("src/physical/x.ts", 'import { y } from "@intellectual-frontiers/grc/logical";\nimport { fs } from "@intellectual-frontiers/system";\n'), []);
  assertEquals(find("src/physical/x.ts", 'import { y } from "@intellectual-frontiers/grc/runners/sql";\n'), ["layers/above"]);
  assertEquals(find("src/physical/x.ts", 'import { y } from "../logical/x.ts";\n'), ["layers/relative"]);
  assertEquals(find("src/physical/x.ts", 'import { y } from "@intellectual-frontiers/grc/secret";\n'), ["layers/private"]);
});

proves(["0001-grc-layers FR-007"], "an extension is a unit of its own and imports no other extension", () => {
  assertEquals(unitOf("src/runners/sql/mod.ts"), { name: "src/runners/sql/", class: "runner" });
  assertEquals(find("src/runners/sql/mod.ts", 'import { y } from "@intellectual-frontiers/grc/physical";\n'), []);
  assertEquals(find("src/runners/sql/mod.ts", 'import { y } from "@intellectual-frontiers/grc/stores/files";\n'), ["layers/around"]);
  assertEquals(find("src/runners/sql/mod.ts", 'import { y } from "@intellectual-frontiers/grc/runners/file";\n'), ["layers/around"]);
  assertEquals(unitOf("src/runners/loose.ts"), undefined);
  assertEquals(find("src/runners/loose.ts", ""), ["layers/unclassified"]);
});

proves(["0001-grc-layers FR-008"], "a surface may import everything below it and nothing but the suite and the tools may import a surface", () => {
  assertEquals(find("src/surfaces/headless/mod.ts", 'import { y } from "@intellectual-frontiers/grc/runners/sql";\nimport { z } from "@intellectual-frontiers/headless/logical";\n'), []);
  assertEquals(find("src/runners/sql/mod.ts", 'import { y } from "@intellectual-frontiers/grc/surfaces/headless";\n'), ["layers/above"]);
  assertEquals(find("suite/x.test.ts", 'import { y } from "@intellectual-frontiers/grc/surfaces/headless";\nimport { z } from "../src/governance/mod.ts";\n'), []);
});

proves(["0001-grc-layers FR-001", "0001-grc-layers FR-002"], "the core names no framework, runner, store, vendor or exchange format, and an extension may", () => {
  assertEquals(find("src/governance/x.ts", "export const a = 'NIST 800-53';\n"), ["layers/named"]);
  assertEquals(find("src/logical/x.ts", "export const a = 'writes OSCAL';\n"), ["layers/named"]);
  assertEquals(find("src/physical/x.ts", "const a = 'SQLite';\n"), ["layers/named"]);
  assertEquals(find("src/logical/x.ts", "// NIST in a comment\n/** OSCAL */\n * SARIF\n"), []);
  assertEquals(find("src/serializers/oscal/mod.ts", "export const a = 'OSCAL';\n"), []);
});

proves(["0001-grc-layers FR-003"], "a shim, an alias or a deprecated name is a finding", () => {
  assertEquals(find("src/logical/x.ts", "/** @deprecated use y */\nexport const x = 1;\n"), ["layers/compat"]);
  assertEquals(find("src/logical/x.ts", "export const legacy = 1;\n"), ["layers/compat"]);
  assertEquals(find("src/logical/x.ts", "export const fine = 1;\n"), []);
});

proves(["0001-grc-layers FR-009"], "a registry refuses an unstable id and a duplicate, and lists its entries in the order of their ids", () => {
  const r = createRegistry<{ readonly id: string }>("thing");
  assertEquals(r.register({ id: "b-2" }).kind, "ok");
  assertEquals(r.register({ id: "a.1" }).kind, "ok");
  const dup = r.register({ id: "b-2" });
  assertEquals(dup.kind === "err" ? dup.error.kind : "", "duplicate");
  for (const bad of ["", "B", "a b", "-a", "a--b", "1a"]) assertEquals(r.register({ id: bad }).kind, "err", bad);
  assertEquals(r.list().map((e) => e.id), ["a.1", "b-2"]);
  assert(r.has("a.1") && !r.has("zz") && r.get("zz") === undefined);
});

proves(["0001-grc-layers FR-010"], "every document carries kind, schema, id, createdAt and provenance, and the reader knows only the schema of its release", () => {
  const kinds = standardKinds();
  const r = aResult("c", "host-1", "pass");
  const ok = readDocument(kinds, JSON.stringify(r));
  assertEquals(ok.kind, "ok");
  for (const missing of ["kind", "schema", "id", "createdAt", "provenance"]) {
    const { [missing]: _drop, ...rest } = r as unknown as Record<string, unknown>;
    assertEquals(readDocument(kinds, rest).kind, "err", missing);
  }
  const old = readDocument(kinds, { ...r, schema: "0.1" });
  assertEquals(old.kind === "err" ? old.error : undefined, { kind: "schema", documentKind: "grc.result", found: "0.1", expected: "1" });
  assertStringIncludes(old.kind === "err" ? describeReadProblem(old.error) : "", "reads schema 1 only");
  assertEquals(readDocument(kinds, { ...r, kind: "grc.mystery" }).kind, "err");
  assertEquals(readDocument(kinds, "{ not json").kind, "err");
  const own = createKinds();
  const note = defineKind("grc.note", "3", { text: string });
  assertEquals(own.register(note).kind, "ok");
  assertEquals(own.register(note).kind, "err");
});

proves(["0001-grc-layers FR-011"], "the library's own files follow the table: the layers check finds nothing in them", async () => {
  const pkg = JSON.parse(await fs.readTextFile(path.join(ROOT, "package.json"))) as { exports: Record<string, string> };
  const sources = await runtime.readSources(ROOT, ["about.ts", "src", "tools"]);
  const tests = await runtime.readSources(ROOT, ["suite"]);
  assertEquals(layerFindings([...sources, ...tests], pkg.exports).map((f) => `${f.rule} ${f.file}:${f.line} ${f.message}`), []);
});

proves(["0001-grc-layers FR-012"], "the terms of the library that no standard defines are marked unaligned where they are defined", async () => {
  const kinds = await fs.readTextFile(path.join(ROOT, "src", "logical", "kinds.ts"));
  assertStringIncludes(kinds, "unaligned");
  const gov = await fs.readTextFile(path.join(ROOT, "src", "governance", "kinds.ts"));
  assertStringIncludes(gov, "unaligned");
});
