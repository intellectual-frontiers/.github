<!--
How to use this template

1. Copy it to spec-kit/specs/NNNN-kebab-case-slug/spec.md, where NNNN is
   the next unused four-digit number in spec-kit/specs/ (0001 is taken by
   the company spec itself).
2. Fill in every bracketed field. Each section below carries its own
   guidance comment, like this one — delete each comment as you fill in
   the section it explains, so nothing but real content ships.
3. Source every requirement and success criterion from something already
   committed: the constitution, context/, a unit charter, or another spec.
   If you catch yourself inventing a new rule to fill a gap, stop — that's
   a decision for the constitution or for whoever holds authority over it,
   not something a spec should quietly introduce.
4. Where the source material doesn't give a checkable answer, write
   `[NEEDS CLARIFICATION: ...]` and move on. A spec with an honest gap in
   it is more useful than one that guessed and sounded confident.
5. This produces a spec — what must be true, and how to check it. It is
   not a plan. Nothing about tooling, staffing, timelines, or how the work
   actually gets done belongs here.

This template was extracted from spec-kit/specs/0001-intellectual-frontiers/
spec.md after that spec was written and clarified, not designed in the
abstract beforehand — if a section here doesn't fit what you're
specifying, check whether 0001 solved the same problem differently before
deviating from it.
-->

# Feature Specification: [SPEC NAME]

**Spec ID:** [NNNN-kebab-case-slug]
**Status:** Draft — first pass
**Created:** [YYYY-MM-DD]
**Decision authority:** [who has final say over this spec's contents —
name a person or a named role, not a unit. Anything touching capital
allocation routes to Shahid N. Shah per the constitution's delegation
rule; name the actual owner for anything else.]
**Input:** [the request that produced this spec, close to verbatim]

## Why this document exists

<!-- One short paragraph. Name what this spec makes testable, and which
existing document it draws from (the constitution, a unit charter,
spec 0001, another spec). Cite the source instead of restating it. -->

This is not an implementation plan. It says what must be true, not how
the work gets done, what tools are used, or how it is staffed.

## Clarifications

<!-- Leave as "None yet." until a real clarification session happens. When
one does, append it here, oldest session first, and update every affected
requirement below so the requirement text and the answer never disagree.
Follow the format used in spec 0001: one dated "### Session YYYY-MM-DD"
heading, then a Q → A bullet per question resolved. -->

None yet.

## Primary scenario

<!-- One paragraph: the real situation this spec governs, as a sequence of
events — not a mission statement or a restatement of the unit's charter. -->

### Acceptance scenarios

<!-- Given/When/Then, numbered. Each one must be checkable against a real
situation, a specific trigger, and a specific required outcome. Fewer than
three usually means the spec is still too abstract to be useful. -->

1. **Given** [...], **when** [...], **then** [...].

### Edge cases

<!-- Situations that don't fit the primary scenario cleanly: conflicting
signals, missing authority, ambiguous ownership between units. State what
resolves each one, or mark it [NEEDS CLARIFICATION] if nothing in the
constitution or context/ resolves it yet. -->

## Requirements

<!-- Every requirement is a MUST / MUST NOT / MAY sentence, numbered
FR-001 upward, grouped under short subheadings once there are more than
five or six. If a sentence can't be checked against a real decision, it's
a principle, not a requirement — it belongs in the constitution instead.

Where the source material doesn't give a checkable answer, write the
requirement as far as it goes and append:
`[NEEDS CLARIFICATION: the specific thing that's undecided]`
Don't guess at a resolution to make the section look finished. -->

- **FR-001**: [Subject] MUST [testable behavior].

## Key entities

<!-- The nouns a reader needs defined to follow this spec: roles, artifact
types, related units, outside entities. One line each, linking to the
source (a unit charter, the constitution, another spec) instead of
redefining it here. -->

## Success criteria

<!-- Measurable, and independent of how the work gets done. "Customers
commit money, workflow change, data, or reputation" is a success
criterion; "we shipped three releases" is a process detail, not this. -->

- **SC-001**: [...]

## Out of scope

<!-- What this spec deliberately does not govern, and why — usually
because it's already governed elsewhere (cite it) or because it's a
plan-level decision rather than a spec-level one. -->

## Open questions

<!-- Every [NEEDS CLARIFICATION] marker above, collected here so they can
be scanned in one place. Remove an item only when a dated Clarifications
session above actually resolved it — never because you privately decided
what the answer should be. -->

## Review & acceptance checklist

- [ ] Every requirement is testable (MUST / MUST NOT / MAY), not aspirational
- [ ] No implementation detail — tooling, staffing, and org-chart decisions
      belong in a future plan
- [ ] Every requirement traces to an existing constitution, context, or
      spec file, or is explicitly flagged as new policy for the decision
      authority to confirm
- [ ] Ambiguities are marked `[NEEDS CLARIFICATION]`, not silently resolved
- [ ] Public-safe: no confidential information, no unverified number
      stated as settled fact

## Traceability

<!-- One row per requirement and success criterion, pointing at its
source. This is what lets a reader trust nothing here was invented. -->

| Requirement | Source |
| --- | --- |
| FR-001 | [...] |
