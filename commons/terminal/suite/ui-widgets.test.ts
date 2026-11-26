/**
 * Tests of `table`, `statusBar`, `log` and `home` (commons terminal 0002-ui FR-021, FR-022) on the emulator of `vt`.
 *
 * @module
 */
import { type Key, drawnOf, frameOf, logKey, renderHome, renderLog, renderSelect, renderTable, selectStart, statusBar, type TableSpec } from "../src/ui.ts";
import { createScreen } from "../src/vt.ts";
import { displayWidth } from "../src/width.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { bare } from "./ui-helpers.ts";

const table: TableSpec = {
  columns: [
    { key: "host", title: "Host" },
    { key: "state", title: "State" },
    { key: "n", title: "Plans", align: "right" },
  ],
  rows: [
    { host: "synthetic-host-01", state: "converged", n: "0" },
    { host: "synthetic-host-02", state: "plan waiting", n: "12" },
  ],
  selected: 1,
};

proves(["0002-ui FR-021"], "a table: header, widths, the selected row marked, right alignment", () => {
  const lines = renderTable(table, { columns: 60, rows: 5 }, { colour: false });
  assertEquals(lines.length, 5);
  assertEquals(lines[0]?.trimEnd(), "  Host               State         Plans");
  assertEquals(lines[1]?.trimEnd(), "  synthetic-host-01  converged         0");
  assertEquals(lines[2]?.trimEnd(), "> synthetic-host-02  plan waiting     12");
  for (const l of lines) assertEquals(displayWidth(l), 60);
});

proves(["0002-ui FR-021"], "a narrow table cuts the widest column with ~ and a long one keeps the header and the selected row", () => {
  const narrow = renderTable(table, { columns: 30, rows: 4 }, { colour: false });
  for (const l of narrow) assertEquals(displayWidth(l), 30);
  assert(narrow[1]?.includes("~") === true);
  const many: TableSpec = { ...table, rows: Array.from({ length: 40 }, (_, i) => ({ host: `synthetic-host-${i}`, state: "ok", n: "1" })), selected: 33 };
  const lines = renderTable(many, { columns: 50, rows: 6 }, { colour: false });
  assert(lines[0]?.includes("Host") === true && lines.some((l) => l.startsWith("> synthetic-host-33")));
});

proves(["0002-ui FR-021"], "the status bar is one line of exactly the width, cut with ~, colour only where allowed", () => {
  const chips = [{ text: "2 hosts" }, { text: "1 plan waiting", role: "warn" as const }];
  assertEquals(bare(statusBar(chips, 30, { colour: true })), "2 hosts  1 plan waiting".padEnd(30));
  assertEquals(statusBar(chips, 10, { colour: false }), "2 hosts  ~");
  assertEquals(statusBar(chips, 30, { colour: false }).includes("\u001b"), false);
});

proves(["0002-ui FR-021"], "the log shows the last rows, wrapped, and scrolls by key", () => {
  const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`);
  assertEquals(renderLog(lines, { columns: 12, rows: 3 }, 0, { colour: false }).map((l) => l.trimEnd()), ["line 7", "line 8", "line 9"]);
  assertEquals(renderLog(lines, { columns: 12, rows: 3 }, 2, { colour: false }).map((l) => l.trimEnd()), ["line 5", "line 6", "line 7"]);
  const wrapped = renderLog(["a very long line of text here"], { columns: 10, rows: 2 }, 0, { colour: false });
  assertEquals(wrapped.length, 2);
  assert(wrapped.every((l) => displayWidth(l) === 10) && wrapped[1]?.trimEnd().endsWith("here") === true);
  const k = (name: Key["name"]): Key => ({ name, text: "" });
  assertEquals(logKey(0, 10, 3, k("up")), 1);
  assertEquals(logKey(6, 10, 3, k("up")), 7);
  assertEquals(logKey(7, 10, 3, k("up")), 7);
  assertEquals(logKey(3, 10, 3, k("pagedown")), 0);
  assertEquals(logKey(3, 10, 3, k("home")), 7);
  assertEquals(logKey(3, 10, 3, k("end")), 0);
});

const tasks = ["Enroll a bootable server", "Enroll a server", "Converge a host", "Set up workspaces", "Build, publish and serve a site", "Manage access", "Run a program on a host"].map((label, i) => ({ id: `synthetic-task-${i + 1}`, label }));
const FOOTER = "up/down choose   Enter open   / search   Ctrl+C quit";
const home = (columns: number, rows: number, colour = false) =>
  renderHome(
    { title: "Opsfolio", chips: [{ text: "fleet 1 tenant, 2 hosts, 1 plan waiting", role: "accent" }], body: (size) => renderSelect(selectStart(tasks, 1), size, { colour }), footer: FOOTER },
    { columns, rows },
    { colour },
  );

proves(["0002-ui FR-022"], "home at 100x30 and 60x24 on vt: header, body, footer on the last row, every row the width", () => {
  for (const [columns, rows] of [[100, 30], [60, 24]] as const) {
    const d = home(columns, rows);
    assertEquals(d.lines.length, rows);
    for (const l of d.lines) assertEquals(displayWidth(l), columns);
    const s = createScreen({ width: columns, height: rows });
    s.write(frameOf(d));
    const out = s.lines();
    assert(out[0]?.startsWith(" Opsfolio") === true && out[0]?.includes("fleet 1 tenant, 2 hosts, 1 plan waiting") === true);
    assertEquals(out[3], "> Enroll a server");
    assertEquals(out[rows - 1], ` ${FOOTER}`);
  }
});

proves(["0002-ui FR-022"], "on a short screen the footer and the selected row are kept and the body is clipped", () => {
  for (const rows of [3, 4, 5, 8]) {
    const d = renderHome({ title: "T", chips: [], body: (size) => renderSelect(selectStart(Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, label: `row ${i}` })), 15), size, { colour: false }), footer: FOOTER }, { columns: 60, rows }, { colour: false });
    assertEquals(d.lines.length, rows);
    assertEquals(d.lines[rows - 1]?.trimEnd(), ` ${FOOTER}`);
    if (rows >= 3) assert(d.lines.some((l) => l.startsWith("> row 15")), `rows ${rows}`);
  }
  assertEquals(drawnOf(["a"]).cursor, undefined);
});

proves(["0002-ui FR-022"], "a narrow screen cuts the chips with ~ and keeps the title; colour only where allowed", () => {
  const d = renderHome({ title: "Opsfolio", chips: [{ text: "fleet 1 tenant, 2 hosts, 1 plan waiting" }], body: () => drawnOf([]), footer: "x" }, { columns: 30, rows: 8 }, { colour: false });
  assert(d.lines[0]?.startsWith(" Opsfolio") === true && d.lines[0]?.includes("~") === true && displayWidth(d.lines[0] ?? "") === 30);
  assertEquals(home(60, 24, true).lines.map(bare), home(60, 24, false).lines);
});
