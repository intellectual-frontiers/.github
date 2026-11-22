// Spec: 0006-agents FR-024, FR-025
/**
 * Starting a job (commons ergonex 0006-agents FR-024, FR-025): the command line of the job is run again as a process of its own that has no controlling terminal (a new session) and outlives the SSH
 * session that started it, its output in files of the job's folder; the record is written before the process starts and the identifier is given at once. `ergonex apply` is the only command that is
 * carried as a job that changes the host, and only with the hash of the plan it carries out.
 *
 * @module
 */
import { existsSync, mkdir, readDirSync, readTextOr, statSync } from "../../platform/r-fs.ts";
import { join } from "../../platform/r-path.ts";
import { execPath, run } from "../../platform/r-proc.ts";
import { type Job, jobsFolder, newJobId, planHashOf, readJob, withoutJobWords, writeJob } from "./jobs.ts";
import { redact } from "./token-source.ts";

/** Why a job was not started. */
export type JobRefusal = { readonly kind: "usage" | "environment"; readonly message: string };

/** The commands that only read need no hash; `apply` needs the hash of its plan; the other commands that change the host are not carried as jobs. */
function commandOf(words: readonly string[]): string {
  const first = words.findIndex((w) => !w.startsWith("-"));
  return first < 0 ? "" : words.slice(first, first + 2).join(" ");
}

const CHANGING = ["setup", "render", "repos add", "repos remove", "repos delete", "repos adopt", "worktree create", "worktree prune", "remote bootstrap"];

/** What a job is started with. */
export type JobRequest = {
  readonly home: string;
  /** The words after `ergonex`, with `--job`. */
  readonly words: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly entry: string;
  readonly now: number;
  /** The secrets to keep out of the record of the command line. */
  readonly secrets: readonly string[];
};

/** Starts a job and returns it, or says why not. */
export async function startJob(req: JobRequest): Promise<Job | JobRefusal> {
  const words = withoutJobWords(req.words);
  const command = commandOf(words);
  if (CHANGING.some((c) => command === c || command.startsWith(`${c} `)) && !words.includes("--dry-run") && !words.includes("--check"))
    return { kind: "usage", message: `\`ergonex ${command}\` changes the host or the workspace and is not carried as a job: run it in the foreground, or run \`ergonex apply --job --plan-hash HASH\`` };
  if (command === "apply") {
    const given = planHashOf(req.words);
    if (given === undefined) return { kind: "usage", message: "a job that changes the workspace is started with the hash of the plan it carries out: run `ergonex plan`, then `ergonex apply --job --plan-hash HASH`" };
    // the plan is made again now, by the same program, and the hash compared (FR-025)
    const planWords = ["plan", "--json", ...words.filter((w, i) => w.startsWith("--home") || words[i - 1] === "--home")];
    const r = await run([execPath(), req.entry, ...planWords], { env: { ...envOf(req.env), ERGONEX_PERSONA: "human" } });
    const found = /"planSha256"\s*:\s*"([0-9a-f]{64})"/.exec(r.stdout)?.[1];
    if (found === undefined) return { kind: "environment", message: "the plan could not be made to compare its hash" };
    if (found !== given) return { kind: "usage", message: `the plan is ${found}, not ${given}; nothing was changed: run \`ergonex plan\` again and give its hash` };
  }
  const id = newJobId(req.now);
  const folder = join(jobsFolder(req.home), id);
  await mkdir(folder, { recursive: true });
  const job: Job = { id, argv: words.map((w) => redact(w, req.secrets)), state: "queued", started: new Date(req.now).toISOString() };
  await writeJob(req.home, job);
  // `setsid -f` gives the job a session of its own with no controlling terminal, so that it outlives the SSH session; the shell writes its own process id (which `exec` keeps) and runs the command with its output in the job's folder
  const pidFile = join(folder, "pid");
  const script = 'echo $$ > "$1"; log=$2; shift 2; exec "$@" >>"$log" 2>&1 </dev/null';
  const started = await run(["setsid", "-f", "sh", "-c", script, "sh", pidFile, join(folder, "output.log"), execPath(), req.entry, ...words], {
    env: { ...envOf(req.env), ERGONEX_JOB_ID: id, ERGONEX_HOME: req.home, ERGONEX_PERSONA: "agent" },
  }).catch(() => undefined);
  if (started === undefined || !started.success) return { kind: "environment", message: "setsid could not start the job (util-linux `setsid` is needed; jobs are for Linux targets)" };
  let pid: number | undefined;
  for (let i = 0; i < 100 && pid === undefined; i++) {
    const text = await readTextOr(pidFile, undefined);
    const n = text === undefined ? NaN : Number.parseInt(text.trim(), 10);
    if (!Number.isNaN(n)) pid = n;
    else await new Promise((r) => setTimeout(r, 20));
  }
  // a job that has ended already (it was quick) keeps its end
  const now = await readJob(req.home, id);
  if (now !== undefined && (now.state === "succeeded" || now.state === "failed")) return now;
  const running: Job = { ...job, state: "running", ...(pid === undefined ? {} : { pid }) };
  await writeJob(req.home, running);
  return running;
}

function envOf(env: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) out[k] = v;
  return out;
}

/** Records how a job ended: its exit status and, if one was written since it started, the evidence record it left. */
export async function finishJob(home: string, id: string, code: number, startedAt: number): Promise<void> {
  const job = await readJob(home, id);
  if (job === undefined || job.state === "abandoned") {
    // our own process is alive while it writes this, so a record read as abandoned only lacks a pid
  }
  const base = job ?? { id, argv: [], state: "running" as const };
  const day = new Date().toISOString().slice(0, 10).split("-").join("/");
  const evidence = await latestEvidence(join(home, ".ergonex", "evidence", day), startedAt);
  await writeJob(home, { ...base, state: code === 0 ? "succeeded" : "failed", exit: code, ended: new Date().toISOString(), ...(evidence === undefined ? {} : { evidence }) });
}

async function latestEvidence(folder: string, since: number): Promise<string | undefined> {
  if (!existsSync(folder)) return undefined;
  const names = readDirSync(folder).map((e) => e.name).filter((n) => n.endsWith(".otlp.json"));
  let best: string | undefined;
  for (const n of names.sort()) {
    const p = join(folder, n);
    const m = statSync(p).mtime?.getTime() ?? 0;
    if (m >= since) best = p;
  }
  return best;
}
