/**
 * Tests of the second pass on the guide (commons 0002-ui FR-011, FR-015 to FR-018): the count and the marks of a flow resumed late, a
 * step skipped, the command kept visible on a small screen (60 by 24, 100 by 30 and 30 rows), the label of the left column, the sign of life
 * of a long run, and the short transcript with the closing line. The full screen is read on the emulator of `vt`; names are synthetic.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { elapsedOf, fitPane, type UiClock, type FlowRunResult, type FlowStep, labelOf, MORE_MARK, runFlow } from "../src/ui.ts";
import { createScreen } from "../src/vt.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { bare, capsOf, fakeClock, machine, recorder, type Recorder, scriptedIn } from "./ui-helpers.ts";

const names = [
  "Your facts",
  "Admin key",
  "Install files",
  "Review the files",
  "Boot server",
  "Arm the install",
  "Install runs",
  "Host fingerprint",
  "Open converge",
  "Make the plan",
  "Approve the plan",
  "Apply the plan",
  "Close converge",
  "Credentials",
  "Open workspaces",
  "Build the works",
  "Approve the build",
  "Done",
];
const plan = names.map((title, i) => ({ id: `synthetic-step-${String(i + 1).padStart(2, "0")}`, title }));
const ids = plan.map((p) => p.id);
const ORDER = "01a2151b-247d-7190-8f73-3620e294318b";
const COMMAND = `synth work run ${ORDER} --apply --in host=synthetic-host-01`;

const retry = (evidence: readonly string[] = []): FlowStep => ({
  id: "synthetic-retry-01",
  kind: "question",
  summary: "Run the same order again.",
  say: "I run the order again: it goes on from where it failed.",
  command: COMMAND,
  ask: [{ field: "confirm", prompt: `Type yes to run: ${COMMAND}`, hint: "" }],
  evidence,
});
const runStep = (id: string): FlowStep => ({ id, kind: "run", summary: `Run ${id}`, say: "", verb: { id: "synthetic-verb", inputs: {} } });
const fine = (): Promise<Result<FlowRunResult, string>> => Promise.resolve(ok({ summary: "done" }));
const end: FlowStep = { id: "synthetic-end-01", kind: "done", summary: "All set", say: "" };

/** The screen as a person saw it just before the alternate screen was left, or now. */
function viewOf(out: Recorder): (() => readonly string[]) & { lastFrame(): readonly string[] } {
  const screen = createScreen({ width: out.columns, height: out.rows });
  const all: string[] = [];
  const view = (): readonly string[] => {
    for (const w of out.writes.splice(0)) {
      all.push(w);
      screen.write(w);
    }
    return screen.lines();
  };
  view.lastFrame = (): readonly string[] => {
    view();
    const bytes = all.join("");
    const s = createScreen({ width: out.columns, height: out.rows });
    s.write(bytes.slice(0, bytes.lastIndexOf("\u001b[?1049l")));
    return s.lines();
  };
  return view;
}

const countOf = (rows: readonly string[]): string => (rows[0] ?? "").trim().split(/\s{2,}/).at(-1) ?? "";
const mark = (rows: readonly string[], m: string): number => rows.filter((r) => r.split(" | ")[0]?.startsWith(m) === true).length;
const pane = (rows: readonly string[]): readonly string[] => rows.slice(1, -2).map((r) => r.split(" | ").slice(1).join(" | "));

/** A failure of the retry step, at a size, from a flow resumed with the steps `done` and `skipped`. */
async function failureAt(columns: number, rows: number, evidence: readonly string[], done: readonly string[], skipped: readonly string[]): Promise<{ frame: readonly string[]; asked: readonly string[]; out: Recorder }> {
  const out = recorder(columns, rows);
  const view = viewOf(out);
  let asked: readonly string[] = [];
  const result = await runFlow({
    next: machine([retry(evidence)]).next,
    run: () => Promise.resolve(err(`failed: program.run in synthetic (agora.work-build): E-HOST-PROGRAM-FAILED ${"x".repeat(20)}`)),
    in: {
      isTTY: true,
      readLine: () => {
        asked = view();
        return Promise.resolve({ kind: "line" as const, text: "yes" });
      },
    },
    out,
    caps: capsOf("full", columns, rows),
    plan,
    done,
    skipped,
    clock: fakeClock(),
  });
  assert(result.kind === "err" && result.error.code === "E-UI-RUN-FAILED");
  return { frame: view.lastFrame(), asked, out };
}

proves(["0002-ui FR-011"], "a flow resumed late at 60x24: the count is the place after the last done or skipped step, marks hold in the failure frame, skipped is [-]", async () => {
  const done = [...ids.slice(0, 13), ids[14]!];
  const { frame, asked } = await failureAt(60, 24, [], done, [ids[13]!]);
  for (const rows of [asked, frame]) {
    assertEquals(countOf(rows), "step 16 of 18");
    assertEquals(mark(rows, "[x]"), 14, rows.join("\n"));
    assertEquals(mark(rows, "[-]"), 1);
    assertEquals(mark(rows, "[ ]"), 3);
  }
  assertStringIncludes(frame.join("\n"), "[-] Credentials");
  // The failing step is not a plan step: nothing is marked failed, nothing is current.
  assertEquals(mark(frame, "[!]"), 0);
});

proves(["0002-ui FR-011"], "without done or skipped a step outside the plan reads step 1, and a plan step then moves it and it never falls", async () => {
  const out = recorder(80, 30);
  const view = viewOf(out);
  const counts: string[] = [];
  const outside: FlowStep = { id: "synthetic-outside-01", kind: "run", summary: "Outside", say: "", verb: { id: "synthetic-verb", inputs: {} } };
  const m = machine([outside, runStep(ids[15]!), outside, end]);
  const result = await runFlow({
    next: m.next,
    run: () => {
      counts.push(countOf(view()));
      return fine();
    },
    out,
    in: scriptedIn([]),
    caps: capsOf("full", 80, 30),
    plan,
    done: ids.slice(0, 15),
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  assertEquals(counts, ["step 16 of 18", "step 16 of 18", "step 16 of 18"]);
});

proves(["0002-ui FR-011"], "a step in done is [x] and a step skipped is [-] in every frame; a skipped step that is then shown is current, and one in done and skipped is done", async () => {
  const out = recorder(100, 30);
  const view = viewOf(out);
  const seen: Array<readonly string[]> = [];
  const result = await runFlow({
    next: machine([runStep(ids[2]!), end]).next,
    run: () => {
      seen.push(view());
      return fine();
    },
    out,
    in: scriptedIn([]),
    caps: capsOf("full", 100, 30),
    plan: plan.slice(0, 5),
    done: [ids[0]!],
    skipped: [ids[1]!, ids[2]!, ids[0]!],
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  const rows = seen[0] ?? [];
  assertEquals([mark(rows, "[x]"), mark(rows, "[-]"), mark(rows, "[>]"), mark(rows, "[ ]")], [1, 1, 1, 2]);
});

proves(["0002-ui FR-016"], "at 60x24 the command is whole beside the failure, the prompt is the last line, and the evidence goes first", async () => {
  const evidence = [`order: ${ORDER}`, ...Array.from({ length: 12 }, (_, i) => `synthetic-evidence-${String(i).padStart(2, "0")}: synthetic-detail`)];
  const { frame, asked } = await failureAt(60, 24, evidence, ids.slice(0, 15), []);
  assertEquals(frame.length, 24);
  const p = pane(asked);
  const text = p.join("\n");
  // The command, whole, in its own paragraph; the id is never cut.
  assertStringIncludes(text, "Command: synth work run");
  assertStringIncludes(text, ORDER);
  assertStringIncludes(text, "host=synthetic-host-01");
  assert(p.some((l) => l.includes("(more")), text);
  assertEquals(p.filter((l) => l.trim() !== "").at(-1)?.trim(), ">");
  assert(!text.includes("synthetic-evidence-11"), "the evidence is clipped first");
  // Every id in the pane is whole.
  for (const l of p) if (l.includes("01a2151b")) assertEquals(l.trim().startsWith(ORDER), true, l);
  // The prompt (a question asked at the confirmation) is wrapped to the pane: the id of the prompt is whole too.
  assertEquals(text.split(ORDER).length - 1 >= 2, true, text);
});

proves(["0002-ui FR-016"], "the failure is drawn with the command beside it at 60x24 and at 30 rows, and the last frame holds both", async () => {
  for (const rows of [24, 30]) {
    const { frame } = await failureAt(60, rows, [`order: ${ORDER}`, "a: b", "c: d", "e: f", "g: h"], ids.slice(0, 15), []);
    const text = pane(frame).join("\n");
    assertStringIncludes(text, "Command: synth work run");
    assertStringIncludes(text, ORDER);
    assertStringIncludes(text, "[failed]");
    assertStringIncludes(text, "program.run");
  }
});

proves(["0002-ui FR-016"], "at 100x30 a command beside the failure is whole on the screen and no row is wider than the screen", async () => {
  const { frame, asked } = await failureAt(100, 30, [`order: ${ORDER}`], ids.slice(0, 15), []);
  assertEquals(frame.length, 30);
  assertStringIncludes(pane(asked).map((l) => l.trim()).join(" "), COMMAND);
  assert(frame.every((r) => [...r].length <= 100));
});

proves(["0002-ui FR-016"], "a command in say is kept like the command of the step, and a run keeps its will run and inputs", async () => {
  const out = recorder(60, 24);
  const view = viewOf(out);
  let seen: readonly string[] = [];
  const noisy: FlowStep = {
    id: ids[3]!,
    kind: "human",
    summary: "Do it yourself.",
    say: `Intro one.\nCommand: ${COMMAND}\n${"Long detail ".repeat(20)}`,
    gate: { who: "person" },
    evidence: Array.from({ length: 20 }, (_, i) => `synthetic-evidence-${i}`),
  };
  await runFlow({
    next: machine([noisy, end]).next,
    run: fine,
    out,
    in: {
      isTTY: true,
      readLine: () => {
        seen = view();
        return Promise.resolve({ kind: "line" as const, text: "" });
      },
    },
    caps: capsOf("full", 60, 24),
    plan,
    clock: fakeClock(),
  });
  const text = pane(seen).join("\n");
  assertStringIncludes(text, "Command: synth work run");
  assertStringIncludes(text, ORDER);
  assertStringIncludes(text, "(more");
});

proves(["0002-ui FR-016"], "fitPane keeps, in order of need: the last line, the protected lines, the summary, the tail, then the details from their start", () => {
  const lines = ["S1", "S2", "d0", "d1", "C1", "C2", "d2", "d3", "d4", "d5", "F1", "P1"];
  const fit = fitPane(lines, 7, 2, 2, [4, 5]);
  assertEquals(fit, ["S1", "S2", MORE_MARK, "C1", "C2", "F1", "P1"]);
  // Where even the protected lines do not fit, the last line and the first of them stay.
  const tight = fitPane(lines, 3, 2, 2, [4, 5]);
  assertEquals(tight.length, 3);
  assertEquals(tight.at(-1), "P1");
  assertEquals(fitPane(lines, 1, 2, 2, [4, 5]), ["P1"]);
  assertEquals(fitPane(lines, 20, 2, 2, [4, 5]), lines);
});

proves(["0002-ui FR-017"], "a label as it is, the short one, the words that fit and ~, a first word cut with ~", () => {
  const item = { id: "a", title: "Approve the build" };
  assertEquals(labelOf(item, 20), "Approve the build");
  assertEquals(labelOf({ ...item, short: "OK the build" }, 12), "OK the build");
  assertEquals(labelOf(item, 16), "Approve the~");
  assertEquals(labelOf({ ...item, short: "Approve" }, 16), "Approve");
  assertEquals(labelOf({ id: "b", title: "Internationalisation" }, 8), "Interna~");
  assertEquals(labelOf({ id: "c", title: "Approve the build", short: "Approve the build now" }, 8), "Approve~");
});

proves(["0002-ui FR-017"], "at 60 columns the left column shows ~ or the short title, and never a cut word", async () => {
  const out = recorder(60, 24);
  const view = viewOf(out);
  let rows: readonly string[] = [];
  const shortPlan = plan.map((p) => (p.id === ids[16] ? { ...p, short: "Approve build" } : p));
  await runFlow({
    next: machine([runStep(ids[0]!), end]).next,
    run: () => {
      rows = view();
      return fine();
    },
    out,
    in: scriptedIn([]),
    caps: capsOf("full", 60, 24),
    plan: shortPlan,
    clock: fakeClock(),
  });
  const text = rows.join("\n");
  assertStringIncludes(text, "Approve build");
  assert(!text.includes("Approve the buil "), text);
  assertStringIncludes(text, "Review the files");
});

/** A clock whose sleeps end when the test moves the time. */
function manualClock(): UiClock & { advance(ms: number): Promise<void>; readonly pending: () => number } {
  let t = 5_000_000;
  const waiting: Array<{ at: number; resolve: () => void }> = [];
  return {
    now: () => t,
    pending: () => waiting.length,
    sleep(ms, signal) {
      return new Promise<void>((resolve) => {
        const w = { at: t + ms, resolve };
        waiting.push(w);
        signal?.addEventListener(
          "abort",
          () => {
            waiting.splice(waiting.indexOf(w), 1);
            resolve();
          },
          { once: true },
        );
      });
    },
    async advance(ms) {
      const to = t + ms;
      for (;;) {
        waiting.sort((a, b) => a.at - b.at);
        const next = waiting[0];
        if (next === undefined || next.at > to) break;
        waiting.shift();
        t = next.at;
        next.resolve();
        for (let i = 0; i < 20; i++) await Promise.resolve();
      }
      t = to;
    },
  };
}

const tick = async (n = 30): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

proves(["0002-ui FR-018"], "in full the footer says working and the elapsed time every second, with the last line of output dimmed under the keys", async () => {
  const clock = manualClock();
  const out = recorder(100, 30);
  const view = viewOf(out);
  let release: (r: Result<FlowRunResult, string>) => void = () => undefined;
  let report: (line: string) => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    void runFlow({
      next: machine([runStep(ids[1]!), end]).next,
      run: (c) => {
        report = c.progress;
        resolve();
        return new Promise((r) => {
          release = r;
        });
      },
      out,
      in: scriptedIn([]),
      caps: capsOf("full", 100, 30),
      plan,
      clock,
    });
  });
  await started;
  await tick();
  let rows = view();
  assertStringIncludes(rows[28] ?? "", "working... running synthetic-verb");
  await clock.advance(1000);
  report("\u001b[31mcompiling synthetic-module-03\u001b[0m\nsecond line");
  await clock.advance(3000);
  rows = view();
  assertStringIncludes(rows[27] ?? "", "working... running synthetic-verb 4s");
  assertStringIncludes(rows[28] ?? "", "Ctrl+C stop");
  assertStringIncludes(rows[29] ?? "", "| compiling synthetic-module-03");
  assert(!(rows[29] ?? "").includes("second line") && !(rows[29] ?? "").includes("["), rows[29]);
  assertEquals(rows.length, 30);
  await clock.advance(186_000);
  assertStringIncludes(view()[27] ?? "", "working... running synthetic-verb 3m10s");
  release(ok({ summary: "built" }));
  await tick();
  assertEquals(clock.pending(), 0, "the ticker ended with the work");
});

proves(["0002-ui FR-018"], "in plain a line says it is still working every 15 seconds, with the last line of output where it is new", async () => {
  const clock = manualClock();
  const out = recorder(60, 24);
  let release: (r: Result<FlowRunResult, string>) => void = () => undefined;
  let report: (line: string) => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    void runFlow({
      next: machine([runStep(ids[1]!), end]).next,
      run: (c) => {
        report = c.progress;
        resolve();
        return new Promise((r) => {
          release = r;
        });
      },
      out,
      in: scriptedIn([]),
      caps: capsOf("plain", 60, 24),
      clock,
    });
  });
  await started;
  await tick();
  await clock.advance(14_000);
  assert(!bare(out.text()).includes("still working"));
  report("line one\r\n");
  await clock.advance(1_000);
  await clock.advance(15_000);
  report("line two");
  await clock.advance(15_000);
  await clock.advance(15_000);
  release(ok({ summary: "built" }));
  await tick();
  const text = bare(out.text());
  assertStringIncludes(text, "still working: synthetic-verb, 15s elapsed\n  | line one\n");
  assertStringIncludes(text, "still working: synthetic-verb, 30s elapsed\n");
  assertStringIncludes(text, "still working: synthetic-verb, 45s elapsed\n  | line two\n");
  assertStringIncludes(text, "still working: synthetic-verb, 1m00s elapsed\n");
  assertEquals(text.split("  | line two").length - 1, 1, "a line is not repeated");
  assert(!text.includes("\u001b"));
});

proves(["0002-ui FR-018"], "elapsedOf reads as a person does", () => {
  assertEquals([elapsedOf(0), elapsedOf(45_900), elapsedOf(190_000), elapsedOf(3_725_000)], ["0s", "45s", "3m10s", "1h02m05s"]);
});

proves(["0002-ui FR-015"], "after a failure the transcript holds the last five steps, the failure and the closing line, with the screen left first", async () => {
  const out = recorder(60, 24);
  const m = machine([...ids.slice(0, 7).map(runStep)]);
  let n = 0;
  const result = await runFlow({
    next: m.next,
    run: () => (++n === 7 ? Promise.resolve(err("the synthetic verb failed")) : fine()),
    out,
    in: scriptedIn([]),
    caps: capsOf("full", 60, 24),
    plan,
    closing: "Run it again to retry.",
    clock: fakeClock(),
  });
  assert(result.kind === "err" && result.error.reported);
  const all = out.writes.join("");
  const after = bare(all.slice(all.lastIndexOf("\u001b[?1049l")));
  const steps = after.split("\n").filter((l) => l.startsWith("[run]"));
  assertEquals(steps.length, 5);
  assertStringIncludes(after, "Run synthetic-step-07");
  assert(!after.includes("Run synthetic-step-02"), after);
  assertStringIncludes(after, "(2 earlier steps are not shown)");
  assertEquals(after.split("the synthetic verb failed").length - 1, 1);
  assertEquals(after.trimEnd().split("\n").at(-1), "Run it again to retry.");
});

proves(["0002-ui FR-015"], "the closing line is not shown where the guide finishes, and in plain it ends a failure", async () => {
  const done = recorder(60, 24);
  const r1 = await runFlow({ next: machine([end]).next, run: fine, out: done, in: scriptedIn([]), caps: capsOf("plain"), closing: "Run it again to retry.", clock: fakeClock() });
  assert(r1.kind === "ok");
  assert(!done.text().includes("Run it again"));
  const bad = recorder(60, 24);
  const r2 = await runFlow({
    next: machine([runStep(ids[0]!)]).next,
    run: () => Promise.resolve(err("nope")),
    out: bad,
    in: scriptedIn([]),
    caps: capsOf("plain"),
    closing: "Run it again to retry.",
    clock: fakeClock(),
  });
  assert(r2.kind === "err");
  assertEquals(bad.text().trimEnd().split("\n").at(-1), "Run it again to retry.");
});

proves(["0002-ui FR-016"], "CRLF in a command and a narrow pane: the command is wrapped whole, never cut", async () => {
  const out = recorder(60, 24);
  const view = viewOf(out);
  let seen: readonly string[] = [];
  const step: FlowStep = { id: ids[0]!, kind: "human", summary: "Do it.", say: "First.\r\nSecond.", command: `synthetic-tool\r\n--order ${ORDER}`, gate: { who: "person" } };
  await runFlow({
    next: machine([step, end]).next,
    run: fine,
    out,
    in: {
      isTTY: true,
      readLine: () => {
        seen = view();
        return Promise.resolve({ kind: "line" as const, text: "" });
      },
    },
    caps: capsOf("full", 60, 24),
    plan,
    clock: fakeClock(),
  });
  const text = pane(seen).join("\n");
  assertStringIncludes(text, ORDER);
  assert(!text.includes("\r"));
});
