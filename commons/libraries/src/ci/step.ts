// Spec: 0002-libraries-ci-findings FR-004
/**
 * The step wrapper (commons 0038-build-policy FR-013): `bun commons/libraries/src/ci/step.ts --id ID --job JOB --module NAME --tool TOOL --timeout MINUTES --out DIR -- COMMAND...` runs one command, keeps what it printed, prints it as it was
 * printed, reads it into findings with the parser of the tool, writes the file of the step (`DIR/ID.json`, a `build-findings/1` file of one step) and exits 0 whatever the command's own status was. A command that cannot be started, that fails and prints nothing
 * a parser reads, or that is stopped by the time limit is a finding of the tool (`tool-error`, `no-output`, `timeout`) and never a red step. The only status that is not 0 is 2, for a wrapper called wrongly (the red cause `wrapper-misused`, FR-002).
 *
 * @remarks
 * It imports no package, only files of this folder and `node:` modules, so that it runs in a cell of the matrix before the cell's packages are installed. The time limit stops the command's whole process group, so that a command that started others
 * does not outlive it.
 *
 * @example
 * ```sh
 * bun commons/libraries/src/ci/step.ts --id verify --job verify --module core --tool exit-status --timeout 15 --out "$RUNNER_TEMP/findings" -- bash -c "bun run verify"
 * ```
 *
 * @module
 */
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Finding, type FindingsFile, type Outcome, type StepRecord } from "./findings.ts";
import { outcomeFinding, type ParseContext, parseOutput } from "./parsers.ts";
import { TOOLS, type Tool } from "./policy.ts";

/** What the wrapper was asked to do, or the sentence that says it was called wrongly. */
export type Request = { readonly id: string; readonly job: string; readonly module: string; readonly tool: Tool; readonly timeoutMinutes: number; readonly out: string; readonly command: readonly string[]; /** Findings of one module for each test file the output names (0038-build-policy FR-014). */ readonly perFile?: boolean };

/** The request an argument list makes (the words before `--` are options, the words after it the command), or what is wrong with it. */
export function parseRequest(argv: readonly string[]): { readonly kind: "ok"; readonly request: Request } | { readonly kind: "err"; readonly error: string } {
  const at = argv.indexOf("--");
  if (at < 0) return { kind: "err", error: "no `--` before the command" };
  const command = argv.slice(at + 1);
  if (command.length === 0) return { kind: "err", error: "no command after `--`" };
  const o = new Map<string, string>();
  const words = argv.slice(0, at);
  for (let i = 0; i < words.length; i += 2) {
    const k = words[i];
    const v = words[i + 1];
    if (k === undefined || !k.startsWith("--") || v === undefined) return { kind: "err", error: `the option ${k ?? ""} has no value` };
    o.set(k.slice(2), v);
  }
  const need = (k: string): string | undefined => (o.get(k) !== undefined && o.get(k) !== "" ? o.get(k) : undefined);
  const id = need("id");
  const job = need("job");
  const module = need("module");
  const out = need("out");
  const tool = need("tool");
  const minutes = Number(need("timeout"));
  if (id === undefined || !/^[A-Za-z0-9._-]+$/.test(id)) return { kind: "err", error: "--id is the step's id: letters, digits, dots, hyphens and underscores" };
  if (job === undefined || module === undefined || out === undefined) return { kind: "err", error: "--job, --module and --out are needed" };
  if (tool === undefined || !TOOLS.includes(tool as Tool)) return { kind: "err", error: `--tool is one of ${TOOLS.join(", ")}` };
  if (!Number.isFinite(minutes) || minutes <= 0) return { kind: "err", error: "--timeout is a number of minutes greater than 0" };
  return { kind: "ok", request: { id, job, module, tool: tool as Tool, timeoutMinutes: minutes, out, command, ...(need("per-file") === "true" ? { perFile: true } : {}) } };
}

const MAX_KEPT = 20 * 1024 * 1024;

/** What running the command came to. */
export type Ran = { readonly output: string; readonly exitStatus: number | null; readonly timedOut: boolean; readonly startError?: string; readonly durationMs: number };

/** Runs the command with the time limit, printing what it prints as it prints it and keeping up to 20 MiB of it. */
export function runCommand(command: readonly string[], timeoutMinutes: number, echo: (chunk: string) => void = (c) => void process.stdout.write(c)): Promise<Ran> {
  return new Promise((done) => {
    const started = Date.now();
    let kept = "";
    let timedOut = false;
    let settled = false;
    const finish = (r: Omit<Ran, "durationMs" | "output" | "timedOut">): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done({ output: kept, timedOut, durationMs: Date.now() - started, ...r });
    };
    const [program, ...args] = command;
    const child = spawn(program ?? "", args, { stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
    const take = (b: Buffer): void => {
      const s = b.toString("utf8");
      echo(s);
      if (kept.length < MAX_KEPT) kept += s;
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform === "win32" || child.pid === undefined) child.kill("SIGKILL");
        else process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutMinutes * 60_000);
    child.on("error", (e) => finish({ exitStatus: null, startError: e.message }));
    child.on("close", (code) => finish({ exitStatus: code }));
  });
}

/** The file of one step from what its command came to: the findings its parser reads, or the finding of how it ended. */
export function fileOfRun(req: Request, ran: Ran, run: { readonly id: string; readonly workflow: string; readonly commit: string; readonly at: string; readonly url?: string }): FindingsFile {
  const ctx: ParseContext = { module: req.module, run: run.id, commit: run.commit, step: req.id, at: run.at };
  let findings = parseOutput(req.tool, ran.output, ctx);
  let outcome: Outcome = findings.length > 0 ? "findings" : "ok";
  if (ran.startError !== undefined) {
    findings = [outcomeFinding(req.tool, "tool-error", `the command could not be started: ${ran.startError}`, ctx, ran.output)];
    outcome = "tool-error";
  } else if (ran.timedOut) {
    findings = [...findings, outcomeFinding(req.tool, "timeout", `the command was stopped after ${req.timeoutMinutes} minutes`, ctx, ran.output)];
    outcome = "timeout";
  } else if (ran.exitStatus !== 0 && findings.length === 0) {
    findings = [outcomeFinding(req.tool, "no-output", `the command ended with status ${ran.exitStatus ?? "?"} and printed nothing a parser of ${req.tool} reads`, ctx, ran.output)];
    outcome = "no-output";
  }
  const step: StepRecord = { id: req.id, job: req.job, module: req.module, tool: req.tool, outcome, findings: findings.length, durationMs: ran.durationMs, ...(ran.exitStatus === null ? {} : { exitStatus: ran.exitStatus }) };
  if (req.perFile === true && ran.startError === undefined) return perFileOf(req, ran, run, step, findings);
  return { schema: "build-findings/1", run, steps: [step], findings };
}

/** The test files a runner's output names, each with the lines of its section (a header line `tests/x.test.ts:` begins one). */
export function sectionsOf(output: string): readonly { readonly file: string; readonly text: string }[] {
  const out: { file: string; text: string[] }[] = [];
  for (const raw of output.split("\n")) {
    const header = /^(?:::group::)?(\S.*\.(?:test\.)?(?:ts|tsx|js|mjs)):$/.exec(raw.trimEnd());
    if (header !== null) {
      const file = header[1] ?? "";
      if (!out.some((s) => s.file === file)) out.push({ file, text: [] });
      out.find((s) => s.file === file)?.text.push(raw);
    } else out[out.length - 1]?.text.push(raw);
  }
  return out.map((s) => ({ file: s.file, text: s.text.join("\n") }));
}

/**
 * The file of a step whose tests are the repository's root (0038-build-policy FR-014): the findings are of one module for each test file (`repository/tests/x.test.ts`), a step record for each file records that the file ran (so that a file that no longer fails is fixed),
 * and what the whole run said that belongs to no file (a timeout, a status with nothing read) stays with the module of the step.
 */
function perFileOf(req: Request, ran: Ran, run: Parameters<typeof fileOfRun>[2], whole: StepRecord, wholeFindings: readonly Finding[]): FindingsFile {
  const steps: StepRecord[] = [];
  const findings: Finding[] = [];
  for (const s of sectionsOf(ran.output)) {
    const module = `${req.module}/${s.file}`;
    const mine = parseOutput(req.tool, s.text, { module, run: run.id, commit: run.commit, step: req.id, at: run.at });
    findings.push(...mine);
    steps.push({ id: req.id, job: req.job, module, tool: req.tool, outcome: mine.length > 0 ? "findings" : "ok", findings: mine.length, durationMs: 0 });
  }
  const rest = wholeFindings.filter((f) => f.code !== "test-failed" && f.code !== "test-timeout" && f.code !== "unhandled-error");
  const kept = [...findings, ...rest];
  return { schema: "build-findings/1", run, steps: [{ ...whole, findings: rest.length, outcome: rest.length > 0 ? whole.outcome : "ok" }, ...steps], findings: kept };
}

/** Runs a request and writes its file; returns the file. */
export async function execute(req: Request, env: Readonly<Record<string, string | undefined>>, echo?: (chunk: string) => void): Promise<FindingsFile> {
  const ran = await runCommand(req.command, req.timeoutMinutes, echo);
  const run = { id: env["GITHUB_RUN_ID"] ?? "local", workflow: env["GITHUB_WORKFLOW"] ?? "local", commit: env["GITHUB_SHA"] ?? "local", at: new Date().toISOString().replace(/\.\d+Z$/, "Z"), ...(env["GITHUB_SERVER_URL"] !== undefined && env["GITHUB_REPOSITORY"] !== undefined && env["GITHUB_RUN_ID"] !== undefined ? { url: `${env["GITHUB_SERVER_URL"]}/${env["GITHUB_REPOSITORY"]}/actions/runs/${env["GITHUB_RUN_ID"]}` } : {}) };
  const file = fileOfRun(req, ran, run);
  mkdirSync(req.out, { recursive: true });
  writeFileSync(join(req.out, `${req.job.replace(/[^A-Za-z0-9._-]+/g, "_")}.${req.module.replace(/[^A-Za-z0-9._-]+/g, "_")}.${req.id}.json`), `${JSON.stringify(file, null, 2)}\n`);
  return file;
}

if (import.meta.main) {
  const parsed = parseRequest(process.argv.slice(2));
  if (parsed.kind === "err") {
    process.stderr.write(`ci step: ${parsed.error} (the red cause wrapper-misused)\n`);
    process.exitCode = 2;
  } else {
    const file = await execute(parsed.request, process.env);
    const s = file.steps[0];
    // what later steps of the job read where they used to read the outcome of the step: `outcome` as GitHub says it (success or failure) and the wrapper's own word
    if (process.env["GITHUB_OUTPUT"] !== undefined) appendFileSync(process.env["GITHUB_OUTPUT"], `outcome=${s?.outcome === "ok" ? "success" : "failure"}\ndetail=${s?.outcome ?? "?"}\nfindings=${file.findings.length}\n`);
    process.stderr.write(`\nci step ${parsed.request.id}: ${s?.outcome ?? "?"}, ${file.findings.length} findings (never a red step)\n`);
    process.exitCode = 0;
  }
}
