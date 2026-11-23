// Spec: 0002-libraries-ci-findings FR-002
/**
 * The finding (commons 0038-build-policy FR-006 to FR-008): what a tool said about a module, as a typed record with an identity that is the same in the next run, the file a run keeps (`build-findings/1`), the status
 * derived from the runs of a history and from the acceptances, and the rules of an acceptance. Pure and dependency free, like `policy.ts`: the wrapper that writes the file runs in a cell before any package is installed.
 *
 * @remarks
 * The id of a finding is made from the tool, the code, the module, the file and the key, and never from the line, the run, the time or the message, so that a finding that moves is the same finding. A status is never written:
 * it is read from the runs. A finding of a module that did not run in the latest run keeps the status of the last run in which the module ran (a cell that did not run is not a cell that is clean).
 *
 * @example
 * ```ts
 * import { findingId } from "./findings.ts";
 * findingId({ tool: "tsc", code: "TS2322", module: "core", file: "src/a.ts", key: "x" }).startsWith("f-"); // true
 * ```
 *
 * @module
 */
import { createHash } from "node:crypto";
import { ACCEPTANCE_MAX_DAYS, APPROVERS, TOOLS, type Tool } from "./policy.ts";

/** The severities of a finding. */
export const SEVERITIES = ["error", "warning", "note"] as const;
/** A severity. */
export type Severity = (typeof SEVERITIES)[number];

/** Where a finding was read from. */
export type Evidence = { readonly run: string; readonly commit: string; readonly step: string; readonly logSha256: string };

/** One finding. */
export type Finding = {
  readonly id: string;
  readonly tool: Tool;
  readonly code: string;
  readonly module: string;
  readonly file?: string;
  readonly line?: number;
  readonly severity: Severity;
  readonly message: string;
  readonly key: string;
  readonly evidence: Evidence;
  readonly at: string;
};

/** Which Kanon check produced evidence. */
export type KanonCheck = "import" | "model";

/** How a step ended. */
export const OUTCOMES = ["ok", "findings", "tool-error", "timeout", "no-output"] as const;
/** An outcome. */
export type Outcome = (typeof OUTCOMES)[number];

/** What the file of a run says of one step: that it ran, for which module, and how it ended. */
export type StepRecord = { readonly id: string; readonly job: string; readonly module: string; readonly tool: Tool; readonly kanonCheck?: KanonCheck; readonly outcome: Outcome; readonly findings: number; readonly durationMs: number; readonly exitStatus?: number };

/** The run a file is of. */
export type RunInfo = { readonly id: string; readonly workflow: string; readonly commit: string; readonly at: string; readonly url?: string };

/** The file a run keeps (0038-build-policy FR-006, FR-012). */
export type FindingsFile = { readonly schema: "build-findings/1"; readonly run: RunInfo; readonly steps: readonly StepRecord[]; readonly findings: readonly Finding[] };

/** The identity of a finding: from the tool, the code, the module, the file and the key, and from nothing that changes between runs. */
export function findingId(p: { readonly tool: string; readonly code: string; readonly module: string; readonly file?: string; readonly key: string }): string {
  return `f-${createHash("sha256").update([p.tool, p.code, p.module, p.file ?? "", p.key].join("\u0000")).digest("hex").slice(0, 16)}`;
}

/** The SHA-256 of a text, as the evidence of a log. */
export const sha256Of = (text: string): string => createHash("sha256").update(text).digest("hex");

/** A finding made from what a parser read, with its id and its evidence. */
export function makeFinding(p: { readonly tool: Tool; readonly code: string; readonly module: string; readonly file?: string; readonly line?: number; readonly severity: Severity; readonly message: string; readonly key: string; readonly evidence: Evidence; readonly at: string }): Finding {
  return { id: findingId(p), ...p, message: p.message.replace(/\s+/g, " ").trim().slice(0, 500) };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v !== "";

/** A file read as a `FindingsFile`, or the sentence that says what is wrong with it. */
export function decodeFindingsFile(input: unknown): { readonly kind: "ok"; readonly value: FindingsFile } | { readonly kind: "err"; readonly error: string } {
  if (!isObject(input) || input["schema"] !== "build-findings/1") return { kind: "err", error: "not a findings file (schema build-findings/1)" };
  const run = input["run"];
  if (!isObject(run) || !text(run["id"]) || !text(run["workflow"]) || !text(run["commit"]) || !text(run["at"])) return { kind: "err", error: "run needs an id, a workflow, a commit and an instant" };
  if (!Array.isArray(input["steps"]) || !Array.isArray(input["findings"])) return { kind: "err", error: "steps and findings are lists" };
  for (const s of input["steps"] as unknown[]) {
    if (!isObject(s) || !text(s["id"]) || !text(s["job"]) || !text(s["module"]) || !TOOLS.includes(s["tool"] as Tool) || !OUTCOMES.includes(s["outcome"] as Outcome) || typeof s["findings"] !== "number" || typeof s["durationMs"] !== "number") return { kind: "err", error: "a step needs an id, a job, a module, a tool, an outcome, a count and a duration" };
  }
  for (const f of input["findings"] as unknown[]) {
    if (!isObject(f) || !text(f["id"]) || !TOOLS.includes(f["tool"] as Tool) || !text(f["code"]) || !text(f["module"]) || !SEVERITIES.includes(f["severity"] as Severity) || typeof f["message"] !== "string" || !text(f["key"]) || !isObject(f["evidence"]) || !text(f["at"])) return { kind: "err", error: "a finding needs an id, a tool, a code, a module, a severity, a message, a key, evidence and an instant" };
  }
  return { kind: "ok", value: input as unknown as FindingsFile };
}

/** A person's word that a risk has been seen, until a day (0038-build-policy FR-008). */
export type Acceptance = { readonly id: string; readonly owner: string; readonly reason: string; readonly from: string; readonly until: string; readonly by: string };

const DAY = /^\d{4}-\d\d-\d\d$/;
const days = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** What is wrong with an acceptance (none where it keeps the rules): a reason, an owner, days that are days, an end within the longest, an approver who is one of the list. */
export function acceptanceProblems(a: Acceptance, approvers: readonly string[] = APPROVERS): readonly string[] {
  const out: string[] = [];
  if (!text(a.id)) out.push("the finding's id is named");
  if (!text(a.owner)) out.push("an owner who answers for the risk is named");
  if (!text(a.reason) || a.reason.trim().length < 10) out.push("the reason is given in a sentence");
  if (!DAY.test(a.from) || !DAY.test(a.until)) out.push("`from` and `until` are days (YYYY-MM-DD)");
  else {
    if (a.until <= a.from) out.push("the acceptance ends after it begins");
    if (days(a.from, a.until) > ACCEPTANCE_MAX_DAYS) out.push(`the acceptance lasts at most ${ACCEPTANCE_MAX_DAYS} days`);
  }
  if (!approvers.includes(a.by)) out.push(`${a.by} is not an approver (${approvers.join(", ")}): an acceptance is a person's word and an agent never writes one`);
  return out;
}

/** The status of a finding, derived (0038-build-policy FR-007). */
export type Status = "open" | "fixed" | "accepted";

/** One finding with what the history says of it. */
export type Row = {
  readonly finding: Finding;
  readonly status: Status;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly runsSeen: number;
  /** A note the status carries: an acceptance that ended, or the run the finding was last seen in. */
  readonly note?: string;
  readonly acceptance?: Acceptance;
};

/** The Kanon check responsible for a diagnostic code. */
export function kanonCheckOf(code: string): KanonCheck {
  return code.startsWith("kanon/") ? "model" : "import";
}

/**
 * The rows of a history (oldest run first) on a day: every finding any run had, once, as it was in the run that last had it. A finding is `open` where the last run in which its module ran has it, `fixed` where that run
 * does not, and `accepted` where it is open and a live acceptance names it; an acceptance that has ended leaves it open with the note.
 */
export function deriveRows(history: readonly FindingsFile[], acceptances: readonly Acceptance[], today: string): readonly Row[] {
  const latestModuleRun = new Map<string, FindingsFile>();
  const latestCompletedKanonRun = new Map<string, FindingsFile>();
  for (const run of history) for (const step of run.steps) {
    latestModuleRun.set(step.module, run);
    if (step.tool === "kanon-check" && (step.outcome === "ok" || step.outcome === "findings"))
      latestCompletedKanonRun.set(`${step.module}/${step.kanonCheck ?? "import"}`, run);
  }
  const seen = new Map<string, { finding: Finding; first: string; last: string; count: number }>();
  for (const run of history) {
    for (const f of run.findings) {
      const e = seen.get(f.id);
      seen.set(f.id, { finding: f, first: e?.first ?? run.run.at, last: run.run.at, count: (e?.count ?? 0) + 1 });
    }
  }
  const rows: Row[] = [];
  for (const [id, e] of seen) {
    const decisive = e.finding.tool === "kanon-check"
      ? latestCompletedKanonRun.get(`${e.finding.module}/${kanonCheckOf(e.finding.code)}`)
      : latestModuleRun.get(e.finding.module);
    const present = decisive?.findings.some((f) => f.id === id) ?? true;
    const base = { finding: e.finding, firstSeen: e.first, lastSeen: e.last, runsSeen: e.count };
    if (!present) {
      rows.push({ ...base, status: "fixed" });
      continue;
    }
    const acceptance = acceptances.find((a) => a.id === id && acceptanceProblems(a).length === 0);
    if (acceptance === undefined) rows.push({ ...base, status: "open" });
    else if (acceptance.until >= today) rows.push({ ...base, status: "accepted", acceptance });
    else rows.push({ ...base, status: "open", note: `the acceptance of ${acceptance.owner} ended on ${acceptance.until}`, acceptance });
  }
  return rows.sort((a, b) => (a.finding.module + a.finding.tool + a.finding.code + a.finding.id < b.finding.module + b.finding.tool + b.finding.code + b.finding.id ? -1 : 1));
}

/** The counts a page and a status say: open, new since the run before, fixed in the latest run, accepted. */
export function countsOf(rows: readonly Row[], history: readonly FindingsFile[]): { readonly open: number; readonly fresh: number; readonly fixed: number; readonly accepted: number } {
  const latest = history[history.length - 1];
  const before = history[history.length - 2];
  const open = rows.filter((r) => r.status === "open").length;
  const accepted = rows.filter((r) => r.status === "accepted").length;
  const inBefore = new Set((before?.findings ?? []).map((f) => f.id));
  const fresh = rows.filter((r) => r.status !== "fixed" && (latest?.findings.some((f) => f.id === r.finding.id) ?? false) && !inBefore.has(r.finding.id)).length;
  const fixed = rows.filter((r) => r.status === "fixed" && (before?.findings.some((f) => f.id === r.finding.id) ?? false) && !(latest?.findings.some((f) => f.id === r.finding.id) ?? false)).length;
  return { open, fresh, fixed, accepted };
}
