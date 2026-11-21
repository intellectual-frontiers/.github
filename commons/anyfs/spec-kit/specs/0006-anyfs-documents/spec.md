# Feature Specification: AnyFS: typed documents

**Spec ID:** 0006-anyfs-documents
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The bytes of a store become typed documents: a codec between a value and bytes, a schema with a version and its migrations as code, a layout that says where the documents of a collection are, and a collection whose documents come with their revisions, whose writes state what they expect and whose update retries where another writer got there first. The module is `./docs` of AnyFS: it is a function of the operations of a store and does no input or output of its own, so it is in the logical layer and imports no other layer above it, and the codecs that need the file formats of commons are the separate entry `./docs/formats`, so that a program that needs no format loads none.

## Requirements

- **FR-001**: A codec MUST be a media type and two functions that end in results and never throw: `encode` from a value to bytes and `decode` from bytes to a value with whether the bytes were written at an older version; JSON MUST be written canonically (keys in order, two-space indentation, one newline at the end) so that one value is one set of bytes and, on a store that names revisions by content, one revision; `toJsonValue` MUST refuse what is not JSON (an undefined value, a number that is not finite, a bigint, a lone surrogate, an object that is not plain, a nesting deeper than 64) with the reason.
- **FR-002**: The bytes codec MUST keep the bytes as they are; the text codec MUST refuse bytes that are not UTF-8 and text with a lone surrogate; a codec that cannot read MUST end with a problem whose reason is one of `malformed`, `invalid`, `newer-version` or `unencodable`, and MUST NOT throw.
- **FR-003**: `defineSchema` MUST refuse a version that is not a positive whole number and migrations that do not step from 1 to the version before the current one, in order, with none missing or extra; a migration MUST be a pure function of the object of its version, without the version field, to the object of the next.
- **FR-004**: A schema codec MUST write the version in the field `$version` and read a document with no such field as version 1; it MUST read a document of an older version through the migrations in order and say that it is stale, MUST refuse a document of a newer version as `newer-version` and never guess at it, and MUST refuse, with the reason and as `invalid`, a document that is not an object, a version that is not a positive whole number, a migration that refuses and a shape the decoder refuses.
- **FR-005**: An identifier, an extension and a day MUST be made only by their parsers, which refuse what is not one; a layout MUST be a pair of functions, `path` from a key to a path below the collection and `key` from a path to its key, such that for every key that has a path the path gives the key back (`layoutFindings` MUST find any key for which it does not), and `key` MUST refuse, with the reason, a path that is none of the layout's; `byId`, `sharded` and `byDate` MUST be provided.
- **FR-006**: A collection's problem MUST be one of `store` (the problem of the store, unchanged, so that a conflict is the conflict of the store), `undecodable`, `unencodable`, `bad-key`, `exhausted` and `refused`, each with one sentence, and an object that is not a good document found by a listing MUST be a finding (`foreign`, `undecodable` or `unreadable`) with one sentence and never a failure of the listing.
- **FR-007**: `get` MUST give the document with the revision it was read at, the path and whether it is stale; `put` MUST state the expectation it is given to the store, exactly as the store takes it, and give the revision it made; `delete` MUST do the same; a put of a value MUST write the bytes of its codec and nothing else; a key that has no path MUST be a `bad-key` before the store is asked.
- **FR-008**: `list` MUST give one page of the documents below the prefix of the collection in the order of their paths with the findings beside them and the cursor of the next page where there is one, reading at most `readers` objects at once; `scan` MUST give every item of every page, lazily, so that a page is listed and read only when the caller asks for an item of it; an object that is deleted between the listing and its reading MUST be left out and not a finding.
- **FR-009**: `update` MUST read the document, give it to the caller's function (which gives `put`, `keep` or `delete`), and write with the revision that was read, or with `absent` where there was none; where the store answers a conflict it MUST read again and repeat, at most `attempts` times with the `pause` between them, and then end with `exhausted`; a problem that is not a conflict MUST end it as it is; concurrent updates of one document MUST all count, none lost.
- **FR-010**: What a collection may do MUST be in its type: a collection of a store without `read` has no `get`, without `write` no `put`, without `delete` no `delete`, without `list` and `read` no `list` or `scan`, without `cas` no `update` or `migrate`, and a put or a delete takes a revision as its expectation only on a store with `cas`; the delete outcome of an update MUST be in its type only on a store with `delete`; `update` and `migrate` MUST end with `refused`, before they read, on a store without `cas` that is called as if it had it.
- **FR-011**: `migrate` MUST write each stale document again at the current version through `update`, leave the others as they are, report the documents scanned, the documents written again, the findings and the failures, and write nothing on a second run; a collection MUST keep every law above over a store in a folder as over a store in memory.
- **FR-012**: `./docs/formats` MUST give the tree codecs of JSON5 and YAML, which read a tree from the format of the file formats of commons as a JSON value and write it in its canonical text, and `versioned` over one of them MUST be a typed document with a version like any other.

## Acceptance scenarios

1. **Given** two values with the same fields in a different order, **When** each is written by the JSON codec, **Then** the bytes are the same, per FR-001.
2. **Given** a document of version 1 and a schema of version 2, **When** it is read, **Then** it has the migration's value and is stale, per FR-004.
3. **Given** a document written by newer code, **When** it is read, **Then** it is refused as `newer-version` and not changed, per FR-004.
4. **Given** a folder with good documents, a file of broken JSON and a file the layout does not name, **When** the collection is scanned, **Then** the good documents come with a finding for each of the others, per FR-006 and FR-008.
5. **Given** six concurrent updates that each add one to a counter, **When** they all end, **Then** the counter is 6 and some took more than one attempt, per FR-009.
6. **Given** a store without `cas`, **When** an update is written on its collection, **Then** the compiler refuses it, and called as if it had `cas` it ends `refused` before it reads, per FR-010.
7. **Given** a collection with documents of version 1 and 2, **When** it is migrated, **Then** those of version 1 are written at version 2 and a second migration writes nothing, per FR-011.

## Out of scope

- Watching a collection for changes; an index over the fields of the documents (the query layer, later); a codec of TOML or CBOR.
- The schema of a collection kept in the store itself: the schema is code.

## Edge cases

- A store that names revisions by something other than content (an entity tag) may give a new revision for a put of the same bytes; the canonical bytes make one value one set of bytes, and whether that is one revision is the store's (FR-001).
- A key whose identifier is shorter than the width of a shard has no path in the layout, and a put of it is a `bad-key` (FR-005, FR-007).
- A listing of a prefix that holds many objects reads a page at a time and holds only that page (FR-008).

## Assumptions

- The store is given by the caller and is held to the laws of its own specification (0003-anyfs-logical FR-003).
- The caller's function of an update has no effect but its result, because it may be called again.

## Open questions

- None.

## Key entities

- **Codec**, **Schema**, **Migration**, **Layout**, **Collection**, **Doc**, **Finding**, **DocProblem**.

## Success criteria

- **SC-001**: Every behaviour is tested over a store in memory and, where it touches a file system, a store in a folder, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
