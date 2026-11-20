# Feature Specification: Mizan, the IF Spec Profile

**Spec ID:** 0003-mizan
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Mizan (Arabic *mizan*, "balance, scale") is the IF Spec Profile: a profile of GitHub Spec Kit that adds what Spec Kit lacks. The format every Intellectual Frontiers harness keeps for its specifications, its register of numbers and its register of what enforces each requirement, and one tool with no dependency that checks a folder against it, so that a new harness starts with the same discipline and `archon` and commons do not each keep their own copy of the rules.

## The format

- **FR-001**: A spec-kit folder MUST hold `registry.tsv` (header `number`, `slug`, `state`; one row for every number ever assigned, `in force` or `retired`, with no number twice and no gap), `enforcement.tsv` and `specs/NNN-slug/spec.md` or `specs/NNNN-slug/spec.md` for each specification, where NNN or NNNN is a number of three or four digits (amended 2026-11-18, FR-041) and a slug is lower-case words joined by hyphens. A specification in force MUST have a folder; a retired one MUST NOT.
- **FR-002**: A specification MUST begin `# Feature Specification: <title>`, carry `**Spec ID:**` naming its folder, `**Status:**` (Draft, Active, Deferred or Superseded, and Adopted until a harness has moved to Active, FR-010), `**Owner:**` and `**Domain:**`, and hold `**Input:**`, `## Edge cases`, `## Assumptions`, `## Open questions`, `## Key entities`, `## Success criteria` and `## Review & acceptance checklist` in that order, with `## Mizan and GitHub Spec Kit## Out of scope` (optional) before `## Edge cases`.
- **FR-003**: A requirement is `- **FR-nnn**:`, numbered in increasing order and never reused in its specification; every edge case MUST cite the requirements it exercises, and every one it cites MUST exist in its specification.
- **FR-004**: A specification of another repository MUST be cited with the repository's name before its number (`archon 0002-specs`); a bare number names a specification of the same folder and MUST exist there.
- **FR-005**: `enforcement.tsv` MUST have exactly one row, with four tab-separated columns (requirement, mechanism, who, note), for every requirement of every specification, and none for a requirement that does not exist. The mechanism is `check`, `gate`, `review` or `none`; `check` and `gate` name who as `<repository>: <command>`; `review` names the requirement that defines the review; `none` has `-` for who and says why in the note.

## The tool

- **FR-006**: `commons/tools/mizan-check.ts` MUST check a folder against FR-001 to FR-005 and FR-008, importing nothing outside `commons/tools/` but the `node:fs` and `node:process` built-ins and running on Bun or Node 26 (`bun commons/tools/mizan-check.ts`), take the folder with `--root` (default `commons/spec-kit`) and, where the registers are elsewhere, their folder with `--register` (FR-042), print every finding as `where: message` on standard error, write nothing, exit 1 where there is one, and offer `check(root)` for a harness that wants the findings as data. Its command line, its findings and its exit status MUST be those of the Python tool it replaced, which a harness reads (amended 2026-11-15: the tool was Python, with its standard library alone).
- **FR-007**: The tool MUST NOT read a harness's ontology or run its commands: who owns a specification and whether a named command exists are the harness's to check, on top of it.

## A specification's place

- **FR-008**: A specification MAY carry, after `**Domain:**`, a `**Part of:**` line naming the one specification of the same folder it is a part of (`**Part of:** 0005-typescript-practice`), which a reader of the folder shows it under. The tool MUST name a `**Part of:**` line that names no specification of the folder, or names the specification itself (amended 2026-11-15, for commons 0011-documentation).

## Mizan and GitHub Spec Kit

- **FR-009**: Mizan MUST be a profile of GitHub Spec Kit, never a replacement: a harness keeps Spec Kit's method (its commands, its constitution and the `spec.md`, `plan.md` and `tasks.md` of a feature) and Mizan adds only the registers, the tracing of requirements to proofs, the ladder (0016-ladder), the requirement syntax, the standards-first rules (0018-standards-first) and their checks. A specification MUST say which version of Spec Kit's templates it follows where it departs from them. The old name `spec-kit-check.ts` MUST remain, for one repin cycle, as a file that runs `mizan-check.ts` and adds nothing.
- **FR-010**: A specification's status MUST be Draft (written, not yet built), Active (in force: every requirement is proven by a test or declared as reviewed), Deferred (out of scope until its owner decides) or Superseded. Adopted, the word this format used before Mizan, MUST be accepted until every specification of a harness has moved to Active.
- **FR-011**: The register of what proves each requirement MUST map a requirement to OSCAL (a control, a component definition and its assessment results) where OSCAL can state it, and MUST stay as `enforcement.tsv` for what OSCAL cannot, so that no proof is written twice. The mapping is built by `commons/libraries/src/oscal-register.ts` (FR-021 to FR-023, amended 2026-11-17).
- **FR-012**: A specification MAY be written in GitHub Spec Kit's form, told by its `## User Scenarios & Testing` section: its head then has `**Status**:` (or `**Status:**`) and no `**Spec ID:**`, `**Owner:**` or `**Domain:**` line is required, and it MUST hold `## User Scenarios & Testing`, `## Requirements` and `## Success Criteria` in that order (a heading may carry a suffix such as `*(mandatory)*`). The commons sections and the citing of edge cases do not apply to it; the register, the status words, the numbering of requirements, the citations of specifications and the rows of `enforcement.tsv` apply to both forms.

## Requirement syntax and the proof register

- **FR-013**: A requirement MUST be worded with RFC 2119 keywords (MUST, MUST NOT, SHOULD, MAY) in one of the six EARS patterns: ubiquitous (`The <system> MUST ...`), event-driven (`WHEN <event>, the <system> MUST ...`), state-driven (`WHILE <state>, ...`), unwanted behaviour (`IF <condition>, THEN ...`), optional feature (`WHERE <feature present>, ...`) or a combination of them.
- **FR-014**: An acceptance scenario MUST be written as Gherkin's Given, When, Then, and MUST cite the requirements it exercises, so that a reader can walk from a scenario to its rules and the tool can see that each cited requirement exists.
- **FR-015**: The rules of FR-013 and FR-014, and every rule that Mizan adds after the format of FR-001 to FR-005, MUST begin as warnings held by a baseline that only shrinks: a finding the baseline does not hold fails, and a line of the baseline that no longer occurs fails, so that a harness's existing specifications are never failed on the first day. The baseline of a folder is `mizan.baseline.txt` beside its `registry.tsv`.
- **FR-016**: `enforcement.tsv` MUST be the one register of what proves a requirement: a requirement that a person reviews is a row whose mechanism is `review`, with its reason, where a harness kept it in `reviewed.tsv`; a harness's `reviewed.tsv` MUST be accepted until it has moved its rows to `enforcement.tsv`.

## The code

- **FR-017**: Mizan's TypeScript MUST be the library `mizan` (`commons/mizan/`, `@intellectual-frontiers/mizan`), and MUST import only `node:` built-ins, the libraries of commons it declares, the ontology it generates from (`@intellectual-frontiers/ontology`), the types of the shared Git host contract (the library `githost`, `@intellectual-frontiers/githost/types`, which the change-control check of 0020-ifccm is given a client of) and itself.
- **FR-018**: `commons/libraries/src/generate-ontology.ts` MUST write the Turtle of Mizan's ontology (`commons/ontology/mizan/`) as `commons/generated/mizan.auto.ttl`, in the canonical form of 0012-ontology FR-006, beginning with lines that say it is generated and carrying the SHA-256 of the ontology's canonical N-Triples; with `--check` it MUST write nothing and exit 1 where the file is not what the ontology makes, and it MUST stop with exit 2, naming every finding, where the ontology breaks a rule of the kernel. It MUST also write the exports of 0019-mizan-integrations FR-010 that exist for it (`mizan-shapes.auto.ttl`, `mizan-schemas.auto.json`, `mizan-code-lists.auto.skos.ttl` and `mizan-code-lists.auto.sql`) and check them in the same way.
- **FR-019**: `commons/libraries/src/check.ts` MUST read a folder's specifications (`specs/NNN-slug/spec.md` or `specs/NNNN-slug/spec.md`, and `plan.md` where there is one), run the rules of FR-013 and FR-014 and of 0018-standards-first FR-009 as plugins (a harness MAY pass more), hold their findings against the folder's `mizan.baseline.txt`, print each new finding and each stale baseline line on standard error and exit 1 where there is one, and write the baseline only with `--write-baseline`.
- **FR-020**: `commons/libraries/src/check.ts` MUST find, in commons' own specifications, a prefixed name in code font of one of commons' own ontologies (`mz:`, `pm:`) that the ontology does not define (a class, a property or an individual of a code list), once for each name in each specification, as a finding the baseline may hold; a prefix that is not one of commons' own (`schema:`, `skos:`) is not read, because the standard defines it and a pinned import makes its use compile.
- **FR-021**: `commons/libraries/src/oscal-register.ts` MUST turn a Mizan folder's `enforcement.tsv` (and the `reviewed.tsv` of a specification, whose rows it reads as `review`) into an OSCAL `component-definition`, in which each requirement is one `implemented-requirement` whose `control-id` is `spec-<slug>.<fr>` in lower case (`spec-0003-mizan.fr-011`) and whose properties carry its mechanism and the number of proofs it has, and the proofs, the requirements that the `proves([...])` calls (and `// Proves:` lines) of the tests name, into an OSCAL `assessment-results`, in which a proof is a passing observation that holds the SHA-256 of its test file as evidence, a requirement that is only reviewed is `accepted`, and a requirement with no proof, whatever its row says, is a `gap`; both through the writers of the kernel's `oscal.ts` and at its `OSCAL_VERSION`.
- **FR-022**: The two documents MUST be the same bytes for the same folder: every `uuid` a version 5 UUID of a stable name, every list in an order of its own, no clock (`last-modified` is `1970-01-01T00:00:00Z`) and a `version` that is the first 12 characters of the SHA-256 of the register's rows, so that a change of the register, and no other, changes the files.
- **FR-023**: `oscal-register.ts` MUST write them as `commons/generated/mizan-register.auto.oscal.json` (the component definition) and `commons/generated/mizan-register-results.auto.oscal.json` (the assessment results), each saying in its title that it is generated and by what, MUST with `--check` write nothing and exit 1 naming each file that is not what the folder makes, and each MUST validate against the official OSCAL JSON Schema of its version, whose SHA-256 the test pins.
- **FR-040**: A harness MUST be able to run the check of FR-019 and FR-020 on its own specifications and its own audit of terms (`0018-standards-first` FR-003 to FR-005) through `holdHarness` of `@intellectual-frontiers/mizan`, given the folder of its specifications, its baseline, the day, the records of the basis of its terms, the IRIs of each ontology and those the audit records, and the prefixes a specification may name; commons' own `check.ts` MUST be that function with commons' own audit, so that a harness keeps no copy of the check.
- **FR-041**: The checker of FR-006 and the rules of FR-019 MUST accept a specification number of three digits (`specs/NNN-slug/`) as well as of four (`specs/NNNN-slug/`), in the register's rows, in the folders' names, in the `Spec ID:` lines and in the requirements of `enforcement.tsv`; a number is its value (`007` and `0007` are one number, assigned once); a gap MUST be told with the width the register's numbers have; a bare citation of a specification of the folder MUST be read at the widths the folder's own numbers have, so that a folder of three-digit numbers finds a bare `NNN-slug` that names no specification and a folder of four-digit numbers does not take a phrase such as `200-day` for one; and a number of any other width MUST be a finding of the register's row (amended 2026-11-18).
- **FR-042**: WHERE a harness keeps its registers (`registry.tsv`, `enforcement.tsv` and the baseline `mizan.baseline.txt`) in a folder other than the one that holds `specs/`, the tools MUST take that folder as `--register DIR` (`mizan-check.ts`, `check.ts`, and `oscal-register.ts` for `enforcement.tsv`) and `check(root, { register })` MUST take it as an option, with the baseline beside the registers (FR-015); WHERE it is not given, the registers MUST be read beside `specs/`, as before (amended 2026-11-18).
- **FR-043**: `readRegisterInput` and `registerDocuments` of `oscal-register.ts` MUST take the path of the proof register as an option (`enforcement`) and the command as `--enforcement FILE`, for a harness whose register is not `enforcement.tsv` beside its specifications; the two documents MUST be the same bytes as when the same rows sit in `enforcement.tsv` beside the specifications (Windows line ends read as LF, the files written with LF), a path that is not there MUST be an error and never an empty register, and with no option the behaviour MUST be unchanged (FR-021 to FR-023, amended 2026-11-18).
- **FR-044**: WHERE a harness gives `holdHarness` what each term of its ontology says it is defined by (`specTerms.definitions`, made by `definitionsOf` from its audit of terms), the check MUST find, as `mizan/term-not-defined-by`, each requirement that names in code font a term of that ontology (`mz:Rung`) whose `mz:definedBy` does not name that requirement, alone or in a range (a citation of the whole specification does not), once for each requirement and term, as a warning held by the baseline (FR-015), so that a requirement and the term it names are the two ends of one link (the requirement-to-term stage of 0020-ifccm FR-014); commons' own check MUST run the stage only with `--defined-by`, so that its baseline does not grow (amended 2026-11-18).

## Acceptance scenarios

1. **Given** a folder whose specifications are `specs/001-first/` and `specs/002-second/` and whose register has the rows `001` and `002`, **When** `mizan-check.ts --root DIR` runs, **Then** it finds nothing, per FR-041.
2. **Given** registers in `DIR/tools/spec-register/` and specifications in `DIR/specs/`, **When** `mizan-check.ts --root DIR --register DIR/tools/spec-register` runs, **Then** the registers are read there and a stale line in the baseline beside them is named, per FR-042.
3. **Given** the same register rows in `governance/proof-register.tsv` and in `enforcement.tsv`, **When** the OSCAL register is made with the path as an option, **Then** the two documents are the same bytes, per FR-043.
4. **Given** a requirement that names `mz:Rung` and a term that states no `mz:definedBy`, **When** `holdHarness` runs with the definitions, **Then** it reports `mizan/term-not-defined-by` as a warning the baseline holds, per FR-044.

## Out of scope

- The rules a harness adds (owners from an ontology, commands that exist, control maps): `archon 0024-spec-format` and `archon 0002-specs`.

## Edge cases

- A folder with a number missing from the register: the tool names the gap, per FR-001.
- A requirement renumbered so a number repeats: the tool names it, per FR-003.
- An edge case that names a requirement the specification does not have: the tool names it, per FR-003.
- A specification that cites another repository's specification by its bare number: the tool names it and says to name the repository, per FR-004.
- A requirement with no row in `enforcement.tsv`, or a row for one that was deleted: the tool names it, per FR-005.
- A `none` row with no reason: the tool names it, per FR-005.
- A folder with no `registry.tsv`: the tool reports it missing and goes on to check the specifications, per FR-006.
- A specification whose status is Adopted: the tool accepts it, per FR-010.
- A specification in Spec Kit's form with no `## Success Criteria` section: the tool names it, per FR-012.
- A specification in Spec Kit's form with a `**Status**:` line and no `**Spec ID:**` line: accepted, per FR-012.
- A requirement written as `The checker does what is needed`: no EARS pattern and no keyword, so a warning held by the baseline, per FR-013 and FR-015.
- A scenario that cites no requirement, or one the specification does not have: a warning, per FR-014 and FR-015.
- A baseline line for a finding that has been fixed: the check fails until the line is deleted, per FR-015.
- A harness with a `reviewed.tsv`: its rows are read as `review` rows until moved, per FR-016 and FR-021.
- A requirement with a `check` row that no test names: a `gap` in the results, per FR-021.
- A requirement a test proves from two files: two passing observations, per FR-021.
- The register made twice, or on another computer: the same bytes, per FR-022.
- `commons/generated/mizan-register.auto.oscal.json` edited by hand, or a requirement added without writing it again: `--check` names it, per FR-023.
- A requirement with no MUST, MUST NOT, SHOULD, SHOULD NOT or MAY, or a trigger such as `IF` with no `THEN`: named by `check.ts`, per FR-013 and FR-019.
- A specification that names a term of commons' own ontologies that the ontology lacks, even twice: found with its line, once, per FR-020.
- A specification that names `schema:Thing`: not read, per FR-020.
- A plugin a harness adds: its findings are held by the same baseline, per FR-019.
- A file of `commons/mizan/` that imports a package that is not a library it declares, the ontology, the Git host contract's types or `node:`: refused, per FR-017.
- `commons/generated/mizan.auto.ttl` edited by hand: `--check` names it as not what the ontology makes, per FR-018.
- A class of the Mizan ontology with no `mz:OntologyTerm` saying its basis: the test names it, per 0018-standards-first FR-003.
- A harness that still runs `spec-kit-check.ts`: it keeps working and gets the same findings, per FR-009.
- A `**Part of:**` line that names a specification the folder does not have, or the specification itself: the tool names it, per FR-008.
- A specification folder named `12-short`, or `00001-long`: the tool names the folder's name and the register's row, per FR-041.
- A gap in a register of three-digit numbers: the tool says `gap at 002`, per FR-041.
- A folder with no `registry.tsv` beside `specs/` and one in the folder `--register` names: read there, per FR-042.
- A `--enforcement` path that does not exist: an error with exit 2, and no empty register, per FR-043.
- A term that cites a whole specification in `mz:definedBy` and a requirement of it that names the term: found, per FR-044.

## Assumptions

- `archon`'s format is the model: commons keeps it small, and a harness adds its own rules.

## Open questions

- **OQ-1**: Whether `archon`'s own format check should run this tool for the rules they share, once the two have been compared line by line.

## Key entities

- **Mizan folder** (a "spec-kit folder", as it is still named on disk) - a register of numbers, a register of enforcement and the specifications.
- **Finding** - a place and a sentence saying what is wrong there.

## Success criteria

- **SC-001**: `bun commons/tools/mizan-check.ts` exits 0 on commons' own folder.
- **SC-002**: Each rule has a test that breaks it and sees it named.
- **SC-003**: The old name still runs and its findings and exit status are the new name's.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
