// Spec: 0001-layers FR-011
/**
 * The trace of the library reads its own spec kit alone (commons 0027-commons-libraries FR-003): a citation of a specification that exists only in commons is unknown
 * here, and one of its own is known.
 *
 * @module
 */
import { trace } from "@intellectual-frontiers/commons/ts/kernel";
import { path, trace as runtime } from "@intellectual-frontiers/commons/ts/runtime";
import { assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

proves(["0001-layers FR-011"], "a citation is read against this library's specifications, not commons'", async () => {
  const specs = await runtime.readSpecs(ROOT, "spec-kit/specs");
  assertEquals(specs.map((s) => s.slug).slice(0, 2), ["0001-layers", "0002-engine"]);
  const input = (text: string): trace.TraceInput => ({
    specs,
    sources: [{ path: "engine/x.ts", text }],
    tests: [],
    ontology: [],
    specsFolder: "spec-kit/specs",
  });
  const rules = (text: string): readonly string[] => trace.traceFindings(input(text)).map((f) => f.rule).filter((r) => r !== "trace/unproved");
  assertEquals(rules("// Spec: 0001-layers FR-004\n"), []);
  assertEquals(rules("// Spec: 0027-commons-libraries FR-001\n"), ["trace/unknown-spec"]);
  assertEquals(rules("// Spec: 0001-layers FR-099\n"), ["trace/unknown-requirement"]);
  assertEquals(rules("export const x = 1;\n"), ["trace/no-spec-line"]);
});
