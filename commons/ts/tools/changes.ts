/**
 * The change-control check with a Git host (commons 0020-ifccm FR-009, FR-028 to FR-031): `mizan/changes.ts` judges commits and, with `--strict`, asks the host about each issue they name,
 * but it is given its host's client and never makes one. This command makes it from the repository's `origin` (`githost/remote.ts` reads the remote, `githost/mod.ts` makes the client,
 * with a token only from the environment) and runs the check, so that `--strict` asks GitHub or GitLab and a plain Git remote is `not_run` with its reason.
 *
 * Each run leaves its result as a quality record (0021-ifqs FR-015, 0020-ifccm FR-031): each rule a case, each finding a failed case with its rule, file and line, and each rule that could
 * not run (the strict rules on plain Git, with no host client or without `--strict`; the commit rules without a `--range`) a case that is `not_run` with its reason, never a pass. The record is
 * written to `test-results/changes-<trace id>.otlp.json` of the repository, and kept on the `quality` branch with `--keep-record`.
 *
 *     bun commons/ts/tools/changes.ts [--repo DIR] [--strict] [--range A..B] ...    every flag of `mizan/changes.ts`
 *     bun commons/ts/tools/changes.ts --record-dir DIR                              where the record is written (the repository's `test-results` by default)
 *     bun commons/ts/tools/changes.ts --keep-record                                 also keep it as evidence on the `quality` branch (signed where Git is set to sign)
 *
 * @module
 */
import process from "node:process";
import { clientFor, parseRemote } from "../githost/mod.ts";
import { type Deps, type RuleResult, run as changes } from "../mizan/changes.ts";
import { parseSpanId, parseTraceId, type SpanId, type TraceId } from "@intellectual-frontiers/telemetry/otel";
import { keepRun, writeOnce } from "../quality/host/branch.ts";
import { checkRun } from "../quality/pure/record.ts";
import { mkdir } from "@intellectual-frontiers/system/fs";
import { join, resolve } from "@intellectual-frontiers/system/path";
import { build, env, run, runtimeName, runtimeVersion } from "@intellectual-frontiers/system/proc";
import { stderr } from "@intellectual-frontiers/system/stdio";

function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function traceId(): TraceId {
  for (;;) {
    const r = parseTraceId(randomHex(16));
    if (r.kind === "ok") return r.value;
  }
}

function spanId(): SpanId {
  for (;;) {
    const r = parseSpanId(randomHex(8));
    if (r.kind === "ok") return r.value;
  }
}

const nowNanos = (): bigint => BigInt(Date.now()) * 1_000_000n;

/** The flags this command adds to those of `mizan/changes.ts`, taken out of the command line. */
function split(argv: readonly string[]): {
  readonly rest: readonly string[];
  readonly recordDir?: string;
  readonly keep: boolean;
  readonly bad?: string;
} {
  const rest: string[] = [];
  let recordDir: string | undefined;
  let keep = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--keep-record") keep = true;
    else if (a === "--record-dir" || a.startsWith("--record-dir=")) {
      const v = a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[++i];
      if (v === undefined || v === "") return { rest, keep, bad: "--record-dir needs a value" };
      recordDir = v;
    } else rest.push(a);
  }
  return { rest, keep, ...(recordDir === undefined ? {} : { recordDir }) };
}

/** The record of a run of the check (FR-031): the rules it ran as cases, written where asked and kept on the `quality` branch where asked. */
async function leaveRecord(
  repo: string,
  rules: readonly RuleResult[] | undefined,
  code: number,
  start: bigint,
  end: bigint,
  recordDir: string | undefined,
  keep: boolean,
): Promise<void> {
  const ruleList: readonly RuleResult[] = rules ?? [
    {
      id: "changes/run",
      findings: [],
      notRun: `the check did not judge anything: it exited with status ${code}, and said why on standard error`,
    },
  ];
  const cases = ruleList.reduce((n, r) => n + (r.notRun !== undefined ? 0 : Math.max(1, r.findings.length)), 0);
  const head = await run(["git", "-C", repo, "rev-parse", "--verify", "--quiet", "HEAD"]);
  const made = await checkRun({
    tool: "changes",
    rules: ruleList,
    traceId: traceId(),
    spanId: spanId(),
    caseIds: Array.from({ length: cases }, spanId),
    start,
    end,
    runner: {
      runtime: runtimeName(),
      runtimeVersion: runtimeVersion(),
      os: build.os,
      arch: build.arch,
      role: "changes",
      ...(head.code === 0 && head.stdout.trim() !== "" ? { revision: head.stdout.trim() } : {}),
    },
    requirements: ["0020-ifccm FR-031"],
    resourceAttributes: { "ifc.check.exit.code": BigInt(code) },
  });
  if (made.kind === "err") {
    stderr.writeSync(`changes: the record of this run could not be made: ${JSON.stringify(made.error)}\n`);
    return;
  }
  const folder = recordDir === undefined ? join(repo, "test-results") : resolve(repo, recordDir);
  await mkdir(folder, { recursive: true });
  const file = join(folder, `changes-${made.value.record.traceId}.otlp.json`);
  const written = await writeOnce(file, made.value.text);
  stderr.writeSync(written.kind === "ok" ? `changes: record ${file}\n` : `changes: the record could not be written to ${file}\n`);
  if (keep) {
    const kept = await keepRun({ repo, record: made.value.text });
    stderr.writeSync(
      kept.kind === "ok"
        ? `changes: kept ${kept.value.path} (${kept.value.grade})\n`
        : `changes: the record could not be kept on the quality branch\n`,
    );
  }
}

/** The command line. Returns the exit status of the check (0, 1, 2, 3). */
export async function main(argv: readonly string[]): Promise<number> {
  const s = split(argv);
  if (s.bad !== undefined) {
    stderr.writeSync(`changes: ${s.bad}\n`);
    return 2;
  }
  const i = s.rest.indexOf("--repo");
  const repo = resolve((i >= 0 ? s.rest[i + 1] : undefined) ?? process.cwd());
  let captured: readonly RuleResult[] | undefined;
  let deps: Deps = { onRules: (r) => void (captured = r) };
  if (s.rest.includes("--strict")) {
    const origin = await run(["git", "-C", repo, "remote", "get-url", "origin"]);
    const parsed = origin.code === 0 ? parseRemote(origin.stdout.trim()) : undefined;
    if (parsed !== undefined && parsed.kind === "ok") {
      const environment = Object.fromEntries(["GITHUB_TOKEN", "GH_TOKEN", "GITLAB_TOKEN", "CI_JOB_TOKEN"].map((k) => [k, env.get(k)]));
      deps = { ...deps, client: clientFor(parsed.value, { env: environment }), home: parsed.value };
    }
  }
  const start = nowNanos();
  const code = await changes(s.rest, deps);
  await leaveRecord(repo, captured, code, start, nowNanos(), s.recordDir, s.keep);
  return code;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
