/**
 * Tests of the look of the command line: the marks (the palette's and no other), colour and width by the terminal's look, the spinner and the progress bar, the
 * closing block drawn, and the reporter that draws a run as it goes, read through the terminal emulator (commons headless 0004-headless-cli FR-001, FR-002, FR-003,
 * FR-005).
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { ICONS, lineMarkOf, tint } from "@intellectual-frontiers/terminal/ui";
import { createScreen } from "@intellectual-frontiers/terminal/vt";
import { displayWidth } from "@intellectual-frontiers/terminal/width";
import { problem } from "../src/governance/mod.ts";
import { closingOf, outcomeOf } from "../src/logical/mod.ts";
import { renderClosing } from "../src/surfaces/cli/render.ts";
import { Reporter } from "../src/surfaces/cli/reporter.ts";
import { lookOfRun } from "../src/surfaces/cli/run.ts";
import { fit, fmtDuration, iconOfTone, line, mark, progressBar, SPINNER, spinnerFrame, themeOfTone, type Look, type Tone } from "../src/surfaces/cli/style.ts";
import { lookAt } from "./looks.ts";
import { fakeTimer, sample, world } from "./world.ts";

const TONES: readonly Tone[] = ["fail", "warn", "pending", "action", "ok", "skip", "hint", "cancelled"];
const PLAIN: Look = lookAt("plain");
const FANCY: Look = lookAt("full");
const SRC = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "src");

proves(["0004-headless-cli FR-001", "0004-headless-cli FR-017"], "every tone is one icon of the ui's table, with its ASCII tag where there are no emoji, and one name of its theme", () => {
  assertEquals(
    TONES.map(iconOfTone),
    ["failed", "warn", "working", "action", "done", "skipped", "hint", "stop"],
  );
  const tags = ["[x]", "[!]", "[todo]", "[you]", "[ok]", "[skip]", "->", "[stop]"];
  for (const [i, t] of TONES.entries()) {
    assertEquals(mark(t, PLAIN), tags[i]);
    assertEquals(mark(t, { ...PLAIN, emoji: true }), ICONS[iconOfTone(t)].emoji);
    assertEquals(line(t, "text", PLAIN), `${tags[i]} text`);
    assertEquals(lineMarkOf(iconOfTone(t), PLAIN), tags[i]);
  }
  assertEquals(new Set(TONES.map(iconOfTone)).size, TONES.length, "no two tones share an icon");
  assertEquals(TONES.map(themeOfTone), ["error", "warn", "dim", "accent", "success", "dim", "accent", "dim"]);
  assertEquals(mark("ok", FANCY), tint("success", "✅", FANCY));
  assertEquals(mark("fail", FANCY), "\u001b[38;2;238;102;102m❌\u001b[0m");
  assertEquals(mark("ok", lookAt("ansi")), "\u001b[32m[ok]\u001b[0m");
});

proves(["0004-headless-cli FR-001"], "no file of the layers writes an emoji of its own: the only marks are the ui's table", async () => {
  const offenders: string[] = [];
  for (const rel of await fs.walkFiles(SRC)) {
    if (!rel.endsWith(".ts")) continue;
    const text = await fs.readTextFile(path.join(SRC, rel));
    // examples in comments may show a mark; code may not
    const code = text.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    if (/\p{Extended_Pictographic}/u.test(code)) offenders.push(rel);
  }
  assertEquals(offenders, []);
});

proves(["0004-headless-cli FR-002"], "colour is written only where the look allows it: a terminal, no NO_COLOR, FORCE_COLOR, and not with --no-color; emoji by the locale and the program's own variables", () => {
  const p = sample();
  const look = (env: Record<string, string>, terminal: boolean, colour = true, columns?: number) =>
    lookOfRun(p, world({ env, terminal: { stdin: terminal, stdout: terminal, stderr: terminal }, ...(columns === undefined ? {} : { columns }) }), colour);
  const shape = (l: Look) => ({ tty: l.tty, colour: l.colour, emoji: l.emoji, columns: l.columns });
  assertEquals(shape(look({}, false)), { tty: false, colour: false, emoji: false, columns: 80 });
  assertEquals(shape(look({ LANG: "en_US.UTF-8" }, true, true, 120)), { tty: true, colour: true, emoji: true, columns: 120 });
  assertEquals(look({ NO_COLOR: "1" }, true).colour, false);
  assertEquals(look({ FORCE_COLOR: "1" }, false).colour, true);
  assertEquals(look({ FORCE_COLOR: "1" }, false).tty, false);
  assertEquals(look({ LANG: "en_US.UTF-8" }, true, false).colour, false, "--no-color wins over the terminal");
  assertEquals(look({ FORCE_COLOR: "1" }, true, false).colour, false, "--no-color wins over FORCE_COLOR");
  assertEquals(look({ TERM: "dumb", LANG: "C.UTF-8" }, true).tty, false);
  assertEquals(look({ LANG: "C.UTF-8", TOOL_PLAIN: "1" }, true).emoji, false);
  assertEquals(look({ LANG: "C", TOOL_EMOJI: "1" }, true).emoji, true);
  assertEquals(look({ LANG: "C.UTF-8", TOOL_PLAIN: "1", TOOL_EMOJI: "1" }, true).emoji, false, "plain wins");
  assertEquals(look({}, true, true, 30).columns, 80, "a terminal narrower than 40 columns is taken as 80");
  assertEquals(lookOfRun(p, world({ env: { WT_SESSION: "x" }, os: "windows", terminal: true }), true).emoji, true);
  assertEquals(lookOfRun(p, world({ os: "windows", terminal: true }), true).emoji, false);
});

proves(["0004-headless-cli FR-002"], "a line is cut to the terminal's width, never inside a character or an escape sequence", () => {
  const look = { ...PLAIN, columns: 9 };
  assertEquals(fit("short", look), "short");
  assertEquals(fit("a long line of text", look), "a long …");
  assertEquals(displayWidth(fit("✅ 测试测试测试测试", look)), 8);
  const painted = tint("error", "abcdefghijklmnopqrstuvwxyz", { colour: true });
  const cut = fit(painted, look);
  assert(displayWidth(cut) <= 9 && cut.endsWith("…") || cut.endsWith("\u001b[0m…") || displayWidth(cut) <= 9, cut);
  fc.assert(
    fc.property(fc.string({ unit: "grapheme" }), fc.integer({ min: 40, max: 200 }), (text, columns) => {
      assert(displayWidth(fit(text, { ...PLAIN, columns })) <= columns - 1 || displayWidth(text) === 0);
    }),
  );
});

proves(["0004-headless-cli FR-005"], "the spinner and the bar are pure functions of a number, with ASCII frames where there are no emoji", () => {
  assertEquals(SPINNER.emoji.length, 10);
  assertEquals([0, 1, 10, 11, -1].map((n) => spinnerFrame(n, FANCY)), ["⠋", "⠙", "⠋", "⠙", "⠏"]);
  assertEquals([0, 1, 4, 5].map((n) => spinnerFrame(n, PLAIN)), ["|", "/", "|", "/"]);
  assertEquals(progressBar(0, 10, 10, PLAIN), "[----------]");
  assertEquals(progressBar(5, 10, 10, PLAIN), "[#####-----]");
  assertEquals(progressBar(10, 10, 10, FANCY), "[██████████]");
  assertEquals(progressBar(30, 47, 10, { ...FANCY, emoji: true }), "[██████░░░░]");
  assertEquals(progressBar(3, 0, 4, PLAIN), "[----]");
  assertEquals(progressBar(99, 10, 4, PLAIN), "[####]");
  fc.assert(fc.property(fc.integer(), (n) => assert(SPINNER.emoji.includes(spinnerFrame(n, FANCY)) && SPINNER.ascii.includes(spinnerFrame(n, PLAIN)))));
  assertEquals([640, 12_000, 72_000, 7_380_000].map(fmtDuration), ["640ms", "12s", "1m12s", "2h03m"]);
});

proves(["0004-headless-cli FR-001", "0004-headless-cli FR-003"], "the closing block is drawn with the ui's icons in the order it was chosen, the verdict last, and in quiet only the verdict", () => {
  const o = outcomeOf(null, {
    problems: [problem("fail", "root", { fix: "tool fix", code: "E1-ROOT", raw: "EPERM", logLine: 4 }), problem("warn", "slow", { code: "E1-SLOW" }), problem("action", "send it", { fix: "tool send" }), problem("pending", "no token", { fix: "tool token" })],
    next: ["then: power on alpha"],
  });
  const c = closingOf(o, { fix: { commands: ["tool"], own: ["tool"] }, shownHints: [{ id: "h", message: "remote is off", command: "tool remote" }] });
  const calm = renderClosing(c, { look: PLAIN, verbosity: "calm" });
  assertEquals(
    calm,
    [
      "",
      "[!] slow [E1-SLOW]",
      "[you] send it",
      "   run: tool send",
      "[todo] no token",
      "   run: tool token",
      "-> remote is off",
      "   run: tool remote",
      "   power on alpha",
      "   1 failed, 1 warning, 1 pending, 1 for you",
      "[x] root [E1-ROOT]",
      "next: tool fix",
      "",
    ].join("\n"),
  );
  assertEquals(renderClosing(c, { look: PLAIN, verbosity: "quiet" }), "[x] root [E1-ROOT]\n");
  const verbose = renderClosing(c, { look: PLAIN, verbosity: "verbose", logPath: "/s/log/1.log" });
  assertStringIncludes(verbose, "   log: /s/log/1.log\n   1 failed, 1 warning, 1 pending, 1 for you\n[x] root");
  const fancy = renderClosing(closingOf(outcomeOf(null), { fix: { commands: [], own: [] }, shownHints: [] }), { look: FANCY, verbosity: "calm" });
  assertEquals(fancy, `\n${tint("success", "✅", FANCY)} ${tint("success", "Up to date", FANCY)}\n`);
  // verbose shows the raw text and the line of the log with the failure that has them
  const withRaw = renderClosing(closingOf(outcomeOf(null, { problems: [problem("fail", "a", { raw: "EPERM" }), problem("fail", "b", { raw: "EACCES", logLine: 9 })] }), { fix: { commands: [], own: [] }, shownHints: [] }), { look: PLAIN, verbosity: "verbose", logPath: "/l.log" });
  assertStringIncludes(withRaw, "   raw: EACCES");
  assertStringIncludes(withRaw, "   log: /l.log:9");
  assert(!renderClosing(closingOf(outcomeOf(null, { problems: [problem("fail", "a", { raw: "EPERM" }), problem("fail", "b", { raw: "EACCES" })] }), { fix: { commands: [], own: [] }, shownHints: [] }), { look: PLAIN, verbosity: "calm" }).includes("raw:"));
});

/** A reporter over a screen: what the person would see after each write. */
function over(look: Look, verbosity: "calm" | "verbose" | "quiet" | "json" = "calm", ticks = fakeTimer()) {
  const screen = createScreen({ width: look.columns });
  const writes: string[] = [];
  let t = 0;
  const reporter = new Reporter({ look, verbosity, write: (x) => { writes.push(x); screen.write(x); }, now: () => t, timer: ticks });
  return { reporter, screen, writes, ticks, advance: (ms: number) => void (t += ms) };
}

proves(["0004-headless-cli FR-003"], "in calm a phase that went well is no line and one with something to see is one, with its honest mark; verbose shows every step and item", () => {
  const calm = over(PLAIN);
  const r = calm.reporter;
  r.progress({ kind: "phase", name: "Packages" });
  r.progress({ kind: "item", item: "ok", message: "a" });
  r.progress({ kind: "done", result: "86 installed" });
  r.progress({ kind: "phase", name: "Files" });
  r.progress({ kind: "item", item: "change", message: "b" });
  r.progress({ kind: "problem", problem: problem("warn", "large") });
  r.progress({ kind: "phase", name: "Tokens" });
  r.progress({ kind: "problem", problem: problem("pending", "no token") });
  r.progress({ kind: "phase", name: "Send" });
  r.progress({ kind: "problem", problem: problem("action", "send it") });
  r.progress({ kind: "phase", name: "Build" });
  r.progress({ kind: "problem", problem: problem("warn", "w") });
  r.progress({ kind: "problem", problem: problem("fail", "f") });
  r.progress({ kind: "outcome", text: "Sent: applied within 15 minutes" });
  r.close();
  assertEquals(calm.screen.text(), ["[!] Files              1 changed", "[todo] Tokens", "[you] Send", "   Sent: applied within 15 minutes", "[x] Build"].join("\n"));
  assertEquals(r.problems.map((p) => p.level), ["warn", "pending", "action", "warn", "fail"]);
  assertEquals(r.outcomes, ["Sent: applied within 15 minutes"]);

  const loud = over(PLAIN, "verbose");
  loud.reporter.progress({ kind: "header", title: "tool sync", subtitle: "alpha" });
  loud.reporter.progress({ kind: "phase", name: "Packages" });
  loud.reporter.progress({ kind: "item", item: "ok", message: "a" });
  loud.reporter.progress({ kind: "item", item: "skip", message: "b" });
  loud.reporter.progress({ kind: "item", item: "note", message: "n" });
  loud.advance(72_000);
  loud.reporter.close();
  assertEquals(loud.screen.text(), ["tool sync  alpha", "   [ok] a", "   [skip] b", "   n", "[ok] Packages           1 ok, 1 skipped (1m12s)"].join("\n"));

  const hush = over(PLAIN, "quiet");
  hush.reporter.progress({ kind: "phase", name: "x" });
  hush.reporter.progress({ kind: "problem", problem: problem("fail", "f") });
  hush.reporter.close();
  assertEquals(hush.writes, []);
  const machine = over(PLAIN, "json");
  machine.reporter.progress({ kind: "header", title: "t", subtitle: "" });
  machine.reporter.progress({ kind: "outcome", text: "o" });
  machine.reporter.close();
  assertEquals(machine.writes, []);
});

proves(["0004-headless-cli FR-003"], "a phase with nothing but a step for the person shows that mark, and one with a failure and a warning the failure's", () => {
  const { reporter, screen } = over(PLAIN);
  reporter.progress({ kind: "phase", name: "A" });
  reporter.progress({ kind: "problem", problem: problem("pending", "p") });
  reporter.progress({ kind: "problem", problem: problem("action", "a") });
  reporter.progress({ kind: "phase", name: "B" });
  reporter.progress({ kind: "problem", problem: problem("warn", "w") });
  reporter.progress({ kind: "problem", problem: problem("fail", "f") });
  reporter.progress({ kind: "problem", problem: problem("warn", "w2") });
  reporter.close();
  assertEquals(screen.text(), ["[you] A", "[x] B"].join("\n"));
});

proves(["0004-headless-cli FR-005"], "on a terminal the phase in progress is one line redrawn in place and erased before a line that stays; elsewhere there are only the final lines", () => {
  const tty = over({ ...FANCY, colour: false, columns: 40 }, "verbose");
  const r = tty.reporter;
  r.progress({ kind: "phase", name: "Files" });
  assertEquals(tty.screen.text(), "⠋ Files");
  r.progress({ kind: "step", n: 3, total: 10, label: "/etc/ssh/sshd_config" });
  assertEquals(tty.screen.text(), "⠋ Files  [██████░░░░░░░░░░░░░░] 3/10  …");
  tty.ticks.tick();
  assertEquals(tty.screen.text().slice(0, 1), "⠙");
  r.progress({ kind: "item", item: "ok", message: "a.txt" });
  assertEquals(tty.screen.text().split("\n")[0], "   ✅ a.txt");
  assertEquals(tty.screen.text().split("\n")[1]?.slice(0, 7), "⠙ Files");
  r.progress({ kind: "live", message: "reading b.txt" });
  assertEquals(tty.screen.text().split("\n")[1], "⠙ Files  reading b.txt");
  r.progress({ kind: "done", result: "2 files" });
  r.close();
  assertEquals(tty.screen.text(), ["   ✅ a.txt", "✅ Files              2 files"].join("\n"));
  assertEquals(tty.ticks.running(), 0, "the timer stops with the phase");
  // a pipe: no control character at all, and no redraw
  const pipe = over({ ...PLAIN, columns: 40 }, "verbose");
  pipe.reporter.progress({ kind: "phase", name: "Files" });
  pipe.reporter.progress({ kind: "step", n: 1, total: 2, label: "x" });
  pipe.reporter.progress({ kind: "live", message: "y" });
  pipe.reporter.progress({ kind: "item", item: "ok", message: "a" });
  pipe.reporter.close();
  const all = pipe.writes.join("");
  assert(!/[\u0000-\u0009\u000b-\u001f]/.test(all), JSON.stringify(all));
  assertEquals(pipe.ticks.running(), 0);
  // in calm and in quiet the line in progress is drawn on a terminal too, and is gone at the end
  const calm = over({ ...FANCY, colour: false }, "calm");
  calm.reporter.progress({ kind: "phase", name: "Work" });
  assertEquals(calm.screen.text(), "⠋ Work");
  calm.reporter.close();
  assertEquals(calm.screen.text(), "");
  const quiet = over({ ...FANCY, colour: false }, "quiet");
  quiet.reporter.progress({ kind: "phase", name: "Work" });
  quiet.reporter.close();
  assertEquals(quiet.writes, []);
});
