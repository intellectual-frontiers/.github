/**
 * The ontology of Intellectual Frontiers Capabilities Configuration Management (commons 0020-ifccm) and the audit of its terms (0018-standards-first FR-003, FR-004): the code
 * lists have the keys the specification names, every class and every code list's class has a record of its basis, what is adopted names its standard's IRI, and the
 * specification's own crosswalk and control citations are well formed and name requirements that exist. Pure functions over the typed ontology and the text of the
 * specification; nothing runs, and no network is used.
 *
 * @module
 */
import { validate } from "@intellectual-frontiers/rdf";
import { readTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves, test } from "@intellectual-frontiers/test";
import { bases } from "../../ontology/mizan/mod.ts";
import {
  authorityFunctions,
  changeRequestKinds,
  changeRequestStates,
  classes,
  ChangeRequest,
  Baseline,
  Change,
  enforcementPhases,
  file,
  files,
  HarnessDeclaration,
  gitCapabilities,
  gitManagerKinds,
  ifccm,
  issueReferenceKinds,
  properties,
  regulatedDomains,
  terms,
  traceStages,
} from "../../ontology/ifccm/mod.ts";
import { cfr11, cfr820 } from "../../ontology/mizan/mod.ts";
import * as ifccmModule from "../../ontology/ifccm/mod.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const SPEC = readTextFileSync(resolve(HERE, "..", "..", "spec-kit", "specs", "0020-ifccm", "spec.md"));

const keys = (list: object): string[] => Object.keys(list);

/** The rows of the specification's crosswalk table: standard, clause, relation and the requirements it names. */
function crosswalk(
  spec: string,
): readonly { readonly standard: string; readonly clause: string; readonly relation: string; readonly requirements: readonly string[] }[] {
  const rows = spec
    .split("\n")
    .filter((l) => l.startsWith("|") && !l.startsWith("| Standard") && !l.startsWith("| ---"))
    .map((l) => l.split("|").map((c) => c.trim()));
  return rows.map((c) => ({
    standard: c[1] ?? "",
    clause: c[2] ?? "",
    relation: c[3] ?? "",
    requirements: (c[4] ?? "").split(",").map((r) => r.trim()),
  }));
}

/** The requirement numbers a specification states. */
const requirementsOf = (spec: string): ReadonlySet<string> =>
  new Set([...spec.matchAll(/^- \*\*(FR-[0-9]{3})\*\*/gm)].map((m) => m[1] ?? ""));

proves(
  ["0020-ifccm FR-014"],
  "the chain is six stages in order, from the issue to the quality run, each with the annotation that already links it",
  () => {
    assertEquals(keys(traceStages), ["StageIssue", "StageRequirement", "StageTerm", "StageCode", "StageTest", "StageRun"]);
    assertEquals(
      Object.values(traceStages).map((s) => s.values.stageNumber),
      [1, 2, 3, 4, 5, 6],
    );
    assertEquals(traceStages.StageCode.values.anchor, "// Spec: NNNN-slug FR-nnn");
    assertEquals(traceStages.StageTerm.values.anchor, "mz:definedBy");
    assertEquals(traceStages.StageTest.values.anchor, "proves([...])");
  },
);

proves(
  ["0020-ifccm FR-018"],
  "authority is four functions, each carried by one instrument: a specification, a Decision, a check, an issue",
  () => {
    assertEquals(keys(authorityFunctions), ["Binds", "Authorizes", "Verifies", "Plans"]);
    assertEquals(
      Object.values(authorityFunctions).map((f) => f.values.instrument),
      ["specification", "Decision", "check", "issue"],
    );
    assertEquals(authorityFunctions.Plans.values.definition?.value.includes("authorizes nothing"), true);
  },
);

proves(
  ["0020-ifccm FR-021"],
  "a change request has exactly one kind, one state and one host, and the kinds and states are the words the specification names",
  () => {
    assertEquals(keys(changeRequestKinds), ["CapabilityRequest", "Problem"]);
    assertEquals(keys(changeRequestStates), ["Open", "Closed"]);
    for (const f of ["requestKind", "requestState", "hostedOn"] as const) assertEquals(ChangeRequest.fields[f].cardinality, "one");
  },
);

proves(
  ["0020-ifccm FR-022"],
  "a change names the change requests it implements and its revisions, a baseline its items and the Decision that establishes it",
  () => {
    assertEquals(Change.fields.implementsRequest.cardinality, "many");
    assertEquals(Change.fields.revision.cardinality, "many");
    assertEquals(Baseline.fields.includesItem.cardinality, "many");
    assertEquals(Baseline.fields.establishedBy.cardinality, "optional");
    const domain = (p: keyof typeof ifccm): string | undefined => properties.find((x) => x.iri === ifccm[p].iri)?.values.range?.iri;
    assertEquals(domain("implementsRequest"), ifccm.ChangeRequest.iri);
    assertEquals(domain("includesItem"), ifccm.ConfigurationItem.iri);
    assertEquals(domain("establishedBy"), "https://www.intellectualfrontiers.com/ontology/mizan#Decision");
  },
);

proves(
  ["0020-ifccm FR-023"],
  "a change request specializes OSLC's ChangeRequest, a change is a prov:Activity, a configuration item a prov:Entity and a baseline a prov:Collection, and each has its record",
  () => {
    const recordOf = (c: keyof typeof ifccm) => terms.find((t) => t.values.termIri === ifccm[c].iri);
    const expected: readonly (readonly [keyof typeof ifccm, string])[] = [
      ["ChangeRequest", "http://open-services.net/ns/cm#ChangeRequest"],
      ["Change", "http://www.w3.org/ns/prov#Activity"],
      ["ConfigurationItem", "http://www.w3.org/ns/prov#Entity"],
      ["Baseline", "http://www.w3.org/ns/prov#Collection"],
    ];
    for (const [local, iri] of expected) {
      const r = recordOf(local);
      assertEquals(r?.values.basis.iri, bases.Specializes.iri);
      assertEquals(r?.values.standardTerm, iri);
      assertEquals(r?.values.mappingRelation, "subClassOf");
      const cls = classes.find((c) => c.iri === ifccm[local].iri);
      assertEquals(
        cls?.values.subClassOf?.map((s) => s.iri),
        [iri],
      );
    }
  },
);

proves(
  ["0020-ifccm FR-024"],
  "the capability names the five Configuration Management controls of NIST SP 800-53 Rev. 5 by their OSCAL identifiers, in the requirement and in the crosswalk",
  () => {
    const line = SPEC.split("\n").find((l) => l.startsWith("- **FR-024**")) ?? "";
    assert(line.includes("Controls: cm-2, cm-3, cm-4, cm-5, cm-9."));
    const row = crosswalk(SPEC).find((r) => r.standard.startsWith("NIST SP 800-53"));
    assertEquals(row?.clause, "cm-2, cm-3, cm-4, cm-5, cm-9");
    assert(keys(ifccm).includes("satisfiesControl"));
  },
);

proves(
  ["0020-ifccm FR-025"],
  "the crosswalk is mapping statements, not terms: each row names a standard, a clause, a relation SSSOM has and requirements that exist, and the standards the specification must cover are there",
  () => {
    const rows = crosswalk(SPEC);
    const known = requirementsOf(SPEC);
    for (const r of rows) {
      assert(["closeMatch", "broadMatch", "narrowMatch"].includes(r.relation), `${r.standard}: ${r.relation}`);
      assert(r.requirements.length > 0 && r.requirements.every((q) => known.has(q)), `${r.standard}: ${r.requirements.join(",")}`);
    }
    const text = rows.map((r) => `${r.standard} ${r.clause}`).join("\n");
    for (const needed of [
      "ISO 13485:2016",
      "7.3.9",
      "ISO 9001:2015",
      "8.5.6",
      "IEC 62304",
      "clause 8",
      "21 CFR Part 820",
      "SOC 2",
      "CC8.1",
    ])
      assert(text.includes(needed), needed);
    // a clause is a mapping, never a term of the ontology
    assertEquals(
      keys(ifccm).filter((k) => /7\.3\.9|8\.5\.6|CC8/.test(k)),
      [],
    );
  },
);

proves(["0020-ifccm FR-027"], "the host is one of GitHub, GitLab or plain Git, and no typed term carries a host's own word", () => {
  const names = [
    ...keys(ifccm),
    ...keys(changeRequestKinds),
    ...keys(changeRequestStates),
    ...keys(issueReferenceKinds),
    ...keys(traceStages),
  ];
  assertEquals(
    names.filter((n) => /pull|merge|PR$|MR$/.test(n)),
    [],
  );
  // the one list of host kinds is IFCCM's own, and a change request is hosted on one of its kinds
  assertEquals(keys(gitManagerKinds), ["Github", "Gitlab", "Git"]);
  assertEquals(
    Object.keys(ifccmModule).filter((k) => /host.?kind/i.test(k)),
    [],
  );
  assertEquals(ifccmModule.ChangeRequest.fields.hostedOn.cardinality, "one");
  const ttl = readTextFileSync(resolve(HERE, "..", "..", "generated", "ifccm.auto.ttl")).replaceAll("\r\n", "\n");
  assertEquals(ttl.includes("GitHostKind"), false);
  assertEquals(/ifccm:hostedOn[\s\S]*?rdfs:range ifccm:GitManagerKind/.test(ttl), true);
});

test("a harness's declaration states its regulated domains and, optionally, the day it declares production", () => {
  assertEquals(keys(regulatedDomains), ["FederalSecurity", "DeviceQuality", "ElectronicRecords", "DeviceSoftware", "TrustServices"]);
  assertEquals(HarnessDeclaration.fields.regulatedDomain.cardinality, "many");
  assertEquals(HarnessDeclaration.fields.productionDeclaredOn.cardinality, "optional");
  assertEquals(
    regulatedDomains.DeviceQuality.values.regulatedBy?.map((a) => a.iri),
    [cfr820.iri],
  );
  assertEquals(
    regulatedDomains.ElectronicRecords.values.regulatedBy?.map((a) => a.iri),
    [cfr11.iri],
  );
  assertEquals(keys(enforcementPhases), ["Warn", "Gate"]);
  assertEquals(keys(issueReferenceKinds), ["Refs", "Closes"]);
});

test("a capability names the rungs it touches as rungs of Mizan's ladder", () => {
  const touches = properties.find((p) => p.iri === ifccm.touchesRung.iri);
  assertEquals(touches?.values.domain?.iri, ifccm.Capability.iri);
  assertEquals(touches?.values.range?.iri, "https://www.intellectualfrontiers.com/ontology/mizan#Rung");
});

proves(
  ["0018-standards-first FR-003"],
  "every class of IFCCM's vocabulary, and the class of every code list, has an individual saying its basis",
  () => {
    const classIris = classes.map((c) => c.iri).sort();
    const vocabularyClasses = Object.values(ifccm)
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
  "an unaligned class carries its justification, the standards examined, and the day it was added; a class with a standard names its term",
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
      [ifccm.Capability.iri, ifccm.GitManagerKind.iri, ifccm.GitCapability.iri],
    );
  },
);

test("the ontology states no subject twice and breaks no rule of the kernel", () => {
  assertEquals(validate(file.individuals), []);
  assertEquals(files.length, 1);
  assertEquals(new Set(file.individuals.map((i) => i.iri)).size, file.individuals.length);
});

test("a specification of IFCCM names only terms the ontology defines", () => {
  const defined = new Set([
    ...keys(ifccm),
    ...[
      changeRequestKinds,
      changeRequestStates,
      issueReferenceKinds,
      enforcementPhases,
      regulatedDomains,
      traceStages,
      authorityFunctions,
      gitCapabilities,
      gitManagerKinds,
    ].flatMap(keys),
  ]);
  const named = [...SPEC.matchAll(/`ifccm:([A-Za-z][A-Za-z0-9_]*)`/g)].map((m) => m[1] ?? "");
  assert(named.length > 20);
  assertEquals(
    named.filter((n) => !defined.has(n)),
    [],
  );
});

test("the abbreviation CCM is never written alone, because it is also the Cloud Security Alliance's Cloud Controls Matrix", () => {
  const ontology = readTextFileSync(resolve(HERE, "..", "..", "ontology", "ifccm", "ifccm.ts"));
  for (const text of [SPEC, ontology]) assertEquals(text.replaceAll('"CCM"', "").match(/\bCCM\b/g), null);
});
