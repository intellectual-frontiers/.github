# Feature Specification: GRC engineering

**Spec ID:** 0007-grc
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The primitives of governance, risk and compliance as code, pulled up into IFC TypeScript (0005-typescript-runtime) from what `erga` and `stolos` each built in their own shape: `erga` around OSCAL, with control maps, a hash-chained evidence ledger and dispositions; `stolos` around the Secure Controls Framework as its hub, with typed controls, waivers, freshness, drift, change-impact gates and OCSF, OSCAL, CycloneDX and in-toto output. One kernel of types and pure functions (catalogs, controls, verdicts, findings, waivers, evidence, assessment and the standard formats) and a thin runtime of signers, Git readers and loaders, so that each harness keeps only its connectors, its data and its catalogs' content. Every check run is a span and every finding a log record (0006-signals), so compliance is observed the way everything else is.

## Catalogs, controls and verdicts (kernel)

- **FR-001**: GRC engineering MUST take catalogs and mappings from the library `grc` (`@intellectual-frontiers/grc`, grc FR-001), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-002**: GRC engineering MUST take controls from the library `grc` (`@intellectual-frontiers/grc`, grc FR-002), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-003**: GRC engineering MUST take verdicts and severities from the library `grc` (`@intellectual-frontiers/grc`, grc FR-003), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-004**: GRC engineering MUST take findings from the library `grc` (`@intellectual-frontiers/grc`, grc FR-004), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-005**: GRC engineering MUST take waivers from the library `grc` (`@intellectual-frontiers/grc`, grc FR-005), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## Evidence (kernel)

- **FR-006**: GRC engineering MUST take the canonical form and the digests of evidence from the library `grc` (`@intellectual-frontiers/grc`, grc FR-006), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-007**: GRC engineering MUST take the evidence ledger from the library `grc` (`@intellectual-frontiers/grc`, grc FR-007), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-008**: GRC engineering MUST take manifests from the library `grc` (`@intellectual-frontiers/grc`, grc FR-008), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-009**: GRC engineering MUST take evidence bundles from the library `grc` (`@intellectual-frontiers/grc`, grc FR-009), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## Assessment (kernel)

- **FR-010**: GRC engineering MUST take coverage from the library `grc` (`@intellectual-frontiers/grc`, grc FR-010), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-011**: GRC engineering MUST take freshness from the library `grc` (`@intellectual-frontiers/grc`, grc FR-011), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-012**: GRC engineering MUST take drift from the library `grc` (`@intellectual-frontiers/grc`, grc FR-012), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-013**: GRC engineering MUST take the change-impact gate from the library `grc` (`@intellectual-frontiers/grc`, grc FR-013), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-014**: GRC engineering MUST take the risk register from the library `grc` (`@intellectual-frontiers/grc`, grc FR-014), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-015**: GRC engineering MUST take the requirement trace from the library `grc` (`@intellectual-frontiers/grc`, grc FR-015), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## Formats (kernel)

- **FR-016**: GRC engineering MUST take findings as OCSF from the library `grc` (`@intellectual-frontiers/grc`, grc FR-016), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-017**: GRC engineering MUST take assessments as OSCAL from the library `grc` (`@intellectual-frontiers/grc`, grc FR-017), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-018**: GRC engineering MUST take attestations from the library `grc` (`@intellectual-frontiers/grc`, grc FR-018), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## The host (runtime)

- **FR-019**: GRC engineering MUST take the run of a pack as signals from the library `grc` (`@intellectual-frontiers/grc`, grc FR-019), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-020**: GRC engineering MUST take signing and verifying from the library `grc` (`@intellectual-frontiers/grc`, grc FR-020), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-021**: The runtime MUST take Git, read by running it from the library `system` (`@intellectual-frontiers/system`, system FR-014), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-022**: GRC engineering MUST take the loaders of settings from the library `grc` (`@intellectual-frontiers/grc`, grc FR-021), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## Out of scope

- The content of catalogs (the Secure Controls Framework, NIST SP 800-53, FedRAMP's key security indicators): its licences are each harness's to check, so it stays in the harness that uses it.
- Connectors to clouds and services, `stolos`'s SQLite estate, `erga`'s spec-kit grammar and ontology terms.
- Sigstore and transparency logs.

## Edge cases

- `catalog.control("XX-99")` where the catalog has no such control: does not compile, per FR-001.
- A control whose check throws for one host of ten: `error` for that host, the nine others judged, per FR-002.
- `fail` joined with `pass`: `fail`; `pass` joined with `not-applicable`: `pass`, per FR-003.
- A waiver granted on 1 March that expired on 31 March, at 1 April: does not apply, per FR-005.
- A waiver for a control whose check gave `error`: does not apply, per FR-005.
- `{"b":1,"a":2.0}` and `{"a":2,"b":1}`: one digest, per FR-006.
- A ledger whose third entry was edited: verification names entry 3, per FR-007.
- A ledger whose last entry was removed: not detectable from the ledger alone, so the digest of its last entry is what a signature covers, per FR-007 and FR-008.
- A bundle with a file added after its manifest was written: refused, naming the file, per FR-009.
- Evidence of 29 days for a cadence of `P30D`: `due`, per FR-011.
- A change touching `infra/**` declared for a control whose newest verdict is `fail`: `blocked`, naming the control, per FR-013.
- Likelihood `high` and impact `very-high`: `very-high`, as Table I-2 gives it; the middle level is `moderate`, per FR-014.
- The same findings written twice to OSCAL: byte for byte the same document, per FR-017.
- `git` not installed: an `Err`, never a thrown error, per FR-021.

## Assumptions

- OCSF 1.9.0, OSCAL 1.2.3 and CycloneDX 1.6 are the versions the harnesses write today (`stolos` writes these OCSF classes and OSCAL documents already). From OSCAL 1.1.2 to 1.2.3 the members of the four documents written did not change; 1.2 widened enumerations (component types, the `discovery` observation type, CVSS v4), made an SSP's `users` optional and added the mapping model, which is not written.
- A role is enough to say who approved a waiver or owns a risk in this public repository; a harness that must name people adds them in its own records.

## Open questions

- **OQ-1**: Whether to add the OSCAL profile and catalog models when a harness resolves profiles itself.

## Key entities

- **Catalog** - a framework's controls, as a typed constant.
- **Control** - a check of one kind of subject, implementing catalog controls.
- **Verdict** - a status and severity for one subject under one control.
- **Finding** - a verdict with its detail, evidence and waiver.
- **Waiver** - an approved, expiring acceptance of a failing verdict.
- **Ledger** - the hash chain of evidence.

## Success criteria

- **SC-001**: `erga` and `stolos` keep no type of their own for a control, a verdict, a finding, a waiver or a ledger entry.
- **SC-002**: The same findings give the same OCSF, OSCAL and CycloneDX on Bun and Node.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
