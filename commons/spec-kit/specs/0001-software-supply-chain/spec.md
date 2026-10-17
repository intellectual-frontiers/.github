# Feature Specification: Software supply chain

**Spec ID:** 0001-software-supply-chain
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The capability every Intellectual Frontiers harness shares for knowing what software its computers are made of, where each piece came from, and how to install it the same way on
every computer: one vocabulary, kept as an ontology in `commons/`, and the tables a harness or a script reads that are generated from it, so that no harness keeps a second copy of a fact the
vocabulary holds. The first piece is packaging (`0002-packaging`): the package managers and system families, the commands that drive them and the names of packages. It exists so that a
harness can say, to a person and to an auditor, what it installed and from where, and so that a new harness starts from what the first one learned.

## The capability

- **FR-001**: The capability MUST be kept in `commons/` of the `.github` repository, which holds what any company or harness of Intellectual Frontiers may use (`commons/README.md`). Its
  ontology MUST be under `commons/ontology/supply-chain/`, its specifications in `commons/spec-kit/`, its tools in `commons/tools/` and what the tools generate in `commons/generated/`.
- **FR-002**: A file a tool generates MUST carry `.auto.` in its name (`packaging.auto.toml`) or sit between marks that say `AUTO-GENERATED` inside a file a person writes, MUST say which tool
  and which source made it, and MUST NOT be edited by hand: a check MUST fail where it is not what its tool makes from the ontology.
- **FR-003**: A harness or a script MUST read a generated table and MUST NOT keep a fact of its own that the ontology holds (a command, a package name, a detection ID); where it must carry a
  copy because it runs before it can read anything (a script piped from the internet), the copy MUST be generated and checked as FR-002 says.
- **FR-004**: A software component MUST be identified by its package URL (purl) where the package URL specification has a type for its package manager, and an SBOM made from this capability
  MUST write it with SPDX 3.0.1's `Software/packageUrl`. A component whose manager has no purl type MUST say so and MUST NOT be given an invented type.
- **FR-005**: Every component MUST be able to say where it came from: a distribution's repository, reached through a package manager the ontology names, or a download pinned by its SHA-256.
- **FR-006**: What has been run on a real computer, what has been run only against stand-ins, and what has not been run MUST be told apart wherever a status is shown, and nothing not run for
  real MAY be called verified. A claim of verification MUST say where and when.
- **FR-007**: This capability MUST NOT claim that anything is compliant with a regulation or a standard. It MUST say which practices it supports, as informative notes, and name the sources
  it read.

## Informative mapping

The practices below are what this capability supports; none is a claim of compliance (FR-007).

- **Component inventory and provenance:** the NIST Secure Software Development Framework (SP 800-218) asks makers to collect provenance for each release and each component, with a
  software bill of materials (SBOM) as its example. NIST's software supply chain guidance under US Executive Order 14028 applies the controls of SP 800-161 (cybersecurity supply chain risk
  management) to suppliers. The NTIA minimum elements of an SBOM (supplier, component name, version, other unique identifiers, dependency relationships, author, timestamp) are the fields
  FR-004 and FR-005 keep.
- **European Union:** the Cyber Resilience Act (Regulation (EU) 2024/2847), Annex I, Part II, requires manufacturers to draw up an SBOM in a commonly used and machine-readable format covering
  at least the top-level dependencies. It names no format; SPDX (ISO/IEC 5962 for its 2.x version) and CycloneDX (ECMA-424) are the usual ones.
- **Provenance of builds:** SLSA v1.0 (OpenSSF) describes provenance for build artifacts. It is not mapped here yet (OQ-2).

## Out of scope

- Declaring a harness's own pinned programs: each harness keeps its own (archon's `toolchain/`).
- Scanning for vulnerabilities, signing and attestation.
- Judging whether a harness complies with any regulation.

## Edge cases

- A package manager that has no package URL type (nix, guix, flatpak, snap, winget, scoop, chocolatey, xbps, portage, opkg, FreeBSD's `pkg`): its components are identified without one and the
  table says so, per FR-004.
- A generated file edited by hand: the check that regenerates it fails, per FR-002.
- A harness that has its own copy of a command the ontology holds: it is a drift, per FR-003, and the harness's own checks name it.
- A family a person has tried on a real computer but nobody has written down where: it stays unverified until `verifiedOn` says where and when, per FR-006.

## Assumptions

- The harnesses that use this capability can read a TOML file, or are a POSIX shell script that carries the generated fragment.
- Package managers keep the commands the ontology records; a change is a change to the ontology.

## Open questions

- **OQ-1**: Whether the European Commission specifies the SBOM format and elements by implementing or delegated act, and when: the sources read cite different provisions; the official text is
  to be checked.
- **OQ-2**: How SLSA provenance maps to a harness's pinned downloads. The official specification was not read for this version.
- **OQ-3**: The namespaces the package URL types give their packages (`deb`, `rpm`, `apk` and `alpm` use the distribution), to be confirmed against the type definitions before an SBOM is made.

## Key entities

- **Component** - a piece of software on a computer, identified by a package URL where a type exists.
- **Package manager** - what installs components (0002-packaging).
- **Generated table** - what a tool makes from the ontology for a harness or a script to read.

## Success criteria

- **SC-001**: A harness can say, from a table it does not write, how to install a program on every family the table supports, and what each family calls the package.
- **SC-002**: A change to a command or a name is one edit, in the ontology, and every consumer has it after the tool runs.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Confidential: no sensitive fact written as a literal
