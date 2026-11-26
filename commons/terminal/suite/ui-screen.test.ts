/**
 * Tests of `src/ui-screen.ts` and of the driver in `full`: the layout drawn on the emulator of `vt` at 80 by 24, every row exactly the
 * width, no scroll, a resize redrawn, the fallback to ansi under 60 columns and the return (commons 0002-ui FR-008).
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { drawScreen, ENTER, frameOf, LEAVE, layoutOf, runFlow, type ScreenState } from "../src/ui.ts";
import { createScreen } from "../src/vt.ts";
import { displayWidth } from "../src/width.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { bare, capsOf, fakeClock, machine, recorder, scriptedIn } from "./ui-helpers.ts";

const FR = "0002-ui FR-008";

const plan = [
  { id: "p1", title: "Check the host" },
  { id: "p2", title: "Choose a folder" },
  { id: "p3", title: "Install" },
  { id: "p4", title: "Finish" },
];

const state = (over: Partial<ScreenState> = {}): ScreenState => ({
  title: "Synthetic guide",
  plan,
  done: new Set(["p1"]),
  current: "p2",
  pane: ["[ask] Choose a folder", "  you are asked for:", "    - folder: Which folder?", "  > "],
  status: "waiting for you: folder",
  keys: "Enter send   Ctrl+C stop",
  typing: true,
  ...over,
});

proves([FR], "the layout at 80 by 24: one done, one current, two pending on the left, the step on the right, a status line and the keys", () => {
  const drawn = drawScreen(state(), { columns: 80, rows: 24 }, { colour: false });
  assertEquals(drawn.lines.length, 24);
  for (const l of drawn.lines) assertEquals(displayWidth(l), 80);
  const s = createScreen({ width: 80, height: 24 });
  s.write(frameOf(drawn));
  const rows = s.lines();
  assert(rows[0]?.startsWith(" Synthetic guide  ") === true && rows[0]?.endsWith(" step 2 of 4") === true);
  assertEquals(rows[0]?.length, 79, "the count ends one column before the edge");
  assertEquals(rows[1]?.startsWith("[x] Check the host   | [ask] Choose a folder"), true);
  assertEquals(rows[2]?.startsWith("[>] Choose a folder  |   you are asked for:"), true);
  assertEquals(rows[3]?.startsWith("[ ] Install"), true);
  assertEquals(rows[4]?.startsWith("[ ] Finish"), true);
  assertStringIncludes(rows[3] ?? "", "|     - folder: Which folder?");
  assertEquals(rows[22], " waiting for you: folder");
  assertEquals(rows[23], " Enter send   Ctrl+C stop");
  // The cursor is where the person types: the end of the last line of the pane.
  assertEquals(s.cursor(), { row: 4, col: 27, visible: true });
});

proves([FR], "colour only where allowed: the same text with and without", () => {
  const on = drawScreen(state(), { columns: 80, rows: 24 }, { colour: true });
  const off = drawScreen(state(), { columns: 80, rows: 24 }, { colour: false });
  assertEquals(on.lines.map(bare), off.lines);
  assert(on.lines.some((l) => l.includes("\u001b[")));
  assert(off.lines.every((l) => !l.includes("\u001b")));
  for (const l of on.lines) assertEquals(displayWidth(l), 80);
});

proves([FR], "a frame never writes a line feed, so the screen cannot scroll, and a long pane shows its last lines", () => {
  const pane = Array.from({ length: 60 }, (_, i) => `line ${i}`);
  const drawn = drawScreen(state({ pane, typing: false }), { columns: 80, rows: 24 }, { colour: true });
  const frame = frameOf(drawn);
  assert(!frame.includes("\n") && !frame.includes("\r"));
  const s = createScreen({ width: 80, height: 24 });
  s.write(ENTER + frame);
  s.write(frame);
  assertStringIncludes(s.text(), "line 59");
  assert(!s.text().includes("line 38"), "only the last 21 lines of the pane");
  assertStringIncludes(s.text(), "line 39");
  assertEquals(s.cursor().visible, false);
  assertEquals(s.lines().length >= 1, true);
  assert(LEAVE.startsWith("\u001b[0m") && LEAVE.endsWith("\u001b[?1049l"));
});

proves([FR], "with no plan there is no left column, and a plan wider than a third of the screen is cut", () => {
  assertEquals(layoutOf(80, 24, []), { left: 0, paneAt: 0, pane: 80, body: 21 });
  const lay = layoutOf(60, 24, [{ id: "a", title: "A very long title of a step that goes on and on and on" }]);
  assertEquals(lay.left, 20);
  const drawn = drawScreen(state({ plan: [{ id: "a", title: "A very long title of a step that goes on and on and on" }], current: "a", done: new Set() }), { columns: 60, rows: 24 }, { colour: false });
  for (const l of drawn.lines) assertEquals(displayWidth(l), 60);
});

proves([FR], "the driver in full enters the alternate screen, draws the plan, redraws on a resize and leaves it restored", async () => {
  const out = recorder(80, 24);
  const steps = [
    { id: "p1", kind: "run", summary: "Check the host", say: "", verb: { id: "synthetic-check", inputs: {} } },
    { id: "p2", kind: "question", summary: "Choose a folder", say: "", ask: [{ field: "folder", prompt: "Which folder?", hint: "" }] },
    { id: "p3", kind: "done", summary: "All set", say: "" },
  ];
  const m = machine(steps);
  const screen = createScreen({ width: 80, height: 24 });
  let resized = false;
  const all: string[] = [];
  const result = await runFlow({
    next: m.next,
    run: (c) => {
      // A frame is on the screen while the verb runs.
      for (const w of out.writes.splice(0)) {
        screen.write(w);
        all.push(w);
      }
      if (c.step.id === "p1") {
        assertStringIncludes(screen.text(), "[>] Check the host");
        assertStringIncludes(screen.text(), "[ ] Choose a folder");
        assertStringIncludes(screen.text(), "will run: synthetic-check");
        assertStringIncludes(screen.text(), "running synthetic-check");
        out.resize(100, 30);
        resized = true;
      }
      return Promise.resolve(ok({ summary: `did ${c.step.id}` }));
    },
    out,
    in: scriptedIn(["./works\r\n"]),
    caps: capsOf("full", 80, 24),
    plan: [
      { id: "p1", title: "Check the host" },
      { id: "p2", title: "Choose a folder" },
      { id: "p3", title: "Finish" },
    ],
    title: "Synthetic guide",
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  assert(resized);
  const bytes = all.join("") + out.writes.join("");
  assertStringIncludes(bytes, "\u001b[?1049h");
  assert(bytes.indexOf("\u001b[30;1H") > bytes.indexOf("\u001b[24;1H"), "after the resize the screen is drawn at its new size");
  assert(bytes.lastIndexOf("\u001b[?1049l") > bytes.lastIndexOf("\u001b[?1049h"));
  // The person keeps a transcript on the normal screen: the whole of what happened.
  const after = createScreen({ width: 100 });
  after.write(bytes.slice(bytes.lastIndexOf("\u001b[?1049l")));
  assertStringIncludes(after.text(), "[done] All set");
  assertStringIncludes(after.text(), "will run: synthetic-check");
  assertStringIncludes(after.text(), "> ./works");
});

proves([FR], "under 60 columns the driver falls back to ansi, and returns to the full screen where the terminal grows again", async () => {
  const out = recorder(80, 24);
  const states: string[] = [];
  const m = machine([
    { id: "w", kind: "wait", summary: "Waiting for the host", say: "" },
    { id: "w", kind: "wait", summary: "Waiting for the host", say: "" },
    { id: "w", kind: "wait", summary: "Waiting for the host", say: "" },
    { id: "w", kind: "wait", summary: "Waiting for the host", say: "" },
    { id: "d", kind: "done", summary: "All set", say: "" },
  ]);
  let polls = 0;
  const result = await runFlow({
    next: () => {
      polls++;
      const w = out.writes.join("");
      states.push(w.lastIndexOf("\u001b[?1049h") > w.lastIndexOf("\u001b[?1049l") ? "alt" : "normal");
      if (polls === 2) out.resize(50, 24);
      if (polls === 3) out.resize(80, 24);
      return m.next();
    },
    run: () => Promise.resolve(ok({ summary: "" })),
    out,
    in: scriptedIn([]),
    caps: capsOf("full", 80, 24),
    clock: fakeClock(),
    poll: { initialMs: 100 },
  });
  assert(result.kind === "ok");
  assertEquals(states.slice(1, 4), ["alt", "normal", "alt"], "full, then ansi under 60 columns, then full again");
  const bytes = out.writes.join("");
  assert((bytes.match(/\u001b\[\?1049h/g) ?? []).length >= 2, "entered again");
  assert((bytes.match(/\u001b\[\?1049l/g) ?? []).length >= 2, "left at the fallback and at the end");
});

proves([FR], "a full screen is not used where the input is not a TTY: the guide goes on in ansi", async () => {
  const out = recorder(80, 24);
  const result = await runFlow({
    next: machine([{ id: "d", kind: "done", summary: "All set", say: "" }]).next,
    run: () => Promise.resolve(ok({ summary: "" })),
    out,
    in: scriptedIn([], false),
    caps: capsOf("full", 80, 24),
    clock: fakeClock(),
  });
  assert(result.kind === "ok");
  assert(!out.text().includes("\u001b[?1049h"));
  assertStringIncludes(bare(out.text()), "[done] All set");
});
