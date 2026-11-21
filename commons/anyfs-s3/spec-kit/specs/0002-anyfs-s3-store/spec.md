# Feature Specification: AnyFS S3 store

**Spec ID:** 0002-anyfs-s3-store
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A store over a bucket and a prefix of any S3-compatible service holds whole objects with a revision on every read and a stated expectation on every write, as the endpoint was found to keep the conditions that compare-and-write needs, signed by Signature Version 4, and held to the same conformance suites as every backend.

## Requirements

- **FR-001**: A bucket name MUST be made only by `parseBucketName`, which MUST accept 3 to 63 lower case letters, digits, hyphens and dots, beginning and ending with a letter or a digit, and MUST refuse two dots together, a dot beside a hyphen, a name written as an address of the internet, and the reserved prefixes and suffixes of S3.
- **FR-002**: The key of a path MUST be the prefix of the place, a `/` and the path (the path alone below the root), written in a URL segment by segment as RFC 3986 says with the `/` kept; a key that is not the key of a path of the store (outside the prefix, not a path, not in normalization form C, or a name that begins with `.anyfs-`) MUST be a finding and MUST NOT be listed or read, and a key listed with `encoding-type=url` MUST be read back whatever it holds.
- **FR-003**: The XML of an answer MUST be read by a reader that takes one root element, its children, its text and the five named and the numeric entities, and MUST refuse a document type, a comment, CDATA, an instruction, a character XML 1.0 does not allow, text after the root, and a document past a bound of size, depth or elements; a listing and an error MUST be read from it.
- **FR-004**: Every failure of the service MUST be of one of thirteen kinds, by its code where it is known and by its status where it is not, and every kind MUST be a problem of AnyFS by a total table: a failed condition is a conflict only where the path, the expectation and what the object is at are known, a throttle and a fault of the server MUST be retryable, a refusal of the keys MUST NOT be, and a sentence MUST hold no more than the service said.
- **FR-005**: The keys of the service MUST come from a source (a pair given in code, the environment through a function, or a provider that is asked again only after its time, which includes a secret asked of a person through the credential port of Headless), and no sentence, URL or recorded request MUST hold a key.
- **FR-006**: A request MUST be sent through a transport that gives the status, the headers in lower case and the bytes, MUST NOT follow a redirect, and a connection that fails MUST be a value of the call and never thrown.
- **FR-007**: A request MUST be signed by Signature Version 4 for the service `s3` in the path style or the virtual-hosted style asked for, with the SHA-256 of the payload signed on a connection that is not encrypted and `UNSIGNED-PAYLOAD` on one that is unless told otherwise, and the signatures MUST be those AWS publishes for its own examples of S3.
- **FR-008**: Opening a store MUST probe the endpoint below the prefix with an object of its own that it removes whatever the answers were, MUST find whether the keys may write, whether `If-None-Match: *` and `If-Match` on a write and `If-Match` on a delete are honoured and whether the checksum is kept, and MUST make a store with `cas` only where every condition is honoured, a store without `cas` where one is not, and a store that can only read where the keys may not write; the type of the store MUST say which.
- **FR-009**: The revision of an object MUST be `sha256:` and the digest of its bytes, kept in `x-amz-meta-anyfs-sha256` and checked on every read (a read whose bytes are not that digest is tampered) and sent as `x-amz-checksum-sha256` where the service keeps it; an object written by another tool MUST be at the digest of its bytes; and with `revisions: "etag"` the revision MUST be `etag:` and the entity tag, the other scheme MUST be refused as an expectation, and each MUST be told so by `facts.digest`.
- **FR-010**: A write that expects no object MUST be `If-None-Match: *` and one that expects a revision MUST be `If-Match` on the entity tag, so that of writers that race exactly one wins and the others conflict with what the object is at; where the endpoint ignores `If-None-Match` a write that expects no object MUST be refused, with the reason, and never made.
- **FR-011**: A read, a stat and a delete MUST end as the operation of AnyFS says: a missing object is missing, a delete of a missing object succeeds, a delete that expects a revision removes the object only at it and a delete that expects no object conflicts where there is one.
- **FR-012**: A list MUST be in the order of the paths, below its prefix only, in pages of any size up to a thousand with a cursor until the last page and a full page where there is a cursor, for a bucket of more than a thousand objects.
- **FR-013**: An object of more than `maxBytes` (64 MiB where it is left out) MUST be refused before it is sent, and the store MUST NOT have `batch`, `rename`, `history`, a range, `append` or `search`, MUST say `capability-absent` where it is asked for one, and MUST NOT retry a call, which the layer `retrying` does for the problems that say they are worth one.
- **FR-014**: The store MUST pass every case of the conformance suite of AnyFS in both modes of revision, and every law of the conformance suite of the bridge between a bucket and memory and between buckets, on the server made in process and on RustFS where it can be run.

## Acceptance scenarios

1. **Given** an endpoint that ignores `If-Match`, **When** a store is opened, **Then** it has no `cas` in its type, per FR-008.
2. **Given** twelve writers that race to make one object, **When** they write, **Then** one wins and eleven conflict, per FR-010.
3. **Given** a bucket of 1105 objects, **When** it is listed in pages, **Then** every object is seen once in order, per FR-012.

## Out of scope

- Multipart upload of an object larger than `maxBytes`, ranges and streams, versioned buckets (`history`), server-side copy, and the credentials of a cloud's own role: later capabilities.

## Edge cases

- A key written by another tool in decomposed Unicode: not listed, per FR-002.
- A bucket in another region than the endpoint: a redirect, said as such, per FR-006.
- A clock that is far from the service's: said, per FR-004.

## Assumptions

- The endpoint is strongly consistent for objects, as Amazon S3 has been since 2020.

## Open questions

- None.

## Key entities

- **The probe** - the writes and deletes the store makes of an object of its own to find what an endpoint keeps.
- **The revision** - `sha256:` and the digest of the bytes, or `etag:` and the entity tag.

## Success criteria

- **SC-001**: Both servers pass the same contract.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
