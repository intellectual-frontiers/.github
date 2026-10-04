# Feature Specification: Secure development policy

**Spec ID:** 0034-secure-development-policy
**Status:** Draft

**Input:** How software and configuration for systems in a compliance
boundary are changed, how the company finds and fixes weaknesses in them,
and how it accounts for what its software is made of. It is a policy
under 0030-policies, owned by the decision authority in effect. It
follows NIST's Secure Software Development Framework (SP 800-218), and
cites its practices rather than inventing its own.

## Change

- **FR-001**: Every change to the code or configuration of a system in a
  boundary MUST be made through version control. It MUST pass that
  system's automated checks before it is deployed, and MUST record who
  made it and why.
- **FR-002**: A system's production environment MUST be separated from
  the environments it is developed and tested in. Production data
  classed Confidential or above (0033-systems-and-data-policy FR-002)
  MUST NOT be copied into a development or test environment.

## Weaknesses

- **FR-003**: Every system in a boundary, and every repository holding
  software the company releases, MUST be scanned automatically for known
  vulnerabilities at least monthly, in its code, in its dependencies,
  and in what it exposes to the network.
- **FR-004**: A vulnerability found in a system in a boundary MUST be fixed
  within a time set by its severity: fourteen days if it is critical,
  thirty days if high, and ninety days if medium. One not fixed in time
  MUST be covered by a planned-remediation or accepted-risk disposition
  (0028-compliance-controls FR-012). Where the boundary's framework
  allows no open plan of action (0028-compliance-controls FR-013), it
  MUST instead be fixed or the affected component taken out of service.
- **FR-005**: A weakness reported from outside the company MUST be
  acknowledged to its reporter within five days. It is then handled under
  FR-004, or under 0035-incident-response-policy if it has been
  exploited.

## What software is made of

- **FR-006**: Each release of software the company provides to a customer
  MUST have a software bill of materials, generated from the build in a
  standard format (SPDX or CycloneDX), and kept with the release.
- **FR-007**: A secure development attestation a customer or government
  requires (for example, a self-attestation under NIST SP 800-218) is a
  representation made by the official its regime names. No tool MAY make
  one (0029-government-registrations FR-011).

## Carried out by

- Every change to a spec or the ontology says what changed and why, and a
  change is specified before it is built: 0001-eidolon-architecture
  FR-035 and FR-037.
- The specs and register are checked on every push:
  0020-spec-format FR-015.
- A DNS change that would break the baseline is refused before it is
  deployed: 0023-domain-security FR-019.
- A published contact for reporting weaknesses:
  0023-domain-security FR-022.
- No credential is ever committed: 0001-eidolon-architecture FR-023.

## Out of scope

- Which scanners and build tools each system uses.
- The design of each product. Each product's own specs state it.

## Edge cases

- A configuration change made by hand in a cloud console: it is not in
  version control, so it breaks FR-001, and it is brought back into
  version control.
- A critical vulnerability in a dependency of a CMMC Level 1 system that
  cannot be patched within fourteen days: no plan of action may cover it,
  so the component is taken out of service until it is fixed, per FR-004.
- A medium vulnerability in a SOC 2 system needing a redesign: a planned
  remediation covers it until its stated date, per FR-004.
- A researcher who reports a weakness through the published contact:
  they hear back within five days, per FR-005.
- A customer who asks for a release's components: the bill of materials
  kept with that release answers them, per FR-006.

## Assumptions

- Every system in a boundary can be deployed from version control.
- The severity of a vulnerability is the one its published advisory
  assigns, unless the company documents a different assessment.

## Open questions

- **OQ-1**: Whether low-severity vulnerabilities need a fix time is not
  decided.
- **OQ-2**: Whether changes to systems in a boundary, other than the
  vault, need a second person's approval before deployment is not
  decided. The vault's own rule is held in the vault.

## Key entities

- **A change**: one version-controlled edit to a system's code or
  configuration, checked before it is deployed.
- **A vulnerability**: a known weakness, with a severity that sets its
  fix time.
- **A software bill of materials**: a list of what one release is made of,
  generated from its build.

## Success criteria

- **SC-001**: No system in a boundary is changed outside version control.
- **SC-002**: No critical or high vulnerability outlives its fix time
  without a disposition.
- **SC-003**: Every release provided to a customer has a bill of
  materials.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
