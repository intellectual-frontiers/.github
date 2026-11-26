# Feature Specification: Machine probe signals

**Spec ID:** 0009-machine-probe-signals
**Status:** Draft
**Owner:** if
**Domain:** machine-probe

**Input:** The probe already says what a machine is (`facts`) and answers one osQuery SELECT. An asset of level 3 should send host metrics without a Collector, and the controller needs identity facts (machine id, hardware addresses, host key fingerprints) that the enrollment server collects on its own today. This specification adds the identity facts to the probe's observation, so that it is the one canonical observation, and a pure mapper from the observation and the rows of osQuery to declared telemetry signals, named by the pinned table of semantic conventions. It is governed by commons 0041-telemetry-and-reach (audit rows D3 to D6). **Every requirement that asks for code is Deferred until after the owner's acceptance run of the command line.**

## The identity facts

- **FR-001**: The probe MUST print, and `toObserved` MUST read, a section `@identity` of the machine id (the contents of `/etc/machine-id` or `/var/lib/dbus/machine-id`, the `MachineGuid` of the registry on Windows, `IOPlatformUUID` on macOS), the hardware addresses with their addresses by interface, and the fingerprints of the host keys of the SSH server where there is one; `Observed` MUST gain `identity` (`machineId?`, `nics`, `hostKeys`), `disks`, `sudo` and `init` as typed values with the same bounds as `decodeFacts` (`MAX_ITEMS`), and a fact the probe cannot tell MUST be absent or `unknown`, never guessed. Relies on audit rows: D3, D4.
- **FR-002**: `factsOf(observed)` MUST give the `Facts` of ssh-server and `identityKeysOf(observed)` the `IdentityKey` list of estate 0009-estate-sightings, both pure and total; a test MUST show that `factsOf` of an observation equals the `Facts` the enrollment script gives for the same machine (ssh-server 0007-ssh-server-dedupe-and-forward FR-004). Relies on audit rows: D3, D4, B4.
- **FR-003**: The rows of an osQuery answer MUST be read by the strict decoder of `desired-os-state` (`decodeRows`) and the tables and columns MUST be those of the allow-list of estate-query (estate-query 0006-estate-query-host-tables); `query` MUST NOT keep its own reader. Relies on audit rows: D6, B9.

## The mapper

- **FR-004**: `signalsOf(observed, rows)` MUST be a pure, total function from an `Observed` and the decoded rows of the tables of FR-003 to a list of `DeclaredSignal` values (the name, the kind `gauge`, `counter`, `updown` or `log`, the unit, the attributes, the value and the instant of the observation), and MUST read no clock, no environment and no file; the same input MUST give the same list. Relies on audit rows: D5, A3.
- **FR-005**: Every name and every unit of a signal and of a resource attribute MUST be an entry of the table `SEMCONV` (telemetry 0003-telemetry-reach FR-016, FR-017) and the mapper MUST declare them with `defineSignals`; a name that is not in the table MUST be a finding of the test, never a string typed at the place of use. Relies on audit rows: A10, A3.
- **FR-006**: From the facts alone (an asset of level 2) the mapper MUST give: the resource (`host.id`, `host.name`, `host.arch`, `os.type`, `os.version`, `if.asset.id` and `if.level`, as the exporter supplies the last two), `system.filesystem.utilization` from the disk in use, and `if.host.updates.pending` from the updates waiting. With the rows (level 3) it MUST give in addition `system.uptime` (`uptime`), `system.cpu.load_average.1m`, `.5m` and `.15m` (`load_average`), `system.memory.usage` and `system.memory.utilization` (`memory_info`), `system.cpu.time` (`cpu_time`), and `system.network.io` (`interface_details`), each from the table that names it. Relies on audit rows: D5, B9.
- **FR-007**: A table that the platform does not have or whose query failed MUST give no value and a log record `if.probe.gap` naming the table, and MUST NOT give a zero; a value that is not a number MUST be refused and counted. Relies on audit rows: D5, D6.
- **FR-008**: A counter MUST be given as the system gives it (cumulative) and the mapper MUST hold no state; the temporality and the deltas are the exporter's. Relies on audit rows: D5, A4.
- **FR-009**: The mapper MUST NOT start a process, read a file or reach a network; the only things it may ask of the machine are the three requests of the probe (`facts`, `version`, one `osquery` SELECT, 0002-machine-probe-contract FR-001). Relies on audit rows: D1.
- **FR-010**: The table of osQuery per platform MUST be data with `unsupported` stated for a platform and a table (Windows and macOS differ for CPU time and interfaces), and no signal MUST be claimed for a platform that is not proved by a capture (the rule of desired-os-state 0007-desired-os-state-observe-osquery FR-008). Relies on audit rows: D6, B9.
- **FR-011**: The table of units of machine-probe (`kanon` of its manifest) MUST give the logical unit the packages `@intellectual-frontiers/telemetry` (its `signals` and `semconv` entries) and `@intellectual-frontiers/estate` (its `governance` entry, for `IdentityKey`) and nothing else new, and the shared checker MUST find no import outside the table; no import of `machine-probe` by `estate` or by `telemetry` MUST be made. Relies on audit rows: D5, B4.
- **FR-012**: `platformOfFamily(family)` MUST give the platform of the pack for the family the probe names (`windows`, `macos`, a Debian, Red Hat, SUSE or Alpine family) and nothing for another, and `tablesFor(platform)` MUST give only the tables claimed for that platform by FR-010, so that a device asks osQuery for no table it is not proved for and a platform with none claimed (Windows, macOS) gives the level 2 signals of the facts and one `if.probe.gap` record of `unsupported` for each table.
- **FR-013**: Given the drift of the host against its desired OS state as counts (`DriftCounts`: the count in all and by kind, the summary of desired-os-state 0007 FR-009 without importing it), `signalsOf` MUST give the gauge `if.host.drift.requirements` in all and, for each kind with a count, with the attribute `if.drift.kind`, and MUST give none where no drift is passed. Relies on audit rows: B9.

## Acceptance scenarios

1. **Given** a probe's output with `@identity`, **When** it is read, **Then** the machine id, the addresses and the host key fingerprints are in `Observed`, per FR-001.
2. **Given** an output with no `@identity`, **When** it is read, **Then** the identity facts are absent and the read succeeds, per FR-001.
3. **Given** an `Observed` and the rows of `load_average`, **When** `signalsOf` runs twice, **Then** the two lists are equal and hold the three load averages, per FR-004 and FR-006.
4. **Given** no `memory_info` rows because the table failed, **When** `signalsOf` runs, **Then** there is no memory value and one `if.probe.gap` record, per FR-007.
5. **Given** a signal whose name is not in `SEMCONV`, **When** the test runs, **Then** it is found, per FR-005.

## Out of scope

- Running the probe, the queue, signing and sending: telemetry 0003-telemetry-reach.
- Traces; the mapper makes metrics and a log record.

## Edge cases

- A machine whose `/etc/machine-id` is empty (a cloned image): `machineId` absent, per FR-001; the clone is a conflict that estate settles (estate 0009-estate-sightings).
- A virtual machine with two interfaces of one address: both are kept, per FR-001.

## Assumptions

- The names of the tables and columns are those of osQuery 5.24.1, the version the pins carry (UNVERIFIED).

## Open questions

- None.

## Key entities

- **Observed** - the one canonical observation of a machine.
- **DeclaredSignal** - a typed value that a pipeline makes into an OTLP signal.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
