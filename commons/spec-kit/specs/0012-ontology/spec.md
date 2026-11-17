# Feature Specification: The ontology in TypeScript

**Spec ID:** 0012-ontology
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Commons' ontology is stated once, as algebraically typed TypeScript, and every RDF form of it is written from that: terms are branded IRIs from typed vocabularies, classes and properties and individuals are typed values whose literals carry their datatype or language, a code list is a typed value whose keys are the union code branches on, and each file of the ontology is a TypeScript module. The compiler finds what a type can state (a required field left out, a value of the wrong range, a reference to an individual of another class); explicit rules find the rest. Turtle is no longer a source: it is an export, generated, carrying `.auto.` and the name of its generator, the same bytes every time. The generic part (IRIs, namespaces, terms, literals, triples, class schemas, code lists, the standard vocabularies and the writers) is in IFC TypeScript's kernel, so that any harness states its own ontology the same way; it is generalized from what `erga` (its ontology DSL, `erga 248-ontology-in-typescript`) and `stolos` (its PROV export) each wrote for themselves, and keeps none of their vocabularies. It exists so that a fact is checked as it is written, the tools read typed values instead of parsing text, and a second harness does not write a third RDF writer.

## The kernel's RDF

- **FR-001**: IFC TypeScript's kernel MUST give RDF as typed values (`commons/ts/kernel/rdf.ts` and the `rdf-*.ts` files it re-exports, held to the kernel's rules, commons 0005-typescript-runtime FR-002): an IRI as a branded type made only by a check (`parseIri`: absolute, with a scheme, none of the characters an IRI may not hold in N-Triples) or from a namespace; a namespace as a typed value that pairs a prefix with its IRI and makes its terms; a named node branded with the classes its term is an individual of, so that a reference to an individual of one class is not accepted where another class is asked for; a blank node; a literal that is either a string in a language, its tag checked, or a lexical form with its datatype; and triples and quads of those.
- **FR-002**: The kernel MUST give typed vocabularies of `rdf`, `rdfs`, `owl`, `xsd`, `skos`, `dcterms`, `prov` and `sh`, each listing only terms some user of commons states (a term not listed does not compile), and a way to make the typed vocabulary of any namespace from the local names of its terms and the class of each.
- **FR-003**: The kernel MUST give class schemas: a class and its fields, each field a property, a range (a plain string, a plain string that is one of a list of words, whose union is the field's type, a string in a language, either, a boolean, an integer, or a reference to an individual of a class) and a cardinality (one, optional, many). The type of an individual's values MUST be derived from its schema and never written twice; an individual made by a schema MUST be a named node of the schema's class, usable wherever a reference to that class is asked for; and a required field left out, a value of the wrong range or a reference to an individual of another class MUST NOT compile. An individual's triples MUST be its `rdf:type` and then its fields in the schema's order, each field's values in the order given.
- **FR-004**: The kernel MUST give the schemas an ontology states about itself (an `owl:Ontology`, an `owl:Class`, an `owl:ObjectProperty`, an `owl:DatatypeProperty`), a code list (individuals of one class made by its schema, keyed by their local names, whose keys' union is the type code branches on) and a SKOS concept scheme (its concepts keyed by their notations, whose union is the type of a notation).
- **FR-005**: The kernel MUST check what a type cannot state (or what a run without the type checker lets through), as findings with one sentence each: an integer that is not a safe integer, a plain string not of the words its field's range lists, a subject stated by two individuals, and a namespace or vocabulary term whose IRI does not parse (thrown where the namespace is made, since a namespace is a constant of the code and a bad one is a fault of the code).
- **FR-006**: The kernel MUST write N-Triples and N-Quads (each statement once, one a line, the lines in the order of their code points), Turtle in one canonical form (the comment lines given, then the prefixes given sorted by name, then the subjects sorted, each with its `rdf:type` first as `a` and its other predicates sorted, each predicate's objects sorted, one blank line between subjects, an integer and a boolean of their canonical form written bare, every other literal quoted with its escapes) and JSON-LD in its expanded form (nodes sorted by `@id`, properties and values sorted), so that the same statements give the same bytes whatever the order they were stated in.
- **FR-007**: The kernel MUST NOT read Turtle or any other RDF syntax: what it writes is read by RDF tools, and a harness's own facts are TypeScript. Reading an outside ontology into TypeScript is the work of `0019-mizan-integrations`, in `commons/ts/mizan/integrations/`, never of the kernel.

## Commons' ontology

- **FR-008**: Commons' ontology MUST be TypeScript modules under `commons/ontology/` that import nothing but the kernel's RDF and one another, one module for each file of facts, each exporting its individuals and the file they make (its name, its prefixes and its individuals), and a `mod.ts` for each ontology that lists its files. No `.ttl` file MAY be under `commons/ontology/`: Turtle is not a source.
- **FR-009**: Every IRI of the ontology MUST be made from a namespace or a typed vocabulary (FR-001, FR-002), never written as free text; every class and property MUST be stated by the schemas of FR-004, every individual by a class schema of its ontology's vocabulary module, and every code list (the packaging operations, support statuses, assurances, manager kinds and tiers) by a code list of FR-004, whose keys the tools map to their words in a table the compiler holds complete.
- **FR-010**: The type checker MUST refuse an ontology module with a required field left out, a value of the wrong range or a reference to an individual of another class: `tsc` (TypeScript 7) over the generator, which imports the ontology, fails, and the tests check it on copies of the ontology. What a type cannot state (the kernel's checks of FR-005, an empty text, an identifier used twice, a reference to an individual no module states, and the rules of 0002-packaging FR-004 to FR-008, 0002-packaging FR-014 and 0004-rules FR-002) MUST be found by the generator before it writes anything, as 0002-packaging FR-010 says.
- **FR-011**: The generator MUST write the packaging ontology as `commons/generated/packaging.auto.ttl`, in the canonical Turtle of FR-006, beginning with lines that say it is generated, by `commons/tools/generate-packaging.ts`, from which modules, and not to be edited; and its `--check` MUST fail where the file is not what the modules make (0001-software-supply-chain FR-002). Turtle is committed because it is the form an RDF tool and a person reviewing a change of meaning read; N-Triples and JSON-LD are not committed, since the kernel writes them from the same values for whoever needs them.
- **FR-012**: The `source_sha256` the generated tables carry (0002-packaging FR-011) MUST be the SHA-256 of the canonical N-Triples (FR-006) of the whole ontology, so that a change of a fact changes it and a change of layout or comments does not.
- **FR-013**: A file of the ontology converted from Turtle MUST keep every triple: the graph its module makes MUST be the graph of the Turtle it was taken from (a literal with no datatype being an `xsd:string`), compared triple by triple when it is converted.
- **FR-014**: Every class, property, individual and code list of an ontology MUST carry a basis, `adopts`, `specializes`, `maps` or `unaligned` (`0018-standards-first` FR-003), and a term with none MUST fail to compile.

## Out of scope

- Reading RDF, querying it and comparing graphs with blank nodes (a harness that needs them uses an RDF store of its own, as erga uses Oxigraph).
- SHACL shapes made from the class schemas, and OWL axioms beyond what the ontology states.
- Showing the ontology on the documentation site (commons 0011-documentation).
- The vocabularies of a harness or a company (erga's `ifo:`, `ifid:` and the rest): they stay in their own repositories.

## Edge cases

- A family whose `usesManager` names a value that is not a manager (a platform): the type checker fails, per FR-003 and FR-010.
- A pin whose `version` field is left out: the type checker fails; one whose version is an empty text: the generator names it, per FR-010.
- A family that names, by its IRI, a manager no module states: it compiles, and the generator names it, per FR-010.
- An `order` of `1.5`: the kernel names it as not an integer, per FR-005.
- A rule whose set is `installers`: the type checker fails, as the set is one of a list of words; run without the checker, the kernel and the generator name it, per FR-003, FR-005 and FR-010.
- Two modules that state the same subject: the kernel names it, per FR-005.
- `parseIri("relative/path")` or an IRI holding a space: an error, never an IRI, per FR-001.
- The same individuals stated in another order: the same Turtle, N-Triples and JSON-LD bytes, per FR-006.
- A string with a quote, a backslash, a new line or a control character: escaped in Turtle and N-Triples, per FR-006.
- A `.ttl` file added under `commons/ontology/`: a test names it, per FR-008.
- `packaging.auto.ttl` edited by hand: `--check` fails, per FR-011.
- A module's comments changed and no fact: `source_sha256` and every generated file stay the same, per FR-012.

## Assumptions

- TypeScript 7 checks the generator, the ontology and the kernel with one set of options, so they agree on the kernel's types.
- The ontology is small enough (a few thousand triples) that it is held in memory and written at once.

## Open questions

- **OQ-1**: Whether the class schemas should also give SHACL shapes, as erga's do, once a harness validates data that does not come from TypeScript.
- **OQ-2**: Whether other harnesses' ontologies (erga's) move onto the kernel's RDF, and which of erga's DSL (blank nodes as values, lists) the kernel then gives.

## Key entities

- **IRI** - an absolute IRI, branded once checked.
- **Namespace** - a prefix and its IRI, which makes the terms of a vocabulary.
- **Named node** - a term, branded with the classes it is an individual of.
- **Class schema** - a class and its fields, from which an individual's type and triples come.
- **Individual** - a named node with its values, made by a class schema.
- **Code list** - the individuals of one class keyed by local name, a union type.
- **Ontology file** - a module's name, prefixes and individuals.

## Success criteria

- **SC-001**: A reference to an individual of the wrong class, a missing field or a misspelt term fails `tsc`.
- **SC-002**: The generator reads no Turtle, and every generated table is what it was before the conversion except for the source hash and the name of the source in its first line.
- **SC-003**: Commons has no RDF writer outside the kernel.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Confidential: no sensitive fact written as a literal
