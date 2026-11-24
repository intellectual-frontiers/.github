# Feature Specification: AnyFS S3 tests

**Spec ID:** 0003-anyfs-s3-tests
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The tests run on a real server of S3 where one can be run and on a server made in process everywhere, both held to the same contract, so that the server made in process is trusted only as far as the real one agrees with it.

## Requirements

- **FR-001**: The download of RustFS MUST be pinned by the SHA-256 of the archive of each platform, from a TLS address of the publisher for one version; an archive that is not the pinned one MUST be refused and MUST NOT be unpacked, a program that was not unpacked from a verified archive MUST NOT be run, the program MUST be kept below the cache folder of the user (XDG on Linux), used again with no download where its digest is the one recorded when it was unpacked, and replaced from a verified archive where it is not.
- **FR-002**: The server made in process MUST check Signature Version 4 as the service checks it, MUST honour or ignore each condition as it is told, and MUST be held to the contract tests that run on RustFS, so that a behaviour of the fake that the real server does not have is a failing test.
- **FR-003**: Where RustFS cannot be run (no pin for the platform, no network, an archive that is not the pinned one) a test MUST say why it did not run it and MUST run on the server made in process, and a test MUST NOT pass silently for want of the real server.

## Acceptance scenarios

1. **Given** an archive whose digest is not the pin, **When** the binary is asked for, **Then** it is refused and nothing is unpacked, per FR-001.
2. **Given** RustFS, **When** the contract tests run, **Then** they are those that run on the fake, per FR-002.

## Out of scope

- Servers other than RustFS and the one in process (MinIO, localstack): a later choice.

## Edge cases

- A cache whose binary was replaced: downloaded again, per FR-001.

## Assumptions

- The publisher gives no checksum file: the pin is the digest of the archive as downloaded over TLS on the day it was pinned.

## Open questions

- None.

## Key entities

- **The pin** - the address, the digest of the archive and the file in it, for one platform.

## Success criteria

- **SC-001**: Every contract test runs on both servers where both can be run.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
