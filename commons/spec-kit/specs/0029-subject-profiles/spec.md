# Feature Specification: Subject profiles

**Spec ID:** 0029-subject-profiles
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** What a specification must say depends on what it specifies. A library is proved by its tests; a service is proved by its contract, its tests of that contract and its service level objectives; an application by its user journeys and its accessibility; a business-to-business offering by how tenants are kept apart and what the provider promises and records; a business-to-business-to-consumer one by who the three actors are and what each may see of the others. Mizan states these as profiles, typed data in its ontology: a subject kind (library, service, application, integration or platform, aligned with the kinds of work of 0026-works-versioning) and an optional audience model (business to business, business to business to consumer), each with the sections a specification of it has, the form of its proofs and the standards it rests on. A specification declares its kind and its audience in its head, and a first check reports the sections its profile asks for that it lacks, as warnings held by a baseline that only shrinks. A specification that declares nothing is a specification of a library and is asked for nothing more, so that nothing changes for what exists. Mizan names standards and laws only: no company, customer or product.

## Subject kinds

- **FR-001**: Mizan's ontology MUST hold the kinds of subject as individuals of the code list `mz:SubjectKind`: `mz:LibrarySubject`, `mz:ServiceSubject` (a headless programming interface or event interface), `mz:ApplicationSubject` (a user interface), `mz:IntegrationSubject` and `mz:PlatformSubject`, each with the `mz:workKind` it is released as, the sections its profile requires (`mz:requiresSection`), its requirement templates (`mz:requirementTemplate`), the form of its proofs (`mz:proofForm`) and the standards it rests on (`mz:profileStandard`); the key of a kind is its label, in lower case; a library is released as the work kind `ifr:Library` and each of the others as `ifr:Software` (0026-works-versioning FR-004).
- **FR-002**: A specification MAY declare the kind of its subject in its head with `**Subject:** <kind>` (`library`, `service`, `application`, `integration` or `platform`, read without regard to case, the first such line counting), the kind is `library` where it declares none, and IF the kind it declares is not one of the five, THEN the check MUST report `mizan/profile-unknown`.
- **FR-003**: A profile MUST give, for its kind, the sections a specification has (a heading of level two or three), at least one requirement template for each section it asks for, in the EARS patterns of 0003-mizan FR-013, and the form of the proof, so that a requirement of the kind is written and proved the same way in every harness.

## The profiles of the kinds

- **FR-004**: The profile of a library (`mz:LibrarySubject`) MUST ask for no section beyond the format of 0003-mizan, and its proof MUST be the `verify` of the library (0027-commons-libraries): its requirements are proved by tests that cite them.
- **FR-005**: The profile of a service (`mz:ServiceSubject`) MUST ask for four sections: `Contract` (an OpenAPI Description of version 3.1 for a request and response interface, an AsyncAPI document for an event interface, and a JSON Schema for each message, each linked to the terms of the typed ontology the message carries), `Contract tests` (a test of each operation or message against the contract, which proves the requirement that names it), `Service level objectives` (each stated as an OpenTelemetry metric with its objective and its window) and `Quality attributes` (the characteristics of ISO/IEC 25010 that matter to the service, each mapped to the proof that holds it).
- **FR-006**: The profile of an application (`mz:ApplicationSubject`) MUST ask for three sections: `User journeys` (each journey a Gherkin scenario that cites the requirements it exercises), `Accessibility` (the requirements of the Web Content Accessibility Guidelines 2.2 at the conformance level the application claims, each proved by an automated check, with a `review` row in the register for what a check cannot prove) and `Design system` (the design system the application conforms to, and the proof that it does).
- **FR-007**: The profile of an integration (`mz:IntegrationSubject`) MUST ask for two sections, `Contract` and `Contract tests`, as a service does; the profile of a platform (`mz:PlatformSubject`) MUST ask for three, `Contract` (the interfaces and the extension points that others build on), `Contract tests` and `Service level objectives`. These two profiles are the first version, to be extended when the first subject of each kind is specified (OQ-1).

## Audience models

- **FR-008**: Mizan's ontology MUST hold the audience models as individuals of the code list `mz:AudienceModel`: `mz:BusinessToBusiness` (key `b2b`) and `mz:BusinessToBusinessToConsumer` (key `b2b2c`), each with the sections it requires, its requirement templates, the form of its proofs, the standards it rests on and the laws it cites (`mz:profileAuthority`); a specification MAY declare its audience in its head with `**Audience:** b2b` or `**Audience:** b2b2c`, and where it declares none it is asked for nothing of an audience.
- **FR-009**: The profile of a business-to-business subject MUST ask for five sections: `Tenant isolation` (what one tenant can never see or change of another's, proved by a test that tries), `Service level agreements` (what is promised to a tenant and what is owed where it is not kept), `Audit trail` (what is recorded of each action, by whom, kept how long), `Data processing` (what personal and tenant data is processed, where and under whose instruction) and `Security controls` (the controls of SOC 2, ISO/IEC 27001 and NIST SP 800-53 that the subject implements, as 0007-grc states controls and their evidence).
- **FR-010**: The profile of a business-to-business-to-consumer subject MUST ask for the five sections of a business-to-business subject and three more: `Actor roles` (the operator, the partner or tenant and the end user, each with the scenarios in Gherkin that say what the role does and may not do), `Consumer privacy and consent` (what an end user consents to and how it is recorded and withdrawn, citing the laws that apply as `mz:Authority` individuals, the General Data Protection Regulation and the California Consumer Privacy Act among them) and `Data boundaries` (what a partner sees of its end users and what an end user sees of the partner, and what neither sees).

## The check

- **FR-011**: The check MUST report each section that the profile of a specification's kind and audience requires and that the specification lacks as `mizan/profile-section-missing`, once for each specification and section, as a warning held by the baseline of 0003-mizan FR-015; a section is present where the specification has a heading of level two or three that begins with that name, in any case.
- **FR-012**: A specification that declares no kind and no audience MUST have no finding of this check, so that a harness whose specifications declare nothing sees no change; the check MUST run at L1 and above and MUST NOT run at L0 (0028-conformance-levels FR-009).
- **FR-013**: The profiles MUST cite standards and laws only, by the name and edition the issuer gives, and MUST mark `(to verify)` a name or an edition that was not checked; a profile MUST NOT name a company, a customer or a product.
- **FR-014**: The ontology MUST hold the General Data Protection Regulation (Regulation (EU) 2016/679) and the California Consumer Privacy Act (California Civil Code section 1798.100 and following) as `mz:Authority` individuals with their jurisdictions, so that a requirement cites them with `Authority:` as 0018-standards-first FR-015 asks for a law.

## Acceptance scenarios

1. **Given** a specification that declares `**Subject:** service` and holds a `Contract` section only, **When** the check runs, **Then** it reports `Contract tests`, `Service level objectives` and `Quality attributes` as missing sections, per FR-005 and FR-011.
2. **Given** a specification that declares nothing, **When** the check runs, **Then** it has no finding of this check, per FR-002 and FR-012.
3. **Given** a specification that declares `**Subject:** application` and `**Audience:** b2b2c`, **When** the check runs, **Then** it asks for the three sections of an application, the five of a business-to-business subject and the three of a business-to-business-to-consumer one, per FR-006, FR-009, FR-010 and FR-011.
4. **Given** `**Subject:** gadget`, **When** the check runs, **Then** it reports `mizan/profile-unknown` naming the kind, per FR-002.
5. **Given** a baseline that holds a missing section and a specification that now has it, **When** the check runs, **Then** the line is stale and the check fails until it is deleted, per FR-011.

## Out of scope

- The levels a subject is held to: 0028-conformance-levels.
- What a particular service or application does: its own specification says so.
- Checking that a contract is valid OpenAPI, AsyncAPI or JSON Schema, that a journey passes or that a page is accessible: the proof of each requirement is its own test (FR-003); this check reads headings only.

## Edge cases

- A specification with `**Subject:** Service` in another case: read as `service`, per FR-002.
- A specification that declares a kind twice: the first is read, per FR-002.
- A heading `### Contract tests` at level three: present, per FR-011.
- A heading that only contains the name in a longer title, such as `## Contract tests of the billing queue`: present, per FR-011.
- A specification whose profile section exists only as a sentence in a list: missing, per FR-011.
- A library at L0: the check does not run, per FR-012.
- A harness that declares a kind of its own: `mizan/profile-unknown`; the five kinds are the ontology's, per FR-001 and FR-002.
- A specification that declares `**Audience:** consumer`: `mizan/profile-unknown` names the audience, per FR-008.

## Assumptions

- The five kinds are the ones the work of Intellectual Frontiers needs today; a kind is added to the ontology, with its profile, when a subject needs one.
- A heading is how a person finds a section: the check reads headings and never the text under them.

## Open questions

- **OQ-1**: What a profile asks of an integration and of a platform beyond a contract and its tests, to be settled when the first of each is specified.
- **OQ-2**: Whether a missing section of a subject at L3 should fail in the gate phase of 0020-ifccm and not only warn, to be settled when the first service is specified.

## Key entities

- **Subject kind** - library, service, application, integration or platform: what a specification specifies.
- **Audience model** - business to business, or business to business to consumer: who the subject is offered to.
- **Profile** - the sections, the requirement templates, the form of proof and the standards of a kind or an audience.

## Success criteria

- **SC-001**: A specification that declares `service` and lacks the profile's sections is told so by the check, and one that has them is not.
- **SC-002**: A harness whose specifications declare nothing has the same findings as before the profiles existed.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
