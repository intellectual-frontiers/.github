# Feature Specification: Trust

**Spec ID:** 0022-trust
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** Trust is how the Intellectual Frontiers Quality System (`0021-ifqs`) shows itself to people who did not run it: a public Trust page, and an assessor pack for a person who has to check the evidence, both generated from the same evidence (the `quality` branch of `0021-ifqs` FR-016), redacted for the audience that reads them, with failures shown and every figure checkable offline. It states evidence, never a verdict: it does not say that a harness conforms to a standard, only what was proved, at what grade, when and how it is checked. Its terms are in the `ifqs:` ontology (`commons/ontology/ifqs/`), and the requirements below are Planned: they are specified first, and what is not built is marked so in the enforcement register.

## The Trust page

- **FR-001**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-052), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-002**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-053), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-003**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-054), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-004**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-055), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-005**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-056), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-006**: The page MUST be published with the documentation site (0011-documentation) of the harness it describes, for a harness whose source is public.

## Audiences and redaction

- **FR-007**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-057), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-008**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-058), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-009**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-059), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.

## The assessor pack

- **FR-010**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-060), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-011**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-061), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-012**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-062), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-013**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-063), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.

## Offline verification

- **FR-014**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-064), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-015**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-065), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-016**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-066), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.

## What a pack cannot redact

- **FR-017**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-067), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.
- **FR-018**: The Trust page and the assessor pack requirement MUST be taken from the library `quality` (`@intellectual-frontiers/quality`, quality 0001-quality-evidence FR-068), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT be specified here.

## Acceptance scenarios

1. **Given** the evidence of a revision with one open nonconformance, **When** the page is generated, **Then** the nonconformance is listed before any success, per FR-002 and FR-003.
2. **Given** a failed case whose message holds a customer's name, **When** the public page is generated, **Then** the name is left out and the count of redactions says so, per FR-008.
3. **Given** the page and the pack generated from the same evidence, **When** their figures are compared, **Then** each equals the other, per FR-009 and FR-012.
4. **Given** a pack with one evidence file changed, **When** it is verified offline, **Then** the file is named and the pack is not verified, per FR-014.
5. **Given** a pack that lacks a public key for one envelope, **When** it is verified, **Then** that envelope is `not_run` with the reason and the pack is not reported verified, per FR-015.
6. **Given** a page whose text says the harness complies with a standard, **When** the generator runs, **Then** it refuses, per FR-004.

## Out of scope

- How evidence is made, graded and kept: `0021-ifqs`.
- Any statement of conformity, certification or audit opinion: an assessor's, never the page's.
- An authenticated view for a harness's own people: a harness's console (0021-ifqs FR-037).

## Edge cases

- A harness with no evidence yet: the page says so, with every requirement at grade `E0`, per FR-001 and FR-002.
- A failure that closed yesterday: still shown, as closed with its CAPA, per FR-003.
- A failure whose message holds an address: left out of the public page and counted as redacted, per FR-008.
- A page edited by hand: the generator's check fails, per FR-001.
- Two runs of the generator on the same evidence: the same bytes, per FR-009.
- A pack missing a key: unverified for that signature, `not_run`, per FR-015.
- A pack with a file changed by one byte: the verification names that file, per FR-014.
- A page whose evidence is two cadences old: says it is stale, per FR-005.
- A figure that differs between the page and the pack: the test of FR-012 fails, per FR-012.
- A page that says "compliant": refused by the generator, per FR-004.

## Assumptions

- The first Trust page is generated for commons (this public repository) and no other; the pack and the page of a private harness are generated by the same code and published, if at all, by its owner.
- The page and the assessor pack are generated from the quality branch (`quality trust`, `quality pack`, `quality verify-pack`); what is not built, the console of 0021-ifqs FR-037 and the publication of FR-006, is said in each requirement's row of the enforcement register.
- A pack's signatures are those of 0008-test-evidence FR-011 (DSSE envelopes of in-toto statements); the keys a harness trusts are the harness's to publish.
- The page is one self-contained file, with a JSON beside it generated from the same evidence, never one file for each requirement (owner decision of 2026-11-17, issue #10; as built).
- This specification stays Draft until its first page is published (owner decision of 2026-11-17, issue #10); it becomes Active with that page.

## Open questions

- **OQ-2**: Whether the pack is a directory with a manifest or an archive (0019-mizan-integrations FR-018 describes the distribution either way).

## Key entities

- **Trust page** - the public rendering of the evidence, generated.
- **Assessor pack** - the verifiable bundle of evidence for one revision and span.
- **Audience** - who a rendering is for, and so what is redacted from it.
- **Manifest** - the list of the pack's files with their digests.

## Success criteria

- **SC-001**: A person with the pack and no network verifies every figure of the page or is told which part could not be checked.
- **SC-002**: The page shows every open failure of its revision.
- **SC-003**: The page never says more than the evidence does.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
