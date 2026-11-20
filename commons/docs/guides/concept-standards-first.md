# Standards first

Intellectual Frontiers does not invent terms, schemas or ontologies where an existing well-known, consensus, international or national standard names the thing ([commons 0018-standards-first](../../spec-kit/specs/0018-standards-first/spec.md)). Because most of what it makes is regulated by United States law, federal, state and local law and standards have special weight; the first domains are federal security (NIST and FedRAMP), FDA's Quality Management System Regulation (21 CFR Part 820, which incorporates ISO 13485) and 21 CFR Part 11.

**In practice.** A term for which no standard exists is marked `unaligned`: it is drift to be justified, recorded and reduced, never hidden. The libraries use the standards' own names: OpenTelemetry for signals, OSCAL for control and evidence documents, FHIR and X12 in the integrations, RFC numbers in the formats and crypto libraries, and each says in its specification which standard a requirement follows.

**Where to see it.** [The ontology library](../../ontology/) holds the vocabularies and the standards they are taken from, stated as typed TypeScript; its Turtle is generated. See [commons 0012-ontology](../../spec-kit/specs/0012-ontology/spec.md).
