// Spec: 0015-schedule-realization FR-001, FR-002, FR-003, FR-006, FR-007
/**
 * The schedule of a workload, in the one place every runner reads it: the slot of a trigger of kind `schedule` is resolved against its cadence (a field the cadence has, in its range, else the default slot), and written as the five
 * fields of a cron expression in UTC (GitHub `on.schedule`, a cron line) and as the `OnCalendar` of a systemd timer (always in UTC, spelled out). The same slot gives the same text everywhere, so the artifacts of the runners cannot
 * disagree about when a workload starts. Pure. A trigger of kind `event` or `alert` has no realization here: it is spec only.
 *
 * @example
 * ```ts
 * import { scheduleOf } from "./schedule.ts";
 * // scheduleOf({ kind: "schedule", cadence: "daily", at: { minute: 43, hour: 3 } }, "nightly") gives cron "43 3 * * *"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type CallPlan, type Cadence, type Finding, finding, type ScheduleSlot, type Trigger } from "@intellectual-frontiers/workload/governance";
import { inputVariable, type ScheduleFile, type ScheduleOptions } from "./emit.ts";

/** A schedule resolved: the cadence, the slot with every field the cadence has, and the text of it for a cron and for a systemd timer. */
export type Schedule = { readonly cadence: Cadence; readonly slot: ScheduleSlot; readonly cron: string; readonly calendar: string };

/** The default slot of a cadence: the 17th minute (not the top of the hour, where everyone's runs queue), 03:00 UTC, Monday, the first of the month, the first month. */
export const DEFAULT_SLOT = { minute: 17, hour: 3, weekday: 1, day: 1, month: 1 } as const;

const FIELDS: Readonly<Record<Cadence, readonly (keyof ScheduleSlot)[]>> = {
  hourly: ["minute"],
  daily: ["minute", "hour"],
  weekly: ["minute", "hour", "weekday"],
  monthly: ["minute", "hour", "day"],
  quarterly: ["minute", "hour", "day", "month"],
  yearly: ["minute", "hour", "day", "month"],
};

const SLOT_FIELDS = ["minute", "hour", "weekday", "day", "month"] as const satisfies readonly (keyof ScheduleSlot)[];

const RANGE = (cadence: Cadence): Readonly<Record<keyof ScheduleSlot, readonly [number, number]>> => ({ minute: [0, 59], hour: [0, 23], weekday: [0, 6], day: [1, 28], month: cadence === "quarterly" ? [1, 3] : [1, 12] });

const two = (n: number): string => String(n).padStart(2, "0");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** The schedule of a trigger of kind `schedule`, or the finding that says which field of the slot does not fit the cadence. `node` names the workload in the finding. */
export function scheduleOf(trigger: Extract<Trigger, { readonly kind: "schedule" }>, node = ""): Result<Schedule, Finding> {
  const { cadence } = trigger;
  const has = FIELDS[cadence];
  const given: Partial<ScheduleSlot> = trigger.at ?? {};
  const range = RANGE(cadence);
  for (const k of SLOT_FIELDS) {
    const v = given[k];
    if (v === undefined) continue;
    if (!has.includes(k)) return err(finding("E-WL-SCHEDULE-SLOT-INVALID", node, `a ${cadence} schedule has no ${k}`, { node: node === "" ? "the workload" : node }));
    const [lo, hi] = range[k];
    if (!Number.isInteger(v) || v < lo || v > hi) return err(finding("E-WL-SCHEDULE-SLOT-INVALID", node, `the ${k} ${String(v)} of a ${cadence} schedule is not an integer from ${lo} to ${hi}`, { node: node === "" ? "the workload" : node }));
  }
  const at = (k: keyof ScheduleSlot): number => given[k] ?? DEFAULT_SLOT[k];
  const slot: ScheduleSlot = { minute: at("minute"), ...(has.includes("hour") ? { hour: at("hour") } : {}), ...(has.includes("weekday") ? { weekday: at("weekday") } : {}), ...(has.includes("day") ? { day: at("day") } : {}), ...(has.includes("month") ? { month: at("month") } : {}) };
  const m = slot.minute;
  const h = slot.hour ?? 0;
  const d = slot.day ?? 1;
  const mo = slot.month ?? 1;
  const quarters = [mo, mo + 3, mo + 6, mo + 9];
  switch (cadence) {
    case "hourly":
      return ok({ cadence, slot, cron: `${m} * * * *`, calendar: `*-*-* *:${two(m)}:00 UTC` });
    case "daily":
      return ok({ cadence, slot, cron: `${m} ${h} * * *`, calendar: `*-*-* ${two(h)}:${two(m)}:00 UTC` });
    case "weekly":
      return ok({ cadence, slot, cron: `${m} ${h} * * ${slot.weekday ?? 1}`, calendar: `${DAYS[slot.weekday ?? 1] ?? "Mon"} *-*-* ${two(h)}:${two(m)}:00 UTC` });
    case "monthly":
      return ok({ cadence, slot, cron: `${m} ${h} ${d} * *`, calendar: `*-*-${two(d)} ${two(h)}:${two(m)}:00 UTC` });
    case "quarterly":
      return ok({ cadence, slot, cron: `${m} ${h} ${d} ${quarters.join(",")} *`, calendar: `*-${quarters.map(two).join(",")}-${two(d)} ${two(h)}:${two(m)}:00 UTC` });
    case "yearly":
      return ok({ cadence, slot, cron: `${m} ${h} ${d} ${mo} *`, calendar: `*-${two(mo)}-${two(d)} ${two(h)}:${two(m)}:00 UTC` });
    default:
      return cadence satisfies never;
  }
}

/** Where an artifact is installed on a host where the caller says none: a place of the system for programs of an administrator, not a folder of a person's home. */
export const DEFAULT_INSTALL_DIR = "/usr/local/libexec/workload";

const INSTALL_PATH = /^\/[A-Za-z0-9._@+/-]+$/u;

/** The absolute path an artifact has on the host, or the finding that says it is not a plain absolute path (no space, quote, percent sign or control character, so that no unit or cron line can read it as more than a path). */
export function installPath(plan: Pick<CallPlan, "workload">, extension: string, options: ScheduleOptions): Result<string, Finding> {
  const path = options.path ?? `${DEFAULT_INSTALL_DIR}/${plan.workload}.${extension}`;
  return INSTALL_PATH.test(path) && !path.includes("//") && !path.split("/").includes("..") ? ok(path) : err(finding("E-WL-RUNNER-VALUE-UNSAFE", plan.workload, `the install path of the artifact is not a plain absolute path: ${JSON.stringify(path.slice(0, 60))}`));
}

/** What an emitter that realizes a schedule with cron and systemd is given: the artifact it starts, the command words that start it, and the schedule. */
export type UnitParts = {
  readonly plan: Pick<CallPlan, "workload" | "version" | "inputs" | "credentials">;
  readonly hash: string;
  readonly runner: string;
  readonly schedule: Schedule;
  readonly path: string;
  /** The words of the command that starts the artifact: `["/usr/bin/env", "bash", path]`. Each is a plain word. */
  readonly command: readonly string[];
  readonly options: ScheduleOptions;
};

const header = (p: UnitParts, comment: string): readonly string[] => [
  `${comment} Generated by commons/workload from the plan of ${p.plan.workload} ${p.plan.version} (the schedule of the runner ${p.runner}); do not edit it: regenerate it.`,
  `${comment} plan: ${p.hash}`,
  `${comment} It only starts the artifact ${p.path}, which calls the pinned verb command by verb id; it holds no input and no secret.`,
  ...p.plan.credentials.map((c) => `${comment} credential: ${c} (a name only: the host gives it to the environment of the unit)`),
  ...p.plan.inputs.map((i) => `${comment} input: ${i} (read from ${inputVariable(i)}, which the host gives to the environment of the unit)`),
];

/** The files that start an artifact on a schedule on a Linux host: a cron line (in UTC where the cron reads `CRON_TZ`), and a systemd timer with the service it starts. Pure; the same parts give the same bytes. */
export function linuxScheduleFiles(p: UnitParts): readonly ScheduleFile[] {
  const run = p.command.join(" ");
  const dir = p.runner;
  const cron = [...header(p, "#"), `# schedule: ${p.schedule.cadence}, ${p.schedule.cron} in UTC`, "# CRON_TZ is read by cronie and by Debian's cron; where yours does not, use the systemd timer.", "CRON_TZ=UTC", `${p.schedule.cron} ${run}`, ""];
  const service = [
    ...header(p, "#"),
    "[Unit]",
    `Description=Workload ${p.plan.workload} ${p.plan.version}: one run of the artifact (plan ${p.hash.slice(0, 12)})`,
    "",
    "[Service]",
    "Type=oneshot",
    "NoNewPrivileges=yes",
    "PrivateTmp=yes",
    ...(p.options.environmentFile === undefined ? [] : [`EnvironmentFile=${p.options.environmentFile}`]),
    `ExecStart=${run}`,
    "",
  ];
  const timer = [
    ...header(p, "#"),
    "[Unit]",
    `Description=Schedule of the workload ${p.plan.workload}: ${p.schedule.cadence}`,
    "",
    "[Timer]",
    `OnCalendar=${p.schedule.calendar}`,
    "Persistent=true",
    `Unit=${p.plan.workload}.service`,
    "",
    "[Install]",
    "WantedBy=timers.target",
    "",
  ];
  return [
    { path: `${dir}/${p.plan.workload}.cron`, text: cron.join("\n") },
    { path: `${dir}/${p.plan.workload}.service`, text: service.join("\n") },
    { path: `${dir}/${p.plan.workload}.timer`, text: timer.join("\n") },
  ];
}

/** The refusal of a target other than Linux: Task Scheduler is not supported yet, and a Scheduled Job is not in PowerShell 7. */
export const unsupportedTarget = (workload: string, runner: string, target: string): Finding =>
  finding(
    "E-WL-RUNNER-EMIT-UNSUPPORTED",
    workload,
    `the runner ${runner} has no schedule for the target ${target}: only Linux has one (a cron line and a systemd timer); Windows Task Scheduler is not supported yet, and a Scheduled Job is not in PowerShell 7`,
    { node: "the schedule" },
  );

/** The schedule files of an emitter for a Linux host, or why there are none: a target that is not Linux, a slot that does not fit its cadence, a path that is not a plain absolute path. `command` makes the words that start the artifact from the path. */
export function linuxSchedule(runner: string, extension: string, command: (path: string) => readonly string[], plan: CallPlan, hash: string, trigger: Extract<Trigger, { readonly kind: "schedule" }>, options: ScheduleOptions): Result<readonly ScheduleFile[], readonly Finding[]> {
  const target = options.target ?? "linux";
  if (target !== "linux") return err([unsupportedTarget(plan.workload, runner, target)]);
  const resolved = scheduleOf(trigger, plan.workload);
  if (resolved.kind === "err") return err([resolved.error]);
  const path = installPath(plan, extension, options);
  if (path.kind === "err") return err([path.error]);
  if (options.environmentFile !== undefined && !INSTALL_PATH.test(options.environmentFile)) return err([finding("E-WL-RUNNER-VALUE-UNSAFE", plan.workload, `the environment file of the unit is not a plain absolute path: ${JSON.stringify(options.environmentFile.slice(0, 60))}`)]);
  return ok(linuxScheduleFiles({ plan, hash, runner, schedule: resolved.value, path: path.value, command: command(path.value), options }));
}
