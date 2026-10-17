# Feature Specification: Specification kit

**Spec ID:** 0003-spec-kit
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The format every Intellectual Frontiers harness keeps for its specifications, its register of numbers and its register of what enforces each requirement, and one standard-library tool that checks a folder against it, so that a new harness starts with the same discipline and `archon` and commons do not each keep their own copy of the rules.

## The format

- **FR-001**: A spec-kit folder MUST hold `registry.tsv` (header `number`, `slug`, `state`; one row for every number ever assigned, `in force` or `retired`, with no number twice and no gap), `enforcement.tsv` and `specs/NNNN-slug/spec.md` for each specification, where NNNN is four or more digits and a slug is lower-case words joined by hyphens. A specification in force MUST have a folder; a retired one MUST NOT.
- **FR-002**: A specification MUST begin `# Feature Specification: <title>`, carry `**Spec ID:**` naming its folder, `**Status:**` (Draft, Adopted or Superseded), `**Owner:**` and `**Domain:**`, and hold `**Input:**`, `## Edge cases`, `## Assumptions`, `## Open questions`, `## Key entities`, `## Success criteria` and `## Review & acceptance checklist` in that order, with `## Out of scope` (optional) before `## Edge cases`.
- **FR-003**: A requirement is `- **FR-nnn**:`, numbered in increasing order and never reused in its specification; every edge case MUST cite the requirements it exercises, and every one it cites MUST exist in its specification.
- **FR-004**: A specification of another repository MUST be cited with the repository's name before its number (`archon 0002-specs`); a bare number names a specification of the same folder and MUST exist there.
- **FR-005**: `enforcement.tsv` MUST have exactly one row, with four tab-separated columns (requirement, mechanism, who, note), for every requirement of every specification, and none for a requirement that does not exist. The mechanism is `check`, `gate`, `review` or `none`; `check` and `gate` name who as `<repository>: <command>`; `review` names the requirement that defines the review; `none` has `-` for who and says why in the note.

## The tool

- **FR-006**: `commons/tools/spec-kit-check.py` MUST check a folder against FR-001 to FR-005 using only the Python standard library, take the folder with `--root` (default `commons/spec-kit`), print every finding as `where: message`, write nothing, exit 1 where there is one, and offer `check(root)` for a harness that wants the findings as data.
- **FR-007**: The tool MUST NOT read a harness's ontology or run its commands: who owns a specification and whether a named command exists are the harness's to check, on top of it.

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

## Assumptions

- `archon`'s format is the model: commons keeps it small, and a harness adds its own rules.

## Open questions

- **OQ-1**: Whether `archon`'s own format check should run this tool for the rules they share, once the two have been compared line by line.

## Key entities

- **Spec-kit folder** - a register of numbers, a register of enforcement and the specifications.
- **Finding** - a place and a sentence saying what is wrong there.

## Success criteria

- **SC-001**: `python3 commons/tools/spec-kit-check.py` exits 0 on commons' own folder.
- **SC-002**: Each rule has a test that breaks it and sees it named.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
