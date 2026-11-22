# Feature Specification: Planning sources and the store

**Spec ID:** 0004-planning-sources
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The physical layer of Planning (commons 0037-planning phases 2, 4 and 5): the store of events over AnyFS, the port a source implements and `defineSource`, the application of a patch held to its preview, the laws of a lens as a check a source is given, the source over files of an AnyFS store with the revision a write expects, and the sources themselves: the typed issues of a library, the event files of the monorepo's schema, Markdown task lists, comments in source, and a Git host. It realizes the requirements of commons 0037-planning named below and only cites upward. The sources are modules of the physical layer of this library and not yet the packages `planning-<noun>` of commons 0037-planning FR-042: OQ-8 of that specification (plugins or dialects) is the owner's, and splitting a module into a package is a move of a file and a manifest that does not change what the module says.

## Requirements

- **FR-001**: The store of events MUST be written against an AnyFS store that has read, write, list and cas, with one file for each event at `<item>/<event>.json5`, the traces of the sources at `.traces/` and the outbox at `.outbox/`, each in JSON5 with its keys in order; loading MUST be total (a file that is not of the schema is a finding and is not read), MUST give each item by `fold` and MUST give the clock after every id it holds (`seeId`), so that the next id is after every id taken; writing an event MUST expect the file to be absent, so that an event is never replaced, and two stores MUST merge by the union of their files with the same items in any order (commons 0037-planning FR-007, FR-038).
- **FR-002**: A source MUST be a value with a name, its capabilities and a place, `acquire` (which reads the place and returns its observations and its findings, or an error value), `preview` (which gives the plan a patch would carry out, or an error value) and `write` (which carries a plan out and returns what the place now holds); `defineSource` MUST make one from a typed record and MUST refuse a record whose `preview` or `write` is present when its capabilities say it cannot write, or absent when they say it can, so that a person can add a source with no change to the library (commons 0037-planning FR-013, FR-030).
- **FR-003**: `applyPatch` MUST route a patch (commons planning 0003-planning-reconcile FR-009), and for a source that can apply it MUST be a dry run that gives the preview and its hash and writes nothing unless it is given a hash, MUST refuse a hash that is not that of the preview the patch now gives and write nothing, and MUST write exactly the plan of that preview otherwise; a source MUST NOT write without an explicit target of source and place (commons 0037-planning FR-011, FR-013, FR-032).
- **FR-004**: The laws of a lens MUST be a check a source is given, `checkLens`, that returns the laws a source breaks: that a patch which sets what the place already says has an empty plan and changes no byte; that after a patch is written `acquire` returns the observations it returned before with the change of that patch and no other; and that `acquire` of an unchanged place twice returns the same observations in the same order with the same fingerprints (commons 0037-planning FR-023, FR-042).
- **FR-005**: A source over files MUST be written against an AnyFS store and MUST state the revision it read as the expectation of each write (the place `.` is the root of the store, and a place is never empty), so that a write that finds the file changed is a conflict value and changes nothing, and the same source MUST work over every store that has read, write, list and cas (commons 0037-planning FR-029).
- **FR-006**: The source for the typed issues of a library MUST read the folder `issues/` as data 0044-issues FR-002 lays it out, each `NNNNN-slug.ts` as an item whose observation keeps every field of the issue as read (its severity as the source's own value, priority, size, goals, engines, citations, evidence, links, status and day raised), MUST find a file the barrel `mod.ts` does not list and a name it lists with no file, MUST read a file without running it, and MUST write a change of status back as the one replaced value, keeping every other byte (commons 0037-planning FR-024, FR-046).
- **FR-007**: The source for event files MUST read each issue file `erga/issue@1` as one item with its events through the reading of commons planning 0002-planning-core FR-011, every type of event and every field of the opening, MUST find a file it cannot read and name why, and MUST write a new event by the rules of that schema (the event of a tool or of a person, and none that names a principal, which the schema cannot hold), keeping every other byte of the file (commons 0037-planning FR-025).
- **FR-008**: The source for Markdown MUST read each task list item of GitHub Flavored Markdown 0.29-gfm section 5.3 (a list item whose first block is a paragraph that begins with a marker of optional spaces, `[`, a whitespace character or `x` or `X`, `]` and at least one whitespace character) under every list marker the list allows, nested items as children linked as parent of, outside fenced code, and MUST write the closing of an item as the one character between its brackets made `x`, and its reopening as a space, and no other byte (commons 0037-planning FR-026).
- **FR-009**: The source for comments MUST read a comment in a source file that carries one of the configured markers (`TODO`, `FIXME`, `XXX` and `HACK` by default) as an item with the fingerprint of the comment's normalized text and the symbol that encloses it, so that the id survives a move of the line, MUST read the anchor `MARKER(#id)` as the item's id, and MUST write only that anchor, only in a file the configuration lists and never in a generated or vendored file (commons 0037-planning FR-027).
- **FR-010**: The source for a Git host MUST read, through a client of the Git host contract of `githost` and never one of its own, the issues named by the configuration and by the references of the commits of a repository (the line `Refs #N` that `repoctl commit` writes and the closing keywords of the host) as items, with their parent and children (the commits that name an issue are carried in the issue's observation, as its record as read and its evidence, because `reconcile` matches one observation of a source to an item in a run), and MUST declare itself read only, so that every patch for it is in the outbox; a field the contract does not hold (the close reason, the assignees, the comments, the events) MUST be unexpressed with that reason (commons 0037-planning FR-028).
- **FR-011**: The names of the sources not yet written MUST be reserved and no source of them MUST be registered; the fields each source carries MUST be in its row of the matrix with an outcome and a reason for each field of an item, and a journal of Evidence Capture MUST NOT be read by any source (commons 0037-planning FR-015, FR-031, FR-046, FR-047).

## Acceptance scenarios

1. **Given** two stores that each made events, **When** their files are united in either order, **Then** the items are the same and the next id is after every id, per FR-001.
2. **Given** a patch with no hash, **When** it is applied, **Then** the preview and its hash are given and nothing is written, and **When** applied with another hash, **Then** it is refused, per FR-003.
3. **Given** a source that rewrites a file when nothing changed, **When** `checkLens` runs, **Then** it names the law broken, per FR-004.
4. **Given** a file changed between its reading and the write, **When** the write is made, **Then** it is a conflict and the file is as the other writer left it, per FR-005.
5. **Given** the `issues/` of a library, **When** it is read and a status is written back, **Then** every other byte is as it was, per FR-006.
6. **Given** a nested task list, **When** an item is closed, **Then** one character changes, per FR-008.
7. **Given** a comment `TODO: tidy` in a function that moves, **When** it is read again, **Then** its fingerprint is the same, per FR-009.
8. **Given** a Git host that holds no close reason, **When** the issue is read, **Then** the field is unexpressed with that reason, per FR-010.

## Out of scope

- The sources of the later phase (commons 0037-planning FR-031).
- A write to a Git host: the contract of `githost` holds no write for an issue.

## Edge cases

- A file of `issues/` whose status is deferred with an `until` that is not a day: it is read as deferred with the text and no day, with an informational finding, per FR-006 (OQ-1).
- A line of Markdown inside a fenced code block: not an item, per FR-008.
- A closed Git host issue: read as closed as completed, because the contract holds no close reason, per FR-010.
- A comment in a generated file: read, never written to, per FR-009.

## Assumptions

- The issues of a Git host are named: the contract reads one issue by number and has no listing.

## Open questions

- **OQ-1** (decided by the owner on 2026-11-22): The `until` of a deferred typed issue (data 0044) is free text and a deferred item's may be a day: the text is kept as text and the day is given where the text is one (`planning 0037-planning` OQ-12); a text that is not a day is an informational finding and the state is deferred, not open.

## Key entities

- **Store** - the events, traces and outbox in an AnyFS store.
- **Source** - a lens over a place.
- **Plan** - what a patch would write.

## Success criteria

- **SC-001**: A write changes only what the preview said, in the form of the place, or changes nothing and says why.
- **SC-002**: A person adds a source with a typed record and no change to the library.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
