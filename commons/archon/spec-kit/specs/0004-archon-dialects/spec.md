# Feature Specification: Archon dialects

**Spec ID:** 0004-archon-dialects
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A dialect is the package that turns an order into the input of one real tool (Ansible, OpenTofu, Microsoft DSC) and reads what the tool says back. This specification is the port that every dialect implements, in the Physical layer of Archon: what a dialect declares about what it can guarantee, what it renders, the plan of steps it gives the executor of headless, and the matrix that says, for every requirement and every dialect, what is expressed and what is not. A dialect builds no convergence engine: the tool is the engine.

## Requirements

- **FR-001**: A dialect MUST be a value with an id, the name and the pinned version of its tool, its guarantees, a function that renders an order and a plan to files and a function that gives the steps a plan needs, so that the port is the whole of what the library knows of a tool.
- **FR-002**: A dialect MUST declare its guarantees as data: the kinds of resource it can carry out, the classes of subject it can reach, whether its plan is `faithful`, `partial` or `none` (whether its check mode shows what would change), whether its idempotence is `proven` or `unproven`, and whether it can destroy.
- **FR-003**: `expressibility` MUST say, for a requirement and a dialect, whether each annotation of the requirement is expressed, carried or unexpressed, with the reason where it is unexpressed: the kind and the subject class are expressed where the dialect lists them, the change class `destructive` is expressed only where the dialect can destroy, the fidelity of the plan that the requirement asks for is expressed only where the dialect's plan is at least that faithful, and a verification that names a query is carried.
- **FR-004**: `matrixOf` MUST give, for a list of requirements and a list of dialects, one row for each requirement and one cell for each dialect, each cell with the state of each annotation, and `matrixTotals` MUST count the cells by state, so that an unexpressed annotation is a named finding and never a surprise.
- **FR-005**: `executionPlanOf` MUST make the plan of steps for the executor of headless from the entries of a plan that change something: each step MUST carry the argument vector of an apply and, where the tool has a check mode, the argument vector of a check, a step for a destructive entry MUST be refused where it has no check, and the argument vectors MUST name the digest of the rendered files so that the hash of the plan covers what is rendered.
- **FR-006**: What a dialect renders MUST be generated: `renderHeader` MUST give the line that says so for a kind of file, `isGenerated` MUST find it, and the digest of a rendered set of files MUST be the SHA-256 of the files in the order of their paths, so that it does not depend on the order they were made.
- **FR-007**: A step of a dialect MUST be an `ArgvStep` of `@intellectual-frontiers/core` (the words, `as` `user` or `root`, and the exit codes expected), never a shell string; `executionPlanOf` MUST carry the steps as argument vectors and a test MUST find no shell string in the output of any dialect.
- **FR-008**: Archon MUST have no dialect of a first-boot hook (cloud-init, kickstart, preseed) (0006-archon-on-workload FR-012).

## Acceptance scenarios

1. **Given** a dialect that lists `package` and a requirement for a `package`, **When** the expressibility is asked, **Then** the kind is expressed, per FR-003.
2. **Given** a dialect that cannot destroy and a destructive requirement, **When** the expressibility is asked, **Then** the change class is unexpressed with the reason, per FR-003.
3. **Given** a dialect whose plan is `none` and a requirement that asks for a faithful plan, **When** the expressibility is asked, **Then** the plan fidelity is unexpressed, per FR-003.
4. **Given** two requirements and two dialects, **When** the matrix is made, **Then** it has two rows and each has two cells, and the totals add up to the number of annotations judged, per FR-004.
5. **Given** a destructive entry and a dialect step with no check, **When** the execution plan is made, **Then** it is refused, per FR-005.
6. **Given** the same files made in two orders, **When** their digests are taken, **Then** they are equal, per FR-006.

## Out of scope

- The dialects: each is a package of its own with its own specification kit, and each runs its real tool; the operating system package managers are one table-driven adapter in the kit of the managers (commons package-managers 0005-package-managers-adapter), and the dialect of pinned native tools keeps in TypeScript only the choice of the pin, the typed fetch step and the verify step.
- Running the plan: the executor of headless.

## Edge cases

- A dialect with no kinds: every requirement is unexpressed for it, per FR-003.
- A plan whose entries all say `none`: there is nothing to carry out and no plan of steps is made, per FR-005.

## Assumptions

- The executor of headless has a check mode and an apply mode, and refuses an apply whose plan hash has changed (commons headless 0012-executor-check-mode).

## Open questions

- None.

## Key entities

- **Dialect** - the port that a package for one tool implements.
- **Guarantees** - what a dialect says it can do, as data.
- **Matrix** - a requirement against a dialect, annotation by annotation.

## Success criteria

- **SC-001**: For every requirement and every dialect a reader can see what is expressed and what is not, and why.
- **SC-002**: A plan of steps cannot name a destructive step that cannot check, or steps that do not name what was rendered.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
