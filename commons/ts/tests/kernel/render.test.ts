/**
 * Tests of `kernel/render.ts`: the console as a rendering of signals (commons 0006-signals FR-021 to FR-024), read through `vt.ts`'s
 * screen after every frame as a person would see it: the live region nested and redrawn in place with elapsed time and progress, the final
 * lines above it, each mode's lines, the marks and their ASCII fallbacks, colour only where allowed, lines cut to the width, and the export
 * warning said once at the end. Properties over random runs: `plain` never writes an escape byte; `attended` never wraps (a screen of its
 * width shows what a screen of any greater width shows, after every frame); and what stays on the screen at the end of an attended run is
 * `plain`'s lines, each cut to the width.
 *
 * @module
 */
import { absurd, err, ok } from "@intellectual-frontiers/core";
import fc from "fast-check";
import { SEVERITY } from "../../kernel/otel.ts";
import { decodeLogs } from "../../kernel/otlp.ts";
import { chooseMode, duration, initial, type Input, type Mode, parseMode, progressText, render, type State } from "../../kernel/render.ts";
import { createTelemetry, defineSignals, type FlushResult, type Processor } from "../../kernel/signals.ts";
import { createScreen, describeStyle, type Screen } from "@intellectual-frontiers/terminal/vt";
import { cutToWidth } from "@intellectual-frontiers/terminal/width";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const MODES = "0006-signals FR-021";
const PALETTE = "0006-signals FR-022";
const WIDTH = "0006-signals FR-023";
const WARN = "0006-signals FR-024";

const E = "\u001b";
const MS = 1_000_000n;

const registry = defineSignals({
  build: { signal: "span", role: "step", attributes: { target: "string" } },
  compile: { signal: "span", role: "detail", attributes: { file: "string" } },
  check: { signal: "span", role: "result", attributes: {} },
  internal: { signal: "span", role: "none", attributes: {} },
  hint: { signal: "log", role: "hint", severity: SEVERITY.INFO, attributes: { text: "string" } },
  warn: { signal: "log", role: "warning", severity: SEVERITY.WARN, attributes: { text: "string" } },
  note: { signal: "log", role: "step", severity: SEVERITY.INFO, attributes: { text: "string" } },
  noise: { signal: "log", role: "none", severity: SEVERITY.INFO, attributes: { text: "string" } },
  later: { signal: "log", role: "pending", severity: SEVERITY.INFO, attributes: { text: "string" } },
  yours: { signal: "log", role: "action", severity: SEVERITY.INFO, attributes: { text: "string" } },
});

type Look = { readonly colour: boolean; readonly emoji: boolean; readonly columns: number };

const LOOK: Look = { colour: false, emoji: true, columns: 60 };

/** A telemetry whose every signal goes through the renderer, with a clock the test moves, and a screen fed every frame. */
function harness(mode: Mode, look: Look = LOOK, extra: { readonly maxLive?: number; readonly after?: (frames: string) => void } = {}) {
  let t = 1_700_000_000_000n * MS;
  let state: State = initial({ mode, look, registry, ...(extra.maxLive === undefined ? {} : { maxLive: extra.maxLive }) });
  const screen = createScreen({ width: look.columns });
  const frames: string[] = [];
  const feed = (input: Input): void => {
    const step = render(state, input, t);
    state = step.state;
    frames.push(step.frames);
    screen.write(step.frames);
    extra.after?.(step.frames);
  };
  const done = (): Promise<FlushResult> => Promise.resolve({ kind: "done" });
  const processor: Processor = {
    onStart: (span, source) => feed({ kind: "span-start", span, source }),
    onEvent: (span, event, source) => feed({ kind: "span-event", span, event, source }),
    onEnd: (span, source) => feed({ kind: "span-end", span, source }),
    onLog: (record, source) => feed({ kind: "log", record, source }),
    forceFlush: done,
    shutdown: done,
  };
  let n = 0;
  const telemetry = createTelemetry({
    registry,
    resource: { attributes: { "service.name": "test" } },
    scope: { name: "test" },
    clock: () => t,
    random: (size) => new Uint8Array(size).map((_, i) => (i === size - 1 ? ++n % 256 : i === size - 2 ? Math.floor(n / 256) + 1 : 0)),
    processors: [processor],
  });
  return {
    telemetry,
    screen,
    feed,
    advance: (ms: number): void => {
      t += BigInt(ms) * MS;
    },
    output: (): string => frames.join(""),
  };
}

type Harness = ReturnType<typeof harness>;

/** A run: a build with a compile in progress, a hidden span, a hint, a warning, a failing check; each step's screen kept. */
function scenario(h: Harness): string[] {
  const shots: string[] = [];
  const shot = (): void => void shots.push(h.screen.text());
  h.telemetry.span("build", { target: "site" }, (b) => {
    shot();
    h.advance(1200);
    h.feed({ kind: "tick" });
    shot();
    b.span("compile", { file: "a.ts" }, (c) => {
      c.progress(3, 10);
      shot();
      h.advance(500);
      return ok(1);
    });
    shot();
    b.span("internal", {}, () => {
      b.log("hint", { text: "run with --fix" });
      b.log("noise", { text: "not shown" });
      return ok(undefined);
    });
    b.log("warn", { text: "slow disk" });
    h.advance(300);
    b.span("check", {}, () => err("2 problems"));
    shot();
    return ok(undefined);
  });
  h.feed({ kind: "export-warning", message: "the signals were not sent: no collector answered" });
  h.feed({ kind: "export-warning", message: "the signals were not sent: no collector answered" });
  shot();
  h.feed({ kind: "finish" });
  shot();
  return shots;
}

const FINAL = [
  "  ✅ compile a.ts 500ms",
  "  👉 run with --fix",
  "  \u{26a0}\u{fe0f} slow disk",
  "  ❌ check: 2 problems 0ms",
  "✅ build site 2.0s",
];

proves(
  [MODES, WIDTH],
  "attended: the live region nested by parent, with elapsed time and progress, redrawn in place; final lines above it",
  () => {
    const h = harness("attended");
    const shots = scenario(h);
    assertEquals(shots, [
      "build site… 0ms",
      "build site… 1.2s",
      "build site… 1.2s\n  compile a.ts… 0ms 3/10 30%",
      "  ✅ compile a.ts 500ms\nbuild site… 1.7s",
      [...FINAL.slice(0, 4), "build site… 2.0s"].join("\n"),
      FINAL.join("\n"),
      [...FINAL, "\u{26a0}\u{fe0f} the signals were not sent: no collector answered"].join("\n"),
    ]);
    assert(h.output().includes(`${E}[1A${E}[J`), "the region is erased by cursor up and erase in display");
  },
);

proves([MODES], "plain: the final lines appended, nothing in progress, no escape sequence", () => {
  const h = harness("plain", { ...LOOK, colour: true });
  scenario(h);
  const out = h.output();
  assert(!out.includes(E), "no escape byte, even where the look allows colour");
  assertEquals(out, [...FINAL, "\u{26a0}\u{fe0f} the signals were not sent: no collector answered", ""].join("\n"));
});

proves([MODES], "quiet: only warnings, errors and results; silent: nothing", () => {
  const q = harness("quiet");
  scenario(q);
  assertEquals(q.output(), [FINAL[2], FINAL[3], "\u{26a0}\u{fe0f} the signals were not sent: no collector answered", ""].join("\n"));
  const s = harness("silent");
  scenario(s);
  assertEquals(s.output(), "");
});

proves([MODES], "json: one OTLP JSON logs request of one record per line, for each shown signal", () => {
  const h = harness("json");
  scenario(h);
  const lines = h
    .output()
    .split("\n")
    .filter((l) => l !== "");
  const records = lines.map((l) => {
    const r = decodeLogs(JSON.parse(l));
    assert(r.kind === "ok", "each line is an OTLP logs request");
    assertEquals(r.value.length, 1);
    const [batch] = r.value;
    assertEquals(batch?.records.length, 1);
    return batch?.records[0];
  });
  assertEquals(
    records.map((r) => [r?.eventName, r?.severityText, r?.body]),
    [
      ["compile", "INFO", "[ok] compile a.ts 500ms"],
      ["hint", "INFO", undefined],
      ["warn", "WARN", undefined],
      ["check", "ERROR", "[x] check: 2 problems 0ms"],
      ["build", "INFO", "[ok] build site 2.0s"],
      ["ifc.console.export", "WARN", "the signals were not sent: no collector answered"],
    ],
  );
  assertEquals(records[0]?.attributes, { file: "a.ts" });
  assert(records.every((r) => r !== undefined && (r.eventName === "ifc.console.export" || r.traceId !== undefined)));
});

proves([MODES], "the mode: the one asked for by name, else attended at a terminal and plain elsewhere", () => {
  assertEquals(chooseMode({ tty: true }), "attended");
  assertEquals(chooseMode({ tty: false }), "plain");
  assertEquals(chooseMode({ requested: "JSON", tty: true }), "json");
  assertEquals(chooseMode({ requested: "quiet", tty: false }), "quiet");
  assertEquals(chooseMode({ requested: "loud", tty: false }), "plain");
  assertEquals(parseMode("silent"), "silent");
  assertEquals(parseMode(""), undefined);
});

proves([PALETTE], "marks fall back to ASCII without emoji, and colour is written only where the look allows it", () => {
  const a = harness("attended", { colour: false, emoji: false, columns: 60 });
  scenario(a);
  assertEquals(a.screen.lines(), [
    "  [ok] compile a.ts 500ms",
    "  -> run with --fix",
    "  [!] slow disk",
    "  [x] check: 2 problems 0ms",
    "[ok] build site 2.0s",
    "[!] the signals were not sent: no collector answered",
  ]);
  assert(!a.output().includes(`${E}[3`) && !a.output().includes(`${E}[2m`), "no colour without the look's leave");
  const c = harness("attended", { colour: true, emoji: true, columns: 60 });
  scenario(c);
  const style = (row: number, col: number): string => {
    const cell = c.screen.cell(row, col);
    return cell === undefined ? "outside" : describeStyle(cell.style);
  };
  assertEquals(style(0, 2), describeStyle(createStyled(`${E}[32mX`)), "✅ in the success colour");
  assertEquals(style(3, 2), describeStyle(createStyled(`${E}[31mX`)), "❌ in the failure colour");
  assertEquals(style(5, 0), describeStyle(createStyled(`${E}[2mX`)), "the export warning dimmed");
});

/** The style a screen gives a cell after the given bytes. */
function createStyled(bytes: string) {
  const s = createScreen({ width: 4 });
  s.write(bytes);
  const cell = s.cell(0, 0);
  assert(cell !== undefined);
  return cell.style;
}

proves([WIDTH], "a line is cut to the width by display width, never wrapped; elapsed time and progress as a person reads them", () => {
  const h = harness("attended", { colour: true, emoji: true, columns: 12 });
  h.telemetry.span("build", { target: "测试测试测试" }, () => {
    assertEquals(h.screen.lines(), ["build 测试测"]);
    assertEquals(h.screen.cursor().row, 1, "the line did not wrap");
    return ok(undefined);
  });
  assertEquals(h.screen.lines(), ["✅ build 测"]);
  assertEquals(cutToWidth("✅ 测试", 6), "✅ 测");
  assertEquals([0n, 420n * MS, 1234n * MS, 59_999n * MS, 184_000n * MS, 7_500_000n * MS, -5n].map(duration), [
    "0ms",
    "420ms",
    "1.2s",
    "59.9s",
    "3m04s",
    "2h05m",
    "0ms",
  ]);
  assertEquals([progressText(3, 10), progressText(7), progressText(12, 10), progressText(1, 0)], ["3/10 30%", "7", "12/10 100%", "1"]);
});

proves([WIDTH], "a crowded live region keeps to its height and counts the rest", () => {
  const h = harness("attended", LOOK, { maxLive: 3 });
  h.telemetry.span("build", { target: "a" }, (b) =>
    b.span("build", { target: "b" }, (c) =>
      c.span("build", { target: "c" }, (d) =>
        d.span("build", { target: "d" }, () => {
          assertEquals(h.screen.lines(), ["build a… 0ms", "  build b… 0ms", "… 2 more"]);
          return ok(undefined);
        }),
      ),
    ),
  );
});

proves([WARN], "an export warning is said once, dimmed, at the end of the run, and nowhere else", () => {
  for (const mode of ["attended", "plain", "quiet"] as const) {
    const h = harness(mode);
    h.feed({ kind: "export-warning", message: "export failed: 503" });
    assertEquals(h.output(), "", `${mode}: nothing before the end`);
    h.telemetry.span("build", { target: "x" }, () => ok(undefined));
    h.feed({ kind: "export-warning", message: "export failed: 503" });
    h.feed({ kind: "finish" });
    h.feed({ kind: "export-warning", message: "later" });
    h.feed({ kind: "finish" });
    assertEquals(h.output().split("export failed").length, 2, `${mode}: said once`);
    assertEquals(h.screen.lines().at(-1), "\u{26a0}\u{fe0f} export failed: 503", `${mode}: last`);
    assert(!h.output().includes("later"), `${mode}: nothing after the end`);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Properties over random runs
// ---------------------------------------------------------------------------------------------------------------------------------

type Node =
  | {
      readonly kind: "span";
      readonly name: "build" | "compile" | "check" | "internal";
      readonly label: string;
      readonly ms: number;
      readonly fail: boolean;
      readonly children: readonly Node[];
    }
  | { readonly kind: "log"; readonly name: "hint" | "warn" | "note" | "noise"; readonly text: string }
  | { readonly kind: "progress"; readonly done: number; readonly total: number | undefined }
  | { readonly kind: "tick"; readonly ms: number };

const text = fc.oneof(
  fc.string({ unit: "grapheme", maxLength: 30 }),
  fc.constantFrom("测试测试测试测试", "✅ done", "a\nb", `${E}[31mred`, "tab\there", "\r\b", "👍🏽👨\u200d👩\u200d👧"),
);

const { node } = fc.letrec<{ node: Node }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small" },
    fc.record(
      { kind: fc.constant("log" as const), name: fc.constantFrom("hint", "warn", "note", "noise"), text },
      { noNullPrototype: true },
    ),
    fc.record(
      { kind: fc.constant("progress" as const), done: fc.nat(100), total: fc.option(fc.nat(100), { nil: undefined }) },
      { noNullPrototype: true },
    ),
    fc.record({ kind: fc.constant("tick" as const), ms: fc.nat(5000) }, { noNullPrototype: true }),
    fc.record(
      {
        kind: fc.constant("span" as const),
        name: fc.constantFrom("build", "compile", "check", "internal"),
        label: text,
        ms: fc.nat(200_000),
        fail: fc.boolean(),
        children: fc.array(tie("node"), { maxLength: 4 }),
      },
      { noNullPrototype: true },
    ),
  ),
}));

/** Runs the nodes through a harness's telemetry; spans run their children, then end. */
function play(h: Harness, nodes: readonly Node[], leaveOpen: boolean): void {
  type Handle = Parameters<Parameters<Harness["telemetry"]["span"]>[2]>[0];
  const run = (n: Node, parent: Handle | undefined): void => {
    switch (n.kind) {
      case "log":
        (parent ?? h.telemetry).log(n.name, { text: n.text });
        return;
      case "progress":
        parent?.progress(n.done, n.total);
        return;
      case "tick":
        h.advance(n.ms);
        h.feed({ kind: "tick" });
        return;
      case "span": {
        const body = (s: Handle) => {
          for (const c of n.children) run(c, s);
          h.advance(n.ms);
          return n.fail ? err(n.label) : ok(n.label);
        };
        const on = parent ?? h.telemetry;
        if (n.name === "build") on.span("build", { target: n.label }, body);
        else if (n.name === "compile") on.span("compile", { file: n.label }, body);
        else on.span(n.name, {}, body);
        return;
      }
      default:
        absurd(n);
    }
  };
  for (const n of nodes) run(n, undefined);
  if (leaveOpen) {
    // A span still open at the end of the run: the console says it was cancelled.
    h.telemetry.span("build", { target: "open" }, () => {
      h.feed({ kind: "export-warning", message: "export failed" });
      h.feed({ kind: "finish" });
      return 0;
    });
  } else h.feed({ kind: "finish" });
}

const runs = fc.record(
  {
    nodes: fc.array(node, { maxLength: 6 }),
    columns: fc.integer({ min: 8, max: 50 }),
    emoji: fc.boolean(),
    colour: fc.boolean(),
    open: fc.boolean(),
  },
  { noNullPrototype: true },
);

proves(
  [MODES, WIDTH],
  "property: plain never writes an escape byte; attended never wraps, and ends showing plain's lines cut to the width",
  () => {
    fc.assert(
      fc.property(runs, ({ nodes, columns, emoji, colour, open }) => {
        const look = { colour, emoji, columns };
        const plain = harness("plain", look);
        play(plain, nodes, open);
        const out = plain.output();
        assert(!out.includes(E), "no escape byte in plain");
        assert(
          ![...out].some((c) => c !== "\n" && (c.charCodeAt(0) < 0x20 || (c.charCodeAt(0) >= 0x7f && c.charCodeAt(0) <= 0x9f))),
          "no control character",
        );

        // Follow every frame: the narrow screen shows what a wide one does, so no line wrapped.
        const wide = createScreen({ width: 1000 });
        const narrow: { screen?: Screen } = {};
        const attended = harness("attended", look, {
          after: (frames) => {
            wide.write(frames);
            if (narrow.screen !== undefined) assertEquals(narrow.screen.lines(), wide.lines(), "a line wrapped");
          },
        });
        narrow.screen = attended.screen;
        play(attended, nodes, open);
        const expected = out
          .split("\n")
          .slice(0, -1)
          .map((l) => cutToWidth(l, columns).replace(/ +$/, ""));
        while (expected.length > 0 && expected.at(-1) === "") expected.pop();
        assertEquals(attended.screen.lines(), expected);
      }),
      { numRuns: 150 },
    );
  },
);

proves([MODES], "only a kind whose role is not none is shown, in every mode", () => {
  for (const mode of ["attended", "plain", "quiet", "json"] as const) {
    const h = harness(mode);
    h.telemetry.span("internal", {}, () => {
      h.telemetry.log("noise", { text: "hidden" });
      return err("hidden failure");
    });
    h.feed({ kind: "finish" });
    assertEquals(h.output(), "", mode);
  }
});

proves(["0006-signals FR-027"], "pending is ⏳ and an action is ⚡: neither a warning nor an error; quiet keeps the action", () => {
  for (const mode of ["plain", "quiet"] as const) {
    const h = harness(mode);
    h.telemetry.log("later", { text: "a certificate is not issued yet" });
    h.telemetry.log("yours", { text: "send the change: bun run stolos apply" });
    const out = h.output();
    if (mode === "plain") assert(out.includes("\u{23f3} a certificate is not issued yet"), out);
    else assert(!out.includes("certificate"), "quiet leaves out what is only pending");
    assert(out.includes("\u{26a1} send the change: bun run stolos apply"), out);
    assert(!out.includes("\u{26a0}\u{fe0f} send") && !out.includes("\u{274c}"), "never marked as a warning or an error");
  }
});
