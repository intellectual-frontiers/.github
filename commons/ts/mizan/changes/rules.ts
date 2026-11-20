/**
 * The findings of the `changes` check (commons 0020-ifccm FR-005 to FR-012, FR-019, FR-020, FR-032, FR-033) as Mizan findings: the same shape as the rules of `mizan/rules.ts`, so that a harness holds
 * them with `holdHarness` and a baseline that only shrinks, each with the phase it was found in (`warn` or `gate`).
 *
 * @remarks
 * Pure functions over data: the commits of a range (as `git-log.ts` reads them), the harness's declaration, Decisions and roles, the day, and, for the strict rules, what the host said of each
 * change request (as `strict.ts` asked it). A finding's key is its rule and the revision (never a line), so that a baseline holds one commit by its revision and a new commit is a new finding.
 *
 * @limits
 * It judges the words of a message and a body, not whether the work done is what the issue asked.
 *
 * @example
 * ```ts
 * import { commitFindings } from "./rules.ts";
 * const day = "2026-11-17" as never;
 * commitFindings([{ sha: "a".repeat(40), parents: [], message: "Fix it\n", authorName: "A", authorEmail: "a@example.com", day }], { phase: "warn", decisions: [], roles: {} });
 * // one finding: changes/no-issue
 * ```
 *
 * @module
 */
import type { IssueInfo } from "@intellectual-frontiers/githost/types";
import type { Keyed } from "../../kernel/trace.ts";
import { namedIssues, parseMessage, type ParsedMessage } from "./commit-message.ts";
import {
  type DecisionRecord,
  type Day,
  type Declaration,
  covers,
  declarationProblem,
  isRegulated,
  type Phase,
  type Relaxation,
} from "./declaration.ts";
import { parseIssueBody, sectionProblems, unticked } from "./issue-body.ts";

/** The ids of the rules of the `changes` check (0020-ifccm FR-032, FR-033). */
export type ChangesRule =
  | "changes/no-issue"
  | "changes/closing-keyword"
  | "changes/unknown-issue"
  | "changes/closed-issue"
  | "changes/gate-relaxed"
  | "changes/early-close"
  | "changes/issue-shape"
  | "changes/no-decision"
  | "changes/self-approved"
  | "changes/declaration";

/** Every rule, in the order the report lists them. */
export const CHANGES_RULES: readonly ChangesRule[] = [
  "changes/no-issue",
  "changes/closing-keyword",
  "changes/unknown-issue",
  "changes/closed-issue",
  "changes/gate-relaxed",
  "changes/early-close",
  "changes/issue-shape",
  "changes/no-decision",
  "changes/self-approved",
  "changes/declaration",
];

/** The rules that need the host (`--strict`, 0020-ifccm FR-009). */
export const STRICT_RULES: readonly ChangesRule[] = [
  "changes/unknown-issue",
  "changes/closed-issue",
  "changes/early-close",
  "changes/issue-shape",
];

/** A finding of the `changes` check: a Mizan finding with the phase it was found in. */
export type ChangesFinding = Keyed & { readonly rule: ChangesRule; readonly severity: Phase };

/** A commit as the rules read it. */
export type CommitFacts = {
  readonly sha: string;
  readonly parents: readonly string[];
  readonly message: string;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly day: Day;
};

/** What the rules need beyond the commits. */
export type Context = {
  readonly phase: Phase;
  readonly declaration?: Declaration;
  readonly decisions: readonly DecisionRecord[];
  /** The role of each author, by email. */
  readonly roles: Readonly<Record<string, string>>;
};

const short = (sha: string): string => sha.slice(0, 12);

function found(rule: ChangesRule, severity: Phase, sha: string, message: string, about?: string): ChangesFinding {
  const file = `commit:${short(sha)}`;
  return {
    file,
    line: 1,
    rule,
    severity,
    message: `${short(sha)}: ${message}`,
    key: about === undefined ? `${rule} ${sha}` : `${rule} ${sha} ${about}`,
  };
}

/** Whether a commit names a change request, by a line or by a closing word. */
function names(m: ParsedMessage): boolean {
  return namedIssues(m).length > 0;
}

/** Whether a merge commit only joins commits that each name a change request (0020-ifccm FR-007): a parent outside the range was judged where it was made. */
function isJoin(c: CommitFacts, bySha: ReadonlyMap<string, CommitFacts>): boolean {
  if (c.parents.length < 2) return false;
  return c.parents.every((p) => {
    const parent = bySha.get(p);
    return parent === undefined || names(parseMessage(parent.message)) || isJoin(parent, bySha);
  });
}

/** The offline findings of a range of commits: no issue, a closing word other than `Closes`, a departure with no Decision, and a Decision approved by the author where a regulated domain is claimed. */
export function commitFindings(commits: readonly CommitFacts[], ctx: Context): readonly ChangesFinding[] {
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  const out: ChangesFinding[] = [];
  for (const c of commits) {
    const m = parseMessage(c.message);
    if (!names(m) && !isJoin(c, bySha))
      out.push(
        found(
          "changes/no-issue",
          ctx.phase,
          c.sha,
          `the commit "${c.message.split("\n")[0]?.slice(0, 60) ?? ""}" names no change request (a line of its own: Refs #N or Closes #N)`,
        ),
      );
    for (const w of m.wrongWords)
      out.push(
        found(
          "changes/closing-keyword",
          ctx.phase,
          c.sha,
          `"${w.word} ${w.repo ?? ""}#${w.number}" closes the change request on the host; only Closes #N on the commit that finishes it may`,
          `${w.word.toLowerCase()} ${w.repo ?? ""}#${w.number}`,
        ),
      );
    const authorized = new Map(ctx.decisions.filter((d) => m.decisions.includes(d.id)).map((d) => [d.id, d]));
    for (const id of m.decisions)
      if (!authorized.has(id))
        out.push(
          found("changes/no-decision", ctx.phase, c.sha, `it names the Decision ${id}, which the harness does not record`, `unknown ${id}`),
        );
    for (const req of m.departs) {
      if ([...authorized.values()].some((d) => covers(d, req))) continue;
      out.push(
        found(
          "changes/no-decision",
          ctx.phase,
          c.sha,
          `it departs from ${req} and no Decision it names covers it (a comment, label or state of an issue authorizes nothing)`,
          req,
        ),
      );
    }
    if (isRegulated(ctx.declaration))
      for (const d of authorized.values()) {
        const role = ctx.roles[c.authorEmail];
        if (role === undefined)
          out.push(
            found(
              "changes/self-approved",
              ctx.phase,
              c.sha,
              `the role of its author is not recorded, so that ${d.id} cannot be shown to be approved by another role`,
              `${d.id} no-role`,
            ),
          );
        else if (role === d.approvedBy)
          out.push(
            found(
              "changes/self-approved",
              ctx.phase,
              c.sha,
              `${d.id} is approved by the role ${role}, which is the role of the commit's author: nothing authorizes itself`,
              d.id,
            ),
          );
      }
  }
  return out;
}

/** The finding of a declaration that is wrong by itself (0020-ifccm FR-010): refused at once, so it is a gate whatever the day. */
export function declarationFindings(declaration: Declaration | undefined, file: string): readonly ChangesFinding[] {
  const problem = declarationProblem(declaration);
  return problem === undefined
    ? []
    : [{ file, line: 1, rule: "changes/declaration", severity: "gate", message: problem, key: `changes/declaration ${file}` }];
}

/** The findings of relaxations found in a declaration's history, none where a Decision covers `gate-relaxed <revision>` (0020-ifccm FR-012). */
export function relaxationFindings(
  relaxed: readonly Relaxation[],
  decisions: readonly DecisionRecord[],
  phase: Phase,
  file: string,
): readonly ChangesFinding[] {
  return relaxed
    .filter((r) => !decisions.some((d) => covers(d, `gate-relaxed ${r.revision}`)))
    .map((r) => ({
      file,
      line: 1,
      rule: "changes/gate-relaxed" as const,
      severity: phase,
      message: `${short(r.revision)}: ${r.detail}; only a Decision that covers "gate-relaxed ${short(r.revision)}" clears it`,
      key: `changes/gate-relaxed ${r.revision} ${r.how}`,
    }));
}

/** What the host said of one change request, as `strict.ts` asked it. */
export type IssueAnswer =
  | { readonly kind: "found"; readonly issue: IssueInfo }
  | { readonly kind: "missing" }
  | { readonly kind: "not_run"; readonly reason: string };

/** The label that marks a capability's change request: a provisional reading of how its kind is known (0020-ifccm OQ-3). */
export const CAPABILITY_LABEL = "capability";

/**
 * The strict findings (0020-ifccm FR-006, FR-009): a change request that does not exist, a `Refs` on one already closed, a `Closes` on one whose checkbox items are not all ticked, and a `Closes` on a
 * capability whose sections are missing or out of order, (0020-ifccm FR-003). `answers` is keyed by `owner/repo#N` or `#N` as `namedIssues` writes it; a reference with no answer, or a `not_run`, is judged by no rule.
 */
export function strictFindings(
  commits: readonly CommitFacts[],
  answers: ReadonlyMap<string, IssueAnswer>,
  phase: Phase,
): readonly ChangesFinding[] {
  const out: ChangesFinding[] = [];
  for (const c of commits) {
    const m = parseMessage(c.message);
    const each = [
      ...m.refs.map((r) => ({ kind: r.kind, repo: r.repo, number: r.number })),
      ...m.wrongWords.map((w) => ({ kind: "wrong" as const, repo: w.repo, number: w.number })),
    ];
    for (const r of each) {
      const id = `${r.repo ?? ""}#${r.number}`;
      const a = answers.get(id);
      if (a === undefined || a.kind === "not_run") continue;
      if (a.kind === "missing") {
        out.push(found("changes/unknown-issue", phase, c.sha, `${id} does not exist on the host`, id));
        continue;
      }
      if (r.kind === "refs" && a.issue.state === "closed")
        out.push(found("changes/closed-issue", phase, c.sha, `Refs ${id} names a change request that is already closed`, id));
      if (r.kind !== "closes") continue;
      const body = parseIssueBody(a.issue.body);
      const open = unticked(body);
      if (open.length > 0)
        out.push(
          found(
            "changes/early-close",
            phase,
            c.sha,
            `Closes ${id}, but ${open.length} item${open.length === 1 ? " is" : "s are"} not ticked: "${open[0]?.text.slice(0, 50) ?? ""}"`,
            id,
          ),
        );
      if (a.issue.labels.includes(CAPABILITY_LABEL))
        for (const p of sectionProblems(body))
          out.push(
            found(
              "changes/issue-shape",
              phase,
              c.sha,
              p.kind === "missing"
                ? `Closes ${id}, a capability with no section "${p.name}"`
                : `Closes ${id}, a capability whose section "${p.name}" comes before "${p.before}"`,
              `${id} ${p.kind} ${p.name}`,
            ),
          );
    }
  }
  return out;
}

/** One rule's result as a case of the run (0020-ifccm FR-031): passed, failed with its findings, or not run with the reason. */
export type RuleCase =
  | { readonly rule: ChangesRule; readonly outcome: "pass" }
  | { readonly rule: ChangesRule; readonly outcome: "fail"; readonly findings: number }
  | { readonly rule: ChangesRule; readonly outcome: "not_run"; readonly reason: string };

/** The cases of a run: each rule's result, a strict rule `not_run` with `strictReason` where the host was not asked. */
export function ruleCases(findings: readonly ChangesFinding[], strictReason: string | undefined): readonly RuleCase[] {
  return CHANGES_RULES.map((rule): RuleCase => {
    if (strictReason !== undefined && STRICT_RULES.includes(rule)) return { rule, outcome: "not_run", reason: strictReason };
    const n = findings.filter((f) => f.rule === rule).length;
    return n === 0 ? { rule, outcome: "pass" } : { rule, outcome: "fail", findings: n };
  });
}
