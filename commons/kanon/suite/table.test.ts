/**
 * Tests of the table of a Kanon library (commons kanon 0001-kanon-checker FR-001): a table is decoded from the `kanon` field of a manifest, and each way it can be malformed is refused with a
 * sentence that names the unit.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { decodeTable, LAYERS, parseFolder, parsePackageName, RANK, RULES, RULE_SUMMARY, familyOf } from "../src/mod.ts";

const PACKAGE = "@intellectual-frontiers/x";
const GOOD = {
  package: PACKAGE,
  units: [
    { folder: "src/governance/", layer: "governance" },
    { folder: "src/logical/", layer: "logical" },
    { folder: "src/surfaces/", layer: "physical", instances: true, packages: [{ name: "@intellectual-frontiers/core", subpaths: [] }] },
    { folder: "suite/", own: true },
  ],
};

function refused(input: unknown): string {
  const r = decodeTable(input);
  assert(r.kind === "err", "the table is refused");
  return r.error;
}

proves(["0001-kanon-checker FR-001"], "a table is decoded, with the three layers ranked from the top", () => {
  const r = decodeTable(GOOD);
  assert(r.kind === "ok");
  assertEquals(r.value.units.length, 4);
  assertEquals([...LAYERS], ["governance", "logical", "physical"]);
  assert(RANK.governance < RANK.logical && RANK.logical < RANK.physical);
});

proves(["0001-kanon-checker FR-001"], "a layer that is not one of the three is refused", () => {
  assertStringIncludes(refused({ package: PACKAGE, units: [{ folder: "src/a/", layer: "middle" }] }), "units[0]");
});

proves(["0001-kanon-checker FR-001"], "a folder with no trailing slash, a folder twice and a unit in no layer are refused", () => {
  assertStringIncludes(refused({ package: PACKAGE, units: [{ folder: "src/a", layer: "logical" }] }), "ends with a slash");
  assertStringIncludes(
    refused({
      package: PACKAGE,
      units: [
        { folder: "src/a/", layer: "logical" },
        { folder: "src/a/", layer: "physical" },
      ],
    }),
    "twice",
  );
  assertStringIncludes(refused({ package: PACKAGE, units: [{ folder: "src/a/" }] }), "in no layer");
});

proves(["0001-kanon-checker FR-001"], "an own unit with a layer, and a mayImport that names no unit, are refused", () => {
  assertStringIncludes(refused({ package: PACKAGE, units: [{ folder: "suite/", own: true, layer: "logical" }] }), "own checking");
  assertStringIncludes(
    refused({ package: PACKAGE, units: [{ folder: "src/a/", layer: "logical", mayImport: ["src/b/"] }] }),
    "no unit of the table",
  );
});

proves(["0001-kanon-checker FR-001"], "what is not an object, and an unknown shape, is refused", () => {
  assertStringIncludes(refused("x"), "kanon");
  assertStringIncludes(refused({ package: PACKAGE }), "kanon");
});

proves(
  ["0001-kanon-checker FR-001"],
  "a folder and a package name are made only by their smart constructors, which refuse what is not one",
  () => {
    for (const ok of ["./", "src/", "src/governance/", "src/surfaces/cli/"]) assertEquals(parseFolder(ok).kind, "ok", ok);
    for (const bad of ["", "src", "/src/", "../src/", "src//a/", "src/../a/"]) assertEquals(parseFolder(bad).kind, "err", bad);
    assertEquals(parsePackageName("@intellectual-frontiers/x").kind, "ok");
    assertEquals(parsePackageName("x").kind, "ok");
    assertEquals(parsePackageName("Not A Name").kind, "err");
  },
);

proves(["0001-kanon-checker FR-001", "0001-kanon-checker FR-009"], "a unit is a sum: a layered unit has a layer and an own unit has none", () => {
  const r = decodeTable(GOOD);
  assert(r.kind === "ok");
  assertEquals(
    r.value.units.map((u) => u.kind),
    ["layered", "layered", "layered", "own"],
  );
});

proves(["0001-kanon-checker FR-004", "0001-kanon-checker FR-009", "0002-kanon-content-checks FR-003"], "the codes are a closed union with a summary and a family for each", () => {
  assertEquals(RULES.length, 19);
  for (const rule of RULES) {
    assert(RULE_SUMMARY[rule].length > 0, rule);
    assertEquals(familyOf(rule), rule.split("/")[0]);
  }
});
