// Spec: 0002-workspace-model FR-041
/**
 * The evidence of a run (commons 0002-workspace-model FR-041 to FR-043, 0001-ergonex FR-023): one record under `<home>/.ergonex/evidence/YYYY/MM/DD/`, in the shape of an IFQS test record
 * (`quality/`, 0021-ifqs), named by the run's UTC time and its trace identifier and never overwritten. Each rule that ran is a case that passed or, for each finding, a case that failed with its rule,
 * subject and message; a run that did not run its checks (a command line that does not fit) is a case that is `not_run` with its reason, never a pass.
 *
 * @remarks
 * The record names the command and its options, the hash of the plan, the hash of the state record, the version of each tool probed or installed, whether a setup run applied, and the exit status, as
 * attributes of its resource; it holds the findings' messages and never the content of a file or a credential (the record is redacted of secrets and e-mail addresses by the quality system's own
 * canonical form). Where the manifest names a regulated domain the version of every tool the run used is named.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseSpanId, parseTraceId, type SpanId, type TraceId, type Attributes } from "../platform/k-otel.ts";
import { mkdir } from "../platform/r-fs.ts";
import { build, runtimeName, runtimeVersion } from "../platform/r-proc.ts";
import { join } from "../platform/r-path.ts";
import { checkRun, type CheckRule } from "@intellectual-frontiers/commons/ts/quality";
import { writeOnce } from "@intellectual-frontiers/commons/ts/quality";
import type { Finding } from "../findings.ts";
import { type EvidenceFacts, type ExitStatus, exitCodeOf } from "../modules/types.ts";
import { ERGONEX_VERSION } from "../state-record.ts";
import { AREA, native, type Site } from "./workspace.ts";

/** What a run is recorded as. */
export type RunFacts = {
  /** The module and command, as the person typed them (`worktree create`, `plan`). */
  readonly command: string;
  /** The words after the command: its options and arguments. */
  readonly words: readonly string[];
  readonly status: ExitStatus;
  readonly findings: readonly Finding[];
  /** Why the run did not do its checks, where it did not (a usage failure). */
  readonly notRun?: string;
  readonly facts?: EvidenceFacts;
  /** The run's start and end, in nanoseconds since the Unix epoch (UTC). */
  readonly start: bigint;
  readonly end: bigint;
};

/** Why the record could not be written. */
export type EvidenceError =
  { readonly kind: "write"; readonly path: string; readonly reason: string } | { readonly kind: "record"; readonly reason: string };

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

/** `20261117T101500.123Z` (the UTC time to the millisecond) from nanoseconds since the epoch, so that the names of records are in the order of their runs. */
function stamp(nanos: bigint): string {
  return new Date(Number(nanos / 1_000_000n)).toISOString().replace(/[-:]/g, "");
}

/** The rules of a run: the rule of each finding with its findings, and `ergonex/<command>` as a pass where there is none; or, for a run that did not do its checks, that rule as not run. */
export function rulesOf(run: Pick<RunFacts, "command" | "findings" | "notRun">): readonly CheckRule[] {
  const id = `ergonex/${run.command.replaceAll(" ", "-")}`;
  if (run.notRun !== undefined) return [{ id, findings: [], notRun: run.notRun }];
  const byRule = new Map<string, { file: string; message: string }[]>();
  for (const f of run.findings) {
    const list = byRule.get(f.ruleId) ?? [];
    list.push({
      file: f.subject,
      message: `${f.severity.toLowerCase()}: ${f.message}`,
    });
    byRule.set(f.ruleId, list);
  }
  const rules: CheckRule[] = [...byRule.entries()].map(([ruleId, findings]) => ({ id: ruleId, findings }));
  return rules.length === 0 ? [{ id, findings: [] }] : rules;
}

/** The facts the resource of the record carries. */
export function resourceAttributes(run: RunFacts, regulated: boolean): Attributes {
  const attributes: Record<string, string | bigint | boolean | readonly string[]> = {
    "ergonex.version": ERGONEX_VERSION,
    "ergonex.command": run.command,
    "ergonex.options": [...run.words],
    "ergonex.exit.status": run.status,
    "ergonex.exit.code": BigInt(exitCodeOf(run.status)),
    "ergonex.regulated": regulated,
  };
  const f = run.facts;
  if (f?.planSha256 !== undefined) attributes["ergonex.plan.sha256"] = f.planSha256;
  if (f?.stateSha256 !== undefined) attributes["ergonex.state.sha256"] = f.stateSha256;
  if (f?.applied !== undefined) attributes["ergonex.applied"] = f.applied;
  for (const t of f?.tools ?? []) attributes[`ergonex.tool.${t.name}.version`] = t.version;
  return attributes;
}

/** Writes the record of a run under the root's evidence folder, and returns its path. Never overwrites: the name holds the run's time and a fresh identifier. */
export async function writeEvidence(site: Site, run: RunFacts, regulated: boolean): Promise<Result<string, EvidenceError>> {
  const rules = rulesOf(run);
  const cases = rules.reduce((n, r) => n + (r.notRun !== undefined ? 0 : Math.max(1, r.findings.length)), 0);
  const made = await checkRun({
    tool: "ergonex",
    rules,
    traceId: traceId(),
    spanId: spanId(),
    caseIds: Array.from({ length: cases }, spanId),
    start: run.start,
    end: run.end,
    runner: {
      runtime: runtimeName(),
      runtimeVersion: runtimeVersion(),
      os: build.os,
      arch: build.arch,
      role: "ergonex",
    },
    requirements: ["0002-workspace-model FR-041"],
    resourceAttributes: resourceAttributes(run, regulated),
  });
  if (made.kind === "err") return err({ kind: "record", reason: JSON.stringify(made.error) });
  const day = new Date(Number(run.end / 1_000_000n)).toISOString().slice(0, 10).split("-");
  const folder = native(site, `${AREA}/evidence/${day.join("/")}`);
  const file = join(folder, `${stamp(run.end)}-${made.value.record.traceId}.otlp.json`);
  try {
    await mkdir(folder, { recursive: true });
  } catch (e) {
    return err({
      kind: "write",
      path: folder,
      reason: e instanceof Error ? e.message : String(e),
    });
  }
  const written = await writeOnce(file, made.value.text);
  if (written.kind === "err")
    return err({
      kind: "write",
      path: file,
      reason: JSON.stringify(written.error),
    });
  return ok(file);
}
