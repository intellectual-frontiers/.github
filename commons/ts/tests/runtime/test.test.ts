/**
 * Tests of `runtime/test.ts`: the assertions fail where they should, `proves` keeps what each test proves, a skipped test is skipped,
 * and every test is recorded in memory by the module's own code with its id, file, requirements, risk, times, outcome and reason
 * (0008-test-evidence FR-001, FR-004; the failures, the redaction, the record file and the cancelled test are proven through a run in
 * `test-run.test.ts`).
 *
 * @module
 */
import {
  assert,
  assertArrayIncludes,
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertMatch,
  assertNotEquals,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
  fail,
  onTestRecord,
  proofs,
  proves,
  recorded,
  reviewed,
  reviews,
  test,
} from "../../runtime/test.ts";
import { relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { sha256 } from "../../kernel/sha256.ts";
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
    const argv =
      runtime === "node"
        ? [execPath(), "--test", fixture]
        : runtime === "deno"
          ? [execPath(), "test", "-A", "--no-check", fixture]
          : [execPath(), "test", fixture];
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
