# Feature Specification: Scanners: the catalog

**Spec ID:** 0002-scanners-catalog
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The scanners that can be run, the checks a target must pass before it is given to a tool, the command line of each, and the pin of each binary.

## Requirements

- **FR-001**: The scanners MUST be data: a built-in TLS and header check, nuclei, nmap, ZAP's baseline, trivy (a folder and an image), grype, semgrep and checkov, each with the technique an engagement must allow (`passive` for the ones that read files and send nothing to a target, `probe` for the built-in check, `scan` for the ones that send many requests), what it scans (an endpoint, a host, a path or an image) and where its output is read from; and what cannot be run (MobSF, a server asked over an API) MUST be named with the reason.
- **FR-002**: A target MUST be refused before any tool sees it unless it is fit: an endpoint is `http(s)://host[:port][/path]` with no query, no credentials and no spaces; a host is letters, digits, dots and hyphens; a path has no leading dash, no parent folder and only plain characters; an image reference is letters, digits and `. _ / : @ -`; and a target of another kind than the scanner scans MUST be refused.
- **FR-003**: The command line of a scanner MUST be made only from its own flags and a checked target, as a list of arguments and never a string for a shell; a relative path MUST be made explicit (`./`), the rate MUST be between 1 and 150 requests a second (10 where none is given), and a list of ports MUST be numbers and ranges.
- **FR-004**: The pin of a tool MUST say its version, an absolute path and the SHA-256 of the file as 64 hexadecimal digits, and a pin missing any of it MUST be refused with every reason.

## Acceptance scenarios

1. **Given** an address with a semicolon, **When** it is checked, **Then** it is refused, per FR-002.
2. **Given** nuclei and an address, **When** its command line is made, **Then** it is a list of arguments with a rate limit, per FR-003.

## Out of scope

- Running a tool (0004-scanners-run).

## Edge cases

- A target, a tool or an answer that is not as required is refused, never run or kept, per the requirements above (FR-001).

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Scanner**, **Pin**, **Run record**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
