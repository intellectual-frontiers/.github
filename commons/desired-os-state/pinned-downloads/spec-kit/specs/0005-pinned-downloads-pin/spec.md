# Feature Specification: Native-pinned pin tool

**Spec ID:** 0005-pinned-downloads-pin
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A pin is the exact version of a program with, for each platform, the address of the publisher's artifact and its SHA-256. Writing one by hand is where mistakes and trust on first use come in, so a tool does the work: from the addresses a publisher gives, it fetches each artifact, takes the SHA-256 itself, checks it against the checksum the publisher publishes, proves the artifact unpacks safely with its program where it is said to be, and writes a proposal. A pin is written in the packaging ontology by its owner (commons 0002-packaging); the tool writes none and nothing it proposes becomes a pin unreviewed.

## Requirements

- **FR-001**: A request MUST be refused unless it names a program in lower case words, a version, a program file and at least one platform, and every address in it (an artifact or a checksum file) MUST be `https` with no credentials; a refusal MUST say which part is wrong.
- **FR-002**: For each platform the tool MUST fetch the artifact and take its SHA-256 itself; a hash it was not asked to check MUST never be copied from the request or from a publisher's file as if it were its own.
- **FR-003**: Where the request names the publisher's checksum, the tool MUST compare it with the hash it took and say `verified`, `mismatch` (with both hashes), `absent` (none named) or `unreadable` (the file or the line could not be read); a checksum file lists many artifacts and the line of the one named MUST be the one taken.
- **FR-004**: For each platform the tool MUST prove the artifact unpacks by the rules of an install (0002-pinned-downloads-install) with the program at the folder named, and report why not where it does not; a platform that could not be fetched MUST say so and MUST NOT stop the other platforms.
- **FR-005**: The proposal MUST be `ready` only where every platform is verified by the publisher and has its program; it MUST list for each platform every concern a reviewer should know (no checksum named, a mismatch, a program missing); it MUST say it is a proposal and MUST hold no secret; and its text MUST be the same for the same request whatever the order the platforms were written in.
- **FR-006**: The program `pin REQUEST [--out FILE]` MUST write the proposal to the file or print it, MUST change no pin and no store, and MUST end with status 0 where the proposal is ready, 2 where it is not, 1 where the request could not be read and 64 on a wrong use.

## Acceptance scenarios

1. **Given** a request with an `http` address, **When** it is read, **Then** it is refused naming the platform, per FR-001.
2. **Given** an artifact and a checksum file that lists it among others, **When** a pin is proposed, **Then** the hash is the one the tool took, the publisher's line is the one of the artifact and the platform is verified, per FR-002 and FR-003.
3. **Given** a publisher's checksum that differs, **When** a pin is proposed, **Then** the platform is `mismatch` with both hashes and the proposal is not ready, per FR-003 and FR-005.
4. **Given** no checksum named, **When** a pin is proposed, **Then** the platform is `absent` with the concern that this hash is the first seen, per FR-003 and FR-005.
5. **Given** an artifact that has no program where it is said to be, **When** a pin is proposed, **Then** the platform says why and the proposal is not ready, per FR-004.
6. **Given** one platform that cannot be fetched, **When** a pin is proposed, **Then** the other platforms are still proposed, per FR-004.
7. **Given** a request, **When** `pin` runs, **Then** the status is 0 where ready and 2 where not, and nothing but the proposal file is written, per FR-006.

## Out of scope

- Writing a pin into the ontology and reviewing it: the ontology and its owner.
- Verifying a signature of a publisher (cosign, minisign, GPG): a later version; the proposal says `publisher` is by checksum.

## Edge cases

- A checksum file of one hash and no name: that hash is taken, per FR-003.
- A name that appears with a path in the checksum file (`dist/bun.zip`): its last word is compared, per FR-003.

## Assumptions

- A publisher's checksum file is served from the same account as the artifact, so `verified` shows the download was not damaged, not that the publisher is honest; the reviewer decides that.

## Open questions

- None.

## Key entities

- **Request** - what a publisher gives for a version of a program.
- **Proposal** - what the tool found, for a person to review.

## Success criteria

- **SC-001**: A pin that is proposed was fetched, hashed and unpacked by the tool, never copied.
- **SC-002**: The tool cannot change a pin or a store.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
