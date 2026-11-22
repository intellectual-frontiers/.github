# Capabilities configuration (IFCCM)

Intellectual Frontiers Capabilities Configuration Management is how change is controlled: the unit of change is a capability, every commit names the issue it serves, and each requirement can be followed from its issue to the test run that proved it ([commons 0020-ifccm](../../spec-kit/specs/0020-ifccm/spec.md)).

What a specification binds, what a Decision authorizes, what a check verifies and what an issue only plans are kept apart. The abbreviation "CCM" is never used alone, because it is also the name of the Cloud Security Alliance's Cloud Controls Matrix.

**A Decision** is an entry of `decisions` in the harness's `ifccm.declaration.ts`, read as data and never run: `{ id, approvedBy, covers, record?, reason?, decidedOn? }`. `covers` names a requirement (`NNNN-slug FR-nnn`, for a departure), `gate-relaxed <revision>` (a declaration relaxed by an earlier commit) or `no-issue <revision>`: the one commit, which cannot be amended, that the owner exempts from naming a change request (0020-ifccm FR-046 to FR-048). A Decision that covers `no-issue <revision>` names a person as `approvedBy` (never a role), the day as `decidedOn` and a `reason`; the check says the commit is covered, and reports as `changes/decision` a Decision that is unsound, names a revision outside the range, an ambiguous prefix, or a commit that already names an issue.

```ts
export const decisions = [
  {
    id: "D-NO-ISSUE-8158b35b48b9",
    approvedBy: "Shahid Shah",
    decidedOn: "2026-11-22",
    covers: ["no-issue 8158b35b48b9"],
    reason: "Made on 2026-11-21 13:38 UTC by the book session outside `repoctl commit`, carrying no issue reference; the content is the owner's own chapter.",
  },
];
```

**Where to see it.** The terms are in the `ifccm:` ontology, and the check is `commons/libraries/src/changes.ts`. The quality records that a change leaves are the quality system's ([IFQS](concept-ifqs.md)).
