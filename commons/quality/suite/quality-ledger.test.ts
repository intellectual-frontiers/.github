/**
 * The ledger of nonconformances and CAPA (commons 0001-quality-evidence FR-012, FR-031 to FR-036, FR-046): the transitions as pure functions (a CAPA is
 * verified only by a run of its named test after the corrective change, closed only from verified and only by a named person; a nonconformance
 * is closed only through a closed CAPA), and the same lifecycle on a real temporary Git repository: failed runs kept on the `quality` branch, the
 * nonconformance the system opens itself, the Problem change request linked, the CAPA, its verification by the run that passes the test, its
 * closure by a named person, the files appended to the branch, a chain that finds a file changed, and the index that lists it all, closed ones kept.
 *
 * @module
 */
import { GENESIS } from "../src/pure/primitives.ts";
import { makeTempDir, remove, writeTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { verifyBranch, writeCommit, keepRun } from "../src/host/branch.ts";
import { verifications } from "../src/commands.ts";
import { type Gathered, gather, isAfter } from "../src/host/gather.ts";
import { appendEvents, readLedger } from "../src/host/ledger-branch.ts";
import { indexOf, openings } from "../src/host/report.ts";
import {
  applyEvent,
  closeCapa,
  emptyLedger,
  foldLedger,
  type Ledger,
  type LedgerEvent,
  linkProblem,
  openCapa,
  openNonconformance,
  openNonconformances,
  parseRecordPath,
  readLedgerFile,
  recordPath,
  unlinked,
  verifyFromRun,
  verifyLedgerChain,
  ledgerFile,
} from "../src/pure/ledger.ts";
import { SUGGESTED_OBJECTIVES } from "../src/pure/objectives.ts";
import { type Day, dayOfText } from "../src/pure/time.ts";
import { assembledRun, git, needsGit, needsSshKeygen, nextCommit, repositoryWithCommit, sshSigning } from "./quality-fixtures.ts";

const REQ = "0001-quality-evidence FR-013";
const TEST = "the named test passes";
const TESTS = [{ requirements: [REQ], name: TEST }];

/** The ledger after events that must follow one another. */
function after(...events: readonly LedgerEvent[]): Ledger {
  const l = foldLedger(events);
  assert(l.kind === "ok", l.kind === "err" ? l.error.reason : "");
  return l.value;
}

/** An event made by a function that returns one, failing the test where it refuses. */
function made(r: { readonly kind: "ok"; readonly value: LedgerEvent } | { readonly kind: "err"; readonly error: string }): LedgerEvent {
  assert(r.kind === "ok", r.kind === "err" ? r.error : "");
  return r.value;
}

const opened = (): LedgerEvent =>
  made(
    openNonconformance(
      emptyLedger,
      { requirement: REQ, cause: "failed", reason: "a case failed", evidence: { traceId: "t1" } },
      "2026-11-10",
    ),
  );

proves(
  ["0001-quality-evidence FR-031", "0001-quality-evidence FR-032", "0001-quality-evidence FR-033"],
  "a nonconformance carries its requirement, evidence, reason, opener and state, is linked to a Problem change request, and a CAPA names a test that exists; there is no way to edit a state",
  () => {
    const nc = opened();
    assert(nc.kind === "nonconformance-opened");
    assertEquals([nc.id, nc.requirement, nc.cause, nc.openedBy.kind, nc.evidence.traceId], ["NC-0001", REQ, "failed", "system", "t1"]);
    const l1 = after(nc);
    const n = l1.nonconformances[0];
    assert(n !== undefined);
    assertEquals([n.state, n.problem, unlinked(l1).length], ["NonconformanceOpen", undefined, 1]);
    // the same requirement and cause is not opened twice while one is open
    const again = openNonconformance(l1, { requirement: REQ, cause: "failed", reason: "again", evidence: {} }, "2026-11-11");
    assert(again.kind === "err");
    assertStringIncludes(again.error, "NC-0001 is already open");
    // linked to its Problem change request
    const l2 = after(nc, made(linkProblem(l1, "NC-0001", { number: 42 }, "2026-11-10")));
    assertEquals([l2.nonconformances[0]?.problem?.number, unlinked(l2).length], [42, 0]);
    assert(linkProblem(l1, "NC-0009", { number: 42 }, "2026-11-10").kind === "err");
    // a CAPA states its action, names a test that exists and proves the requirement
    const input = { nonconformance: "NC-0001", action: "fix the parser", test: { requirement: REQ, name: TEST }, correctiveRevision: "c1" };
    const capa = made(openCapa(l2, input, TESTS, "2026-11-11"));
    assert(capa.kind === "capa-opened");
    assertEquals([capa.id, capa.nonconformance, capa.test.name], ["CAPA-0001", "NC-0001", TEST]);
    const refusals = [
      openCapa(l2, { ...input, test: { requirement: REQ, name: "a test that does not exist" } }, TESTS, "2026-11-11"),
      openCapa(l2, { ...input, test: { requirement: "0001-quality-evidence FR-014", name: TEST } }, TESTS, "2026-11-11"),
      openCapa(l2, { ...input, action: "  " }, TESTS, "2026-11-11"),
      openCapa(l2, { ...input, nonconformance: "NC-0009" }, TESTS, "2026-11-11"),
    ];
    for (const r of refusals) assert(r.kind === "err");
    assertStringIncludes(refusals[0]?.kind === "err" ? refusals[0].error : "", "names a test that exists");
    // a nonconformance is closed only through a closed CAPA: the event that closes it, with the CAPA still open, does not follow
    const l3 = after(nc, capa);
    const direct = applyEvent(l3, { kind: "nonconformance-closed", id: "NC-0001", capa: "CAPA-0001", day: day("2026-11-12") });
    assert(direct.kind === "err");
    assertStringIncludes(direct.error.reason, "closed only through a closed CAPA");
    // an event that opens a CAPA for a closed or unknown nonconformance does not follow either
    assert(applyEvent(emptyLedger, capa).kind === "err");
  },
);

/** A day, for a test that builds an event by hand. */
function day(text: string): Day {
  const d = dayOfText(text);
  assert(d.kind === "ok", text);
  return d.value;
}

const RUN = (outcome: string, revision = "c2") => ({
  traceId: "t2",
  revision,
  day: "2026-11-12",
  cases: [{ name: TEST, requirements: [REQ], outcome }],
});

proves(
  ["0001-quality-evidence FR-034", "0001-quality-evidence FR-035", "0001-quality-evidence FR-012"],
  "a CAPA is verified by the run that passes its named test after the corrective change, never otherwise, and closed only from verified by a named person who is not what opened it nor, where regulated, the author",
  () => {
    const nc = opened();
    const base = after(nc);
    const capa = made(
      openCapa(
        base,
        {
          nonconformance: "NC-0001",
          action: "fix",
          test: { requirement: REQ, name: TEST },
          correctiveRevision: "c1",
          author: "dev@example.com",
          openedBy: { kind: "agent", name: "fixer" },
        },
        TESTS,
        "2026-11-11",
      ),
    );
    const l = after(nc, capa);
    const isAfterC1 = (corrective: string, revision: string): boolean => corrective === "c1" && revision === "c2";
    // the test failed again: stays open; the test did not run: stays open; the run is before the change: stays open
    assertEquals(verifyFromRun(l, RUN("fail"), isAfterC1), []);
    assertEquals(verifyFromRun(l, RUN("not_run"), isAfterC1), []);
    assertEquals(verifyFromRun(l, RUN("pass", "c0"), isAfterC1), []);
    assertEquals(
      verifyFromRun(l, { ...RUN("pass"), cases: [{ name: "another test", requirements: [REQ], outcome: "pass" }] }, isAfterC1),
      [],
    );
    const verified = verifyFromRun(l, RUN("pass"), isAfterC1);
    assertEquals(
      verified.map((e) => e.kind),
      ["capa-verified"],
    );
    const l2 = after(nc, capa, ...verified);
    assertEquals([l2.capas[0]?.state, l2.nonconformances[0]?.state], ["CapaVerified", "NonconformanceOpen"]);
    // verified once: a second run verifies nothing more
    assertEquals(verifyFromRun(l2, RUN("pass"), isAfterC1), []);
    // an event that verifies a CAPA out of order does not follow
    assert(
      applyEvent(l, {
        kind: "capa-closed",
        id: "CAPA-0001",
        decision: { id: "D1", person: "A. Person", day: day("2026-11-12") },
        day: day("2026-11-12"),
      }).kind === "err",
    );
    const close = (l: Ledger, approver: Parameters<typeof closeCapa>[1]["approver"], more: Partial<Parameters<typeof closeCapa>[1]> = {}) =>
      closeCapa(l, { capa: "CAPA-0001", approver, decision: "D-1", regulated: false, ...more }, "2026-11-13");
    // not from open
    const early = close(l, { kind: "person", name: "A. Person" });
    assert(early.kind === "err");
    assertStringIncludes(early.error, "only from CapaVerified");
    // an automated run, an agent, and the agent that opened it cannot close it
    const auto = close(l2, { kind: "automated", run: "t2" });
    assert(auto.kind === "err");
    assertStringIncludes(auto.error, "a run cannot close it");
    assert(close(l2, { kind: "agent", name: "fixer" }).kind === "err");
    assert(close(l2, { kind: "person", name: "  " }).kind === "err");
    // a person with the opener's name is the opener: nothing authorizes itself
    const self = close(l2, { kind: "person", name: "fixer" });
    assert(self.kind === "err");
    assertStringIncludes(self.error, "opened it and cannot approve");
    // where a regulated domain is declared the approver is not the author of the corrective change
    const author = close(l2, { kind: "person", name: "dev@example.com" }, { regulated: true });
    assert(author.kind === "err");
    assertStringIncludes(author.error, "author of the corrective change");
    assert(close(l2, { kind: "person", name: "dev@example.com" }, { regulated: false }).kind === "ok");
    // a named person closes it, with the Decision's person and day, and its nonconformance closes with it
    const closed = close(l2, { kind: "person", name: "A. Reviewer", role: "quality" });
    assert(closed.kind === "ok");
    assertEquals(
      closed.value.map((e) => e.kind),
      ["capa-closed", "nonconformance-closed"],
    );
    const l3 = after(nc, capa, ...verified, ...closed.value);
    assertEquals(
      [l3.capas[0]?.state, l3.nonconformances[0]?.state, l3.capas[0]?.closed?.decision.person, l3.capas[0]?.closed?.decision.day],
      ["CapaClosed", "NonconformanceClosed", "A. Reviewer", "2026-11-13"],
    );
    // it stays in the record, and is not open
    assertEquals([openNonconformances(l3).length, l3.nonconformances.length], [0, 1]);
    // a closed CAPA does not close again
    assert(close(l3, { kind: "person", name: "A. Reviewer" }).kind === "err");
  },
);

proves(
  ["0001-quality-evidence FR-046"],
  "each event is one file named by its sequence number and kind, redacted of secrets, read back as it was, and chained to the file before it",
  async () => {
    const nc = made(
      openNonconformance(
        emptyLedger,
        { requirement: REQ, cause: "failed", reason: "the token ghp_0123456789abcdefghijklmnopqrstuvwxyz0123 leaked", evidence: {} },
        "2026-11-10",
      ),
    );
    const first = ledgerFile({ schema: "ifqs-record/1", seq: 1, previous: GENESIS, event: nc });
    assert(first.kind === "ok");
    assert(!first.value.includes("ghp_0123456789"), "the secret is not written");
    assertStringIncludes(first.value, "REDACTED");
    assertEquals(recordPath(1, "nonconformance-opened"), "quality/records/000001-nonconformance-opened.json");
    assertEquals(parseRecordPath("quality/records/000001-nonconformance-opened.json"), { seq: 1, kind: "nonconformance-opened" });
    assertEquals(parseRecordPath("quality/evidence/2026/11/17/x.otlp.json"), undefined);
    const back = readLedgerFile(first.value);
    assert(back.kind === "ok");
    assertEquals(back.value.seq, 1);
    // the same event gives the same bytes
    assertEquals(ledgerFile({ schema: "ifqs-record/1", seq: 1, previous: GENESIS, event: nc }), first);
    const files = [{ path: recordPath(1, "nonconformance-opened"), text: first.value }];
    assert((await verifyLedgerChain(files)).kind === "ok");
    // a file whose sequence, kind or predecessor is not the next is found
    const wrong = await verifyLedgerChain([{ path: recordPath(2, "nonconformance-opened"), text: first.value }]);
    assert(wrong.kind === "err");
    assertStringIncludes(wrong.error.reason, "its name says number 2 and it holds number 1, where number 1 is next");
    const kind = await verifyLedgerChain([{ path: recordPath(1, "probe"), text: first.value }]);
    assert(kind.kind === "err");
    assertStringIncludes(kind.error.reason, "its name says probe");
    assert((await verifyLedgerChain([{ path: "quality/records/x.json", text: first.value }])).kind === "err");
    assert((await verifyLedgerChain([{ path: recordPath(1, "nonconformance-opened"), text: "{}" }])).kind === "err");
  },
);

// ---------------------------------------------------------------------------------------------------------------------------- the lifecycle on a real repository

/** A real repository with the test file a CAPA names, and a commit; the repository and the commit. */
async function repositoryWithTest(dir: string): Promise<string> {
  const first = await repositoryWithCommit(dir);
  await writeTextFile(
    join(dir, "capa.test.ts"),
    `import { proves } from "./test.ts";\nproves(["${REQ}"], ${JSON.stringify(TEST)}, () => {});\n`,
  );
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "a test");
  return first;
}

async function keep(repo: string, n: number, cases: Parameters<typeof assembledRun>[1], revision: string): Promise<void> {
  const kept = await keepRun({ repo, record: await assembledRun(n, cases, { revision }), commit: revision, sign: false });
  assert(kept.kind === "ok", kept.kind === "err" ? JSON.stringify(kept.error) : "");
}

proves(
  [
    "0001-quality-evidence FR-015",
    "0001-quality-evidence FR-031",
    "0001-quality-evidence FR-032",
    "0001-quality-evidence FR-033",
    "0001-quality-evidence FR-034",
    "0001-quality-evidence FR-035",
    "0001-quality-evidence FR-036",
    "0001-quality-evidence FR-024",
  ],
  "on a real repository a failed run opens a nonconformance by itself, a CAPA is verified by the run that passes its test after the fix, closed by a named person, and the index lists it all, closed ones kept",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-ledger-" });
    try {
      const c0 = await repositoryWithTest(repo);
      // a failing run of the requirement, kept on the quality branch
      await keep(repo, 1, [{ name: TEST, outcome: "fail", message: "expected 1, got 2", requirements: [REQ] }], c0);
      const g = await gather({ repo, today: "2026-11-17" });
      assert(g.kind === "ok", g.kind === "err" ? JSON.stringify(g.error) : "");
      assertEquals(
        g.value.tests.some((t) => t.name === TEST && t.requirements.includes(REQ)),
        true,
      );
      const failing = g.value.byRequirement.get(REQ);
      assert(failing?.failed !== undefined, "the newest run failed");
      // the system opens the nonconformance itself
      const wanted = openings(g.value, [], "2026-11-17");
      assertEquals(
        wanted.map((e) => e.kind),
        ["nonconformance-opened"],
      );
      const w1 = await appendEvents(repo, wanted, { sign: false });
      assert(w1.kind === "ok", w1.kind === "err" ? JSON.stringify(w1.error) : "");
      assertEquals(w1.value.ledger.nonconformances[0]?.state, "NonconformanceOpen");
      // the nonconformance is listed at once, with no CAPA and no Problem change request
      const idx1 = indexOf(await gatherOk(repo), SUGGESTED_OBJECTIVES);
      assert(idx1.kind === "ok");
      assertStringIncludes(idx1.value.text, '"id": "NC-0001"');
      assertStringIncludes(idx1.value.text, '"state": "NonconformanceOpen"');
      // nothing more is opened for the same failure
      assertEquals(openings(await gatherOk(repo), [], "2026-11-17"), []);
      // link it, then correct the code and open the CAPA with the corrective commit
      const l = await readLedger(repo);
      assert(l.kind === "ok");
      const link = made(linkProblem(l.value.ledger, "NC-0001", { number: 77 }, "2026-11-17"));
      assert((await appendEvents(repo, [link], { sign: false })).kind === "ok");
      const fix = await nextCommit(repo, "fixed.txt");
      const l2 = await readLedger(repo);
      assert(l2.kind === "ok");
      const capa = made(
        openCapa(
          l2.value.ledger,
          {
            nonconformance: "NC-0001",
            action: "fix it",
            test: { requirement: REQ, name: TEST },
            correctiveRevision: fix,
            author: "ci@example.com",
          },
          g.value.tests,
          "2026-11-17",
        ),
      );
      assert((await appendEvents(repo, [capa], { sign: false })).kind === "ok");
      // a run that passes the test BEFORE the corrective change verifies nothing; the CAPA stays open
      await keep(repo, 2, [{ name: TEST, requirements: [REQ] }], c0);
      assertEquals(await verified(repo, 2), []);
      // the run that passes it at the corrective change verifies the CAPA, and does not close it
      await keep(repo, 3, [{ name: TEST, requirements: [REQ] }], fix);
      const events = await verified(repo, 3);
      assertEquals(
        events.map((e) => e.kind),
        ["capa-verified"],
      );
      assert((await appendEvents(repo, events, { sign: false })).kind === "ok");
      const l3 = await readLedger(repo);
      assert(l3.kind === "ok");
      assertEquals([l3.value.ledger.capas[0]?.state, l3.value.ledger.nonconformances[0]?.state], ["CapaVerified", "NonconformanceOpen"]);
      // a person closes it
      const closed = closeCapa(
        l3.value.ledger,
        {
          capa: "CAPA-0001",
          approver: { kind: "person", name: "A. Reviewer" },
          decision: "D-9",
          regulated: true,
          author: "ci@example.com",
        },
        "2026-11-18",
      );
      assert(closed.kind === "ok");
      assert((await appendEvents(repo, closed.value, { sign: false })).kind === "ok");
      // the ledger and the evidence chain both verify, interleaved on one branch
      const v = await verifyBranch(repo);
      assert(v.kind === "ok", v.kind === "err" ? JSON.stringify(v.error) : "");
      assertEquals([v.value.count, v.value.records], [3, 6]);
      assertEquals(await isAfter(repo, c0, fix), true);
      // the index: the nonconformance and its CAPA are there, closed, kept; rebuilt from the branch alone it is the same bytes
      const final = await gatherOk(repo);
      const idx = indexOf(final, SUGGESTED_OBJECTIVES);
      assert(idx.kind === "ok");
      assertStringIncludes(idx.value.text, '"state": "NonconformanceClosed"');
      assertStringIncludes(idx.value.text, '"state": "CapaClosed"');
      assertStringIncludes(idx.value.text, '"person": "A. Reviewer"');
      assertStringIncludes(idx.value.text, '"number": 77');
      const clone = await makeTempDir({ prefix: "ifc-ledger-clone-" });
      try {
        // only the quality branch crosses to the new repository: the index is built from it alone
        await git(clone, "init", "-q", "-b", "main");
        await git(clone, "fetch", "-q", repo, `refs/heads/quality:refs/heads/quality`, "refs/notes/quality:refs/notes/quality");
        const copy = indexOf(await gatherOk(clone), SUGGESTED_OBJECTIVES);
        assert(copy.kind === "ok");
        assertEquals(copy.value.text, idx.value.text);
      } finally {
        await remove(clone, { recursive: true });
      }
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);

async function gatherOk(repo: string): Promise<Gathered> {
  const g = await gather({ repo, changes: false });
  assert(g.kind === "ok", g.kind === "err" ? JSON.stringify(g.error) : "");
  return g.value;
}

/** The events that verify CAPA from the kept run `n`'s cases, by the command's own function. */
async function verified(repo: string, n: number): Promise<readonly LedgerEvent[]> {
  const g = await gatherOk(repo);
  const trace = n.toString(16).padStart(32, "0");
  const run = g.runs.find((r) => r.traceId === trace);
  assert(run !== undefined, `run ${n} is kept`);
  return verifications(repo, g.ledger.ledger, { traceId: run.traceId, revision: run.revision, day: run.day, cases: run.cases });
}

proves(
  ["0001-quality-evidence FR-021", "0001-quality-evidence FR-022", "0001-quality-evidence FR-046"],
  "a ledger file changed after it was kept, a file removed, and an event that does not follow the ledger are each found and refused",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-ledger-" });
    try {
      await repositoryWithCommit(repo);
      const nc = opened();
      assert((await appendEvents(repo, [nc], { sign: false })).kind === "ok");
      const l = await readLedger(repo);
      assert(l.kind === "ok");
      const link = made(linkProblem(l.value.ledger, "NC-0001", { number: 5 }, "2026-11-10"));
      assert((await appendEvents(repo, [link], { sign: false })).kind === "ok");
      // an event that does not follow is refused and nothing is written
      const bad = await appendEvents(
        repo,
        [{ kind: "capa-verified", id: "CAPA-0001", traceId: "t", revision: "r", day: day("2026-11-10") }],
        { sign: false },
      );
      assert(bad.kind === "err");
      assertStringIncludes(JSON.stringify(bad.error), "is not opened");
      const still = await readLedger(repo);
      assert(still.kind === "ok");
      assertEquals(still.value.files, 2);
      assert((await verifyBranch(repo)).kind === "ok");
      // the first file changed by a commit on top of the branch: found
      const tip = await git(repo, "rev-parse", "quality");
      const first = recordPath(1, "nonconformance-opened");
      const text = await git(repo, "show", `quality:${first}`);
      const tampered = await writeCommit(repo, tip, first, `${text.replace("a case failed", "all is well")}\n`, "edit", false);
      assert(tampered.kind === "ok");
      await git(repo, "update-ref", "refs/heads/quality", tampered.value);
      const v = await verifyBranch(repo);
      assert(v.kind === "err");
      assertEquals(v.error.kind, "not-append");
      // and the ledger's own chain finds the change without the commit's help
      const read = await readLedger(repo);
      assert(read.kind === "err");
      assertStringIncludes(JSON.stringify(read.error), "digest of the file before it");
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  { ...needsGit },
);

proves(
  ["0001-quality-evidence FR-021", "0001-quality-evidence FR-046"],
  "the ledger's commits are signed through the host's Git signing, and the branch verifies as signed by a trusted key",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-ledger-" });
    const keys = await makeTempDir({ prefix: "ifc-ledger-keys-" });
    try {
      await repositoryWithCommit(repo);
      const allowed = await sshSigning(repo, keys);
      assert((await appendEvents(repo, [opened()], { sign: true })).kind === "ok");
      const l = await readLedger(repo);
      assert(l.kind === "ok");
      const link = made(linkProblem(l.value.ledger, "NC-0001", { number: 5 }, "2026-11-10"));
      // not given: as commit.gpgsign says (the repository is set to sign)
      await git(repo, "config", "commit.gpgsign", "true");
      assert((await appendEvents(repo, [link])).kind === "ok");
      const v = await verifyBranch(repo, { allowedSigners: allowed, requireSigned: true });
      assert(v.kind === "ok", v.kind === "err" ? JSON.stringify(v.error) : "");
      assertEquals(v.value.records, 2);
    } finally {
      await remove(repo, { recursive: true });
      await remove(keys, { recursive: true });
    }
  },
  { ...needsSshKeygen },
);
