/**
 * The operating system's own scheduled job, planned without touching it (commons 0005-typescript-runtime FR-046): from a job's name, the
 * argument vector it runs, its working folder, its environment and when it runs, `planJob` gives the files to write and the commands that
 * load and unload the job, for one of three schedulers, and writes or runs nothing itself (`runtime/schedule.ts` does).
 *
 * | OS      | what is planned                                                              | loaded by                                        |
 * | ------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
 * | Linux   | a systemd user service (one shot) and its timer in `~/.config/systemd/user/` | `systemctl --user enable --now <label>.timer`    |
 * | macOS   | a LaunchAgent, `~/Library/LaunchAgents/<label>.plist`                        | `launchctl bootstrap gui/<uid> <plist>`          |
 * | Windows | a `.cmd` file in `~\AppData\Local\<folder>\` and a Task Scheduler task       | `schtasks /Create /F /TN <folder>\<name> /TR ...` |
 *
 * The caller names its jobs with an owner: a reverse-DNS `domain` (`org.example.backup`), which makes the launchd label and the systemd
 * unit `<domain>.<name>`, and a Task Scheduler `folder` (`Example`), which makes the task `<folder>\<name>` and the folder of its `.cmd`
 * file. Paths in `files` are relative to the user's home folder, with `/` between their parts, so the caller writes them on any host; the
 * absolute paths the commands need (the plist for `launchctl`, the `.cmd` file for `schtasks`) are built from the given home folder with
 * the target's own separator.
 *
 * When a job runs is one of five kinds, each expressed on every scheduler at the same minutes of local time:
 *
 * | kind      | systemd `OnCalendar=`  | launchd `StartCalendarInterval`          | `schtasks`                           |
 * | --------- | ---------------------- | ---------------------------------------- | ------------------------------------ |
 * | `minutes` | `*-*-* *:00/N:00`      | one `Minute` dict for each of 0, N, 2N.. | `/SC MINUTE /MO N /ST 00:00`         |
 * | `hourly`  | `*-*-* *:MM:00`        | `Minute`                                 | `/SC HOURLY /ST 00:MM`               |
 * | `daily`   | `*-*-* HH:MM:00`       | `Hour`, `Minute`                         | `/SC DAILY /ST HH:MM`                |
 * | `weekly`  | `Fri *-*-* HH:MM:00`   | `Weekday` (0 is Sunday), `Hour`, `Minute` | `/SC WEEKLY /D FRI /ST HH:MM`        |
 * | `monthly` | `*-*-DD HH:MM:00`      | `Day`, `Hour`, `Minute`                  | `/SC MONTHLY /D DD /ST HH:MM`        |
 *
 * `minutes` takes a divisor of 60 below 60 (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30), so that all three run at the same minutes of every
 * hour; `monthly` takes a day from 1 to 28, which every month has.
 *
 * Every argument is quoted for the file that carries it, and what cannot be carried safely is refused with a `ScheduleError`, never
 * altered. systemd's `ExecStart=` and `Environment=` get double quotes with C escapes (`\\`, `\"`, `\t`, `\xHH`), `%%` for `%` and, in
 * `ExecStart=`, `$$` for `$`; a carriage return, a line feed or NUL is refused, and so is an argument that is only `;` and a program that
 * begins with one of systemd's prefixes (`@-:+!|`). The `.cmd` file gets double quotes around any argument that is not plain, `%%` for `%`
 * (a batch file's own escape, inside quotes or not), the trailing backslashes of a quoted argument doubled (the C runtime's rule), delayed
 * expansion turned off (so `!` is plain) and the UTF-8 code page; a double quote (cmd.exe's quoting cannot hold one safely) and any
 * control character but tab are refused. The plist is written with the kernel's XML writer, which escapes the markup; a character XML
 * cannot carry (a control character but tab and line feed, a carriage return, which XML reads as a line feed, or a lone surrogate) is
 * refused.
 *
 * Taken from Stolos's `src/archon/export/schedule.ts` (spec 092), which built the jobs of `stolos export schedule` from an export job and
 * a fleet. What changed: the job is generic (an argument vector, a working folder, an environment, an optional log) and named by the
 * caller's owner instead of Stolos's; the schedule is a discriminated union, with every N minutes added; the files are relative to the
 * home folder; the plist is built as an XML tree; quoting follows each format's rules in full and refuses what it cannot hold, where Stolos
 * quoted a few characters; and errors are values.
 *
 * @example
 * ```ts
 * import { jobName, planJob, schedule } from "./schedule.ts";
 * const name = jobName("backup");
 * const when = schedule({ kind: "daily", hour: 6, minute: 10 });
 * if (name.kind === "ok" && when.kind === "ok") {
 *   const plan = planJob(
 *     { name: name.value, owner: { domain: "org.example", folder: "Example" }, argv: ["/usr/bin/backup", "--all"], workdir: "/srv", when: when.value },
 *     { os: "linux", home: "/home/ada" },
 *   );
 *   // plan.value.files: .config/systemd/user/org.example.backup.service and .timer, with OnCalendar=*-*-* 06:10:00
 *   // plan.value.install: systemctl --user daemon-reload, then systemctl --user enable --now org.example.backup.timer
 * }
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";
import { el, writeXml, type XmlElement, type XmlNode } from "@intellectual-frontiers/formats/xml";

/** The schedulers a job can be planned for: systemd on Linux, launchd on macOS, Task Scheduler on Windows. */
export type SchedulerOs = "linux" | "darwin" | "windows";

/** Why a job cannot be planned: the field at fault (`name`, `argv[2]`, `env.PATH`, `when.minute`...), and whether its value is not valid or cannot be carried safely. */
export type ScheduleError = {
  readonly kind: "schedule";
  readonly field: string;
  readonly reason: "invalid" | "unsafe";
  readonly message: string;
};

/** A schedule error as one line: `argv[1]: a line feed cannot be carried in a systemd unit`. */
export function formatScheduleError(e: ScheduleError): string {
  return `${e.field}: ${e.message}`;
}

const invalid = (field: string, message: string): ScheduleError => ({ kind: "schedule", field, reason: "invalid", message });
const unsafe = (field: string, message: string): ScheduleError => ({ kind: "schedule", field, reason: "unsafe", message });

/** A job's name, safe in a file name, a unit name, a plist label and a task name: 1 to 64 lowercase letters, digits and dashes, beginning and ending with a letter or digit. */
export type JobName = Brand<string, "JobName">;

const NAME = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** A job's name, validated. */
export function jobName(s: string): Result<JobName, ScheduleError> {
  return NAME.test(s)
    ? ok(s as JobName)
    : err(
        invalid(
          "name",
          `${JSON.stringify(s)} is not 1 to 64 lowercase letters, digits and dashes, beginning and ending with a letter or digit`,
        ),
      );
}

/** The day of a weekly schedule. */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** When a job runs, in local time: every N minutes on the clock, every hour at a minute, every day, every week on a day, or every month on a day. */
export type When =
  | { readonly kind: "minutes"; readonly every: number }
  | { readonly kind: "hourly"; readonly minute: number }
  | { readonly kind: "daily"; readonly hour: number; readonly minute: number }
  | { readonly kind: "weekly"; readonly day: Weekday; readonly hour: number; readonly minute: number }
  | { readonly kind: "monthly"; readonly day: number; readonly hour: number; readonly minute: number };

/** A `When` whose numbers are in range, made only by `schedule`. */
export type Schedule = Brand<When, "Schedule">;

/** The intervals `minutes` takes: the divisors of 60 below 60, so every scheduler runs the job at the same minutes of every hour. */
export const MINUTE_STEPS: readonly number[] = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30];

const inRange = (n: number, lo: number, hi: number): boolean => Number.isInteger(n) && n >= lo && n <= hi;

/** A schedule, validated: hours 0 to 23, minutes 0 to 59, a day of the month 1 to 28, a weekday by its three letters, a step of `MINUTE_STEPS`. */
export function schedule(when: When): Result<Schedule, ScheduleError> {
  const hm = (w: { readonly hour: number; readonly minute: number }): ScheduleError | undefined =>
    !inRange(w.hour, 0, 23)
      ? invalid("when.hour", `${w.hour} is not an hour from 0 to 23`)
      : !inRange(w.minute, 0, 59)
        ? invalid("when.minute", `${w.minute} is not a minute from 0 to 59`)
        : undefined;
  let e: ScheduleError | undefined;
  switch (when.kind) {
    case "minutes":
      e = MINUTE_STEPS.includes(when.every)
        ? undefined
        : invalid("when.every", `${when.every} is not one of ${MINUTE_STEPS.join(", ")} (a divisor of 60 below 60)`);
      break;
    case "hourly":
      e = inRange(when.minute, 0, 59) ? undefined : invalid("when.minute", `${when.minute} is not a minute from 0 to 59`);
      break;
    case "daily":
      e = hm(when);
      break;
    case "weekly":
      e = WEEKDAYS.includes(when.day) ? hm(when) : invalid("when.day", `${JSON.stringify(when.day)} is not a weekday (mon to sun)`);
      break;
    case "monthly":
      e = inRange(when.day, 1, 28) ? hm(when) : invalid("when.day", `${when.day} is not a day of the month from 1 to 28`);
      break;
    default:
      return absurd(when);
  }
  return e === undefined ? ok(when as Schedule) : err(e);
}

const two = (n: number): string => String(n).padStart(2, "0");
const DAY_NAMES: Readonly<Record<Weekday, string>> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** When a schedule runs, as a sentence's end: `every 15 minutes`, `every hour at minute 05`, `every day at 06:10`, `every Friday at 08:00`, `on day 3 of every month at 05:00`. */
export function describeSchedule(s: Schedule): string {
  switch (s.kind) {
    case "minutes":
      return s.every === 1 ? "every minute" : `every ${s.every} minutes`;
    case "hourly":
      return `every hour at minute ${two(s.minute)}`;
    case "daily":
      return `every day at ${two(s.hour)}:${two(s.minute)}`;
    case "weekly":
      return `every ${DAY_NAMES[s.day]} at ${two(s.hour)}:${two(s.minute)}`;
    case "monthly":
      return `on day ${s.day} of every month at ${two(s.hour)}:${two(s.minute)}`;
    default:
      return absurd(s);
  }
}

/** systemd's `OnCalendar=` expression for a schedule (systemd.time(7)). */
export function onCalendar(s: Schedule): string {
  switch (s.kind) {
    case "minutes":
      return `*-*-* *:00/${s.every}:00`;
    case "hourly":
      return `*-*-* *:${two(s.minute)}:00`;
    case "daily":
      return `*-*-* ${two(s.hour)}:${two(s.minute)}:00`;
    case "weekly":
      return `${DAY_NAMES[s.day].slice(0, 3)} *-*-* ${two(s.hour)}:${two(s.minute)}:00`;
    case "monthly":
      return `*-*-${two(s.day)} ${two(s.hour)}:${two(s.minute)}:00`;
    default:
      return absurd(s);
  }
}

/** One launchd calendar interval: the job runs whenever every key given matches (`Weekday` 0 is Sunday). */
export type CalendarInterval = { readonly Minute: number; readonly Hour?: number; readonly Day?: number; readonly Weekday?: number };

const LAUNCHD_DAY: Readonly<Record<Weekday, number>> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** launchd's `StartCalendarInterval` for a schedule: one interval, or one for each minute of the hour the job runs at. */
export function calendarIntervals(s: Schedule): readonly CalendarInterval[] {
  switch (s.kind) {
    case "minutes":
      return Array.from({ length: 60 / s.every }, (_, i) => ({ Minute: i * s.every }));
    case "hourly":
      return [{ Minute: s.minute }];
    case "daily":
      return [{ Minute: s.minute, Hour: s.hour }];
    case "weekly":
      return [{ Minute: s.minute, Hour: s.hour, Weekday: LAUNCHD_DAY[s.day] }];
    case "monthly":
      return [{ Minute: s.minute, Hour: s.hour, Day: s.day }];
    default:
      return absurd(s);
  }
}

/** The arguments `schtasks /Create` takes for a schedule, from `/SC` on. */
export function schtasksSchedule(s: Schedule): readonly string[] {
  switch (s.kind) {
    case "minutes":
      return ["/SC", "MINUTE", "/MO", String(s.every), "/ST", "00:00"];
    case "hourly":
      return ["/SC", "HOURLY", "/ST", `00:${two(s.minute)}`];
    case "daily":
      return ["/SC", "DAILY", "/ST", `${two(s.hour)}:${two(s.minute)}`];
    case "weekly":
      return ["/SC", "WEEKLY", "/D", s.day.toUpperCase(), "/ST", `${two(s.hour)}:${two(s.minute)}`];
    case "monthly":
      return ["/SC", "MONTHLY", "/D", String(s.day), "/ST", `${two(s.hour)}:${two(s.minute)}`];
    default:
      return absurd(s);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- quoting

/** The first character in `s` that `bad` refuses, as `U+000A`, or undefined. */
function refused(s: string, bad: (code: number) => boolean): string | undefined {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (bad(c)) return `U+${c.toString(16).toUpperCase().padStart(4, "0")}`;
  }
  return undefined;
}

const isLineOrNul = (c: number): boolean => c === 0 || c === 10 || c === 13;
const isControlButTab = (c: number): boolean => (c < 32 && c !== 9) || c === 127;

const SYSTEMD_PLAIN = /^[A-Za-z0-9_@+=:,./-]+$/;
const SYSTEMD_PREFIXES = "@-:+!|";

/** A value in systemd's double quotes, with C escapes, `%%` for `%` and, where `dollar`, `$$` for `$`. */
function systemdQuoted(s: string, dollar: boolean): string {
  let out = '"';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "%") out += "%%";
    else if (ch === "$" && dollar) out += "$$";
    else if (c === 9) out += "\\t";
    else if (c < 32 || c === 127) out += `\\x${c.toString(16).padStart(2, "0")}`;
    else out += ch;
  }
  return `${out}"`;
}

/**
 * One argument as a word of systemd's `ExecStart=` (systemd.service(5), "Command lines"): as it is where it is plain, else in double
 * quotes with C escapes, `%%` for a specifier's `%` and `$$` for a variable's `$`. Refused: NUL, a carriage return or a line feed; an
 * argument that is only `;` (a command separator); and, for the program (`first`), an empty one or one that begins with a prefix
 * character (`@-:+!|`).
 */
export function quoteSystemdArg(arg: string, first = false): Result<string, ScheduleError> {
  const bad = refused(arg, isLineOrNul);
  if (bad !== undefined) return err(unsafe("argument", `${bad} cannot be carried in a systemd unit`));
  if (arg === ";") return err(unsafe("argument", "an argument that is only ; separates commands in ExecStart="));
  if (first && (arg === "" || SYSTEMD_PREFIXES.includes(arg.charAt(0))))
    return err(unsafe("argument", `a program must not be empty or begin with one of ${SYSTEMD_PREFIXES}`));
  return ok(SYSTEMD_PLAIN.test(arg) ? arg : systemdQuoted(arg, true));
}

/** An argument vector as systemd's `ExecStart=` value, each word quoted by `quoteSystemdArg`; the first refusal names its index. */
export function quoteSystemdArgs(argv: readonly string[]): Result<string, ScheduleError> {
  return quoteAll(argv, quoteSystemdArg);
}

const CMD_PLAIN = /^[A-Za-z0-9_+./\\-][A-Za-z0-9_+.:/\\-]*$/;

/**
 * One argument as a word of a line of a `.cmd` file that runs a program: as it is where it is plain, else in double quotes, inside which
 * cmd.exe takes `&|<>^()` as text; `%%` for `%` (a batch file's escape, which holds inside quotes too); and the trailing backslashes of a
 * quoted argument doubled, so the C runtime's parser does not read the closing quote as an escaped one (not for the program, `first`,
 * whose name the parser takes as written). Refused: a double quote, which cmd.exe's quoting cannot hold safely, and any control character
 * but tab; and, for the program, an empty one. Expects delayed expansion off (the `.cmd` file turns it off), so `!` is plain text.
 */
export function quoteCmdArg(arg: string, first = false): Result<string, ScheduleError> {
  const bad = refused(arg, isControlButTab);
  if (bad !== undefined) return err(unsafe("argument", `${bad} cannot be carried in a .cmd file`));
  if (arg.includes('"')) return err(unsafe("argument", "a double quote cannot be carried safely in a .cmd file"));
  if (first && arg === "") return err(unsafe("argument", "a program must not be empty"));
  if (CMD_PLAIN.test(arg)) return ok(arg);
  const body = first ? arg : arg.replace(/\\+$/, (b) => b + b);
  return ok(`"${body.replaceAll("%", "%%")}"`);
}

/** An argument vector as a command of a `.cmd` file, each word quoted by `quoteCmdArg`; the first refusal names its index. */
export function quoteCmdArgs(argv: readonly string[]): Result<string, ScheduleError> {
  return quoteAll(argv, quoteCmdArg);
}

function quoteAll(
  argv: readonly string[],
  quote: (arg: string, first: boolean) => Result<string, ScheduleError>,
): Result<string, ScheduleError> {
  if (argv.length === 0) return err(invalid("argv", "nothing to run: the argument vector is empty"));
  const words: string[] = [];
  for (const [i, a] of argv.entries()) {
    const q = quote(a, i === 0);
    if (q.kind === "err") return err({ ...q.error, field: `argv[${i}]` });
    words.push(q.value);
  }
  return ok(words.join(" "));
}

/** A value for a line of a systemd unit that takes it as written but for specifiers (`WorkingDirectory=`, `StandardOutput=append:`). */
function systemdPath(field: string, s: string): Result<string, ScheduleError> {
  const bad = refused(s, (c) => c < 32 || c === 127);
  if (bad !== undefined) return err(unsafe(field, `${bad} cannot be carried in a systemd unit`));
  if (s.trim() !== s) return err(unsafe(field, "systemd trims the white space at the ends of a value"));
  return ok(s.replaceAll("%", "%%"));
}

/** A value of the `.cmd` file in double quotes (a folder or a log path). */
function cmdPath(field: string, s: string): Result<string, ScheduleError> {
  const bad = refused(s, isControlButTab);
  if (bad !== undefined) return err(unsafe(field, `${bad} cannot be carried in a .cmd file`));
  if (s.includes('"')) return err(unsafe(field, "a double quote cannot be carried safely in a .cmd file"));
  return ok(`"${s.replaceAll("%", "%%")}"`);
}

/** Text XML 1.0 carries unchanged: no control character but tab and line feed (a carriage return is read back as a line feed), no lone surrogate, no U+FFFE or U+FFFF. */
function xmlText(field: string, s: string): Result<string, ScheduleError> {
  const bad = refused(s, (c) => (c < 32 && c !== 9 && c !== 10) || c === 0xfffe || c === 0xffff);
  if (bad !== undefined) return err(unsafe(field, `${bad} cannot be carried in a property list`));
  if (!s.isWellFormed()) return err(unsafe(field, "a lone surrogate cannot be carried in a property list"));
  return ok(s);
}

// ---------------------------------------------------------------------------------------------------------------------------- the plan

/** Who a job belongs to: a reverse-DNS `domain` for the launchd label and the systemd unit, and a Task Scheduler `folder`. */
export type JobOwner = {
  /** Lowercase labels of letters, digits and dashes, two or more, joined by dots (`org.example.backup`). */
  readonly domain: string;
  /** Letters, digits, dots, dashes and underscores, beginning and ending with a letter or digit (`Example`). */
  readonly folder: string;
};

/** A job to schedule. */
export type JobSpec = {
  /** Its name, unique under its owner. */
  readonly name: JobName;
  /** Its owner, which makes its label and where its files go. */
  readonly owner: JobOwner;
  /** The program and its arguments, run without a shell (by the scheduler, or by the `.cmd` file on Windows). */
  readonly argv: readonly string[];
  /** The absolute folder it runs in. */
  readonly workdir: string;
  /** Variables added to its environment. */
  readonly env?: Readonly<Record<string, string>>;
  /** When it runs. */
  readonly when: Schedule;
  /** An absolute file its output and errors are appended to (systemd's journal, and nothing on macOS and Windows, without it). */
  readonly log?: string;
};

/** The computer a job is planned for: its scheduler, the user's home folder in its own form, and on macOS the user's numeric id (launchctl's `gui/<uid>` domain). */
export type Target = { readonly os: SchedulerOs; readonly home: string; readonly uid?: number };

/** A file to write: its path relative to the home folder, parts joined by `/`; its text; and its mode where it matters (POSIX permission bits). */
export type PlannedFile = { readonly path: string; readonly content: string; readonly mode?: number };

/** A command to run, by its argument vector and never through a shell; `mayFail` where a failure is expected and stops nothing (nothing to unload). */
export type Step = { readonly argv: readonly string[]; readonly mayFail: boolean };

/** What scheduling a job takes: the files to write, then `install`; to remove it, `remove`, then the files removed, then `afterRemove`. */
export type JobPlan = {
  /** The scheduler. */
  readonly os: SchedulerOs;
  /** The job's label: the systemd timer, the launchd label, or the task's name. */
  readonly label: string;
  /** When it runs, in words. */
  readonly description: string;
  /** The files to write before `install`, and to remove after `remove`. */
  readonly files: readonly PlannedFile[];
  /** The commands that load and enable the job. */
  readonly install: readonly Step[];
  /** The commands that disable and unload it, before its files are removed. */
  readonly remove: readonly Step[];
  /** The commands to run once its files are removed (systemd forgets the units). */
  readonly afterRemove: readonly Step[];
};

const DOMAIN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const FOLDER = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?$/;
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const UNIT_MODE = 0o644;

/** An absolute path on the target, from the home folder and a path relative to it. */
function onTarget(t: Target, rel: string): string {
  const sep = t.os === "windows" ? "\\" : "/";
  return `${t.home.replace(/[\\/]+$/, "")}${sep}${rel.split("/").join(sep)}`;
}

/** Every check in turn: the first error, or the values. */
function each<T>(items: readonly T[], f: (item: T) => Result<string, ScheduleError>): Result<readonly string[], ScheduleError> {
  const out: string[] = [];
  for (const item of items) {
    const r = f(item);
    if (r.kind === "err") return r;
    out.push(r.value);
  }
  return ok(out);
}

/** The parts every scheduler checks alike: the owner, the program and the environment's names. */
function checkCommon(job: JobSpec, t: Target): ScheduleError | undefined {
  if (!DOMAIN.test(job.owner.domain))
    return invalid("owner.domain", `${JSON.stringify(job.owner.domain)} is not a reverse-DNS name (lowercase labels joined by dots)`);
  if (!FOLDER.test(job.owner.folder))
    return invalid("owner.folder", `${JSON.stringify(job.owner.folder)} is not 1 to 64 letters, digits, dots, dashes and underscores`);
  if (job.argv.length === 0) return invalid("argv", "nothing to run: the argument vector is empty");
  for (const k of Object.keys(job.env ?? {}))
    if (!ENV_NAME.test(k)) return invalid(`env.${k}`, `${JSON.stringify(k)} is not a variable name (letters, digits and _)`);
  const homeBad = refused(t.home, (c) => c < 32 || c === 127);
  if (t.home === "" || homeBad !== undefined) return invalid("home", "the home folder must be a path with no control character");
  return undefined;
}

/** Linux: a systemd user service (one shot) and its timer. */
function planLinux(job: JobSpec): Result<JobPlan, ScheduleError> {
  const label = `${job.owner.domain}.${job.name}`;
  const description = describeSchedule(job.when);
  if (!job.workdir.startsWith("/")) return err(invalid("workdir", "the working folder must be an absolute path"));
  const exec = quoteSystemdArgs(job.argv);
  if (exec.kind === "err") return exec;
  const dir = systemdPath("workdir", job.workdir);
  if (dir.kind === "err") return dir;
  const env = each(Object.entries(job.env ?? {}), ([k, v]) => {
    const bad = refused(v, isLineOrNul);
    return bad === undefined
      ? ok(`Environment=${systemdQuoted(`${k}=${v}`, false)}`)
      : err(unsafe(`env.${k}`, `${bad} cannot be carried in a systemd unit`));
  });
  if (env.kind === "err") return env;
  let log: readonly string[] = [];
  if (job.log !== undefined) {
    if (!job.log.startsWith("/")) return err(invalid("log", "the log must be an absolute path"));
    const l = systemdPath("log", job.log);
    if (l.kind === "err") return l;
    log = [`StandardOutput=append:${l.value}`, `StandardError=append:${l.value}`];
  }
  const service = [
    `# The scheduled job ${label}, written by a program: it is replaced when the job is scheduled again.`,
    "[Unit]",
    `Description=${label}`,
    "",
    "[Service]",
    "Type=oneshot",
    `WorkingDirectory=${dir.value}`,
    ...env.value,
    `ExecStart=${exec.value}`,
    ...log,
    "",
  ].join("\n");
  const timer = [
    `# The timer of the scheduled job ${label}, written by a program: it is replaced when the job is scheduled again.`,
    "[Unit]",
    `Description=${label}, ${description}`,
    "",
    "[Timer]",
    `OnCalendar=${onCalendar(job.when)}`,
    "Persistent=true",
    "",
    "[Install]",
    "WantedBy=timers.target",
    "",
  ].join("\n");
  const units = ".config/systemd/user";
  const reload: Step = { argv: ["systemctl", "--user", "daemon-reload"], mayFail: false };
  return ok({
    os: "linux",
    label: `${label}.timer`,
    description,
    files: [
      { path: `${units}/${label}.service`, content: service, mode: UNIT_MODE },
      { path: `${units}/${label}.timer`, content: timer, mode: UNIT_MODE },
    ],
    install: [reload, { argv: ["systemctl", "--user", "enable", "--now", `${label}.timer`], mayFail: false }],
    remove: [{ argv: ["systemctl", "--user", "disable", "--now", `${label}.timer`], mayFail: true }],
    afterRemove: [{ ...reload, mayFail: true }],
  });
}

/** An element's children indented by two spaces for each level, where it holds only elements. */
function indented(e: XmlElement, depth = 0): XmlElement {
  const elements = e.children.filter((c): c is XmlElement => c.kind === "element");
  if (elements.length === 0 || elements.length !== e.children.length) return e;
  const pad = (d: number): XmlNode => ({ kind: "text", text: `\n${"  ".repeat(d)}` });
  return { ...e, children: [...elements.flatMap((c) => [pad(depth + 1), indented(c, depth + 1)]), pad(depth)] };
}

const PLIST_DOCTYPE = '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">';

/** A plist dictionary of keys and values, in order. */
const dict = (entries: readonly (readonly [string, XmlElement])[]): XmlElement =>
  el(
    "dict",
    entries.flatMap(([k, v]) => [el("key", [k]), v]),
  );
const intervalDict = (c: CalendarInterval): XmlElement =>
  dict(
    (["Minute", "Hour", "Day", "Weekday"] as const).flatMap((k) => {
      const v = c[k];
      return v === undefined ? [] : [[k, el("integer", [v])] as const];
    }),
  );

/** macOS: a LaunchAgent property list, loaded into the user's GUI domain. */
function planDarwin(job: JobSpec, t: Target): Result<JobPlan, ScheduleError> {
  const label = `${job.owner.domain}.${job.name}`;
  if (t.uid === undefined || !Number.isInteger(t.uid) || t.uid < 0)
    return err(invalid("uid", "a macOS job needs the user's numeric id (launchctl's gui/<uid> domain)"));
  if (!job.workdir.startsWith("/")) return err(invalid("workdir", "the working folder must be an absolute path"));
  const args = each([...job.argv.entries()], ([i, a]) => xmlText(`argv[${i}]`, a));
  if (args.kind === "err") return args;
  if (job.argv[0] === "") return err(unsafe("argv[0]", "a program must not be empty"));
  const dir = xmlText("workdir", job.workdir);
  if (dir.kind === "err") return dir;
  const envEntries = Object.entries(job.env ?? {});
  const env = each(envEntries, ([k, v]) => xmlText(`env.${k}`, v));
  if (env.kind === "err") return env;
  if (job.log !== undefined) {
    if (!job.log.startsWith("/")) return err(invalid("log", "the log must be an absolute path"));
    const l = xmlText("log", job.log);
    if (l.kind === "err") return l;
  }
  const intervals = calendarIntervals(job.when).map(intervalDict);
  const str = (s: string): XmlElement => el("string", [s]);
  const entries: (readonly [string, XmlElement])[] = [
    ["Label", str(label)],
    ["ProgramArguments", el("array", job.argv.map(str))],
    ["WorkingDirectory", str(job.workdir)],
    ...(envEntries.length === 0 ? [] : [["EnvironmentVariables", dict(envEntries.map(([k, v]) => [k, str(v)] as const))] as const]),
    ["StartCalendarInterval", intervals.length === 1 && intervals[0] !== undefined ? intervals[0] : el("array", intervals)],
    ...(job.log === undefined
      ? []
      : ([
          ["StandardOutPath", str(job.log)],
          ["StandardErrorPath", str(job.log)],
        ] as const)),
    ["ProcessType", str("Background")],
  ];
  const root = indented(el("plist", [dict(entries)], [["version", "1.0"]]));
  const content = `${writeXml(root).replace("\n", `\n${PLIST_DOCTYPE}\n`)}\n`;
  const rel = `Library/LaunchAgents/${label}.plist`;
  const domain = `gui/${t.uid}`;
  const bootout: Step = { argv: ["launchctl", "bootout", `${domain}/${label}`], mayFail: true };
  return ok({
    os: "darwin",
    label,
    description: describeSchedule(job.when),
    files: [{ path: rel, content, mode: UNIT_MODE }],
    install: [bootout, { argv: ["launchctl", "bootstrap", domain, onTarget(t, rel)], mayFail: false }],
    remove: [bootout],
    afterRemove: [],
  });
}

const WINDOWS_ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\\\\)/;

/** Windows: a `.cmd` file (working folder, environment, log) and a Task Scheduler task that runs it as the signed-in user. */
function planWindows(job: JobSpec, t: Target): Result<JobPlan, ScheduleError> {
  const task = `${job.owner.folder}\\${job.name}`;
  if (t.home.includes('"') || t.home.includes("%"))
    return err(unsafe("home", "a double quote or a % in the home folder cannot be carried in a task's command"));
  if (!WINDOWS_ABSOLUTE.test(job.workdir))
    return err(invalid("workdir", "the working folder must be an absolute path (C:\\... or \\\\server\\...)"));
  const exec = quoteCmdArgs(job.argv);
  if (exec.kind === "err") return exec;
  const dir = cmdPath("workdir", job.workdir);
  if (dir.kind === "err") return dir;
  const env = each(Object.entries(job.env ?? {}), ([k, v]) => {
    const q = cmdPath(`env.${k}`, `${k}=${v}`);
    return q.kind === "err" ? q : ok(`set ${q.value}`);
  });
  if (env.kind === "err") return env;
  let redirect = "";
  if (job.log !== undefined) {
    if (!WINDOWS_ABSOLUTE.test(job.log)) return err(invalid("log", "the log must be an absolute path"));
    const l = cmdPath("log", job.log);
    if (l.kind === "err") return l;
    redirect = ` >> ${l.value} 2>&1`;
  }
  const content = [
    "@echo off",
    `rem The scheduled job ${task}, written by a program: it is replaced when the job is scheduled again.`,
    "setlocal DisableDelayedExpansion",
    "chcp 65001 >nul",
    `cd /d ${dir.value} || exit /b 1`,
    ...env.value,
    `${exec.value}${redirect}`,
    "exit /b %ERRORLEVEL%",
    "",
  ].join("\r\n");
  const rel = `AppData/Local/${job.owner.folder}/${job.name}.cmd`;
  return ok({
    os: "windows",
    label: task,
    description: describeSchedule(job.when),
    files: [{ path: rel, content }],
    install: [
      { argv: ["schtasks", "/Create", "/F", "/TN", task, "/TR", `"${onTarget(t, rel)}"`, ...schtasksSchedule(job.when)], mayFail: false },
    ],
    remove: [{ argv: ["schtasks", "/Delete", "/F", "/TN", task], mayFail: true }],
    afterRemove: [],
  });
}

/**
 * What scheduling a job on a computer takes: the files (relative to the home folder) and the commands, built and checked, written and run
 * by nothing here. A value that is not valid, or that a file cannot carry safely, is an error naming the field.
 */
export function planJob(job: JobSpec, target: Target): Result<JobPlan, ScheduleError> {
  const common = checkCommon(job, target);
  if (common !== undefined) return err(common);
  switch (target.os) {
    case "linux":
      return planLinux(job);
    case "darwin":
      return planDarwin(job, target);
    case "windows":
      return planWindows(job, target);
    default:
      return absurd(target.os);
  }
}
