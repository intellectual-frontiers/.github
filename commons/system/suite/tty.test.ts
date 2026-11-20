/**
 * Tests of `tty` (commons 0001-system FR-018): colour, emoji and width follow the environment and the terminal.
 *
 * @module
 */
import { errors } from "../src/errors.ts";
import { consoleSize, currentLook, isTerminal, lookOf, setRaw } from "../src/tty.ts";
import { assert, assertEquals, assertThrows, proves } from "@intellectual-frontiers/test";

proves(["0001-system FR-018"], "colour, emoji and width follow the environment and the terminal", () => {
  const look = (env: Record<string, string>, terminal = true, os: "linux" | "darwin" | "windows" = "linux", columns?: number) =>
    lookOf({ env, terminal, os, ...(columns === undefined ? {} : { columns }) });
  assertEquals(look({ LANG: "en_US.UTF-8" }, true, "linux", 120), { tty: true, colour: true, emoji: true, columns: 120 });
  assertEquals(look({ LANG: "C" }, false), { tty: false, colour: false, emoji: false, columns: 80 });
  assertEquals(look({ NO_COLOR: "1", LANG: "C.utf8" }).colour, false);
  assertEquals(look({ NO_COLOR: "", LANG: "C" }).colour, true);
  assertEquals(look({ FORCE_COLOR: "1" }, false).colour, true);
  assertEquals(look({ FORCE_COLOR: "1", NO_COLOR: "1" }, false).colour, false);
  assertEquals(look({ TERM: "dumb" }).tty, false);
  assertEquals(look({ WT_SESSION: "x" }, true, "windows").emoji, true);
  assertEquals(look({ ConEmuANSI: "ON" }, true, "windows").emoji, true);
  assertEquals(look({}, true, "windows").emoji, false);
  assertEquals(look({ TERM_PROGRAM: "iTerm.app" }, true, "darwin").emoji, true);
  assertEquals(look({ LC_ALL: "C", LANG: "en_US.UTF-8" }).emoji, false);
  assertEquals(look({}, true, "linux", 20).columns, 80);
  const now = currentLook();
  assertEquals(typeof now.colour, "boolean");
  assertEquals(typeof isTerminal("stdout"), "boolean");
  const size = consoleSize();
  assert(size === undefined || size.columns > 0);
  if (!isTerminal("stdin")) assertThrows(() => setRaw(true), errors.NotSupported);
});
