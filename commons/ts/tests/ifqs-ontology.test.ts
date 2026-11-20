/**
 * The ontology of the Intellectual Frontiers Quality System (commons 0021-ifqs, 0022-trust) and the audit of its terms (0018-standards-first FR-003, FR-004): the code lists
 * have the keys the specifications name, the outcome words are 0008-test-evidence's with `not_run` added, the freshness words are 0007-grc's, every class and every code list's
 * class has a record of its basis, and the crosswalk and the control citations of 0021-ifqs are well formed and name requirements that exist. Pure functions over the typed
 * ontology and the text of the specifications; nothing runs, and no network is used.
 *
 * @module
 */
import { type FreshnessStatus } from "../kernel/assess.ts";
import { validate } from "@intellectual-frontiers/rdf";
import { OUTCOMES } from "../kernel/test-record.ts";
import { readTextFileSync } from "../runtime/fs.ts";
import { dirname, fromFileUrl, resolve } from "../runtime/path.ts";
import { assert, assertEquals, proves, test } from "../runtime/test.ts";
import { bases } from "../../ontology/mizan/mod.ts";
import {
  audiences,
  capaStates,
  Capa,
  classes,
  evidenceGrades,
  file,
  files,
  freshnessStates,
  ifqs,
  nonconformanceStates,
  properties,
  QualityObjective,
  qualityTiers,
  ReviewDebt,
  terms,
  testOutcomes,
} from "../../ontology/ifqs/mod.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const specOf = (slug: string): string => readTextFileSync(resolve(HERE, "..", "..", "spec-kit", "specs", slug, "spec.md"));
const IFQS = specOf("0021-ifqs");
const TRUST = specOf("0022-trust");

const keys = (list: object): string[] => Object.keys(list);

/** The requirement numbers a specification states. */
const requirementsOf = (spec: string): ReadonlySet<string> =>
  new Set([...spec.matchAll(/^- \*\*(FR-[0-9]{3})\*\*/gm)].map((m) => m[1] ?? ""));

/** The rows of a specification's crosswalk table. */
function crosswalk(
  spec: string,
): readonly { readonly standard: string; readonly clause: string; readonly relation: string; readonly requirements: readonly string[] }[] {
  return spec
    .split("\n")
    .filter((l) => l.startsWith("|") && !l.startsWith("| Standard") && !l.startsWith("| ---"))
    .map((l) => l.split("|").map((c) => c.trim()))
    .map((c) => ({
      standard: c[1] ?? "",
      clause: c[2] ?? "",
      relation: c[3] ?? "",
      requirements: (c[4] ?? "").split(",").map((r) => r.trim()),
    }));
}

proves(["0021-ifqs FR-021"], "the evidence ladder is six grades, E0 to E5, ranked 0 to 5 in order", () => {
  assertEquals(keys(evidenceGrades), ["E0", "E1", "E2", "E3", "E4", "E5"]);
  assertEquals(
    Object.values(evidenceGrades).map((g) => g.values.gradeRank),
    [0, 1, 2, 3, 4, 5],
  );
  for (const g of Object.values(evidenceGrades)) assert((g.values.definition?.value ?? "").length > 20, `${g.iri} is defined`);
});

proves(
  ["0021-ifqs FR-008"],
  "the crosswalk is mapping statements: each row has a standard, a clause, a relation SSSOM has and requirements that exist, and the standards the specification is held to are there",
  () => {
    const rows = crosswalk(IFQS);
    const known = requirementsOf(IFQS);
    for (const r of rows) {
      assert(["closeMatch", "broadMatch", "narrowMatch"].includes(r.relation), `${r.standard}: ${r.relation}`);
      assert(r.requirements.length > 0 && r.requirements.every((q) => known.has(q)), `${r.standard}: ${r.requirements.join(",")}`);
    }
    const text = rows.map((r) => `${r.standard} ${r.clause}`).join("\n");
    const needed = [
      "ISO 9001:2015",
      "7.5",
      "8.5",
      "9.1",
      "10.2",
      "ISO 13485:2016",
      "7.3.6",
      "7.3.10",
      "8.5.2",
      "21 CFR Part 820",
      "IEC 62304",
      "clause 9",
      "Computer Software Assurance",
      "ISO/IEC 25010",
      "ISO/IEC/IEEE 29119-3",
      "ISO/IEC 27001:2022",
      "SOC 2",
      "NIST SP 800-53",
    ];
    for (const n of needed) assert(text.includes(n), n);
  },
);

proves(
  ["0021-ifqs FR-010"],
  "the quality system names the controls of NIST SP 800-53 Rev. 5 it satisfies by their OSCAL identifiers",
  () => {
    const line = IFQS.split("\n").find((l) => l.startsWith("- **FR-010**")) ?? "";
    assert(line.includes("Controls: ca-2, ca-5, ca-7, sa-11, si-2."));
  },
);

test("the outcomes are those of 0008-test-evidence with not_run added, each written as the record writes it", () => {
  assertEquals(
    Object.values(testOutcomes).map((o) => o.values.outcomeWord),
    [...OUTCOMES, "not_run"],
  );
  assertEquals(keys(testOutcomes), ["Pass", "Fail", "Skip", "Todo", "Cancelled", "NotRun"]);
});

test("a proof is fresh, due or stale, in the words of 0007-grc", () => {
  const words: readonly FreshnessStatus[] = ["fresh", "due", "stale"];
  assertEquals(
    Object.values(freshnessStates).map((s) => s.values.label.value),
    [...words],
  );
});

test("a nonconformance is open or closed and a CAPA is open, verified, then closed", () => {
  assertEquals(keys(nonconformanceStates), ["NonconformanceOpen", "NonconformanceClosed"]);
  assertEquals(keys(capaStates), ["CapaOpen", "CapaVerified", "CapaClosed"]);
  assertEquals(Capa.fields.verifiedByTest.cardinality, "one");
  assertEquals(Capa.fields.approvedBy.cardinality, "optional");
});

test("a quality objective has a metric, a target, a unit, an error budget and a window, and review debt a number counted at a revision", () => {
  for (const f of ["metricName", "targetValue", "targetUnit", "errorBudget", "budgetWindow"] as const)
    assertEquals(QualityObjective.fields[f].cardinality, "one");
  assertEquals(ReviewDebt.fields.debtValue.cardinality, "one");
  assertEquals(ReviewDebt.fields.measuredAtRevision.cardinality, "one");
});

test("the tiers are 0, 1 and 2, and a rendering is for the public, an assessor or the harness's own people", () => {
  assertEquals(keys(qualityTiers), ["Tier0", "Tier1", "Tier2"]);
  assertEquals(
    Object.values(qualityTiers).map((t) => t.values.tierNumber),
    [0, 1, 2],
  );
  assertEquals(keys(audiences), ["Public", "Assessor", "Internal"]);
});

proves(
  ["0018-standards-first FR-003"],
  "every class of IFQS's vocabulary, and the class of every code list, has an individual saying its basis",
  () => {
    const classIris = classes.map((c) => c.iri).sort();
    const vocabularyClasses = Object.values(ifqs)
      .filter((t) => classes.some((c) => c.iri === t.iri))
      .map((t) => t.iri)
      .sort();
    assertEquals(vocabularyClasses, classIris);
    assertEquals(terms.map((t) => t.values.termIri).sort(), classIris);
    const known = new Set(Object.values(bases).map((b) => b.iri));
    for (const t of terms) assert(known.has(t.values.basis.iri), `${t.iri} has a basis`);
  },
);

proves(
  ["0018-standards-first FR-004"],
  "an unaligned class carries its justification, the standards examined, and the day it was added; a class with a standard names its term by IRI",
  () => {
    for (const t of terms) {
      if (t.values.basis.iri === bases.Unaligned.iri) {
        assert((t.values.justification ?? "").length > 40, `${t.iri} says what was examined`);
        assertEquals(t.values.addedOn, "2026-11-17");
      } else {
        assert((t.values.standardTerm ?? "").startsWith("http"), `${t.iri} names its standard's term by IRI`);
      }
    }
    assertEquals(
      terms.filter((t) => t.values.basis.iri === bases.Unaligned.iri).map((t) => t.values.termIri),
      [ifqs.QualityObjective.iri, ifqs.ReviewDebt.iri],
    );
  },
);

test("the ontology states no subject twice and breaks no rule of the kernel", () => {
  assertEquals(validate(file.individuals), []);
  assertEquals(files.length, 1);
  assertEquals(new Set(file.individuals.map((i) => i.iri)).size, file.individuals.length);
  assert(properties.length > 40);
});

test("the specifications of IFQS and Trust name only terms the ontology defines", () => {
  const defined = new Set([
    ...keys(ifqs),
    ...[evidenceGrades, testOutcomes, freshnessStates, nonconformanceStates, capaStates, qualityTiers, audiences].flatMap(keys),
  ]);
  for (const spec of [IFQS, TRUST]) {
    const named = [...spec.matchAll(/`ifqs:([A-Za-z][A-Za-z0-9_]*)`/g)].map((m) => m[1] ?? "");
    assert(named.length > 5);
    assertEquals(
      named.filter((n) => !defined.has(n)),
      [],
    );
  }
});
