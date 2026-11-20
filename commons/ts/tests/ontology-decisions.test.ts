/**
 * The Decision records of the terms kept unaligned by the owner's decision of 2026-11-17 (issue #10), across the four ontologies (commons 0018-standards-first FR-005):
 * six terms each have an `mz:Decision` that names them, the audit record of each points to it, the individuals reach the Turtle, and the standards rules find no
 * decision missing or overdue on any day. Pure functions over the typed ontologies and the generated files; no network and no program.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { termRecordsOf } from "../mizan/check.ts";
import { termFindings } from "@intellectual-frontiers/mizan/standards";
import * as ifccm from "@intellectual-frontiers/ontology/ifccm";
import * as ifqs from "@intellectual-frontiers/ontology/ifqs";
import * as mizan from "@intellectual-frontiers/ontology/mizan";

const GENERATED = resolve(dirname(fromFileUrl(import.meta.url)), "../../generated");

/** The six terms the owner decided to keep unaligned, by the IRI of each. */
const KEPT: readonly string[] = [
  mizan.mz.RungKind.iri,
  ifccm.ifccm.Capability.iri,
  ifccm.ifccm.GitManagerKind.iri,
  ifccm.ifccm.GitCapability.iri,
  ifqs.ifqs.QualityObjective.iri,
  ifqs.ifqs.ReviewDebt.iri,
];

const text = (name: string): string => readFileSync(resolve(GENERATED, name), "utf8").replace(/\r\n/g, "\n");

proves(
  ["0018-standards-first FR-005"],
  "six unaligned terms are kept so by the owner's decision of 2026-11-17: each has a Decision naming it, the record points to it, and no day makes one missing or overdue",
  () => {
    const terms = [...mizan.terms, ...ifccm.terms, ...ifqs.terms];
    const decisions = [...mizan.decisions, ...ifccm.decisions, ...ifqs.decisions];
    assertEquals(decisions.length, 6);
    for (const iri of KEPT) {
      const t = terms.find((x) => x.values.termIri === iri);
      assert(t !== undefined, `${iri} has an audit record`);
      const d = decisions.find((x) => x.values.decisionOf.iri === t.iri);
      assert(d !== undefined, `${iri} has a Decision that names its record`);
      assertEquals(t.values.decision?.iri, d.iri);
      assertEquals(d.values.decidedOn, "2026-11-17");
      assertEquals(d.values.record, "owner decision of 2026-11-17 in issue #10: keep the term unaligned; reviewed again by 2027-02-15");
      assertEquals(t.values.basis.iri, mizan.bases.Unaligned.iri);
    }
    // the rules of the standards, on the records of the six: nothing missing and nothing overdue, however late the day
    const kept = termRecordsOf(terms).filter((r) => KEPT.includes(r.iri));
    assertEquals(kept.length, 6);
    for (const day of ["2026-11-17", "2027-02-16", "2030-01-01"]) assertEquals(termFindings(kept, day), []);
  },
);

proves(
  ["0018-standards-first FR-005"],
  "the Decisions of the six terms are individuals of the generated Turtle, each with its day and its record",
  () => {
    const files = [
      ["mizan.auto.ttl", 1],
      ["ifccm.auto.ttl", 3],
      ["ifqs.auto.ttl", 2],
    ] as const;
    let total = 0;
    for (const [name, count] of files) {
      const ttl = text(name);
      const found = ttl.match(/^mzid:decision-[A-Za-z]+-[A-Za-z]+ a mz:Decision ;$/gm) ?? [];
      assertEquals(found.length, count, name);
      total += found.length;
      assertEquals((ttl.match(/mz:decidedOn "2026-11-17"/g) ?? []).length, count, name);
    }
    assertEquals(total, 6);
  },
);
