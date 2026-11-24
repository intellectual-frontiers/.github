# Feature Specification: AnyFS Serve: governance

**Spec ID:** 0002-anyfs-serve-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The identities of the server as types: the methods it answers, the statuses it gives and the code of the POSIX view each comes from, the content types, and the options a program gives it.

## Requirements

- **FR-001**: The methods MUST be the closed union of twelve (`OPTIONS`, `GET`, `HEAD`, `PUT`, `DELETE`, `MKCOL`, `COPY`, `MOVE`, `PROPFIND`, `PROPPATCH`, `LOCK`, `UNLOCK`); `parseMethod` MUST give a method for exactly those upper-case names and nothing for any other text; `allowedMethods` MUST leave out the methods that change the store where it cannot write and `LOCK` and `UNLOCK` where locks are off.
- **FR-002**: The statuses MUST be a closed list, each with its words, and `statusOfErrno` MUST give a status for every code of the POSIX view in every context, as a table that the compiler holds to one entry for each code.
- **FR-003**: In the context of a new collection an existing name MUST be `405`, in the context of an exclusive write or of a copy or move that may not overwrite it MUST be `412`, and in any other context `409`; `ENOENT` MUST be `404`, `ESTALE` `412`, `EROFS` and `EACCES` `403`, `EXDEV` and `EIO` `502`, `ENOTSUP` `501`, `EFBIG` `413`, `EINVAL` `400` and `ENAMETOOLONG` `414`.
- **FR-004**: The content type of a name MUST be the one the table gives for its last extension in lower case, and `application/octet-stream` for a name with none, one that is only an extension and one the table does not know.
- **FR-005**: An exposure MUST be the loopback, or an address with at least one host that may be named in the `Host` header; `expose` MUST refuse an address that is empty or has space around it, no hosts, and a host with a path, a space or nothing; the hosts of the loopback MUST be `127.0.0.1`, `localhost` and `[::1]`.
- **FR-006**: The limits MUST be whole numbers of at least 1, with the defaults of 64 MiB for an object, 1 MiB of XML nested 32 deep with 20000 parts, locks of an hour at most, 1000 of them and 10000 resources of an answer; `withLimits` MUST refuse any other number.
- **FR-007**: A name MUST be junk where it is `.DS_Store`, `Thumbs.db`, `desktop.ini` or begins with `._`, and the policy for junk MUST be one of `allow` (the default), `hide` and `refuse`.
- **FR-008**: The options for an empty collection MUST be `markers` (the default: an object of a reserved name is kept below it) and `virtual` (nothing is written), and for a name that is not in the normal form of Unicode `nfc` (the default: it is turned into it) and `refuse`.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is run, **Then** the requirement holds, per FR-001.
2. **Given** the case of FR-002, **When** it is run, **Then** the requirement holds, per FR-002.
3. **Given** the case of FR-003, **When** it is run, **Then** the requirement holds, per FR-003.
4. **Given** the case of FR-004, **When** it is run, **Then** the requirement holds, per FR-004.
5. **Given** the case of FR-005, **When** it is run, **Then** the requirement holds, per FR-005.
6. **Given** the case of FR-006, **When** it is run, **Then** the requirement holds, per FR-006.
7. **Given** the case of FR-007, **When** it is run, **Then** the requirement holds, per FR-007.
8. **Given** the case of FR-008, **When** it is run, **Then** the requirement holds, per FR-008.

## Out of scope

- Properties stored by the server, shared locks and NFS: later specifications.

## Edge cases

- A method in lower case or with a space after it is no method, per FR-001.

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
