# Feature Specification: Toolchain ontology adapter

**Spec ID:** 0004-toolchain-ontology
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The packaging ontology of commons (commons 0002-packaging) is the one place a pin is written: the version of a pinned program and, for each platform, the address of the publisher's artifact, its SHA-256, its format and the folder of its programs, or the reason the platform has none. Toolchain holds none of it (0002-toolchain-governance FR-008) and takes it from a source of pins (0003-toolchain-logical FR-007). This specification is the one adapter, the Physical unit that makes a source of pins from what the ontology states, so that the pure layers never read the ontology and a test can still use the real data.

## Requirements

- **FR-001**: `pinSourceFromOntology` MUST give a source of pins that, for a pin and a platform the ontology states, gives the version, the address, the SHA-256, the format and the folder of its download as a `Download`.
- **FR-002**: Where the ontology gives no download, the source MUST give the reason in the ontology's own words and naming the pin and the platform: a pin or a platform it does not state, a pin it does not pin on the platform, a platform that is unpinned with its reason, and a checksum that is not 64 lower-case hexadecimal digits.
- **FR-003**: Every download the source gives MUST pass `defineDownload` (an `https` address with no credentials, a SHA-256, a format and a folder inside the unpacked folder), and one that does not MUST be given as a reason and never as a download.
- **FR-004**: The adapter MUST hold no version, address or hash of its own: every one it gives is the ontology's, and no source of this library MUST contain one.

## Acceptance scenarios

1. **Given** the pin `bun` and the platform `linux-x64`, **When** the source is asked, **Then** it gives a download with an `https` address, a SHA-256, a format and a folder, per FR-001.
2. **Given** a pin the ontology does not state, **When** the source is asked, **Then** it gives a reason that names the pin, per FR-002.
3. **Given** a pin that is unpinned on a platform, **When** the source is asked, **Then** it gives a reason that names the pin and the platform and says why, per FR-002.
4. **Given** the tool `bun` with a pin binding and the dialect of downloads, **When** it is resolved with this source, **Then** it is resolved at the version of the ontology's pin, per FR-001.

## Out of scope

- Writing or reviewing a pin: the ontology and its owner; this adapter only reads.
- Fetching what an address gives: the dialect of downloads.

## Edge cases

- A pin that is pinned on some platforms only: the source gives a download for those and a reason for the others, per FR-002.
- A platform name the ontology does not state: a reason, per FR-002.

## Assumptions

- The ontology's own check (its generator) holds a pin well formed; this adapter checks the form again, because it is the last place before a download is made.

## Open questions

- None.

## Key entities

- **Adapter** - the Physical unit that makes a source of pins from the ontology.

## Success criteria

- **SC-001**: A version and a hash are read from the ontology each time and are written nowhere in this library.
- **SC-002**: A tool that is pinned in the ontology resolves without a line of this library naming its version.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
