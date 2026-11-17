# Feature Specification: Trust

**Spec ID:** 0022-trust
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** Trust is how the Intellectual Frontiers Quality System (`0021-ifqs`) shows itself to people who did not run it: a public Trust page, and an assessor pack for a person who has to check the evidence, both generated from the same evidence (the `quality` branch of `0021-ifqs` FR-016), redacted for the audience that reads them, with failures shown and every figure checkable offline. It states evidence, never a verdict: it does not say that a harness conforms to a standard, only what was proved, at what grade, when and how it is checked. Its terms are in the `ifqs:` ontology (`commons/ontology/ifqs/`), and the requirements below are Planned: they are specified first, and what is not built is marked so in the enforcement register.

## The Trust page

- **FR-001**: A Trust page MUST be generated, never written by hand, from the evidence of a harness (the files of the `quality` branch and the index derived from them, 0021-ifqs FR-016 and FR-019) and its specifications, and the generator's `--check` MUST fail where the page differs from what the evidence makes.
- **FR-002**: The page MUST show, for the revision it was made at, each requirement with its grade (`ifqs:EvidenceGrade`), its freshness (`ifqs:FreshnessState`) and the day and run of its last proof, the review debt (`ifqs:ReviewDebt`), each objective with its target and the error budget that remains (`ifqs:QualityObjective`), and the count of `not_run` cases beside the counts of passed and failed.
- **FR-003**: The page MUST show failures: each failed case, each open nonconformance with its age and each open CAPA MUST be listed before any success, and the page MUST NOT drop, hide or reorder a failure to improve a figure.
- **FR-004**: The page MUST state its scope (the harness, the revision, the day it was generated and the span of evidence it covers) and what it does not cover, and MUST NOT state that a harness conforms to, is certified to or complies with a standard, a regulation or a control.
- **FR-005**: WHEN the evidence a page was made from is older than its harness's cadence for it (0007-grc FR-011), the page MUST say that it is stale and by how long.
- **FR-006**: The page MUST be published with the documentation site (0011-documentation) of the harness it describes, for a harness whose source is public.

## Audiences and redaction

- **FR-007**: Each rendering of evidence MUST be made for one audience (`ifqs:Audience`): `ifqs:Public` (the page; a figure, an identifier, a grade and a failure's requirement and reason), `ifqs:Assessor` (the pack of FR-010) or `ifqs:Internal` (the harness's own console).
- **FR-008**: A rendering for `ifqs:Public` MUST leave out what 0006-signals FR-006 redacts, the names of people, customers and hosts, the paths and names of private repositories and any value a failure message holds beyond its requirement and reason, and MUST say how many values it redacted, so that a redaction is never silent.
- **FR-009**: Redaction MUST be deterministic and MUST NOT change a figure: the same evidence and the same audience MUST give the same bytes, and a count, a grade or a digest of a rendering for a narrower audience MUST equal the same figure of a wider one.

## The assessor pack

- **FR-010**: An assessor pack (`ifqs:AssessorPack`) MUST be a self-contained bundle for one revision and one span of time: the evidence files of that span with their chain (0021-ifqs FR-017), the notes that link them to commits, the specifications at the tested revisions, the traceability matrix, the OSCAL assessment results of the runs (0008-test-evidence FR-008), the ledger and the signatures with the public keys that verify them, and a manifest giving each file's SHA-256 and media type.
- **FR-011**: A pack MUST give an assessor what the page leaves out for the public (full failure messages, run files and signed envelopes) with only secrets and personal data redacted (FR-008, FR-009), and MUST be marked with its audience and the redactions it made.
- **FR-012**: The page and the pack of a revision MUST be made from the same evidence in one run, so that a figure of the page equals the same figure computed from the pack, and a test MUST compare them.
- **FR-013**: A pack MUST be offered as a download of a file (a DCAT distribution, 0019-mizan-integrations FR-018), with its SHA-256 beside it.

## Offline verification

- **FR-014**: A person MUST be able to verify a pack with no network and no account: the command MUST check the manifest's digests, the hash chain of the evidence files, the signature of each signed envelope against the keys in the pack, that each note names a file the pack holds, and that the figures of the pack's summary equal the figures computed from its files, and MUST name the first thing that fails.
- **FR-015**: A verification that cannot check part of the pack (a key that is not in the pack, a file the manifest lists and the pack lacks) MUST report that part as `not_run` with the reason, and MUST NOT report the pack as verified.
- **FR-016**: The verifier MUST be small, typed TypeScript that runs on Bun and Node 26 with no dependency, and MUST be included in the pack so that the pack can check itself.

## What a pack cannot redact

- **FR-017**: A file kept on the `quality` branch MUST NOT be changed to redact it for a pack, because its digest is in a chain: a pack MUST refuse a kept file that still holds a secret, naming it, so that its source is fixed and kept again, and MUST name in its manifest the personal data (an e-mail address) that a kept file retains; the files a pack makes itself MUST be redacted and the redactions counted (FR-011).
- **FR-018**: The public page MUST name an open nonconformance by its identifier only; the text of its requirement MUST appear only on the Assessor and Internal pages.

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
- Everything below is Planned: nothing is generated yet, and each requirement's row in the enforcement register says what is not built.
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
