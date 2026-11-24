# Feature Specification: AnyFS Bridge: plans

**Spec ID:** 0002-bridge-plans
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A transfer is a plan before it is anything else: the modes, the rails and the filters, the actions in a fixed order, what a destination would not keep, and a hash of the whole.

## Requirements

- **FR-001**: A mode MUST be one of `copy` (never deletes), `sync` (makes the destination equal and deletes only within an allowance), `move` (copies, checks and removes the source) and `check` (only compares); a delete policy MUST forbid deletes or allow at most a number of them, and a comparator MUST be one of `native-digest`, `size-mtime` and `content-hash`.
- **FR-002**: An action MUST be one of `create`, `update`, `rename`, `delete`, `remove-source`, `skip` and `conflict`, each a value that can be said in one sentence, and a plan MUST list them in the order create, update, rename, delete, remove-source, skip, conflict and, within a kind, in the order of their paths, so that the same two trees give the same plan.
- **FR-003**: The rails of a transfer MUST be `include`, `exclude` and `protect` (patterns), `maxFiles`, `maxBytes` and `maxObjectBytes`, `requireEmptyDestination` and `neverOverwrite`; a plan that crosses a limit or finds a destination that is not empty where it must be MUST be refused as a value that names the rail, and a file the rails keep out MUST NOT be in the plan.
- **FR-004**: What a destination would not keep of a file MUST be a loss of one of the kinds `unportable-name`, `too-large` and `case-folded`, in the plan beside the action and in the list of the plan; a plan MUST say that a transfer carries bytes alone; and with `strict` a plan that loses anything MUST be refused with the losses.
- **FR-005**: The hash of a plan MUST be the SHA-256 of its canonical text, in which every object has its keys in order and nothing depends on how the plan was made: two plans of the same stores MUST have the same hash, and a plan changed in any way MUST have another.
- **FR-006**: A pattern MUST be a glob of `/`-separated segments in which `*` is any run of characters and `?` any one character in a segment and a segment `**` is any number of segments; a pattern with no `/` MUST match wherever a segment of a path matches it and one with a `/` MUST be anchored at the root; a pattern MUST be refused where it is empty, longer than 512 characters, holds a NUL or a backslash or an empty segment, or uses `**` inside a segment; and matching MUST take no more than the product of the lengths and MUST NOT use a regular expression.
- **FR-007**: A rewrite MUST be a pure function from the path at the source to the path at the destination that ends with the reason where it cannot; the library MUST give the rewrites that add a prefix, strip one, fold the case and compose.

## Acceptance scenarios

1. **Given** a mode that copies, **When** it is described, **Then** it says it deletes nothing, per FR-001.
2. **Given** two stores, **When** the plan is made twice, **Then** the actions and the hash are the same, per FR-002 and FR-005.
3. **Given** a destination that holds nothing larger than five bytes and a file of ten, **When** the plan is made, **Then** the file is left and the loss is named, and with `strict` the plan is refused, per FR-004.
4. **Given** the pattern `*.tmp`, **When** it is matched with `a/b/c.tmp`, **Then** it matches, and `src/*.ts` does not match `lib/src/a.ts`, per FR-006.
5. **Given** a hostile pattern of many stars, **When** it is matched with a long name, **Then** it ends at once, per FR-006.

## Out of scope

- Rules written as regular expressions; a pattern language with classes or negation.
- Metadata other than bytes (type, time, mode): the core of AnyFS does not carry them.

## Edge cases

- Two files that differ only by case are alike at a destination that folds the case, which is a conflict and not a loss (0003-bridge-transfer FR-007).
- A pattern of one segment excludes a whole subtree where its name is a directory of the path (FR-006).

## Assumptions

- A path is a normalized relative path of AnyFS (anyfs 0002-anyfs-governance FR-002).

## Open questions

- None.

## Key entities

- **Mode**, **DeletePolicy**, **Comparator**, **Action**, **Plan**, **Rails**, **Glob**, **Loss**, **PlanRefusal**, **Rewrite**.

## Success criteria

- **SC-001**: Every behaviour is tested over stores in memory and, where it touches a file system, stores in a folder, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
