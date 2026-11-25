/**
 * Tests of what the logical layer tells: the one JSON document and SARIF, `explain` and `translate`, the cadence of hints, a run nested in a run, and the
 * redaction of an outcome (commons headless 0003-headless-output FR-006 to FR-011).
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { isErr, isOk } from "@intellectual-frontiers/core";
import { problem, redactor } from "../src/governance/mod.ts";
import { ENVELOPE_SCHEMA, envelopeOf, jsonText, sarifOf, sarifText, toJson } from "../src/logical/envelope.ts";
import { catalogueProblems, explainText, translator, type Catalogue, type RawPattern } from "../src/logical/explain.ts";
import { distinctHints, HINT_DAYS, hintsDue } from "../src/logical/hints.ts";
import { childEnv, encodeSummary, isNested, mergeSummary, nestedNames, parseSummary, summaryOf } from "../src/logical/nested.ts";
import { outcomeOf } from "../src/logical/outcome.ts";
import { redactEvent, redactOutcome, redactValue } from "../src/logical/redaction.ts";

const DAY = 86_400_000;

proves(["0003-headless-output FR-006"], "an envelope is one document with a fixed order of keys, whose status, counts and data agree with the run", () => {
  const o = outcomeOf({ n: 1, big: 10n, when: new Date(0), skip: undefined, bad: Number.NaN, nested: { x: [1n, undefined] } }, {
    problems: [problem("warn", "slow", { code: "E1-SLOW" }), problem("pending", "wait")],
    outcomes: ["Sent"],
    next: ["next: tool x"],
    hints: [{ id: "h", message: "m" }],
  });
  const e = envelopeOf({ program: "tool", version: "1.2.3", command: "sync", outcome: o, code: 0 });
  assertEquals(Object.keys(e), ["schema", "program", "version", "command", "ok", "exit", "counts", "problems", "outcomes", "hints", "next", "data"]);
  assertEquals([e.schema, e.ok, e.exit, e.counts], [ENVELOPE_SCHEMA, true, { code: 0, name: "ok" }, { fail: 0, warn: 1, pending: 1, action: 0 }]);
  assertEquals(e.data, { n: 1, big: "10", when: "1970-01-01T00:00:00.000Z", bad: null, nested: { x: ["1", null] } });
  const text = jsonText(e);
  assert(text.endsWith("}\n") && !text.includes("\u001b"));
  assertEquals(JSON.parse(text), JSON.parse(JSON.stringify(e)));
  const failed = envelopeOf({ program: "tool", command: "sync", outcome: outcomeOf(null, { problems: [problem("fail", "x")] }), code: 1 });
  assertEquals([failed.ok, failed.exit, "version" in failed], [false, { code: 1, name: "findings" }, false]);
  assertEquals(envelopeOf({ program: "t", command: "", outcome: outcomeOf(null), code: 77 }).exit, { code: 77, name: "other" });
  assertEquals(envelopeOf({ program: "t", command: "", outcome: outcomeOf(null), code: 4 }).ok, false);
});

proves(["0003-headless-output FR-006"], "toJson never throws and gives what JSON can say, for any value", () => {
  fc.assert(
    fc.property(fc.anything({ withBigInt: true, withDate: true, withNullPrototype: true, withObjectString: true, withUnicodeString: true }), (v) => {
      const j = toJson(v);
      assertEquals(JSON.parse(JSON.stringify(j)), j);
    }),
  );
  const hostile = JSON.parse('{"__proto__": {"x": 1}, "a": 1}') as unknown;
  assertEquals(JSON.stringify(toJson(hostile)), '{"__proto__":{"x":1},"a":1}', "a key named __proto__ is data");
  // the counterexample of fast-check (seed -1644160708, path 62:1:2:3:2): JSON cannot carry a negative zero, so the value is the zero its text says
  assertEquals(toJson({ "": -0 }), { "": 0 });
  assertEquals(Object.is(toJson(-0), 0), true);
  assertEquals(toJson(() => 1), null);
  assertEquals(toJson(Symbol("s")), null);
  assertEquals(toJson({ f: () => 1, s: Symbol("x"), u: undefined, k: 1 }), { k: 1 });
});

proves(["0003-headless-output FR-007"], "SARIF 2.1.0 holds the findings returned, else those of the failures and warnings, with rules, levels and locations", () => {
  const own = outcomeOf(null, { findings: [{ ruleId: "r1", level: "error", message: "m1", file: "a.ts", line: 3 }, { ruleId: "r1", level: "note", message: "m2" }], problems: [problem("fail", "ignored")] });
  const s = sarifOf({ program: "tool", version: "1", outcome: own }) as { version: string; runs: { tool: { driver: { name: string; version: string; rules: { id: string }[] } }; results: { ruleId: string; level: string; locations?: unknown }[] }[] };
  assertEquals(s.version, "2.1.0");
  assertEquals(s.runs[0]?.tool.driver, { name: "tool", version: "1", rules: [{ id: "r1" }] });
  assertEquals(s.runs[0]?.results.map((r) => [r.ruleId, r.level, r.locations !== undefined]), [["r1", "error", true], ["r1", "note", false]]);
  const derived = sarifOf({ program: "tool", outcome: outcomeOf(null, { problems: [problem("fail", "f", { code: "E1-F" }), problem("warn", "w"), problem("action", "a")] }) }) as typeof s;
  assertEquals(derived.runs[0]?.results.map((r) => [r.ruleId, r.level]), [["E1-F", "error"], ["warning", "warning"]]);
  assert(sarifText({ program: "t", outcome: own }).endsWith("}\n"));
});

/** The explanations and patterns of a fixture catalogue. */
const CATALOGUE: Catalogue = {
  "E047-HOST-KEY": { title: "A host key changed", what: "The host's key is not the one remembered.", why: "The host was reinstalled.", fix: "fleetctl fleet trust alpha", doc: "fleet-trust" },
  "E004-SSH-KEY": { title: "The key was refused", what: "The server did not take the key.", why: "It is not authorized.", fix: "fleetctl keys push" },
  "E009-DNS": { title: "A name did not resolve", what: "A name found no address.", why: "The network is down.", fix: "check the network" },
  "E009-APT-BUSY": { title: "apt is busy", what: "Another apt holds the lock.", why: "An upgrade is running.", fix: "wait, then run it again" },
  "E009-DPKG-DAMAGED": { title: "dpkg is damaged", what: "Its database is broken.", why: "An upgrade was interrupted.", fix: "sudo dpkg --configure -a" },
};
const PATTERNS: readonly RawPattern[] = [
  [/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/, "E047-HOST-KEY"],
  [/Permission denied \(publickey/, "E004-SSH-KEY"],
  [/Could not resolve host|Temporary failure in name resolution|Name or service not known/, "E009-DNS"],
  [/Could not get lock .*(dpkg|apt)|dpkg frontend lock/, "E009-APT-BUSY"],
  [/dpkg was interrupted|fgets gave an empty string|parsing file '\/var\/lib\/dpkg/, "E009-DPKG-DAMAGED"],
];

proves(["0003-headless-output FR-008"], "a raw error of another tool is given its code and fix by the first pattern that matches, and an unknown one is left as it is", () => {
  const translate = translator(CATALOGUE, PATTERNS);
  const cases: readonly [string, string][] = [
    ["Host key verification failed.", "E047-HOST-KEY"],
    ["@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@", "E047-HOST-KEY"],
    ["ops@alpha: Permission denied (publickey).", "E004-SSH-KEY"],
    ["curl: (6) Could not resolve host: archive.ubuntu.com", "E009-DNS"],
    ["E: Could not get lock /var/lib/dpkg/lock-frontend", "E009-APT-BUSY"],
    ["dpkg-query: error: fgets gave an empty string from '/var/lib/dpkg/triggers/Unincorp'", "E009-DPKG-DAMAGED"],
  ];
  for (const [raw, code] of cases) assertEquals(translate(raw)?.code, code, raw);
  assertEquals(translate("alpha: Host key verification failed.")?.fix, "fleetctl fleet trust alpha");
  assertEquals(translate("everything is fine"), undefined);
  // the first match wins
  assertEquals(translator(CATALOGUE, [[/x/, "E004-SSH-KEY"], [/x/, "E009-DNS"]])("x")?.code, "E004-SSH-KEY");
});

proves(["0003-headless-output FR-008"], "explain gives one explanation for a code in either case, the list without one, and names the nearest for one that is not there", () => {
  const ctx = { program: "fleetctl", guide: (doc: string) => ({ ref: `bun run fleetctl docs ${doc}`, url: `https://docs.example/${doc}` }) };
  const one = explainText(CATALOGUE, ctx, "e047-host-key");
  for (const want of ["E047-HOST-KEY: A host key changed", "What happened  The host's key", "Likely cause   The host was reinstalled.", "Fix            fleetctl fleet trust alpha", "More           bun run fleetctl docs fleet-trust   (online: https://docs.example/fleet-trust)"]) {
    assertStringIncludes(one, want);
  }
  assert(!explainText(CATALOGUE, { program: "fleetctl" }, "E004-SSH-KEY").includes("More"));
  const list = explainText(CATALOGUE, ctx);
  assertStringIncludes(list, "Every problem fleetctl explains (fleetctl explain <code>):");
  for (const code of Object.keys(CATALOGUE)) assertStringIncludes(list, code);
  assertEquals(explainText(CATALOGUE, ctx, "E047-HOST-KY"), "no explanation named E047-HOST-KY; did you mean E047-HOST-KEY? fleetctl explain lists them");
  assertStringIncludes(explainText(CATALOGUE, ctx, "zzzzzzzz"), "no explanation named zzzzzzzz");
});

proves(["0003-headless-output FR-008"], "a catalogue is checked: stable codes, no blank field, patterns that name a code explained", () => {
  assertEquals(catalogueProblems(CATALOGUE, PATTERNS), []);
  const bad: Catalogue = { "lower-case": { title: "", what: "w", why: " ", fix: "f" } };
  assertEquals(catalogueProblems(bad, [[/x/, "E1-NONE"]]), ["lower-case is not a stable code", "lower-case has no title", "lower-case has no why", "the pattern /x/ names E1-NONE, which the catalogue does not explain"]);
});

proves(["0003-headless-output FR-009"], "a hint is due when never shown or shown seven days ago, once for each id, and the memory changes only where one is due", () => {
  const h = (id: string) => ({ id, message: id });
  const memory = { seen: 0, new: undefined as number | undefined };
  const at = (now: number, hints = [h("seen")], mem: Record<string, number> = { seen: memory.seen }) => hintsDue(mem, hints, now);
  assertEquals(HINT_DAYS, 7);
  assertEquals(at(6 * DAY + DAY - 1).due, []);
  assertEquals(at(7 * DAY).due.map((x) => x.id), ["seen"]);
  assertEquals(at(7 * DAY).memory, { seen: 7 * DAY });
  const quiet = at(DAY);
  assertEquals(quiet.memory, { seen: 0 });
  const mem = { seen: 0 };
  assert(hintsDue(mem, [h("seen")], DAY).memory === mem, "the same object where none is due");
  assertEquals(hintsDue({}, [h("a"), h("a"), h("b")], 5).due.map((x) => x.id), ["a", "b"]);
  assertEquals(hintsDue({}, [h("a"), h("a"), h("b")], 5).memory, { a: 5, b: 5 });
  assertEquals(distinctHints([h("a"), h("b"), h("a")]).map((x) => x.id), ["a", "b"]);
  // the second run on the same day shows nothing, and a run a week later shows it again
  fc.assert(
    fc.property(fc.nat(100), fc.nat(3), (days, extra) => {
      const first = hintsDue({}, [h("x")], days * DAY);
      assertEquals(first.due.length, 1);
      assertEquals(hintsDue(first.memory, [h("x")], days * DAY + extra * DAY).due.length, extra >= 7 ? 1 : 0);
      assertEquals(hintsDue(first.memory, [h("x")], (days + 7) * DAY).due.length, 1);
    }),
  );
});

proves(["0003-headless-output FR-010"], "a nested run hands its summary to its parent, which reads it back by a decoder and merges it so that every problem is there once", () => {
  assertEquals(nestedNames("my-tool"), { nested: "MY_TOOL_NESTED", summary: "MY_TOOL_SUMMARY" });
  const names = nestedNames("tool");
  assertEquals(childEnv(names, "/tmp/s.json"), { TOOL_NESTED: "1", TOOL_SUMMARY: "/tmp/s.json" });
  assert(isNested(names, (n) => ({ TOOL_NESTED: "1" })[n]) && !isNested(names, () => undefined) && !isNested(names, () => ""));
  const child = outcomeOf(null, { problems: [problem("fail", "f", { code: "E1-F", phase: "p", fix: "tool x", raw: "r", logLine: 2 }), problem("pending", "p")], outcomes: ["Sent"] });
  const summary = summaryOf(child);
  assertEquals([summary.fails, summary.warns, summary.pending, summary.actions], [1, 0, 1, 0]);
  const read = parseSummary(encodeSummary(summary));
  assert(isOk(read));
  if (isOk(read)) assertEquals(read.value, summary);
  const parent = outcomeOf({ p: 1 }, { problems: [problem("warn", "own")] });
  const merged = mergeSummary(parent, summary);
  assertEquals(merged.problems.map((p) => p.message), ["own", "f", "p"]);
  assertEquals([merged.outcomes, merged.data], [["Sent"], { p: 1 }]);
  for (const bad of ["", "not json", "[]", '{"fails":1}', JSON.stringify({ ...summary, problems: [{ level: "bogus", message: "x" }] }), JSON.stringify({ ...summary, fails: 1.5 })]) {
    assert(isErr(parseSummary(bad)), bad);
  }
  fc.assert(
    fc.property(fc.array(fc.record({ level: fc.constantFrom("fail", "warn", "pending", "action" as const), message: fc.string() }), { maxLength: 5 }), (rows) => {
      const o = outcomeOf(null, { problems: rows.map((r) => problem(r.level as "fail", r.message)) });
      const r = parseSummary(encodeSummary(summaryOf(o)));
      assert(isOk(r));
      if (isOk(r)) assertEquals(r.value.problems, o.problems);
    }),
  );
});

proves(["0003-headless-output FR-011"], "every text of an outcome and of its progress passes through the redactor, however deep, and doing it twice is doing it once", () => {
  const redact = redactor(["tok-123456"]);
  const o = outcomeOf(
    { url: "postgres://app:hunter22@db/x", list: ["a tok-123456 b", { deep: "tok-123456" }], n: 3, d: new Date(0) },
    {
      text: "connected with tok-123456",
      problems: [problem("fail", "failed with tok-123456", { fix: "tool login --token tok-123456", raw: "password=hunter22" })],
      outcomes: ["used tok-123456"],
      hints: [{ id: "h", message: "tok-123456", command: "tool tok-123456" }],
      next: ["next: tool tok-123456"],
      findings: [{ ruleId: "r", level: "note", message: "tok-123456" }],
      title: "tok-123456",
    },
  );
  const r = redactOutcome(o, redact);
  assertEquals(JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? String(v) : v)).includes("tok-123456"), false);
  assertEquals(JSON.stringify(r).includes("hunter22"), false);
  assertEquals((r.data as { n: number; d: Date }).n, 3);
  assert((r.data as { d: unknown }).d instanceof Date, "a value that is not a string, an array or a plain object is kept as it is");
  assertEquals(redactOutcome(r, redact), r);
  assertEquals(redactValue(["tok-123456"], redact), ["***"]);
  const events = [
    { kind: "header", title: "tok-123456", subtitle: "tok-123456" },
    { kind: "phase", name: "tok-123456" },
    { kind: "step", n: 1, total: 2, label: "tok-123456" },
    { kind: "item", item: "ok", message: "tok-123456" },
    { kind: "problem", problem: problem("warn", "tok-123456", { fix: "tok-123456" }) },
    { kind: "outcome", text: "tok-123456" },
    { kind: "hint", hint: { id: "h", message: "tok-123456" } },
    { kind: "live", message: "tok-123456" },
    { kind: "done", result: "tok-123456" },
  ] as const;
  for (const e of events) assertEquals(JSON.stringify(redactEvent(e, redact)).includes("tok-123456"), false, e.kind);
});
