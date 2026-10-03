# Feature Specification: Spec format, status, and enforcement

**Spec ID:** 0020-spec-format
**Status:** Draft

**Input:** The shape every spec in the Eidolon takes, both in the public
root and in the vault: which sections it carries and in what order, what
its status means, how each of its requirements records what enforces it,
and how the format is checked. The format is derived from GitHub Spec
Kit's spec template; this spec states where it follows that template and
where it departs from it.

## Relationship to GitHub Spec Kit

- **FR-001**: A spec MUST follow Spec Kit's spec template (a numbered
  `NNNN-slug/spec.md`, an `Input`, numbered `FR-NNN` requirements in
  `MUST` / `MAY` / `MUST NOT` form, Key entities, Success criteria, Edge
  cases, and Assumptions) wherever this spec does not state otherwise.
- **FR-002**: A spec MUST be a standing statement of current rules, not a
  per-feature document tied to a branch. Spec Kit's plan, tasks, and
  implementation artifacts MUST NOT be created alongside a spec. The
  ontology takes the place of Spec Kit's data model, and the enforcement
  register (FR-011) takes the place of its cross-artifact consistency
  analysis.
- **FR-003**: A point a spec cannot yet decide MUST be recorded as an
  open question (`OQ-N`) rather than as an inline clarification marker.
- **FR-004**: User stories and acceptance scenarios MUST NOT be required.
  A spec that governs a person's interaction with software MAY carry
  them. Every spec MUST carry Edge cases instead (FR-006).

## Sections

- **FR-005**: A spec MUST carry, in this order: a title; the `Spec ID`,
  `Status`, and `Input` lines; one or more requirement sections; then the
  closing sections `Out of scope` (optional), `Edge cases`, `Assumptions`,
  `Open questions`, `Key entities`, `Success criteria`, and `Review &
  acceptance checklist`. A closing section with nothing to state MUST say
  so in one line rather than be omitted.
- **FR-006**: An edge case MUST state a boundary condition and cite the
  requirement(s) that resolve it. A boundary condition the spec's
  requirements do not resolve MUST be an open question instead, not an
  edge case.
- **FR-007**: An assumption MUST state a condition the spec takes as given
  and would need revisiting if it stopped holding. An assumption MUST NOT
  assert a company fact (0001-eidolon-architecture FR-002, FR-019): a fact
  belongs in the ontology.
- **FR-008**: Requirement identifiers MUST NOT be renumbered or reused. A
  new requirement takes the next unused number in its spec, whichever
  section it is placed in. A removed requirement's number stays retired.

## Status

- **FR-009**: A spec's status MUST be one of three, as the ontology's spec
  status scheme defines them: `Draft` (in force, and open to amendment by
  anyone working under 0001-eidolon-architecture FR-037), `Adopted` (in
  force, and amended only by the authority in effect or with its explicit
  approval), or `Superseded by NNNN-slug` (no longer in force; the named
  spec governs instead).
- **FR-010**: A spec MUST move from `Draft` to `Adopted`, or to
  `Superseded`, only by the authority in effect, per
  0001-eidolon-architecture FR-029. The move is a spec amendment, recorded
  by its commit message per 0001-eidolon-architecture FR-035, not a
  `Decision` individual, per 0008-decision-records FR-014. Neither an AI
  nor a check MAY make that move on its own judgment.

## Enforcement register

- **FR-011**: Each repository holding specs MUST keep an enforcement
  register at `spec-kit/enforcement.tsv` with exactly one row for every
  `FR-NNN` its specs define, and no row for any requirement that does not
  exist.
- **FR-012**: A row MUST name one mechanism, as the ontology's
  enforcement mechanism scheme defines them: `check` (a deterministic
  check fails when the requirement is broken), `gate` (a command refuses
  to proceed when it would be broken), `review` (a recurring or triggered
  review that a requirement defines), or `none`. Where more than one
  applies, the row MUST name the one that would catch a breach first.
- **FR-013**: A `check` or `gate` row MUST name the repository and the
  command that enforces it. A `review` row MUST cite the requirement that
  defines the review. A row MUST NOT claim a mechanism that does not
  actually test the requirement it is listed against; citing a
  requirement in a tool's comments is not enforcement.
- **FR-014**: A requirement enforced by nothing MUST be recorded as
  `none`, not omitted or credited to a general expectation that someone
  will notice. The check MUST report every `none` row on every run.

## Checking the format

- **FR-015**: The public root MUST check its own specs and enforcement
  register on every push and pull request, with a checker held in the
  public root itself, so that the check does not depend on access to the
  vault.
- **FR-016**: The vault MUST check its own specs and register against
  the same rules using the public root's checker, not a second
  implementation of them.
- **FR-017**: A spec or register that breaks FR-005, FR-006 (an edge case
  citing no requirement), FR-008 (a duplicated identifier), FR-009,
  FR-011, FR-012, or FR-013 (a missing command or citation) MUST fail the
  check.

## Out of scope

- Which specs are Adopted. That is for the authority in effect, per
  FR-010.
- The wording of any one spec's edge cases and assumptions; each spec
  owns its own.

## Edge cases

- A spec that governs a screen people use, where user stories would help:
  it may carry them, per FR-004, in addition to Edge cases.
- A requirement enforced partly by a check and partly by review: the row
  names the mechanism that would catch a breach first, per FR-012; the
  register holds one row per requirement, per FR-011.
- A requirement enforced only by a check in the vault: the public
  register still names it, by repository and command, per FR-013; the
  public check cannot run it but can verify the row is well-formed.
- A spec superseded by another: its status names the successor, per
  FR-009, and its requirements keep their register rows until it is
  removed, per FR-011.

## Assumptions

- Specs are Markdown files under `spec-kit/specs/` in each repository.
- The public root can run GitHub Actions without access to the vault.
- A requirement's enforcement can be described by a single dominant
  mechanism.

## Open questions

- **OQ-1**: No cadence is set for re-checking that each `check` row's
  command still tests the requirement it is listed against.

## Key entities

- **A spec status** — Draft, Adopted, or Superseded; whether a spec is in
  force and what it takes to change it.
- **The enforcement register** — one row per requirement, naming what
  catches a breach of it, or `none`.
- **An enforcement mechanism** — check, gate, review, or none.

## Success criteria

- **SC-001**: Every spec in both repositories carries the closing sections
  of FR-005 in order.
- **SC-002**: Every requirement in both repositories has exactly one
  register row.
- **SC-003**: Every run of the check lists the requirements enforced by
  nothing.
- **SC-004**: No spec's status changes except by the authority in effect,
  in a commit that says so.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
