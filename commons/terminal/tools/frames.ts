// Spec: 0002-ui FR-009
/**
 * Prints text frames of the ui from the emulator of `vt`, for review (commons terminal 0002-ui): a home with a select, the same filtered, a
 * flow step mid-run and a table of hosts, at 100x30 and 60x24. With a directory as argument it writes one `<name>.frame` file each.
 * Run: `bun tools/frames.ts [DIR]`.
 *
 * @module
 */
import { RESET } from "../src/width.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { type Dress, drawnOf, drawScreen, wrap, frameOf, type Drawn, renderHome, renderSelect, renderTable, selectKey, selectStart, type SelectState } from "../src/ui.ts";
import { createScreen } from "../src/vt.ts";

const tasks = ["Enroll a bootable server", "Enroll a server", "Converge a host", "Set up workspaces", "Build, publish and serve a site", "Manage access", "Run a program on a host"].map(
  (label, i) => ({ id: `synthetic-task-${String(i + 1).padStart(2, "0")}`, label, icon: "run" as const }),
);
const FOOTER = "up/down choose   Enter open   / search   Ctrl+C quit";
const chips = [{ text: "fleet 1 tenant, 2 hosts, 1 plan waiting", role: "accent" as const, icon: "host" as const }];

const typed = (s: SelectState, text: string): SelectState => [...text].reduce((st, c) => selectKey(st, { name: "char", text: c }).state, selectKey(s, { name: "char", text: "/" }).state);

type Z = { columns: number; rows: number };
type Draw = (size: Z, caps: Dress) => Drawn;
const homeOf = (state: SelectState, size: Z, caps: Dress): Drawn =>
  renderHome({ title: "Opsfolio", chips, body: (s) => renderSelect(state, s, caps), footer: FOOTER }, size, caps);

const hosts = {
  columns: [
    { key: "host", title: "Host" },
    { key: "tenant", title: "Tenant" },
    { key: "state", title: "State" },
    { key: "plans", title: "Plans", align: "right" as const },
  ],
  rows: [
    { host: "synthetic-host-01", tenant: "synthetic-tenant-01", state: "converged", plans: "0" },
    { host: "synthetic-host-02", tenant: "synthetic-tenant-01", state: "plan waiting", plans: "1" },
  ],
  selected: 1,
};

const flow: Draw = (size, caps) =>
  drawScreen(
    {
      title: "Enroll a server",
      plan: ["Check the host", "Compare the fingerprint", "Install the key", "Probe the host", "Record the result", "Finish"].map((title, i) => ({ id: `p${i}`, title })),
      done: new Set(["p0"]),
      skipped: new Set(["p2"]),
      failed: new Set(["p3"]),
      current: "p1",
      pane: ["[human] Compare the fingerprint", ...wrap("Read the fingerprint on the host console and compare it with the one shown here.", 34, 2), "", ...wrap("Command: opsfolio enroll --host synthetic-host-02", 34, 2), "", "  > "],
      pinned: 1,
      protect: [4, 5],
      status: "waiting for you",
      keys: "Enter done   Ctrl+C stop",
      typing: true,
    },
    size,
    caps,
  );

const sizes = [
  { name: "100x30", columns: 100, rows: 30 },
  { name: "60x24", columns: 60, rows: 24 },
] as const;
const COLOUR: Dress = { colour: true, colourDepth: "truecolor", emoji: true };
const PLAIN: Dress = { colour: false, colourDepth: "none", emoji: false };
/** The frame with its colour and emoji: one line per row, the escapes in place, a reset at the end of each row. */
const makeAnsi = (draw: Draw, size: Z): string => draw(size, COLOUR).lines.map((l) => `${l}${RESET}`).join("\n") + "\n";
const make = (draw: Draw, size: Z): string => {
  const s = createScreen({ width: size.columns, height: size.rows });
  s.write(frameOf(draw(size, PLAIN)));
  const rule = `+${"-".repeat(size.columns)}+`;
  return [rule, ...Array.from({ length: size.rows }, (_, i) => `|${(s.lines()[i] ?? "").padEnd(size.columns)}|`), rule].join("\n") + "\n";
};
const frames: Record<string, Draw> = {
  home: (z, c) => homeOf(selectStart(tasks, 1), z, c),
  "home-filtered": (z, c) => homeOf(typed(selectStart(tasks, 1), "ser"), z, c),
  flow,
  table: (z, c) => renderHome({ title: "Hosts", chips, body: (s) => drawnOf(renderTable(hosts, s, c)), footer: "up/down choose   Enter open   Esc back   Ctrl+C quit" }, z, c),
};

const dir = process.argv[2];
if (dir !== undefined) mkdirSync(dir, { recursive: true });
for (const [name, draw] of Object.entries(frames)) {
  for (const z of sizes) {
    const text = make(draw, z);
    if (dir === undefined) process.stdout.write(`== ${name} ${z.name}\n${text}`);
    else {
      writeFileSync(`${dir}/${name}-${z.name}.frame`, text);
      writeFileSync(`${dir}/${name}-${z.name}-color.ansi`, makeAnsi(draw, z));
    }
  }
}
