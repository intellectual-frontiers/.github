# Feature Specification: RDF

**Spec ID:** 0001-rdf
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** RDF as algebraically typed values, in a package of its own that depends on nothing but Core: a harness states its ontology as TypeScript with branded IRIs, namespaces, typed vocabularies, class schemas and code lists, and every RDF form of it is written from that, the same bytes every time. The requirements are those that `commons 0012-ontology` made of the kernel's RDF (FR-001 to FR-007), moved here with the modules (commons 0032-libraries-by-concern FR-010); the ontology that commons states with it stays in `commons 0012-ontology`. It is generalized from `erga`'s ontology DSL (`erga 248-ontology-in-typescript`) and keeps none of its vocabularies.

## The RDF

- **FR-001**: RDF MUST give RDF as typed values: an IRI as a branded type made only by a check (`parseIri`: absolute, with a scheme, none of the characters an IRI may not hold in N-Triples) or from a namespace; a namespace as a typed value that pairs a prefix with its IRI and makes its terms; a named node branded with the classes its term is an individual of, so that a reference to an individual of one class is not accepted where another class is asked for; a blank node; a literal that is either a string in a language, its tag checked, or a lexical form with its datatype; and triples and quads of those.
- **FR-002**: RDF MUST give typed vocabularies of `rdf`, `rdfs`, `owl`, `xsd`, `skos`, `dcterms`, `prov` and `sh`, each listing only terms some user of commons states (a term not listed does not compile), and a way to make the typed vocabulary of any namespace from the local names of its terms and the class of each.
- **FR-003**: RDF MUST give class schemas: a class and its fields, each field a property, a range (a plain string, a plain string that is one of a list of words, whose union is the field's type, a string in a language, either, a boolean, an integer, or a reference to an individual of a class) and a cardinality (one, optional, many). The type of an individual's values MUST be derived from its schema and never written twice; an individual made by a schema MUST be a named node of the schema's class, usable wherever a reference to that class is asked for; and a required field left out, a value of the wrong range or a reference to an individual of another class MUST NOT compile. An individual's triples MUST be its `rdf:type` and then its fields in the schema's order, each field's values in the order given.
- **FR-004**: RDF MUST give the schemas an ontology states about itself (an `owl:Ontology`, an `owl:Class`, an `owl:ObjectProperty`, an `owl:DatatypeProperty`), a code list (individuals of one class made by its schema, keyed by their local names, whose keys' union is the type code branches on) and a SKOS concept scheme (its concepts keyed by their notations, whose union is the type of a notation).
- **FR-005**: RDF MUST check what a type cannot state (or what a run without the type checker lets through), as findings with one sentence each: an integer that is not a safe integer, a plain string not of the words its field's range lists, a subject stated by two individuals, and a namespace or vocabulary term whose IRI does not parse (thrown where the namespace is made, since a namespace is a constant of the code and a bad one is a fault of the code).
- **FR-006**: RDF MUST write N-Triples and N-Quads (each statement once, one a line, the lines in the order of their code points), Turtle in one canonical form (the comment lines given, then the prefixes given sorted by name, then the subjects sorted, each with its `rdf:type` first as `a` and its other predicates sorted, each predicate's objects sorted, one blank line between subjects, an integer and a boolean of their canonical form written bare, every other literal quoted with its escapes) and JSON-LD in its expanded form (nodes sorted by `@id`, properties and values sorted), so that the same statements give the same bytes whatever the order they were stated in.
- **FR-007**: RDF MUST NOT read Turtle or any other RDF syntax: what it writes is read by RDF tools, and a harness's own facts are TypeScript. Reading an outside ontology into TypeScript is the work of `commons 0019-mizan-integrations`, in the library `mizan`, never of RDF.

## The package

- **FR-008**: RDF MUST depend on Core alone, MUST name no host global, and MUST be published as compiled modules with their declarations as `@intellectual-frontiers/rdf` (commons 0032-libraries-by-concern FR-005), so that it runs on Bun, on Node 26 and in a browser, and its one entry MUST export every name its modules export.

## Acceptance scenarios

1. **Given** an IRI with a space in it, **When** `parseIri` reads it, **Then** it is refused with a sentence, per FR-001.
2. **Given** a vocabulary and a term it does not list, **When** the term is used, **Then** it does not compile, per FR-002.
3. **Given** a schema and an individual that leaves a required field out, **When** it is made, **Then** it does not compile, per FR-003.
4. **Given** the same statements in two orders, **When** they are written as Turtle, N-Triples and JSON-LD, **Then** the bytes are the same, per FR-006.
5. **Given** the package, **When** its names are listed, **Then** it exports no reader of any syntax, per FR-007.
6. **Given** the packed package installed under `node_modules`, **When** Node 26 and Bun import it, **Then** both give the same Turtle for the same statements, per FR-008.

## Out of scope

- Reading RDF syntaxes (the library `mizan`), the ontology of commons (`commons 0012-ontology`, its modules in `commons/ontology/`), SHACL shapes and the comparison of graphs with blank nodes.

## Edge cases

- A namespace whose IRI does not parse: thrown where it is made, per FR-005.
- An `order` of `1.5` in an integer field: named as not an integer, per FR-005.
- Statements stated twice: written once, per FR-006.

## Assumptions

- ECMAScript 2024 and the web standards are all that the code needs.

## Open questions

- None.

## Key entities

- **Iri** - a string made distinct by the one function that checks it.
- **Schema** - a class and its fields, from which an individual's type is derived.
- **Writer** - a function from statements to bytes that gives the same bytes for the same statements.

## Success criteria

- **SC-001**: A harness states its ontology as TypeScript and publishes every RDF form of it with this and nothing else.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
