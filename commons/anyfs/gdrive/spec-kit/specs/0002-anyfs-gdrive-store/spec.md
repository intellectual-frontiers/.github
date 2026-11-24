# Feature Specification: The store over a folder of Google Drive

**Spec ID:** 0002-anyfs-gdrive-store
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A store of AnyFS whose objects are the files below a folder of Google Drive, reached through the Drive API (version 3) with a bearer token. Drive addresses files by identifier and allows many files of one name in one folder, so the store resolves paths to identifiers and settles duplicates by a rule that every writer follows.

## Requirements

- **FR-001**: A place `gdrive://FOLDER` (the identifier of the folder) MUST open a store whose objects are the files below that folder; every request MUST carry `Authorization: Bearer` of a token from the token source, which is not part of the place and MUST NOT appear in a problem, and every request MUST say `supportsAllDrives`, so that a folder of a shared drive is served as one of a personal drive.
- **FR-002**: The store MUST have exactly the capabilities `read`, `write`, `list`, `stat` and `delete`, and MUST NOT have `cas` (Drive keeps no condition on a write, and a store that says it has one without it would lose a change), so that a write that expects a revision is refused as `unsupported-expectation` by the type of the store; it MUST say that its names are case-sensitive and its largest object (`maxBytes`, 5 MiB by default, the most one multipart upload takes), and MUST refuse `batch`, `rename`, `history`, `rangeRead`, `append` and `search` with `capability-absent`.
- **FR-003**: The revision of an object MUST be `sha256:` and the digest of its bytes (the `sha256Checksum` Drive keeps for a file, else the digest of what a read gives), the same as in every other store; a read MUST check its bytes against the digest Drive gives and say `tampered` where they differ.
- **FR-004**: A path MUST be resolved to the identifiers of its folders and its file by asking for a name in a parent (the name compared exactly, as a query of Drive may match more loosely, and a name that is in the trash not counted); where Drive holds more than one file or folder of one name in one parent, the oldest (by creation time, then by identifier) MUST be the one the store means, whoever asks.
- **FR-005**: A write that expects no object MUST make the file and then ask for its name again: where an older file of that name is there, the store MUST remove the file it made and answer with a conflict that names the revision of the older one, so that of several writers exactly one wins; a folder made on the way MUST be settled the same way; a write that expects nothing MUST replace the content of the file that is there, or make it, and say which.
- **FR-006**: A delete MUST be idempotent, MUST move the file to the trash (`trash`, the default) or remove it for good (`delete`), as the option says, and an expectation of a revision on a delete MUST be refused as `unsupported-expectation`.
- **FR-007**: A listing MUST walk the folders below the prefix with `pageToken`, list the files that are blobs only (a folder, a document of Google, a sheet, a shortcut are not objects), count a name that is in the trash for nothing, settle duplicates as FR-004 does, give the entries in the order of paths in pages with a cursor, and refuse to walk more than a bound of entries or requests.
- **FR-008**: What Drive answers when it fails MUST be a kind of a closed list by a total table (a file that is not there, a rate limit, a fault of the service, a denial, a refusal of the token, a full quota, a too large object, an invalid request), and every kind MUST be a problem of AnyFS: a rate limit and a fault retryable, a denial and a refused token not; a `403` for a rate limit MUST be told from a `403` for a denial by its reason; a `401` MUST be asked again once with a new token from the source.
- **FR-009**: An object larger than `maxBytes` MUST be refused as `too-large` before it is sent, and no request MUST be made for it.

## Acceptance scenarios

1. **Given** a store on a fake Drive, **When** eight writers expect no object for one name at once, **Then** exactly one wins, the others get a conflict, and the folder holds one file of that name, per FR-005.

## Out of scope

- Resumable uploads (objects above 5 MiB), ranges, revisions of a file (history), the changes feed, permissions and sharing, and Google documents, sheets and slides (they have no bytes to keep).

## Edge cases

- Two files of one name that were made by another client are one object for this store, the oldest, per FR-004.
- A query of Drive that matches a name more loosely than equality is filtered, per FR-004.

## Assumptions

- Drive allows many files of one name in a folder and keeps `createdTime` in milliseconds; ties are broken by identifier.
- A store of a folder is the only writer that follows the rule of the oldest; another client that makes duplicates is tolerated and never repaired.

## Open questions

- None.

## Key entities

- **Token source** - a function that gives a bearer token or says why it cannot.
- **The oldest** - the file the store means where a name is held more than once.

## Success criteria

- **SC-001**: Code that holds a store of any other backend holds this one, gets the same answers with the revisions of the bytes, and is told by its type that this one has no compare-and-write.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
