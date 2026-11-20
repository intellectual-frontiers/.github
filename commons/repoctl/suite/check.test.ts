/**
 * Tests of `repoctl check` and `repoctl explain` (commons repoctl 0003-repoctl-sync FR-007 to FR-009): the findings of a check program, the constants that say a version (found, with the file and the line, and the ones the manifest names that
 * are missing), one report over the real repository that writes nothing and ends with 0, and every code explained.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { CATALOGUE, PROBLEM_CODES } from "@intellectual-frontiers/repoctl/governance";
import { constantFindings, constantsIn, conventionName, findingsOfProgram, type LibraryInfo, reportOk, sectionOk } from "@intellectual-frontiers/repoctl/logical";
import { main } from "@intellectual-frontiers/repoctl";
import { CAN_RUN, CHECKOUT, git } from "./world.ts";

const lib = (name: string, version: string, over: Partial<LibraryInfo> = {}): LibraryInfo => ({ name, package: `@intellectual-frontiers/${name}`, folder: `commons/${name}`, version, level: "L1", specKit: undefined, npm: true, held: undefined, versionConstants: [], ...over });

proves(["0003-repoctl-sync FR-007"], "a check program's end is findings: none for 0, a finding for each line it said for 1 (with the code and the fix), and a warning that it did not run for any other status", () => {
  assertEquals(findingsOfProgram({ code: 0, stdout: "", stderr: "" }, "E-SPEC-KIT", "fix it"), []);
  const found = findingsOfProgram({ code: 1, stdout: "", stderr: "a.md: one\nb.md: two\n" }, "E-SPEC-KIT", "bun x");
  assertEquals(found.map((f) => `${f.level} ${f.code} ${f.message} | ${f.fix}`), ["fail E-SPEC-KIT a.md: one | bun x", "fail E-SPEC-KIT b.md: two | bun x"]);
  const many = findingsOfProgram({ code: 1, stdout: "", stderr: Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n") }, "E-MIZAN-RULE", "bun y");
  assertEquals(many.length, 13);
  assertStringIncludes(many[12]?.message ?? "", "18 more lines");
  const none = findingsOfProgram({ code: 3, stdout: "", stderr: "not run: no base\n" }, "E-VERSIONS", "bun z");
  assertEquals(none.map((f) => `${f.level} ${f.code}`), ["warn E-ENVIRONMENT"]);
  assertEquals(sectionOk({ id: "x", title: "x", findings: none }), true, "a check that could not run is a warning, not a failure");
  assertEquals(reportOk({ sections: [{ id: "x", title: "x", findings: found }] }), false);
});

proves(["0003-repoctl-sync FR-008"], "a constant named for its library or by its manifest that disagrees with the library's version is found with its file and line, and so is one the manifest names that is missing", () => {
  assertEquals(conventionName("integrations-github"), "INTEGRATIONS_GITHUB_VERSION");
  assertEquals(constantsIn({ path: "a.ts", text: 'const A = 1;\nexport const X_VERSION: string = "1.2.3";\nconst Y_VERSION = `no`;\n' }).map((c) => `${c.name} ${c.value} ${c.line}`), ["X_VERSION 1.2.3 2"]);
  const ergonex = lib("ergonex", "0.4.7");
  const old = { path: "commons/ergonex/src/state-record.ts", text: 'export const ERGONEX_VERSION = "0.4.6";\n' };
  const found = constantFindings([ergonex], [old]);
  assertEquals(found.map((f) => f.code), ["E-VERSION-CONSTANT"]);
  assertStringIncludes(found[0]?.message ?? "", 'commons/ergonex/src/state-record.ts:1: ERGONEX_VERSION is "0.4.6" and the version of ergonex is "0.4.7"');
  assertEquals(constantFindings([ergonex], [{ ...old, text: 'export const ERGONEX_VERSION = "0.4.7";\n' }]), []);
  // a constant of another name is no constant of the library, unless the manifest names it
  const other = { path: "commons/ergonex/src/pins.ts", text: 'export const BUN_VERSION = "1.4.4";\n' };
  assertEquals(constantFindings([ergonex], [other]), []);
  const named = lib("ergonex", "0.4.7", { versionConstants: [{ file: "src/pins.ts", name: "BUN_VERSION" }] });
  assertEquals(constantFindings([named], [other]).length, 1);
  // a source of another library is not read for this one
  assertEquals(constantFindings([ergonex], [{ path: "commons/core/src/mod.ts", text: 'export const ERGONEX_VERSION = "0.0.1";\n' }]), []);
  // a manifest that names a constant the file does not say
  const missing = constantFindings([lib("k", "1.0.0", { versionConstants: [{ file: "src/v.ts", name: "K_VERSION" }] })], [{ path: "commons/k/src/v.ts", text: "export const OTHER = 1;\n" }]);
  assertStringIncludes(missing[0]?.message ?? "", 'does not say K_VERSION = "<version>"');
  const notVersion = constantFindings([lib("k", "1.0.0")], [{ path: "commons/k/src/v.ts", text: 'export const K_VERSION = "latest";\n' }]);
  assertStringIncludes(notVersion[0]?.message ?? "", "is not a version");
});

proves(["0003-repoctl-sync FR-007", "0003-repoctl-sync FR-008", "0003-repoctl-sync FR-010"], "one report over the real repository writes nothing, ends with 0 and has a section for every check", async () => {
  if (!CAN_RUN) return;
  const out: string[] = [];
  const err: string[] = [];
  const before = await git(CHECKOUT, "status", "--porcelain");
  const status = await main(["check", "--json"], { cwd: CHECKOUT, out: (t) => void out.push(t), err: (t) => void err.push(t) });
  assertEquals(status, 0, `${out.join("")}${err.join("")}`);
  assertEquals(await git(CHECKOUT, "status", "--porcelain"), before, "check writes nothing");
  const doc: unknown = JSON.parse(out.join(""));
  const ids = (typeof doc === "object" && doc !== null && "data" in doc && typeof doc.data === "object" && doc.data !== null && "sections" in doc.data && Array.isArray(doc.data.sections) ? doc.data.sections : []).map((s: unknown) => (typeof s === "object" && s !== null && "id" in s ? String(s.id) : ""));
  for (const id of ["generator:readme", "generator:libraries", "specs", "rules", "versions", "spec-kit:repoctl", "spec-kit:core", "version-constants", "declared-dependencies"]) assert(ids.includes(id), `${id} is a section`);
});

proves(["0003-repoctl-sync FR-009"], "every code is explained, and a text that is no code names the nearest", async () => {
  for (const code of PROBLEM_CODES) {
    const out: string[] = [];
    assertEquals(await main(["explain", code], { cwd: CHECKOUT, out: (t) => void out.push(t), err: () => undefined }), 0, code);
    const text = out.join("");
    assertStringIncludes(text, CATALOGUE[code].title);
    assertStringIncludes(text, CATALOGUE[code].fix);
  }
  const out: string[] = [];
  const err: string[] = [];
  await main(["explain", "E-STALE-GENERATE"], { cwd: CHECKOUT, out: (t) => void out.push(t), err: (t) => void err.push(t) });
  assertStringIncludes(`${out.join("")}${err.join("")}`, "E-STALE-GENERATED");
});
