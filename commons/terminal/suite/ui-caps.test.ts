/**
 * Tests of `src/ui-caps.ts`: the level of a terminal from its environment and its stream, for a TTY, a pipe, `NO_COLOR`, `TERM=dumb`, `CI`,
 * a small terminal, a forced level and a Windows terminal (commons 0002-ui FR-002).
 *
 * @module
 */
import { atMost, capabilitiesOf, type UiLevel } from "../src/ui.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const FR = "0002-ui FR-002";
const tty = { isTTY: true, columns: 100, rows: 30 };

proves([FR], "a TTY with nothing against it is full; colour from ansi up; emoji only where the terminal shows them", () => {
  const c = capabilitiesOf({ TERM: "xterm-256color", LANG: "en_US.UTF-8" }, tty);
  assertEquals([c.level, c.colour, c.emoji, c.columns, c.rows], ["full", true, true, 100, 30]);
  assertEquals(capabilitiesOf({ TERM: "xterm-256color", LANG: "C" }, tty).emoji, false);
  assertEquals(capabilitiesOf({ TERM: "linux", LANG: "en_US.UTF-8" }, tty).emoji, false);
});

proves([FR], "plain where the stream is not a TTY, NO_COLOR is set and not empty, TERM is dumb or CI is set", () => {
  const plain: readonly (readonly [string, Record<string, string>, Parameters<typeof capabilitiesOf>[1]])[] = [
    ["a pipe", {}, { isTTY: false, columns: 100, rows: 30 }],
    ["no isTTY", {}, {}],
    ["NO_COLOR", { NO_COLOR: "1" }, tty],
    ["TERM=dumb", { TERM: "dumb" }, tty],
    ["CI=true", { CI: "true" }, tty],
    ["CI=1", { CI: "1" }, tty],
  ];
  for (const [name, env, stream] of plain) {
    const c = capabilitiesOf(env, stream);
    assertEquals([name, c.level, c.colour, c.emoji], [name, "plain", false, false]);
  }
  // Set and empty (NO_COLOR=""), CI=0 and CI=false do not count.
  assertEquals(capabilitiesOf({ NO_COLOR: "" }, tty).level, "full");
  assertEquals(capabilitiesOf({ CI: "0" }, tty).level, "full");
  assertEquals(capabilitiesOf({ CI: "false" }, tty).level, "full");
  assertEquals(capabilitiesOf({ CI: "" }, tty).level, "full");
});

proves([FR], "ansi where the TTY is under 60 columns or 12 rows; full from exactly 60 by 12", () => {
  assertEquals(capabilitiesOf({}, { isTTY: true, columns: 59, rows: 30 }).level, "ansi");
  assertEquals(capabilitiesOf({}, { isTTY: true, columns: 100, rows: 11 }).level, "ansi");
  assertEquals(capabilitiesOf({}, { isTTY: true, columns: 60, rows: 12 }).level, "full");
  assertEquals(capabilitiesOf({}, { isTTY: true, columns: 59, rows: 30 }).colour, true);
});

proves([FR], "a stream with no size gets 80 by 24, and a bad size is not taken", () => {
  assertEquals(capabilitiesOf({}, { isTTY: true }).columns, 80);
  assertEquals(capabilitiesOf({}, { isTTY: true, columns: 0, rows: Number.NaN }).rows, 24);
  assertEquals(capabilitiesOf({}, { isTTY: false }).columns, 80);
});

proves([FR], "a forced level only lowers: a pipe stays plain, a TTY can be made ansi or plain", () => {
  assertEquals(capabilitiesOf({}, tty, "ansi").level, "ansi");
  assertEquals(capabilitiesOf({}, tty, "plain").colour, false);
  assertEquals(capabilitiesOf({}, { isTTY: false }, "full").level, "plain");
  assertEquals(capabilitiesOf({ NO_COLOR: "1" }, tty, "ansi").level, "plain");
  const lowered = atMost(capabilitiesOf({ WT_SESSION: "x" }, tty), "ansi");
  assertEquals([lowered.level, lowered.colour, lowered.emoji], ["ansi", true, false]);
  assertEquals(atMost(lowered, "full"), lowered);
});

proves([FR], "a Windows terminal is decided by isTTY and the environment, never by the name of the operating system", () => {
  // Windows Terminal with PowerShell 7: a TTY, no TERM, WT_SESSION set.
  const wt = capabilitiesOf({ WT_SESSION: "00000000-0000-4000-8000-000000000000", PROMPT: "$P$G", OS: "Windows_NT" }, tty);
  assertEquals([wt.level, wt.emoji], ["full", true]);
  // The same machine with its output redirected: plain.
  assertEquals(capabilitiesOf({ WT_SESSION: "x", OS: "Windows_NT" }, { isTTY: false }).level, "plain");
  // An environment with the Windows variable names in any case is no different from any other.
  const levels: UiLevel[] = [{ OS: "Windows_NT" }, { os: "Windows_NT" }, { COMSPEC: "C:\\Windows\\System32\\cmd.exe" }].map((env) => capabilitiesOf(env, tty).level);
  assert(levels.every((l) => l === "full"));
});
