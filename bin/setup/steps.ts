// Steps: one line with a spinner (at a terminal, after half a second), the output kept in the log and shown only when the step fails (FR-061, FR-062); the
// jobs that do not touch each other at the same time (FR-030); and the one way a run ends when something went wrong (FR-067).
import { type Ctx, problem } from "./context.ts";
import { ok, type Phase, type Stop, stop } from "./result.ts";
import { type Ran, run, type RunOptions } from "./proc.ts";
import { netWords } from "./net.ts";
import { clip, plain, redact, shortPath, write } from "./ui.ts";

/** What a step does: run a program, or a piece of this setup that says what it did through `out`. */
export type Work =
  | { readonly kind: "command"; readonly argv: readonly string[]; readonly options?: RunOptions }
  | { readonly kind: "task"; readonly run: (out: (text: string) => void) => Promise<number> };

export const command = (argv: readonly string[], options?: RunOptions): Work => ({ kind: "command", argv, options });
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
          work.options?.onOutput?.(t);
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
  }
}

/** The spinner line, redrawn every tenth of a second from half a second in, until stopped. */
function spinner(ctx: Ctx, draw: (frame: string) => string): () => void {
  if (!ctx.ui.look.tty) return () => {};
  let ticks = 0, shown = false;
  const frames = ctx.ui.frames;
  const t = setInterval(() => {
    ticks++;
    if (ticks < 5) return;
    shown = true;
    write("err", `\r\u001b[K${draw(frames[ticks % frames.length] ?? "")}`);
  }, 100);
  return () => {
    clearInterval(t);
    if (shown) write("err", "\r\u001b[K");
  };
}

/** The step's output in the log, under a header that names it; returns the line where it starts. */
function keep(ctx: Ctx, label: string, ran: Ran): number {
  const from = ctx.ui.log.lines + 1;
  ctx.ui.log.raw(`\n==== STEP ${ctx.st.stepNo}: ${label} (exit ${ran.code})\n${ran.output}${ran.output.endsWith("\n") || ran.output === "" ? "" : "\n"}`);
  return from;
}

/** Run a step quietly; its output is shown only where it fails. Returns what it did; a dry run only says it. */
export async function stepRan(ctx: Ctx, label: string, work: Work, counting?: Counting): Promise<{ readonly ran: Ran; readonly logLine: number }> {
  if (ctx.opts.dryRun) {
    write("out", `  - ${label}\n`);
    return { ran: { code: 0, output: "" }, logLine: 0 };
  }
  ctx.st.stepNo++;
  const { c, z, d, b, y } = ctx.ui.p;
  const start = Date.now();
  if (!ctx.ui.look.tty) write("err", `${label}...\n`);
  let lines = 0;
  const short = clip(ctx.ui.look.cols - 16, label);
  const stopSpinning = spinner(ctx, (f) => {
    let cnt = "";
    if (counting !== undefined) {
      let n = Math.floor(lines / counting.div);
      if (counting.total !== null) n = Math.min(n, counting.total);
      cnt = `: ${b}${n}${z}${counting.total !== null ? ` of ${counting.total}` : ""}`;
    }
    const r = ctx.retries.notes.length;
    return `${c}${f}${z} ${short}${cnt} ${d}(${Math.floor((Date.now() - start) / 1000)}s)${z}${r > 0 ? ` ${y}${ctx.ui.e.retry}${r} retries${z}` : ""}`;
  });
  const ran = await perform(work, (t) => {
    if (counting !== undefined) { for (const l of t.split("\n")) if (counting.re.test(l)) lines++; }
  });
  stopSpinning();
  const logLine = keep(ctx, label, ran);
  ctx.signals.event("bootstrap_step", {
    step: label,
    phase: plain(ctx.ui.currentPhase),
    outcome: ran.code === 0 ? "ok" : "failed",
    exit_code: ran.code,
    duration_ms: Date.now() - start,
    step_no: ctx.st.stepNo,
  });
  if (ran.code !== 0) {
    ctx.ui.markBad();
    ctx.st.lastOutput = ran.output;
  } else if (ctx.opts.switches.verbose && ctx.ui.look.tty) {
    write("err", `${ctx.ui.p.g}${ctx.ui.e.tick}${z} ${label}\n`); // a step that worked leaves no line behind unless asked
  }
  return { ran, logLine };
}

/** A step whose failure stops the run (exit status 4), unless BOOTSTRAP_KEEP_GOING=1. */
export async function step(ctx: Ctx, label: string, work: Work, counting?: Counting): Promise<Phase> {
  const { ran, logLine } = await stepRan(ctx, label, work, counting);
  if (ran.code === 0) return ok(undefined);
  if (ctx.opts.switches.keepGoing) {
    showFailure(ctx, label, ran.output);
    return ok(undefined);
  }
  return stop(await stopHere(ctx, label, ran.output, logLine));
}

/** A step whose failure the caller explains and handles itself: its exit status. */
export async function stepSoft(ctx: Ctx, label: string, work: Work, counting?: Counting): Promise<number> {
  const { ran } = await stepRan(ctx, label, work, counting);
  if (ran.code !== 0) showFailure(ctx, label, ran.output);
  return ran.code;
}

function showFailure(ctx: Ctx, label: string, output: string): void {
  write("err", `${ctx.ui.p.r}${ctx.ui.e.cross}${ctx.ui.p.z} ${label}\n${output.split("\n").filter((l) => l !== "").slice(-8).join("\n")}\n`);
}

export type Job = { readonly label: string; readonly work: Work };

/**
 * Jobs that do not touch each other, at most BOOTSTRAP_JOBS at once, under one progress line (FR-030, FR-031). Each runs to its end; then each is logged in order,
 * and the first that failed stops the run (or, with BOOTSTRAP_KEEP_GOING=1, is warned of).
 */
export async function pool(ctx: Ctx, title: string, jobs: readonly Job[]): Promise<Phase> {
  if (ctx.opts.dryRun) {
    for (const j of jobs) write("out", `  - ${j.label}\n`);
    return ok(undefined);
  }
  const results: ({ ran: Ran; seconds: number } | null)[] = jobs.map(() => null);
  const start = Date.now();
  let next = 0;
  const stopSpinning = spinner(ctx, (f) => {
    const doneCount = results.filter((r) => r !== null).length;
    const busy = jobs.find((_, i) => results[i] === null && i < next)?.label ?? "";
    return `${ctx.ui.p.c}${f}${ctx.ui.p.z} ${clip(ctx.ui.look.cols - 4, `${title}: ${doneCount} of ${next} (${Math.floor((Date.now() - start) / 1000)}s) ${busy}`)}`;
  });
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      const job = jobs[i];
      if (job === undefined) return;
      const t0 = Date.now();
      const ran = await perform(job.work, () => {});
      results[i] = { ran, seconds: (Date.now() - t0) / 1000 };
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(ctx.opts.jobs, jobs.length)) }, worker));
  stopSpinning();
  let failed: { label: string; output: string; line: number } | null = null;
  jobs.forEach((job, i) => {
    const r = results[i] ?? { ran: { code: 1, output: "the job did not finish\n" }, seconds: 0 };
    ctx.st.stepNo++;
    ctx.signals.event("bootstrap_step", {
      step: job.label,
      phase: plain(ctx.ui.currentPhase),
      outcome: r.ran.code === 0 ? "ok" : "failed",
      exit_code: r.ran.code,
      duration_ms: Math.round(r.seconds * 1000),
      step_no: ctx.st.stepNo,
      parallel: "yes",
    });
    const line = keep(ctx, job.label, r.ran);
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
  const { d, z, b } = ctx.ui.p;
  ctx.ui.say("");
  ctx.ui.say(`${d}${ctx.ui.e.retry}The network needed ${n} retries in this run, most for: ${ctx.retries.top()}.${z}`);
  ctx.ui.say(`${d}   If that happens often here, add ${z}${b}--patient${z}${d} (15 tries, longer waits) or set ${z}${b}ERGA_RETRIES=20${z}${d}; fewer: ERGA_RETRIES=3.${z}`);
}

/**
 * The one way the run ends when a step failed (FR-067): say what failed in plain words, where to look (a path relative to the home folder) and how to ask for help;
 * a support file with what the team needs, and no secrets, is written beside the log.
 */
export async function stopHere(ctx: Ctx, label: string, output: string, logLine: number): Promise<Stop> {
  const ui = ctx.ui;
  const { r, b, z, d, y, c, g } = ui.p;
  const home = ctx.opts.paths.home;
  ui.phaseDrop();
  const tail = output.split("\n").filter((l) => l !== "");
  ctx.signals.event("bootstrap_failed", {
    step: label,
    step_no: ctx.st.stepNo,
    log_line: logLine,
    log_file: ui.log.path === null ? "" : shortPath(home, ui.log.path),
    support_file: ui.log.supportPath === null ? "" : shortPath(home, ui.log.supportPath),
    error_tail: redact(plain(tail.slice(-3).join(" "))).replaceAll(home, "~"),
  });
  ui.say("");
  ui.say(`${r}${b}${ui.e.stop}Setup stopped: something went wrong${z}`);
  ui.say(`${d}Nothing is half-installed in a way that matters; it is safe to run the setup again once this is fixed.${z}`);
  ui.say("");
  ui.say(`${y}${ui.e.what}What failed:${z}  ${b}${label}${z}`);
  ui.say(`${y}${ui.e.why}What it said:${z}`);
  for (const l of tail.slice(-6)) write("out", `     ${clip(ui.look.cols - 6, l)}\n`);
  ui.say("");
  if (netWords(output)) {
    ui.say(`${y}${ui.e.retry}This looks like the network (a name that would not resolve, a connection that broke), not your computer.${z}`);
    ui.say("   Nothing needs undoing: run the setup again and it carries on where it stopped. What was fetched is kept, and a download that stopped half way resumes.");
    ui.say(`   On a network that keeps dropping, add ${b}--patient${z} (15 tries, longer waits) or set ${b}ERGA_RETRIES=20${z}.`);
    retrySummary(ctx);
    ui.say("");
  }
  if (ui.log.path !== null && ui.log.supportPath !== null) {
    await writeSupportFile(ctx, label, output, logLine);
    ui.say(`${c}${ui.e.log}Where to look:${z}   ${b}${shortPath(home, ui.log.path)}${z}  ${d}(the problem starts at line ${logLine})${z}`);
    ui.say(`${c}${ui.e.pack}Support file:${z}    ${b}${shortPath(home, ui.log.supportPath)}${z}  ${d}(everything the team needs, with no passwords)${z}`);
  } else {
    ui.say(`${d}The log could not be written (is your disk full?). Free some space and run the setup again.${z}`);
  }
  ui.say("");
  ui.say(`${g}${b}${ui.e.help}Not sure what to do? That is fine. Here is how to get help:${z}`);
  ui.say(`   ${c}1.${z} Copy the support file path above.`);
  ui.say(`   ${c}2.${z} Send that one file to ${b}${ctx.opts.support}${z}, and say what you were doing`);
  ui.say(`      ${d}(for example: "I ran the Debian setup on Windows and it stopped at ${label}").${z}`);
  ui.say(`   ${c}3.${z} You can see the file any time with:  ${b}cat ${ui.log.supportPath === null ? "" : shortPath(home, ui.log.supportPath)}${z}`);
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
    logTail = ctx.ui.log.path === null ? "" : (await Deno.readTextFile(ctx.ui.log.path)).split("\n").slice(-120).join("\n");
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
    await Deno.writeTextFile(path, redact(plain(text)));
  } catch { /* the stop message still says what failed */ }
}
