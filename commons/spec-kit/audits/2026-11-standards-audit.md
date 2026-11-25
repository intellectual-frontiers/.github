# Phase 0: the standards audit

**Status:** Draft, 2026-11-17 (issue #10, Phase 0). A working record of the Mizan plan, not a specification: it states what was found, how, and what is still to be verified.

## Scope and method

The audit classifies every class, property and code list of an ontology by its basis (`0018-standards-first` FR-003): `adopts`, `specializes`, `maps` or `unaligned`.

- **Commons** (`commons/ontology/supply-chain/packaging/`) is public and is read term by term here.
- **Other harnesses' ontologies** are not described here: this repository is public, and a private harness's own ontology is not added to it. The same method was run on `erga`'s ontology and its figures are kept with `erga`; the owner has them.
- The counts come from scripts that read the TypeScript (declarations of `vocabulary(...)`, `OwlClass.make(...)`, `subClassOf`, `skos:*Match`). They are counts of declarations, not a judgement of fitness: a term that is `unaligned` may still be right, and the audit says only that no standard backs it today.
- Candidate standards below are **candidates**. Each needs its version, license and redistribution terms confirmed before an import (`0019-mizan-integrations` FR-005, FR-006).

## Commons: the packaging ontology (`pm:`)

| Kind | Count | Basis today |
|---|---|---|
| Classes | 16 | 5 `specializes` schema.org (`PackageManager`, `Program`, `PinnedDownload` are `schema:SoftwareApplication`; `SystemFamily` is `schema:Thing`; `Command` is `schema:Action`); 11 `unaligned` |
| Properties | 45 | all `pm:`; none is mapped to a standard term |
| Code lists | 5 (`Operation`, `SupportStatus`, `Assurance`, `ManagerKind`, `Tier`) | `unaligned`; each is a union the tools branch on |

The vocabulary says in its own header that it specializes schema.org and SPDX 3.0.1 where they have a class, and that every other term is its own "because no established vocabulary names it". That is the right sentence and it is not yet checked.

Candidates to examine for the 11 `unaligned` classes and the properties (none confirmed):

| Term | Candidate | Note |
|---|---|---|
| `pm:Checksum`, `pm:sha256` | SPDX 3 `Hash` with algorithm and value | Likely `maps`; confirm SPDX 3.0.1 term names |
| `pm:version` | `schema:softwareVersion` | Likely `maps` |
| `pm:name` | `schema:name` or `rdfs:label` | Likely `adopts` |
| `pm:purlType`, `pm:PackageName` | Package URL (purl) specification | Confirm its current standing and license |
| `pm:Platform`, `pm:operatingSystem`, `pm:processor` | `schema:operatingSystem`, `schema:processorRequirements` | Possible `maps` |
| `pm:Rule`, `pm:Prohibition`, `pm:RecordField`, `pm:Tier`, `pm:Assurance`, `pm:SupportStatus`, `pm:ManagerKind`, `pm:Operation` | none found yet | Likely stay `unaligned` with a recorded justification |

## Commons' kernel: standards already in TypeScript

The kernel already has typed vocabularies for RDF, RDFS, OWL, XSD, SKOS, Dublin Core terms, PROV-O and SHACL, and modules for OSCAL (writing OSCAL version `1.2.3`, per its `OSCAL_VERSION`), OCSF, OpenTelemetry and GRC primitives. These are the base the integrations module builds on, and are the first things to re-import through it so that hand-written copies become generated ones (issue #10, Phase 4).

## The first domains

### FDA Quality Management System Regulation (21 CFR Part 820)

Verified in this audit from FDA and the Federal Register:

- The QMSR **took effect on 2 February 2026** and amends 21 CFR Part 820. [FDA: Quality Management System Regulation (QMSR)](https://www.fda.gov/medical-devices/postmarket-requirements-devices/quality-system-qs-regulationmedical-device-good-manufacturing-practices); [Federal Register: Medical Devices; Quality System Regulation Amendments, 2 February 2024](https://www.federalregister.gov/documents/2024/02/02/2024-01709/medical-devices-quality-system-regulation-amendments).
- It **incorporates ISO 13485:2016 by reference** (new section 820.7), with FDA-specific additions such as definitions and record-keeping.
- ISO 13485 is **not redistributable**: specifications cite its clauses and never copy them (`0018-standards-first` FR-007). The statement that it took effect on that date is from the FDA's own page and the Federal Register notice; details such as which clauses were reserved should be read from the eCFR text when a requirement cites them.

### 21 CFR Part 11 (electronic records and electronic signatures)

Included at the owner's decision. Its text is U.S. law (`0018` FR-001); its authority citations are written as `Authority` records. Its current text and any guidance are to be read from eCFR before a requirement cites a paragraph.

### Federal security: NIST and FedRAMP

- **OSCAL.** Verified 2026-11-17 against the repository's tags (`raw.githubusercontent.com/usnistgov/OSCAL`): `v1.2.3` and `v1.2.2` exist, and `v1.2.4`, `v1.2.5` and `v1.3.0` do not, so `1.2.3` is the newest release found and is the value commons' kernel writes (`OSCAL_VERSION`). A web search had found only 1.2.2, which was a stale result. The repository's license file says the work is in the public domain in the United States as a work of the U.S. government, and is also dedicated worldwide under CC0 1.0, so it may be redistributed. The machine-readable JSON Schemas are not at a fixed path in the Git tree (a request for `json/schema/oscal_catalog_schema.json` at that tag returned 404); they ship with the release artifacts, so the first OSCAL importer must find them there and pin their SHA-256.
- **FedRAMP.** The 2026 consolidated rules and Key Security Indicators (KSIs) are published by FedRAMP as machine-readable data. Vendoring a release means pinning it by commit and SHA-256 (the pattern of `0019-mizan-integrations`), and release `2026.11.02.01` is the one read. Secondary sources describe an OSCAL requirement for new Rev5 packages from 30 September 2026, but their details conflict; read fedramp.gov before a requirement cites a date or count.
- **NIST SP 800-53** and its OSCAL catalog are the control source; only the controls a specification cites are imported (`0019` FR-005).

## Candidate importers (to confirm before use)

| Source | Format | Why | License and terms: to verify |
|---|---|---|---|
| OSCAL (NIST) | JSON Schema, catalogs | the proof register and controls | Public domain (U.S. Government work) and CC0 1.0, confirmed from the repository's license file at `v1.2.3` |
| FedRAMP rules | JSON | KSIs, baselines | a vendored, pinned release; confirm terms |
| schema.org | Turtle, JSON-LD | already specialized by commons | CC BY-SA 3.0; a slice was imported and read on 2026-11-17 (17,515 triples agree with rdflib); the attribution and share-alike duty applies to a vendored copy |
| PROV-O, SKOS, SHACL | Turtle | already typed in the kernel | W3C document license |
| DPV | Turtle | privacy terms | confirm |
| SPDX 3.0.1, CycloneDX | JSON-LD, JSON Schema | packaging and SBOM | confirm |
| FHIR, US Core, USCDI | StructureDefinitions, RDF | healthcare products | confirm per product need |
| NIEM | XSD | federal, state and local data exchange | later, only when a product needs it |
| eCFR / U.S. Code (USLM) | XML | identifiers for `Authority` citations | confirm identifier scheme |

Imports are made only where a specification needs a term (`0019` FR-005), so most of this table stays unused until a product asks.

## The proof register and OSCAL (0003-mizan FR-011)

Proposal, for the Phase 1 specification: each requirement maps to an OSCAL `implemented-requirement` of a `component-definition` of the harness; each passing proof (a test that `proves` it) to an `assessment-results` observation; each reviewed requirement (no test, with a reason) to a recorded reason in the same results, and an open finding to a `plan-of-action-and-milestones` item. What OSCAL cannot say (the command that proves, the harness path) stays in `enforcement.tsv`. The OSCAL version is the one the kernel writes until the audit's open item above is closed.

## Findings

1. **Commons is small and mostly honest about its bases**, but nothing records the basis: the first baseline is the counts above, and is `unaligned` for everything not already `specializes`.
2. **Commons: 11 of 16 classes and all 45 properties are unaligned**; several have plausible standard counterparts (checksums, versions, names, platforms, package names).
3. **Importing** follows one pattern: vendored, pinned, hashed, generated.
4. **The `Authority` and `Standard` classes, `basis` and the baseline are the missing machinery**; none of them exists yet.

## Open items for later phases

- ~~Confirm the OSCAL release and the version the register writes.~~ Done: 1.2.3 (see above); find the JSON Schemas in the release artifacts.
- Confirm each candidate's license and redistribution terms before its first import.
- Re-run this audit as a script, so that the baseline is a file that only shrinks (`0018` FR-012), once the `basis` field exists.
