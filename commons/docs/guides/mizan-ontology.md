# The typed ontology

One ontology, stated once, as algebraically typed TypeScript on commons' RDF kernel. Every RDF form (Turtle, N-Triples, JSON-LD) is written from it, and none is a source.

## What "algebraically typed" gives us **Built**

- **Branded IRIs.** An IRI is checked once and carries its type; a reference to an individual of the wrong class does not compile.
- **Typed vocabularies.** RDF, RDFS, OWL, XSD, SKOS, Dublin Core terms, PROV-O and SHACL are typed; a term not listed does not compile.
- **Class schemas.** A class and its fields; each field is a property with a range, and the individual's type is derived from the schema. A missing required field fails `tsc`.
- **Code lists as unions.** The individuals of a code list are a TypeScript union, so code branches on a type the ontology owns.
- **Findings as values.** What a type cannot state (an unsafe integer, a malformed string) is a finding with one plain sentence.
- **Deterministic output.** Canonical Turtle and N-Triples, and a SHA-256 over the whole ontology, so any change of fact changes the hash.

## Using the ontology from your harness

1. **Keep your own namespace.** State your terms with `vocabulary(NS, {...})` and class schemas on commons' RDF kernel; import the shared classes (`Rung`, `OntologyTerm`, `Decision` and the rest) from `commons/ontology/mizan/` and do not copy them.
2. **Take standards by import, not by hand.** Write a manifest (a TypeScript module) naming the pinned standard, its versioned URL, the slice you need and where the generated module goes; run `bun commons/mizan/src/integrations/host/import.ts MANIFEST.ts`. The generated module is the standard's own terms, typed; commons' packaging ontology takes `schema:SoftwareApplication` this way.
3. **Record the basis of each of your terms** in an audit file of `mz:OntologyTerm` individuals (see `commons/ontology/audit/packaging.ts`): `specializes` or `maps` with the standard's term and relation, or `unaligned` with the candidates you examined. A mapping to a term your import does not hold does not compile.
4. **Run the checks.** `commons/libraries/src/check.ts` fails for a term with no record, holds the pending Decisions in a baseline that only shrinks, and fails a Decision past its 90 days.
5. **Publish the generated forms, not the TypeScript,** to anyone outside your stack: Turtle with `owl:versionIRI`, SHACL shapes, JSON Schema, SKOS, SQL code-list tables, SSSOM mappings and the HTML view (`commons/generated/mizan-ontology.auto.html` is the example).

## The four published ontologies **Built**

Each ontology has its own namespace and a typed record of the basis of every class and code list (`mz:OntologyTerm`). Each is published through the same function (`publish-ontology.ts`) as canonical Turtle, RDF/XML, OWL 2 functional syntax, SHACL shapes, JSON Schema, SKOS code lists, SQL tables, SSSOM mappings and an HTML view, all under `commons/generated/` and checked for staleness by `--check`.

| Prefix | What it describes | What it stands on |
| --- | --- | --- |
| `mz` | The IF Spec Profile: `Rung` and `RungKind`, `Standard`, `Authority`, `Jurisdiction`, `Decision`, `OntologyTerm`, the bases and the status words. | `dcterms:Standard` for a standard; the rest is `unaligned` with Decisions due. |
| `ifccm` | Change control: capability, change request and its kinds and states, change, configuration item, baseline, harness declaration, regulated domains, the stages of the trace chain, the functions of authority, the Git host kinds. | PROV-O (change as activity, configuration item as entity, baseline as collection) and OSLC Change Management (`oslc_cm:ChangeRequest`); refers to `mz:Rung`, `mz:Decision` and `mz:Authority` without copying them. |
| `ifqs` | The quality system: test run, case and outcome (with `not_run`), evidence and its grade E0 to E5, evidence file, freshness, nonconformance, CAPA, objective, review debt, tiers, audiences, assessor pack. | PROV-O (a CAPA is a `prov:Plan`), DCAT (the assessor pack is a `dcat:Dataset`) and SKOS for the code lists; extends the test record of `0008-test-evidence`. OpenTelemetry, CTRF, SARIF and OSCAL are forms a record is written or rendered in, not RDF terms. |

A standard that publishes no IRI for a term is named in the term's justification, never given an invented IRI.

## Validated by tools other than ours **Built**

The generated files are read by independent tools: rdflib parses the Turtle, pySHACL checks that the ontology conforms to the shapes made from its own schemas and rejects a broken individual, sssom-py parses the SSSOM, and a CI job reads the generated OWL with ROBOT (the OBO Foundry's ontology tool, pinned by version and SHA-256), converts it and reports its quality. Tests that need those Python tools skip where they are absent.

## Strengths and weaknesses, by who uses it

- **Inside a TypeScript stack.** **Strengths.** Compile-time errors for wrong facts. One language for ontology and code. Refactoring tools work. No YAML or JSON to drift. Agents read and write it fluently.
- **Outside TypeScript.** **Strengths.** Standard output (Turtle, JSON-LD) with standard IRIs, so regulators, auditors and other-language consumers see the standard's own terms.

| Weakness | Where it bites | How Mizan addresses it |
| --- | --- | --- |
| Guarantees depend on running `tsc` | Inside TypeScript | CI runs `tsc`; the ontology is decoded once on entry; runtime findings cover what a type cannot. |
| A typed vocabulary lists only terms someone uses | Inside | Intended: unused terms are not carried. The per-harness `vocabulary()` path is documented, and imports name their slice. |
| Compile cost of very large code lists | Inside | Split modules; measure compile time before an import lands (not yet measured). |
| No blank nodes or RDF lists in schema fields | Inside and outside | Imports report them as findings, never silently drop them; typed lists are added only when a real model needs them. |
| The kernel reads no RDF | Outside | Reading lives only in the integrations module; the kernel stays pure. |
| No SHACL shapes | Outside | The integrations module exports SHACL from class schemas, validated by an independent tool. |
| No reasoning, no SPARQL | Outside | A stated limit. We export; tests load the result into an independent store. |
| Code lists retyped elsewhere | Outside | Generated bindings: SQL code-list tables, JSON Schema, SKOS. |
| Authors who know Protégé, not TypeScript | Outside | They read the generated Turtle and the HTML view; changes go through a reviewed TypeScript module. |
| "No release" makes versions unclear to outsiders | Outside | Generated headers carry the commit, `source_sha256` and `owl:versionIRI`; an HTML view is published. |
