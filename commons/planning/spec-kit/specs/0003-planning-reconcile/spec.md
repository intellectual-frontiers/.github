# Feature Specification: Planning reconcile, patches and views

**Spec ID:** 0003-planning-reconcile
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The logical algebra of Planning that sits on the core (commons planning 0002-planning-core): what a source read (an observation, its locator, its fingerprint and the trace from an item to it), `reconcile` of observations with the store by the match order and the three-way merge, the derived close and reopening, likely duplicates, patches, capabilities, the outbox and the preview with its hash, the query algebra, the views and the matrix of what a source can hold. It realizes the requirements of commons 0037-planning named in each requirement below and only cites upward. Pure: no file, no network, no clock; the sources that read and write places are commons planning 0004-planning-sources.

## Requirements

- **FR-001**: An observation MUST be what one source read in one place: its source name, a locator (one of file span, URL or commit), the SHA-256 of the bytes it was read from, a fingerprint of the identity of the thing read that does not depend on where in the place it is, the content as an observed item (kind, title, body, labels, assignees, an optional severity, the state as the place says it, the origin, the external ids, an optional anchor id, an optional parent fingerprint and the carried fields) and the record as read (`raw`); a trace MUST say, for an item and a source, the fingerprint, the locator, the hash and the observed content last taken and whether the thing is present or absent, so that every place an item was seen can be found from the item (commons 0037-planning FR-008, FR-009, FR-046).
- **FR-002**: `reconcile` MUST class each observation against the trace last taken as new, unchanged, updated or absent (the four values of the SARIF result `baselineState`, SARIF 2.1.0 section 3.27.24), a trace whose thing is not read again being absent; it MUST give no event for an unchanged observation and MUST return its events, traces, links, conflicts and classes as data, writing nothing (commons 0037-planning FR-016, FR-017).
- **FR-003**: `reconcile` MUST match each observation to an item in this order: the anchor id the place carries, then an external id, then the fingerprint, then the locator; an item matched once in a run MUST NOT be matched again in it; WHEN none matches it MUST make a new item whose origin is the source's (derived or inferred) and whose id is made from the first external id by the function of commons 0037-planning FR-044 where there is one, and by the clock otherwise (commons 0037-planning FR-016, FR-044).
- **FR-004**: WHEN a matched item and its place disagree, `reconcile` MUST do a three-way merge of the observation last taken (the base), the observation now read and the item folded from the store, for the title, the body, the severity and the state, and MUST express each difference of the place from its base as an event whose actor is the tool that is the source, so that the field authority decides in `fold`; WHEN the three differ and the policy names no authority for the field the result MUST be a conflict value that names the item, the field, the three values and the source, and MUST NOT be settled by taking either; labels and assignees are merged as added and removed members; two events with one id and different content MUST be a conflict value (commons 0037-planning FR-017).
- **FR-005**: WHEN a trace is absent from the observations of its source, `reconcile` MUST add a derived close (a `closed` event with the reason completed and a tool as actor) unless the item is already closed, and mark the trace absent; WHEN an absent trace is read again it MUST add a `reopened` event only where the item was closed by a tool, so that an event of a person wins over a derived close and over a derived reopening (commons 0037-planning FR-018).
- **FR-006**: WHERE an observation carries the history its place keeps (a source whose records are already events, with their ids, times and actors), `reconcile` MUST take those events as they are, a union by event id of what the store holds, an event with an id the store holds and different content being a conflict value, and MUST NOT derive events from the fields of such an observation (commons 0037-planning FR-025, FR-044).
- **FR-007**: The library MUST find likely duplicates among the counted items by the similarity of their titles, bodies and locators with a threshold the caller gives, and MUST give each as a proposed link of kind same as, with its score, in an order that is a function of the items alone; it MUST NOT merge, close or hide an item because of a likeness (commons 0037-planning FR-019).
- **FR-008**: A patch MUST be a value of the closed union add an item, add an event, change a state, link, confirm, made by `makePatch` for one explicit source and place around exactly one event, and MUST do nothing until a source applies it; the operation MUST be the one the event's type says, and a patch whose operation does not fit its event MUST be refused when built (commons 0037-planning FR-010, FR-013).
- **FR-009**: Each patch MUST need a capability of its source (add an item needs create; closing or reopening needs close; assigning needs assign; a comment, a confirmation and every event a place keeps as an event need append event; every other change needs edit), a source with append event MUST be taken to hold every event type it can express, and WHEN the source does not declare what the patch needs the patch MUST NOT be applied to it and MUST be an outbox entry that names the capability, or the reason the place cannot express it; the library MUST offer each entry again WHEN a source that can apply it is given (commons 0037-planning FR-014, FR-033).
- **FR-010**: A preview MUST say exactly what applying a patch writes (each effect: its target, the revision it expects, the text it makes and a sentence), to which source and place, with the SHA-256 of that as its hash; a write without the hash of a preview MUST be a dry run that writes nothing, and a hash that is not that of the preview the patch now gives MUST be refused (commons 0037-planning FR-011, FR-032).
- **FR-011**: A query MUST be a typed algebra over the items, events, links and traces (select, filter by state, kind, label, assignee, severity and origin, join, order, limit), pure and read-only, that does not count a proposed item unless it is told to (commons 0037-planning FR-006, FR-020).
- **FR-012**: The views MUST be pure functions of the items: the roadmap (the counted items in an order that puts each after every item that blocks it), the graph of blocks and blocked by, the matrix of requirement by item (a citation of a requirement such as `FR-014`, with the number of its specification before it or not, linked to the item that cites it, finding a requirement with no item and an item citing a requirement that does not exist) and the responsibility of each person (the events their agents authored by agent and the proposals of those agents that still wait) (commons 0037-planning FR-021).
- **FR-013**: The matrix of what each source can hold MUST give each field of an item, for each source, one of expressed, carried or unexpressed with a reason, and a field with none MUST be a finding that names the field and the source; a rendering of items MUST be a pure function from items to text (Markdown, JSON5) that says where its format cannot hold a field and does not drop it silently (commons 0037-planning FR-015, FR-039).
- **FR-014**: The code of this specification MUST be pure and typed as the algebra of commons planning 0002-planning-core FR-008 and FR-009: it reads no file, calls no network and takes no clock (the time, the clock and the wall time are arguments), and holds no `any`, non-null assertion, `enum` or cast but `brand` (commons 0037-planning FR-022, FR-041).

## Acceptance scenarios

1. **Given** observations read twice from an unchanged place, **When** they are reconciled both times, **Then** the second gives no event and every class is unchanged, per FR-002.
2. **Given** an item an observation matches by anchor, another by external id, another by fingerprint and another by locator only, **When** they are reconciled, **Then** each matches its item in that order, per FR-003.
3. **Given** a title edited in the place and in the store, **When** the policy names no authority, **Then** the result is a conflict naming the field and the three values, and **When** it names one, **Then** an event is given and `fold` decides, per FR-004.
4. **Given** an item from a comment that is removed and restored, **When** the place is read, **Then** it is closed as completed by a tool and then reopened, and a person's close is not reopened, per FR-005.
5. **Given** a patch to close an item for a source that cannot close, **When** it is routed, **Then** it is an outbox entry naming `close`, per FR-009.
6. **Given** a preview, **When** the patch is applied with another hash, **Then** it is refused, per FR-010.
7. **Given** a requirement cited by no item and an item citing a requirement that does not exist, **When** the matrix is made, **Then** each is found, per FR-012.

## Out of scope

- Reading and writing places, the store of events and the surfaces: commons planning 0004-planning-sources and 0005-planning-surfaces.
- The sources of the later phase of commons 0037-planning (FR-031).

## Edge cases

- Two observations of one run that match one item: the second does not match it and is a new item, per FR-003.
- A source that read nothing at all (an empty place): every present trace of the source is absent, so a caller that could not read a place MUST NOT reconcile it, per FR-005.
- A person closes an item and the place still holds the thing: no event, per FR-005.

## Assumptions

- Similarity is a token overlap of the lower-cased words: it proposes and a person decides, so a poor likeness costs a proposal and not an item.

## Open questions

- None.

## Key entities

- **Observation** - what one source read in one place, with its locator, hash and fingerprint.
- **Trace** - the link from an item to an observation of it.
- **Patch** - one event for one source, applied only by a source.
- **Preview** - what a patch would write, with its hash.
- **Outbox entry** - a patch no source could apply, with why.

## Success criteria

- **SC-001**: One thing seen in three places is one item with three traces, and an unchanged place makes no event.
- **SC-002**: A write is held to the preview a person saw.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
