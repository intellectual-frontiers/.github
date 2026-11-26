/**
 * Tests of the maturity of a library (commons 0001-libraries FR-024): the three degrees, the limits of an experimental one, what a package says of it and that a library is released whatever it says.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { decodeLibrarySource, MATURITIES, maturitySentence, parseMaturityText, readLibraries } from "../src/libraries.ts";
import { join } from "@intellectual-frontiers/system/path";
import { fileURLToPath } from "node:url";

const SPEC = "0001-libraries";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

const source = (extra: Record<string, unknown>): string =>
  `export const library = ${JSON.stringify({ name: "alpha", level: "L1", verify: "bun run verify", version: "0.1.0", exports: ["."], distribution: ["github", "npm"], ...extra })};\n`;

proves([`${SPEC} FR-024`], "a library says how far it is built: experimental with what is not done, preview or stable, and nothing else", () => {
  assertEquals([...MATURITIES], ["experimental", "preview", "stable"]);
  for (const maturity of ["preview", "stable"]) {
    const r = decodeLibrarySource(source({ maturity }));
    assert(r.kind === "ok" && r.value.maturity === maturity);
    assertEquals(maturitySentence(r.value), maturity);
  }
  const e = decodeLibrarySource(source({ maturity: "experimental", limits: ["no program runs on it yet", "not run against a live tenant"] }));
  assert(e.kind === "ok");
  assertEquals(maturitySentence(e.value), "experimental (no program runs on it yet; not run against a live tenant)");
  const refused = (extra: Record<string, unknown>): string => {
    const r = decodeLibrarySource(source(extra));
    assert(r.kind === "err", `refused: ${JSON.stringify(extra)}`);
    return r.error;
  };
  assertStringIncludes(refused({}), "maturity");
  assertStringIncludes(refused({ maturity: "finished" }), "maturity");
  assertStringIncludes(refused({ maturity: "experimental" }), "library.limits");
  assertStringIncludes(refused({ maturity: "experimental", limits: [] }), "at least one");
  assertStringIncludes(refused({ maturity: "experimental", limits: [" padded "] }), "library.limits[0]");
  assertStringIncludes(refused({ maturity: "stable", limits: ["x"] }), "only where library.maturity is experimental");
  assertEquals(parseMaturityText("one line", "w").kind, "ok");
  assertEquals(parseMaturityText("two\nlines", "w").kind, "err");
});

proves([`${SPEC} FR-024`], "every library of the repository says how far it is built, is published to both registries, and every one is in the plan of a release", () => {
  const found = readLibraries(ROOT);
  assertEquals(found.filter((f) => "problem" in f).length, 0);
  const libraries = found.flatMap((f) => ("library" in f ? [f.library] : []));
  assert(libraries.length > 80);
  for (const l of libraries) {
    assert((MATURITIES as readonly string[]).includes(l.maturity), l.name);
    assertEquals([...l.distribution], ["github", "npm"], l.name);
    assertEquals(l.maturity === "experimental", l.limits !== undefined, `${l.name}: limits are given exactly where it is experimental`);
  }
});
