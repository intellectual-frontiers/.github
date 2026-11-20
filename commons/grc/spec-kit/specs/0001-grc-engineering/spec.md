# Feature Specification: GRC

**Spec ID:** 0001-grc-engineering
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The primitives of governance, risk and compliance as code, pulled up into IFC TypeScript (commons 0005-typescript-runtime) from what `erga` and `stolos` each built in their own shape: `erga` around OSCAL, with control maps, a hash-chained evidence ledger and dispositions; `stolos` around the Secure Controls Framework as its hub, with typed controls, waivers, freshness, drift, change-impact gates and OCSF, OSCAL, CycloneDX and in-toto output. One kernel of types and pure functions (catalogs, controls, verdicts, findings, waivers, evidence, assessment and the standard formats) and a thin runtime of signers, Git readers and loaders, so that each harness keeps only its connectors, its data and its catalogs' content. Every check run is a span and every finding a log record (commons 0006-signals), so compliance is observed the way everything else is.

## Catalogs, controls and verdicts

- **FR-001**: `grc` MUST give `defineCatalog(id, version, controls)` over a constant tuple of controls, so that a control id the catalog does not hold MUST NOT compile where a control of that catalog is wanted; and mappings between catalogs by Set Theory Relationship Mapping (NIST IR 8477: `equal`, `subset-of`, `superset-of`, `intersects-with`, `no-relationship`, with a strength from 1 to 10), each mapping's two ends typed by their catalogs.
- **FR-002**: `defineControl` MUST declare a control that is generic over the subject it judges (`Control<S>`): its id, title, the catalog controls it implements, its severity, its cadence, and a check from a subject and a context to verdicts. `definePack` MUST group controls over one subject type, and running a pack MUST run every control over every subject, a control that throws giving `error` for that subject and never stopping the others.
- **FR-003**: A verdict's status MUST be one union, `pass | fail | warn | error | not-applicable | gap`, and the outcome after waivers MUST add `accepted`; severity MUST be `info | low | medium | high | critical`. Combining statuses MUST be a join-semilattice (associative, commutative, idempotent, `pass` its identity among the applicable) in the order `not-applicable < pass < accepted < warn < gap < fail < error`, so that a roll-up does not depend on the order it is taken in.
- **FR-004**: A finding MUST be one type for every harness: the control, the subject (kind and id), the status and outcome, the severity, a title, the detail, the digests of its evidence, a remediation, the waiver that accepted it if any, and the time; findings MUST be grouped into sections by a pure function.
- **FR-005**: A waiver MUST name its control, the subjects it covers (an exact id or a glob), the reason, the role that approved it, when it was granted and when it expires; a waiver with no expiry, or an expiry before its grant, MUST be refused; an expired waiver MUST NOT apply; an applying waiver MUST turn `fail` or `warn` into `accepted` and keep its id on the finding, and MUST NOT turn `error` or `gap`.

## Evidence

- **FR-006**: `evidence` MUST give JSON's canonical form (RFC 8785, JCS) and address a piece of evidence by the SHA-256 of that form, so that the same evidence has one digest on every runtime.
- **FR-007**: A ledger MUST be append-only and hash-chained: each entry has its sequence number, the digest of the entry before it (64 zeros for the first), its time, its kind, its subject and the digest of its evidence, and its own digest is the SHA-256 of the canonical form of the rest; it MUST be written and read as JSON lines, and verifying it MUST name the first entry that was changed, removed, inserted or reordered.
- **FR-008**: A manifest MUST list files by path, size and SHA-256 in the byte order of their paths, and verifying a set of files against it MUST name each file that is missing, extra or different; its signature MUST be verified by a function the caller gives (commons 0005-typescript-runtime FR-045), so the kernel holds no key.
- **FR-009**: An evidence bundle MUST be written with the kernel's archive writer (commons 0005-typescript-runtime FR-010) with its manifest at its head, the same bytes every time for the same files, and read back with the manifest checked.

## Assessment

- **FR-010**: Coverage MUST roll up per requirement or control as `gap` (no control implements it), `untested` (implemented, never assessed), `partial` (some subjects not passing), `addressed` (every subject passing or accepted, at least one accepted) or `covered` (every subject passing).
- **FR-011**: Freshness MUST compare the time of the newest evidence with the control's cadence (an ISO 8601 duration such as `P1D`, `P30D`, `P1Y`) at a given time, saying `fresh`, `due` (within a tenth of the cadence of its end) or `stale` and when it falls due.
- **FR-012**: Drift MUST compare two views of keyed records (what is declared and what is observed) and give what was added, removed and changed, each change naming the path of the field and both values, in key order.
- **FR-013**: A change-impact gate MUST read declarations mapping paths (globs) to the controls they bear on, and judge a change (the paths it touches) as `allowed` or `blocked`, blocking where a touched path is declared for a control whose newest verdict is `fail`, `error` or `gap`, or where the change says it needs a review that has not been given, and naming each reason.
- **FR-014**: A risk register MUST hold risks with a likelihood and an impact on NIST SP 800-30's five levels (`very-low` to `very-high`), the level computed by its Table I-2, a treatment (`accept | mitigate | transfer | avoid`), the role that owns it and its review date; a risk past its review date MUST be reported.
- **FR-015**: A trace MUST relate each requirement to the mechanisms that enforce it and the evidence they gave, and say which requirements have none.

## Formats

- **FR-016**: Findings MUST be written as OCSF (version 1.9.0): a Compliance Finding (class 2003) with its `type_uid`, `status_id` and `severity_id` mapped from the verdict and severity, the control in `compliance`, and `metadata.product`; and, for what a harness reports beside its findings, a Vulnerability Finding (class 2002), and a Device (5001), User (5003) or Cloud Resources (5023) Inventory Info event, each with the metadata the caller adds (`tenant_uid`, `uid`, `correlation_uid`, `labels`). Every event is typed by types generated from the OCSF schema at that version (`tools/ocsf-gen.ts` writes `kernel/ocsf-types.auto.ts`; every response it reads is pinned by its SHA-256 in the generator, it is run by hand and its output committed), so a missing required attribute does not compile.
- **FR-017**: Assessments MUST be written as OSCAL 1.2.3 JSON (`assessment-results`, `plan-of-action-and-milestones`, `component-definition`, and a `system-security-plan` of what is implemented), every `uuid` a version 5 UUID of a namespace and a stable name, so the same input gives the same document.
- **FR-018**: Attestations MUST be written as CycloneDX 1.6 `declarations` (assessors, attestations, claims, evidence and targets) and as in-toto Statement v1 with a predicate type the caller names, ready for a DSSE envelope (commons 0005-typescript-runtime FR-045).

## The host

- **FR-019**: Running a pack MUST make signals (commons 0006-signals): a span for the run and one for each control, with `grc.control.id`, `grc.subject.kind`, `grc.subject.id` and the status, and each finding as an OTLP log record whose body is its OCSF document, with a severity from its severity.
- **FR-020**: `sign` (of the host) MUST sign and verify with `ssh-keygen -Y` (namespace given, the key a file the caller names, the allowed signers a file), and with Web Crypto keys through DSSE, behind one signer interface; it MUST NOT read a key it was not given.
- **FR-021**: The runtime MUST load the settings of packs (by a decoder the harness gives, since a pack holds code), waivers, risk registers and impact declarations from TOML, YAML, JSON or JSON5 files through the kernel's decoders, naming the file and the path of what does not decode.

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
