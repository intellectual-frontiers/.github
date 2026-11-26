# Feature Specification: Archon observation by osQuery

**Spec ID:** 0007-archon-observe-osquery
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a host is, as far as a requirement is concerned, is read by osQuery, whose tables are the same on Linux, macOS and Windows. Archon maps each kind of requirement to the tables that say its state as pure typed query packs, and gives one pure function that reads the rows osQuery returned and says what is observed of each requirement. Archon runs no query: the rows are typed data that another program obtained (an ssh job, an outbound ssh command or a local run). Where osQuery is absent, a small fallback gives the same observed state from the package manager's own query.

## Requirements

- **FR-001**: `queryPackFor(order, platform)` MUST return the pack of queries, each a name, the table and the SQL text, that the order's requirements need on a platform, and MUST be pure data: the same order and platform give the same pack, once for each table, in the order of the table names, and MUST include no query for a kind that needs none.
- **FR-002**: The pack MUST map the kinds as follows: packages to `deb_packages` (Debian family), `rpm_packages` (Red Hat and SUSE families), `apk_packages` (Alpine), `homebrew_packages` (macOS) and `programs` (Windows); users to `users`; groups to `groups`; services to `systemd_units` (Linux), `launchd` (macOS) and `services` (Windows); files to `file`; listening ports to `listening_ports`; the operating system to `os_version`; kernel settings to `system_controls`; and registry values to `registry` on Windows only.
- **FR-003**: Every query MUST be a read of one table with a literal list of the names the order asks for, quoted by one function that refuses a name with a character outside a closed set, so that a requirement cannot inject text into a query.
- **FR-004**: `decodeRows(text)` MUST decode the JSON that `osqueryi --json` gives (an array of objects whose values are strings) strictly: anything else, an array of non-objects or a value that is not a string, MUST be refused naming the path.
- **FR-005**: `observedFromRows(order, rows)` MUST return, for each requirement of the order, the observed state or nothing: it MUST read only the rows of the tables of the pack, MUST say a package observed at the version the rows say, a user, group, service or file by the fields the rows say, and MUST leave a requirement unobserved where no row names it, so that a requirement with `ensure` absent and no row is converged.
- **FR-006**: The drift of an order MUST be the plan of the order against `observedFromRows`, so that desired versus osQuery is one comparison and is the same plan and the same hash the reconcile loop makes.
- **FR-007**: A fallback observation (`observedFromFacts`) MUST take the same shape of facts a package manager's own query gives (a name and a version for each installed package) and MUST give the same observed state for packages as osQuery would, so that a platform without osQuery has the same drift for packages.
- **FR-008**: The decoder and the observation MUST be proved against a capture of the real output of `osqueryi` (its version, platform and image named in the capture) as well as against synthetic rows, and what no capture proves (Red Hat, Alpine, macOS and Windows tables, systemd units and the registry) MUST be said in this specification as unverified on a real host; the other fixtures MUST be synthetic.

## Acceptance scenarios

1. **Given** an order of one package for Debian, **When** the pack is made, **Then** it queries `deb_packages` only, per FR-001 and FR-002.
2. **Given** a requirement name with a quote, **When** the pack is made, **Then** it is refused, per FR-003.
3. **Given** rows of `deb_packages` with the package installed, **When** the observation is made, **Then** the requirement is observed present at that version, per FR-005.
4. **Given** rows that are not strings, **When** they are decoded, **Then** they are refused with the path, per FR-004.

## Out of scope

- Running osQuery.

## Edge cases

- No row for a package: unobserved, so a `create` in the plan, per FR-005.
- Two rows for a package of two architectures: the first in the order of the rows, per FR-005.

## Verification status

Proved against real output: osqueryi 5.12.1 on Linux x86_64 in a Debian 13 container (`deb_packages`, `users`, `groups`, `file`; `suite/fixtures/osquery-5.12.1-debian-trixie.json`), run on 2026-11-26. Unverified on a real host: `rpm_packages`, `apk_packages`, `homebrew_packages`, `programs`, `systemd_units` (the container has no D-Bus), `launchd`, `services`, `system_controls` and `registry`.

## Assumptions

- osQuery returns every value as a string.

## Open questions

- None.

## Key entities

- **Query pack** - the queries an order needs on a platform.
- **Rows** - what osQuery returned, as typed data.

## Success criteria

- **SC-001**: Drift is computed from rows alone, with no host.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
