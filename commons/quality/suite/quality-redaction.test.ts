/**
 * Redaction at the source (commons 0001-quality-evidence FR-067, 0001-quality-evidence FR-025): every writer of a file kept on the `quality` branch redacts it, because
 * a kept file cannot be changed afterwards without breaking its chain. The records are covered by `quality-record.test.ts`; here the ledger's
 * events of every kind (Tier 1 and Tier 2), as a pure function over events and then through the real writer on a real temporary Git repository,
 * the notes the branch keeps, and the pack's refusal as the backstop for a file written before the rule.
 *
 * The secrets are assembled in the test, so that no token stands in this repository.
 *
 * @module
 */
import { makeTempDir, remove } from "@intellectual-frontiers/system/fs";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { keepRun } from "../src/host/branch.ts";
import { appendEvents, readLedger } from "../src/host/ledger-branch.ts";
import { type LedgerEvent, readLedgerFile, redactEvent } from "../src/pure/ledger.ts";
import { assembledRun, git, needsGit, repositoryWithCommit } from "./quality-fixtures.ts";

const TOKEN = `ghp_${"a1B2".repeat(9)}`;
const MAIL = "jane.doe@example.org";
const DIRTY = `see ${MAIL} and the token ${TOKEN}`;

const DAY = "2026-11-17";
const REQ = "0001-quality-evidence FR-013";
const DIGEST = "a".repeat(64);
const person = { name: "Jane Doe", role: `reviewer ${MAIL}` };

/** One event of every kind, each with a secret and an e-mail address in every text a person typed. */
const RAW: readonly object[] = [
  {
    kind: "nonconformance-opened",
    id: "NC-0001",
    requirement: REQ,
    cause: "failed",
    reason: DIRTY,
    evidence: { traceId: "t1", path: `quality/evidence/2026/11/17/${MAIL}.json` },
    openedBy: { kind: "agent", name: MAIL },
    day: DAY,
  },
  { kind: "nonconformance-linked", id: "NC-0001", problem: { number: 7, repo: `${MAIL}/repo` }, day: DAY },
  {
    kind: "capa-opened",
    id: "CAPA-0001",
    nonconformance: "NC-0001",
    action: DIRTY,
    test: { requirement: REQ, name: DIRTY },
    correctiveRevision: "c".repeat(40),
    openedBy: { kind: "role", role: MAIL },
    author: MAIL,
    day: DAY,
  },
  { kind: "capa-verified", id: "CAPA-0001", traceId: "t2", revision: "d".repeat(40), day: DAY },
  { kind: "capa-closed", id: "CAPA-0001", decision: { id: "D-1", person: "Jane Doe", role: MAIL, day: DAY }, day: DAY },
  { kind: "nonconformance-closed", id: "NC-0001", capa: "CAPA-0001", day: DAY },
  { kind: "statement", requirement: REQ, by: "person", who: MAIL, day: DAY, note: DIRTY },
  { kind: "review", requirement: REQ, by: "agent", who: MAIL, day: DAY },
  { kind: "probe", requirement: REQ, outcome: "pass", source: DIRTY, day: DAY },
  {
    kind: "plan-registered",
    id: "PLAN-1",
    plan: { title: DIRTY, cases: [{ name: DIRTY, requirements: [REQ], acceptance: DIRTY, file: `${MAIL}.test.ts` }] },
    by: person,
    day: DAY,
  },
  {
    kind: "sample-drawn",
    id: "SAMPLE-1",
    subject: "runs",
    rule: "hash-ranked/1",
    seed: "seed-1",
    population: { count: 3, sha256: DIGEST },
    size: 1,
    items: ["t1"],
    by: person,
    day: DAY,
  },
  { kind: "sample-attested", sample: "SAMPLE-1", results: [{ item: "t1", verdict: "pass", note: DIRTY }], person, day: DAY },
  {
    kind: "mutation-run",
    id: "MUT-1",
    tool: { name: DIRTY, version: MAIL },
    revision: "e".repeat(40),
    results: [{ requirement: REQ, mutants: 10, killed: 9, survived: 1 }],
    day: DAY,
  },
];

/** An event as the ledger decodes it (a file of the ledger around it), which is what the writer is given. */
function decoded(raw: object): LedgerEvent {
  const file = readLedgerFile(JSON.stringify({ schema: "ifqs-record/1", seq: 1, previous: "0".repeat(64), event: raw }));
  assert(file.kind === "ok", file.kind === "err" ? file.error : "");
  return file.value.event;
}

const EVENTS: readonly LedgerEvent[] = RAW.map(decoded);

/** Every string in a value, at any depth, with the key it stands under. */
function strings(value: unknown, key = ""): readonly { readonly key: string; readonly text: string }[] {
  if (typeof value === "string") return [{ key, text: value }];
  if (Array.isArray(value)) return value.flatMap((v: unknown) => strings(v, key));
  if (typeof value === "object" && value !== null) return Object.entries(value).flatMap(([k, v]) => strings(v, k));
  return [];
}

const leaks = (text: string): boolean => text.includes(TOKEN) || text.includes(MAIL);

proves(
  ["0001-quality-evidence FR-067", "0001-quality-evidence FR-025"],
  "the ledger redacts every text of an event of every kind at the source, Tier 1 and Tier 2; a person's name stays, an e-mail address in it does not",
  () => {
    assertEquals(new Set(EVENTS.map((e) => e.kind)).size, 13, "the fixture holds each kind of event once");
    for (const e of EVENTS) {
      const kept = redactEvent(e);
      assertEquals(kept.kind, e.kind);
      const found = strings(kept).filter((s) => leaks(s.text));
      assertEquals(found, [], `${e.kind} keeps a secret or an e-mail address`);
      // what is data is as it was: the name of the person, the digests, the days
      assertEquals(redactEvent(kept), kept, `${e.kind}: redaction is idempotent`);
    }
    const plan = EVENTS.map(redactEvent).find((e) => e.kind === "plan-registered");
    assert(plan?.kind === "plan-registered");
    assertEquals(plan.by.name, "Jane Doe");
    assertEquals(plan.by.role, "reviewer REDACTED");
    const attested = EVENTS.map(redactEvent).find((e) => e.kind === "sample-attested");
    assert(attested?.kind === "sample-attested");
    assertEquals(attested.person.name, "Jane Doe");
    assertEquals(attested.results[0]?.verdict, "pass");
  },
);

proves(["0001-quality-evidence FR-067"], "a person's own e-mail address as the name of the person is redacted; a name is kept", () => {
  const e = decoded({ kind: "statement", requirement: REQ, by: "person", who: "Jane Doe", day: DAY });
  assertEquals(redactEvent(e), e);
  const mailed = redactEvent(decoded({ kind: "statement", requirement: REQ, by: "person", who: MAIL, day: DAY }));
  assert(mailed.kind === "statement");
  assertEquals(mailed.who, "REDACTED");
});

proves(
  ["0001-quality-evidence FR-067", "0001-quality-evidence FR-025"],
  "events of every kind written to a real quality branch hold no secret and no e-mail address in any file, and the ledger reads back",
  async () => {
    const dir = await makeTempDir({ prefix: "ifqs-redaction-" });
    try {
      await repositoryWithCommit(dir);
      const wrote = await appendEvents(dir, EVENTS, { sign: false });
      assert(wrote.kind === "ok", wrote.kind === "err" ? JSON.stringify(wrote.error) : "");
      const listed = await git(dir, "ls-tree", "-r", "--name-only", "quality");
      const files = listed.split("\n").filter((f) => f.startsWith("quality/records/"));
      assertEquals(files.length, EVENTS.length, "one file for each event");
      for (const f of files) {
        const text = await git(dir, "show", `quality:${f}`);
        assertEquals(leaks(text), false, `${f} keeps a secret or an e-mail address`);
      }
      const messages = await git(dir, "log", "quality", "--format=%B");
      assertEquals(leaks(messages), false, "no commit message of the branch carries one");
      const read = await readLedger(dir);
      assert(read.kind === "ok", "the redacted ledger reads back and its chain holds");
    } finally {
      await remove(dir, { recursive: true });
    }
  },
  needsGit,
);

proves(
  ["0001-quality-evidence FR-067", "0001-quality-evidence FR-025"],
  "a run kept with a secret and an e-mail address in a failure message is written redacted, and neither the note on the tested commit nor the commit messages of the branch carry one",
  async () => {
    const dir = await makeTempDir({ prefix: "ifqs-redaction-run-" });
    try {
      const tested = await repositoryWithCommit(dir);
      const record = await assembledRun(1, [{ name: "a case", outcome: "fail", message: DIRTY, requirements: [REQ] }], {
        revision: tested,
      });
      const kept = await keepRun({ repo: dir, record, sign: false });
      assert(kept.kind === "ok", kept.kind === "err" ? JSON.stringify(kept.error) : "");
      const listed = await git(dir, "ls-tree", "-r", "--name-only", "quality");
      const file = listed.split("\n").find((f) => f.endsWith(".otlp.json"));
      assert(file !== undefined, "the run's file is on the branch");
      assertEquals(leaks(await git(dir, "show", `quality:${file}`)), false, "the run's file");
      assertEquals(leaks(await git(dir, "notes", "--ref", "quality", "show", tested)), false, "the note");
      assertEquals(leaks(await git(dir, "log", "quality", "--format=%B")), false, "the commit messages");
    } finally {
      await remove(dir, { recursive: true });
    }
  },
  needsGit,
);
