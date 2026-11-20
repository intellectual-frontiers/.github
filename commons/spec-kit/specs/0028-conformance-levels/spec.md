# Feature Specification: Conformance levels

**Spec ID:** 0028-conformance-levels
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** Mizan asks of a harness everything at once: the format, the rules, the audit of terms, change control, release control. A library, a service or a small tool that wants to be known by commons, and to be proved, should not have to start there. Four conformance levels, stated once as typed data in Mizan's ontology, say how much of Mizan a subject is held to: L0 registered (it is known), L1 core (it keeps and proves its own specifications), L2 standards (its terms rest on standards first) and L3 governed (its changes and its releases are controlled). Each level adds to the one below it. A harness declares its level and the check runs only the rules that level entails; a harness that declares none is at L3, which is what every harness is held to today, so that nothing changes for one that does not ask. What kind of thing a subject is, and what a specification of each kind must say, is 0029-subject-profiles.

## The levels

- **FR-001**: Mizan's ontology MUST hold the four conformance levels as individuals of the code list `mz:ConformanceLevel`, each with an `mz:levelRank`: `mz:Registered` (L0, rank 0), `mz:Core` (L1, rank 1), `mz:Standards` (L2, rank 2) and `mz:Governed` (L3, rank 3); a level MUST entail every requirement that it and every level of a lower rank adds.
- **FR-002**: Each thing a level asks MUST be an individual of the code list `mz:ConformanceRequirement`; each level MUST name the requirements it adds with `mz:entails`, a requirement MUST be added by exactly one level, and a requirement MUST say what proves it, as the ids of the rules of Mizan's check (`mz:rule`) or in words (`mz:enforcedBy`), and never neither.
- **FR-003**: L0 (`mz:Registered`) MUST add three requirements: a manifest, a verify command and a version.
- **FR-004**: L1 (`mz:Core`) MUST add eight requirements: a spec kit of its own; its own verify; requirements worded with RFC 2119 keywords in EARS patterns; acceptance scenarios in Gherkin that cite the requirements; one row of the register of proofs for each requirement; the trace of sources and tests to the specifications (`Spec:` and `Proves:` lines); baselines that only shrink; and the check of citations.
- **FR-005**: L2 (`mz:Standards`) MUST add the audit of terms: every term of the subject's ontology has a record of the standard it rests on (adopts, specializes, maps) or, where no standard names it, a justification and an `mz:Decision` to keep it unaligned (0018-standards-first), and a specification names only terms that are defined.
- **FR-006**: L3 (`mz:Governed`) MUST add three requirements: change control by IFCCM (every commit names an issue, 0020-ifccm), release control by IFR (every work has a release record and a version that grows by its scheme, 0026-works-versioning) and the quality records of IFQS (0021-ifqs).
- **FR-007**: A rule that a requirement names with `mz:rule` MUST be a rule of Mizan's check that exists, or a family `prefix/*` that at least one rule belongs to, so that no level asks for a rule that is not there.

## Checking by level

- **FR-008**: `holdHarness` MUST take an optional `level` (`L0`, `L1`, `L2` or `L3`) and MUST take `L3` where it is not given; at `L3` its findings, its use of the baseline and its exit status MUST be what they were before levels existed, so that a harness that declares no level sees no change.
- **FR-009**: WHEN a harness declares a level below L3, the check MUST run only the rules that level entails: a rule is run at a level when a requirement of that level or a lower one names it, a rule that no requirement names (a rule a harness adds, `mizan/authority-citation`, the checks of 0029-subject-profiles) MUST run at L1 and above, and at L0 no rule MUST run.
- **FR-010**: A line of the baseline for a rule that the level does not run MUST be neither new nor stale, and `--write-baseline` MUST keep it, so that lowering a level never loses a held finding and raising it again finds it where it was.
- **FR-011**: `commons/libraries/src/check.ts` MUST take `--level L0|L1|L2|L3`, MUST hold commons' own folder at L3 where it is not given, and IF the level is not one of the four, THEN it MUST exit 2 and name the four.
- **FR-012**: `check.ts` MUST, with `--all`, also run the `verify` of every library that a manifest declares (0027-commons-libraries FR-012), each from its own folder, report the status of each by name and exit 1 where any fails; without `--all` it MUST stay fast: it MUST run no library's `verify` and MUST NOT read inside a library's folder.
- **FR-013**: A library's `verify` MUST run the Mizan check on its spec kit at the level its manifest declares, with `--level` of that level where it is not L3 (0027-commons-libraries FR-013).

## Acceptance scenarios

1. **Given** a folder of specifications with a requirement that has no RFC 2119 keyword and a baseline that holds it, **When** `holdHarness` runs at L3 and again with no level, **Then** the two runs print the same findings and exit with the same status, per FR-008.
2. **Given** a requirement with no keyword and an unaligned term with no decision, **When** `holdHarness` runs at L1, **Then** it reports the requirement and says nothing of the term, and at L2 it reports both, per FR-009.
3. **Given** a baseline that holds a line of `mizan/decision-missing`, **When** `check.ts --write-baseline` runs at L1, **Then** the line is still in the file, per FR-010.
4. **Given** `check.ts --level L9`, **When** it runs, **Then** it exits 2 and names L0, L1, L2 and L3, per FR-011.
5. **Given** a library whose `verify` fails, **When** `check.ts --all` runs, **Then** it names the library, its status and exits 1, and `check.ts` without `--all` runs no `verify`, per FR-012.

## Out of scope

- What kind of thing a subject is and what its specifications say of it: 0029-subject-profiles.
- How a library declares its level and is registered: 0027-commons-libraries (the manifest).
- Splitting commons' TypeScript into packages, and any change to a consumer: a harness that declares no level is at L3 and sees no change.

## Edge cases

- A harness that declares no level: L3, the rules it has always run, per FR-008.
- A level that is not one of the four, in code or on the command line: refused, with the four named, per FR-011.
- A harness at L1 whose baseline holds the findings of the audit of terms: the lines are not stale and are kept when the baseline is written, per FR-010.
- A rule a harness adds, which no requirement names: it runs from L1, per FR-009.
- A harness at L0: no rule runs and the check passes, naming the level, per FR-009.
- A requirement of a level that names a rule that does not exist: the test finds it, per FR-007.
- A requirement that two levels both add: the test finds it, per FR-002.
- A requirement that names neither a rule nor what else proves it: the test finds it, per FR-002.
- A library that declares L1 and whose `verify` runs the check at L3: found, per FR-013.
- `check.ts --all` where a library's `verify` is not there: its failure is named, per FR-012.

## Assumptions

- The levels are cumulative: no subject skips one, and L3 is what a regulated domain needs from the day it declares production (0016-ladder FR-011).
- A rule's level is the lowest level whose requirements name it; the ontology says it, and the code reads the ontology.

## Open questions

- **OQ-1**: Whether an L3 subject must also pass the checks of 0029-subject-profiles in the gate phase of IFCCM and not only as warnings held by a baseline: to be settled when the first service is specified.

## Key entities

- **Conformance level** - one of L0, L1, L2, L3, with its rank and the requirements it adds.
- **Conformance requirement** - one thing a level asks, with the rules and the checks that prove it.
- **Declared level** - the `level` a harness gives `holdHarness`, or a library's manifest gives, L3 where none is given.

## Success criteria

- **SC-001**: A harness that declares no level has the same findings and the same exit status as before, which the check of each harness shows.
- **SC-002**: A library can be registered at L0 with a manifest and nothing else read, and raised one level at a time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
