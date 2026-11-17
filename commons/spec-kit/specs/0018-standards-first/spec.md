# Feature Specification: Standards first

**Spec ID:** 0018-standards-first
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** Intellectual Frontiers does not invent terms, schemas or ontologies where an existing well-known, consensus, international or national standard names the thing, and gives special weight to United States federal, state and local law and standards, because most of what it makes is regulated by United States law. A term for which no standard exists is `unaligned`, which is drift to be justified, recorded and reduced, never hidden. The first domains are federal security (NIST and FedRAMP), FDA's Quality Management System Regulation (21 CFR Part 820, which incorporates ISO 13485) and 21 CFR Part 11; others are pulled up into commons as products need them.

## The order

- **FR-001**: A specification or an ontology MUST NOT coin a term, a schema or a vocabulary where a standard names it, and MUST take it, from the first of these that has it: law (a United States federal law or regulation, and a state or local law that applies); United States and NIST standards; ISO standards; broadly used vocabularies (schema.org, Dublin Core, SKOS, PROV, SPDX and their like); then state and local standards that are not law, where they do not conflict with the sources above them.
- **FR-002**: A term taken from law MUST keep the law's own wording as its label, carry the law's definition as its `skos:definition` and cite the law (FR-008), and MUST NOT be paraphrased; where laws differ by jurisdiction, each MUST be its own jurisdiction-qualified individual, never one merged coined term.

## The basis of a term

- **FR-003**: Every class, property, individual and code list of an ontology MUST carry a basis: `adopts` (it is the standard's own term, by its IRI), `specializes` (a subclass or subproperty of one), `maps` (it has a mapping, such as `skos:exactMatch`, to one) or `unaligned` (no standard names it). A term with no basis MUST fail to compile.
- **FR-004**: An `unaligned` term MUST carry a justification, the standards looked at and why none fits, and MUST be counted: the count of `unaligned` terms is the measure of drift, and the baseline of them only shrinks.
- **FR-005**: An `unaligned` term MUST be recorded by a `Decision`, an individual of the ontology that a harness MAY link to its own record of the decision. The Decision MUST exist within 90 days of the commit that adds the term; within the 90 days its absence is a finding in the baseline, and after it the check fails.

## Authority and standards as data

- **FR-006**: A standard MUST be a typed `Standard` of the ontology: its issuer, name, version, location, license (an SPDX identifier) and the SHA-256 of what was imported; a newer version of a standard than the pin MUST be a finding.
- **FR-007**: A specification MUST copy only what a standard's license permits: a standard that cannot be redistributed (an ISO standard) is cited by its identifier and clause, never copied.
- **FR-008**: A requirement that comes from law MUST cite its authority as typed data (an `Authority`: the title, part and section, for example 21 CFR Part 11 or 45 CFR 164.312).
- **FR-009**: A feature's `plan.md` MUST have a section, Standards considered, naming the standards looked at and the one chosen.

## Reach

- **FR-010**: The first domains are federal security (NIST publications, OSCAL and FedRAMP baselines), FDA's QMSR (21 CFR Part 820, incorporating ISO 13485:2016) and 21 CFR Part 11 (electronic records and signatures). A domain MUST be pulled up into commons when more than one harness should read the same facts.
- **FR-011**: Mizan's own formats MUST follow this order: requirements are worded in RFC 2119 keywords and EARS patterns, scenarios in Gherkin's Given, When, Then, mappings in SSSOM, provenance in PROV-O, catalogs in DCAT and licenses as SPDX identifiers.
- **FR-012**: The rules of this specification MUST be delivered as warnings with a baseline that only shrinks (a new finding fails, and a line of the baseline that no longer occurs fails), never as a first-day failure of what a harness already holds.

## Out of scope

- Importing a standard into TypeScript and exporting ours: `0019-mizan-integrations`.
- Which law applies to a given product: the product's own specifications cite their authority.

## Edge cases

- A term for a medical device's complaint file: its wording and definition come from 21 CFR Part 820 as amended by the QMSR and ISO 13485:2016 is cited and not copied, per FR-001, FR-002 and FR-007.
- A state privacy law whose definition differs from a federal one: two individuals, each qualified by its jurisdiction, per FR-002.
- A class that specializes `schema:SoftwareApplication`: basis `specializes`, per FR-003.
- A term added to the packaging ontology with no record in its audit: the check fails, whatever the baseline holds, per FR-003.
- A new `unaligned` term with no Decision on day 30: a finding in the baseline, not a failure, per FR-005.
- The same term on day 91: the check fails, per FR-005.
- A newer NIST publication than the pinned version: a stale-pin finding, per FR-006.
- A specification of a feature whose `plan.md` names no standards: a warning and a baseline entry, per FR-009 and FR-012.

## Assumptions

- The FDA's QSR (21 CFR Part 820) has been replaced by the QMSR, which incorporates ISO 13485:2016 by reference and took effect on 2 February 2026; Phase 0 of issue #10 verifies this, and the Authority records are written from the verified text.
- A requirement checked by the `plan.md` rule is one of a feature built with Spec Kit's plan template.

## Open questions

- **OQ-1**: Which OSCAL models and version the proof register maps to (0003-mizan FR-011), settled in Phase 0 of issue #10.
- **OQ-2**: Whether the Decision's 90 days are counted from the commit's date or from the date it first reaches `main`.

## Key entities

- **Standard** - a pinned, licensed, hashed standard.
- **Authority** - a typed citation of a law or regulation.
- **Jurisdiction** - the federal, state or local body whose law it is.
- **Basis** - how a term relates to a standard: adopts, specializes, maps or is unaligned.
- **Decision** - the record of why a term is `unaligned`.

## Success criteria

- **SC-001**: Every term of the ontology has a basis, and the count of `unaligned` terms is reported and never rises.
- **SC-002**: Every requirement that comes from law cites its authority.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
