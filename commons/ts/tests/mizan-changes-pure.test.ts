/**
 * The pure core of the `changes` check (commons 0020-ifccm), tested on the text and the data it takes: the lines of a commit message, the sections and checkbox items of an issue body, the
 * declaration and its phase, the findings, the chain from an issue to a run, the view of capabilities by rung, and the wiring into `holdHarness`. Nothing here runs `git` or asks a host: that
 * is `mizan-changes-git.test.ts`. The answers of a host in the strict rules are plain values of the interface's own types (`githost/types.ts`), which is a description of a host, a thing outside
 * the code under test.
 *
 * @module
 */
import type { IssueInfo } from "../githost/types.ts";
import * as ifccm from "../../ontology/ifccm/mod.ts";
import { holdHarness } from "../mizan/harness.ts";
import { commitFindings, strictFindings, type CommitFacts, type Context, type IssueAnswer } from "../mizan/changes/rules.ts";
import { namedIssues, parseMessage } from "../mizan/changes/commit-message.ts";
import {
  doneWhenItems,
  doneWhenRequirements,
  parseIssueBody,
  requirementsIn,
  sectionProblems,
  unticked,
} from "../mizan/changes/issue-body.ts";
import {
  dayOf,
  decodeHarnessRecord,
  declarationProblem,
  type Declaration,
  type DeclarationVersion,
  phaseOf,
  relaxations,
  REGULATED_DOMAINS,
  rungsRequired,
} from "../mizan/changes/declaration.ts";
import { STAGES, firstBreak, traceLines, traceOf, type TraceInput } from "../mizan/changes/trace.ts";
import { BEGIN, END, decodeViewRecord, isProved, spliceView, viewIsCurrent, viewOf } from "../mizan/changes/capability-view.ts";
import { mkdirSync, readDirSync, readTextFileSync, withTempDir, writeTextFileSync } from "../runtime/fs.ts";
import { dirname, fromFileUrl, join, relative, resolve, toPosix } from "../runtime/path.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const CHANGES = resolve(HERE, "..", "mizan", "changes");

const day = (s: string) => {
  const d = dayOf(s);
  assert(d !== undefined, s);
  return d;
};

const SHA = (n: number): string => n.toString(16).padStart(40, "0");

function commit(n: number, message: string, over: Partial<CommitFacts> = {}): CommitFacts {
  return {
    sha: SHA(n),
    parents: n > 1 ? [SHA(n - 1)] : [],
    message,
    authorName: "Author",
    authorEmail: "author@example.com",
    day: day("2026-11-17"),
    ...over,
  };
}

const WARN: Context = { phase: "warn", decisions: [], roles: {} };

proves(
  ["0020-ifccm FR-005"],
  "a commit names a change request on a line of its own, as Refs or Closes, in this or another repository",
  () => {
    const m = parseMessage("Add the check\n\nBody text.\nRefs #10\ncloses intellectual-frontiers/.github#12\nRefs #14   \n");
    assertEquals(
      m.refs.map((r) => [r.kind, r.repo, r.number]),
      [
        ["refs", undefined, 10],
        ["closes", "intellectual-frontiers/.github", 12],
        ["refs", undefined, 14],
      ],
    );
    assertEquals(namedIssues(m), ["#10", "intellectual-frontiers/.github#12", "#14"]);
    // two issues on two lines serve both; Closes in prose is not a line of its own and is not read; a quoted line is not read
    const prose = parseMessage("The change that Closes #10 in prose.\n> Refs #11\nRefs#12\n");
    assertEquals(prose.refs, []);
    assertEquals(prose.wrongWords, []);
    assertEquals(
      parseMessage("Closes: #10\r\n").refs.map((r) => [r.kind, r.number]),
      [["closes", 10]],
    );
  },
);

proves(["0020-ifccm FR-008"], "the words a host reads as closing other than Closes are found wherever they stand", () => {
  const m = parseMessage("Fixes #10\nThis resolves #11 and also Closed #12 and Fix intellectual-frontiers/.github#13\n");
  assertEquals(
    m.wrongWords.map((w) => [w.word.toLowerCase(), w.repo, w.number]),
    [
      ["fixes", undefined, 10],
      ["resolves", undefined, 11],
      ["closed", undefined, 12],
      ["fix", "intellectual-frontiers/.github", 13],
    ],
  );
  const found = commitFindings([commit(1, "Fixes #10\n")], WARN);
  assertEquals(
    found.map((f) => f.rule),
    ["changes/closing-keyword"],
  );
  assertStringIncludes(found[0]?.message ?? "", "Closes #N on the commit that finishes it");
  // a commit that names its change request only by a wrong word is not also reported as naming none
  assertEquals(commitFindings([commit(1, "Refs #10\nCloses #10\n")], WARN), []);
});

proves(
  ["0020-ifccm FR-007", "0020-ifccm FR-011"],
  "a commit that names no change request is reported with its revision, a merge that joins named commits is not",
  () => {
    const a = commit(1, "One\n\nRefs #10\n");
    const b = commit(2, "Two\n\nRefs #12\n", { parents: [] });
    const merge = commit(3, "Merge branch 'b'\n", { parents: [a.sha, b.sha] });
    const none = commit(4, 'Revert "Two"\n', { parents: [merge.sha] });
    const found = commitFindings([a, b, merge, none], WARN);
    assertEquals(
      found.map((f) => [f.rule, f.severity, f.key]),
      [["changes/no-issue", "warn", `changes/no-issue ${none.sha}`]],
    );
    assertStringIncludes(found[0]?.message ?? "", none.sha.slice(0, 12));
    // a merge that joins a commit naming nothing is reported, and the gate phase is carried on the finding
    const bad = commit(5, "No issue\n", { parents: [] });
    const merge2 = commit(6, "Merge\n", { parents: [a.sha, bad.sha] });
    const gate = commitFindings([a, bad, merge2], { ...WARN, phase: "gate" });
    assertEquals(
      gate.map((f) => [f.key.split(" ")[1], f.severity]),
      [
        [bad.sha, "gate"],
        [merge2.sha, "gate"],
      ],
    );
  },
);

const BODY = `## Why

Because.

## Today

Nothing.

## Scope

- [x] the first step
- [ ] the second step

## Done when

- [x] 0020-ifccm FR-005, FR-007 to FR-009 by the check's tests
- [ ] 0020-ifccm FR-015 and the review
\`\`\`
- [ ] a line in a code block is not an item
\`\`\`
`;

proves(
  ["0020-ifccm FR-003", "0020-ifccm FR-004"],
  "a capability's body has its four sections in order, its checkbox items and the requirements of its Done when",
  () => {
    const body = parseIssueBody(BODY);
    assertEquals(
      body.sections.map((s) => s.name),
      ["Why", "Today", "Scope", "Done when"],
    );
    assertEquals(sectionProblems(body), []);
    assertEquals(
      body.items.map((i) => [i.checked, i.text.slice(0, 12)]),
      [
        [true, "the first st"],
        [false, "the second s"],
        [true, "0020-ifccm F"],
        [false, "0020-ifccm F"],
      ],
    );
    assertEquals(unticked(body).length, 2);
    assertEquals(doneWhenItems(body).length, 2);
    assertEquals(doneWhenRequirements(body), [
      "0020-ifccm FR-005",
      "0020-ifccm FR-007",
      "0020-ifccm FR-008",
      "0020-ifccm FR-009",
      "0020-ifccm FR-015",
    ]);
    assertEquals(requirementsIn("0016-ladder FR-003; 0020-ifccm FR-001 and FR-002"), [
      "0016-ladder FR-003",
      "0020-ifccm FR-001",
      "0020-ifccm FR-002",
    ]);
    // a body with a section missing and two out of order
    const bad = parseIssueBody("## Scope\n\nx\n\n## Why\n\ny\n\n## Done when\n\nz\n");
    assertEquals(sectionProblems(bad), [
      { kind: "missing", name: "Today" },
      { kind: "order", name: "Scope", before: "Why" },
    ]);
  },
);

const issue = (over: Partial<IssueInfo> = {}): IssueInfo => ({
  number: 10,
  title: "A capability",
  body: BODY,
  state: "open",
  url: "https://example.org/issues/10",
  parent: 5,
  children: [],
  labels: ["capability"],
  ...over,
});

proves(
  ["0020-ifccm FR-003", "0020-ifccm FR-006", "0020-ifccm FR-009"],
  "Closes is judged against the items and sections of the issue, and Refs against whether it exists and is open",
  () => {
    const closes = commit(1, "Finish\n\nCloses #10\n");
    const refs = commit(2, "More\n\nRefs #11\nRefs #999\n", { parents: [] });
    const answers = new Map<string, IssueAnswer>([
      ["#10", { kind: "found", issue: issue() }],
      ["#11", { kind: "found", issue: issue({ number: 11, state: "closed", body: "" }) }],
      ["#999", { kind: "missing" }],
    ]);
    const found = strictFindings([closes, refs], answers, "warn");
    assertEquals(
      found.map((f) => f.rule),
      ["changes/early-close", "changes/closed-issue", "changes/unknown-issue"],
    );
    assertStringIncludes(found[0]?.message ?? "", "2 items are not ticked");
    // a capability closed with every item ticked and its sections in order is clean; one with a section missing is not
    const ticked = BODY.replaceAll("[ ]", "[x]").replace(/```[\s\S]*```\n/, "");
    const clean = new Map<string, IssueAnswer>([["#10", { kind: "found", issue: issue({ body: ticked }) }]]);
    assertEquals(strictFindings([closes], clean, "warn"), []);
    const shape = new Map<string, IssueAnswer>([["#10", { kind: "found", issue: issue({ body: "## Why\n\n- [x] done\n" }) }]]);
    assertEquals(
      strictFindings([closes], shape, "warn").map((f) => f.rule),
      ["changes/issue-shape", "changes/issue-shape", "changes/issue-shape"],
    );
    // a capability with no parent is judged by no rule of its own, and one that is not a capability is not asked for sections
    const orphan = new Map<string, IssueAnswer>([["#10", { kind: "found", issue: { ...issue({ body: ticked }), parent: undefined } }]]);
    assertEquals(strictFindings([closes], orphan, "warn"), []);
    const problem = new Map<string, IssueAnswer>([
      ["#10", { kind: "found", issue: { ...issue({ body: "- [x] done\n" }), parent: undefined, labels: ["problem"] } }],
    ]);
    assertEquals(strictFindings([closes], problem, "warn"), []);
    // an answer that was not run judges nothing, and a reference with no answer judges nothing
    const unasked = new Map<string, IssueAnswer>([["#10", { kind: "not_run", reason: "unreachable" }]]);
    assertEquals(strictFindings([closes], unasked, "warn"), []);
  },
);

proves(
  ["0020-ifccm FR-010"],
  "a declaration is typed data: a regulated domain needs a production day, and the domains are the code list's",
  () => {
    assertEquals([...REGULATED_DOMAINS], Object.keys(ifccm.regulatedDomains));
    const ok = decodeHarnessRecord(
      'export const declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2027-01-01" };\n',
    );
    assertEquals(ok.kind, "ok");
    const bad = decodeHarnessRecord('export const declaration = { regulatedDomains: ["Medicine"] };\n');
    assertEquals(bad.kind, "err");
    const impossible = decodeHarnessRecord('export const declaration = { regulatedDomains: [], productionDeclaredOn: "2027-02-30" };\n');
    assertEquals(impossible.kind, "err");
    // a harness with no declaration is not regulated and not in production
    const none = decodeHarnessRecord("export const decisions = [];\n");
    assert(none.kind === "ok" && none.value.declaration === undefined);
    const noDay: Declaration = { regulatedDomains: ["DeviceQuality", "ElectronicRecords"] };
    assertStringIncludes(declarationProblem(noDay) ?? "", "DeviceQuality, ElectronicRecords");
    assertEquals(declarationProblem({ regulatedDomains: [] }), undefined);
    assertEquals(declarationProblem(undefined), undefined);
    // the file is read as data and never run
    const code = decodeHarnessRecord("export const declaration = { regulatedDomains: [(() => 1)()] };\n");
    assertEquals(code.kind, "err");
  },
);

proves(["0020-ifccm FR-011"], "findings warn before the declared day and gate from it, the day itself included", () => {
  const d: Declaration = { regulatedDomains: [], productionDeclaredOn: day("2027-01-01") };
  assertEquals(phaseOf(undefined, "2030-01-01"), "warn");
  assertEquals(phaseOf({ regulatedDomains: [] }, "2030-01-01"), "warn");
  assertEquals(phaseOf(d, "2026-12-31"), "warn");
  assertEquals(phaseOf(d, "2027-01-01"), "gate");
  assertEquals(phaseOf(d, "2027-06-01"), "gate");
});

proves(["0020-ifccm FR-013"], "the declaration decides the rungs 9 and 10 a regulated harness requires from the declared day", () => {
  const d: Declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: day("2027-01-01") };
  assertEquals(rungsRequired(d, "2026-12-31"), []);
  assertEquals(rungsRequired(d, "2027-01-01"), [9, 10]);
  assertEquals(rungsRequired({ regulatedDomains: [], productionDeclaredOn: day("2027-01-01") }, "2027-02-01"), []);
  assertEquals(rungsRequired(undefined, "2027-02-01"), []);
});

const version = (revision: string, at: string, declaration: Declaration | undefined): DeclarationVersion => ({
  revision,
  day: day(at),
  declaration,
});

proves(["0020-ifccm FR-012"], "a production day moved later after it passed, a day removed and a domain dropped are relaxations", () => {
  const was: Declaration = { regulatedDomains: ["DeviceQuality", "TrustServices"], productionDeclaredOn: day("2026-10-01") };
  const later: Declaration = { ...was, productionDeclaredOn: day("2026-12-01") };
  assertEquals(
    relaxations([version("a1", "2026-09-01", was), version("b2", "2026-11-17", later)]).map((r) => [r.revision, r.how]),
    [["b2", "day-moved-later"]],
  );
  // moved later before the day passed: not a relaxation
  assertEquals(relaxations([version("a1", "2026-09-01", was), version("b2", "2026-09-20", later)]), []);
  // the day removed after it passed, and a domain dropped
  const dropped: Declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: day("2026-10-01") };
  assertEquals(
    relaxations([
      version("a1", "2026-09-01", was),
      version("c3", "2026-10-02", { regulatedDomains: ["DeviceQuality", "TrustServices"] }),
    ]).map((r) => r.how),
    ["day-removed"],
  );
  assertEquals(
    relaxations([version("a1", "2026-09-01", was), version("d4", "2026-10-02", dropped)]).map((r) => r.how),
    ["domain-dropped"],
  );
  // a day moved earlier, a domain added, and the first version, are not
  assertEquals(
    relaxations([version("a1", "2026-09-01", was), version("e5", "2026-10-02", { ...was, productionDeclaredOn: day("2026-09-15") })]),
    [],
  );
  assertEquals(relaxations([version("a1", "2026-09-01", undefined), version("e5", "2026-10-02", was)]), []);
});

proves(
  ["0020-ifccm FR-019", "0020-ifccm FR-020"],
  "a departure needs a Decision that names it, and in a regulated harness one approved by a role other than the author's",
  () => {
    const departs = commit(1, "Change the rule\n\nRefs #10\nDeparts: 0020-ifccm FR-008, FR-009\nDecision: D-1\n");
    const decisions = [{ id: "D-1", approvedBy: "quality", covers: ["0020-ifccm FR-008", "0020-ifccm FR-009"] }];
    // an issue labelled "approved", a comment, a state: nothing is read as authority, so the departure with no Decision is found
    const none = commit(2, "Change it\n\nRefs #10\nDeparts: 0020-ifccm FR-008\n", { parents: [departs.sha] });
    const unknown = commit(3, "Change it\n\nRefs #10\nDecision: D-9\n", { parents: [none.sha] });
    const found = commitFindings([departs, none, unknown], { ...WARN, decisions });
    assertEquals(
      found.map((f) => [f.rule, f.key.split(" ").slice(2).join(" ")]),
      [
        ["changes/no-decision", "0020-ifccm FR-008"],
        ["changes/no-decision", "unknown D-9"],
      ],
    );
    assertStringIncludes(found[0]?.message ?? "", "authorizes nothing");
    // a Decision that covers only one of the two requirements leaves the other found
    const partial = commitFindings([departs], {
      ...WARN,
      decisions: [{ id: "D-1", approvedBy: "quality", covers: ["0020-ifccm FR-008"] }],
    });
    assertEquals(
      partial.map((f) => f.key.split(" ").slice(2).join(" ")),
      ["0020-ifccm FR-009"],
    );
    // not regulated: the approver may be the author's own role; regulated: refused, and refused where the author's role is not recorded
    const own = { ...WARN, decisions, roles: { "author@example.com": "quality" } };
    assertEquals(commitFindings([departs], own), []);
    const regulated: Declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: day("2027-01-01") };
    assertEquals(
      commitFindings([departs], { ...own, declaration: regulated }).map((f) => f.rule),
      ["changes/self-approved"],
    );
    assertEquals(commitFindings([departs], { ...own, declaration: regulated, roles: { "author@example.com": "engineer" } }), []);
    assertEquals(
      commitFindings([departs], { ...own, declaration: regulated, roles: {} }).map((f) => f.rule),
      ["changes/self-approved"],
    );
  },
);

const TRACE: TraceInput = {
  specs: [{ slug: "0020-ifccm", spec: "**Status:** Draft\n\n- **FR-005**: It MUST.\n- **FR-006**: It MUST.\n- **FR-007**: It MUST.\n" }],
  terms: [{ term: "ifccm:IssueReferenceKind", cites: ["0020-ifccm FR-005", "0020-ifccm FR-006"], file: "x" }],
  sources: [{ path: "a.ts", text: "// Spec: 0020-ifccm FR-005, FR-006\n" }],
  tests: [{ path: "a.test.ts", text: 'proves(["0020-ifccm FR-005"], "x", () => {});\n' }],
  cases: [{ requirements: ["0020-ifccm FR-005"], outcome: "pass" }],
};

proves(["0020-ifccm FR-014", "0020-ifccm FR-015"], "the chain of a requirement ends at the first stage with no link", () => {
  assertEquals([...STAGES], Object.keys(ifccm.traceStages));
  const whole = traceOf("0020-ifccm FR-005", TRACE);
  assertEquals(firstBreak(whole), undefined);
  assertEquals(
    whole.stages.map((s) => s.stage),
    [...STAGES],
  );
  // a term and code but no test: the chain ends at the test
  const noTest = traceOf("0020-ifccm FR-006", TRACE);
  assertEquals(firstBreak(noTest), "StageTest");
  assertEquals(
    noTest.stages.filter((s) => s.linked).map((s) => s.stage),
    ["StageIssue", "StageRequirement", "StageTerm", "StageCode"],
  );
  // no term: ends at the term, though code could exist; a requirement the specification lacks ends at the requirement
  assertEquals(firstBreak(traceOf("0020-ifccm FR-007", TRACE)), "StageTerm");
  assertEquals(firstBreak(traceOf("0020-ifccm FR-099", TRACE)), "StageRequirement");
  // a test that passes in no run, or fails in one, ends at the run
  const unrun = { ...TRACE, cases: [] };
  assertEquals(firstBreak(traceOf("0020-ifccm FR-005", unrun)), "StageRun");
  assertEquals(
    firstBreak(
      traceOf("0020-ifccm FR-005", { ...TRACE, cases: [{ requirements: ["0020-ifccm FR-005"], outcome: "fail" }, ...TRACE.cases] }),
    ),
    "StageRun",
  );
  // a range in a citation links every requirement it spans
  const range = { ...TRACE, sources: [{ path: "b.ts", text: "// Spec: 0020-ifccm FR-005 to FR-007\n" }] };
  assertEquals(traceOf("0020-ifccm FR-006", range).stages.find((s) => s.stage === "StageCode")?.linked, true);
  assertEquals(traceLines([noTest]), ["0020-ifccm FR-006: ends at StageTest (StageIssue > StageRequirement > StageTerm > StageCode)"]);
});

const RUNGS = [
  { id: "rung-5", label: "Checks", provedBy: ["bun test", "bun check"] },
  { id: "rung-6", label: "Docs", provedBy: [] },
  { id: "rung-7", label: "Untouched", provedBy: ["x"] },
];
const CAPS = [
  { id: 12, title: "Second", touchesRung: ["rung-5", "rung-6"], lastRevision: "bbbbbbbcccc" },
  { id: 10, title: "First", touchesRung: ["rung-5"], lastRevision: "aaaaaaaffff" },
];

proves(
  ["0020-ifccm FR-016", "0020-ifccm FR-017"],
  "the view lists the capabilities that touch each rung, open where the rung's commands have no passing run at the last revision, and its check fails where the document differs",
  () => {
    const runs = [
      { command: "bun test", revision: "aaaaaaaffff", passed: true },
      { command: "bun check", revision: "aaaaaaaffff", passed: true },
      { command: "bun test", revision: "bbbbbbbcccc", passed: true },
      { command: "bun check", revision: "bbbbbbbcccc", passed: false },
    ];
    const view = viewOf(RUNGS, CAPS, runs);
    assertEquals(
      view,
      [
        "### Checks (rung-5)",
        "",
        "- #10 First: proved at aaaaaaa",
        "- #12 Second: open, `bun check` has no passing run at bbbbbbb",
        "",
        "### Docs (rung-6)",
        "",
        "- #12 Second: open, the rung names no command that proves it",
        "",
      ].join("\n"),
    );
    assert(isProved(RUNGS[0] ?? { id: "", label: "", provedBy: [] }, "aaaaaaaffff", runs));
    assert(!view.includes("Untouched"));
    // the document: the view between the markers, byte for byte, and idempotent
    const doc = `# Doc\n\n${BEGIN}\nold\n${END}\n\nafter\n`;
    const spliced = spliceView(doc, view);
    assert(spliced.kind === "ok");
    assertEquals(viewIsCurrent(doc, view), { kind: "ok", value: false });
    assertEquals(viewIsCurrent(spliced.value, view), { kind: "ok", value: true });
    assertEquals(spliceView(spliced.value, view), spliced);
    assertStringIncludes(spliced.value, "after\n");
    assertEquals(viewIsCurrent("no markers", view).kind, "err");
    assertEquals(viewIsCurrent(`${END}\n${BEGIN}`, view).kind, "err");
    // the record a harness states is read as data
    const record = decodeViewRecord(
      'export const rungs = [{ id: "rung-5", label: "Checks", provedBy: ["bun test"] }];\nexport const capabilities = [{ id: 10, title: "First", touchesRung: ["rung-5"], lastRevision: "abc1234" }];\n',
    );
    assert(record.kind === "ok" && record.value.runs.length === 0 && record.value.capabilities.length === 1);
    assertEquals(decodeViewRecord("export const rungs = [];\n").kind, "err");
  },
);

const SPEC = "# Feature Specification: X\n\n**Spec ID:** 0001-x\n**Status:** Draft\n\n- **FR-001**: The thing MUST work.\n";

proves(
  ["0020-ifccm FR-011", "0020-ifccm FR-032"],
  "holdHarness runs the changes rules as a plugin: a regulated declaration with no day is refused whatever the baseline holds",
  async () => {
    await withTempDir((root) => {
      mkdirSync(join(root, "specs", "0001-x"), { recursive: true });
      writeTextFileSync(join(root, "specs", "0001-x", "spec.md"), SPEC);
      const baselineFile = join(root, "mizan.baseline.txt");
      const base = { root, baselineFile, today: "2026-11-17" } as const;
      const refused = { declaration: { regulatedDomains: ["DeviceQuality" as const] }, file: "ifccm.declaration.ts" };
      // no declaration, or a sound one: the rules find nothing
      assertEquals(holdHarness({ ...base }), 0);
      assertEquals(holdHarness({ ...base, declaration: { declaration: undefined, file: "ifccm.declaration.ts" } }), 0);
      assertEquals(
        holdHarness({
          ...base,
          declaration: {
            declaration: { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: day("2027-01-01") },
            file: "ifccm.declaration.ts",
          },
        }),
        0,
      );
      // refused, and a baseline that holds its key does not hold it: the line is stale and the finding is still new
      assertEquals(holdHarness({ ...base, declaration: refused }), 1);
      writeTextFileSync(baselineFile, "changes/declaration ifccm.declaration.ts\n");
      assertEquals(holdHarness({ ...base, declaration: refused }), 1);
      // the baseline is never written with it
      writeTextFileSync(baselineFile, "");
      assertEquals(holdHarness({ ...base, declaration: refused, writeBaseline: true }), 0);
      assertEquals(readTextFileSync(baselineFile).includes("changes/declaration"), false);
      // a folder with no specification is still asked once
      mkdirSync(join(root, "empty"), { recursive: true });
      assertEquals(
        holdHarness({ root: join(root, "empty"), baselineFile: join(root, "empty", "b.txt"), today: "2026-11-17", declaration: refused }),
        1,
      );
      return Promise.resolve();
    });
  },
);

proves(
  ["0020-ifccm FR-028"],
  "the check reaches a host only through the interface: no file of it names a host's API, URL or word, and the pure files do no I/O",
  () => {
    const files = readDirSync(CHANGES)
      .filter((e) => e.isFile && e.name.endsWith(".ts"))
      .map((e) => e.name)
      .sort();
    assert(files.length >= 9, files.join(","));
    const host = new Set(["git-log.ts", "strict.ts", "terms-file.ts"]);
    for (const name of files) {
      const text = readTextFileSync(join(CHANGES, name));
      const code = text.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      assert(!/api\.github|gitlab\.com|github\.com|\/api\/v[34]/i.test(code), `${name} names a host's API or URL`);
      const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1] ?? "");
      for (const spec of imports) {
        const target = toPosix(relative(CHANGES, resolve(CHANGES, spec)));
        const allowed =
          target.startsWith("../../kernel/") || target === "../../githost/types.ts" || (!target.startsWith("..") && !target.includes("/"));
        const ontology = target === "../../../ontology/ifccm/mod.ts";
        const plugin = name === "plugin.ts" && target === "../rules.ts";
        const hosted = host.has(name) && (target.startsWith("../../runtime/") || target.startsWith("../../githost/"));
        assert(allowed || ontology || plugin || hosted, `${name} imports ${spec}`);
      }
    }
  },
);
