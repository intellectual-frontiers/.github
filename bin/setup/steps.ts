// Steps: each one a span of the setup's telemetry, which the console shows as one live line at a terminal (with how far a counting step has come) and one
// plain line when it starts elsewhere; the output kept in the log and shown only when the step fails (FR-061, FR-062); the jobs that do not touch each other
// at the same time, under one span (FR-030); and the one way a run ends when something went wrong (FR-067).
import { absurd } from "../../commons/ts/kernel/absurd.ts";
import { err, ok, type Result } from "../../commons/ts/kernel/result.ts";
import { plain } from "../../commons/ts/kernel/text.ts";
import * as fs from "../../commons/ts/runtime/fs.ts";
import { type Ctx, problem } from "./context.ts";
import { type Phase, type Stop, stop } from "./stop.ts";
import { type Ran, run, type RunOptions } from "./proc.ts";
import { netWords } from "./net.ts";
import { clip, redact, shortPath } from "./ui.ts";

/** What a step does: run a program, or a piece of this setup that says what it did through `out`. */
export type Work =
  | { readonly kind: "command"; readonly argv: readonly string[]; readonly options: RunOptions }
  | { readonly kind: "task"; readonly run: (out: (text: string) => void) => Promise<number> };

export const command = (argv: readonly string[], options: RunOptions = {}): Work => ({ kind: "command", argv, options });
export const task = (f: (out: (text: string) => void) => Promise<number>): Work => ({ kind: "task", run: f });

/** A step that counts its own work: the lines its output prints as each piece advances, how many to expect, how many lines each piece prints (FR-064). */
export type Counting = { readonly re: RegExp; readonly total: number | null; readonly div: number };

async function perform(work: Work, onOutput: (t: string) => void): Promise<Ran> {
  switch (work.kind) {
    case "command":
      return await run(work.argv, {
        ...work.options,
        onOutput: (t) => {
          onOutput(t);
          work.options.onOutput?.(t);
        },
      });
    case "task": {
      const chunks: string[] = [];
      const out = (t: string) => {
        chunks.push(t);
        onOutput(t);
      };
      let code: number;
      try {
        code = await work.run(out);
      } catch (e) {
        out(`${e instanceof Error ? e.message : String(e)}\n`);
        code = 1;
      }
      return { code, output: chunks.join("") };
    }
    default:
      return absurd(work);
  }
}

/** A step's span ends as its program did: ok, or an error that names the exit status; what it did is the same either way. */
type Carried = Result<Ran, { readonly ran: Ran; readonly message: string }>;
const carry = (ran: Ran): Carried => ran.code === 0 ? ok(ran) : err({ ran, message: `exit status ${ran.code}` });
const ranOf = (c: Carried): Ran => c.kind === "ok" ? c.value : c.error.ran;

/** The step's output in the log, under a header that names it; returns the line where it starts. */
function keep(ctx: Ctx, stepNo: number, label: string, ran: Ran): number {
  const from = ctx.ui.log.lines + 1;
  ctx.ui.log.raw(`\n==== STEP ${stepNo}: ${label} (exit ${ran.code})\n${ran.output}${ran.output.endsWith("\n") || ran.output === "" ? "" : "\n"}`);
  return from;
}

/** One step as a span: its work, its progress where it counts it (a tenth of a second apart at most often enough to be seen), its outcome. */
async function spanned(ctx: Ctx, label: string, stepNo: number, work: Work, counting: Counting | undefined, parallel: boolean): Promise<Ran> {
  return ranOf(
    await ctx.signals.telemetry.span(
      "bootstrap.step",
      { step: label, phase: plain(ctx.ui.currentPhase), step_no: stepNo, ...(parallel ? { parallel: true } : {}) },
      async (span) => {
        let lines = 0, shown = -1, at = 0;
        const ran = await perform(work, (t) => {
          if (counting === undefined) return;
          for (const l of t.split("\n")) if (counting.re.test(l)) lines++;
          const n = counting.total === null ? Math.floor(lines / counting.div) : Math.min(counting.total, Math.floor(lines / counting.div));
          if (n === shown || (Date.now() - at < 100 && n !== counting.total)) return;
          shown = n;
          at = Date.now();
          if (counting.total === null) span.progress(n);
          else span.progress(n, counting.total);
        });
        span.set({ outcome: ran.code === 0 ? "ok" : "failed", exit_code: ran.code });
        return carry(ran);
      },
    ),
  );
}

/** Run a step quietly; its output is shown only where it fails. Returns what it did; a dry run only says it. */
export async function stepRan(ctx: Ctx, label: string, work: Work, counting?: Counting): Promise<{ readonly ran: Ran; readonly logLine: number }> {
  if (ctx.opts.dryRun) {
    ctx.ui.plan(label);
    return { ran: { code: 0, output: "" }, logLine: 0 };
  }
  const stepNo = ++ctx.st.stepNo;
  ctx.ui.starting(label);
  const ran = await spanned(ctx, label, stepNo, work, counting, false);
  const logLine = keep(ctx, stepNo, label, ran);
  if (ran.code !== 0) {
    ctx.ui.markBad();
    ctx.st.lastOutput = ran.output;
  }
  return { ran, logLine };
}

/** A step whose failure stops the run (exit status 4), unless BOOTSTRAP_KEEP_GOING=1. */
export async function step(ctx: Ctx, label: string, work: Work, counting?: Counting): Promise<Phase> {
  const { ran, logLine } = await stepRan(ctx, label, work, counting);
  if (ran.code === 0) return ok(undefined);
  if (ctx.opts.switches.keepGoing) {
    showFailure(ctx, ran.output);
    return ok(undefined);
  }
  return stop(await stopHere(ctx, label, ran.output, logLine));
}

/** A step whose failure the caller explains and handles itself: its exit status. */
export async function stepSoft(ctx: Ctx, label: string, work: Work, counting?: Counting): Promise<number> {
  const { ran } = await stepRan(ctx, label, work, counting);
  if (ran.code !== 0) showFailure(ctx, ran.output);
  return ran.code;
}

/** Under the failed step's line: the last lines it printed. */
function showFailure(ctx: Ctx, output: string): void {
  for (const l of output.split("\n").filter((x) => x !== "").slice(-8)) ctx.ui.sayErr(`  ${l}`);
}

export type Job = { readonly label: string; readonly work: Work };

/**
 * Jobs that do not touch each other, at most BOOTSTRAP_JOBS at once, under one span whose jobs are its children (FR-030, FR-031). Each runs to its end; then
 * each is logged in order, and the first that failed stops the run (or, with BOOTSTRAP_KEEP_GOING=1, is warned of).
 */
export async function pool(ctx: Ctx, title: string, jobs: readonly Job[]): Promise<Phase> {
  if (ctx.opts.dryRun) {
    for (const j of jobs) ctx.ui.plan(j.label);
    return ok(undefined);
  }
  if (jobs.length === 0) return ok(undefined);
  const results: ({ readonly ran: Ran; readonly stepNo: number } | null)[] = jobs.map(() => null);
  ctx.ui.starting(title);
  await ctx.signals.telemetry.span("bootstrap.pool", { title, jobs: jobs.length }, async () => {
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const i = next++;
        const job = jobs[i];
        if (job === undefined) return;
        const stepNo = ++ctx.st.stepNo;
        results[i] = { ran: await spanned(ctx, job.label, stepNo, job.work, undefined, true), stepNo };
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(ctx.opts.jobs, jobs.length)) }, worker));
    return results.every((r) => r !== null && r.ran.code === 0) ? ok(undefined) : err("a job failed");
  });
  let failed: { label: string; output: string; line: number } | null = null;
  jobs.forEach((job, i) => {
    const r = results[i] ?? { ran: { code: 1, output: "the job did not finish\n" }, stepNo: ctx.st.stepNo };
    const line = keep(ctx, r.stepNo, job.label, r.ran);
    if (r.ran.code !== 0 && failed === null) failed = { label: job.label, output: r.ran.output, line };
  });
  if (failed === null) return ok(undefined);
  const f: { label: string; output: string; line: number } = failed;
  ctx.ui.markBad();
  ctx.st.lastOutput = f.output;
  if (ctx.opts.switches.keepGoing) {
    ctx.ui.warn(`${f.label} did not install`);
    problem(ctx, `${f.label} did not install`);
    return ok(undefined);
  }
  return stop(await stopHere(ctx, f.label, f.output, f.line));
}

/** What the network cost this run, so that a network that needed retries is known to have (FR-033). */
export function retrySummary(ctx: Ctx): void {
  const n = ctx.retries.notes.length;
  if (n === 0) return;
  ctx.ui.say("");
  ctx.ui.say(`${ctx.ui.e.retry}The network needed ${n} retries in this run, most for: ${ctx.retries.top()}.`);
  ctx.ui.say("   If that happens often here, add --patient (15 tries, longer waits) or set ERGA_RETRIES=20; fewer: ERGA_RETRIES=3.");
}

/**
 * The one way the run ends when a step failed (FR-067): say what failed in plain words, where to look (a path relative to the home folder) and how to ask for help;
 * a support file with what the team needs, and no secrets, is written beside the log. Where the log is goes to the telemetry as a log record.
 */
export async function stopHere(ctx: Ctx, label: string, output: string, logLine: number): Promise<Stop> {
  const ui = ctx.ui;
  const home = ctx.opts.paths.home;
  ui.phaseDrop();
  const tail = output.split("\n").filter((l) => l !== "");
  ctx.signals.telemetry.log("bootstrap.failed", {
    step: label,
    step_no: ctx.st.stepNo,
    log_line: logLine,
    log_file: ui.log.path === null ? "" : shortPath(home, ui.log.path),
    support_file: ui.log.supportPath === null ? "" : shortPath(home, ui.log.supportPath),
    error_tail: redact(plain(tail.slice(-3).join(" "))).replaceAll(home, "~"),
  });
  ui.say("");
  ui.say(`${ui.e.stop}Setup stopped: something went wrong`);
  ui.say("Nothing is half-installed in a way that matters; it is safe to run the setup again once this is fixed.");
  ui.say("");
  ui.say(`${ui.e.what}What failed:  ${label}`);
  ui.say(`${ui.e.why}What it said:`);
  for (const l of tail.slice(-6)) ui.say(`     ${clip(ui.look.columns - 6, l)}`);
  ui.say("");
  if (netWords(output)) {
    ui.say(`${ui.e.retry}This looks like the network (a name that would not resolve, a connection that broke), not your computer.`);
    ui.say("   Nothing needs undoing: run the setup again and it carries on where it stopped. What was fetched is kept, and a download that stopped half way resumes.");
    ui.say("   On a network that keeps dropping, add --patient (15 tries, longer waits) or set ERGA_RETRIES=20.");
    retrySummary(ctx);
    ui.say("");
  }
  if (ui.log.path !== null && ui.log.supportPath !== null) {
    await writeSupportFile(ctx, label, output, logLine);
    ui.say(`${ui.e.log}Where to look:   ${shortPath(home, ui.log.path)}  (the problem starts at line ${logLine})`);
    ui.say(`${ui.e.pack}Support file:    ${shortPath(home, ui.log.supportPath)}  (everything the team needs, with no passwords)`);
  } else {
    ui.say("The log could not be written (is your disk full?). Free some space and run the setup again.");
  }
  ui.say("");
  ui.say(`${ui.e.help}Not sure what to do? That is fine. Here is how to get help:`);
  ui.say("   1. Copy the support file path above.");
  ui.say(`   2. Send that one file to ${ctx.opts.support}, and say what you were doing`);
  ui.say(`      (for example: "I ran the Debian setup on Windows and it stopped at ${label}").`);
  ui.say(`   3. You can see the file any time with:  cat ${ui.log.supportPath === null ? "" : shortPath(home, ui.log.supportPath)}`);
  ui.say("");
  return { kind: "step-failed", label };
}

async function writeSupportFile(ctx: Ctx, label: string, output: string, logLine: number): Promise<void> {
  const path = ctx.ui.log.supportPath;
  if (path === null) return;
  const p = ctx.st.platform;
  const id = (await run(["id", "-un"])).output.trim();
  const uid = (await run(["id", "-u"])).output.trim();
  const df = (await run(["df", "-h", ctx.opts.paths.home])).output.split("\n")[1]?.trim().split(/\s+/) ?? [];
  let net = "not looked at (BOOTSTRAP_NO_NETCHECK=1)";
  if (ctx.opts.switches.netcheck) {
    try {
      const res = await fetch("https://github.com", { method: "HEAD", signal: AbortSignal.timeout(6000) });
      await res.body?.cancel();
      net = `github.com answers (${res.status})`;
    } catch {
      net = "github.com does not answer";
    }
  }
  let logTail = "";
  try {
    logTail = ctx.ui.log.path === null ? "" : (await fs.readTextFile(ctx.ui.log.path)).split("\n").slice(-120).join("\n");
  } catch { /* no log */ }
  const pol = ctx.retries.policy;
  const text = [
    "Intellectual Frontiers bootstrap: support file",
    `When:        ${new Date().toString()}`,
    `Failed step: ${label} (step ${ctx.st.stepNo}, log line ${logLine})`,
    `Computer:    ${p?.pretty ?? "unknown"}, ${p?.arch ?? "unknown"}${p?.wsl === true ? ", under WSL" : ""}`,
    `User:        ${id} (id ${uid})   Shell: ${ctx.env.SHELL ?? "unknown"}`,
    `Disk free:   ${df.length >= 4 ? `${df[3]} of ${df[1]}` : "unknown"}`,
    `Network:     ${net}`,
    `Retries:     ${ctx.retries.notes.length} (tries ${pol.tries}, wait ${pol.base}s doubling to ${pol.cap}s)`,
    `Log file:    ${ctx.ui.log.path === null ? "" : shortPath(ctx.opts.paths.home, ctx.ui.log.path)}`,
    "",
    "--- what the failed step printed (last 60 lines) ---",
    output.split("\n").slice(-61).join("\n"),
    "",
    "--- the retries (what, why, which try) ---",
    ctx.retries.notes.slice(-40).map((n) => `${n.what}\t${n.why}\t${n.attempt}`).join("\n"),
    "",
    "--- the setup log, last 120 lines ---",
    logTail,
  ].join("\n");
  try {
    await fs.writeTextFile(path, redact(plain(text)));
  } catch { /* the stop message still says what failed */ }
}
