/**
 * Tests that run unchanged under `deno test`, `node --test` and `bun test` (commons 0005-typescript-runtime FR-013): registration on
 * `node:test`, assertions on `node:assert/strict`, with the names of `@std/assert` so a conversion is a rename. `proves` names the
 * requirements a test proves, as erga's kernel `test.ts` does, and keeps them for a report. Kept out of `./mod.ts`, so that importing the
 * runtime never loads a test runner.
 *
 * Every test registered here is recorded by this module's own code, not by a runner's reporter (commons 0008-test-evidence FR-001 to
 * FR-004): its id (the SHA-256 of its file and name), file, name, requirements, risk (the option `risk`, `not-high` by default), start and
 * end, outcome (`pass`, `fail`, `skip`, `todo` or `cancelled`), a skip's or todo's reason, a failure's message, expected and actual values
 * (redacted and cut to 4096 characters) and attempt (`IFC_TEST_ATTEMPT`, 1 by default), as a `test` span and a log record whose parent is
 * the run's span from `TRACEPARENT`, on a resource that is the installation record. Where `IFC_TEST_RECORD` names a file, each test's
 * records are appended to it as OTLP JSON lines as it starts and as it ends, and a test that has not ended when the process exits is
 * appended as `cancelled`; otherwise they are kept in memory (`recorded`) and given to each listener (`onTestRecord`). The file of a test
 * is the file that called `test` or `proves`, from the call's stack, relative to the working folder, or the option `file`. A test's
 * outcome is never changed by its recording: a failure is still thrown to the runner.
 *
 * A test's body is given a context `t` whose `t.step(name, fn)` runs a step as a subtest of `node:test` (`TestContext.test`), awaited, and
 * records it in the test's evidence (commons 0005-typescript-runtime FR-060): a `test step` span, a child of the test's span (or of the
 * step it is in), as it ends, and the test's `steps`, which its `test` span names in `ifc.test.steps`. A step that fails fails its test
 * with the step's error, on every runner, so that the test's record says why.
 *
 * `only` runs a test alone among the tests of its file (FR-060). Each runner is given `node:test`'s `only`, and this module also skips
 * the other tests of the file itself, so that "the one marked only runs alone" holds on each runner, and each of the others is recorded
 * as `skip` with the reason `ONLY_REASON`:
 * - `node --test --test-only` and `deno test` run only the tests marked `only`, of themselves;
 * - `node --test` without `--test-only` (Node 26 then says "'only' and 'runOnly' require the --test-only command-line option") and
 *   `bun test` (Bun's `node:test` ignores `only`) run every test: the others then skip themselves, and a runner shows them as passed
 *   (Bun, Deno) or skipped (Node);
 * - `bun test --only` runs no test of `node:test` at all, `only` or not, as its `node:test` never marks one: give `bun test` no `--only`.
 * The others of the file are those registered before the first test marked `only` that have not started, and every one registered after
 * it; `bun test` loads every file in one process, so the mark is kept for each file, never for the process.
 *
 * @example
 * ```ts
 * import { assertEquals, proves } from "./test.ts";
 * proves(["0005-typescript-runtime FR-013"], "one and one", () => assertEquals(1 + 1, 2));
 * proves(["0008-test-evidence FR-001"], "a high-risk test", () => assertEquals(2 * 2, 4), { risk: "high" });
 * ```
 *
 * @module
 */
import nodeAssert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import process from "node:process";
import { test as nodeTest, type TestContext as NodeTestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { extractContext, redactText, type Resource, type SpanId, spanIdFrom, type TraceId, traceIdFrom } from "../kernel/otel.ts";
import {
  cut,
  installationFromEnv,
  installationResource,
  recordLine,
  recordPath,
  type Review,
  type Risk,
  type StepOutcome,
  type TestCase,
  type TestContext,
  type TestStep,
  testStepSpan,
  TEST_SCOPE,
  testCaseLog,
  testCaseSpan,
  testStartLog,
  reviewLog,
  warningLog,
} from "../kernel/test-record.ts";
import { installed } from "./otel.ts";
import { build, runtimeName, runtimeVersion } from "./proc.ts";

/**
 * What a test's body, or a step's, is given (FR-060): its `name`; `step`, which runs a step as a subtest of `node:test`, awaited, and
 * records it in the test's evidence (a step that fails rejects with its error, so that the test fails with it); and `skip`, which marks
 * the test or the step skipped, with the reason, when its body returns (the body itself returns: `skip` does not stop it).
 */
export type StepContext = {
  readonly name: string;
  readonly step: (name: string, fn: StepFn) => Promise<void>;
  readonly skip: (reason?: string) => void;
};

/** A step's body, given its own context for the steps within it. */
export type StepFn = (t: StepContext) => void | Promise<void>;

/** A test's body; it may take the context `t` for its steps. */
export type TestFn = (t: StepContext) => void | Promise<void>;

/**
 * How to run a test: `skip` it or mark it `todo` (with the reason as a string; neither runs its body), run it alone among the tests of
 * its file (`only`), give it a `timeout` in milliseconds (a test that does not end by then is `cancelled`), its `risk` (`not-high` by
 * default), or the `file` it is recorded under.
 */
export type TestOptions = {
  readonly skip?: boolean | string;
  readonly todo?: boolean | string;
  readonly only?: boolean;
  readonly timeout?: number;
  readonly risk?: Risk;
  readonly file?: string;
};

/** The reason a test is recorded as skipped where another test of its file is marked `only` (FR-060). */
export const ONLY_REASON = "another test of this file is marked only";

/** A requirement cited by its specification and number: `0005-typescript-runtime FR-013`, or another repository's `erga 241-typescript-first FR-015`. */
export type Requirement = string;

/** The requirements each test proves, in the order the tests were registered, for a report. */
export const proofs: { readonly test: string; readonly requirements: readonly Requirement[] }[] = [];

/** The requirements declared as proven by review rather than a test, with the reason. */
export const reviews: { readonly requirement: Requirement; readonly reason: string }[] = [];

/** Every test of this process as it was recorded, in the order they ended (skipped and todo tests as they were registered) (FR-004). */
export const recorded: TestCase[] = [];

/** What a listener is given for each test that ends: the case, and the resource and context its signals carry. */
export type TestRecordEvent = { readonly test: TestCase; readonly resource: Resource; readonly context: TestContext };

const listeners: ((e: TestRecordEvent) => void)[] = [];

/**
 * A listener given each test as it ends, beside `recorded` and `IFC_TEST_RECORD`: where an OpenTelemetry pipeline is installed, it hands
 * `testCaseSpan` and `testCaseLog` of the event to its processors (0008-test-evidence FR-004). Returns the function that removes it.
 */
export function onTestRecord(listener: (e: TestRecordEvent) => void): () => void {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- the process's record

type Session = {
  readonly traceId: TraceId;
  readonly parentSpanId?: SpanId;
  readonly resource: Resource;
  readonly file: string | undefined;
  readonly attempt: number;
};

let session: Session | undefined;

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

function newSpanId(): SpanId {
  for (;;) {
    const s = spanIdFrom(randomBytes(8));
    if (s.kind === "ok") return s.value;
  }
}

function newTraceId(): TraceId {
  for (;;) {
    const t = traceIdFrom(randomBytes(16));
    if (t.kind === "ok") return t.value;
  }
}

function nowNanos(): bigint {
  return BigInt(Math.round((performance.timeOrigin + performance.now()) * 1000)) * 1000n;
}

function append(line: string): void {
  const file = current().file;
  if (file === undefined) return;
  try {
    appendFileSync(file, `${line}\n`);
  } catch {
    // A record that cannot be written never changes the test's outcome; the run sees the test as missing.
  }
}

function current(): Session {
  if (session !== undefined) return session;
  const env = process.env;
  const parent = extractContext(env["TRACEPARENT"], env["TRACESTATE"]);
  const { installation, warnings } = installationFromEnv(
    { runtime: runtimeName(), runtimeVersion: runtimeVersion(), os: build.os, arch: build.arch },
    env,
  );
  const attempt = Number(env["IFC_TEST_ATTEMPT"] ?? "1");
  const file = env["IFC_TEST_RECORD"]?.trim();
  session = {
    traceId: parent?.traceId ?? newTraceId(),
    ...(parent === undefined ? {} : { parentSpanId: parent.spanId }),
    resource: installationResource(installation),
    file: file === undefined || file === "" ? undefined : file,
    attempt: Number.isSafeInteger(attempt) && attempt >= 1 ? attempt : 1,
  };
  if (warnings.length > 0) append(recordLine(session.resource, { records: warnings.map((w) => warningLog(w, nowNanos())) }));
  return session;
}

function contextFor(spanId: SpanId): TestContext {
  const s = current();
  return { traceId: s.traceId, spanId, ...(s.parentSpanId === undefined ? {} : { parentSpanId: s.parentSpanId }) };
}

function emit(test: TestCase, spanId: SpanId): void {
  const s = current();
  const context = contextFor(spanId);
  recorded.push(test);
  if (s.file !== undefined) {
    append(recordLine(s.resource, { spans: [testCaseSpan(test, context)] }));
    append(recordLine(s.resource, { records: [testCaseLog(test, context)] }));
  } else {
    // Without IFC_TEST_RECORD, the test goes to the installed pipeline, if any (0008-test-evidence FR-004).
    const pipeline = installed();
    if (pipeline !== undefined) {
      const source = { resource: s.resource, scope: TEST_SCOPE };
      pipeline.emit({ kind: "span", span: testCaseSpan(test, context) }, source);
      pipeline.emit({ kind: "log", record: testCaseLog(test, context) }, source);
    }
  }
  for (const l of listeners) {
    try {
      l({ test, resource: s.resource, context });
    } catch {
      // A listener's failure never changes a test's outcome.
    }
  }
}

function emitStep(step: TestStep, test: Pick<TestCase, "id" | "file" | "name">, spanId: SpanId, parentSpanId: SpanId): void {
  const s = current();
  const span = testStepSpan(step, test, { traceId: s.traceId, spanId, parentSpanId });
  if (s.file !== undefined) append(recordLine(s.resource, { spans: [span] }));
  else installed()?.emit({ kind: "span", span }, { resource: s.resource, scope: TEST_SCOPE });
}

type Running = { readonly base: Omit<TestCase, "end" | "outcome">; readonly spanId: SpanId };

const running = new Map<SpanId, Running>();
let exitHooked = false;

function onExit(): void {
  for (const [spanId, r] of [...running.entries()]) {
    running.delete(spanId);
    emit({ ...r.base, end: nowNanos(), outcome: "cancelled", reason: "the process exited before the test ended" }, spanId);
  }
}

function hookExit(): void {
  if (exitHooked) return;
  exitHooked = true;
  process.on("exit", onExit);
  // Deno does not emit the process's `exit` event under `deno test`; it dispatches the web's `unload` event on the global scope.
  const g: unknown = globalThis;
  if (typeof g === "object" && g !== null && "addEventListener" in g && typeof g.addEventListener === "function") {
    try {
      Reflect.apply(g.addEventListener, g, ["unload", onExit]);
    } catch {
      // No `unload` here; the run closes the test from its start mark.
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- the test's file

const reals = new Map<string, string>();
const SELF = normalise(import.meta.url);

function normalise(location: string): string {
  let path = location;
  if (path.startsWith("file:")) {
    try {
      path = fileURLToPath(path);
    } catch {
      return path;
    }
  }
  return real(isAbsolute(path) ? path : resolve(path));
}

/** A path with its links resolved (macOS's `/var` is `/private/var`, and a stack may name either), or as given where it does not resolve. */
function real(path: string): string {
  const known = reals.get(path);
  if (known !== undefined) return known;
  let r = path;
  try {
    r = realpathSync(path);
  } catch {
    // A path that is not there (an eval's) is kept as it is.
  }
  reals.set(path, r);
  return r;
}

const FRAME = /(?:\(|at\s+)((?:file:\/\/)?[^()\s]+?):\d+:\d+\)?\s*$/;

/** The file of the code that called into this module, relative to the working folder with `/`, from the call's stack. */
function callerFile(): string {
  const stack = new Error("where").stack ?? "";
  for (const line of stack.split("\n").slice(1)) {
    const m = FRAME.exec(line.trim());
    const location = m?.[1];
    if (location === undefined || location.startsWith("node:") || location.startsWith("ext:")) continue;
    const path = normalise(location);
    if (path === SELF) continue;
    return recordPath(relative(real(process.cwd()), path));
  }
  return "unknown";
}

// ---------------------------------------------------------------------------------------------------------------------------- recording

function testIdOf(file: string, name: string): string {
  return createHash("sha256").update(`${file}\0${name}`).digest("hex");
}

function shown(value: unknown): string {
  return cut(
    redactText(typeof value === "string" ? value : inspect(value, { depth: 6, sorted: true, breakLength: 100, maxStringLength: 8192 })),
  );
}

function failure(e: unknown): Pick<TestCase, "message" | "expected" | "actual"> {
  const message = cut(redactText(e instanceof Error ? e.message : String(e)));
  const assertion =
    e instanceof Error &&
    (e.name === "AssertionError" || ("code" in e && e.code === "ERR_ASSERTION")) &&
    "operator" in e &&
    e.operator !== "fail" &&
    e.operator !== undefined;
  if (!assertion || !("expected" in e) || !("actual" in e)) return { message };
  return { message, expected: shown(e.expected), actual: shown(e.actual) };
}

class TimedOut extends Error {
  /** How long the test was given. */
  readonly ms: number;
  constructor(ms: number) {
    super(`the test did not end within ${ms} ms`);
    this.name = "TimedOut";
    this.ms = ms;
  }
}

async function within(fn: () => void | Promise<void>, ms: number | undefined): Promise<void> {
  if (ms === undefined) {
    await fn();
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(fn),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimedOut(ms)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * The context of a test or a step (FR-060): each step is a subtest of `node:test` on `node`, the runner's context, and is recorded in
 * `into` and as a span whose parent is `parent` (the test's span or the enclosing step's), as it ends.
 */
function stepContext(
  name: string,
  node: NodeTestContext,
  test: Pick<TestCase, "id" | "file" | "name">,
  testSpanId: SpanId,
  parent: SpanId,
  into: TestStep[],
  skipped: (reason: string | undefined) => void,
): StepContext {
  const step = async (stepName: string, fn: StepFn): Promise<void> => {
    if (!running.has(testSpanId))
      throw new Error(`the step ${JSON.stringify(stepName)} ran after its test ${JSON.stringify(test.name)} ended`);
    const spanId = newSpanId();
    const start = nowNanos();
    const inner: TestStep[] = [];
    let ran = false;
    let skippedHere = false;
    let thrown: { readonly error: unknown } | undefined;
    await node.test(stepName, async (sub: NodeTestContext) => {
      ran = true;
      try {
        await fn(
          stepContext(stepName, sub, test, testSpanId, spanId, inner, () => {
            skippedHere = true;
          }),
        );
      } catch (e) {
        thrown = { error: e };
        throw e;
      }
    });
    const outcome: StepOutcome = thrown !== undefined ? "fail" : ran && !skippedHere ? "pass" : "skip";
    const recordedStep: TestStep = {
      name: stepName,
      start,
      end: nowNanos(),
      outcome,
      ...(thrown === undefined ? {} : { message: failure(thrown.error).message }),
      ...(inner.length === 0 ? {} : { steps: inner }),
    };
    into.push(recordedStep);
    emitStep(recordedStep, test, spanId, parent);
    if (thrown !== undefined) throw thrown.error;
  };
  const skip = (reason?: string): void => {
    skipped(reason);
    if (typeof node.skip === "function") node.skip(reason);
  };
  return { name, step, skip };
}

async function runCase(
  base: Omit<TestCase, "start" | "end" | "outcome" | "attempt">,
  fn: TestFn,
  timeout: number | undefined,
  node: NodeTestContext,
): Promise<void> {
  hookExit();
  const spanId = newSpanId();
  const started = { ...base, start: nowNanos(), attempt: current().attempt };
  running.set(spanId, { base: started, spanId });
  if (current().file !== undefined) append(recordLine(current().resource, { records: [testStartLog(started, contextFor(spanId))] }));
  const steps: TestStep[] = [];
  const withSteps = (): { readonly steps?: readonly TestStep[] } => (steps.length === 0 ? {} : { steps: [...steps] });
  let skipped: { readonly reason: string | undefined } | undefined;
  const context = stepContext(base.name, node, base, spanId, spanId, steps, (reason) => {
    skipped = { reason: reason === undefined ? undefined : reasonOf(reason) };
  });
  try {
    await within(() => fn(context), timeout);
  } catch (e) {
    if (running.delete(spanId)) {
      emit(
        e instanceof TimedOut
          ? { ...started, end: nowNanos(), outcome: "cancelled", reason: e.message, ...withSteps() }
          : { ...started, end: nowNanos(), outcome: "fail", ...failure(e), ...withSteps() },
        spanId,
      );
    }
    throw e;
  }
  if (!running.delete(spanId)) return;
  const reason = skipped?.reason;
  emit(
    skipped === undefined
      ? { ...started, end: nowNanos(), outcome: "pass", ...withSteps() }
      : { ...started, end: nowNanos(), outcome: "skip", ...(reason === undefined ? {} : { reason }), ...withSteps() },
    spanId,
  );
}

function reasonOf(v: boolean | string): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? cut(redactText(v)) : undefined;
}

/** A test of a file waiting to run, until a test of the file is marked `only` and it is skipped. */
type Waiting = { started: boolean; skipped: boolean; readonly skip: () => void };

/** For each file, whether a test of it is marked `only`, and its tests that have not started (FR-060). */
const onlyOf = new Map<string, { marked: boolean; readonly waiting: Set<Waiting> }>();

function onlyState(file: string): { marked: boolean; readonly waiting: Set<Waiting> } {
  const known = onlyOf.get(file);
  if (known !== undefined) return known;
  const state = { marked: false, waiting: new Set<Waiting>() };
  onlyOf.set(file, state);
  return state;
}

function register(name: string, requirements: readonly Requirement[], fn: TestFn, options: TestOptions, file: string): void {
  const base = { id: testIdOf(file, name), file, name, requirements: [...requirements], risk: options.risk ?? "not-high" };
  const notRun = (outcome: "skip" | "todo", v: boolean | string): void => {
    const at = nowNanos();
    const reason = reasonOf(v);
    emit({ ...base, start: at, end: at, outcome, attempt: current().attempt, ...(reason === undefined ? {} : { reason }) }, newSpanId());
  };
  if (options.todo !== undefined && options.todo !== false) {
    notRun("todo", options.todo);
    void nodeTest(name, { todo: options.todo }, () => undefined);
    return;
  }
  if (options.skip !== undefined && options.skip !== false) {
    notRun("skip", options.skip);
    void nodeTest(name, { skip: options.skip }, () => undefined);
    return;
  }
  const state = onlyState(file);
  const only = options.only === true;
  if (only && !state.marked) {
    state.marked = true;
    for (const w of state.waiting) {
      if (w.started) continue;
      w.skipped = true;
      w.skip();
    }
    state.waiting.clear();
  } else if (!only && state.marked) {
    notRun("skip", ONLY_REASON);
    void nodeTest(name, { skip: ONLY_REASON }, () => undefined);
    return;
  }
  const waiting: Waiting | undefined = only ? undefined : { started: false, skipped: false, skip: () => notRun("skip", ONLY_REASON) };
  if (waiting !== undefined) state.waiting.add(waiting);
  const body = (t: NodeTestContext): Promise<void> => {
    if (waiting !== undefined) {
      state.waiting.delete(waiting);
      if (waiting.skipped) {
        // Recorded as skipped when the test marked only was registered; the runner is told where it can be.
        if (typeof t.skip === "function") t.skip(ONLY_REASON);
        return Promise.resolve();
      }
      waiting.started = true;
    }
    return runCase(base, fn, options.timeout, t);
  };
  void nodeTest(name, { ...(options.timeout === undefined ? {} : { timeout: options.timeout }), ...(only ? { only: true } : {}) }, body);
}

/** A test registered with the runtime's runner, and recorded (0008-test-evidence FR-001). */
export function test(name: string, fn: TestFn, options: TestOptions = {}): void {
  register(name, [], fn, options, options.file === undefined ? callerFile() : recordPath(options.file));
}

/** A test that proves one or more requirements, named for them: `0005-typescript-runtime FR-013: <name>`. */
export function proves(requirements: readonly [Requirement, ...Requirement[]], name: string, fn: TestFn, options: TestOptions = {}): void {
  const full = `${requirements.join(", ")}: ${name}`;
  proofs.push({ test: full, requirements });
  register(full, requirements, fn, options, options.file === undefined ? callerFile() : recordPath(options.file));
}

/** A requirement proven by review rather than by a test, with the reason; recorded as an `ifc.test.review` log record (0008-test-evidence FR-006). */
export function reviewed(requirement: Requirement, reason: string): void {
  reviews.push({ requirement, reason });
  const r: Review = { requirement, reason };
  const s = current();
  const record = reviewLog(r, nowNanos(), s.traceId);
  if (s.file !== undefined) append(recordLine(s.resource, { records: [record] }));
  else installed()?.emit({ kind: "log", record }, { resource: s.resource, scope: TEST_SCOPE });
}

/** Fails unless `value` is truthy; narrows its type. */
export function assert(value: unknown, message?: string): asserts value {
  if (message === undefined) nodeAssert.ok(value);
  else nodeAssert.ok(value, message);
}

/** Fails unless the two are deeply and strictly equal (the same types, prototypes and values). */
export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (message === undefined) nodeAssert.deepStrictEqual(actual, expected);
  else nodeAssert.deepStrictEqual(actual, expected, message);
}

/** Fails where the two are deeply and strictly equal. */
export function assertNotEquals<T>(actual: T, expected: T, message?: string): void {
  if (message === undefined) nodeAssert.notDeepStrictEqual(actual, expected);
  else nodeAssert.notDeepStrictEqual(actual, expected, message);
}

/** Fails unless the two are the same value (`Object.is`). */
export function assertStrictEquals<T>(actual: T, expected: T, message?: string): void {
  if (message === undefined) nodeAssert.strictEqual(actual, expected);
  else nodeAssert.strictEqual(actual, expected, message);
}

/** Fails unless the value is neither `null` nor `undefined`; narrows its type. */
export function assertExists<T>(value: T, message?: string): asserts value is NonNullable<T> {
  nodeAssert.ok(value !== null && value !== undefined, message ?? "expected a value, found null or undefined");
}

/** Fails unless the value is an instance of the class; narrows its type. */
export function assertInstanceOf<T>(value: unknown, Class: abstract new (...args: never[]) => T, message?: string): asserts value is T {
  nodeAssert.ok(value instanceof Class, message ?? `expected an instance of ${Class.name}`);
}

/** Fails unless the text includes the part. */
export function assertStringIncludes(actual: string, expected: string, message?: string): void {
  nodeAssert.ok(actual.includes(expected), message ?? `expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`);
}

/** Fails unless the two are different values (`Object.is`), as `@std/assert`'s `assertNotStrictEquals` (FR-060). */
export function assertNotStrictEquals<T>(actual: T, expected: T, message?: string): void {
  if (message === undefined) nodeAssert.notStrictEqual(actual, expected);
  else nodeAssert.notStrictEqual(actual, expected, message);
}

/**
 * Fails unless the two numbers are within `tolerance` of each other (`1e-7` by default), as `@std/assert`'s `assertAlmostEquals`
 * (FR-060): the same value (`Object.is`, so `NaN` is close to `NaN` and an infinity to itself) passes, else `|expected - actual|` must not
 * exceed the tolerance.
 */
export function assertAlmostEquals(actual: number, expected: number, tolerance = 1e-7, message?: string): void {
  if (Object.is(actual, expected)) return;
  const delta = Math.abs(expected - actual);
  if (delta <= tolerance) return;
  const f = (n: number): string => (Number.isInteger(n) ? String(n) : n.toExponential());
  throw new nodeAssert.AssertionError({
    message: `Expected actual: "${f(actual)}" to be close to "${f(expected)}": delta "${f(delta)}" is greater than "${f(tolerance)}"${
      message === undefined ? "." : `: ${message}`
    }`,
    actual,
    expected,
    operator: "assertAlmostEquals",
  });
}

/** Fails where the text matches the pattern, as `@std/assert`'s `assertNotMatch` (FR-060). */
export function assertNotMatch(actual: string, pattern: RegExp, message?: string): void {
  if (message === undefined) nodeAssert.doesNotMatch(actual, pattern);
  else nodeAssert.doesNotMatch(actual, pattern, message);
}

/** Fails unless the text matches the pattern. */
export function assertMatch(actual: string, pattern: RegExp, message?: string): void {
  if (message === undefined) nodeAssert.match(actual, pattern);
  else nodeAssert.match(actual, pattern, message);
}

/** Fails unless every expected element is deeply equal to some element of the array. */
export function assertArrayIncludes<T>(actual: readonly T[], expected: readonly T[], message?: string): void {
  const missing = expected.filter((e) => !actual.some((a) => isDeepStrictEqual(a, e)));
  nodeAssert.ok(missing.length === 0, message ?? `expected the array to include ${JSON.stringify(missing)}`);
}

function isDeepStrictEqual(a: unknown, b: unknown): boolean {
  try {
    nodeAssert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

/** The error a function throws; fails where it throws none, or one not of `Class`, or one whose message does not include `includes`. */
export function assertThrows<E extends Error = Error>(
  fn: () => unknown,
  Class?: abstract new (...args: never[]) => E,
  includes?: string,
): E {
  try {
    fn();
  } catch (e) {
    checkThrown(e, Class, includes);
    return e as E;
  }
  throw new nodeAssert.AssertionError({ message: "expected the function to throw" });
}

/** The error a promise rejects with; fails where it fulfils, or rejects with one not of `Class`, or whose message does not include `includes`. */
export async function assertRejects<E extends Error = Error>(
  fn: () => PromiseLike<unknown>,
  Class?: abstract new (...args: never[]) => E,
  includes?: string,
): Promise<E> {
  try {
    await fn();
  } catch (e) {
    checkThrown(e, Class, includes);
    return e as E;
  }
  throw new nodeAssert.AssertionError({ message: "expected the promise to reject" });
}

function checkThrown(e: unknown, Class: (abstract new (...args: never[]) => Error) | undefined, includes: string | undefined): void {
  if (Class !== undefined && !(e instanceof Class)) {
    throw new nodeAssert.AssertionError({
      message: `expected ${Class.name}, got ${e instanceof Error ? e.name : String(e)}: ${String(e)}`,
    });
  }
  if (includes !== undefined && !(e instanceof Error && e.message.includes(includes))) {
    throw new nodeAssert.AssertionError({ message: `expected the error to include ${JSON.stringify(includes)}, got ${String(e)}` });
  }
}

/** Fails, with the message. */
export function fail(message: string): never {
  throw new nodeAssert.AssertionError({ message });
}
