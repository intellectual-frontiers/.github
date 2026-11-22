// Spec: 0006-agents FR-024, FR-026, FR-036
/**
 * `ergonex agent jobs list|show|wait|cancel` (commons ergonex 0006-agents FR-024, FR-026): the jobs an agent started with `--job`, read from their records under `<workspace area>/jobs/<id>/`. A job whose
 * process is gone and that wrote no end is `abandoned`, and its record and evidence stay.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { value } from "../platform/k-args.ts";
import { readTextOr } from "../platform/r-fs.ts";
import { join } from "../platform/r-path.ts";
import { type Job, jobsFolder, jobsOf, readJob, writeJob } from "../agents/host/jobs.ts";
import type { Context, Outcome } from "../modules/types.ts";
import { defineCommand } from "./define.ts";
import { changes, HOME, reads } from "./options.ts";
import { jsonOf } from "./common.ts";

const ID = [{ name: "ID", help: "The identifier of the job.", arity: "one" }] as const;
const WAIT_OPTIONS = { ...HOME, timeout: value({ help: "Seconds to wait (30 by default).", valueName: "SECONDS" }) };

const line = (j: Job): string => `${j.id}  ${j.state.padEnd(9)} ${j.exit === undefined ? "" : `exit ${j.exit} `}${j.argv.join(" ")}`;

const needHome = (ctx: Context): string | Outcome => ctx.home ?? err({ kind: "environment", message: "no root can be found: set ERGONEX_HOME, or give --home" });

const list = defineCommand({
  name: "list",
  summary: "List the jobs of this workspace, with the state of each.",
  options: { ...HOME },
  action: reads(),
  run: async (ctx) => {
    const home = needHome(ctx);
    if (typeof home !== "string") return home;
    const jobs = await jobsOf(home);
    return ok({ text: jobs.length === 0 ? "no job" : jobs.map(line).join("\n"), data: jsonOf({ jobs }), findings: [] });
  },
});

const show = defineCommand({
  name: "show",
  summary: "Show one job: its record and the end of its output.",
  options: { ...HOME },
  operands: ID,
  action: reads(),
  run: async (ctx, args) => {
    const home = needHome(ctx);
    if (typeof home !== "string") return home;
    const id = args.positionals[0] ?? "";
    const job = await readJob(home, id);
    if (job === undefined) return err({ kind: "usage", message: `${JSON.stringify(id)} is not a job of this workspace` });
    const out = (await readTextOr(join(jobsFolder(home), id, "output.log"), "")).split("\n").slice(-40).join("\n");
    return ok({ text: `${line(job)}\n${out}`.trimEnd(), data: jsonOf({ job, output: out }), findings: [] });
  },
});

const wait = defineCommand({
  name: "wait",
  summary: "Wait for a job to end, for at most --timeout seconds; a job that has not ended ends the run with the status pending.",
  options: WAIT_OPTIONS,
  operands: ID,
  action: reads(),
  run: async (ctx, args) => {
    const home = needHome(ctx);
    if (typeof home !== "string") return home;
    const id = args.positionals[0] ?? "";
    const seconds = Number.parseInt(args.options.timeout ?? "30", 10);
    if (Number.isNaN(seconds) || seconds < 0) return err({ kind: "usage", message: "--timeout is a number of seconds" });
    const end = Date.now() + seconds * 1000;
    for (;;) {
      const job = await readJob(home, id);
      if (job === undefined) return err({ kind: "usage", message: `${JSON.stringify(id)} is not a job of this workspace` });
      if (job.state !== "running" && job.state !== "queued") return ok({ text: line(job), data: jsonOf({ job }), findings: [] });
      if (Date.now() >= end) return ok({ text: line(job), data: jsonOf({ job }), findings: [], pending: [`job ${id} has not ended after ${seconds} seconds`] });
      await new Promise((r) => setTimeout(r, 250));
    }
  },
});

const cancel = defineCommand({
  name: "cancel",
  summary: "Stop a job that runs (SIGTERM); its record stays, marked failed with the status of the signal.",
  options: { ...HOME },
  operands: ID,
  action: changes({ idempotent: true }),
  run: async (ctx, args) => {
    const home = needHome(ctx);
    if (typeof home !== "string") return home;
    const id = args.positionals[0] ?? "";
    const job = await readJob(home, id);
    if (job === undefined) return err({ kind: "usage", message: `${JSON.stringify(id)} is not a job of this workspace` });
    if (job.state !== "running" || job.pid === undefined) return ok({ text: `${line(job)}: nothing to stop`, data: jsonOf({ job }), findings: [] });
    try {
      process.kill(-job.pid, "SIGTERM");
    } catch {
      try {
        process.kill(job.pid, "SIGTERM");
      } catch (e) {
        return err({ kind: "environment", message: `the job could not be stopped: ${e instanceof Error ? e.message : String(e)}` });
      }
    }
    const ended: Job = { ...job, state: "failed", exit: 143, ended: new Date().toISOString() };
    await writeJob(home, ended);
    return ok({ text: `stopped ${id}`, data: jsonOf({ job: ended }), findings: [] });
  },
});

/** The commands of the branch `agent jobs`. */
export const jobsCommands = { list, show, wait, cancel };
