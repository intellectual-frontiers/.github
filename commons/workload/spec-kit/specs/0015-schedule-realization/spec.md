# Feature Specification: Schedule realization

**Spec ID:** 0015-schedule-realization
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A workload trigger of kind `schedule` (0003-workload-forms FR-005) is realized as an artifact of the runner that carries the workload: `on.schedule` inside the workflow of GitHub Actions, and for `bash` and `pwsh` a cron line and a pair of systemd units, a timer and the service it starts. Every realization is thin: it only starts the same emitted artifact by its path, holds no input and no secret and is regenerated and compared like every other artifact. The triggers `event` and `alert` stay unrealized: they are statements of the spec, and no runner starts a workload on one yet.

## Requirements

- **FR-001**: A schedule MUST be a cadence (`hourly`, `daily`, `weekly`, `monthly`, `quarterly` or `yearly`) and an optional slot in UTC with the fields the cadence has: the minute (0 to 59) for every cadence, the hour (0 to 23) from `daily`, the weekday (0 to 6, 0 being Sunday) for `weekly`, the day of the month (1 to 28) from `monthly`, and the month from `quarterly` (1 to 3, the month of the quarter) and `yearly` (1 to 12).
- **FR-002**: A slot not given MUST be the default slot: minute 17 (not the top of the hour, where every scheduled run queues), hour 3, Monday, the first of the month and the first month; the same slot MUST give the same cron expression of five fields (`17 * * * *` hourly, `43 3 * * *` daily, `17 3 * * 1` weekly, `17 3 1 * *` monthly, `17 3 1 1,4,7,10 *` quarterly, `17 3 1 1 *` yearly) and the same `OnCalendar` of a systemd timer, spelled out in UTC, for every runner.
- **FR-003**: A slot with a field the cadence does not have, or a field outside its range, MUST be refused with `E-WL-SCHEDULE-SLOT-INVALID`, and a slot MUST be decoded at the boundary with the trigger.
- **FR-004**: The runner `github-actions` MUST write a trigger of kind `schedule` as `on.schedule` with the cron expression, in the workflow itself next to `workflow_dispatch` (an hourly cron is as valid as any other), and the runners `bash` and `pwsh` MUST write it as a cron line (with `CRON_TZ=UTC`) and a systemd timer with `OnCalendar` in UTC and `Persistent=true`, with the service it starts, as three files; a manual trigger MUST give none.
- **FR-005**: A cron line and a service MUST only start the same emitted artifact by its absolute path (`/usr/bin/env bash <path>` or `/usr/bin/env pwsh -NoProfile -NonInteractive -File <path>`), MUST hold no input and no value of a credential (only comments that name them), MAY name a file of the environment that the host gives, and MUST carry the plan hash and the runner so that they are the artifact's; the service MUST be `Type=oneshot` with `NoNewPrivileges=yes` and `PrivateTmp=yes`.
- **FR-006**: The schedule of `bash` and `pwsh` MUST be for Linux alone: a target that is not Linux MUST be refused with `E-WL-RUNNER-EMIT-UNSUPPORTED`, which says plainly that Windows Task Scheduler is not supported yet and that a Scheduled Job is not in PowerShell 7, and no file for Windows MUST be written.
- **FR-007**: The path of the artifact on the host (`/usr/local/libexec/workload/<id>.<ext>` where none is given) and the file of the environment MUST be plain absolute paths (letters, digits and `._@+/-`, no `..`), or MUST be refused with `E-WL-RUNNER-VALUE-UNSAFE`, so that no unit or line can read one as more than a path.
- **FR-008**: A workload that a schedule starts and that requires an input MUST be refused with `E-WL-RUNNER-SCHEDULE-NEEDS-INPUT` for GitHub Actions, and for `bash` and `pwsh` unless a file of the environment is named, because a scheduled run is given no input.
- **FR-009**: A trigger of kind `event` or `alert` MUST NOT be realized: asking for the scheduling artifact of one MUST be refused with `E-WL-RUNNER-EMIT-UNSUPPORTED` saying that it is spec only, and the artifact of the workload itself MUST be unaffected by the trigger it has.
- **FR-010**: The schedule files MUST be regenerated and compared like the artifacts (a file edited by hand, of another plan or trigger, missing or extra is `E-WL-RUNNER-DRIFT`), the files of the fixtures MUST be generated into `commons/workload/artifacts/schedule/` by `bun commons/workload/tools/runners.ts`, and the workflow `evidence` of the repository's CI, which has its own crons, MUST stay byte for byte what it is (commons 0030-generated-workflows FR-014).

## Acceptance scenarios

1. **Given** each cadence with and without a slot, **When** it is resolved, **Then** the slot has the fields of the cadence and the defaults, per FR-001 and FR-002.
2. **Given** the crons `17 * * * *` and `43 3 * * *`, **When** the same slots are resolved, **Then** the texts are those, and the calendar is the same moment, per FR-002.
3. **Given** a weekday on a daily schedule, a minute 60 and a month 4 of a quarter, **When** they are resolved, **Then** each is `E-WL-SCHEDULE-SLOT-INVALID`, per FR-003.
4. **Given** the scheduled graph, **When** it is emitted for each runner, **Then** GitHub has `on.schedule` in the workflow and `bash` and `pwsh` have a cron line, a timer and a service, and a manual workload has none, per FR-004.
5. **Given** the three files, **When** they are read, **Then** they only start the artifact by its path, name the credentials and inputs in comments and hold no value, and the timer parses with the system's own calendar parser where it is installed, per FR-005.
6. **Given** a target of Windows, **When** the schedule of `pwsh` is made, **Then** it is refused, saying that Task Scheduler is not supported and a Scheduled Job is not in PowerShell 7, per FR-006.
7. **Given** a path with a space and `..`, **When** a schedule is made, **Then** it is refused, per FR-007.
8. **Given** a scheduled workload with a required input, **When** it is emitted for GitHub, **Then** it is refused, and for `bash` it is refused unless a file of the environment is named, per FR-008.
9. **Given** a workload with an event trigger, **When** its schedule is asked for, **Then** it is refused as spec only, and its artifact is the same as with a manual trigger, per FR-009.
10. **Given** the files of a schedule, **When** one is edited, **Then** the check finds the drift, and the evidence workflow is its golden copy, per FR-010.

## Out of scope

- Windows Task Scheduler, and a Scheduled Job (PowerShell 7 has none): a later runner or a later change adds a target.
- A trigger of kind `event` or `alert`: no runner starts a workload on one; they stay spec only.
- Installing the files on the host: the host's owner does, and the library only writes them.
- The time zone of a person: a schedule is in UTC.

## Edge cases

- A cron that reads no `CRON_TZ` runs in the host's time zone: the line says so in a comment and the timer is the form that is in UTC by its own words, per FR-004.
- A day of the month above 28 is refused, so that every month has it, per FR-001.
- A quarterly schedule runs in the months `m`, `m+3`, `m+6` and `m+9` of the slot's month of the quarter, per FR-002.

## Assumptions

- A host with systemd has a version that reads `OnCalendar` with a time zone suffix of `UTC` and `Persistent=true`, and cron lines are read by a cron that reads `CRON_TZ` (cronie, Debian's cron).

## Open questions

- None.

## Key entities

- **Schedule** - a cadence and a slot in UTC, and its text for a cron and for a systemd timer.
- **Slot** - the minute and the fields of the cadence that has them.
- **Unit pair** - a systemd timer and the service it starts.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| systemd.time and systemd.timer (as run: systemd-analyze of the machine, where it is installed) | `OnCalendar` with a time zone suffix, `Persistent` | The test runs `systemd-analyze calendar` where it is installed; the manual pages were not fetched, so no section is cited |
| crontab(5) as cron implementations read it | Five fields, and `CRON_TZ` | Not run here (no cron daemon is run by the tests); the claim about `CRON_TZ` is the one not verified |
| GitHub Actions `on.schedule` (the JSON Schema of SchemaStore) | A cron expression of five fields, in UTC | The schema validates the files; the documentation was not fetched |

## Success criteria

- **SC-001**: Every requirement of 0015-schedule-realization is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
