# Feature Specification: The store over a drive and a folder of Microsoft Graph

**Spec ID:** 0002-anyfs-onedrive-store
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A store of AnyFS whose objects are the files of a folder of a OneDrive or SharePoint drive, reached by path through Microsoft Graph with a bearer token, with a revision on every read and a stated expectation on every write.

## Requirements

- **FR-001**: A place `onedrive://DRIVE/PREFIX` (DRIVE is `me` or the id of a drive) MUST open a store whose objects are the files below PREFIX; every request MUST carry `Authorization: Bearer` of a token from the token source, which is not part of the place and MUST NOT appear in a problem, and a download that Graph redirects (a pre-authenticated address) MUST be fetched with no authorization header and only to an `https` address.
- **FR-002**: The store MUST have exactly the capabilities `read`, `write`, `list`, `stat`, `delete` and `cas`, MUST say that its names are not case-sensitive and its largest object (`maxBytes`, 64 MiB by default, never above the 250 MB of a simple upload), and MUST refuse `batch`, `rename`, `history`, `rangeRead`, `append` and `search` with `capability-absent`.
- **FR-003**: The revision of an object MUST be `sha256:` and the digest of its bytes (the one Graph keeps as `sha256Hash` where it gives one, else the digest of what a read gives), so that the same bytes are the same revision as in every other store; a read MUST check its bytes against the digest Graph gives and say `tampered` where they differ.
- **FR-004**: A write that expects no object MUST be made with `@microsoft.graph.conflictBehavior=fail` (so that of several writers one wins), a write that expects a revision MUST be made with `If-Match` on the entity tag of the object seen to be at that revision, a write that expects nothing MUST replace, and a write that does not hold MUST be a conflict that says what the object is at.
- **FR-005**: A delete MUST be idempotent, MUST hold to an expectation as a write does (`If-Match` for a revision), and MUST remove the folders it leaves empty up to the prefix, so that a name that was a folder can be a file again.
- **FR-006**: A listing MUST walk the folders below the prefix with the paging Graph gives (following `@odata.nextLink` only on the host of the service), list files only (a folder, a package and a shortcut are not objects), skip a name that is not a path of the store, give the entries in the order of paths in pages with a cursor, and refuse to walk more than a bound of entries or requests.
- **FR-007**: A name that OneDrive does not keep (a character of `\" * : < > ? / \\ |`, a leading space, a trailing space or dot, a name of a device, `.lock`, `desktop.ini`, `_vti_` and a name that starts `~$`) MUST be refused as `unportable-path` before any request, and a name that is below a file MUST be refused.
- **FR-008**: What Graph answers when it fails MUST be a kind of a closed list by a total table (a missing item, a name that is there, a condition that failed, a lock, a throttle with `Retry-After`, a fault of the service, a denial, a refusal of the token, a too large object, an invalid request, a full quota), and every kind MUST be a problem of AnyFS: a throttle and a fault retryable, a denial and a refusal of the token not; a `401` MUST be asked again once with a new token from the source.
- **FR-009**: An object larger than `maxBytes` MUST be refused as `too-large` before it is sent.

## Acceptance scenarios

1. **Given** a store on a fake Graph, **When** two writers expect no object for one name, **Then** exactly one wins and the other gets a conflict that names the revision found, per FR-004.

## Out of scope

- Upload sessions (objects above the simple upload), ranges, streams, versions of a file (history), the delta of a drive, change notifications and sharing links.

## Edge cases

- A folder that holds a file and a folder of one name is not possible on OneDrive, per FR-007.
- A hash that Graph gives and that differs from the bytes read is a tamper and not a race, per FR-003.

## Assumptions

- Graph keeps the names of a drive case-insensitive and case-preserving.
- The entity tag changes at every write of the object, so it is used to guard a write and never as a revision.

## Open questions

- None.

## Key entities

- **Token source** - a function that gives a bearer token or says why it cannot.
- **Revision** - `sha256:` and the digest of the bytes.

## Success criteria

- **SC-001**: Code that holds a store of any other backend holds this one and gets the same answers, with the revisions of the bytes.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
