/**
 * Tests of how the command line looks through the terminal's ui (commons headless 0004-headless-cli FR-016 to FR-025): the snapshots of every kind of output at the three levels
 * (plain, ansi, full) and at 60, 80 and 100 columns, the widths and alignment of tables with emoji, CRLF texts, a pipe, `CI`, `NO_COLOR`, `TERM=dumb` and `TERM=linux` writing no escape and no emoji,
 * the host's capabilities given to a run, the `--json` document that never changes, and the layering of the renderer.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { capabilitiesOf } from "@intellectual-frontiers/terminal/ui";
import { displayWidth } from "@intellectual-frontiers/terminal/width";
import { problem } from "../src/governance/mod.ts";
import { closingOf, command, outcomeOf, programOf } from "../src/logical/mod.ts";
import { helpFor } from "../src/surfaces/cli/help.ts";
import { hostCaps } from "../src/surfaces/cli/host.ts";
import { renderClosing } from "../src/surfaces/cli/render.ts";
import { Reporter } from "../src/surfaces/cli/reporter.ts";
import { lookOfRun, run } from "../src/surfaces/cli/run.ts";
import { lookOf, type Look } from "../src/surfaces/cli/style.ts";
import { countsLine, heartbeatLine, keyValues, sectionHeader, styleHelp, tableLines, toneCell } from "../src/surfaces/cli/view.ts";
import { FRAMES } from "../tools/cli-frames.ts";
import { hasEmoji, hasEscape, LEVELS, lookAt, WIDTHS } from "./looks.ts";
import { fakeTimer, sample, world } from "./world.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const SNAPSHOTS = path.join(ROOT, "suite", "fixtures", "frames");
const SGR = /\u001b\[[0-9;]*m/g;
const strip = (t: string): string => t.replace(SGR, "");
/** A frame with its escape character shown, so that a snapshot can be read and compared as text. */
const shown = (t: string): string => t.replaceAll("\u001b", "␛");

proves(["0004-headless-cli FR-018", "0004-headless-cli FR-019", "0004-headless-cli FR-020", "0004-headless-cli FR-021", "0004-headless-cli FR-022", "0004-headless-cli FR-024"], "snapshots: every kind of output at plain, ansi and full, at 60, 80 and 100 columns", async () => {
  const update = process.env["UPDATE_SNAPSHOTS"] === "1";
  if (update) await fs.mkdir(SNAPSHOTS, { recursive: true });
  for (const f of FRAMES) {
    for (const columns of WIDTHS) {
      const text = LEVELS.map((level) => `### ${level} at ${columns}\n${shown(f.draw(lookAt(level, columns)))}`).join("\n");
      const file = path.join(SNAPSHOTS, `${f.name}-${columns}.snap`);
      if (update) await fs.writeTextFile(file, text);
      else assertEquals(text, await fs.readTextFile(file), `${f.name} at ${columns} columns differs from ${file} (run with UPDATE_SNAPSHOTS=1 to hold the new look)`);
    }
  }
});

proves(["0004-headless-cli FR-016", "0004-headless-cli FR-017"], "plain has no escape sequence and no emoji, ansi has colour and no emoji, full has both, in every frame", () => {
  for (const f of FRAMES) {
    for (const columns of WIDTHS) {
      const plain = f.draw(lookAt("plain", columns));
      assert(!hasEscape(plain) && !hasEmoji(plain), `${f.name}: plain\n${plain}`);
      const ansi = f.draw(lookAt("ansi", columns));
      assert(!hasEmoji(ansi), `${f.name}: ansi holds an emoji`);
      if (f.name !== "phases") assert(hasEscape(ansi) || f.name === "report" && false, `${f.name}: ansi has no colour`);
      const full = f.draw(lookAt("full", columns));
      assert(hasEscape(full), `${f.name}: full has no colour`);
    }
  }
  const failure = FRAMES.find((f) => f.name === "failure-coded")?.draw(lookAt("full", 80)) ?? "";
  assert(hasEmoji(failure) && failure.includes("38;2;"), "full: emoji and truecolor");
  const sixteen = FRAMES.find((f) => f.name === "failure-coded")?.draw(lookAt("ansi", 80)) ?? "";
  assert(!sixteen.includes("38;2;") && !sixteen.includes("38;5;") && sixteen.includes("\u001b[31;1m"), "ansi: the 16 colours");
});

proves(["0004-headless-cli FR-016"], "a pipe, CI, NO_COLOR, TERM=dumb, TERM=linux, --no-color and the program's PLAIN write no escape and no emoji", () => {
  const p = sample();
  const cases: readonly [string, Record<string, string>, boolean, boolean][] = [
    ["a pipe", { LANG: "C.UTF-8", COLORTERM: "truecolor" }, false, true],
    ["CI", { CI: "true", LANG: "C.UTF-8", COLORTERM: "truecolor" }, true, true],
    ["NO_COLOR", { NO_COLOR: "1", LANG: "C.UTF-8", COLORTERM: "truecolor" }, true, true],
    ["TERM=dumb", { TERM: "dumb", LANG: "C.UTF-8" }, true, true],
    ["--no-color", { LANG: "C.UTF-8", COLORTERM: "truecolor" }, true, false],
    ["TOOL_PLAIN", { LANG: "C.UTF-8", COLORTERM: "truecolor", TOOL_PLAIN: "1" }, true, true],
  ];
  const c = closingOf(outcomeOf(null, { problems: [problem("fail", "root", { code: "E1-ROOT", fix: "tool fix" }), problem("warn", "slow", { code: "E1-SLOW" }), problem("action", "send it", { fix: "tool send" })] }), { fix: { commands: ["tool"], own: ["tool"] }, shownHints: [{ id: "h", message: "a hint", command: "tool x" }] });
  for (const [what, env, terminal, colour] of cases) {
    const look = lookOfRun(p, world({ env, terminal }), colour);
    const text = renderClosing(c, { look, verbosity: "verbose", logPath: "/l.log" });
    assert(!hasEscape(text) && !hasEmoji(text), `${what}\n${text}`);
    assertEquals([look.colour, look.emoji], [false, false], what);
  }
  const linux = lookOfRun(p, world({ env: { TERM: "linux", LANG: "C.UTF-8" }, terminal: true }), true);
  assertEquals(linux.emoji, false, "TERM=linux shows no emoji");
  assert(!hasEmoji(renderClosing(c, { look: linux, verbosity: "calm" })));
  const full = lookOfRun(p, world({ env: { LANG: "C.UTF-8", COLORTERM: "truecolor" }, terminal: true, columns: 100 }), true);
  assertEquals([full.level, full.colourDepth, full.emoji, full.columns], ["full", "truecolor", true, 100]);
});

proves(["0004-headless-cli FR-016"], "the capabilities the host decides once are the ones a run draws with, and they are only lowered, never raised", async () => {
  const caps = capabilitiesOf({ COLORTERM: "truecolor", LANG: "en_US.UTF-8" }, { isTTY: true, columns: 90, rows: 30 });
  const go = (o: Parameters<typeof world>[0]) => run(sample(), ["sync", "--warn", "--wait"], world(o));
  const given = await go({ caps, terminal: true, env: {} });
  assert(given.err.includes("\u001b[38;2;") && hasEmoji(given.err), given.err);
  // the environment is not read where the host gave the capabilities; NO_COLOR and the program's PLAIN still lower them
  assert(!hasEscape((await go({ caps, terminal: true, env: { NO_COLOR: "1" } })).err));
  assert(!hasEmoji((await go({ caps, terminal: true, env: { TOOL_PLAIN: "1" } })).err));
  const low = capabilitiesOf({}, { isTTY: false, columns: 90 });
  assert(!hasEscape((await go({ caps: low, terminal: false, env: {} })).err), "plain capabilities stay plain");
  const hosted = hostCaps({ NO_COLOR: "1", LANG: "en_US.UTF-8" });
  assertEquals([hosted.caps.level, hosted.outCaps.level], ["plain", "plain"]);
});

proves(["0004-headless-cli FR-019", "0004-headless-cli FR-020"], "a report draws a table and key: value rows from the capabilities of the output stream, plain where the output is a pipe and in json", async () => {
  const report = programOf({
    name: "tool",
    summary: "A tool.",
    version: "1.0.0",
    children: [
      command({
        name: "hosts",
        summary: "List the hosts.",
        options: {},
        action: { kind: "report" },
        run: (_a, ctx) => {
          const look = lookOf(ctx.ui ?? capabilitiesOf({}, { isTTY: false }), false);
          const text = tableLines([{ key: "host", title: "HOST" }, { key: "state", title: "STATE" }], [{ host: "synthetic-host-01", state: toneCell("ok", "ready", look) }, { host: "synthetic-host-02", state: toneCell("fail", "down", look) }], look).join("\n");
          return Promise.resolve(outcomeOf({ n: 2 }, { text }));
        },
      }),
    ],
  });
  const tty = capabilitiesOf({ COLORTERM: "truecolor", LANG: "C.UTF-8" }, { isTTY: true, columns: 80, rows: 30 });
  const pipe = capabilitiesOf({}, { isTTY: false, columns: 80 });
  const drawn = await run(report, ["hosts"], world({ caps: pipe, outCaps: tty, terminal: { stdin: false, stdout: true, stderr: false } }));
  assert(hasEmoji(drawn.out) && drawn.out.includes("\u001b[38;2;"), drawn.out);
  const piped = await run(report, ["hosts"], world({ caps: tty, outCaps: pipe, terminal: { stdin: false, stdout: false, stderr: true } }));
  assert(!hasEmoji(piped.out) && !hasEscape(piped.out), piped.out);
  assertEquals(strip(drawn.out).replaceAll("✅", "[ok]").replaceAll("❌", "[x]").split("\n")[0], piped.out.split("\n")[0]);
  const json = await run(report, ["hosts", "--json"], world({ caps: tty, outCaps: tty, terminal: true }));
  assert(!hasEmoji(json.out) && !hasEscape(json.out), "json is plain");
  assertEquals(await run(report, ["hosts", "--no-color"], world({ caps: tty, outCaps: tty, terminal: true })), await run(report, ["hosts", "--no-color"], world({ caps: pipe, outCaps: pipe })));
});

proves(["0004-headless-cli FR-020", "0004-headless-cli FR-024"], "a table never misaligns: the columns start at the same width with emoji, colour or neither, and no line is wider than the terminal", () => {
  for (const level of LEVELS) {
    for (const columns of WIDTHS) {
      const look = lookAt(level, columns);
      const rows = [
        { host: "synthetic-host-01", status: toneCell("ok", "ok", look), exit: "0", problem: "" },
        { host: "synthetic-host-02", status: toneCell("fail", "failed", look), exit: "1", problem: "the disk is full" },
        { host: "synthetic-host-03", status: toneCell("warn", "unreachable", look), exit: "3", problem: "no route to synthetic-host-03 across the long way round the synthetic network of synthetic-site-01" },
        { host: "测试主机", status: toneCell("pending", "waiting", look), exit: "4", problem: "no token yet" },
      ];
      const lines = tableLines([{ key: "host", title: "HOST" }, { key: "status", title: "STATUS" }, { key: "exit", title: "EXIT", align: "right" }, { key: "problem", title: "FIRST PROBLEM" }], rows, look);
      assertEquals(lines.length, rows.length + 1);
      for (const l of lines) assert(displayWidth(l) <= columns, `${level} ${columns}: ${displayWidth(l)} wide\n${lines.join("\n")}`);
      // every row's last column begins where the header's does
      const at = (l: string): number => displayWidth(strip(l).slice(0, strip(l).search(/FIRST|the disk|no route|no token/)));
      const starts = lines.slice(1).filter((l) => /no token|disk is full|no route/.test(l)).map(at);
      assertEquals(new Set(starts).size, 1, `${level} ${columns}: ${starts.join(",")}\n${lines.join("\n")}`);
      assertEquals(at(lines[0] ?? ""), starts[0], `${level} ${columns}: the header\n${lines.join("\n")}`);
      assertEquals(tableLines([{ key: "a", title: "A" }], [], look).length, 1);
    }
  }
});

proves(["0004-headless-cli FR-019", "0004-headless-cli FR-021", "0004-headless-cli FR-024"], "headers, key: value rows and the heartbeat fit every width and never hold a carriage return; the heartbeat shows the time from one second", () => {
  for (const level of LEVELS) {
    for (const columns of WIDTHS) {
      const look = lookAt(level, columns);
      const long = "x".repeat(300);
      const drawn = [...sectionHeader(long, look), ...keyValues([["key", long], ["a longer key", "v\r\nignored"]], look), heartbeatLine({ name: "Build", live: long, elapsedMs: 190_000, step: 2 }, look)];
      for (const l of drawn) assert(displayWidth(l) <= columns, `${level} ${columns}: ${displayWidth(l)}`);
      assert(!drawn.join("\n").includes("\r"), "no carriage return");
    }
  }
  const look = lookAt("plain");
  assertEquals(heartbeatLine({ name: "Build", elapsedMs: 900, step: 0 }, look), "| Build");
  assertEquals(heartbeatLine({ name: "Build", elapsedMs: 190_000, step: 1 }, look), "/ Build  3m10s");
  assertEquals(heartbeatLine({ name: "Build", live: "50%", elapsedMs: 12_000, step: 0 }, lookAt("full")).replace(SGR, ""), "⠋ Build  50%  12s");
  assertEquals(keyValues([["state", "ready"], ["workspaces", "2"]], look), ["  state:      ready", "  workspaces: 2"]);
  assertEquals(countsLine({ fail: 1, warn: 2, pending: 0, action: 0 }, look), "   1 failed, 2 warnings");
  assertEquals(countsLine({ fail: 0, warn: 0, pending: 0, action: 0 }, look), undefined);
});

proves(["0004-headless-cli FR-021"], "a phase in progress on a terminal shows the time elapsed from one second, redrawn in place", () => {
  const out: string[] = [];
  let t = 0;
  const ticks = fakeTimer();
  const r = new Reporter({ look: lookAt("full", 80), verbosity: "calm", write: (x) => void out.push(x), now: () => t, timer: ticks });
  r.progress({ kind: "phase", name: "Packages" });
  assert(!strip(out.join("")).includes("1s"));
  t = 65_000;
  ticks.tick();
  assert(strip(out.at(-1) ?? "").includes("Packages  1m05s"), out.at(-1));
  r.close();
});

proves(["0004-headless-cli FR-024"], "a text with CRLF line endings is the same lines as with LF, with no carriage return and the continuation indented", () => {
  for (const level of LEVELS) {
    const look = lookAt(level, 80);
    const draw = (eol: string): string =>
      renderClosing(
        closingOf(outcomeOf(null, { problems: [problem("fail", `the disk is full${eol}on synthetic-host-01`, { code: "E002-DISK", fix: `say it${eol}tool clean` }), problem("warn", `slow${eol}and large`, { code: "E001-SLOW" })] }), { fix: { commands: ["tool"], own: ["tool"] }, shownHints: [] }),
        { look, verbosity: "calm" },
      );
    const lf = draw("\n");
    assertEquals(draw("\r\n"), lf, level);
    assertEquals(draw("\r"), lf, level);
    assert(!lf.includes("\r"));
    assert(strip(lf).includes("[x] the disk is full [E002-DISK]\n   on synthetic-host-01") || strip(lf).includes("   on synthetic-host-01"), strip(lf));
  }
});

proves(["0004-headless-cli FR-022"], "the help is the generated text byte for byte where plain, and dressed without changing a column where it has colour or emoji", () => {
  const p = sample();
  for (const path of [[], ["sync"], ["work"], ["work", "build"]]) {
    const text = helpFor(p, path) ?? "";
    assertEquals(styleHelp(text, lookAt("plain")), text);
    const ansi = styleHelp(text, lookAt("ansi"));
    assert(hasEscape(ansi) && !hasEmoji(ansi));
    assertEquals(strip(ansi), text, `colour changes no character: ${path.join(" ")}`);
    const full = styleHelp(text, lookAt("full"));
    // emoji only before the section words that have an icon; taken away, the text is what it was
    assertEquals(strip(full).replace(/^\S+ (Examples:|Effect:)/gm, "$1"), text);
    assert(!hasEmoji(text));
    const columnOf = (t: string): number[] => t.split("\n").map((l) => displayWidth(strip(l).replace(/^\S+ (Examples:|Effect:)/, "$1")));
    assertEquals(columnOf(full), columnOf(text));
  }
  assert(hasEmoji(styleHelp(helpFor(p, ["sync"]) ?? "", lookAt("full"))), "the effect has its icon");
});

proves(["0004-headless-cli FR-025"], "--json and --sarif are the same bytes at every level and with any capabilities, and so are the exit statuses", async () => {
  const caps = { plain: capabilitiesOf({}, { isTTY: false }), full: capabilitiesOf({ COLORTERM: "truecolor", LANG: "C.UTF-8" }, { isTTY: true, columns: 100, rows: 30 }) };
  for (const argv of [["status", "--json"], ["sync", "--warn", "--wait", "--json"], ["sync", "--fail", "--json"], ["status", "--sarif"], ["status"]]) {
    const results = [
      await run(sample(), argv, world({})),
      await run(sample(), argv, world({ caps: caps.plain, outCaps: caps.plain })),
      await run(sample(), argv, world({ terminal: true, env: { LANG: "C.UTF-8", COLORTERM: "truecolor" } })),
      await run(sample(), argv, world({ terminal: true, caps: caps.full, outCaps: caps.full })),
    ];
    const first = results[0];
    if (argv.includes("--json") || argv.includes("--sarif")) {
      for (const r of results) {
        assertEquals(r.out, first?.out, argv.join(" "));
        assertEquals(r.code, first?.code);
        assertEquals(r.err, "");
        assert(!hasEscape(r.out) && !hasEmoji(r.out));
      }
    } else {
      for (const r of results) assertEquals([r.out, r.code], [first?.out, first?.code], "a report's text is written as it is");
    }
  }
  const golden = `{\n  "schema": "headless.envelope/1",\n  "program": "tool",\n  "version": "1.2.3",\n  "command": "status",\n  "ok": true,\n  "exit": {\n    "code": 0,\n    "name": "ok"\n  },\n  "counts": {\n    "fail": 0,\n    "warn": 0,\n    "pending": 0,\n    "action": 0\n  },\n  "problems": [],\n  "outcomes": [],\n  "hints": [],\n  "next": [],\n  "data": {\n    "files": 3\n  }\n}\n`;
  const status = await run(sample(), ["status", "--json"], world({ terminal: true, caps: caps.full, outCaps: caps.full }));
  assertEquals(status.out, golden, "the envelope, byte for byte, as it was before the ui");
  const failed = JSON.parse((await run(sample(), ["sync", "--fail", "--json"], world({}))).out) as { code: number; problems: { code: string }[] };
  assertEquals(failed.problems[0]?.code, "E002-DISK");
  assertEquals((await run(sample(), ["sync", "--fail", "--json"], world({}))).code, 1);
});

/** The specifiers an import or an export of a file names. */
const specifiers = (text: string): readonly { readonly spec: string; readonly type: boolean }[] =>
  [...text.matchAll(/^(?:import|export)\s+(type\s+)?[^;]*?from\s+"([^"]+)";/gms)].map((m) => ({ spec: m[2] ?? "", type: m[1] !== undefined }));

proves(["0004-headless-cli FR-017", "0004-headless-cli FR-023"], "the renderer imports only the terminal, Core, its own files and the types of the layers below, and keeps no colour or emoji of its own", async () => {
  const files = ["style.ts", "render.ts", "reporter.ts", "view.ts"];
  const own = new Set(["./style.ts", "./render.ts", "./reporter.ts", "./view.ts", "./io.ts", "./state.ts"]);
  for (const f of files) {
    const text = await fs.readTextFile(path.join(ROOT, "src", "surfaces", "cli", f));
    for (const { spec, type } of specifiers(text)) {
      const allowed =
        own.has(spec) ||
        spec === "@intellectual-frontiers/core" ||
        spec === "@intellectual-frontiers/terminal/ui" ||
        spec === "@intellectual-frontiers/terminal/width" ||
        (type && (spec === "@intellectual-frontiers/headless/governance" || spec === "@intellectual-frontiers/headless/logical")) ||
        (!type && f === "reporter.ts" && spec === "@intellectual-frontiers/headless/logical");
      assert(allowed, `${f} imports ${spec}: the renderer names the terminal and Core alone, and the layers below only as types`);
    }
    const code = text.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    assert(!/\\u001b\[[0-9;]*m/.test(code) && !/\\x1b\[[0-9;]*m/.test(code), `${f} writes a colour of its own`);
    assert(!/\p{Extended_Pictographic}/u.test(code), `${f} writes an emoji of its own`);
  }
  const view = await fs.readTextFile(path.join(ROOT, "src", "surfaces", "cli", "view.ts"));
  assert(!view.includes("@intellectual-frontiers/headless"), "the drawing toolkit holds no domain: it names no layer of Headless");
  const lib = await fs.readTextFile(path.join(ROOT, "library.ts"));
  assert(lib.includes('subpaths: ["args", "commands", "ui", "width"]'), "the layers table allows the ui and the width, and not the palette");
  assert(!lib.includes('terminal", subpaths: "any"'));
});

proves(["0004-headless-cli FR-016"], "a look made from a bad width or no width is 80 columns, and a narrow terminal is taken as 80", () => {
  const look = (columns: number | undefined): Look => lookOfRun(sample(), world({ terminal: true, env: { LANG: "C.UTF-8" }, ...(columns === undefined ? {} : { columns }) }), true);
  assertEquals(look(undefined).columns, 80);
  assertEquals(look(30).columns, 80);
  assertEquals(look(120).columns, 120);
});
