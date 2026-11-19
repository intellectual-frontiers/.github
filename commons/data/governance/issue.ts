// Spec: 0044-issues FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * Issues as typed code (commons data 0044-issues): a known weakness of a library or a module is a value of the type `Issue`, not a line in a document, so that it is checked, cannot be silently
 * dropped and cannot be called fixed without a proof. A status is a sum: one that is fixed carries its proof, one that is a duplicate names the issue it duplicates, one that will not be fixed
 * carries its reason; a status that lacks what it needs does not compile. A set of issues is checked as a whole (numbers, references, which engines an issue is about), and two versions of a set
 * are checked against each other, so that an issue does not move along a path the state machine does not allow.
 *
 * @remarks
 * Pure: it names no file and no database. `appliesTo` says which engines a weakness is about, so that an engine that cannot do what is missing is not charged with it (0043-sql-invariants FR-006).
 *
 * @module
 */

/** How bad an issue is, for what the library promises. */
export type IssueSeverity = "critical" | "high" | "medium" | "low";
/** When it is to be done: P1 before the next release, P2 the one after, P3 when it is convenient. */
export type IssuePriority = "P1" | "P2" | "P3";
/** What the library is meant to be: the goals the issues are held against. */
export type IssueGoal = "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7" | "G8";
/** How much work the fix is. */
export type IssueSize = "xs" | "s" | "m" | "l" | "xl";

/** Something that shows what an issue says: a commit, a test, a specification, a place in a file, a review. */
export type Evidence =
  | { readonly kind: "commit"; readonly sha: string }
  | { readonly kind: "test"; readonly file: string; readonly name: string }
  | { readonly kind: "spec"; readonly id: string }
  | { readonly kind: "file"; readonly path: string; readonly line?: number }
  | { readonly kind: "review"; readonly source: string };

/** Which engines an issue is about: all of them, or only those that could do better (an engine that cannot is not charged). */
export type AppliesTo = { readonly engines: "all" } | { readonly engines: readonly [string, ...string[]] };

/** Where an issue is: a sum, each case carrying what it needs. */
export type Status =
  | { readonly kind: "open" }
  | { readonly kind: "in-progress"; readonly by?: string }
  | { readonly kind: "fixed"; readonly proof: readonly [Evidence, ...Evidence[]] }
  | { readonly kind: "wont-fix"; readonly reason: string }
  | { readonly kind: "not-a-defect"; readonly reason: string }
  | { readonly kind: "duplicate"; readonly of: number }
  | { readonly kind: "deferred"; readonly reason: string; readonly until?: string };

/** The kind of a status. */
export type StatusKind = Status["kind"];

/** How two issues of a set are related. */
export type Link = { readonly kind: "blocks" | "relates" | "caused-by"; readonly to: number };

/** What an issue is made from. */
export interface IssueSpec {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly severity: IssueSeverity;
  readonly priority: IssuePriority;
  readonly goals: readonly IssueGoal[];
  readonly appliesTo: AppliesTo;
  readonly status: Status;
  readonly size: IssueSize;
  /** The requirements of a specification it is about, as `0043-sql-invariants FR-002`. */
  readonly cites?: readonly string[];
  readonly evidence?: readonly Evidence[];
  readonly links?: readonly Link[];
  /** When it was raised, as `2026-11-19`. */
  readonly raised: string;
}

/** An issue: frozen, made by `issue`. */
export type Issue = Readonly<IssueSpec>;

/** The issues of one library or module: its scope (its path) and its issues in order of number. */
export interface IssueSet {
  readonly scope: string;
  readonly issues: readonly Issue[];
}

/** Makes an issue; it is frozen, as are its parts. */
export function issue(spec: IssueSpec): Issue {
  const links = spec.links === undefined ? undefined : Object.freeze(spec.links.map((l) => Object.freeze({ ...l })));
  return Object.freeze({
    ...spec,
    goals: Object.freeze([...spec.goals]),
    status: Object.freeze({ ...spec.status }),
    ...(spec.cites === undefined ? {} : { cites: Object.freeze([...spec.cites]) }),
    ...(spec.evidence === undefined ? {} : { evidence: Object.freeze(spec.evidence.map((e) => Object.freeze({ ...e }))) }),
    ...(links === undefined ? {} : { links }),
  });
}

/** Makes the set of a scope. */
export function issueSet(scope: string, issues: readonly Issue[]): IssueSet {
  return Object.freeze({ scope, issues: Object.freeze([...issues]) });
}

const ALL: readonly StatusKind[] = ["open", "in-progress", "fixed", "wont-fix", "not-a-defect", "duplicate", "deferred"];
/** Where each status may go. A finished issue can only be reopened; nothing is deleted, so an issue is never lost. */
export const MOVES: Readonly<Record<StatusKind, readonly StatusKind[]>> = {
  open: ["in-progress", "fixed", "wont-fix", "not-a-defect", "duplicate", "deferred"],
  "in-progress": ["open", "fixed", "wont-fix", "not-a-defect", "duplicate", "deferred"],
  fixed: ["open"],
  "wont-fix": ["open"],
  "not-a-defect": ["open"],
  duplicate: ["open"],
  deferred: ["open", "in-progress", "fixed", "wont-fix", "not-a-defect", "duplicate"],
};

/** Whether an issue may go from one status to another. */
export const canMove = (from: StatusKind, to: StatusKind): boolean => from === to || MOVES[from].includes(to);

/** Whether an issue is still to be done. */
export const isLive = (s: Status): boolean => s.kind === "open" || s.kind === "in-progress" || s.kind === "deferred";

/** The rules of the checks of issues. */
export type IssueRule =
  | "issue/number"
  | "issue/slug"
  | "issue/date"
  | "issue/priority"
  | "issue/engines"
  | "issue/goals"
  | "issue/proof"
  | "issue/reason"
  | "issue/duplicate"
  | "issue/link"
  | "issue/cite"
  | "issue/lost"
  | "issue/move"
  | "issue/reused";

/** A finding of the checks of issues. */
export interface IssueFinding {
  readonly rule: IssueRule;
  readonly scope: string;
  readonly id: number;
  readonly message: string;
}

const SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GOALS: readonly IssueGoal[] = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"];

/**
 * The findings of one set: numbers from 1 with no gap, a slug in words, a date, a priority that fits the severity (a critical issue is P1, a low one is never P1), engines that are named, a fixed issue with
 * a proof, a reason where one is owed, a duplicate that names an issue that exists and is not itself a duplicate, and links and citations that resolve.
 */
export function checkIssueSet(set: IssueSet): readonly IssueFinding[] {
  const out: IssueFinding[] = [];
  const at = (rule: IssueRule, id: number, message: string): void => void out.push({ rule, scope: set.scope, id, message });
  const byId = new Map<number, Issue>();
  set.issues.forEach((i, n) => {
    if (i.id !== n + 1) at("issue/number", i.id, `the issue at place ${n + 1} is numbered ${i.id}: numbers run from 1 with none missed and none repeated`);
    if (byId.has(i.id)) at("issue/reused", i.id, "its number is used twice");
    byId.set(i.id, i);
  });
  for (const i of set.issues) {
    if (!SLUG.test(i.slug)) at("issue/slug", i.id, `the slug ${JSON.stringify(i.slug)} is not words joined by hyphens`);
    if (!DATE.test(i.raised)) at("issue/date", i.id, `raised ${JSON.stringify(i.raised)} is not a date as 2026-11-19`);
    if (i.severity === "critical" && i.priority !== "P1") at("issue/priority", i.id, "a critical issue is P1");
    if (i.severity === "low" && i.priority === "P1") at("issue/priority", i.id, "a low issue is never P1");
    if (i.appliesTo.engines !== "all" && (i.appliesTo.engines.length === 0 || i.appliesTo.engines.some((e) => e.trim() === "")))
      at("issue/engines", i.id, "name the engines it is about, or say all");
    if (i.goals.length === 0 || i.goals.some((g) => !GOALS.includes(g))) at("issue/goals", i.id, "it serves at least one goal, G1 to G8");
    const s = i.status;
    if (s.kind === "fixed" && (s.proof.length === 0 || s.proof.some((p) => p.kind === "review")))
      at("issue/proof", i.id, "fixed needs a proof that is a commit, a test, a specification or a place in a file: a review is a claim, not a proof");
    if ((s.kind === "wont-fix" || s.kind === "not-a-defect" || s.kind === "deferred") && s.reason.trim() === "") at("issue/reason", i.id, `${s.kind} needs its reason`);
    if (s.kind === "duplicate") {
      const t = byId.get(s.of);
      if (t === undefined || s.of === i.id) at("issue/duplicate", i.id, `it is a duplicate of ${s.of}, which is not another issue of the set`);
      else if (t.status.kind === "duplicate") at("issue/duplicate", i.id, `it is a duplicate of ${s.of}, which is itself a duplicate: name the first`);
    }
    for (const l of i.links ?? []) if (!byId.has(l.to) || l.to === i.id) at("issue/link", i.id, `it links to ${l.to}, which is not another issue of the set`);
    for (const c of i.cites ?? []) if (!/^\d{4}-[a-z0-9-]+ FR-\d{3}$/.test(c)) at("issue/cite", i.id, `${JSON.stringify(c)} is not a requirement as 0043-invariants FR-002`);
  }
  return out;
}

/**
 * The findings of a set against the version before it: an issue is never taken out (close it instead), its number and slug never change, and its status moves only along `MOVES`.
 * It is what keeps an issue from being lost.
 */
export function checkIssueMoves(before: IssueSet, after: IssueSet): readonly IssueFinding[] {
  const out: IssueFinding[] = [];
  const now = new Map(after.issues.map((i) => [i.id, i]));
  for (const b of before.issues) {
    const a = now.get(b.id);
    if (a === undefined) {
      out.push({ rule: "issue/lost", scope: after.scope, id: b.id, message: `issue ${b.id} (${b.slug}) is gone: close it instead of taking it out` });
      continue;
    }
    if (a.slug !== b.slug) out.push({ rule: "issue/lost", scope: after.scope, id: b.id, message: `issue ${b.id} was ${b.slug} and is now ${a.slug}: a number names one issue` });
    if (!canMove(b.status.kind, a.status.kind))
      out.push({ rule: "issue/move", scope: after.scope, id: b.id, message: `issue ${b.id} went from ${b.status.kind} to ${a.status.kind}, which is not a move: ${MOVES[b.status.kind].join(", ")}` });
  }
  return out;
}

/** The issues of a set that are still to be done, most pressing first (priority, then severity, then number). */
export function liveIssues(set: IssueSet): readonly Issue[] {
  const sev: Readonly<Record<IssueSeverity, number>> = { critical: 0, high: 1, medium: 2, low: 3 };
  return set.issues
    .filter((i) => isLive(i.status))
    .toSorted((a, b) => a.priority.localeCompare(b.priority) || sev[a.severity] - sev[b.severity] || a.id - b.id);
}

/** Every kind of status, for tests and for the database's code list. */
export const STATUS_KINDS: readonly StatusKind[] = ALL;
