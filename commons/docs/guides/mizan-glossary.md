# Glossary and sources

- **Basis.** How a term relates to a standard: `adopts`, `specializes`, `maps` or `unaligned`.
- **Baseline.** A file of today's findings for a new rule. A new finding fails; a line that is not found any more also fails, so it only shrinks.
- **Capability.** The unit of change in IFCCM: one ability of a harness that can be named, specified, built, proved and released.
- **CAPA.** Corrective and preventive action. In IFQS it closes only when a named test passes in a later run and a named person approves.
- **Decision.** A typed individual recording why a term is `unaligned`, due within 90 days of the term.
- **Drift.** The separation of specification, ontology, code and the world they describe.
- **EARS.** Easy Approach to Requirements Syntax: six patterns for testable requirements.
- **Exception.** A recorded choice of a tool that is not TypeScript, with reason, version, isolation, platforms and tests.
- **Evidence grade.** E0 none, E1 stated, E2 reviewed, E3 tested, E4 attested, E5 observed: what a piece of evidence is worth.
- **Harness.** A company or product repository of Intellectual Frontiers that uses commons.
- **IFCCM.** Intellectual Frontiers Capabilities Configuration Management: change control by capability and issue.
- **IFQS.** Intellectual Frontiers Quality System, based on Operational Truth.
- **Ladder.** The shared architecture of eleven rungs: 0 to 7 required, 8 lifecycle, 9 Evidence (observer), 10 Workspace (environment).
- **Operational Truth.** What is true of a system is what the system reports when it runs, kept as evidence anyone can check.
- **Profile.** A specification that narrows or extends another without replacing it; Mizan is a profile of GitHub Spec Kit.
- **Pull up.** To move a capability into commons when more than one harness should read the same facts.
- **Quality branch.** The append-only, signed `quality` branch holding one immutable evidence file per run, chained by hash.
- **Slice.** The named part of a standard that an import takes.
- **Unaligned.** A term no standard names. Allowed, justified, recorded, counted, never hidden.

## Sources

- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [RFC 2119: key words for requirement levels](https://www.rfc-editor.org/rfc/rfc2119)
- EARS: A. Mavin et al., "Easy Approach to Requirements Syntax (EARS)", IEEE RE 2009
- [Gherkin](https://cucumber.io/docs/gherkin/)
- [FDA: Quality Management System Regulation](https://www.fda.gov/medical-devices/postmarket-requirements-devices/quality-system-qs-regulationmedical-device-good-manufacturing-practices) and [the Federal Register notice](https://www.federalregister.gov/documents/2024/02/02/2024-01709/medical-devices-quality-system-regulation-amendments)
- [21 CFR Part 11 (eCFR)](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11)
- [NIST OSCAL](https://pages.nist.gov/OSCAL/), [FedRAMP](https://www.fedramp.gov/), [OpenTelemetry](https://opentelemetry.io/), [CTRF](https://ctrf.io/), [SARIF](https://sarifweb.azurewebsites.net/), [chezmoi](https://www.chezmoi.io/) (inspiration only), [ROBOT](https://github.com/ontodev/robot), [rdflib](https://rdflib.readthedocs.io/), [pySHACL](https://github.com/RDFLib/pySHACL)
- [schema.org](https://schema.org/), [PROV-O](https://www.w3.org/TR/prov-o/), [SKOS](https://www.w3.org/TR/skos-reference/), [SHACL](https://www.w3.org/TR/shacl/), [DCAT](https://www.w3.org/TR/vocab-dcat-3/), [SSSOM](https://mapping-commons.github.io/sssom/), [SPDX](https://spdx.dev/)
- In this repository: [`README.md`](../../../README.md), [`AGENTS.md`](../../../AGENTS.md), [`commons/spec-kit/`](../../../commons/spec-kit/) (specifications `0003`, `0012`, `0015` to `0022`, `0026`), [the Phase 0 audit](../../../commons/spec-kit/audits/2026-11-standards-audit.md)
