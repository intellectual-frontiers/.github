# Feature Specification: Planning core

**Spec ID:** 0002-planning-core
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The logical core of Planning (commons 0037-planning, phases 0 and 1 and the ids and records of phase 2 that the core needs): the closed lists, the actors with their principals, the events, the fold of events into an item, the ids of UUID version 7 made by the hybrid clock of AnyFS's merge, the ids of records read from another scheme, the cycle check of links, and the records at the boundary in JSON5 (the library's own files and the monorepo's issue files, event objects and summaries). It realizes the requirements of commons 0037-planning named in each requirement below, and only cites upward: commons 0037-planning is in the repository's own spec kit (`commons/spec-kit/`), and this specification is the library's. Reconcile, the sources, the surfaces and the views are later phases and are not here.

## Requirements

- **FR-001**: Each closed list of Planning (the kinds of item, the states, the close reasons, the severities, the verdicts, the kinds of link, the capabilities, the authorities of a field, the origins, the kinds of actor, the kinds of locator, the types of event and the bases of a principal) MUST be a union of literals with one registry entry for each case, each entry naming the member of the ontology `plan:` it is, so that a case with no entry does not compile, a value outside the list is an error value of its parser, and the lists of the code and of the ontology are the same lists (commons 0037-planning FR-002 in part, FR-041).
- **FR-002**: An item MUST be a sum of the four kinds over one shared core that has the fields of commons 0037-planning FR-001 (an id, a kind, a title, a body, labels, assignees, an optional severity, an origin, the external ids, the links and the carried fields) and whose state is a union of the five states, never stored as a fact (commons 0037-planning FR-001, FR-004 in part).
- **FR-003**: An item id and an event id MUST each be a branded UUID version 7 made only by a smart constructor that returns a `Result`, minted from the hybrid clock of AnyFS's merge (`nextTime`, `makeVersionId`) with the last time of the replica a value that is taken and returned, so that every id a replica makes is after every id it has made or seen (`seeId`), and an id whose time is further ahead of the wall time than the limit of the clock MUST be refused; an instant MUST be a real time in UTC to the second and a day a real day (commons 0037-planning FR-007 in part, FR-003, FR-022).
- **FR-004**: An actor MUST be of one of the three kinds; an agent MUST carry the person it acts for, its principal, and how the principal was established, and an agent with no principal, an agent whose principal is not a person, a confirmation by an agent or a tool and a person that names an agent or a principal MUST each be refused when built and when read; and a run's context MUST make an actor so that a person's event or an agent's event is refused where the context has no person (commons 0037-planning FR-005, FR-045 in part).
- **FR-005**: An event MUST be one case of the closed union of the fourteen types with an id, the item it is of, a time and an actor, built only by `makeEvent` that returns a `Result`, immutable once built (deeply frozen), and the library MUST offer no operation that changes or removes an event (commons 0037-planning FR-003).
- **FR-006**: `fold` MUST be a pure and total function from the events of an item to its item, with the events taken in the order of their id, each id once, the first being the opening, so that the same events in any order or with any repeats give the same item; two events with one id and different content MUST be a conflict value; an item whose origin is inferred MUST start proposed and leave that state only by a confirmation by a person (and, where the policy says `principal`, by the principal of the event that proposed it); and the authority over each field MUST be applied over the events, so that a change by an agent or a tool to a `person-only` field waits as a proposal and changes nothing (commons 0037-planning FR-004; FR-006 and FR-012 in part).
- **FR-007**: The links of kind blocks MUST make a graph with no cycle, and a link that would close a cycle MUST be refused with the items of the cycle named (commons 0037-planning FR-009 in part).
- **FR-008**: The governance and logical code MUST be pure: it MUST read no file, call no network, import no module of the system and take no clock; a time or a wall time MUST be an argument (commons 0037-planning FR-022).
- **FR-009**: The governance and logical code MUST be typed as an algebra: no `any`, no non-null assertion, no `enum`, no cast but `brand`, every field `readonly`, every optional field exact, every `switch` over a union ending in `default: return absurd(x)`, and an id, an instant and a day made only by their smart constructors (commons 0037-planning FR-041).
- **FR-010**: An external id of another scheme MUST be carried as the source named it; a valid ULID (26 characters of Crockford's base 32, in either case, no larger than `7ZZZZZZZZZZZZZZZZZZZZZZZZZ`) MUST give its item or event id by a pure function that takes the 48 bits of time as `unix_ts_ms` and the first 74 of its 80 random bits as `rand_a` and `rand_b`, and an id that is not a ULID MUST give its id by the same function from the time of its event and the SHA-256 of the source's name, a zero byte and the value, so that two stores that read one file make the same ids; and an actor that a file records as a person but that the configuration says is an agent MUST be read as an agent acting for that person, and with no such rule MUST be read as the file says with a finding for each event (commons 0037-planning FR-044).
- **FR-011**: The library MUST encode and decode its records at its boundary in JSON5: an event as one file `<item>/<event>.json5` and an item of the published edition as one file holding its events in the order of the fold, each with its keys in the order of their names, recursively; decoding MUST be total and give an error value for a text that is not an event or an item of the schema; and the monorepo's issue file (`erga/issue@1`), event object (`erga/issue-event@1`) and summary (`erga/issues-index@1`) MUST be decoded and encoded as they are, an issue file read as an item with all ten types of event and every field of the opening, and the summary rendered from items (commons 0037-planning FR-038; FR-025 and FR-039 in part).

## Acceptance scenarios

1. **Given** the closed lists, **When** their registries are read, **Then** each case has an entry that is a member of the ontology `plan:`, and the ontology has no member that is not a case, per FR-001.
2. **Given** a history and the same events in another order with one repeated, **When** each is folded, **Then** the two items are equal, per FR-006.
3. **Given** an item an agent proposed, **When** an agent confirms it, **Then** it is refused, and **When** a person confirms it, **Then** it is open, per FR-004 and FR-006.
4. **Given** a field whose authority is person only and a change of an agent, **When** the item is folded, **Then** the field is unchanged and the change waits, naming the agent and its principal, per FR-006.
5. **Given** a context with no person, **When** an agent's event is made, **Then** it is refused and the refusal says that no principal is established, per FR-004.
6. **Given** a link that would close a cycle of blocks, **When** it is added, **Then** it is refused naming the items, per FR-007.
7. **Given** a clock and an id taken from another store, **When** the next id is made, **Then** it is after the id taken, and an id further ahead than the limit is refused, per FR-003.
8. **Given** an issue file whose ids are ULIDs, **When** two stores read it, **Then** they make the same item and event ids, per FR-010.
9. **Given** an event, **When** it is encoded and decoded again, **Then** it is the same event and its keys are in the order of their names, per FR-011.

## Out of scope

- Reconcile, the three-way merge, patches and previews, the sources, the surfaces, the queries and the views, the configuration and the matrix of what each source can hold: the later phases of commons 0037-planning.
- The per-source authority of a field: the fold takes the authority of each field, and the configuration that keys it by source is a later phase.
- Observations and traces (commons 0037-planning FR-008, FR-009 in part): later.

## Edge cases

- An event of another item among the events of one: `fold` says which two items, per FR-006.
- A `deferred` item that was started: it is in progress; a `reopened` event opens a closed or deferred item and changes nothing in another state, per FR-006.
- A file that records an agent with no rule: refused, because an agent with no principal is invalid when it is read, per FR-010.

## Assumptions

- The monorepo's issue files are private: the fixtures of the tests are made-up files of the schema, and the monorepo's own files were compared by hand, read only, outside this repository.
- The id that AnyFS makes is a valid UUID version 7 with the counter in `rand_a` and 62 bits of the replica's id in `rand_b`; how it differs from the wording of RFC 9562 section 5.7 is for the owner (the table is in the report of the phase, and the tests state the layout).

## Open questions

- **OQ-1**: Whether the version id of AnyFS should fill `rand_b` with random bits for each id, as RFC 9562 section 5.7 words it, and seed its counter at random with each new millisecond (section 6.2); the library uses it as it is.

## Key entities

- **Item** - one thing planned, a sum of kinds over a core, folded from its events.
- **Event** - one immutable thing that happened to an item, by an actor.
- **Actor** - a person, an agent that names its principal, or a tool.
- **Clock** - the hybrid clock of a replica, a value taken and returned.

## Success criteria

- **SC-001**: The same events give the same item in any order and with any repeats.
- **SC-002**: No event of an agent exists with no person responsible for it, and no agent's event is counted as a person's.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
