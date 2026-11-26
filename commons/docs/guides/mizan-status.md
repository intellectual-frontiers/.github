# Built, in progress and not verified

The work is tracked in [issue #10](https://github.com/intellectual-frontiers/.github/issues/10), and every step is specification first: specifications, then ontology, then code, then tests, then documentation. What is marked Built is tested, runs on Bun and on Node 26, and is checked in CI. Of the Mizan specifications, 0020-ifccm and 0021-ifqs are Active, and 0003-mizan, 0016-ladder, 0017-two-languages, 0018-standards-first, 0019-mizan-integrations, 0022-trust and 0029-subject-profiles are Draft.

## Milestones

| Milestone | What | Status |
| --- | --- | --- |
| M0 | Mizan itself: the standards audit; `0003` and `0016` to `0019`; the checks (keyword, EARS, Gherkin, Standards considered, basis on every term, the 90 days of a Decision, deprecation); the shared ontology; `commons/mizan/src/integrations/` (importers of a vocabulary slice and of an OSCAL catalog; exporters of SHACL, JSON Schema, SKOS, SQL, SSSOM, OWL, RDF/XML, DCAT and an HTML view); the OSCAL form of the proof register | **Done** [audit](../../../commons/spec-kit/audits/2026-11-standards-audit.md) |
| M1 | Specifications `0020` to `0022`; the ladder of eleven rungs; the ontologies `ifccm` and `ifqs` with their bases | **Done** |
| M2 | IFCCM: `commons/mizan/src/changes/` and the command `changes.ts` | **Done** |
| M3 | IFQS Tier 0: the canonical record, the files and chain, the signed `quality` branch, the renderings | **Done** |
| M7 | IFQS Tier 1: grades, review debt, freshness, nonconformance and CAPA, objectives, the index; the change check leaves its result as a quality record | **Done** |
| M9 | IFQS Tier 2 (`0021` and `0022`): assessor pack, Trust page, attestation, pre-registered plans, mutation records, agent review | **In progress** |
| M10 | Credits, this document and the README, and the Decisions | **In progress** |
| Later | Move each harness's ladder to an instance of the commons ladder; its existing `unaligned` terms go into the baseline | **Waiting for a go-ahead** |

The proof register (`enforcement.tsv`) holds one row for each requirement, naming its mechanism: a check, a gate, a review by a person, or `none` with its reason. A `none` is never hidden, and the Quality section of this site shows the current counts.

## What the audits found

- Most terms of the packaging ontology are `unaligned`, each with the candidates still to examine. A term that awaits a Decision is held by a baseline that only shrinks, and a Decision past its day fails whatever the baseline holds.

## Verified for real

- OSCAL 1.2.3 is the newest release (tags 1.2.4, 1.2.5 and 1.3.0 do not exist) and is public domain and CC0. NIST SP 800-53 Rev. 5.2.0 (1,196 controls with enhancements) imports from a pinned `oscal-content` commit in 0.7 s.
- A slice of the real schema.org 30.1 Turtle, fetched by pinned SHA-256, makes exactly the vocabulary commons states. The reader's triple counts on schema.org (17,515), PROV-O (961) and SHACL (1,112) agree exactly with rdflib; sssom-py parses the SSSOM file; pySHACL finds the ontology conforms to its own shapes and rejects a broken individual; ROBOT reads the generated OWL.
- TypeScript 7 checks a 5,000-entry code list in 0.18 s and 85 MB, linear in its entries.
- The GitHub, GitLab and plain Git adapters are tested with recorded exchanges written from the hosts' documented answers, a real HTTP server on loopback for the live transport, and real Git repositories. The change check, the quality branch (including signing with an SSH key made in the test where `ssh-keygen` exists) run as programs on Bun and on Node 26 against real temporary repositories.

## Not verified

**What we have not seen work.** 
