/**
 * Tests of a guide that is resumed and run on a small screen (commons 0002-ui FR-011 to FR-015): the count of the title as a position that
 * never falls, the steps done before the process ticked, the marks, the status line, the summary pinned on a 24-row screen, a step given
 * again shown once, and one transcript with a failure once. The full screen is read on the emulator of `vt`.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { fitPane, type UiError, type UiIn, type FlowStep, type LineRead, runFlow } from "../src/ui.ts";
import { createScreen } from "../src/vt.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { bare, capsOf, fakeClock, machine, recorder, type Recorder, scriptedIn } from "./ui-helpers.ts";

const plan18 = Array.from({ length: 18 }, (_, i) => ({ id: `synthetic-step-${String(i + 1).padStart(2, "0")}`, title: `Step ${i + 1}` }));
const ids = plan18.map((p) => p.id);

const human = (id: string, evidence: readonly string[] = []): FlowStep => ({
  id,
  kind: "human",
  summary: `Review synthetic-file for ${id}`,
  say: "Open the file and read it.",
  gate: { who: "person" },
  evidence,
});
const runStep = (id: string): FlowStep => ({ id, kind: "run", summary: `Run ${id}`, say: "", verb: { id: "synthetic-verb", inputs: {} } });
const end: FlowStep = { id: "synthetic-end-01", kind: "done", summary: "All set", say: "" };
const fine = (): Promise<Result<{ summary: string }, string>> => Promise.resolve(ok({ summary: "done" }));

/** What the screen shows now: what was written is fed to an emulator that is as big as the terminal. */
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
  /** The screen as it was when it was left: the bytes up to the last time the alternate screen was closed. */
  view.lastFrame = (): readonly string[] => {
    view();
    const bytes = all.join("");
    const s = createScreen({ width: out.columns, height: out.rows });
    s.write(bytes.slice(0, bytes.lastIndexOf("\u001b[?1049l")));
    return s.lines();
  };
  return view;
}

/** An input that looks at the screen at the moment the person is asked, then types `text`. */
function peekIn(texts: readonly string[], look: (n: number) => void): UiIn {
  let n = 0;
  return {
    isTTY: true,
    readLine: (): Promise<LineRead> => {
      look(n);
      const text = texts[Math.min(n, texts.length - 1)] ?? "";
      n++;
      return Promise.resolve({ kind: "line", text });
    },
  };
}

const title = (rows: readonly string[]): string => rows[0] ?? "";
const marks = (rows: readonly string[], mark: string): number => rows.filter((r) => r.split(" | ")[0]?.startsWith(mark) === true).length;

proves(["0002-ui FR-011"], "a resumed flow: the count is the position in the plan, the earlier steps are ticked, and it never falls when the step is asked again", async () => {
  const out = recorder(80, 30);
  const view = viewOf(out);
  const seen: string[] = [];
  const m = machine([human(ids[14]!), human(ids[14]!), runStep(ids[15]!), end]);
  const result = await runFlow({
    next: m.next,
    run: fine,
    out,
    in: peekIn([""], () => {
      const rows = view();
      seen.push(`${title(rows).trim().split(/\s{2,}/).at(-1)} x${marks(rows, "[x]")} >${marks(rows, "[>]")}`);
    }),
    caps: capsOf("full", 80, 30),
    plan: plan18,
    done: [...ids.slice(0, 14), "synthetic-unknown-01"],
    title: "Synthetic guide",
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  assertEquals(seen, ["step 15 of 18 x14 >1", "step 15 of 18 x14 >1"]);
});

proves(["0002-ui FR-011"], "the count follows the plan: step 1 of N at the first step, a step outside the plan keeps it, the end keeps it", async () => {
  const out = recorder(80, 24);
  const view = viewOf(out);
  const counts: string[] = [];
  const outside: FlowStep = { id: "synthetic-outside-01", kind: "run", summary: "A step the plan does not hold", say: "", verb: { id: "synthetic-verb", inputs: {} } };
  const m = machine([runStep(ids[0]!), runStep(ids[2]!), outside, end]);
  const result = await runFlow({
    next: m.next,
    run: () => {
      counts.push(title(view()).trim().split(/\s{2,}/).at(-1) ?? "");
      return fine();
    },
    out,
    in: scriptedIn([]),
    caps: capsOf("full", 80, 24),
    plan: plan18,
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  assertEquals(counts, ["step 1 of 18", "step 3 of 18", "step 3 of 18"]);
  assertEquals(title(view.lastFrame()).trim().split(/\s{2,}/).at(-1), "step 3 of 18");
});

proves(["0002-ui FR-011"], "marks: done [x], current [>], pending [ ], failed [!] once a verb fails; a run that succeeds ticks its step", async () => {
  const out = recorder(80, 24);
  const view = viewOf(out);
  const rowsAt: Array<readonly string[]> = [];
  const m = machine([runStep(ids[0]!), runStep(ids[1]!), runStep(ids[2]!)]);
  const result = await runFlow({
    next: m.next,
    run: (c) => {
      rowsAt.push(view());
      return c.step.id === ids[1] ? Promise.resolve(err("the synthetic verb failed")) : fine();
    },
    out,
    in: scriptedIn([]),
    caps: capsOf("full", 80, 24),
    plan: plan18.slice(0, 4),
    clock: fakeClock(),
  });
  assert(result.kind === "err" && result.error.code === "E-UI-RUN-FAILED");
  assertEquals([marks(rowsAt[0]!, "[x]"), marks(rowsAt[0]!, "[>]"), marks(rowsAt[0]!, "[ ]")], [0, 1, 3]);
  assertEquals([marks(rowsAt[1]!, "[x]"), marks(rowsAt[1]!, "[>]"), marks(rowsAt[1]!, "[ ]")], [1, 1, 2], "the first run ticked its step");
});

proves(["0002-ui FR-011"], "the failed mark is drawn on the last frame", async () => {
  const out = recorder(80, 24);
  const all: string[] = [];
  const m = machine([runStep(ids[0]!)]);
  const result = await runFlow({
    next: m.next,
    run: () => Promise.resolve(err("the synthetic verb failed")),
    out,
    in: scriptedIn([]),
    caps: capsOf("full", 80, 24),
    plan: plan18.slice(0, 3),
    clock: fakeClock(),
  });
  assert(result.kind === "err");
  all.push(...out.writes);
  const bytes = all.join("");
  const screen = createScreen({ width: 80, height: 24 });
  screen.write(bytes.slice(0, bytes.lastIndexOf("\u001b[?1049l")));
  assert(screen.lines().some((r) => r.startsWith("[!] Step 1")), screen.text());
  assertEquals(screen.lines().filter((r) => r.startsWith("[>]")).length, 0);
});

proves(["0002-ui FR-011"], "a plan taller than the body scrolls so that the current step stays in view", async () => {
  const out = recorder(60, 12);
  const view = viewOf(out);
  let rows: readonly string[] = [];
  const m = machine([runStep(ids[16]!), end]);
  await runFlow({
    next: m.next,
    run: () => {
      rows = view();
      return fine();
    },
    out,
    in: scriptedIn([]),
    caps: capsOf("full", 60, 12),
    plan: plan18,
    clock: fakeClock(),
  });
  assert(rows.some((r) => r.startsWith("[>] Step 17")), rows.join("\n"));
  assertEquals(title(rows).trim().split(/\s{2,}/).at(-1), "step 17 of 18");
});

proves(["0002-ui FR-012"], "the status line says whose turn it is: type and Enter, Enter to continue, confirm, working", async () => {
  const out = recorder(80, 24);
  const view = viewOf(out);
  const status: string[] = [];
  const last = (rows: readonly string[] = view()): string => `${rows[22]?.trim()} / ${rows[23]?.trim()}`;
  const q: FlowStep = { id: ids[0]!, kind: "question", summary: "Which folder", say: "", ask: [{ field: "folder", prompt: "Folder?", hint: "" }] };
  const m = machine([q, human(ids[1]!), runStep(ids[2]!), end]);
  let read = 0;
  const result = await runFlow({
    next: m.next,
    run: () => {
      status.push(last());
      return fine();
    },
    confirm: () => {
      status.push(last());
      return Promise.resolve(true);
    },
    out,
    in: peekIn(["./works", ""], () => {
      status.push(last());
      read++;
    }),
    caps: capsOf("full", 80, 24),
    plan: plan18.slice(0, 4),
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  assertEquals(read, 2);
  assertEquals(status.slice(0, 6), [
    "your turn: type folder and press Enter / Enter send   Ctrl+C stop",
    "working... / Ctrl+C stop",
    "press Enter to continue / Enter continue   Ctrl+C stop",
    "working... / Ctrl+C stop",
    "your turn: confirm to run synthetic-verb / Ctrl+C stop",
    "working... running synthetic-verb / Ctrl+C stop",
  ]);
  assertEquals(last(view.lastFrame()), "done / undefined");
  for (const s of status) assert(!s.includes("waiting for you") && !s.includes("acknowledged"));
});

proves(["0002-ui FR-013"], "on 24 rows a step with forty lines of evidence keeps its summary on top, the prompt at the bottom and a (more marker", async () => {
  const out = recorder(80, 24);
  const view = viewOf(out);
  let rows: readonly string[] = [];
  const evidence = Array.from({ length: 40 }, (_, i) => `synthetic-evidence-${String(i + 1).padStart(2, "0")}: synthetic-value`);
  const m = machine([human(ids[0]!, evidence), end]);
  const result = await runFlow({
    next: m.next,
    run: fine,
    out,
    in: peekIn([""], () => {
      rows = view();
    }),
    caps: capsOf("full", 80, 24),
    plan: plan18.slice(0, 4),
    title: "Synthetic guide",
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  assertEquals(rows.length, 24);
  const pane = rows.slice(1, 22).map((r) => r.split(" | ").slice(1).join(" | "));
  assertStringIncludes(pane[0] ?? "", "[you] Review synthetic-file");
  assertStringIncludes(pane[1] ?? "", "Open the file");
  assertStringIncludes(pane.at(-1) ?? "", ">");
  assert(pane.some((l) => l.includes("(more")), pane.join("\n"));
  assert(pane.some((l) => l.includes("Press Enter when you have done it")), "the prompt is visible");
});

proves(["0002-ui FR-013"], "fitPane: pinned lines on top, the tail kept, the details clipped from their end with a marker, nothing when it fits", () => {
  const lines = ["S1", "S2", ...Array.from({ length: 10 }, (_, i) => `d${i}`), "P1", "P2"];
  assertEquals(fitPane(lines, 20, 2, 2), lines);
  const fit = fitPane(lines, 8, 2, 2);
  assertEquals(fit.length, 8);
  assertEquals(fit.slice(0, 2), ["S1", "S2"]);
  assertEquals(fit.slice(-2), ["P1", "P2"]);
  assertStringIncludes(fit[5] ?? "", "(more");
  assertEquals(fit.slice(2, 5), ["d0", "d1", "d2"]);
  // With neither, the last lines, as before.
  assertEquals(fitPane(lines, 3), ["d9", "P1", "P2"].slice(0, 3));
  // A body of one row still gives one row.
  assertEquals(fitPane(lines, 1, 2, 2).length, 1);
  assertEquals(fitPane(lines, 3, 5, 5).length, 3);
});

proves(["0002-ui FR-014"], "a step given again after Enter is shown once in plain, and not counted twice", async () => {
  const out = recorder(60, 24);
  const m = machine([human(ids[0]!), human(ids[0]!), human(ids[0]!), end]);
  const result = await runFlow({
    next: m.next,
    run: fine,
    out,
    in: scriptedIn(["\r\n", "\r\n", "\r\n"]),
    caps: capsOf("plain", 60, 24),
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  assertEquals(result.value.steps, 2);
  const text = bare(out.text());
  assertEquals(text.split("[you] Review synthetic-file").length - 1, 1, text);
  assertEquals(text.split("Press Enter when you have done it").length - 1, 3, "asked afresh each time");
});

proves(["0002-ui FR-014"], "in full the pane holds the current step once, and the transcript holds it once", async () => {
  const out = recorder(80, 24);
  const view = viewOf(out);
  let rows: readonly string[] = [];
  const m = machine([runStep(ids[0]!), human(ids[1]!), human(ids[1]!), end]);
  const result = await runFlow({
    next: m.next,
    run: fine,
    out,
    in: peekIn(["", ""], (n) => {
      if (n === 1) rows = view();
      else view();
    }),
    caps: capsOf("full", 80, 24),
    plan: plan18.slice(0, 4),
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  const pane = rows.map((r) => r.split(" | ").slice(1).join(" | "));
  assertEquals(pane.filter((l) => l.includes("[you] Review")).length, 1);
  assertEquals(pane.filter((l) => l.includes("[ask]") || l.includes("[run]")).length, 0, "the earlier step is not in the pane");
  const bytes = out.writes.join("");
  assertEquals(bare(bytes.slice(bytes.lastIndexOf("\u001b[?1049l"))).split("[you] Review").length - 1, 1);
});

proves(["0002-ui FR-015"], "from the full screen a failure leaves the screen, then one transcript with the failure once, and the error is reported", async () => {
  const out = recorder(80, 24);
  const m = machine([runStep(ids[0]!), human(ids[1]!), human(ids[1]!)]);
  let n = 0;
  const result = await runFlow({
    next: m.next,
    run: () => (++n === 2 ? Promise.resolve(err("synthetic-cause-01")) : fine()),
    out,
    in: scriptedIn(["\n"]),
    caps: capsOf("full", 80, 24),
    plan: plan18.slice(0, 4),
    clock: fakeClock(),
  });
  assert(result.kind === "err");
  const e: UiError = result.error;
  assertEquals(e.reported, true);
  assertEquals(e.code, "E-UI-RUN-FAILED");
  const bytes = out.writes.join("");
  const left = bytes.lastIndexOf("\u001b[?1049l");
  assert(left > bytes.lastIndexOf("\u001b[?1049h"));
  const transcript = bare(bytes.slice(left));
  assertEquals(transcript.split("synthetic-cause-01").length - 1, 1, transcript);
  assertEquals(transcript.split("[failed]").length - 1, 1);
  assertEquals(transcript.split("[run] Run").length - 1, 1);
  assert(!transcript.includes("\u001b"), "no frame in the transcript");
  assert(!transcript.includes(" | "), "no left column in the transcript");
});

proves(["0002-ui FR-015"], "in plain a failure is written once, and every end of the guide is reported", async () => {
  const out = recorder(60, 24);
  const failed = await runFlow({
    next: machine([runStep(ids[0]!)]).next,
    run: () => Promise.resolve(err("synthetic-cause-02 happened")),
    out,
    in: scriptedIn([]),
    caps: capsOf("plain", 60, 24),
    clock: fakeClock(),
  });
  assert(failed.kind === "err" && failed.error.reported);
  assertEquals(out.text().split("synthetic-cause-02 happened").length - 1, 1);
  const needs = await runFlow({ next: machine([human(ids[0]!)]).next, run: fine, out: recorder(), in: scriptedIn([], false), caps: capsOf("plain"), clock: fakeClock() });
  assert(needs.kind === "err" && needs.error.reported);
  const invalid = await runFlow({ next: () => Promise.resolve({ kind: "nope" }), run: fine, out: recorder(), in: scriptedIn([]), caps: capsOf("plain"), clock: fakeClock() });
  assert(invalid.kind === "err" && invalid.error.reported);
  const c = new AbortController();
  c.abort();
  const aborted = await runFlow({ next: machine([end]).next, run: fine, out: recorder(), in: scriptedIn([]), caps: capsOf("plain"), signal: c.signal, clock: fakeClock() });
  assert(aborted.kind === "err" && aborted.error.reported && aborted.error.code === "E-UI-ABORTED");
});

proves(["0002-ui FR-010", "0002-ui FR-011"], "Windows: the full screen at the narrowest size takes CRLF answers and every row keeps its width", async () => {
  const out = recorder(60, 12);
  const view = viewOf(out);
  let rows: readonly string[] = [];
  const q: FlowStep = {
    id: ids[0]!,
    kind: "question",
    summary: "Which order is it?",
    say: "Type the id of the synthetic order 00000000-0000-4000-8000-000000000001 as shown.",
    ask: [{ field: "order", prompt: "Order id?", hint: "a uuid" }],
  };
  let got = "";
  const result = await runFlow({
    next: machine([q, end]).next,
    run: (c) => {
      got = c.answers["order"] ?? "";
      return fine();
    },
    out,
    in: peekIn(["00000000-0000-4000-8000-000000000001\r\n"], () => {
      rows = view();
    }),
    caps: capsOf("full", 60, 12),
    plan: plan18.slice(0, 5),
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  assertEquals(got, "00000000-0000-4000-8000-000000000001");
  assertEquals(rows.length, 12);
  assert(rows.some((r) => r.includes("00000000-0000-4000-8000-000000000001")), rows.join("\n"));
});
