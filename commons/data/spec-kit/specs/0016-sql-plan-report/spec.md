# Feature Specification: The plan report

**Spec ID:** 0016-sql-plan-report
**Status:** Active
**Owner:** if
**Domain:** data

**Input:** A person who approves a migration needs to read what it will do in terms of what governance says, not in terms of SQL: which personal data it touches, what is classified, who answers for it, which requirements it is for, what it keeps and what it destroys, and how long it holds which lock. The plan report is made from a plan and the governance before and after it, with nothing else. It says each step's class, reversibility, idempotency and lock; what governance says of every element a step is made from; what governance itself changes between the two versions; who has to approve it and why; and what is new, in the words governance gave each new element. It is Markdown for a person and JSON for a program, the same content in both, the same every time, and it can be recorded in the database so that the database says what happened to it.

## What the report says

- **FR-001**: The report MUST give, for a plan, the dialect, the state it starts from and the state it ends in, the number of steps by class, by reversibility and by idempotency, and for each step its number, name, class and why, reversibility, idempotency and the lock it takes.
- **FR-002**: The lock of a step MUST be the strongest the step takes, stated from what the engine documents for the change, for a dialect that has locks with a timeout, and MUST say that the engine allows one writer for a dialect that has none; it is an estimate and MUST be marked as one.
- **FR-003**: For each step the report MUST give what governance says of the elements the step is made from, taken from the schema after the plan and, for an element that the step removes, from the schema before it: personal data (the category, the class DPV puts it in and the purposes), classification, access, scope, mask, retention and the requirements it cites.
- **FR-004**: The report MUST give what governance itself changes between the two schemas: each annotation added, removed or changed, by the element it is on.
- **FR-005**: The report MUST give, for each step, who has to approve it: the steward (or the owner where there is no steward) of each concept the step touches, and a role the settings give for a step that touches personal data, for one that touches a restricted element and for one that is destructive or manual; each approver MUST come with the reason.
- **FR-006**: The report MUST give what is new, the tables and columns the plan makes, each with the description governance gave it.

## How it is given

- **FR-007**: The report MUST be Markdown for a person and JSON for a program with the same content, the same for the same plan and schemas every time, with a text of governance escaped for the Markdown it is written into, and MUST be given as files (`<domain>.plan.md`, `<domain>.plan.json`) through the generators' own file type.
- **FR-008**: Where the schema before the plan is not given, the report MUST say that the governance of what the plan removes and the changes of governance are not known, and MUST NOT guess them.
- **FR-009**: The settings MUST be a typed value with a default for each: the role for personal data (`privacy`), for a restricted element (`security`) and for a destructive or manual step (`owner`), and whether the steward is routed to (`on`).

## In the database

- **FR-010**: The report MUST be able to be recorded in a table of the database (`governance_migration`, one row for each step with its name, class, reversibility, idempotency, approvers and elements), made with the dialect's own types, loaded by an upsert, in the schema of the tables, so that loading it twice leaves the same rows and the database says what happened to it.

## Out of scope

- Sending the report to the people who approve, or holding their approval: a project's workflow.
- A drawing of what the plan changes: a later generator.
- A cost, in time, of a step: it depends on the data.

## Edge cases

- A step that drops a column of personal data: the report names the category and the role for personal data as an approver, per FR-003 and FR-005.
- A plan with no step: a report that says so, per FR-001.
- A concept with an owner and no steward: the owner is routed to, per FR-005.
- No schema before: per FR-008.
- A description with a pipe or a line break: escaped, per FR-007.
- Recorded twice: the same rows, per FR-010.

## Assumptions

- The lock a change takes is what the engine documents for it; the report does not measure it.
- Governance is read from what the logical schemas carry on each table and column.

## Open questions

- **OQ-1**: Whether the approvals the report asks for are themselves recorded in the ledger, as a signed entry, before a step may run.

## Key entities

- **Report** - what a plan does in the words of governance, for a person and for a program.
- **Approver** - a role that has to say yes to a step, with the reason.
- **Migration record** - a row of `governance_migration` for a step.

## Success criteria

- **SC-001**: Someone who has never read SQL can say, from the report alone, what a plan changes, what it could lose and who has to agree.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
