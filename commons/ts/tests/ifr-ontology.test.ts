/**
 * The ontology of Intellectual Frontiers Releases and the audit of its terms (commons 0026-works-versioning FR-001 to FR-006): the code lists hold the keys the specification names and
 * the one scheme each kind of work uses, every class and code-list class has a record of its basis, the specification names only terms the ontology defines, and every generated
 * form of the ontology exists and is what the ontology makes. Pure functions over the typed ontology and the text of the specification, and the generator's own output read from
 * disk; the one external reader (ROBOT, on Java) runs where `ROBOT_JAR` names it and is skipped, with its reason, where it does not.
 *
 * @module
 */
import { existsSync } from "node:fs";
import process from "node:process";
import { triplesOf, turtle, validate } from "@intellectual-frontiers/rdf";
import { readTextFileSync } from "../runtime/fs.ts";
import { dirname, fromFileUrl, resolve } from "../runtime/path.ts";
import * as proc from "../runtime/proc.ts";
import { assert, assertEquals, proves } from "../runtime/test.ts";
import { termRecordsOf } from "../mizan/check.ts";
import { wanted } from "../mizan/generate-ontology.ts";
import { authorityCitation, commonsAuthorities, mizanFindings, rulePlugins } from "../mizan/rules.ts";
import { readSpecTexts } from "../mizan/spec-files.ts";
import { specTermFindings } from "../mizan/spec-terms.ts";
import { basisMissing, termFindings } from "../mizan/standards.ts";
import { ifqs, qualityTiers } from "../../ontology/ifqs/mod.ts";
import {
  AUDITED_ON,
  CLASS_NAMES,
  classes,
  CODE_LIST_CLASSES,
  codeLists,
  decisions,
  file,
  files,
  ifr,
  IFR,
  impacts,
  properties,
  termNames,
  terms,
  versionSchemes,
  workKinds,
} from "../../ontology/ifr/mod.ts";
import { bases, MZ, mz } from "../../ontology/mizan/mod.ts";

const COMMONS = resolve(dirname(fromFileUrl(import.meta.url)), "..", "..");
const SPEC_KIT = resolve(COMMONS, "spec-kit");
const keys = (list: object): readonly string[] => Object.keys(list);
const iris = (list: readonly { readonly iri: string }[]): readonly string[] => list.map((i) => i.iri).sort();
const SLUG = "0026-works-versioning";

/** The pattern a scheme's versions match, as a regular expression. */
function patternOf(name: keyof typeof versionSchemes): RegExp {
  const p = versionSchemes[name].values.versionPattern;
  assert(p !== undefined, `${name} has a pattern`);
  return new RegExp(p);
}

proves(
  [`${SLUG} FR-001`],
  "the ontology is typed values under its own namespace, well formed, and every form the generator makes of it exists and is current",
  async () => {
    assertEquals(IFR.iri, "https://www.intellectualfrontiers.com/ontology/ifr#");
    assertEquals(IFR.prefix, "ifr");
    assert(IFR.iri !== MZ.iri);
    assertEquals(validate(file.individuals), []);
    assertEquals(files, [file]);
    const text = turtle({ prefixes: file.prefixes, triples: triplesOf(file.individuals) });
    assert(text.includes("ifr:Release"));
    assert(text.includes("rdfs:subClassOf schema:CreativeWork"));
    assert(text.includes("rdfs:subClassOf prov:Entity"));
    // every form the generator writes for `ifr` is on disk and is what the ontology makes
    const made = await wanted();
    const forms = [
      "ifr.auto.ttl",
      "ifr.auto.ofn",
      "ifr.auto.rdf",
      "ifr-shapes.auto.ttl",
      "ifr-schemas.auto.json",
      "ifr-code-lists.auto.skos.ttl",
      "ifr-code-lists.auto.sql",
      "ifr-mappings.auto.sssom.tsv",
      "ifr-ontology.auto.html",
    ];
    for (const f of forms) {
      const rel = `generated/${f}`;
      assert(made.has(rel), `the generator makes ${rel}`);
      assert(existsSync(resolve(COMMONS, rel)), `${rel} is on disk`);
      assertEquals(readTextFileSync(resolve(COMMONS, rel)).replaceAll("\r\n", "\n"), made.get(rel), rel);
    }
    // the catalog lists the ontology as a dataset
    assert((made.get("generated/mizan-catalog.auto.ttl") ?? "").includes("ontology/ifr"));
    // the specification names only terms of the ontology (and of the others it names), and one that is not defined is found
    const specs = readSpecTexts(SPEC_KIT).filter((s) => s.slug === SLUG);
    assertEquals(specs.length, 1);
    const known = {
      ifr: termNames,
      ifqs: new Set([...keys(ifqs), ...keys(qualityTiers)]),
      mz: new Set(keys(mz)),
    };
    assertEquals(
      specTermFindings(specs, known).map((f) => f.key),
      [],
    );
    assertEquals(
      specTermFindings([{ slug: "0001-x", spec: "Uses `ifr:Release` and `ifr:Nothing`." }], known).map((f) => f.key),
      ["mizan/spec-term-unknown specs/0001-x/spec.md ifr:Nothing"],
    );
    // the specification follows Mizan's rules for requirements, scenarios and authorities
    const rules = [...rulePlugins.filter((p) => p.id !== "mizan/authority-citation"), authorityCitation(commonsAuthorities)];
    assertEquals(
      mizanFindings(specs, rules).map((f) => f.key),
      [],
    );
    // every ifr: name the specification puts in code font is defined
    const named = new Set(specs.flatMap((s) => [...s.spec.matchAll(/`ifr:([A-Za-z]+)`/g)].map((m) => m[1] ?? "")));
    for (const n of named) assert(termNames.has(n), `ifr:${n} is named and not defined`);
  },
);

proves(
  [`${SLUG} FR-001`],
  "the generated OWL functional syntax is read by ROBOT without an error, where ROBOT and Java are present",
  async (t) => {
    const jar = process.env["ROBOT_JAR"];
    const java = proc.which("java");
    if (jar === undefined || !existsSync(jar) || java === undefined) {
      t.skip("ROBOT_JAR names no robot.jar, or Java is not installed (the CI runs ROBOT on every ontology)");
      return;
    }
    const o = await proc.run([java, "-jar", jar, "report", "--input", resolve(COMMONS, "generated", "ifr.auto.ofn"), "--fail-on", "ERROR"]);
    assertEquals(o.code, 0, o.stderr);
  },
);

proves(
  [`${SLUG} FR-002`],
  "every class and code-list class has one record of its basis, the audit's rules find nothing, and the classes of no standard are unaligned with what was examined",
  () => {
    const classIris = iris(classes);
    assertEquals(classIris, iris(CLASS_NAMES.map((n) => ifr[n])));
    assertEquals(terms.map((t) => t.values.termIri).sort(), classIris);
    assertEquals(
      basisMissing(
        classIris,
        terms.map((t) => t.values.termIri),
      ),
      [],
    );
    for (const name of CODE_LIST_CLASSES) assert(CLASS_NAMES.includes(name), `${name} is a code-list class with no class record`);
    assertEquals(new Set(CODE_LIST_CLASSES).size, 3);
    // within 90 days of the audit an unaligned term's decision is not overdue, and a term that rests on a standard names its term
    assertEquals(
      termFindings(termRecordsOf(terms), AUDITED_ON).filter((f) => f.rule !== "mizan/decision-missing"),
      [],
    );
    const unaligned = terms.filter((t) => t.values.basis.iri === bases.Unaligned.iri);
    assertEquals(unaligned.map((t) => t.values.termIri.slice(IFR.iri.length)).sort(), ["Citation", "Edition", "Retention", "Tombstone"]);
    for (const t of unaligned) {
      assertEquals(t.values.addedOn, AUDITED_ON);
      assert((t.values.justification ?? "").startsWith("No standard adopted yet. Examined: "), t.values.termIri);
    }
    // the decisions are not made here: they are pending
    assertEquals(decisions.length, 0);
    for (const t of terms) {
      assertEquals(t.values.addedOn === undefined, t.values.basis.iri !== bases.Unaligned.iri);
      assert(
        (t.values.definedBy ?? []).length === 1 && /^0026-works-versioning FR-\d{3}$/.test(t.values.definedBy?.[0] ?? ""),
        t.values.termIri,
      );
    }
    // what rests on a standard names its IRI: the levels of a work are schema.org's CreativeWork, a release and the records are PROV-O's entity, the code lists SKOS concepts
    const by = new Map(terms.map((t) => [t.values.termIri.slice(IFR.iri.length), t.values.standardTerm]));
    for (const n of ["Work", "Expression", "Manifestation"]) assertEquals(by.get(n), "https://schema.org/CreativeWork");
    for (const n of ["Release", "ReleaseRecord", "ApprovalRecord"]) assertEquals(by.get(n), "http://www.w3.org/ns/prov#Entity");
    for (const n of ["VersionScheme", "WorkKind", "Impact"]) assertEquals(by.get(n), "http://www.w3.org/2004/02/skos/core#Concept");
    assertEquals(by.get("ReleaseTag"), "https://git-scm.com/docs/git-tag");
  },
);

proves(
  [`${SLUG} FR-003`],
  "identity, state, rendition, version and release are different classes, joined by the properties the requirement names, and a rendition has no version",
  () => {
    const levels = ["Work", "Expression", "Manifestation", "Release", "Edition"] as const;
    assertEquals(new Set(levels.map((n) => ifr[n].iri)).size, 5);
    const prop = (name: keyof typeof ifr): { readonly domain: string | undefined; readonly range: string | undefined } => {
      const p = properties.find((x) => x.iri === ifr[name].iri);
      return { domain: p?.values.domain?.iri, range: p?.values.range?.iri };
    };
    assertEquals(prop("hasExpression"), { domain: ifr.Work.iri, range: ifr.Expression.iri });
    assertEquals(prop("hasRelease"), { domain: ifr.Work.iri, range: ifr.Release.iri });
    assertEquals(prop("hasRendition"), { domain: ifr.Expression.iri, range: ifr.Manifestation.iri });
    assertEquals(prop("realizes"), { domain: ifr.Release.iri, range: ifr.Expression.iri });
    assertEquals(prop("releaseOf"), { domain: ifr.Release.iri, range: ifr.Work.iri });
    assertEquals(prop("version").domain, ifr.Release.iri);
    // an edition is a release, and a rendition has a format and a printing and no version, no tag and no commit
    const edition = classes.find((c) => c.iri === ifr.Edition.iri);
    assertEquals(
      edition?.values.subClassOf?.map((c) => c.iri),
      [ifr.Release.iri],
    );
    const ofRendition = properties.filter((p) => p.values.domain?.iri === ifr.Manifestation.iri).map((p) => p.iri.slice(IFR.iri.length));
    assertEquals(ofRendition.sort(), ["printing", "renditionFormat"]);
    // identity: the slug, the IRI and the position belong to the work and to nothing else
    for (const n of ["slug", "workIri", "position"] as const) assertEquals(prop(n).domain, ifr.Work.iri);
    // the lineage of a release is its replacement and its revision, between releases
    for (const n of ["replaces", "isReplacedBy", "revisionOf"] as const)
      assertEquals(prop(n), { domain: ifr.Release.iri, range: ifr.Release.iri });
    // the evidence tier is the quality system's, not a second list
    assertEquals(prop("releasedOnTier"), { domain: ifr.Release.iri, range: ifqs.QualityTier.iri });
  },
);

proves([`${SLUG} FR-004`], "the three code lists have the keys the specification names, and each individual is of its class", () => {
  assertEquals(keys(versionSchemes), ["SemVer", "CommitDateEdition", "SnapshotDate", "IntegerRevision", "NoVersion"]);
  assertEquals(keys(workKinds), [
    "Software",
    "Library",
    "CommandLineInterface",
    "Ontology",
    "Schema",
    "Prose",
    "Data",
    "ControlledDocument",
    "Specification",
  ]);
  assertEquals(keys(impacts), ["Major", "Minor", "Patch"]);
  assertEquals([...keys(codeLists)].sort(), ["Impact", "VersionScheme", "WorkKind"]);
  for (const [name, list] of Object.entries(codeLists))
    for (const individual of Object.values(list) as readonly { readonly class: { readonly iri: string } }[])
      assert(individual.class.iri === ifr[name as keyof typeof codeLists].iri, name);
  // the impacts are ordered, and the greatest of them is the impact of a release
  assertEquals(
    Object.values(impacts).map((i) => i.values.impactRank),
    [3, 2, 1],
  );
  // every key is a term a specification may name
  for (const list of Object.values(codeLists)) for (const k of keys(list)) assert(termNames.has(k), k);
});

proves([`${SLUG} FR-005`], "each kind of work uses exactly one scheme, and only data carries a companion SemVer for its schema", () => {
  const scheme = Object.fromEntries(Object.entries(workKinds).map(([k, v]) => [k, v.values.usesScheme.iri.slice(IFR.iri.length)]));
  assertEquals(scheme, {
    Software: "SemVer",
    Library: "SemVer",
    CommandLineInterface: "SemVer",
    Ontology: "SemVer",
    Schema: "SemVer",
    Prose: "CommitDateEdition",
    Data: "SnapshotDate",
    ControlledDocument: "IntegerRevision",
    Specification: "NoVersion",
  });
  const companion = Object.entries(workKinds)
    .filter(([, v]) => v.values.companionScheme !== undefined)
    .map(([k, v]) => [k, v.values.companionScheme?.iri.slice(IFR.iri.length)]);
  assertEquals(companion, [["Data", "SemVer"]]);
  // the specification states the same table: its sentence of FR-005 names each kind with its scheme
  const spec = readSpecTexts(SPEC_KIT).find((s) => s.slug === SLUG)?.spec ?? "";
  const fr5 = spec.split("\n").find((l) => l.startsWith("- **FR-005**")) ?? "";
  for (const [kind, name] of Object.entries(scheme)) {
    assert(fr5.includes(`\`${kind}\``), `${kind} is in FR-005`);
    assert(fr5.includes(`\`${name}\``), `${name} is in FR-005`);
  }
  // every scheme is used by a kind
  assertEquals(new Set(Object.values(scheme)), new Set(keys(versionSchemes)));
});

proves([`${SLUG} FR-006`], "each scheme's pattern accepts the versions it should and rejects the ones it should not", () => {
  const semver = patternOf("SemVer");
  for (const v of [
    "0.0.0",
    "1.0.0",
    "0.4.0",
    "10.20.30",
    "1.0.0-rc.1",
    "1.0.0-alpha+001",
    "1.2.3+abc123def456",
    "1.0.0-0.3.7",
    "1.0.0+20130313144700",
  ])
    assert(semver.test(v), `${v} is a SemVer`);
  for (const v of ["1", "1.0", "01.0.0", "1.01.0", "1.0.01", "1.0.0-", "1.0.0-01", "v1.0.0", "1.0.0+", "1.0.0 "])
    assert(!semver.test(v), `${v} is not a SemVer`);
  // a commit-date edition is also a Semantic Version syntactically (2026.11.17 with a pre-release), so the kind of work decides the scheme and the pattern never does
  assert(semver.test("2026.11.17-1a2b3c4d"));
  const edition = patternOf("CommitDateEdition");
  for (const v of ["2026.11.17-1a2b3c4d", "1999.01.01-00000000"]) assert(edition.test(v), v);
  for (const v of [
    "2026.11.17",
    "2026-11-17-1a2b3c4d",
    "2026.11.17-1A2B3C4D",
    "2026.11.17-1a2b3c4",
    "2026.11.17-1a2b3c4de",
    "26.11.17-1a2b3c4d",
  ])
    assert(!edition.test(v), v);
  const snapshot = patternOf("SnapshotDate");
  for (const v of ["2026-11-17"]) assert(snapshot.test(v), v);
  for (const v of ["2026.11.17", "2026-1-17", "2026-11-17T00:00:00Z"]) assert(!snapshot.test(v), v);
  const revision = patternOf("IntegerRevision");
  for (const v of ["1", "7", "120"]) assert(revision.test(v), v);
  for (const v of ["0", "01", "1.0", "-1", ""]) assert(!revision.test(v), v);
  // no version has no pattern, and every scheme says how versions are ordered
  assertEquals(versionSchemes.NoVersion.values.versionPattern, undefined);
  for (const s of Object.values(versionSchemes)) {
    assert(s.values.precedenceRule.length > 0);
    assert(!(s.values.versionPattern ?? "").includes("\\"), "a pattern has no backslash, so that every generated form carries it as it is");
  }
  assert(versionSchemes.SemVer.values.precedenceRule.includes("build metadata ignored"));
});
