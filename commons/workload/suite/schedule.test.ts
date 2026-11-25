/**
 * Tests of the realization of a schedule (commons workload 0015-schedule-realization FR-001 to FR-010): the slot of a trigger is resolved against its cadence into the same cron expression and `OnCalendar` for every runner, the
 * workflow of GitHub Actions carries `on.schedule`, `bash` and `pwsh` have a cron line and a pair of systemd units that only start the artifact, Windows is refused in plain words, a trigger of kind `event` or `alert` is not
 * realized, and the files are regenerated and compared. The calendar of the timers is read by the parser of systemd where it is installed. Every name is synthetic.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { authored, CADENCES, runnerId, type Trigger } from "@intellectual-frontiers/workload/governance";
import { DEFAULT_SLOT, scheduleOf } from "@intellectual-frontiers/workload/logical";
import { bootstrapFleet, SYNTHETIC_BOOTSTRAP_01 } from "@intellectual-frontiers/workload/forms/runbook";
import { graphFleet, SYNTHETIC_GRAPH_02 } from "@intellectual-frontiers/workload/forms/graph";
import { checkSchedule, emitSchedule, emitWorkload } from "@intellectual-frontiers/workload/physical";
import { have, skipped } from "./emit-kit.ts";
import { must } from "./kit.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const REPO = path.join(ROOT, "..", "..");
const INPUT = { fleet: (over: "tenants" | "hosts" | "fleets", source: string) => bootstrapFleet(over, source) ?? graphFleet(over, source) };
const R = (id: string) => authored(runnerId(id));
const sched = (cadence: (typeof CADENCES)[number], at?: Parameters<typeof scheduleOf>[0]["at"]) => scheduleOf({ kind: "schedule", cadence, ...(at === undefined ? {} : { at }) });
const WEEKLY = SYNTHETIC_GRAPH_02;
const daily = (over: Record<string, unknown> = {}) => ({ ...SYNTHETIC_BOOTSTRAP_01, trigger: { kind: "schedule", cadence: "daily" } as Trigger, inputs: [], ...over }) as typeof SYNTHETIC_BOOTSTRAP_01;

proves(["0015-schedule-realization FR-001"], "a schedule is a cadence and a slot in UTC with the fields the cadence has, each in its range", () => {
  assertEquals(CADENCES, ["hourly", "daily", "weekly", "monthly", "quarterly", "yearly"]);
  const slot = (c: (typeof CADENCES)[number], at?: Parameters<typeof scheduleOf>[0]["at"]) => must(sched(c, at)).slot;
  assertEquals(slot("hourly"), { minute: 17 });
  assertEquals(slot("daily"), { minute: 17, hour: 3 });
  assertEquals(slot("weekly"), { minute: 17, hour: 3, weekday: 1 });
  assertEquals(slot("monthly"), { minute: 17, hour: 3, day: 1 });
  assertEquals(slot("quarterly"), { minute: 17, hour: 3, day: 1, month: 1 });
  assertEquals(slot("yearly"), { minute: 17, hour: 3, day: 1, month: 1 });
  assertEquals(slot("weekly", { minute: 5, weekday: 0 }), { minute: 5, hour: 3, weekday: 0 });
  assertEquals(slot("yearly", { minute: 59, hour: 23, day: 28, month: 12 }), { minute: 59, hour: 23, day: 28, month: 12 });
  assertEquals(DEFAULT_SLOT, { minute: 17, hour: 3, weekday: 1, day: 1, month: 1 });
});

proves(["0015-schedule-realization FR-002"], "the same slot gives the same cron expression and the same calendar of a systemd timer, and the crons of the evidence workflow are two such slots", () => {
  const text = (c: (typeof CADENCES)[number], at?: Parameters<typeof scheduleOf>[0]["at"]) => {
    const s = must(sched(c, at));
    return [s.cron, s.calendar];
  };
  assertEquals(text("hourly"), ["17 * * * *", "*-*-* *:17:00 UTC"]);
  assertEquals(text("daily", { minute: 43, hour: 3 }), ["43 3 * * *", "*-*-* 03:43:00 UTC"]);
  assertEquals(text("weekly"), ["17 3 * * 1", "Mon *-*-* 03:17:00 UTC"]);
  assertEquals(text("weekly", { minute: 0, hour: 0, weekday: 0 }), ["0 0 * * 0", "Sun *-*-* 00:00:00 UTC"]);
  assertEquals(text("monthly"), ["17 3 1 * *", "*-*-01 03:17:00 UTC"]);
  assertEquals(text("quarterly"), ["17 3 1 1,4,7,10 *", "*-01,04,07,10-01 03:17:00 UTC"]);
  assertEquals(text("quarterly", { minute: 17, month: 2, day: 15 }), ["17 3 15 2,5,8,11 *", "*-02,05,08,11-15 03:17:00 UTC"]);
  assertEquals(text("yearly", { minute: 17, month: 12 }), ["17 3 1 12 *", "*-12-01 03:17:00 UTC"]);
  // the two crons of the workflow `evidence` of this repository: an hourly one and a daily one
  assertEquals(text("hourly", { minute: 17 })[0], "17 * * * *");
  assertEquals(text("daily", { minute: 43, hour: 3 })[0], "43 3 * * *");
  if (!have("systemd-analyze")) return skipped("the parser of calendars of systemd", "systemd-analyze");
  for (const c of CADENCES) {
    const r = spawnSync("systemd-analyze", ["calendar", must(sched(c)).calendar], { encoding: "utf8" });
    assertEquals(r.status, 0, `${c}: ${r.stderr}`);
    assert(r.stdout.includes("Next elapse") && /UTC/u.test(r.stdout), r.stdout);
  }
  const weekly = spawnSync("systemd-analyze", ["calendar", "--iterations=2", must(sched("weekly")).calendar], { encoding: "utf8" }).stdout;
  assert(weekly.includes("Mon ") && weekly.includes("03:17:00 UTC"), weekly);
});

proves(["0015-schedule-realization FR-003"], "a slot with a field the cadence does not have, or out of its range, is E-WL-SCHEDULE-SLOT-INVALID, and a slot is decoded with the trigger", async () => {
  const bad = (cadence: (typeof CADENCES)[number], at: Parameters<typeof scheduleOf>[0]["at"]) => {
    const r = sched(cadence, at);
    assert(r.kind === "err" && r.error.code === "E-WL-SCHEDULE-SLOT-INVALID" && r.error.fixer === "agent", JSON.stringify(r));
    return r.error.message;
  };
  assert(bad("daily", { minute: 0, weekday: 1 }).includes("has no weekday"));
  assert(bad("hourly", { minute: 60 }).includes("from 0 to 59"));
  assert(bad("daily", { minute: 0, hour: 24 }).includes("from 0 to 23"));
  assert(bad("weekly", { minute: 0, weekday: 7 }).includes("from 0 to 6"));
  assert(bad("monthly", { minute: 0, day: 29 }).includes("from 1 to 28"));
  assert(bad("quarterly", { minute: 0, month: 4 }).includes("from 1 to 3"));
  assert(bad("yearly", { minute: 0, month: 13 }).includes("from 1 to 12"));
  assert(bad("hourly", { minute: 1.5 }).includes("integer"));
  const { trigger } = await import("@intellectual-frontiers/workload/governance");
  assertEquals(trigger({ kind: "schedule", cadence: "daily", at: { minute: 43, hour: 3 } }).kind, "ok");
  assertEquals(trigger({ kind: "schedule", cadence: "daily", at: { hour: 3 } }).kind, "err");
  assertEquals(trigger({ kind: "schedule", cadence: "daily", at: { minute: "7" } }).kind, "err");
  const refused = await emitWorkload({ ...WEEKLY, trigger: { kind: "schedule", cadence: "daily", at: { minute: 0, weekday: 1 } } }, R("github-actions"), INPUT);
  assert(refused.kind === "err" && refused.error[0]?.code === "E-WL-SCHEDULE-SLOT-INVALID", "a workflow is never written without the schedule it was asked for");
  assertEquals(must(await emitWorkload({ ...WEEKLY, trigger: { kind: "schedule", cadence: "daily", at: { minute: 0, weekday: 1 } } }, R("bash"), INPUT)).runner, "bash", "the script is the same whatever its trigger");
  const asked = await emitSchedule({ ...WEEKLY, trigger: { kind: "schedule", cadence: "daily", at: { minute: 0, weekday: 1 } } }, R("bash"), INPUT);
  assert(asked.kind === "err" && asked.error[0]?.code === "E-WL-SCHEDULE-SLOT-INVALID");
});

proves(["0015-schedule-realization FR-004"], "GitHub carries the schedule inside the workflow, bash and pwsh have a cron line, a timer and a service, and a manual workload has none", async () => {
  const gh = must(await emitWorkload(WEEKLY, R("github-actions"), INPUT));
  assert(/\n {2}schedule:\n {4}- cron: "17 3 \* \* 1"\n/u.test(gh.text), gh.text.slice(0, 400));
  assert(gh.text.includes("workflow_dispatch:"));
  const hourly = must(await emitWorkload({ ...WEEKLY, trigger: { kind: "schedule", cadence: "hourly", at: { minute: 17 } } }, R("github-actions"), INPUT));
  assert(hourly.text.includes('- cron: "17 * * * *"'));
  const inside = must(await emitSchedule(WEEKLY, R("github-actions"), INPUT));
  assertEquals([inside.where, inside.files], ["workflow", []]);
  for (const r of ["bash", "pwsh"]) {
    const made = must(await emitSchedule(WEEKLY, R(r), INPUT));
    assertEquals(made.where, "files");
    assertEquals(made.files.map((f) => f.path), [`${r}/synthetic-graph-02.cron`, `${r}/synthetic-graph-02.service`, `${r}/synthetic-graph-02.timer`]);
    const by = Object.fromEntries(made.files.map((f) => [f.path.split(".").at(-1) ?? "", f.text]));
    assert((by["cron"] ?? "").includes("\nCRON_TZ=UTC\n17 3 * * 1 /usr/bin/env "));
    assert((by["timer"] ?? "").includes("\nOnCalendar=Mon *-*-* 03:17:00 UTC\nPersistent=true\nUnit=synthetic-graph-02.service\n"));
    assert((by["timer"] ?? "").includes("[Install]\nWantedBy=timers.target\n"));
    assert((by["service"] ?? "").includes("[Service]\nType=oneshot\nNoNewPrivileges=yes\nPrivateTmp=yes\nExecStart=/usr/bin/env "));
  }
  const manual = must(await emitSchedule(SYNTHETIC_BOOTSTRAP_01, R("bash"), INPUT));
  assertEquals([manual.where, manual.files], ["none", []]);
});

proves(["0015-schedule-realization FR-005"], "the cron line and the service only start the emitted artifact by its path, hold no input and no secret, carry the plan hash and may name a file of the environment", async () => {
  const bash = must(await emitWorkload(WEEKLY, R("bash"), INPUT));
  const made = must(await emitSchedule(WEEKLY, R("bash"), INPUT, { schedule: { path: "/opt/synthetic-01/graph-02.sh", environmentFile: "/etc/synthetic-01/graph-02.env" } }));
  for (const f of made.files) {
    assert(f.text.includes(`# plan: ${bash.hash}`) && f.text.includes("# input: order"), f.path);
    assert(f.text.includes("It only starts the artifact /opt/synthetic-01/graph-02.sh"), f.path);
    for (const bad of [/secret/iu.test(f.text) && !f.text.includes("holds no input and no secret"), /password|token=|ghp_/iu.test(f.text), /\$\(|`|\beval\b/u.test(f.text)]) assert(!bad, f.path);
  }
  const service = made.files.find((f) => f.path.endsWith(".service"))?.text ?? "";
  assert(service.includes("EnvironmentFile=/etc/synthetic-01/graph-02.env\n") && service.includes("ExecStart=/usr/bin/env bash /opt/synthetic-01/graph-02.sh\n"));
  assert(!(made.files.find((f) => f.path.endsWith(".cron"))?.text ?? "").includes("EnvironmentFile"));
  const withCredential = must(await emitSchedule({ ...WEEKLY, needs: [{ id: "synthetic-token-01", kind: "credential", concept: "workbench", task: "run", safety: false, summary: "x", name: "SYNTHETIC_TOKEN_01" }] }, R("pwsh"), INPUT));
  assert(withCredential.files.every((f) => f.text.includes("# credential: SYNTHETIC_TOKEN_01 (a name only")));
  const ps = withCredential.files.find((f) => f.path.endsWith(".service"))?.text ?? "";
  assert(ps.includes("ExecStart=/usr/bin/env pwsh -NoProfile -NonInteractive -File /usr/local/libexec/workload/synthetic-graph-02.ps1\n"));
  const again = must(await emitSchedule(WEEKLY, R("bash"), INPUT));
  assertEquals(again.files, must(await emitSchedule(WEEKLY, R("bash"), INPUT)).files, "the same bytes");
  if (!have("systemd-analyze")) return skipped("the parser of the timer", "systemd-analyze");
  const timer = made.files.find((f) => f.path.endsWith(".timer"))?.text ?? "";
  const calendar = /OnCalendar=(.*)/u.exec(timer)?.[1] ?? "";
  assertEquals(spawnSync("systemd-analyze", ["calendar", calendar], { encoding: "utf8" }).status, 0);
});

proves(["0015-schedule-realization FR-006"], "the schedule of bash and pwsh is for Linux alone: Windows is refused with E-WL-RUNNER-EMIT-UNSUPPORTED, saying that Task Scheduler is not supported and a Scheduled Job is not in PowerShell 7", async () => {
  for (const r of ["bash", "pwsh"]) {
    const made = await emitSchedule(WEEKLY, R(r), INPUT, { schedule: { target: "windows" } });
    assert(made.kind === "err" && made.error.length === 1 && made.error[0]?.code === "E-WL-RUNNER-EMIT-UNSUPPORTED", r);
    const message = made.error[0]?.message ?? "";
    assert(message.includes("Windows Task Scheduler is not supported yet") && message.includes("a Scheduled Job is not in PowerShell 7") && message.includes(`the runner ${r}`), message);
    assertEquals(made.error[0]?.fixer, "person");
  }
  assert((await emitSchedule(WEEKLY, R("pwsh"), INPUT, { schedule: { target: "linux" } })).kind === "ok");
});

proves(["0015-schedule-realization FR-007"], "the path of the artifact and the file of the environment are plain absolute paths, or are refused", async () => {
  for (const path of ["relative/x.sh", "/opt/with space/x.sh", "/opt/x;rm.sh", "/opt/../x.sh", "/opt/x%d.sh", "/opt//x.sh", "/opt/x'y.sh", "/opt/x\n.sh"]) {
    const made = await emitSchedule(WEEKLY, R("bash"), INPUT, { schedule: { path } });
    assert(made.kind === "err" && made.error[0]?.code === "E-WL-RUNNER-VALUE-UNSAFE", path);
  }
  const env = await emitSchedule(WEEKLY, R("bash"), INPUT, { schedule: { environmentFile: "/etc/x y.env" } });
  assert(env.kind === "err" && env.error[0]?.code === "E-WL-RUNNER-VALUE-UNSAFE");
  assert((await emitSchedule(WEEKLY, R("bash"), INPUT, { schedule: { path: "/usr/local/bin/synthetic-01.sh" } })).kind === "ok");
});

proves(["0015-schedule-realization FR-008"], "a scheduled workload that requires an input is refused for GitHub, and for bash and pwsh unless a file of the environment gives it", async () => {
  const needs = daily({ inputs: [{ name: "order", type: "text", required: true }] });
  const gh = await emitWorkload(needs, R("github-actions"), INPUT);
  assert(gh.kind === "err" && gh.error[0]?.code === "E-WL-RUNNER-SCHEDULE-NEEDS-INPUT" && gh.error[0].message.includes("order"));
  const bash = await emitSchedule(needs, R("bash"), INPUT);
  assert(bash.kind === "err" && bash.error[0]?.code === "E-WL-RUNNER-SCHEDULE-NEEDS-INPUT");
  const env = await emitSchedule(needs, R("bash"), INPUT, { schedule: { environmentFile: "/etc/synthetic-01/order.env" } });
  assert(env.kind === "ok" && env.value.files.length === 3);
  assert((await emitWorkload(daily({ inputs: [{ name: "order", type: "text", required: false }] }), R("github-actions"), INPUT)).kind === "ok");
  assert((await emitWorkload({ ...needs, trigger: { kind: "manual" } }, R("github-actions"), INPUT)).kind === "ok", "a run by hand is given the input");
});

proves(["0015-schedule-realization FR-009"], "a trigger of kind event or alert is not realized and says so, and the artifact of the workload is the same whatever its trigger", async () => {
  for (const trigger of [{ kind: "event", name: "synthetic-event-01" }, { kind: "alert", name: "synthetic-alert-01" }] as const) {
    const w = { ...SYNTHETIC_BOOTSTRAP_01, trigger };
    for (const r of ["bash", "pwsh", "github-actions"]) {
      const made = await emitSchedule(w, R(r), INPUT);
      assert(made.kind === "err" && made.error[0]?.code === "E-WL-RUNNER-EMIT-UNSUPPORTED" && made.error[0].message.includes("spec only") === false && made.error[0].message.includes("no runner realizes"), `${trigger.kind} ${r}`);
      assert(made.error[0]?.message.includes("a statement of the spec"));
    }
    for (const r of ["bash", "pwsh"]) assertEquals(must(await emitWorkload(w, R(r), INPUT)).text, must(await emitWorkload(SYNTHETIC_BOOTSTRAP_01, R(r), INPUT)).text, "the trigger changes nothing of the script");
    const gh = must(await emitWorkload(w, R("github-actions"), INPUT)).text;
    assert(!gh.includes("schedule:") && gh.includes("workflow_dispatch:"), "a workflow of an event is started by hand");
  }
});

proves(["0015-schedule-realization FR-010"], "the schedule files are regenerated and compared, the files of the fixtures are current, and the evidence workflow keeps its own crons byte for byte", async () => {
  const made = must(await emitSchedule(WEEKLY, R("bash"), INPUT));
  const files = Object.fromEntries(made.files.map((f) => [f.path, f.text]));
  assertEquals(await checkSchedule(files, WEEKLY, R("bash"), INPUT), []);
  const edited = await checkSchedule({ ...files, "bash/synthetic-graph-02.timer": (files["bash/synthetic-graph-02.timer"] ?? "").replace("03:17", "03:18") }, WEEKLY, R("bash"), INPUT);
  assertEquals(edited.map((f) => f.code), ["E-WL-RUNNER-DRIFT"]);
  assert(edited[0]?.message.includes("edited by hand"));
  const missing = await checkSchedule({ "bash/synthetic-graph-02.cron": files["bash/synthetic-graph-02.cron"] ?? "" }, WEEKLY, R("bash"), INPUT);
  assertEquals(missing.length, 2);
  const extra = await checkSchedule({ ...files, "bash/other.timer": "x" }, WEEKLY, R("bash"), INPUT);
  assert(extra.some((f) => f.message.includes("none of its files")));
  const other = await checkSchedule(files, { ...WEEKLY, trigger: { kind: "schedule", cadence: "daily" } }, R("bash"), INPUT);
  assert(other.length >= 1 && other.every((f) => f.code === "E-WL-RUNNER-DRIFT"));
  const { outputs } = await import("../tools/runners.ts");
  const fixtures = await outputs();
  const scheduled = Object.keys(fixtures).filter((f) => f.includes("/schedule/"));
  assertEquals(scheduled.length, 6);
  for (const f of scheduled) assertEquals(await fs.readTextFile(path.join(REPO, f)), fixtures[f], `${f} is regenerated by bun commons/workload/tools/runners.ts`);
  const golden = await fs.readTextFile(path.join(REPO, "tests", "fixtures", "workflows-golden", "evidence.auto.yml"));
  assert(golden.includes('    - cron: "17 * * * *"\n    - cron: "43 3 * * *"\n'));
  assertEquals(golden, (await fs.readTextFile(path.join(REPO, ".github", "workflows", "evidence.auto.yml"))).replace(/\r\n/gu, "\n"));
});
