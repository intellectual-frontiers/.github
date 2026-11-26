/**
 * Tests of `src/ui-render.ts`: the lines of every kind of step at the three levels, as snapshots, every line within the columns, no escape
 * sequence at `plain`, wide characters wrapped whole, and text from the caller made safe (commons 0002-ui FR-003).
 *
 * @module
 */
import fc from "fast-check";
import { type FlowStep, decodeStep, renderPrompt, renderResult, renderStep, wrap } from "../src/ui.ts";
import { displayWidth } from "../src/width.ts";
import { createScreen } from "../src/vt.ts";
import { assert, assertEquals, assertNotMatch, proves } from "@intellectual-frontiers/test";
import { bare, capsOf } from "./ui-helpers.ts";

const FR = "0002-ui FR-003";

const steps: Readonly<Record<string, FlowStep>> = {
  question: {
    id: "synthetic-step-01",
    kind: "question",
    summary: "Choose the folder for the synthetic works",
    say: "The works are kept in one folder; pick where it goes.",
    ask: [{ field: "folder", prompt: "Which folder?", hint: "a path such as ./works" }],
    evidence: ["synthetic-evidence-01"],
  },
  run: {
    id: "synthetic-step-02",
    kind: "run",
    summary: "Install the packages",
    say: "",
    verb: { id: "synthetic-install", inputs: { frozen: true, root: "./works" } },
  },
  human: {
    id: "synthetic-step-03",
    kind: "human",
    summary: "Approve the key",
    say: "Open the settings page and approve key synthetic-key-01.",
    gate: { who: "person" },
  },
  wait: { id: "synthetic-step-04", kind: "wait", summary: "Waiting for the host", say: "" },
  done: { id: "synthetic-step-05", kind: "done", summary: "All set", say: "Nothing more to do." },
};

proves([FR], "plain snapshot of every kind at 40 columns", () => {
  const c = capsOf("plain", 40);
  assertEquals(renderStep(steps["question"]!, c), [
    "[ask] Choose the folder for the",
    "      synthetic works",
    "  The works are kept in one folder; pick",
    "  where it goes.",
    "  you are asked for:",
    "    - folder: Which folder? (a path such",
    "      as ./works)",
    "  evidence:",
    "    - synthetic-evidence-01",
  ]);
  assertEquals(renderStep(steps["run"]!, c), ["[run] Install the packages", "  will run: synthetic-install", "  inputs: frozen=true root=./works"]);
  assertEquals(renderStep(steps["human"]!, c), [
    "[you] Approve the key",
    "  Open the settings page and approve key",
    "  synthetic-key-01.",
    "  This step is yours: the guide will not",
    "  do it and will not confirm it for you.",
    "  When it is done, press Enter.",
  ]);
  assertEquals(renderStep(steps["wait"]!, c), ["[wait] Waiting for the host"]);
  assertEquals(renderStep(steps["done"]!, c), ["[done] All set", "  Nothing more to do."]);
});

proves([FR], "ansi snapshot: the tag painted in its role, the rest as plain", () => {
  const c = capsOf("ansi", 40);
  assertEquals(renderStep(steps["done"]!, c), ["\u001b[32m[done]\u001b[0m All set", "  Nothing more to do."]);
  assertEquals(renderStep(steps["wait"]!, c), ["\u001b[2m[wait]\u001b[0m Waiting for the host"]);
  assertEquals(renderStep(steps["human"]!, c)[0], "\u001b[1m[you]\u001b[0m Approve the key");
  for (const s of Object.values(steps)) assertEquals(renderStep(s, c).map(bare), renderStep(s, capsOf("plain", 40)));
});

proves([FR], "full shows the palette's emoji where the terminal does, and the lines still fit", () => {
  const c = { ...capsOf("full", 40), emoji: true };
  const done = renderStep(steps["done"]!, c);
  assertEquals(bare(done[0] ?? ""), "✅ All set");
  assertEquals(bare(renderStep(steps["human"]!, c)[0] ?? ""), "👤 Approve the key");
  for (const s of Object.values(steps)) for (const l of renderStep(s, c)) assert(displayWidth(l) <= 40, l);
});

proves([FR], "plain holds no escape sequence and ASCII furniture; the other levels only colour", () => {
  for (const s of Object.values(steps)) {
    for (const l of renderStep(s, capsOf("plain", 50))) assertNotMatch(l, /[\u001b\u0000-\u0008\u000b-\u001f]/);
    for (const level of ["ansi", "full"] as const) {
      for (const l of renderStep(s, capsOf(level, 50))) {
        const escapes = l.match(/\u001b\[[0-9;?]*[A-Za-z]/g) ?? [];
        for (const e of escapes) assert(/^\u001b\[[0-9;]*m$/.test(e), `only colour: ${JSON.stringify(e)}`);
      }
    }
  }
  // The guide's own furniture is ASCII; only the caller's words may not be.
  for (const s of Object.values(steps)) for (const l of renderStep(s, capsOf("plain", 50))) assert(/^[\x20-\x7e]*$/.test(l), l);
});

proves([FR], "a wide character at the edge goes whole to the next line; a long word is cut between graphemes", () => {
  const lines = wrap("测试测试测试", 5, 0);
  assertEquals(lines, ["测试", "测试", "测试"]);
  for (const l of lines) assert(displayWidth(l) <= 5);
  assertEquals(wrap("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  assertEquals(wrap("ab cd\n\nef", 20), ["ab cd", "", "ef"]);
  assertEquals(wrap("one two three four", 9, 2), ["  one two", "  three", "  four"]);
});

proves([FR], "every line fits the columns, at any width and for any text (property)", () => {
  fc.assert(
    fc.property(fc.integer({ min: 20, max: 120 }), fc.string({ maxLength: 200 }), fc.constantFrom("plain", "ansi", "full"), (columns, text, level) => {
      const step: FlowStep = { id: "x", kind: "run", summary: text || "s", say: text, verb: { id: text || "v", inputs: { a: text } } };
      for (const l of renderStep(step, capsOf(level, columns))) assert(displayWidth(l) <= columns, `${columns}: ${JSON.stringify(l)}`);
    }),
  );
});

proves([FR], "the escape sequences and control characters of the caller's text are removed before it is shown", () => {
  const step: FlowStep = {
    id: "x",
    kind: "done",
    summary: "ok\u001b[31m red \u001b]0;title\u0007fine",
    say: "line one\r\nline\ttwo \u001b[2J\u0007gone\u0000",
  };
  for (const level of ["plain", "ansi", "full"] as const) {
    const text = renderStep(step, capsOf(level, 40)).map(bare).join("\n");
    assertNotMatch(text, /[\u001b\u0007\u0000]/);
  }
  assertEquals(renderStep(step, capsOf("plain", 40)), ["[done] ok red fine", "  line one", "  line two gone"]);
});

proves([FR], "what the person sees on a terminal is the plain text (the emulator of vt)", () => {
  const lines = renderStep(steps["question"]!, capsOf("ansi", 40));
  const s = createScreen({ width: 40 });
  s.write(`${lines.join("\n")}\n`);
  assertEquals(s.lines(), renderStep(steps["question"]!, capsOf("plain", 40)));
});

proves([FR], "a prompt ends with the place to type; a result says what came of a verb", () => {
  const f = { field: "folder", prompt: "Which folder?", hint: "a path" };
  assertEquals(renderPrompt(f, { columns: 40 }), ["  Which folder? (a path)", "  > "]);
  assertEquals(renderPrompt({ ...f, hint: "" }, { columns: 40 }), ["  Which folder?", "  > "]);
  assertEquals(renderResult(true, "3 packages", ["a", "b"], capsOf("plain", 40)), ["[ok] 3 packages", "  a", "  b"]);
  assertEquals(renderResult(false, "it broke", [], capsOf("plain", 40)), ["[failed] it broke"]);
  assertEquals(renderResult(true, "x", [], { ...capsOf("full", 40), emoji: true }).map(bare), ["✅ x"]);
});

proves([FR], "a decoded step renders as it was written (the steps are the ones the decoder gives)", () => {
  for (const s of Object.values(steps)) {
    const d = decodeStep(JSON.parse(JSON.stringify(s)));
    assert(d.kind === "ok");
    assertEquals(renderStep(d.value, capsOf("plain", 40)), renderStep(s, capsOf("plain", 40)));
  }
});

const UUID = "00000000-0000-4000-8000-000000000001";

proves(["0002-ui FR-010"], "a token that fits the width is never broken: an order id stays whole at 41 and 60 columns, indented less where it must", () => {
  for (const columns of [41, 60]) {
    const c = capsOf("plain", columns);
    const lines = renderStep(
      { id: "synthetic-step-06", kind: "done", summary: "The synthetic order is open", say: "", evidence: [`order: ${UUID}`, `started: false`] },
      c,
    );
    assert(lines.some((l) => l.includes(UUID)), `${columns} columns: the id is on one line, whole\n${lines.join("\n")}`);
    for (const l of lines) assert(displayWidth(l) <= columns);
  }
  const narrow = wrap(`Command: opsfolio work run ${UUID} --apply`, 41, 2);
  assertEquals(narrow.filter((l) => l.includes(UUID)).length, 1);
  for (const l of narrow) assert(displayWidth(l) <= 41);
});

proves(["0002-ui FR-010"], "a token wider than the width itself is cut, and a wide character wider than the line does not loop", () => {
  const long = "x".repeat(50);
  const lines = wrap(long, 40, 4);
  assertEquals(lines.join("").replaceAll(" ", ""), long);
  for (const l of lines) assert(displayWidth(l) <= 40);
  assertEquals(wrap("a", 1).join(""), "a");
  assertEquals(wrap("\u4e2d\u6587", 1).filter((l) => l !== "").length >= 2, true);
});

proves(["0002-ui FR-010"], "Windows: CRLF text and a long path are wrapped as LF text, the path kept whole where it fits, at narrow widths", () => {
  const path = "C:\\Users\\synthetic-user-01\\Documents\\works";
  const crlf = wrap(`first line\r\nthen ${path} here\r\nlast`, 48, 2);
  assert(crlf.every((l) => !l.includes("\r")));
  assertEquals(crlf.filter((l) => l.includes(path)).length, 1);
  for (const width of [20, 24, 30, 41, 48]) {
    for (const l of wrap(`step\r\n${path}\r\n${UUID}`, width, 4)) assert(displayWidth(l) <= width, `${width}: ${l}`);
  }
  // The same text through the step renderer at the narrowest width (20 columns): every line fits.
  const c = capsOf("plain", 20);
  for (const l of renderStep({ id: "synthetic-step-07", kind: "done", summary: `Open ${path}`, say: `see\r\n${path}`, evidence: [UUID] }, c)) {
    assert(displayWidth(l) <= 20);
  }
});

proves(["0002-ui FR-015"], "a failure is printed once: a detail that only repeats the summary is not shown", () => {
  const lines = renderResult(false, "the run failed", ["the run failed", "cause: synthetic-cause-01"], capsOf("plain", 60));
  assertEquals(lines, ["[failed] the run failed", "  cause: synthetic-cause-01"]);
});
