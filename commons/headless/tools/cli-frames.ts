// Spec: 0004-headless-cli FR-018, FR-019, FR-020, FR-021, FR-022, FR-024
/**
 * The text frames of the command line (commons headless 0004-headless-cli FR-018 to FR-024): an example of each kind of output, drawn at a level and a width by the real renderer and with synthetic data
 * only (`synthetic-host-01`), so that a person can look at them and a test can hold them. `bun tools/cli-frames.ts DIR` writes each as `DIR/<name>.frame` (plain: what a pipe, CI or `NO_COLOR` shows) and `DIR/<name>.ansi`
 * (what a modern terminal shows: emoji and truecolor), ready to be shown in a real terminal (`cat DIR/failure-coded.ansi`).
 *
 * ```sh
 * bun tools/cli-frames.ts /tmp/cli-frames
 * ```
 *
 * @module
 */
import { capabilitiesOf } from "@intellectual-frontiers/terminal/ui";
import { fs, path } from "@intellectual-frontiers/system";
import { problem } from "../src/governance/mod.ts";
import { closingOf, outcomeOf } from "../src/logical/mod.ts";
import { helpFor } from "../src/surfaces/cli/help.ts";
import { renderClosing } from "../src/surfaces/cli/render.ts";
import { Reporter } from "../src/surfaces/cli/reporter.ts";
import { lookOf, type Look } from "../src/surfaces/cli/style.ts";
import { heartbeatLine, keyValues, sectionHeader, stepLive, styleHelp, tableLines, toneCell } from "../src/surfaces/cli/view.ts";
import { sample } from "../suite/world.ts";

/** The three levels a frame is drawn at. */
export const LEVELS = ["plain", "ansi", "full"] as const;

/** A level's name. */
export type Level = (typeof LEVELS)[number];

/** The look of a level at a width, made by the ui's `capabilitiesOf` as the host makes it: plain (a pipe), ansi (a small colour terminal, 16 colours, no emoji), full (truecolor and emoji). */
export function lookAt(level: Level, columns = 80): Look {
  switch (level) {
    case "plain":
      return lookOf(capabilitiesOf({}, { isTTY: false, columns }), false);
    case "ansi":
      return lookOf(capabilitiesOf({ TERM: "xterm" }, { isTTY: true, columns, rows: 8 }), true);
    case "full":
      return lookOf(capabilitiesOf({ COLORTERM: "truecolor", LANG: "en_US.UTF-8" }, { isTTY: true, columns, rows: 30 }), true);
  }
}

/** One frame: its name, what it shows, and how it is drawn at a look. */
export type Frame = { readonly name: string; readonly shows: string; readonly draw: (look: Look) => string };

const lines = (l: readonly string[]): string => `${l.join("\n")}\n`;

/** The columns of the table of hosts. */
const HOST_COLUMNS = [
  { key: "host", title: "HOST" },
  { key: "status", title: "STATUS" },
  { key: "exit", title: "EXIT", align: "right" },
  { key: "problem", title: "FIRST PROBLEM" },
] as const;

/** Every frame, in the order they are shown. */
export const FRAMES: readonly Frame[] = [
  {
    name: "success-next",
    shows: "a success with steps for the person and what comes next",
    draw: (look) =>
      renderClosing(
        closingOf(
          outcomeOf(null, {
            problems: [problem("action", "send the change to synthetic-repo-01", { fix: "tool send --to synthetic-repo-01 (the change is checked first)" }), problem("pending", "no token for synthetic-host-02 yet", { fix: "tool token synthetic-host-02", code: "P001-TOKEN" })],
            next: ["then: power on synthetic-host-01"],
          }),
          { fix: { commands: ["tool"], own: ["tool"] }, shownHints: [{ id: "h", message: "the remote is off", command: "tool remote on" }] },
        ),
        { look, verbosity: "calm" },
      ),
  },
  {
    name: "failure-coded",
    shows: "a failure with a code, a hint and the one command to run next",
    draw: (look) =>
      renderClosing(
        closingOf(
          outcomeOf(null, {
            problems: [
              problem("fail", "the disk of synthetic-host-01 is full", { fix: "tool clean synthetic-host-01 (it removes the old copies)", code: "E002-DISK" }),
              problem("warn", "synthetic-file-01.txt is large", { code: "E001-LARGE" }),
            ],
          }),
          { fix: { commands: ["tool"], own: ["tool"] }, shownHints: [{ id: "h", message: "a smaller cache keeps the disk free", command: "tool config cache 2g" }] },
        ),
        { look, verbosity: "calm" },
      ),
  },
  {
    name: "warning-list",
    shows: "a list of warnings, something pending and a step for the person, the run still ok",
    draw: (look) =>
      renderClosing(
        closingOf(
          outcomeOf(null, {
            problems: [
              problem("warn", "synthetic-file-01.txt is large", { code: "E001-LARGE", fix: "tool trim (it removes the old copies)" }),
              problem("warn", "synthetic-file-02.txt has no owner", { code: "E003-OWNER" }),
              problem("pending", "no token yet", { code: "P001-TOKEN", fix: "tool token" }),
              problem("action", "approve the change", { fix: "tool approve" }),
            ],
          }),
          { fix: { commands: ["tool"], own: ["tool"] }, shownHints: [] },
        ),
        { look, verbosity: "calm" },
      ),
  },
  {
    name: "phases",
    shows: "what a run tells as it goes: a header and a line for each phase that has something to see",
    draw: (look) => {
      const out: string[] = [];
      let t = 0;
      const r = new Reporter({ look: { ...look, tty: false }, verbosity: "verbose", write: (x) => void out.push(x), now: () => t });
      r.progress({ kind: "header", title: "tool sync", subtitle: "synthetic-host-01" });
      r.progress({ kind: "phase", name: "Packages" });
      r.progress({ kind: "item", item: "ok", message: "synthetic-package-01" });
      r.progress({ kind: "item", item: "skip", message: "synthetic-package-02" });
      t += 4000;
      r.progress({ kind: "phase", name: "Files" });
      r.progress({ kind: "item", item: "change", message: "synthetic-file-01.txt" });
      r.progress({ kind: "problem", problem: problem("warn", "synthetic-file-01.txt is large") });
      t += 72_000;
      r.progress({ kind: "phase", name: "Token" });
      r.progress({ kind: "problem", problem: problem("pending", "no token yet") });
      r.progress({ kind: "phase", name: "Send" });
      r.progress({ kind: "problem", problem: problem("action", "send the change") });
      r.progress({ kind: "phase", name: "Disk" });
      r.progress({ kind: "problem", problem: problem("fail", "the disk is full") });
      r.close();
      return out.join("");
    },
  },
  {
    name: "hosts-table",
    shows: "a table of hosts, each with its status icon, its exit status and its first problem",
    draw: (look) =>
      lines(
        tableLines(
          HOST_COLUMNS,
          [
            { host: "synthetic-host-01", status: toneCell("ok", "ok", look), exit: "0", problem: "" },
            { host: "synthetic-host-02", status: toneCell("fail", "failed", look), exit: "1", problem: "the disk is full" },
            { host: "synthetic-host-03", status: toneCell("warn", "unreachable", look), exit: "3", problem: "synthetic-host-03 could not be reached" },
            { host: "synthetic-host-04", status: toneCell("pending", "waiting", look), exit: "4", problem: "no token yet" },
          ],
          look,
        ),
      ),
  },
  {
    name: "report",
    shows: "a report: a section header and key: value rows",
    draw: (look) =>
      lines([
        ...sectionHeader("synthetic-host-01", look),
        ...keyValues(
          [
            ["state", "ready"],
            ["workspaces", "2 (synthetic-repo-01, synthetic-repo-02)"],
            ["last run", "2026-11-26 10:00"],
            ["log", "/home/synthetic-user-01/.local/state/tool/log/1.log"],
          ],
          look,
        ),
      ]),
  },
  {
    name: "progress",
    shows: "the line of a phase in progress at the start, with a bar, and after three minutes",
    draw: (look) =>
      lines([
        heartbeatLine({ name: "Packages", elapsedMs: 400, step: 0 }, look),
        heartbeatLine({ name: "Packages", live: stepLive(3, 10, "synthetic-package-03", look), elapsedMs: 12_000, step: 3 }, look),
        heartbeatLine({ name: "Build", live: "linking synthetic-work-01", elapsedMs: 190_000, step: 7 }, look),
      ]),
  },
  {
    name: "help-root",
    shows: "the help of the program",
    draw: (look) => `${styleHelp(helpFor(sample(), []) ?? "", look)}\n`,
  },
  {
    name: "help-command",
    shows: "the help of one command, with its effect",
    draw: (look) => `${styleHelp(helpFor(sample(), ["sync"]) ?? "", look)}\n`,
  },
];

/** Writes every frame into `dir`: `<name>.frame` plain at 80 columns, `<name>.ansi` at full (emoji and truecolor). Gives the names of the files. */
export async function writeFrames(dir: string, columns = 80): Promise<readonly string[]> {
  await fs.mkdir(dir, { recursive: true });
  const written: string[] = [];
  for (const f of FRAMES) {
    for (const [ext, level] of [["frame", "plain"], ["ansi", "full"]] as const) {
      const file = path.join(dir, `${f.name}.${ext}`);
      await fs.writeTextFile(file, f.draw(lookAt(level, columns)));
      written.push(file);
    }
  }
  return written;
}

if (import.meta.main) {
  const dir = process.argv[2] ?? "cli-frames";
  for (const file of await writeFrames(dir)) process.stdout.write(`${file}\n`);
}
