# Feature Specification: Mizan, the IF Spec Profile

**Spec ID:** 0003-mizan
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Mizan (Arabic *mizan*, "balance, scale") is the IF Spec Profile: a profile of GitHub Spec Kit that adds what Spec Kit lacks. The format every Intellectual Frontiers harness keeps for its specifications, its register of numbers and its register of what enforces each requirement, and one tool with no dependency that checks a folder against it, so that a new harness starts with the same discipline and `archon` and commons do not each keep their own copy of the rules.

## The format

- **FR-001**: A spec-kit folder MUST hold `registry.tsv` (header `number`, `slug`, `state`; one row for every number ever assigned, `in force` or `retired`, with no number twice and no gap), `enforcement.tsv` and `specs/NNNN-slug/spec.md` for each specification, where NNNN is four or more digits and a slug is lower-case words joined by hyphens. A specification in force MUST have a folder; a retired one MUST NOT.
- **FR-002**: A specification MUST begin `# Feature Specification: <title>`, carry `**Spec ID:**` naming its folder, `**Status:**` (Draft, Active, Deferred or Superseded, and Adopted until a harness has moved to Active, FR-010), `**Owner:**` and `**Domain:**`, and hold `**Input:**`, `## Edge cases`, `## Assumptions`, `## Open questions`, `## Key entities`, `## Success criteria` and `## Review & acceptance checklist` in that order, with `## Mizan and GitHub Spec Kit## Out of scope` (optional) before `## Edge cases`.
- **FR-003**: A requirement is `- **FR-nnn**:`, numbered in increasing order and never reused in its specification; every edge case MUST cite the requirements it exercises, and every one it cites MUST exist in its specification.
- **FR-004**: A specification of another repository MUST be cited with the repository's name before its number (`archon 0002-specs`); a bare number names a specification of the same folder and MUST exist there.
- **FR-005**: `enforcement.tsv` MUST have exactly one row, with four tab-separated columns (requirement, mechanism, who, note), for every requirement of every specification, and none for a requirement that does not exist. The mechanism is `check`, `gate`, `review` or `none`; `check` and `gate` name who as `<repository>: <command>`; `review` names the requirement that defines the review; `none` has `-` for who and says why in the note.

## The tool

- **FR-006**: `commons/tools/mizan-check.ts` MUST check a folder against FR-001 to FR-005 and FR-008, importing nothing outside `commons/tools/` but the `node:fs` and `node:process` built-ins and running on Bun or Node 26 (`bun commons/tools/mizan-check.ts`), take the folder with `--root` (default `commons/spec-kit`), print every finding as `where: message` on standard error, write nothing, exit 1 where there is one, and offer `check(root)` for a harness that wants the findings as data. Its command line, its findings and its exit status MUST be those of the Python tool it replaced, which a harness reads (amended 2026-11-15: the tool was Python, with its standard library alone).
- **FR-007**: The tool MUST NOT read a harness's ontology or run its commands: who owns a specification and whether a named command exists are the harness's to check, on top of it.

## A specification's place

- **FR-008**: A specification MAY carry, after `**Domain:**`, a `**Part of:**` line naming the one specification of the same folder it is a part of (`**Part of:** 0005-typescript-runtime`), which a reader of the folder shows it under. The tool MUST name a `**Part of:**` line that names no specification of the folder, or names the specification itself (amended 2026-11-15, for commons 0011-documentation).

## Mizan and GitHub Spec Kit

- **FR-009**: Mizan MUST be a profile of GitHub Spec Kit, never a replacement: a harness keeps Spec Kit's method (its commands, its constitution and the `spec.md`, `plan.md` and `tasks.md` of a feature) and Mizan adds only the registers, the tracing of requirements to proofs, the ladder (0016-ladder), the requirement syntax, the standards-first rules (0018-standards-first) and their checks. A specification MUST say which version of Spec Kit's templates it follows where it departs from them. The old name `spec-kit-check.ts` MUST remain, for one repin cycle, as a file that runs `mizan-check.ts` and adds nothing.
- **FR-010**: A specification's status MUST be Draft (written, not yet built), Active (in force: every requirement is proven by a test or declared as reviewed), Deferred (out of scope until its owner decides) or Superseded. Adopted, the word this format used before Mizan, MUST be accepted until every specification of a harness has moved to Active.
- **FR-011**: The register of what proves each requirement MUST map a requirement to OSCAL (a control, a component definition and its assessment results) where OSCAL can state it, and MUST stay as `enforcement.tsv` for what OSCAL cannot, so that no proof is written twice. The mapping is delivered by `0019-mizan-integrations`; until then the register is `enforcement.tsv` alone.

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
- A harness that still runs `spec-kit-check.ts`: it keeps working and gets the same findings, per FR-009.
- A `**Part of:**` line that names a specification the folder does not have, or the specification itself: the tool names it, per FR-008.

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
