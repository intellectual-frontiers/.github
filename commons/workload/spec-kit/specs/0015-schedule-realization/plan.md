# Plan: 0015-schedule-realization

**Spec:** 0015-schedule-realization. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| systemd.time and systemd.timer | `OnCalendar` with `UTC` and `Persistent` | Run by the tests where systemd-analyze is installed |
| crontab(5) | Five fields and `CRON_TZ` | Not run: no cron daemon |

## What is built and what is reused

Reused: the trigger of 0003-workload-forms, the emitters of 0010-workload-runners and the drift check. New: the resolution of a schedule (`src/logical/schedule.ts`), the schedule files of `bash` and `pwsh`, `on.schedule` in the workflow of GitHub, the refusal of what is not realized and the fixtures.
