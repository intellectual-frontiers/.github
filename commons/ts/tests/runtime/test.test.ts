/**
 * Tests of `runtime/test.ts`: the assertions fail where they should, `proves` keeps what each test proves, a skipped test is skipped,
 * and every test is recorded in memory by the module's own code with its id, file, requirements, risk, times, outcome and reason
 * (0008-test-evidence FR-001, FR-004; the failures, the redaction, the record file and the cancelled test are proven through a run in
 * `test-run.test.ts`); `only`, steps and the assertions 0005-typescript-runtime FR-060 adds, steps through a child process of this
 * file's own runner where they must fail or where `only` is at stake, as `only` affects a whole file.
 *
 * @module
 */
import {
  assert,
  assertAlmostEquals,
  assertArrayIncludes,
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertMatch,
  assertNotEquals,
  assertNotMatch,
  assertNotStrictEquals,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
  fail,
  ONLY_REASON,
  onTestRecord,
  proofs,
  proves,
  recorded,
  reviewed,
  reviews,
  test,
  the,
} from "../../runtime/test.ts";
import { relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { STEP_SPAN, decodeLines, installationOf } from "../../kernel/test-record.ts";
import { assembleRecord, junitXml, readRecord, tap14, testsOf } from "../../kernel/test-report.ts";
import { parseSpanId, parseTraceId } from "../../kernel/otel.ts";
import { type Equal, expectType } from "@intellectual-frontiers/core";
import { makeTempDir, readTextFile, remove, writeTextFile } from "../../runtime/fs.ts";
import { join } from "../../runtime/path.ts";
import { env, execPath, run, runtimeName } from "../../runtime/proc.ts";

const FR = "0005-typescript-runtime FR-013";

proves([FR], "each assertion passes on what it describes and throws on what it does not", async () => {
  assert(true);
  assertEquals({ a: [1, new Uint8Array([2])] }, { a: [1, new Uint8Array([2])] });
  assertNotEquals({ a: 1 }, { a: 2 });
  assertStrictEquals(Number.NaN, Number.NaN);
  assertExists(0);
  assertInstanceOf(new TypeError("x"), Error);
  assertStringIncludes("hello", "ell");
  assertMatch("v1.2", /\d\.\d/);
  assertArrayIncludes([{ a: 1 }, { b: 2 }], [{ b: 2 }]);
  const cases: (() => void)[] = [
    () => assert(false, "m"),
    () => assertEquals({ a: 1 }, { a: 2 }, "m"),
    () => assertEquals<unknown>(1, "1"),
    () => assertNotEquals(1, 1),
    () => assertStrictEquals({}, {}),
    () => assertExists(null),
    () => assertInstanceOf("x", Error),
    () => assertStringIncludes("a", "b"),
    () => assertMatch("a", /b/),
    () => assertArrayIncludes([1], [2]),
    () => assertThrows(() => 1),
    () =>
      assertThrows(() => {
        throw new Error("x");
      }, TypeError),
    () =>
      assertThrows(
        () => {
          throw new Error("x");
        },
        Error,
        "y",
      ),
    () => fail("always"),
  ];
  for (const c of cases) {
    let threw = false;
    try {
      c();
    } catch {
      threw = true;
    }
    assert(threw, c.toString());
  }
  const e = assertThrows(
    () => {
      throw new RangeError("out of range");
    },
    RangeError,
    "range",
  );
  assertEquals(e.message, "out of range");
  await assertRejects(() => Promise.reject(new TypeError("t")), TypeError, "t");
  let rejected = false;
  await assertRejects(() => Promise.resolve(1)).catch(() => {
    rejected = true;
  });
  assert(rejected);
});

reviewed("example-spec FR-001", "an example of a review declared in code");

proves(
  ["0005-typescript-runtime FR-065", "0005-typescript-runtime FR-014"],
  "the gives the value back narrowed, and fails on null and undefined",
  () => {
    const roles = new Map([["lead", { name: "operator" }]]);
    const lead = the(roles.get("lead"));
    expectType<Equal<typeof lead, { name: string }>>();
    assertEquals(lead.name, "operator");
    assertEquals(the(0), 0);
    assertEquals(the(""), "");
    assertThrows(() => the(roles.get("none")), Error, "expected a value");
    assertThrows(() => the(null, "the lead is named"), Error, "the lead is named");
    const maybe: string | undefined = roles.has("lead") ? "x" : undefined;
    assertExists(maybe);
    expectType<Equal<typeof maybe, string>>();
  },
);

proves([FR], "proves names the test for its requirements and keeps them; reviewed keeps the reason", () => {
  const mine = proofs.find((p) => p.test.endsWith("keeps the reason"));
  assertEquals(mine?.requirements, [FR]);
  assert(mine?.test.startsWith(`${FR}: `) === true);
  assertEquals(reviews.find((r) => r.requirement === "example-spec FR-001")?.reason, "an example of a review declared in code");
});

test("helper: a skipped test is not run", () => fail("a skipped test ran"), { skip: "it is skipped on purpose" });
test(
  "helper: a test with a timeout runs",
  async () => {
    await Promise.resolve();
  },
  { timeout: 10_000 },
);

const EV = (n: string): string => `0008-test-evidence FR-${n}`;
const HERE = relative(process.cwd(), fileURLToPath(import.meta.url)).replaceAll("\\", "/");
const heard: string[] = [];
const stopListening = onTestRecord((e) => heard.push(e.test.name));

test("helper: a recorded test of high risk", () => assertEquals(1, 1), { risk: "high" });
test("helper: a todo test is not run", () => fail("a todo test ran"), { todo: "not written yet" });
test("helper: a test recorded under the file given", () => undefined, { file: "elsewhere\\x.test.ts" });

proves(
  [EV("001"), EV("004")],
  "each test is recorded in memory: id, file from the caller, requirements, risk, times, outcome and reason",
  async () => {
    stopListening();
    const find = (name: string) => recorded.find((r) => r.name === name);
    const high = find("helper: a recorded test of high risk");
    assertExists(high);
    assertEquals([high.outcome, high.risk, high.file, high.attempt], ["pass", "high", HERE, 1]);
    assertEquals(high.id, await sha256(`${HERE}\0helper: a recorded test of high risk`));
    assert(high.start > 1_600_000_000_000_000_000n && high.end >= high.start);
    const skipped = find("helper: a skipped test is not run");
    assertEquals([skipped?.outcome, skipped?.reason], ["skip", "it is skipped on purpose"]);
    const todo = find("helper: a todo test is not run");
    assertEquals([todo?.outcome, todo?.reason], ["todo", "not written yet"]);
    assertEquals(find("helper: a test recorded under the file given")?.file, "elsewhere/x.test.ts");
    const proving = find(`${FR}: proves names the test for its requirements and keeps them; reviewed keeps the reason`);
    assertEquals([proving?.requirements, proving?.risk, proving?.outcome], [[FR], "not-high", "pass"]);
    assert(heard.includes("helper: a recorded test of high risk"));
  },
);

const url = (rel: string): string => JSON.stringify(new URL(rel, import.meta.url).href);
const PIPED = `
import { appendFileSync } from "node:fs";
import process from "node:process";
import { createPipeline, install } from ${url("../../runtime/otel.ts")};
import { reviewed, test } from ${url("../../runtime/test.ts")};
const out = process.env["PIPE_OUT"] ?? "";
const done = () => Promise.resolve({ kind: "done" });
install(createPipeline({ resource: { attributes: {} }, processors: [{
  onEnd: (s, src) => appendFileSync(out, "span " + s.name + " " + String(s.attributes["test.case.name"]) + " " + src.scope.name + "\\n"),
  onLog: (r) => appendFileSync(out, "log " + (r.eventName ?? "") + "\\n"),
  forceFlush: done,
  shutdown: done,
}] }));
reviewed("fixture FR-001", "why");
test("piped", () => undefined);
`;

proves([EV("004")], "without IFC_TEST_RECORD, each test goes to the installed pipeline", async () => {
  const dir = await makeTempDir({ prefix: "ifc-test-piped-" });
  try {
    const fixture = join(dir, "piped.test.ts");
    await writeTextFile(fixture, PIPED);
    const out = join(dir, "out.txt");
    await writeTextFile(out, "");
    const vars = env.toObject();
    for (const k of ["IFC_TEST_RECORD", "NODE_TEST_CONTEXT", "TRACEPARENT"]) Reflect.deleteProperty(vars, k);
    const runtime = runtimeName();
    const argv = runtime === "node" ? [execPath(), "--test", fixture] : [execPath(), "test", fixture];
    const r = await run(argv, { cwd: dir, env: { ...vars, PIPE_OUT: out }, clearEnv: true });
    assertEquals(r.code, 0, r.stderr);
    assertEquals(
      (await readTextFile(out)).split("\n").filter((l) => l !== ""),
      ["log ifc.test.review", "span test piped ifc-test", "log ifc.test.case"],
    );
  } finally {
    await remove(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------------------------------------------------------- FR-060

const F60 = "0005-typescript-runtime FR-060";

proves([F60], "assertAlmostEquals, assertNotMatch and assertNotStrictEquals keep @std/assert's meaning", () => {
  assertAlmostEquals(0.1 + 0.2, 0.3);
  assertAlmostEquals(Number.NaN, Number.NaN);
  assertAlmostEquals(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  assertAlmostEquals(10, 10.5, 0.5);
  assertAlmostEquals(1, 1 + 1e-8);
  assertNotMatch("abc", /d/);
  assertNotStrictEquals({}, {});
  assertNotStrictEquals(0, -0);
  const refused: (() => void)[] = [
    () => assertAlmostEquals(1, 1.1),
    () => assertAlmostEquals(1, 1 + 1e-6),
    () => assertAlmostEquals(10, 10.6, 0.5, "m"),
    () => assertAlmostEquals(Number.NaN, 1),
    () => assertAlmostEquals(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
    () => assertNotMatch("abc", /b/),
    () => assertNotMatch("abc", /b/, "m"),
    () => assertNotStrictEquals(1, 1),
    () => assertNotStrictEquals(Number.NaN, Number.NaN, "m"),
  ];
  for (const r of refused) assertThrows(r, Error, undefined);
  const e = assertThrows(() => assertAlmostEquals(1, 1.5, 0.25, "why"));
  assertEquals(e.message, 'Expected actual: "1" to be close to "1.5e+0": delta "5e-1" is greater than "2.5e-1": why');
});

test("helper: a test with steps", async (t) => {
  await t.step("first", () => assertEquals(1, 1));
  await t.step("second", async (s) => {
    await s.step("inner", () => undefined);
  });
});

test("helper: a test that skips itself", async (t) => {
  await t.step("a step that skips itself", (s) => s.skip());
  t.skip("it has nothing to do here");
});

proves(
  [F60],
  "each step is a subtest, awaited, and recorded in its test's evidence with its own steps; t.skip marks either skipped",
  () => {
    const self = recorded.find((r) => r.name === "helper: a test that skips itself");
    assertEquals(
      [self?.outcome, self?.reason, self?.steps?.map((s) => [s.name, s.outcome])],
      ["skip", "it has nothing to do here", [["a step that skips itself", "skip"]]],
    );
    const stepped = recorded.find((r) => r.name === "helper: a test with steps");
    assertExists(stepped);
    assertEquals(stepped.outcome, "pass");
    assertEquals(
      stepped.steps?.map((s) => [s.name, s.outcome, s.steps?.map((i) => [i.name, i.outcome])]),
      [
        ["first", "pass", undefined],
        ["second", "pass", [["inner", "pass"]]],
      ],
    );
    for (const s of stepped.steps ?? []) assert(s.start >= stepped.start && s.end <= stepped.end && s.end >= s.start);
  },
);

/** This runtime's runner over one file, with extra flags (`--test-only` for Node). */
function runner(file: string, extra: readonly string[] = []): string[] {
  const runtime = runtimeName();
  return runtime === "node" ? [execPath(), "--test", ...extra, file] : [execPath(), "test", ...extra, file];
}

/** The environment of a child runner: this one's, without the variables of this run's own record and runner. */
function childEnv(extra: Readonly<Record<string, string>>): Record<string, string> {
  const vars = env.toObject();
  for (const k of ["IFC_TEST_RECORD", "NODE_TEST_CONTEXT", "TRACEPARENT", "TRACESTATE"]) Reflect.deleteProperty(vars, k);
  return { ...vars, ...extra };
}

const ONLY = `
import { appendFileSync } from "node:fs";
import process from "node:process";
import { proves, test } from ${url("../../runtime/test.ts")};
const ran = (n) => appendFileSync(process.env["ONLY_OUT"] ?? "", n + "\\n");
test("before", () => ran("before"));
proves(["fixture FR-001"], "alone", async (t) => { await t.step("its step", () => ran("step")); ran("alone"); }, { only: true });
test("after", () => ran("after"));
test("skipped anyway", () => ran("skipped"), { skip: "on purpose" });
`;

proves([F60], "a test marked only runs alone on this runner, and the others of its file are recorded as skipped", async () => {
  const dir = await makeTempDir({ prefix: "ifc-test-only-" });
  try {
    const fixture = join(dir, "only.test.ts");
    await writeTextFile(fixture, ONLY);
    const flags: readonly (readonly string[])[] = runtimeName() === "node" ? [[], ["--test-only"]] : [[]];
    for (const extra of flags) {
      const out = join(dir, "out.txt");
      const record = join(dir, "record.jsonl");
      await writeTextFile(out, "");
      await writeTextFile(record, "");
      const r = await run(runner(fixture, extra), {
        cwd: dir,
        env: childEnv({ ONLY_OUT: out, IFC_TEST_RECORD: record }),
        clearEnv: true,
      });
      assertEquals(r.code, 0, `${extra.join(" ")}\n${r.stdout}\n${r.stderr}`);
      assertEquals(
        (await readTextFile(out)).split("\n").filter((l) => l !== ""),
        ["step", "alone"],
        extra.join(" "),
      );
      const lines = decodeLines(await readTextFile(record));
      assert(lines.kind === "ok");
      const tests = testsOf(lines.value);
      assert(tests.kind === "ok");
      assertEquals(
        tests.value.map((t) => [t.name, t.outcome, t.reason]),
        [
          ["after", "skip", ONLY_REASON],
          ["before", "skip", ONLY_REASON],
          ["fixture FR-001: alone", "pass", undefined],
          ["skipped anyway", "skip", "on purpose"],
        ],
      );
      assertEquals(
        tests.value[2]?.steps?.map((s) => [s.name, s.outcome]),
        [["its step", "pass"]],
      );
    }
  } finally {
    await remove(dir, { recursive: true });
  }
});

const STEPS = `
import { test } from ${url("../../runtime/test.ts")};
test("stepped", async (t) => {
  await t.step("passes", () => undefined);
  await t.step("outer", async (o) => {
    await o.step("fails", () => { throw new Error("the step broke"); });
  });
  throw new Error("never reached");
});
`;

proves(
  [F60],
  "a failed step fails its test with its error; each step is a span under its test's span and the reports show it",
  async () => {
    const dir = await makeTempDir({ prefix: "ifc-test-steps-" });
    try {
      const fixture = join(dir, "steps.test.ts");
      await writeTextFile(fixture, STEPS);
      const record = join(dir, "record.jsonl");
      await writeTextFile(record, "");
      const r = await run(runner(fixture), { cwd: dir, env: childEnv({ IFC_TEST_RECORD: record }), clearEnv: true });
      assertNotEquals(r.code, 0);
      const lines = decodeLines(await readTextFile(record));
      assert(lines.kind === "ok");
      const spans = lines.value.traces.flatMap((b) => b.spans);
      const testSpan = spans.find((s) => s.name === "test");
      assertExists(testSpan);
      const steps = spans.filter((s) => s.name === STEP_SPAN);
      const byName = (n: string) => steps.find((s) => s.attributes["ifc.test.step.name"] === n);
      assertEquals(byName("passes")?.parentSpanId, testSpan.context.spanId);
      assertEquals(byName("outer")?.parentSpanId, testSpan.context.spanId);
      assertEquals(byName("fails")?.parentSpanId, byName("outer")?.context.spanId);
      assertEquals([byName("fails")?.attributes["ifc.test.outcome"], byName("fails")?.status.kind], ["fail", "error"]);
      assertEquals(testSpan.attributes["ifc.test.steps"], ["passes", "outer > fails", "outer"]);
      assertEquals([testSpan.attributes["ifc.test.outcome"], testSpan.attributes["ifc.test.message"]], ["fail", "the step broke"]);

      const traceId = parseTraceId("4bf92f3577b34da6a3ce929d0e0e4736");
      const spanId = parseSpanId("00f067aa0ba902b7");
      assert(traceId.kind === "ok" && spanId.kind === "ok");
      const resource = lines.value.traces[0]?.resource;
      assertExists(resource);
      const assembled = assembleRecord({
        traceId: traceId.value,
        spanId: spanId.value,
        start: testSpan.startTime,
        end: testSpan.endTime,
        runner: installationOf(resource),
        signals: lines.value,
        runners: [{ kind: "exited", runtime: runtimeName(), code: r.code }],
        required: [],
      });
      assert(assembled.kind === "ok");
      const read = readRecord(assembled.value.record);
      assert(read.kind === "ok");
      assertEquals(
        read.value.tests[0]?.steps?.map((s) => [s.name, s.outcome, s.steps?.map((i) => [i.name, i.outcome, i.message])]),
        [
          ["passes", "pass", undefined],
          ["outer", "fail", [["fails", "fail", "the step broke"]]],
        ],
      );
      const tap = tap14(read.value);
      assertStringIncludes(tap, "        # Subtest: stepped\n        1..2\n        ok 1 - passes\n");
      assertStringIncludes(tap, "            # Subtest: outer\n            1..1\n            not ok 1 - fails # the step broke\n");
      assertStringIncludes(tap, "        not ok 2 - outer # the step broke\n    not ok 1 - stepped\n");
      const junit = junitXml(read.value);
      assertStringIncludes(junit, '<property name="step" value="pass passes"/>');
      assertStringIncludes(junit, '<property name="step" value="fail outer &gt; fails"/>');
    } finally {
      await remove(dir, { recursive: true });
    }
  },
);
