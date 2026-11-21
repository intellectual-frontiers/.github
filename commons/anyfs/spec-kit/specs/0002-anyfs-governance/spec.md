# Feature Specification: AnyFS: governance

**Spec ID:** 0002-anyfs-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The identities of AnyFS as types: a path, a prefix, a revision, a cursor and a place, each made only by its parser; the expectation of a write; the capabilities of a store; how consistent a store is; and the problems a store reports, each with one sentence.

## Requirements

- **FR-001**: A path MUST be a relative key of one or more segments joined by `/`, made only by `parsePath`, which MUST refuse an empty path, an empty segment, the segments `.` and `..`, a leading or trailing `/`, a backslash, a NUL or any other control character, a segment of more than 255 UTF-8 bytes, a path of more than 1024 UTF-8 bytes and a lone surrogate, and MUST return the path in Unicode normalization form C. A prefix MUST be the root or a path, made only by `parsePrefix`, and MUST contain exactly the paths below it.
- **FR-002**: Paths MUST be case sensitive and compared as normalization form C text. `portabilityFindings` MUST name, for a path, each reason another file system could not hold it: a character one of them reserves (`<`, `>`, `:`, `"`, `|`, `?`, `*`), a segment ending in a space or a dot, and a segment that is the name of a device on Windows.
- **FR-003**: A revision MUST be `scheme:value` (a lower case scheme of letters and digits, then printable ASCII with no space, at most 256 characters), made only by `parseRevision`; a cursor MUST be a non-empty opaque text of printable ASCII, made only by `parseCursor`. Two revisions MUST be equal when their texts are.
- **FR-004**: An expectation MUST be exactly one of `any`, `absent` or `rev` with a revision; `ExpectFor<C>` MUST be the expectation a store of capabilities `C` accepts, which MUST include `rev` only where `C` includes `cas`.
- **FR-005**: The capabilities MUST be the closed union of five core capabilities (`read`, `write`, `list`, `stat`, `delete`) and nine optional ones (`cas`, `batch`, `rename`, `watch`, `lock`, `history`, `rangeRead`, `append`, `search`), each with one sentence saying what it adds, and `isCapability` MUST decide membership.
- **FR-006**: A store MUST declare its consistency, one of `strong`, `read-your-writes` or `eventual-listing`, and its traits: whether it tells paths apart by case and the largest object it holds, where it has a limit.
- **FR-007**: A place MUST be a typed address of a store, one of `memory`, `file`, `ssh`, `git`, `github`, `gitlab`, `s3`, `onedrive`, `gdrive` or `sql`, made only by `parsePlace`; `formatPlace` of a parsed place MUST parse to the same place; a text with an unknown scheme or a malformed part MUST be refused with the part named; `availability` MUST say `implemented` for `memory` and `file` and `planned` for the others.
- **FR-008**: A problem MUST be exactly one of `missing`, `conflict` (with what was expected and what was found), `refused` (with a reason of the closed list `read-only`, `outside-scope`, `unsupported-expectation`, `capability-absent`, `too-large`, `unportable-path`, `consent`), `unavailable` (with whether a retry may succeed) or `tampered`, and `describeProblem` MUST give one sentence for each.

## Acceptance scenarios

1. **Given** the text `a/../b`, **When** it is parsed as a path, **Then** it is refused naming the segment, per FR-001; and **Given** the same text in decomposed Unicode and composed Unicode, **Then** the parsed paths are equal, per FR-001.
2. **Given** the path `a/b:c`, **When** its portability is read, **Then** the colon is named, per FR-002.
3. **Given** `github://owner/repo@main`, **When** it is parsed and formatted, **Then** the text is the same and its availability is `planned`, per FR-007.
4. **Given** a store whose capabilities do not include `cas`, **When** a write with a revision is written, **Then** the compiler reports it, per FR-004.
5. **Given** each kind of problem, **When** it is described, **Then** each is one sentence that names the path, per FR-008.

## Out of scope

- Reaching any place: a backend does that.

## Edge cases

- The root is a prefix and never a path: a path always has a name (FR-001).

## Assumptions

- The closed lists are the ones of the library; a plugin names a capability it adds by adding it to the union in a release of the library.

## Open questions

- None.

## Key entities

- **Path**, **Prefix**, **Revision**, **Cursor**, **Place**, **Expect**, **Capability**, **Problem**.

## Success criteria

- **SC-001**: A value of one of these types is valid because of how it was made, and no function checks it again.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
