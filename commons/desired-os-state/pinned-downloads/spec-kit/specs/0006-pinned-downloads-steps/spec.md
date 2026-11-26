# Feature Specification: Native-pinned steps

**Spec ID:** 0006-pinned-downloads-steps
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The install of a pinned tool as data a host carries out, with the work of unpacking given to the tools of the operating system. TypeScript keeps the choice of the pin, the typed fetch step (the address, the SHA-256 and the destination), the typed verify step (the hash check of the file that was fetched) and, as `ArgvStep`s of core, the extraction by `tar`, `unzip`, `msiexec` or `installer`: words only, never a shell string. The in-memory unpacker of 0002-pinned-downloads-install stays as the path that refuses an unsafe archive before anything is written, until a test proves the tools of a platform do the same.

## Requirements

- **FR-001**: `installStepsOf(spec, folder)` MUST give, in this order, a fetch step (the address, the SHA-256 of the pin and the path the bytes are written to), a verify step (the SHA-256 the written file MUST have) and the steps that put the program in place, and nothing else: the fetch and verify steps are typed data and the others are `ArgvStep`s.
- **FR-002**: The extraction MUST be by the tool of the platform: `tar -xf` for a `tar` (it finds gzip and xz by itself) on every platform, `unzip -q -o` for a `zip` on Linux and macOS, `tar -xf` for a `zip` on Windows (whose `tar` reads zip), `msiexec /i … /qn /norestart` for an installer `msi` and `installer -pkg … -target /` for an installer `pkg`, and `install -m 0755` for a bare `file` on Linux and macOS; each MUST run as `user`, except the installer of a `pkg` and an `msi`, which run as `root`.
- **FR-003**: No step MUST be a shell string: `argvFindings` of core MUST find nothing in any extraction step of any archive format and platform, and a destination or file name that begins with a dash or holds a NUL MUST be refused.
- **FR-004**: `verifyFileBytes(step, bytes)` MUST say whether the bytes are the SHA-256 the verify step names, and MUST refuse otherwise with both hashes, so that the hash check stays in TypeScript.

## Acceptance scenarios

1. **Given** a tar pin for Linux, **When** the steps are made, **Then** they are a fetch, a verify and `tar -xf`, per FR-001 and FR-002.
2. **Given** a zip pin for Windows, **When** the steps are made, **Then** the extraction is `tar -xf`, per FR-002.
3. **Given** a destination that begins with a dash, **When** the steps are made, **Then** they are refused, per FR-003.

## Out of scope

- Running the steps: the jobs of the ssh-server library or the executor of headless.

## Edge cases

- A `file` pin on Windows: the fetch writes the program itself and no extraction step follows, per FR-002.

## Assumptions

- The tools of the platform (`tar`, `unzip`, `msiexec`, `installer`, `install`) are on it.

## Open questions

- Whether the in-memory unpacker can be removed: it refuses an unsafe archive (an absolute path, a link that leaves the folder, a path twice) before anything is written, which `tar` and `unzip` do not promise; it stays until a test proves what each tool does.

## Key entities

- **Fetch step** - what to download and where to put it.
- **Verify step** - the hash the downloaded file must have.

## Success criteria

- **SC-001**: A host that carries the steps out installs a pinned tool with no shell string.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
