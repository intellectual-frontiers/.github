# Feature Specification: AnyFS Serve: logical

**Spec ID:** 0003-anyfs-serve-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What the server does with a request as functions: the strict XML, the addresses, the answers, the properties, the table of locks, the If header, the credentials and the handler from a Request to a Response.

## Requirements

- **FR-001**: The XML reader MUST take one document of elements, attributes, text, CDATA, comments and the five named references and the numeric ones, MUST resolve the namespaces, and MUST refuse a document type (no entity is declared or expanded), a reference it does not know, a prefix that is not declared or is declared as empty, a document larger than the limit in bytes, nested deeper than the limit, or with more parts than the limit, each as a typed problem with its offset.
- **FR-002**: The XML writer MUST escape every text and attribute, replace a character that XML 1.0 does not allow, declare each namespace once on the root with `D` for `DAV:`, and write an element with no children as an empty element; a tree that the writer wrote MUST be read back as the same tree.
- **FR-003**: An address MUST be read one segment at a time below the base, and MUST be refused where a segment decodes to something with a slash, is `.` or `..`, holds a control character, a NUL or a backslash, is not valid percent-encoding, or (under the policy `refuse`) is not in NFC; under the policy `nfc` it MUST be turned into NFC; `hrefOf` MUST encode every segment so that `pathOfUrl` of it is the same path; a `Destination` on another host MUST be refused as another host.
- **FR-004**: Every answer MUST carry `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, an answer made from a file or a listing MUST carry `Content-Security-Policy: sandbox`, and an answer carried out by the POSIX view MUST say in `X-Anyfs-Fidelity` whether it was `native`, `emulated; reason=…; risk=…` or `refused; reason=…`; the status of an error of the view MUST be the one of the table of FR-002 of the governance, `503` with `Retry-After` where the store is not there now and `502` where what it holds is not what its revision says.
- **FR-005**: A property request MUST be read from the body of a PROPFIND (an empty body asks for every property), and an answer MUST give the live properties the store knows (the type, the length, the time, the entity tag, the content type, the name and the locks) with a `404` part for each property that is asked for and is not one; a PROPPATCH MUST be read from its body and every property it names MUST be answered `403` in a multistatus, since no property is stored.
- **FR-006**: The table of locks MUST give an exclusive write lock of a depth of 0 or infinity with a token of the form `opaquelocktoken:<uuid>`, MUST refuse a lock where another covers the resource or, for a lock of infinity, lies below it, MUST refuse a lock once it holds as many as the limit, and MUST keep no more than the limit of seconds whatever the caller asks.
- **FR-007**: A lock MUST end at the time it was given for and be gone the next time anyone asks, MUST be refreshed to now plus the seconds asked, MUST be released only at a resource it covers with its own token, and `blocking` MUST give the first lock whose token was not submitted that covers the resource, and for a subtree those below it too.
- **FR-008**: The `If` header MUST be read as lists of conditions in parentheses, each a token in angle brackets or an entity tag in square brackets that may be preceded by `Not`, optionally after a resource tag; text that is not that MUST be refused whole; the tokens it submits MUST be the ones not negated; it MUST hold for a resource when any list that applies to it holds, and a header with no list that applies MUST not constrain it.
- **FR-009**: The credentials MUST be read from `Authorization` as a bearer token or as HTTP Basic whose password is the token, a token MUST be compared in constant time over the digests of both, and a token made by the server MUST be 32 random bytes as 64 hexadecimal digits.
- **FR-010**: A request MUST be checked in the order of its host (an `Host` that is not in the list of hosts is `403`, so that a page of another site cannot reach the server), its method (one that is not answered is `405` with `Allow`), its credentials (none that are good is `401` with a challenge for Basic and Bearer), its address (outside the base `404`, malformed `400`, with a fragment `400`) and its store (a method that changes a store that cannot write is `403` and refused as read-only), and an error that the handler does not expect MUST be `500` and never reach the caller as an exception.
- **FR-011**: GET and HEAD MUST give an object with its content type, a strong entity tag that is its revision in quotes, its time, `Accept-Ranges: bytes` and `X-Anyfs-Fidelity: native`; `If-None-Match` that matches MUST give `304` and `If-Match` that does not `412`; one range `bytes=a-b`, `a-` or `-n` MUST give `206` with `Content-Range` and be labelled as emulated by a read of the whole object, one past the end `416`; a collection MUST give a page whose every name is escaped.
- **FR-012**: PUT MUST write the object whole, give `201` with `Location` where it made it and `204` where it replaced it, with the entity tag of what it wrote; `If-None-Match: *` MUST be the expectation that there is no object and `If-Match` the expectation of the revision where the store has `cas` (and be labelled as emulated and unguarded where it has not); a collection MUST give `405`, a file on the way `409`, a body larger than the limit or than the store holds `413`, a name the server keeps or a junk name under `refuse` `403`; a change a lock holds without its token MUST give `423` and an `If` header that does not hold `412`, before the lock is looked at.
- **FR-013**: DELETE MUST remove an object or a collection and everything below it and give `204`; MKCOL MUST make a collection with `201`, MUST give `405` where there is something, `409` where its parent is not there or is a file, and `415` for a body; COPY and MOVE MUST read the `Destination` (the same host), `Overwrite` (`T` by default) and `Depth` (0 or infinity for COPY, infinity for MOVE), MUST refuse the same resource and a resource into or over one it lies in with `403`, a missing parent with `409`, an existing destination with `Overwrite: F` with `412`, and give `201` or `204`, and a COPY that fails in part MUST give a `207` that names what failed.
- **FR-014**: PROPFIND MUST answer `Depth: 0` and `Depth: 1` with `207`, MUST refuse `infinity` and a missing depth with `403` and the precondition `propfind-finite-depth`, MUST give `404` for a resource that is not there, MUST hide junk under the policy `hide`, and MUST refuse an answer of more resources than the limit with `413`.
- **FR-015**: LOCK MUST read a lockinfo of an exclusive write lock (another scope or type is `412`), give `200` with the `Lock-Token` header and the lock discovery in the body, make an empty object where there is none (labelled as emulated) and give `201`, give `423` where the table refuses, refresh a lock named in `If` where the body is empty; UNLOCK MUST release a lock named in `Lock-Token` at a resource it covers with `204` and give `409` for any other.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is run, **Then** the requirement holds, per FR-001.
2. **Given** the case of FR-002, **When** it is run, **Then** the requirement holds, per FR-002.
3. **Given** the case of FR-003, **When** it is run, **Then** the requirement holds, per FR-003.
4. **Given** the case of FR-004, **When** it is run, **Then** the requirement holds, per FR-004.
5. **Given** the case of FR-005, **When** it is run, **Then** the requirement holds, per FR-005.
6. **Given** the case of FR-006, **When** it is run, **Then** the requirement holds, per FR-006.
7. **Given** the case of FR-007, **When** it is run, **Then** the requirement holds, per FR-007.
8. **Given** the case of FR-008, **When** it is run, **Then** the requirement holds, per FR-008.
9. **Given** the case of FR-009, **When** it is run, **Then** the requirement holds, per FR-009.
10. **Given** the case of FR-010, **When** it is run, **Then** the requirement holds, per FR-010.
11. **Given** the case of FR-011, **When** it is run, **Then** the requirement holds, per FR-011.
12. **Given** the case of FR-012, **When** it is run, **Then** the requirement holds, per FR-012.
13. **Given** the case of FR-013, **When** it is run, **Then** the requirement holds, per FR-013.
14. **Given** the case of FR-014, **When** it is run, **Then** the requirement holds, per FR-014.
15. **Given** the case of FR-015, **When** it is run, **Then** the requirement holds, per FR-015.

## Out of scope

- Properties stored by the server, shared locks and NFS: later specifications.

## Edge cases

- An address that is not below the base is `404` and one with a fragment is `400`, per FR-010.

## Assumptions

- The library `@intellectual-frontiers/anyfs` is the host of the family and `@intellectual-frontiers/anyfs-posix` gives the view that every method is carried out on.

## Open questions

- None.

## Key entities

- **Handler** - a function from a Request to a Response that serves one store.
- **Exposure** - where the server may listen and which hosts it may be asked for.

## Success criteria

- **SC-001**: The tests of every requirement of the library pass on Bun and on Node 26.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
