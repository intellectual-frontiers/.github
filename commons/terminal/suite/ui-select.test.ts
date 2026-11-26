/**
 * Tests of `select` (commons terminal 0002-ui FR-020): the render on the emulator at the three levels, filter, wrap, scroll and the numbered
 * fallback read by line.
 *
 * @module
 */
import { type Key, renderSelect, renderSelectPlain, selectByLine, selectFiltered, selectKey, selectStart, type SelectItem, type SelectState } from "../src/ui.ts";
import { createScreen } from "../src/vt.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { bare, scriptedIn } from "./ui-helpers.ts";

const FR = "0002-ui FR-020";
const items: SelectItem[] = [
  { id: "synthetic-task-01", label: "Enroll a bootable server" },
  { id: "synthetic-task-02", label: "Enroll a server", badge: "new", description: "first contact with a host" },
  { id: "synthetic-task-03", label: "Converge a host" },
  { id: "synthetic-task-04", label: "Manage access" },
];
const k = (name: Key["name"], text = ""): Key => ({ name, text });
const typed = (s: SelectState, text: string): SelectState => [...text].reduce((st, c) => selectKey(st, k("char", c)).state, s);

proves([FR], "the render marks the chosen item, shows badge and description, and is exactly the size", () => {
  const d = renderSelect(selectStart(items, 1), { columns: 50, rows: 6 }, { colour: false });
  assertEquals(d.lines.length, 6);
  for (const l of d.lines) assertEquals([...l].length, 50);
  assertEquals(d.lines[0]?.trimEnd(), "  Enroll a bootable server");
  assertEquals(d.lines[1]?.trimEnd(), "> Enroll a server [new]  first contact with a host");
  const s = createScreen({ width: 50, height: 6 });
  s.write(d.lines.map((l, i) => `\u001b[${i + 1};1H${l}`).join(""));
  assertEquals(s.lines()[1], "> Enroll a server [new]  first contact with a host");
});

proves([FR], "colour only where allowed: the same text with and without", () => {
  const on = renderSelect(selectStart(items, 1), { columns: 50, rows: 6 }, { colour: true });
  const off = renderSelect(selectStart(items, 1), { columns: 50, rows: 6 }, { colour: false });
  assertEquals(on.lines.map(bare), off.lines);
  assert(on.lines.some((l) => l.includes("\u001b[")) && off.lines.every((l) => !l.includes("\u001b")));
});

proves([FR], "down and up wrap around; Tab moves down; Enter chooses the id", () => {
  let s = selectStart(items);
  s = selectKey(s, k("up")).state;
  assertEquals(s.index, 3);
  s = selectKey(s, k("down")).state;
  assertEquals(s.index, 0);
  s = selectKey(s, k("tab")).state;
  assertEquals(s.index, 1);
  assertEquals(selectKey(s, k("enter")).outcome, { kind: "chosen", id: "synthetic-task-02" });
});

proves([FR], "typing filters; the filter line shows; Backspace and Esc undo it; Esc with none and Ctrl+C abort", () => {
  let s = typed(selectKey(selectStart(items), k("char", "/")).state, "ser");
  assertEquals(selectFiltered(s).map((i) => i.id), ["synthetic-task-01", "synthetic-task-02"]);
  const d = renderSelect(s, { columns: 40, rows: 5 }, { colour: false });
  assertEquals(d.lines[0]?.trimEnd(), "  / ser");
  assertEquals(d.cursor, { row: 0, col: 7 });
  s = typed(s, "x");
  assertEquals(selectFiltered(s).length, 0);
  assertEquals(renderSelect(s, { columns: 40, rows: 5 }, { colour: false }).lines[1]?.trimEnd(), "  (nothing matches)");
  assertEquals(selectKey(s, k("enter")).outcome, undefined);
  s = selectKey(s, k("backspace")).state;
  assertEquals(s.filter, "ser");
  s = selectKey(s, k("escape")).state;
  assertEquals(s.filter, "");
  assertEquals(selectKey(s, k("escape")).outcome, { kind: "abort" });
  assertEquals(selectKey(s, k("ctrl-c")).outcome, { kind: "abort" });
});

proves([FR], "a long list scrolls and the chosen item stays in view; a long line is cut with ~", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `synthetic-item-${i}`, label: `Item number ${i} with a rather long label` }));
  for (const at of [0, 14, 29]) {
    const d = renderSelect(selectStart(many, at), { columns: 20, rows: 5 }, { colour: false });
    assertEquals(d.lines.length, 5);
    assert(d.lines.some((l) => l.startsWith("> ")), `selected ${at} in view`);
    assert(d.lines.every((l) => [...l].length === 20 && (l.trimEnd().endsWith("~") || l.trim() === "")));
  }
});

proves([FR], "plain: a numbered list read by line: a number, a label, q, a wrong line and the end", async () => {
  assertEquals(renderSelectPlain(items, 80)[1], "2. Enroll a server [new] - first contact with a host");
  const run = async (lines: string[]) => {
    const out: string[] = [];
    const r = await selectByLine({ items, title: "Tasks", out: { write: (t) => void out.push(t) }, in: scriptedIn(lines, false), caps: { columns: 80 } });
    return { r, text: out.join("") };
  };
  assertEquals((await run(["3\r\n"])).r, { kind: "ok", value: "synthetic-task-03" });
  assertEquals((await run(["converge a host\n"])).r, { kind: "ok", value: "synthetic-task-03" });
  const bad = await run(["9\n", "x\n", "1\n"]);
  assertEquals(bad.r, { kind: "ok", value: "synthetic-task-01" });
  assert(bad.text.includes('"9" is not a choice.') && bad.text.includes("1. Enroll a bootable server"));
  assertEquals((await run(["q\n"])).r, { kind: "err", error: { kind: "aborted" } });
  assertEquals((await run([])).r, { kind: "err", error: { kind: "end" } });
});
