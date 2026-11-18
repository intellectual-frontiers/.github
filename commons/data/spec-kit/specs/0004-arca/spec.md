# Feature Specification: Arca, the party model

**Spec ID:** 0004-arca
**Status:** Draft
**Owner:** if
**Domain:** data

**Input:** Arca is IFC data's set of typical data models, and its party model is the first: the people and organizations a business deals with, how they relate, what roles they play, how they are identified and how they are reached. Most business software needs this structure whoever its customers are. Arca is a governance domain (0003-governance), written in terms of the business and naming no database: its concepts and code lists, what each means, which of its data is personal, how sensitive it is, who answers for it, what requirement it serves and how it is found. It is the first domain that the logical and the physical layers are made from, and the model that tests them against what the library made before this one.

## The domain

- **FR-001**: Arca's party model MUST be a governance domain named `arcaParty`, kept in `models/arca/` and written with the public surface of governance alone (0001-layers FR-004), and MUST be given as a `Result` (the domain or its errors), never by throwing, so that a project holds it to the same rules as its own.
- **FR-002**: The domain MUST have the concepts `party`, `person`, `organization`, `partyRole`, `partyRelation`, `partyIdentifier`, `electronicContact` and `postalAddress`, and the code lists `partyKind`, `partyRoleKind`, `partyRelationKind`, `partyIdentifierKind`, `contactMedium` and `addressPurpose`, each with the attributes and relationships that the model it replaces gave its tables and columns, in business terms.
- **FR-003**: A person and an organization MUST each be identified by their relationship of cardinality one to a party, which they specialize; every other concept MUST be identified by an attribute of its own named for it (`partyRoleId`).
- **FR-004**: Every element of the domain MUST have a definition, and `lint` with the library's vocabularies MUST find nothing in it: Arca is a model that holds itself to its own vocabularies.

## What is true of the data

- **FR-005**: Each attribute that holds personal data MUST say so with a category of DPV-PD that exists (`Name`, `BirthDate`, `Identifier`, `Contact`, `PhysicalAddress`, `Country`) and what it is held for, and each concept that holds personal data MUST be classified confidential.
- **FR-006**: The four reference code lists (`partyKind`, `partyRoleKind`, `partyRelationKind`, `partyIdentifierKind`) MUST carry the codes that the model it replaces loaded as reference data, each with its label and what it means, and MUST be open, so that a business adds its own; `contactMedium` and `addressPurpose` MUST be closed, with their codes.
- **FR-007**: The domain MUST be audited with removal by marking (who made, changed and removed each record, and when), and MUST say who answers for it.
- **FR-008**: The business structure of the model MUST be said as governance and not as tables: a party holds one identifier of a kind (`quality.unique`), the two parties of a relation differ (`partiesDiffer`, `quality.differs`), a contact point is by default not primary (`quality.default`), and each way the data is usually found is a `usage.lookup`.
- **FR-009**: Every concept MUST cite the requirements of this specification that it serves, and every citation in the domain MUST name a requirement that exists in this library's specifications, so that the way from a requirement to the model, and back, is whole.

- **FR-010**: Every name in the domain MUST be lower camel case, as a TypeScript identifier (0005-naming FR-001), and the names the model it replaces gave its tables and columns MUST be what the logical and the physical schema write from them in snake case (`givenName` as `given_name`), which a test holds.

## Out of scope

- A view over the model (the people in use, with their names) and the routines the model it replaces had: a view is a logical construct and a routine a feature of a database, built by later specifications.
- Indexes, the names of constraints and the types of columns: they are chosen by the layers below, from what this domain says.
- Other models of Arca (products, orders): each is a domain of its own, later.
- Data Vault: not part of this library.

## Edge cases

- A person with no party: not possible, the relationship has cardinality one and identifies, per FR-003.
- An address with no `region` or `line_2`: optional attributes, per FR-002.
- Two identifiers of one kind for a party: refused by the uniqueness the domain says, per FR-008.
- A relation from a party to itself: refused by the rule `partiesDiffer`, per FR-008.
- A business that adds a role of its own, `partner`: the code list is open, per FR-006.
- A medium `fax`: not allowed, the code list is closed, per FR-006.
- A citation of a requirement this library does not have: found by the test that holds citations to the specifications, per FR-009.

## Assumptions

- The model it replaces is the party model of `commons/ts/data/arca/` (commons 0009-sql-aide FR-047); this one is written afresh from its documentation, in governance terms, and is not copied.
- The purposes named for personal data and the classification are Arca's own statements for a model that has none to carry over; a business that uses it states its own.
- Arca keeps its own name, `arca`, as the owner role of the domain.

## Open questions

- **OQ-1**: Where a view over the model (FR-002 of 0001-layers) is written, since a model imports governance alone.

## Key entities

- **Party**, **Person**, **Organization** - who the business deals with, and what is true of a person or an organization only.
- **Party role**, **Party relation**, **Party identifier** - what a party does, how parties are related, how a party is identified by others.
- **Electronic contact**, **Postal address** - how a party is reached.
- **Reference code lists** - the kinds the business names, which it may extend.

## Success criteria

- **SC-001**: The party model is one typed value that says what the business means by a party, holds itself to every vocabulary the library has, and is the single source the logical and the physical schema are made from.
- **SC-002**: Every table and column of the model it replaces is accounted for, as an element of this domain or as a convention of a layer below.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
