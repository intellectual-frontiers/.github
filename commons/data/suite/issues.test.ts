// Spec: 0044-issues FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * Issues as typed code (commons data 0044-issues): an issue is a frozen value whose status carries what it needs; a set is checked as a whole and against the version before it; the files of every
 * `issues/` folder of the library are kept as they must be, every issue is what its file says, and the proof of a fixed issue resolves.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { canMove, checkIssueMoves, checkIssueSet, type Issue, issue, type IssueSet, issueSet, type IssueSpec, liveIssues, MOVES, STATUS_KINDS } from "@intellectual-frontiers/data/governance";
import { discover, folderFindings } from "../tools/issues.ts";
import { same } from "./governance-fixture.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const base: IssueSpec = {
  id: 1,
  slug: "a-weakness",
  title: "A weakness",
  summary: "What is wrong",
  severity: "medium",
  priority: "P2",
  goals: ["G1"],
  appliesTo: { engines: "all" },
  status: { kind: "open" },
  size: "s",
  raised: "2026-11-19",
};
const mk = (over: Partial<IssueSpec> = {}): Issue => issue({ ...base, ...over });
const rules = (set: IssueSet): string[] => checkIssueSet(set).map((f) => `${f.rule}:${f.id}`);

proves(["0044-issues FR-001"], "issues are typed values: frozen, and each status carries what it needs", () => {
  const i = mk({ status: { kind: "fixed", proof: [{ kind: "commit", sha: "abcdef1" }] }, links: [{ kind: "relates", to: 2 }], cites: ["0043-sql-invariants FR-002"] });
  assert(Object.isFrozen(i) && Object.isFrozen(i.status) && Object.isFrozen(i.goals) && Object.isFrozen(i.links) && Object.isFrozen(i.cites));
  same(STATUS_KINDS, ["open", "in-progress", "fixed", "wont-fix", "not-a-defect", "duplicate", "deferred"]);
  // what a status lacks is a compile error, which the compiler shows in the next lines: each is the one thing that must be given
  // @ts-expect-error a fixed issue has a proof
  mk({ status: { kind: "fixed" } });
  // @ts-expect-error a proof is not empty
  mk({ status: { kind: "fixed", proof: [] } });
  // @ts-expect-error a duplicate names its original
  mk({ status: { kind: "duplicate" } });
  // @ts-expect-error a wont-fix has its reason
  mk({ status: { kind: "wont-fix" } });
});

proves(["0044-issues FR-003"], "a set is checked: numbers in order, a slug, a date, a priority that fits the severity, engines, goals, a proof, a reason, a duplicate, links and citations", () => {
  same(rules(issueSet("s", [mk()])), []);
  same(rules(issueSet("s", [mk({ id: 2 })])), ["issue/number:2"]);
  same(rules(issueSet("s", [mk(), mk({ id: 1, slug: "b" })])).includes("issue/reused:1"), true);
  same(rules(issueSet("s", [mk({ slug: "Bad Slug", raised: "yesterday" })])), ["issue/slug:1", "issue/date:1"]);
  same(rules(issueSet("s", [mk({ severity: "critical", priority: "P2" })])), ["issue/priority:1"]);
  same(rules(issueSet("s", [mk({ severity: "low", priority: "P1" })])), ["issue/priority:1"]);
  same(rules(issueSet("s", [mk({ appliesTo: { engines: [" "] } })])), ["issue/engines:1"]);
  same(rules(issueSet("s", [mk({ goals: [] })])), ["issue/goals:1"]);
  same(rules(issueSet("s", [mk({ status: { kind: "fixed", proof: [{ kind: "review", source: "me" }] } })])), ["issue/proof:1"]);
  same(rules(issueSet("s", [mk({ status: { kind: "deferred", reason: " " } })])), ["issue/reason:1"]);
  same(rules(issueSet("s", [mk({ status: { kind: "duplicate", of: 9 } })])), ["issue/duplicate:1"]);
  same(rules(issueSet("s", [mk({ status: { kind: "duplicate", of: 1 } })])), ["issue/duplicate:1"]);
  const chain = issueSet("s", [mk(), mk({ id: 2, slug: "b", status: { kind: "duplicate", of: 1 } }), mk({ id: 3, slug: "c", status: { kind: "duplicate", of: 2 } })]);
  same(rules(chain), ["issue/duplicate:3"]);
  same(rules(issueSet("s", [mk({ links: [{ kind: "blocks", to: 4 }] })])), ["issue/link:1"]);
  same(rules(issueSet("s", [mk({ cites: ["0043 something"] })])), ["issue/cite:1"]);
});

proves(["0044-issues FR-004"], "an issue is never lost: taking one out, renaming it or a move the state machine does not allow is found against the version before", () => {
  const two = (a: Partial<IssueSpec>, b: Partial<IssueSpec> = {}): IssueSet => issueSet("s", [mk(a), mk({ id: 2, slug: "second", ...b })]);
  const before = two({});
  same(checkIssueMoves(before, two({ status: { kind: "in-progress" } })), []);
  same(checkIssueMoves(before, two({ status: { kind: "fixed", proof: [{ kind: "commit", sha: "abcdef1" }] } })), []);
  same(checkIssueMoves(before, issueSet("s", [mk()])).map((f) => f.rule), ["issue/lost"]);
  same(checkIssueMoves(before, two({ slug: "renamed" })).map((f) => f.rule), ["issue/lost"]);
  const fixed = two({ status: { kind: "fixed", proof: [{ kind: "commit", sha: "abcdef1" }] } });
  same(checkIssueMoves(fixed, two({ status: { kind: "in-progress" } })).map((f) => f.rule), ["issue/move"]);
  same(checkIssueMoves(fixed, two({})), [], "a fixed issue may be reopened");
  assert(STATUS_KINDS.every((k) => canMove(k, k)) && !canMove("fixed", "wont-fix") && canMove("deferred", "in-progress"));
  assert(Object.values(MOVES).every((to) => to.every((k) => STATUS_KINDS.includes(k))));
});

proves(["0044-issues FR-005"], "the issues still to be done are listed most pressing first, and a finished one is not listed", () => {
  const set = issueSet("s", [
    mk({ id: 1, slug: "a", priority: "P3", severity: "low" }),
    mk({ id: 2, slug: "b", priority: "P1", severity: "high" }),
    mk({ id: 3, slug: "c", priority: "P1", severity: "critical" }),
    mk({ id: 4, slug: "d", status: { kind: "wont-fix", reason: "no" } }),
    mk({ id: 5, slug: "e", priority: "P2", status: { kind: "deferred", reason: "later" } }),
  ]);
  same(liveIssues(set).map((i) => i.id), [3, 2, 5, 1]);
});

const resolves = (e: Issue["evidence"] extends readonly (infer E)[] | undefined ? E : never): string | undefined => {
  switch (e.kind) {
    case "file":
      return existsSync(join(ROOT, e.path)) ? undefined : `${e.path} does not exist`;
    case "test": {
      const p = join(ROOT, e.file);
      return existsSync(p) && readFileSync(p, "utf8").includes(e.name) ? undefined : `${e.file} has no test titled ${e.name}`;
    }
    case "spec":
      return existsSync(join(ROOT, "spec-kit/specs", e.id, "spec.md")) ? undefined : `no specification ${e.id}`;
    case "commit": {
      if (!/^[0-9a-f]{7,40}$/.test(e.sha)) return `${e.sha} is not a sha`;
      const shallow = spawnSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: ROOT, encoding: "utf8" });
      if (shallow.status !== 0 || shallow.stdout.trim() !== "false") return undefined;
      return spawnSync("git", ["cat-file", "-e", `${e.sha}^{commit}`], { cwd: ROOT }).status === 0 ? undefined : `${e.sha} is not a commit`;
    }
    case "review":
      return undefined;
  }
};

proves(["0044-issues FR-002", "0044-issues FR-006"], "every issues folder of the library is kept as it must be: its files named and listed, each issue what its file says, every set sound, and the proof of a fixed issue resolves", async () => {
  const folders = discover(ROOT);
  assert(folders.length >= 5 && folders.some((f) => f.dir === "issues"), "the library and its modules keep issues");
  const found: string[] = [];
  for (const f of folders) {
    found.push(...folderFindings(f));
    const mod = (await import(join(ROOT, f.dir, "mod.ts"))) as { issues?: IssueSet };
    const set = mod.issues;
    if (set === undefined) {
      found.push(`${f.dir}/mod.ts: it does not export issues`);
      continue;
    }
    if (set.scope !== f.scope) found.push(`${f.dir}/mod.ts: the scope is ${set.scope}, and the folder is of ${f.scope}`);
    if (set.issues.length !== f.files.length) found.push(`${f.dir}: ${f.files.length} files, ${set.issues.length} issues`);
    set.issues.forEach((i, n) => {
      const file = f.files[n] ?? "";
      if (file !== `${String(i.id).padStart(5, "0")}-${i.slug}.ts`) found.push(`${f.dir}/${file}: it holds issue ${i.id} ${i.slug}`);
      for (const e of [...(i.evidence ?? []), ...(i.status.kind === "fixed" ? i.status.proof : [])]) {
        const why = resolves(e);
        if (why !== undefined) found.push(`${f.dir}/${file}: ${why}`);
      }
    });
    found.push(...checkIssueSet(set).map((x) => `${f.dir}: ${x.rule} ${x.id} ${x.message}`));
  }
  same(found, []);
  // the folders of the library are the ones that exist
  assert(folders.every((f) => existsSync(join(ROOT, f.dir, "mod.ts"))));
  same(folderFindings({ dir: "x/issues", scope: "x", files: ["00002-a.ts", "bad.ts"], mod: 'import a from "./00002-a.ts"; import z from "./00009-z.ts";' }).length, 4);
});
