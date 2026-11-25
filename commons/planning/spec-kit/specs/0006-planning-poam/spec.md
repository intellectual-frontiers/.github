# Feature Specification: Planning plan of action and milestones

**Spec ID:** 0006-planning-poam
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A plan of action and milestones (a POA&M) and a work order are made of the items Planning already has, with no new kind of item: a POA&M entry is an item of kind `finding` whose milestones are linked items of kind `task`, each with a day it is due and an owner, and a work order is an item of kind `task` linked to the runbook it runs and to the finding or issue it serves. The core of an item (commons planning 0002-planning-core FR-002) has owners (its assignees) and no day a task is due, so this specification adds that one field to the kind `task`, as 0002-planning-core FR-002 allows a kind to do, and adds two views, `poam` and `workOrders`, that read it. It realizes commons 0037-planning FR-001, FR-009, FR-021 and FR-046 and only cites upward. The writing of a POA&M in OSCAL is the library `grc` (its own spec kit); the relation of SQL is `planning-query` (its own spec kit).

## Requirements

- **FR-001**: The kind `task` MUST add one field of its own to the core, `due`, a day (a real day, YYYY-MM-DD, built by the smart constructor of 0002-planning-core FR-003) by which the task is expected to be done; the opening of an item MAY carry it, an `edited` event MAY set it again and the last such event in the order of the fold counts (no authority is asked of it); an opening of any kind other than `task` that carries it MUST be refused when the event is built, an `edited` event that sets it on an item that is not a task MUST change nothing, and no field of the core MUST be removed or changed (0002-planning-core FR-002, FR-005, FR-006; commons 0037-planning FR-001, FR-046).
- **FR-002**: The field `due` MUST be kept as every field a source carries is kept: by the observation and by its reconciliation into the opening, by the records of events and items in JSON5 (encoded in the order of the names of its keys and decoded totally, a value that is not a day being an error value), and by the matrix of what a source can hold, where each source MUST say how `due` ends for it, so that a source that says nothing of it is a finding (0003-planning-reconcile FR-001, FR-013; 0002-planning-core FR-011; commons 0037-planning FR-015, FR-046).
- **FR-003**: A milestone of a finding MUST be an item of kind `task` that the finding is the parent of (a link of kind `parent-of` from the finding to the task); its owners MUST be its assignees, its day due its `due`, and its state the state of the item, so that a milestone is closed `completed` when it is done and a milestone closed `not-planned` or `duplicate` is no longer part of the plan; no new kind of item and no new kind of link MUST be made for it (commons 0037-planning FR-001, FR-009).
- **FR-004**: The control references of a finding MUST be carried as its labels of the form `control:<reference>`, where the reference is written as the catalogs and the assessments of commons write a control (the control URN of the library `grc`, `urn:grc:<framework>:<version>:<control>`), any number of them and of any number of frameworks, so that one finding may bear on the controls of several regimes; Planning MUST keep the reference as written and MUST NOT parse, translate or invent one, which is the work of the library that owns the reference.
- **FR-005**: The view `poam` MUST be a pure function of the items and of a day (the day is an argument, and no clock is read) that gives one row for each counted finding that is not closed, and for each row: the finding (its id, title, body, severity and state), its controls (the references of FR-004, sorted), its owners (the assignees of the finding), its milestones, its scheduled completion (the latest `due` among its milestones, none where no milestone has one) and its status; the rows MUST be in the order of the scheduled completion (earliest first, none last) and then of the id, the milestones in the order of their `due` (none last) and then of their id, and the same items and day MUST give the same rows in any order of the items; `planctl views` MUST offer it as `--view poam` (and the work orders of FR-007 as `--view work-orders`) with the day as `--today` and the day of the run where none is given, a day that is not a day being refused.
- **FR-006**: A milestone's status MUST be `completed` where its item is closed with the reason `completed`, `delayed` where it is not closed, has a `due` and that day is before the day given, and `open` otherwise; a finding's status MUST be `completed` where it has at least one milestone and every milestone is completed, `delayed` where any of its milestones is delayed, and `open` otherwise; a proposed milestone, a milestone that is not a task, a link to an item that is not among the items and a milestone closed `not-planned` or `duplicate` MUST NOT be a milestone of a row; a finding that is closed MUST NOT be a row, whatever the status of its milestones.
- **FR-007**: A work order MUST be an item of kind `task` that carries a label `runbook:<id>` (the id of the runbook it runs, as the library of runbooks names it) and is linked to the finding, issue or milestone it serves by a link of kind `relates-to` between the two, in either direction; the view `workOrders` MUST be a pure function of the items and of a day that gives, for each counted work order that is not closed, its runbook, the items it serves (sorted by id), its owners, its `due`, its state and its status (`completed`, `delayed` or `open` as FR-006 says of a milestone), in the order of the `due` (none last) and then of the id; a work order with no `runbook:` label MUST NOT be a work order, and no new kind of item or of link MUST be made for it.
- **FR-008**: The views of this specification MUST be pure and typed as the algebra of 0002-planning-core FR-008 and FR-009: they read no file, call no network and take no clock, and hold no `any`, non-null assertion, `enum` or cast but `brand` (commons 0037-planning FR-022, FR-041).

## Acceptance scenarios

1. **Given** an opening of a task with a day it is due, **When** it is folded and then an `edited` event sets another day, **Then** the item has the second day, and **Given** an opening of a finding with a due day, **When** the event is built, **Then** it is refused, per FR-001.
2. **Given** an event of a task with a day, **When** it is encoded and decoded again, **Then** it is the same event and the key is in the order of its name, and **When** the day is not a real day, **Then** decoding gives an error value, per FR-002.
3. **Given** a source that gives no cell for `due`, **When** the matrix is checked, **Then** the finding names the field and the source, per FR-002.
4. **Given** a finding that is the parent of three tasks, one closed as completed, one not planned and one open, **When** the view is made, **Then** the row has two milestones, per FR-003 and FR-006.
5. **Given** a finding that carries the labels `control:urn:grc:nist-800-53:5.2.0:AC-2` and `control:urn:grc:iso-27001:2022:A.5.15`, **When** the view is made, **Then** both references are in its row as written, per FR-004.
6. **Given** two milestones due on 2027-03-01 and 2027-01-15 and the day 2027-02-01, **When** the view is made, **Then** the scheduled completion is 2027-03-01, the first milestone is open and the second is delayed, and the finding is delayed, per FR-005 and FR-006.
7. **Given** every milestone of a finding closed as completed, **When** the view is made, **Then** the finding is completed and still a row, and **When** the finding itself is closed, **Then** it is not a row, per FR-006.
8. **Given** the same items in two orders, **When** the view is made, **Then** the rows are equal, per FR-005.
9. **Given** a task with the label `runbook:synthetic-runbook-01` linked `relates-to` a finding and a task with no such label, **When** `workOrders` is made, **Then** one work order is listed, with the finding it serves, per FR-007.

## Out of scope

- The OSCAL document that a POA&M is written as (the library `grc`) and the relation of SQL (the library `planning-query`).
- A runbook itself (the library of runbooks): Planning holds only the label that names it.
- Any change of the state of a milestone or of a work order by a view: the views read and write nothing.

## Edge cases

- A finding with no milestone: a row with no scheduled completion and the status `open`, per FR-005 and FR-006.
- A milestone with no `due`: it is never delayed, and it does not give the scheduled completion, per FR-005 and FR-006.
- A deferred finding (a risk accepted until a day, as the library `findings` writes it): it is a row, its state says `deferred`, per FR-005.
- A task that is the child of two findings: it is a milestone of each, per FR-003.

## Assumptions

- A day due is a day and not an instant: a milestone is delayed only from the day after its `due`.
- Owners are the assignees as the sources give them (an id of a person or a login), and Planning does not resolve them to people.

## Open questions

- None.

## Key entities

- **Milestone** - a task that a finding is the parent of, with a day due and owners.
- **POA&M entry** - a finding that is not closed, with its milestones.
- **Work order** - a task with a `runbook:` label, linked to what it serves.

## Standards considered

Each source below was read from its primary text on 2026-11-25; an IRI is written only where it was read, and a design choice of Planning is marked as the library's.

| Standard (version) | What Planning takes from it | Section read | Chosen |
| --- | --- | --- | --- |
| IETF RFC 5545, Internet Calendaring and Scheduling Core Object Specification (iCalendar), September 2009 | The property `DUE` of a to-do is "the date and time before which a to-do is expected to be completed", its value type DATE-TIME by default and DATE where set so | 3.8.2.3 | `due` is a day, the DATE form of `DUE`; the library's name for it is `due`, and the ontology `plan:` names it `itemDue` |
| NIST OSCAL 1.1.3, plan of action and milestones model, JSON format reference, and the OSCAL 1.2.3 complete JSON schema | A `poam-item` has `related-findings` and `related-risks`; a risk has a `deadline` and `remediations`; a remediation has `lifecycle` (`recommendation`, `planned` or `completed`) and `tasks`; a task has a `type` (`milestone` or `action`) and `timing` (`on-date` or `within-date-range`) | model reference of the POA&M model; schema | Planning keeps a milestone as a task and a POA&M entry as a finding, with no OSCAL term in its model; the writing is the library `grc` |

## Success criteria

- **SC-001**: A finding with its milestones is the whole of a POA&M entry, from the items of Planning alone and with no new kind.
- **SC-002**: The view gives the same rows for the same items and day, in any order.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
