/**
 * Tests of plan versus apply (commons headless 0012-executor-check-mode FR-001 to FR-007): the plan and its problems, the two modes, the canonical form and hash, the approval of an apply and the
 * events streamed to a surface.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import type { Result } from "@intellectual-frontiers/core";
import {
  canonicalOf,
  describePlan,
  parsePlanHash,
  parseStepId,
  planHash,
  planOf,
  progressOf,
  runPlan,
  sha256Hex,
  type ExecEvent,
  type ExecStep,
  type ExecutionPlan,
  type Executor,
  type Output,
  type RunOptions,
} from "../src/logical/mod.ts";

const id = (t: string) => {
  const r = parseStepId(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const step = (name: string, extra: Partial<ExecStep> = {}): ExecStep => ({ id: id(name), summary: `Step ${name}.`, effect: "mutate", apply: ["tool", "apply", name], check: ["tool", "check", name], ...extra });
const planOK = (steps: readonly ExecStep[], target = "host-1"): ExecutionPlan => {
  const r = planOf(target, steps);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const enc = (t: string) => new TextEncoder().encode(t);

/** An executor that records what it ran and answers from a table by the joined vector. */
function executor(answers: Readonly<Record<string, number>> = {}, opts: { stream?: boolean; throws?: string } = {}): Executor & { readonly ran: string[]; readonly options: RunOptions[] } {
  const ran: string[] = [];
  const options: RunOptions[] = [];
  return {
    ran,
    options,
    exec: (argv, o) => {
      const key = argv.join(" ");
      ran.push(key);
      options.push(o ?? {});
      if (key === opts.throws) return Promise.reject(new Error("boom"));
      const code = answers[key] ?? 0;
      if (opts.stream === true) {
        o?.onLine?.("stdout", `out ${key}`);
        o?.onLine?.("stderr", `err ${key}`);
      }
      const out: Output = { code, success: code === 0, signal: null, stdout: enc(opts.stream === true ? "" : `out ${key}\n`), stderr: enc(opts.stream === true ? "" : `err ${key}\n`) };
      return Promise.resolve(out);
    },
  };
}
const okOf = <T, E>(r: Result<T, E>): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};

proves(["0012-executor-check-mode FR-001"], "a plan is made only from valid steps and every problem is returned as a value", () => {
  assertEquals(parseStepId("keys.v2:a_b-c").kind, "ok");
  for (const bad of ["", "Keys", "-x", "a b", "x".repeat(101)]) assertEquals(parseStepId(bad).kind, "err", bad);
  const rules = (target: string, steps: readonly ExecStep[]) => {
    const r = planOf(target, steps);
    return r.kind === "err" ? r.error.map((p) => p.rule) : [];
  };
  assertEquals(rules("t", [step("a")]), []);
  assertEquals(rules(" ", [step("a")]), ["plan/target"]);
  assertEquals(rules("t", []), ["plan/empty"]);
  assertEquals(rules("t", [step("a"), step("a")]), ["plan/duplicate-step"]);
  assertEquals(rules("t", [step("a", { apply: [] })]), ["plan/argv"]);
  assertEquals(rules("t", [step("a", { check: [""] })]), ["plan/argv"]);
  assertEquals(rules("t", [step("a", { effect: "destructive", check: undefined })]), ["plan/destructive-no-check"]);
  assertEquals(rules("t", [step("a", { effect: "destructive" })]), []);
  assertEquals(rules("t", [step("a", { changedExit: 0 })]), ["plan/changed-exit"]);
  assertEquals(rules("t", [step("a", { changedExit: 300 })]), ["plan/changed-exit"]);
  assertEquals(rules("t", [step("a", { changedExit: 2 })]), []);
});

proves(["0012-executor-check-mode FR-002", "0012-executor-check-mode FR-003"], "check runs only check vectors and reports a step with none as unsupported, apply runs apply vectors, a failure skips the rest, and a throwing executor fails a step and not the run", async () => {
  const plan = planOK([step("a"), step("b", { check: undefined }), step("c", { changedExit: 2 })]);
  const ex = executor({ "tool check c": 2 });
  const checked = okOf(await runPlan(ex, plan, { mode: "check" }));
  assertEquals(ex.ran, ["tool check a", "tool check c"], "no apply vector ran, and b has no check");
  assertEquals(checked.steps.map((s) => [String(s.id), s.outcome, s.code]), [["a", "unchanged", 0], ["b", "unsupported", undefined], ["c", "changed", 2]]);
  assertEquals([checked.mode, checked.outcome], ["check", "incomplete"]);
  const clean = okOf(await runPlan(executor(), planOK([step("a"), step("c", { changedExit: 2 })]), { mode: "check" }));
  assertEquals(clean.outcome, "unchanged");
  const moved = okOf(await runPlan(executor({ "tool check a": 2 }), planOK([step("a", { changedExit: 2 })]), { mode: "check" }));
  assertEquals(moved.outcome, "changed");
  const broke = okOf(await runPlan(executor({ "tool check a": 1 }), planOK([step("a", { changedExit: 2 })]), { mode: "check" }));
  assertEquals(broke.outcome, "failed");
  const applyEx = executor({ "tool apply b": 4 });
  const applied = okOf(await runPlan(applyEx, planOK([step("a"), step("b"), step("c")]), { mode: "apply", approval: { kind: "unsigned" } }));
  assertEquals(applyEx.ran, ["tool apply a", "tool apply b"], "c is skipped after the failure");
  assertEquals(applied.steps.map((s) => s.outcome), ["applied", "failed", "skipped"]);
  assertEquals(applied.outcome, "failed");
  const goOn = executor({ "tool apply b": 4 });
  const all = okOf(await runPlan(goOn, planOK([step("a"), step("b"), step("c")]), { mode: "apply", approval: { kind: "unsigned" } }, { stopOnFailure: false }));
  assertEquals([goOn.ran.length, all.steps.map((s) => s.outcome)], [3, ["applied", "failed", "applied"]]);
  const thrown = okOf(await runPlan(executor({}, { throws: "tool apply a" }), planOK([step("a"), step("b")]), { mode: "apply", approval: { kind: "unsigned" } }));
  assertEquals(thrown.steps.map((s) => [s.outcome, s.code]), [["failed", undefined], ["skipped", undefined]]);
  assertEquals(okOf(await runPlan(executor(), planOK([step("a")]), { mode: "apply", approval: { kind: "unsigned" } })).outcome, "applied");
  const stopped = new AbortController();
  stopped.abort();
  const none = okOf(await runPlan(executor(), planOK([step("a")]), { mode: "check" }, { signal: stopped.signal }));
  assertEquals([none.steps[0]?.outcome, none.outcome], ["skipped", "incomplete"]);
  const withEnv = executor();
  await runPlan(withEnv, planOK([step("a")]), { mode: "check" }, { run: { cwd: "/w", env: { TOKEN: "x" } } });
  assertEquals([withEnv.options[0]?.cwd, withEnv.options[0]?.env], ["/w", { TOKEN: "x" }]);
});

proves(["0012-executor-check-mode FR-004"], "the canonical form is stable and the hash is SHA-256 of it: the published vectors hold, any change to the plan changes the hash, and the run options are not in it", () => {
  assertEquals(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assertEquals(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assertEquals(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  assertEquals(sha256Hex("a".repeat(1000)), "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  const plan = planOK([step("a", { changedExit: 2 }), step("b", { check: undefined })]);
  assertEquals(canonicalOf(plan), '{"format":"headless-plan/1","steps":[{"apply":["tool","apply","a"],"changedExit":2,"check":["tool","check","a"],"effect":"mutate","id":"a","summary":"Step a."},{"apply":["tool","apply","b"],"changedExit":null,"check":null,"effect":"mutate","id":"b","summary":"Step b."}],"target":"host-1"}');
  const hash = planHash(plan);
  assertEquals(hash, `sha256:${sha256Hex(canonicalOf(plan))}`);
  assertEquals(parsePlanHash(hash).kind, "ok");
  for (const bad of ["sha256:abc", `sha1:${"0".repeat(64)}`, `sha256:${"G".repeat(64)}`, ""]) assertEquals(parsePlanHash(bad).kind, "err", bad);
  const changed = [
    planOK([step("a", { changedExit: 2 }), step("b", { check: undefined })], "host-2"),
    planOK([step("a", { changedExit: 3 }), step("b", { check: undefined })]),
    planOK([step("a", { changedExit: 2, apply: ["tool", "apply", "a", "--force"] }), step("b", { check: undefined })]),
    planOK([step("a", { changedExit: 2, effect: "destructive" }), step("b", { check: undefined })]),
    planOK([step("b", { check: undefined }), step("a", { changedExit: 2 })]),
    planOK([step("a", { changedExit: 2, summary: "other" }), step("b", { check: undefined })]),
  ];
  for (const c of changed) assert(planHash(c) !== hash);
  assertEquals(new Set(changed.map(planHash)).size, changed.length);
  assertEquals(planHash(planOK([step("a", { changedExit: 2 }), step("b", { check: undefined })])), hash, "the same plan is the same hash");
  fc.assert(fc.property(fc.string(), (t) => /^[0-9a-f]{64}$/.test(sha256Hex(t))));
});

proves(["0012-executor-check-mode FR-005"], "an apply names its approval: a hash that is not the plan's is refused with nothing run, the right hash and an explicit unsigned go on", async () => {
  const plan = planOK([step("a")]);
  const signed = planHash(plan);
  const ex = executor();
  assertEquals((await runPlan(ex, plan, { mode: "apply", approval: { kind: "hash", hash: signed } })).kind, "ok");
  assertEquals(ex.ran, ["tool apply a"]);
  const other = executor();
  const edited = planOK([step("a", { apply: ["tool", "apply", "a", "--other"] })]);
  const refused = await runPlan(other, edited, { mode: "apply", approval: { kind: "hash", hash: signed } });
  assertEquals(refused.kind === "err" && refused.error, { kind: "plan-changed", approved: signed, actual: planHash(edited) });
  assertEquals(other.ran, [], "nothing ran");
  assertEquals((await runPlan(other, edited, { mode: "check" })).kind, "ok", "a check needs no approval");
});

proves(["0012-executor-check-mode FR-006", "0012-executor-check-mode FR-007"], "a run streams started, line, finished and progress in order, from an executor that streams and from one that does not, and a surface can render the plan and the events", async () => {
  const plan = planOK([step("a"), step("b", { check: undefined })]);
  for (const stream of [true, false]) {
    const events: ExecEvent[] = [];
    await runPlan(executor({}, { stream }), plan, { mode: "check" }, { onEvent: (e) => events.push(e) });
    assertEquals(
      events.map((e) => (e.kind === "line" ? `line:${e.stream}:${e.text}` : e.kind === "finished" ? `finished:${e.result.id}:${e.result.outcome}` : e.kind === "started" ? `started:${e.step}:${e.index}/${e.total}` : `progress:${e.done}/${e.total}`)),
      ["started:a:0/2", "line:stdout:out tool check a", "line:stderr:err tool check a", "finished:a:unchanged", "progress:1/2", "started:b:1/2", "finished:b:unsupported", "progress:2/2"],
      `stream ${String(stream)}`,
    );
  }
  const text = describePlan(plan);
  assertEquals(text[0], "plan for host-1");
  assertEquals(text[1], `hash ${planHash(plan)}`);
  assertStringIncludes(text[3] ?? "", "cannot be checked");
  const kinds = (e: ExecEvent) => progressOf(e)?.kind;
  const sid = id("a");
  assertEquals(kinds({ kind: "started", step: sid, summary: "A.", mode: "check", index: 0, total: 2 }), "step");
  assertEquals(kinds({ kind: "line", step: sid, stream: "stdout", text: "x" }), "live");
  assertEquals(kinds({ kind: "progress", done: 1, total: 2 }), undefined);
  const item = (outcome: "unchanged" | "changed" | "applied" | "unsupported" | "skipped") => {
    const p = progressOf({ kind: "finished", result: { id: sid, mode: "check", outcome, code: 0 } });
    return p?.kind === "item" ? p.item : p?.kind;
  };
  assertEquals(["unchanged", "changed", "applied", "unsupported", "skipped"].map((o) => item(o as "changed")), ["ok", "change", "change", "note", "skip"]);
  const failed = progressOf({ kind: "finished", result: { id: sid, mode: "apply", outcome: "failed", code: 4 } });
  assertEquals(failed?.kind === "problem" && failed.problem.code, "E1-EXEC-STEP");
});
