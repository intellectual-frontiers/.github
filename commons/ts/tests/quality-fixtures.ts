/**
 * What the tests of the quality system (`quality-*.test.ts`) share: a run assembled as 0008-test-evidence assembles it, from cases made
 * by hand (the values `runtime/test.ts` records), a real temporary Git repository with a committer, and an SSH signing key made by the
 * real `ssh-keygen` where it is installed. Nothing here stands in for the code under test: the repositories are real, the signing is Git's.
 *
 * @module
 */
import type { JsonObject } from "../kernel/json5.ts";
import { parseSpanId, parseTraceId, type SpanId, type TraceId } from "../kernel/otel.ts";
import { assembleRecord } from "../kernel/test-report.ts";
import {
  type Installation,
  installationResource,
  type Outcome,
  type Risk,
  type TestCase,
  TEST_SCOPE,
  testCaseLog,
  testCaseSpan,
  testId,
} from "../kernel/test-record.ts";
import { readTextFile, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { run, which } from "../runtime/proc.ts";
import { assert } from "../runtime/test.ts";

/** Where git is, or the reason a test of it is skipped. */
export const needsGit = which("git") === undefined ? { skip: "git is not installed" } : {};

/** Where ssh-keygen is, or the reason a test that signs is skipped. */
export const needsSshKeygen =
  which("ssh-keygen") === undefined || which("git") === undefined ? { skip: "ssh-keygen or git is not installed" } : {};

/** A trace id made from a number, so that a test names its runs. */
export function traceOf(n: number): TraceId {
  const r = parseTraceId(n.toString(16).padStart(32, "0"));
  assert(r.kind === "ok", "a trace id");
  return r.value;
}

/** A span id made from a number. */
export function spanOf(n: number): SpanId {
  const r = parseSpanId(n.toString(16).padStart(16, "0"));
  assert(r.kind === "ok", "a span id");
  return r.value;
}

/** What a hand-made case needs. */
export type CaseSpec = {
  readonly name: string;
  readonly file?: string;
  readonly outcome?: Outcome;
  readonly requirements?: readonly string[];
  readonly risk?: Risk;
  readonly message?: string;
  readonly reason?: string;
  readonly characteristic?: string;
};

const NS = 1_000_000_000n;

/** The installation of the runs the tests assemble. */
export function installation(revision?: string): Installation {
  return {
    runtime: "bun",
    runtimeVersion: "1.4.4",
    os: "linux",
    arch: "amd64",
    role: "ci",
    ...(revision === undefined ? {} : { revision }),
  };
}

/** The `Date` a run ends on, as nanoseconds: 2026-11-17T12:00:00Z plus `n` seconds. */
export function noon(n = 0): bigint {
  return (BigInt(Date.UTC(2026, 10, 17, 12, 0, 0)) / 1000n + BigInt(n)) * NS;
}

/**
 * A run as `assembleRecord` writes it (0008-test-evidence FR-005): a `test` span and a log record for each case, the run's span. `n`
 * makes the trace's id, so that each run of a test is another.
 */
export async function assembledRun(
  n: number,
  cases: readonly CaseSpec[],
  options: { readonly revision?: string; readonly required?: readonly string[]; readonly endsAt?: bigint } = {},
): Promise<JsonObject> {
  const traceId = traceOf(n);
  const runSpan = spanOf(n * 1000);
  const end = options.endsAt ?? noon(n);
  const spans = [];
  const records = [];
  for (const [i, c] of cases.entries()) {
    const file = c.file ?? "tests/a.test.ts";
    const t: TestCase = {
      id: await testId(file, c.name),
      file,
      name: c.name,
      requirements: c.requirements ?? [],
      risk: c.risk ?? "not-high",
      ...(c.characteristic === undefined ? {} : { characteristic: c.characteristic }),
      start: end - 5n * NS + BigInt(i) * 1_000_000n,
      end: end - 5n * NS + BigInt(i) * 1_000_000n + 12_000_000n,
      outcome: c.outcome ?? "pass",
      ...(c.reason === undefined ? {} : { reason: c.reason }),
      ...(c.message === undefined ? {} : { message: c.message }),
      attempt: 1,
    };
    const ctx = { traceId, spanId: spanOf(n * 1000 + 1 + i), parentSpanId: runSpan };
    spans.push(testCaseSpan(t, ctx));
    records.push(testCaseLog(t, ctx));
  }
  const runner = installation(options.revision);
  const resource = installationResource(runner);
  const assembled = assembleRecord({
    traceId,
    spanId: runSpan,
    start: end - 6n * NS,
    end,
    runner,
    signals: { traces: [{ resource, scope: TEST_SCOPE, spans }], logs: [{ resource, scope: TEST_SCOPE, records }] },
    runners: [{ kind: "exited", runtime: "bun", code: cases.some((c) => c.outcome === "fail") ? 1 : 0 }],
    required: options.required ?? [],
  });
  assert(assembled.kind === "ok", "the run assembles");
  return assembled.value.record;
}

/** git in `repo`, failing the test where it fails; the committer comes from the repository's own configuration. */
export async function git(repo: string, ...args: string[]): Promise<string> {
  const r = await run(["git", "-C", repo, ...args], { env: { GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" } });
  assert(r.success, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A repository with one commit and a committer, in `dir`; the commit's id. */
export async function repositoryWithCommit(dir: string): Promise<string> {
  await git(dir, "init", "-q", "-b", "main");
  await git(dir, "config", "user.name", "ci");
  await git(dir, "config", "user.email", "ci@example.com");
  await git(dir, "config", "commit.gpgsign", "false");
  await git(dir, "config", "core.autocrlf", "false");
  await writeTextFile(join(dir, "a.txt"), "one\n");
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "first");
  return git(dir, "rev-parse", "HEAD");
}

/** Another commit on the repository's branch; its id. */
export async function nextCommit(dir: string, name: string): Promise<string> {
  await writeTextFile(join(dir, name), `${name}\n`);
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", name);
  return git(dir, "rev-parse", "HEAD");
}

/**
 * An SSH key made by `ssh-keygen`, the repository set to sign with it, and an allowed-signers file naming it for the committer `ci`: Git
 * signs and verifies as it does for a harness. The file's path is returned.
 */
export async function sshSigning(repo: string, keyDir: string): Promise<string> {
  const key = join(keyDir, "signing");
  const made = await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "ci", "-f", key]);
  assert(made.success, `ssh-keygen: ${made.stderr}`);
  await git(repo, "config", "gpg.format", "ssh");
  await git(repo, "config", "gpg.ssh.program", "ssh-keygen");
  await git(repo, "config", "user.signingkey", `${key}.pub`);
  const pub = (await readTextFile(`${key}.pub`)).trim();
  const allowed = join(keyDir, "allowed_signers");
  await writeTextFile(allowed, `ci@example.com namespaces="git" ${pub}\n`);
  return allowed;
}

/** JSON text as a value nothing is known of: what a test reads is looked at with `at` and `list`, never taken for a type. */
export function parsed(text: string): unknown {
  return JSON.parse(text);
}

/** What lies at a path of keys and indexes in a parsed value, or nothing. */
export function at(value: unknown, ...path: readonly (string | number)[]): unknown {
  let v: unknown = value;
  for (const step of path) {
    if (typeof step === "number") v = Array.isArray(v) ? (v as readonly unknown[])[step] : undefined;
    else v = typeof v === "object" && v !== null && !Array.isArray(v) ? Object.entries(v).find(([k]) => k === step)?.[1] : undefined;
  }
  return v;
}

/** A parsed value as a list, empty where it is not one. */
export function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as readonly unknown[]) : [];
}
