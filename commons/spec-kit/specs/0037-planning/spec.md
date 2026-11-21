# Feature Specification: Planning

**Spec ID:** 0037-planning
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0033-kanon

**Input:** Planning content (an issue, a task, a to-do, a roadmap item, a question, a decision, a finding) lives in many places at once: files of a repository, comments in source, lists in Markdown, a Git host, a tracker, a table. Each place has its own form, its own identity and its own idea of what "done" is, so no one place says what is planned. This specification names the library **Planning** (`commons/planning`, the package `@intellectual-frontiers/planning`), a Kanon library that collects planning content from many places in a configurable way, keeps one item with one stable identity for each thing planned, keeps its history as append-only events, remembers every place the item was seen, and writes a change back to a place in that place's own form, or renders the items in any format. The name is `planning` and not `workitems`, which collides with the works of the company's monorepo. This specification is written before any code: the owner confirms it (OQ-1) before a line of the library is written.

## Governance: what an item is and what may happen to it

- **FR-001**: The library MUST model an item (`plan:Item`) as a sum of seven kinds (`plan:Issue`, `plan:Task`, `plan:Todo`, `plan:RoadmapItem`, `plan:Question`, `plan:Decision`, `plan:Finding`, the members of `plan:ItemKind`) over one shared core that every kind has: an id, a kind, a title, a body, labels, assignees, an optional severity, an origin and the links of FR-009; a kind MAY add fields of its own (a decision its verdict, a finding its rule and its severity) and MUST NOT remove any field of the core.
- **FR-002**: A severity MUST be exactly one of the three members of `plan:Severity` (`plan:Error`, `plan:Warning`, `plan:Note`), a verdict of a decision exactly one of the four members of `plan:Verdict`, and each closed list MUST be a union of literals with one registry entry for each case, so that a value outside the list does not compile and a parsed value outside it is an error value.
- **FR-003**: The history of an item MUST be a set of events, each one case of the closed union `plan:EventType` (opened, commented, edited, labeled, assigned, severity set, blocker set, started, closed, reopened, decided, linked, confirmed, seen), each with an id, a time in UTC to the second and an actor (FR-005); an event MUST be immutable once written, and the library MUST have no operation that changes or removes an event.
- **FR-004**: The state of an item (`plan:State`: proposed, open, in progress, closed with a `plan:CloseReason`) MUST be the result of `fold`, a pure and total function from the events of the item to its state, with the events taken in the order of their time and then of their id; a state MUST NOT be stored as a fact, and WHEN two histories hold the same events in any order or with any repeats, `fold` MUST give the same state.
- **FR-005**: An actor (`plan:Actor`) MUST be a person, an agent or a tool (`plan:ActorKind`), with an id and a name; WHERE an agent wrote an item or an event, the actor MUST be an agent named `claude` (or the name of the agent that wrote it) and MUST NOT be a person, and a library function MUST refuse to build an event whose actor is a person from a context that has only an agent's credentials.
- **FR-006**: An item MUST have an origin (`plan:Origin`: declared, derived or inferred); WHEN an item is inferred by a heuristic or an agent, it MUST start in the state `plan:Proposed`, MUST NOT be counted by any derived view (FR-021) or any query that is not told to include proposals, and MUST leave `plan:Proposed` only by a `plan:ConfirmedEvent` whose actor is a person.
- **FR-007**: An item id MUST be a branded type made only by a smart constructor that returns a `Result`; an id MUST be minted once, MUST NOT change when the item is seen in another place or moves inside a place, and MUST NOT be reused for another item, even after the item is closed.
- **FR-008**: An observation (`plan:Observation`) MUST be what one source read in one place at one time: the content as the source read it, a locator (`plan:Locator`, one of the kinds of `plan:LocatorKind`: file span, URL, row, commit), the SHA-256 of the bytes it was read from (`plan:contentHash`) and a fingerprint of the identity of the thing read (`plan:fingerprint`) that does not depend on where in the place it is.
- **FR-009**: Every item MUST carry a trace (`plan:Trace`, a PROV-O derivation) to each observation it was derived from, so that every place an item was seen (file and line, URL, row, commit) can be found from the item, and WHEN an item has no trace to any observation, it MUST be one declared directly in the store; a link (`plan:Link`) MUST be one of the five `plan:LinkKind` (blocks, same as, relates to, parent of, derived from), and the links of kind blocks MUST make a graph with no cycle: WHEN a link would close a cycle, the library MUST refuse it with the items of the cycle named.
- **FR-010**: A patch (`plan:Patch`) MUST be a value of a closed union (add an item, add an event, change a state, link, confirm), made for one explicit source, and MUST do nothing until it is applied; a function that makes patches MUST be pure.
- **FR-011**: A preview (`plan:Preview`) MUST say exactly what applying a patch would write, to which source and place, with a hash of itself (`plan:previewHash`); WHEN a write is asked for without a preview that it names by its hash, the library MUST do a dry run and write nothing, and WHEN the preview it is given differs from what the patch would now do, it MUST refuse and write nothing.
- **FR-012**: The authority over each field of an item MUST be one of the members of `plan:FieldAuthority` (source wins, store wins, latest wins, person only), set for a source and a field in the typed configuration (FR-037), and the library MUST apply it in `fold`, over events, and not by overwriting a field: WHERE the authority of a field is person only, an event of an agent or a tool that changes it MUST wait as a proposal and MUST NOT change the state.
- **FR-013**: A source (`plan:Source`) MUST be a typed lens over one kind of place with two functions: `acquire`, which reads a place and returns observations or an error value, and `write`, which takes a patch and returns the observations the place now holds or an error value; a source MUST declare its name and its capabilities (FR-014), and MUST NOT write unless it was given an explicit target.
- **FR-014**: A source MUST declare its capabilities as a set of the members of `plan:Capability` (read, create, append event, edit, close, assign, delete), and WHEN a patch needs a capability the source does not declare, the library MUST NOT apply the patch to that source and MUST put it in the outbox (FR-033), with the capability named.
- **FR-015**: Nothing MUST be dropped silently between what an item says and what a source can hold: each field of an item MUST end, for each source, expressed (the place holds it), carried (it travels in a form the place keeps, such as an anchor or a trailer) or unexpressed with a reason, and a field that ends in none MUST be a `kanon/dropped` finding of the Kanon check, with the matrix of field by source given as in 0033-kanon FR-023.

## Logical: reconcile, merge, query and views

- **FR-016**: WHEN observations are reconciled with the store, `reconcile` MUST match each observation to an item in this order: the id an anchor in the place carries, then the fingerprint, then the locator; WHEN none matches, it MUST make a new item whose origin is derived or inferred as the source says, and it MUST return events and links as data and write nothing.
- **FR-017**: WHEN a place and the store disagree, `reconcile` MUST do a three-way merge of the observation last taken (the base), the observation now read and the store, and MUST express each difference as an event whose actor is the source (a tool), so that the field authority of FR-012 decides the result in `fold`; a difference that no authority decides MUST be a conflict value that names the field, the three values and the sources, and MUST NOT be settled by taking either one silently.
- **FR-018**: WHEN a thing an item was derived from is no longer found in the place (a removed comment, a deleted line), `reconcile` MUST add a derived close, a `plan:ClosedEvent` with the reason `plan:Completed`, the origin derived and a tool as actor, and WHEN the same fingerprint is read again, it MUST add a `plan:ReopenedEvent`; an event by a person MUST win over a derived close.
- **FR-019**: The library MUST find likely duplicates by a similarity of titles, bodies and locators with a threshold set in the configuration, and MUST propose each as a link of kind `plan:SameAs` in the state proposed that a person confirms, and MUST NOT merge, close or hide an item because of a likeness; the same items and the same threshold MUST give the same proposals in the same order.
- **FR-020**: The library MUST give a query as a typed algebra over the items, the events, the links and the traces (select, filter by state, kind, label, assignee, severity and origin, join, order, limit), pure and read-only, and a surface (FR-036) MUST be a projection of it and not a second definition.
- **FR-021**: The library MUST derive these views by pure functions of the items: the roadmap in the horizons now, next and later, the graph of blocks and blocked by with its cycle check (FR-009), and the matrix of requirement by source that links each item to the requirement it cites (a citation such as `FR-014` or `0037-planning FR-014`), so that a requirement with no item and an item that cites a requirement that does not exist are each found.
- **FR-022**: The governance and logical code MUST be pure: it MUST read no file, call no network and take no clock; the time of an event or an observation MUST come from a value the caller passes in.

## Physical: the sources

- **FR-023**: Every source MUST keep the laws of a lens, proved by property tests over generated places: `acquire` then `write` of the observations it returned writes nothing and changes no byte; `write` of a patch then `acquire` returns the observations with the patch applied and no other change; and `acquire` twice of an unchanged place returns the same observations in the same order with the same fingerprints.
- **FR-024**: The source for a single file `issues.ts` MUST read the items the file exports as typed values of the library, and MUST write a patch back as a change to that file that keeps the rest of the file as it was.
- **FR-025**: The source for a folder `issues.d/` MUST read each file of it that its `mod.ts` barrel lists as one item or one set of items, MUST find a file the barrel does not list and a name the barrel lists with no file, and MUST write a new item as a new file listed by the barrel in the order the barrel keeps.
- **FR-026**: The source for Markdown MUST read each task list item of GitHub Flavored Markdown (`- [ ]` and `- [x]`) as an item, nested items as sub-items linked `plan:ParentOf`, in any Markdown file, in a Spec Kit `tasks.md` and in a task list of the body of a GitHub issue, and WHEN an item is closed, `write` MUST change `[ ]` to `[x]` in that place and in no other byte of the file.
- **FR-027**: The source for comments in source files MUST read a comment that carries one of the markers set in the configuration (TODO, FIXME and `@todo` by default) as an item, with the fingerprint of the comment's normalized text and the symbol that encloses it, so that the id survives a move of the line; WHERE a marker is written back, `write` MUST insert an anchor of the form `TODO(#id)` and MUST do so only for the files the configuration lists, and never in a generated or a vendored file.
- **FR-028**: The source for a Git host MUST read the issues of a repository, and the trailers `Refs #N` and `Closes #N` of its commits, as items, links and traces, through the Git host contract of the library `githost` and never a client of its own, and MUST write only what the host's capabilities and the token's grants allow.
- **FR-029**: A source that reads files MUST be written against a store of AnyFS (`@intellectual-frontiers/anyfs`) whose capabilities are in its type, so that the same source works over a folder, Git, S3, SSH and SQL; WHEN it writes, it MUST state the revision it read as the expectation of the write, and a write that finds the file changed MUST be a conflict value and change nothing.
- **FR-030**: The library MUST give `defineSource`, which makes a source from a typed record (its name, its capabilities, `acquire` and `write`) and refuses a record whose `write` is present when `capabilities` says it cannot write, so that a person can add a source (a SQL table, a tracker) with no change to the library.
- **FR-031**: The library MUST reserve the names of the sources that are not yet written (SARIF files, skipped and todo tests, Dependabot and Renovate pull requests, iCalendar to-dos, Linear, Jira), and a source of the list MUST NOT be written before the specification of the standard or the service it reads has been read and cited.
- **FR-032**: A write MUST need an explicit target (a source and a place), MUST be a dry run unless it names a preview by its hash (FR-011), and the command in check mode MUST print the hash of the preview and exit with a status that says whether anything would change, so that a headless run applies exactly the plan a person looked at.
- **FR-033**: The library MUST keep an outbox of the patches that no source could apply (FR-014), each with the reason, as items of the store that a person can read, and MUST offer each again WHEN a source that can apply it is given as a target.

## Physical: surfaces, configuration and formats

- **FR-034**: The program `planctl` MUST be a headless program of the library Headless (`commons/headless`) with the verbs `collect`, `show`, `query`, `views`, `confirm`, `plan` and `apply`, each returning a typed outcome and printing through a surface, and `plan` and `apply` MUST be the dry run and the write of FR-032.
- **FR-035**: The library MUST give a tool server of the same verbs, as a surface that is a projection of the same program, in which a tool that writes MUST take the target and the preview hash as arguments and an agent that calls it MUST be an actor of kind agent (FR-005).
- **FR-036**: The library MUST give the items as relations of SQL, read-only, in a plugin `planning-query` in the way `estate-query` and `anyfs-query` do, with the relation `issues` having a column for each field of the core of FR-001 and the state of FR-004, so that the statements of the SQL of `lang-sql` and `agora query` read it; the relations MUST be made from the same types and not written a second time.
- **FR-037**: The configuration MUST be a typed value in `planning.config.ts`, made by `definePlanning`, that names the sources and their places, the markers, the threshold of FR-019, the authority of each field for each source (FR-012), the files that anchors may be written to (FR-027) and the formats to render; a configuration MUST NOT be read from JSON or YAML, and a configuration that does not satisfy its type MUST be an error value naming the field.
- **FR-038**: The store and the published edition MUST be files in a format that the library encodes and decodes at its boundary, JSON5 by default (the codec of `formats`), with one file for each item and an order of keys that does not change, so that a diff of two stores is a diff of items; decoding MUST be total and give an error value for a file that is not an item of the schema.
- **FR-039**: The library MUST render items in a format by a function from items to bytes that is pure (Markdown, JSON5, SQL, and later iCalendar), and a renderer MUST be given by the configuration; WHEN a format cannot hold a field, the rendering MUST say so by the rule of FR-015 and MUST NOT drop it silently.

## The library and how it is built

- **FR-040**: `commons/planning` MUST be a Kanon library (0033-kanon FR-009, FR-010) whose table has the layers governance (the kinds, the events, the states, the severities, the patches, the capabilities), logical (`fold`, `reconcile`, the merge, the query, the views), and physical (the surfaces and the sources' port), with the sources as plugins of the family `planning-<noun>` whose contract is the export that says what a source is (0033-kanon FR-020, FR-021), and its `verify` MUST run the check of `@intellectual-frontiers/kanon`.
- **FR-041**: The governance and logical code MUST be typed as an algebra (0033-kanon FR-018): a closed union for each thing with a fixed set of cases, a product type for each record, every field `readonly` and every optional field exact (`exactOptionalPropertyTypes`), a branded id for each kind of id made by a smart constructor that returns a `Result`, every `switch` over a union exhaustive and ending in `default: return absurd(x)`, errors as values of `Result`, and no `any`, no non-null `!`, no `enum` and no cast but `brand`.
- **FR-042**: A source MUST be a package of its own, `planning-<noun>`, importing the host only by its public exports and no other source, and MUST pass the conformance suite of the host, which runs the laws of FR-023 over its generated places.
- **FR-043**: A term of the model MUST be one of the ontology `plan:` before a specification or a code names it, with its basis (0018-standards-first FR-003), and a standard whose text was not read MUST be marked `(to verify)` where it is named.

## Standards considered

Each standard below was looked for in the open, in the order of 0018-standards-first FR-001. The documents of OASIS, W3C, the IETF and GitHub could not be fetched when this specification was written (the network of the session did not reach those hosts), so only the IRIs of PROV-O and SKOS that the library `rdf` already holds were used, and every other name is marked `(to verify)`: it is a name taken from the dataset the first sources hold or from memory, and no IRI of it is written here or in the ontology.

| Standard | What Planning takes from it | Read |
| --- | --- | --- |
| W3C PROV-O | An item, an observation and a locator are entities, an event an activity, an actor an agent, a source a software agent and a trace a derivation: the IRIs of `rdf` and of `kanon` | Terms held by `rdf` and `kanon` used; the W3C text itself (to verify) |
| SKOS | Every code list is a concept | Terms held by `rdf` |
| SARIF (OASIS), the result level and the baseline and fingerprint properties | The three severities (error, warning, note), and, as a model for FR-016, a result's fingerprints and its baseline state of new, unchanged, updated and absent | (to verify): only secondary sources were seen, none of the OASIS text |
| W3C Web Annotation Data Model and Vocabulary | The motivation of a kind of item (questioning, assessing, commenting) and the selector by quoted text as a model of a locator | (to verify) |
| IETF RFC 5545 (iCalendar), the to-do component | The statuses NEEDS-ACTION, IN-PROCESS, COMPLETED and CANCELLED as the nearest names of the states; PRIORITY; the RELATED-TO relation with the parent, child and sibling types as a model of a link | (to verify) |
| IETF RFC 9253 (iCalendar relationships) | A relation such as depends-on as a model of the link kind blocks | (to verify) |
| OASIS OSLC Change Management | The change request and its states as a comparison for the model of an issue and its history | (to verify) |
| GitHub Flavored Markdown, the task list items | `- [ ]` and `- [x]` as the form of FR-026 | (to verify) |
| GitHub issue events and the closing keywords of commits | The reasons for closing (completed, not planned, duplicate) and `Closes #N` | (to verify) |
| `git interpret-trailers` | A trailer such as `Refs #N` as a locator of kind commit | (to verify) |
| JSON5 | The format of FR-038, through the codec of `formats` | Held by `formats` |
| IETF RFC 8785, JSON canonicalization | An order of keys that does not change, as a model of FR-038 and of the hash of FR-011 | (to verify) |
| ULID and IETF RFC 9562 (UUID version 7) | A sortable id of an event (OQ-4) | (to verify) |
| RFC 2119, EARS, Gherkin | The form of this specification (0018-standards-first FR-011) | Adopted by 0003-mizan |

The terms that no standard names (the item as a sum of seven kinds, the fold of a history into a state, a derived close, a patch, a preview and an outbox) are in `plan:` with a basis of PROV-O or SKOS, and none is `unaligned`.

## Acceptance scenarios

1. **Given** a history of events in one order and the same events in another order with one repeated, **When** each is folded, **Then** the two states are equal, per FR-003 and FR-004.
2. **Given** an item an agent inferred from a heuristic, **When** the roadmap is derived, **Then** the item is not in it, and **When** a person's confirmed event is added, **Then** it is, per FR-006 and FR-021.
3. **Given** an event built from a context that has only an agent's credentials, **When** its actor is made, **Then** the actor is the agent `claude` and a person is refused, per FR-005.
4. **Given** a Markdown file with a task list item nested under another, **When** it is read and the item is closed and written back, **Then** only `[ ]` of that line became `[x]` and the item is a sub-item of the first, per FR-026 and FR-023.
5. **Given** a comment `TODO: tidy` inside a function, **When** the function moves down the file and the file is read again, **Then** the item keeps its id, per FR-016 and FR-027.
6. **Given** an item derived from a comment, **When** the comment is removed and the file is read, **Then** the item is closed as completed by a tool, and **When** the comment is restored, **Then** it is reopened, per FR-018.
7. **Given** a patch that closes an item in a source that cannot close, **When** the patch is applied to it, **Then** nothing is written and the patch waits in the outbox with the capability named, per FR-014 and FR-033.
8. **Given** a write with no preview hash, **When** the command runs, **Then** it prints the preview and its hash and writes nothing, and **When** it is run with that hash, **Then** it writes exactly that, per FR-011 and FR-032.
9. **Given** a link of kind blocks that would close a cycle, **When** it is added, **Then** it is refused naming the items, per FR-009.
10. **Given** a file read over a store of Git and written back after another change to it, **When** the write states the revision it read, **Then** the write is a conflict and the file is unchanged, per FR-029.
11. **Given** two items with nearly the same title, **When** duplicates are sought, **Then** a proposed link of kind same as is made and both items stay open, per FR-019.
12. **Given** a field that a source cannot hold, **When** the matrix is made, **Then** the cell says unexpressed with its reason, and with no reason it is a finding, per FR-015.

## Out of scope

- Any code: the library is written only after the owner confirms this specification (OQ-1).
- A user interface, a calendar, a time tracker and estimates: Planning holds what is planned, not who does it when.
- The typed issues of the weaknesses of a library of `commons/data` and their copy in a database (data 0044-issues and data 0045-issues-model): they are a source of Planning (OQ-6) and are not changed by this specification.
- The release, the version and the publication of the package: the release of commons.

## Edge cases

- A comment written twice with the same words in one function: the fingerprint is the same, so the order of the two in the function is part of the identity, per FR-016 and FR-027.
- A line of a task list edited in a place and its item edited in the store at the same time: a conflict value naming the title and its three values, never a silent choice, per FR-017.
- A source that cannot write at all (a SARIF file, a read-only host): every patch for it goes to the outbox, per FR-014 and FR-033.
- A person closes an item and a later read of a place finds its text again: the person's event wins over the derived reopening, per FR-018.
- An item seen in three places: it has three traces and one id, and a close in one place is a patch to the other two, per FR-009 and FR-010.
- A requirement cited by no item: found by the matrix, per FR-021.
- A format that cannot hold links (a plain list): the rendering says so and the links are unexpressed with that reason, per FR-039 and FR-015.
- A configuration in JSON beside `planning.config.ts`: not read, per FR-037.
- A write to a file in a vendored folder that the configuration does not list: refused, per FR-027.

## Assumptions

- The library is Kanon (0033-kanon), uses AnyFS for every file, `githost` for Git hosts and Headless for its program, as the libraries of commons do.
- Items are public text unless a store is private: Planning holds no secret, no token and no person's data of its own, and its fixtures are made-up or public.
- A dataset of audit findings that a person offers is a candidate fixture, never assumed to be available.
- The standards of the table above were not read when this specification was written; the terms that depend on them are marked `(to verify)` until they are.

## Open questions

- **OQ-1**: The owner confirms this specification, and the name `planning` for `commons/planning`, before any code is written.
- **OQ-2**: Whether the store and the published edition stay in JSON5 at the boundary, encoded and decoded by the library (recommended, FR-038), or become TypeScript values that are written by the library.
- **OQ-3**: Whether a journal's audit entries join the model: the recommendation is that findings join as the kind finding and the entries stay a journal, which an item may cite by a locator of kind row.
- **OQ-4**: Whether an id of an event is a ULID, as the existing issue files use, or a UUID version 7 made by the hybrid clock of AnyFS's merge, which would let two stores merge by the union of events.
- **OQ-5**: Whether the derived close of a removed comment is completed (FR-018) or a state of its own, unobserved, that a person settles.
- **OQ-6**: Who owns what: data 0044-issues and data 0045-issues-model own the typed issues of a library's weaknesses and their database copy; `docs` has its own scan of notes in the code (`commons/docs/src/pages/insight.ts`) that the comments source would serve; `githost` owns the Git host contract; and the issue cross-referencing and the view of Kanon that the session on IFC Data is said to work on are not found in this repository, so their owner and their overlap with FR-021 and FR-015 are to be settled.
- **OQ-7**: Whether `plan:` stays the prefix, or reads better as `planning:`.
- **OQ-8**: Whether sources are plugins of the family `planning-<noun>` (the way the backends of AnyFS are) or dialects `planning-dialect-<noun>` in the sense of 0033-kanon FR-019, which says what a dialect is.

## Key entities

- **Item** - one thing planned, of one of seven kinds, with a stable id and a history of events.
- **Event** - one immutable thing that happened to an item.
- **Observation** - what one source read in one place, with its locator and hash.
- **Patch** - a change to write back to one source.
- **Preview** - what a patch would write, with the hash a write is held to.
- **Source** - a lens over one kind of place, with its capabilities.

## Success criteria

- **SC-001**: One thing planned is one item with one id however many places it is in, and every place it was seen can be found from it.
- **SC-002**: A write changes only what the preview said, in the form of the place, or it changes nothing and says why.
- **SC-003**: A person can add a source in a typed configuration and a typed function, with no change to the library.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
