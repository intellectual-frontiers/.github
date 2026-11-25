# Feature Specification: The ladder

**Spec ID:** 0016-ladder
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** The architecture of a harness of Intellectual Frontiers as one ladder of rungs, stated once in commons as typed data, so that a harness states its own homes, rungs and checks as an instance of it instead of keeping its own copy of the idea. The rungs, lowest first, are 0 the ontology, 1 the specifications, 2 governed data, 3 data operations, 4 infrastructure rules, 5 business rules, 6 the application (headless hosts, then windowed hosts) and 7 documentation, with an optional rung 8 for the lifecycle of what is retired and then archived, an observer rung 9 for the evidence the system records about itself, and an environment rung 10 for the workspace where the work is done.

## The ladder

- **FR-001**: The ladder MUST be typed data in commons' ontology: a `Rung` class whose individuals each carry a number, a name, a purpose, the homes of its files (paths and globs), the numbers of the rungs it may rely on, the commands that prove it and, where a harness traces its terms to its specifications, the specifications it comes from (`spec`), in TypeScript on the kernel's RDF (0012-ontology).
- **FR-002**: Rungs 0 to 7 MUST be required: 0 ontology, 1 specifications, 2 governed data, 3 data operations, 4 infrastructure rules, 5 business rules, 6 application (the headless hosts, then the windowed hosts) and 7 documentation. A rung 8, the lifecycle (what is retired, alive but not to be used, then what is archived, dead and safe to delete), MUST be optional: where a harness has it, it relies on no rung and no rung relies on it.
- **FR-003**: A rung MUST rely only on the rungs below it that it names, and never reach around the rung under it (dependency direction); a change MUST be complete only when every rung it touches is updated and proved by that rung's checks, lowest first (order of work).
- **FR-004**: Headless first: rungs 0 to 5 MUST be headless; rung 6 MUST hold the headless hosts before the windowed ones, and every operation a window offers MUST also be a command or a tool.

## A harness's instance

- **FR-005**: A harness MUST state its ladder as individuals of `Rung` in its own ontology, and MAY add homes, checks and rely-on edges to a rung; it MUST NOT renumber, rename or drop rungs 0 to 7, and MUST NOT renumber or rename rungs 8 to 10, and a rung it leaves empty MUST say why.
- **FR-006**: Every folder, package and file of a harness MUST be on exactly one rung, by the most specific of the rungs' homes, and a TypeScript import MUST NOT climb to a higher rung or reach around the one under it; the checks are 0015-trace FR-009 and 0015-trace FR-010, run by the tools of 0003-mizan.
- **FR-007**: A harness's constitution table of the ladder and the layout in its `AGENTS.md` MUST be generated from its instances between marker comments (`<!-- ladder:begin -->` and `<!-- ladder:end -->`, `<!-- layout:begin -->` and `<!-- layout:end -->`), and its generator's `--check` MUST fail where either differs.
- **FR-008**: Every rung MUST have exactly one kind, a member of the code list `mz:RungKind`: `required` (rungs 0 to 7), `optional` (rung 8), `observer` (rung 9) or `environment` (rung 10); the kind MUST be what the checks branch on, not the number.
- **FR-009**: A rung 9, the evidence, MUST be of kind `observer`: the records the system produces by operating (test and check runs, findings, nonconformances, corrective actions, change records, attestations), append-only and never written by hand. It MAY rely on rungs 0 to 7 for the shapes of what it records, it MAY observe rungs 8 and 10 without relying on them, and no rung MUST rely on it, so that evidence cannot authorize itself.
- **FR-010**: A rung 10, the workspace, MUST be of kind `environment`: the controlled working environment everything is built in (the layout of repositories on a machine, the approved tools, the policy and hooks). It MUST rely on no rung and no rung MUST rely on it; rung 9 records what it does.
- **FR-011**: Where a harness claims a regulated domain, rungs 9 and 10 MUST be required of it from the day it declares production; a harness that claims none MAY omit them, and a harness that omits one MUST NOT use its number for anything else.

## Out of scope

- Which folders a particular harness puts on which rung: each harness states its own homes.
- Checking imports and file placement: `0015-trace`.

## Edge cases

- A harness with no windowed hosts: rung 6 holds only the headless hosts, per FR-002 and FR-004.
- A harness with nothing retired or archived: it states no rung 8, per FR-002.
- A harness that renames rung 3: refused, per FR-005.
- A harness that leaves rung 2 empty: it says why in the rung's purpose, per FR-005.
- A constitution table edited by hand: the generator's check names the difference, per FR-007.
- A rung-5 file that imports a rung-2 file when rung 5 may rely on 0, 1, 3 and 4: refused, per FR-003 and FR-006.

## Assumptions

- The ladder is Intellectual Frontiers' own architecture: no consensus standard names it (ISO/IEC/IEEE 42010 describes architecture descriptions and layered architectures are common practice, but neither defines these rungs), so `0018-standards-first` treats it as `unaligned`, with that reason as its justification.
- A harness states its ladder as an instance of this one when it moves to Mizan (issue #10, Phase 6).

## Open questions

- **OQ-1**: The Decision individual that records why the ladder is `unaligned` (`0018-standards-first` FR-005) is written within its 90 days.

## Key entities

- **Rung** - one level of the ladder, with its number, name, kind, purpose, homes, what it may rely on and what proves it.
- **RungKind** - what kind of rung a rung is: required, optional, observer or environment.
- **Instance** - a harness's own individuals of `Rung`.

## Success criteria

- **SC-001**: A harness's ladder, as individuals of `Rung`, is the only place its rungs are stated, and its constitution table and layout are made from them.
- **SC-002**: A harness that departs from rungs 0 to 7 fails its check.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
