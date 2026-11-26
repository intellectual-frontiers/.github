# Feature Specification: Actor trailers

**Spec ID:** 0004-actor-trailers
**Status:** Active
**Owner:** if
**Domain:** commons
**Governed by:** commons 0048-actors

**Input:** The trailers of a commit that name the actors, the vocabulary lint and the reading of Git history (commons 0048-actors FR-014, FR-063 to FR-065).

## Requirements

- **FR-001**: The codec MUST encode the actors of a commit as the trailers `Prepared-by`, `Directive` and `Reviewed-by`, in that order, in the form that `git interpret-trailers` reads, with an agent as its id and its model with the assurance.
- **FR-002**: The codec MUST decode the trailers of a message from its last paragraph (every line a trailer, a folded line joined to the one before) and MUST give an error for a trailer of this library that does not say what it must.
- **FR-003**: The lint of a commit MUST find an agent as the author of record, and an agent named in `Reviewed-by`, `Approved-by`, `Signed-off-by` or `Acked-by`.
- **FR-004**: The lint of a commit MUST find a draft that an agent prepared and that names no `Directive`, and a malformed trailer of this library.
- **FR-005**: The vocabulary lint MUST find the words `wrote`, `completed`, `approved`, `signed`, `confirmed`, `initiated` and `owns` where an agent is their subject, in the active and in the passive, and MUST NOT find them of a person.
- **FR-006**: The vocabulary lint MUST NOT read code in a fenced block or in backticks, and MUST NOT judge the style of a text: it never tries to tell that an agent wrote a text (commons 0048-actors FR-065).
- **FR-007**: The reading of history MUST give each commit with its author, its instant, its files and the actors its trailers name, and MUST NOT write to the repository.

## Acceptance scenarios

1. **Given** a message with `Prepared-by` and `Directive`, **When** it is decoded and its actors are encoded, **Then** the lines are the same, per FR-001 and FR-002.
2. **Given** a commit whose `Reviewed-by` names an agent, **When** it is linted, **Then** the finding names the trailer, per FR-003.
3. **Given** the text "The agent approved the plan", **When** the vocabulary lint runs, **Then** it finds approved, per FR-005.

## Out of scope

- Qualification and tasking certificates, the directive-first refusal of regulated verbs, the review canary and the dossier lens of commons 0048-actors: they come after the first acceptance run and are stated there.

## Edge cases

- A message with one paragraph has no trailers, per FR-002.
- The word approved of a person is not a finding, per FR-005.

## Assumptions

- The first version is the simplest slice that is valuable: it records, finds and lints; it refuses nothing at a verb (commons 0048-actors FR-022 is a finding first).

## Open questions

- None.

## Key entities

- **Actor** - a person, a system or an agent. **Act** - what the six roles are held in.

## Success criteria

- **SC-001**: The tests of this specification pass on Bun and on Node 26.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
