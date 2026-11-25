/**
 * Tests of the run boundary `run(program, argv, io)`: the golden outputs of a run in each state (nothing to do, a warning, something pending, a failure, `--quiet`,
 * `--verbose`, a report, `--json`), the streams, the refusals and usage errors, the prompts, the signals, a nested run, and the log and hints a run keeps
 * (commons headless 0004-headless-cli FR-003, FR-004, FR-006, FR-007, FR-008, FR-009, FR-011, FR-012). The invariants: a failure once, ONE next line, a code on every problem line, and a verdict that never says "all well".
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { branch, command, outcomeOf, programOf, startPhase, summaryOf, encodeSummary, parseSummary } from "../src/logical/mod.ts";
import { problem } from "../src/governance/mod.ts";
import { isOk } from "@intellectual-frontiers/core";
import { run } from "../src/surfaces/cli/run.ts";
import { isYes, promptOf } from "../src/surfaces/cli/prompts.ts";
import { guarded } from "../src/surfaces/cli/signals.ts";
import { fakeSignals, memoryStore, sample, world } from "./world.ts";

const p = sample();
const go = (argv: readonly string[], o: Parameters<typeof world>[0] = {}) => run(p, argv, world(o));

/** What a run's default output must never hold (a failure once, one next line, a code on every problem line). */
function invariants(err: string, what: string): void {
  const lines = err.split("\n");
  assert(!lines.some((l) => /^\[ok\] \S+ {3,}/.test(l)), `${what}: a green step line\n${err}`);
  assert(!/all well|\bfinished\b/i.test(err), `${what}: a verdict that says all is well\n${err}`);
  assert(!/^next: .*\n(.|\n)*\nnext: /m.test(err), `${what}: more than one next line\n${err}`);
  // every problem line of the closing block (after its blank line) carries its code
  const block = lines.slice(lines.indexOf("") + 1);
  for (const l of block) if (/^(\[x\]|\[!\]|\[you\]|\[todo\]) /.test(l) && !/\[[EP]\d{3}-[A-Z-]+\]/.test(l)) assert(false, `${what}: no code on: ${l}`);
}

proves(["0004-headless-cli FR-003", "0004-headless-cli FR-004", "0004-headless-cli FR-011"], "golden: an action with nothing to say ends with the verdict alone, on the error stream, with status 0", async () => {
  const r = await go(["sync"]);
  assertEquals(r, { code: 0, out: "", err: "\n[ok] Up to date\n" });
  invariants(r.err, "sync");
  const dry = await go(["sync", "--dry-run"]);
  assertEquals(dry.code, 0);
  const check = await go(["wipe", "--dry-run"]);
  assertEquals(check, { code: 0, out: "", err: "   Would wipe the cache\n\n[ok] Up to date\n" });
});

proves(["0004-headless-cli FR-003", "0004-headless-cli FR-004"], "golden: a warning and something pending are shown with their codes and one command each, and the run still ends with 0", async () => {
  const r = await go(["sync", "--warn", "--wait"]);
  assertEquals(r.code, 0);
  assertEquals(
    r.err,
    [
      "[!] Files              2 files",
      "",
      "[!] b.txt is large [E001-LARGE]",
      "   It removes the old copies",
      "   fix: tool trim",
      "[todo] no token yet [P001-TOKEN]",
      "   run: tool token",
      "[ok] Up to date · 1 warning · 1 waiting",
      "",
    ].join("\n"),
  );
  invariants(r.err, "warn and wait");
  const asked = await go(["sync", "--wait", "--check"]);
  assertEquals(asked.code, 4, "pending is its own status where the run is a check");
});

proves(["0004-headless-cli FR-003", "0004-headless-cli FR-004"], "golden: a failure is the verdict once, with its code and its one command, and the status is 1; quiet is the verdict alone", async () => {
  const r = await go(["sync", "--fail", "--warn"]);
  assertEquals(r.code, 1);
  assertEquals(r.err.split("\n").filter((l) => l.includes("the disk is full")).length, 1);
  assertEquals(r.err.split("\n").filter((l) => l.startsWith("next:")), ["next: tool clean"]);
  assertStringIncludes(r.err, "[x] the disk is full [E002-DISK]");
  invariants(r.err, "fail");
  const q = await go(["sync", "--fail", "--quiet"]);
  assertEquals(q, { code: 1, out: "", err: "[x] the disk is full [E002-DISK]\n" });
  const ok = await go(["sync", "-q"]);
  assertEquals(ok, { code: 0, out: "", err: "[ok] Up to date\n" });
});

proves(["0004-headless-cli FR-003"], "golden: --verbose shows every step as it happens, the green phase line, and the log's path", async () => {
  const store = memoryStore();
  const r = await go(["sync", "--verbose"], { store, env: { HOME: "/home/a" } });
  const log = [...store.files.keys()][0] ?? "";
  assertEquals(log, "/home/a/.local/state/tool/log/20261120T100000-4242.log");
  assertEquals(r.err, ["   [ok] a.txt", "   [ok] b.txt", "[ok] Files              2 files", "", `   log: ${log}`, "[ok] Up to date", ""].join("\n"));
});

proves(["0004-headless-cli FR-004"], "a report's text goes to the output stream and its narration to the error stream; a report with nothing to say beyond its text writes no block", async () => {
  const r = await go(["status"]);
  assertEquals(r, { code: 0, out: "3 files, all fine\n", err: "" });
  const loud = await go(["work", "plan"]);
  assertEquals(loud.out, "nothing to build\n");
  assertEquals(loud.err, ["", "[you] send the change [E000-YOURS]", "   run: tool sync", "[ok] Up to date · 1 for you", "next: tool sync", ""].join("\n"));
  assertEquals((await go(["status", "--quiet"])).out, "3 files, all fine\n", "quiet governs the narration, never the report");
  invariants(loud.err, "plan");
  const sink: string[] = [];
  const streamed = await run(p, ["status"], { ...world(), sink: { out: (t) => void sink.push(`out:${t}`), err: (t) => void sink.push(`err:${t}`) } });
  assertEquals(sink, ["out:3 files, all fine\n"]);
  assertEquals(streamed.out, "3 files, all fine\n");
});

proves(["0004-headless-cli FR-004", "0004-headless-cli FR-011"], "--json is one document and nothing for a person; --sarif the same as SARIF; neither with colour", async () => {
  const j = await go(["status", "--json"], { terminal: true, env: { LANG: "C.UTF-8" } });
  assertEquals(j.err, "");
  const doc = JSON.parse(j.out) as { schema: string; command: string; ok: boolean; exit: { code: number }; data: { files: number } };
  assertEquals([doc.schema, doc.command, doc.ok, doc.exit.code, doc.data], ["headless.envelope/1", "status", true, 0, { files: 3 }]);
  assert(!j.out.includes("\u001b"));
  const failed = await go(["sync", "--fail", "--json"]);
  assertEquals(failed.code, 1);
  assertEquals(failed.err, "");
  const f = JSON.parse(failed.out) as { ok: boolean; problems: { code: string; level: string }[]; exit: { name: string } };
  assertEquals([f.ok, f.exit.name, f.problems.map((x) => `${x.level}:${x.code}`)], [false, "findings", ["fail:E002-DISK"]]);
  const s = await go(["status", "--sarif"]);
  assertEquals(JSON.parse(s.out).version, "2.1.0");
  assertEquals((await go(["status", "--json", "--sarif"])).code, 2);
  assertEquals((await go(["sync", "--json", "--quiet"])).out.startsWith("{"), true);
});

proves(["0004-headless-cli FR-012"], "a failure before a command runs is one sentence on the error stream and status 2, in every verbosity; a command that throws is one failure", async () => {
  for (const extra of [[], ["--json"], ["--quiet"], ["--verbose"]]) {
    const unknown = await go(["wrk", ...extra]);
    assertEquals([unknown.code, unknown.out, unknown.err], [2, "", "wrk is not a command of tool; did you mean work? Run tool --help to see what it takes.\n"]);
  }
  const option = await go(["sync", "--jsn"]);
  assertEquals([option.code, option.out], [2, ""]);
  assertStringIncludes(option.err, "did you mean --json?");
  assertEquals((await go(["status", "--limit", "x"])).code, 2);
  assertEquals((await go(["sync", "--quiet", "--verbose"])).err, "--quiet and --verbose ask for opposite things: give one of them\n");
  assertEquals((await go(["sync", "--dry-run", "--check"])).code, 2);
  const thrown = await go(["sync", "--throws"]);
  assertEquals(thrown.code, 1);
  assertStringIncludes(thrown.err, "[x] the disk exploded [E000-FAILED]");
  const json = JSON.parse((await go(["sync", "--throws", "--json"])).out) as { problems: { message: string; raw: string }[] };
  assertEquals(json.problems[0]?.message, "the disk exploded");
  assertStringIncludes(json.problems[0]?.raw ?? "", "the disk exploded");
  const str = programOf({ name: "t", summary: "T.", version: "1", children: [command({ name: "x", summary: "X.", options: {}, action: { kind: "report" }, run: () => Promise.reject("a string") })] });
  assertStringIncludes((await run(str, ["x"], world())).err, "a string");
});

proves(["0004-headless-cli FR-011"], "the surface answers --version, help, explain, completions and man itself, and runs the default command where no word is given", async () => {
  assertEquals(await go(["--version"]), { code: 0, out: "tool 1.2.3\n", err: "" });
  assertEquals((await go(["-V"])).out, "tool 1.2.3\n");
  const top = await go([]);
  assertEquals(top.code, 0);
  assertStringIncludes(top.out, "Commands:");
  assertStringIncludes(top.out, "Built in: help, explain, completions, man, run, --version");
  assertEquals((await go(["help"])).out, top.out);
  assertEquals((await go(["--help"])).out, top.out.replace(/\n$/, "") + "\n");
  const verbHelp = await go(["sync", "--help"]);
  assertEquals(verbHelp.code, 0);
  assertStringIncludes(verbHelp.out, "--dry-run");
  assertEquals((await go(["help", "sync"])).out, verbHelp.out);
  assertEquals((await go(["help", "work"])).code, 0);
  assertEquals((await go(["help", "nope"])).code, 2);
  assertEquals((await go(["explain"])).code, 0);
  assertEquals((await go(["explain", "E1-NONE"])).code, 2);
  assertEquals((await go(["completions", "bash"])).code, 0);
  assertEquals((await go(["completions"])).code, 2);
  assertEquals((await go(["completions", "tcsh"])).code, 2);
  assertStringIncludes((await go(["man"])).out, ".TH TOOL 1");
  const defaulted = await run(sample({ defaultCommand: ["status"] }), [], world());
  assertEquals(defaulted.out, "3 files, all fine\n");
  // help never runs a command
  const ran: string[] = [];
  const spy = programOf({ name: "t", summary: "T.", version: "1", children: [command({ name: "x", summary: "X.", options: {}, action: { kind: "report" }, run: () => (ran.push("x"), Promise.resolve(outcomeOf(null))) })] });
  await run(spy, ["x", "--help"], world());
  await run(spy, ["help", "x"], world());
  assertEquals(ran, []);
  await run(spy, ["x"], world());
  assertEquals(ran, ["x"]);
});

proves(["0004-headless-cli FR-011"], "a run touches no process global: the same world gives the same result, whatever the process's own environment is", async () => {
  const before = { ...process.env };
  process.env["TOOL_NESTED"] = "1";
  process.env["NO_COLOR"] = "1";
  try {
    const a = await go(["sync", "--warn"], { terminal: true, env: { LANG: "C.UTF-8" } });
    const b = await go(["sync", "--warn"], { terminal: true, env: { LANG: "C.UTF-8" } });
    assertEquals(a, b);
    assertStringIncludes(a.err, "\u001b[33");
    assertStringIncludes(a.err, "⚠️");
  } finally {
    for (const k of ["TOOL_NESTED", "NO_COLOR"]) if (before[k] === undefined) delete process.env[k];
  }
  fc.assert(
    fc.asyncProperty(fc.array(fc.constantFrom("sync", "--warn", "--wait", "--fail", "--quiet", "--verbose", "--json", "-q", "--dry-run", "status", "wipe", "--yes"), { maxLength: 4 }), async (argv) => {
      const r = await go(argv);
      assert([0, 1, 2, 4].includes(r.code), `${argv.join(" ")} gave ${r.code}`);
      assertEquals(r.err.includes("\u001b"), false, "a pipe has no control character");
    }),
  );
});

proves(["0004-headless-cli FR-006", "0004-headless-cli FR-011"], "a destructive action asks the person where there is one, runs with --yes, and is refused with no terminal and no --yes", async () => {
  const refused = await go(["wipe"]);
  assertEquals([refused.code, refused.out], [2, ""]);
  assertStringIncludes(refused.err, "wipe destroys something");
  assertEquals((await go(["wipe", "--yes"])).err, "   Wiped the cache\n\n[ok] Up to date\n");
  assertEquals((await go(["wipe", "-y"])).code, 0);
  const yes = await go(["wipe"], { terminal: true, lines: ["y"] });
  assertEquals(yes.code, 0);
  assertStringIncludes(yes.err, "wipe destroys something and it cannot be undone. Go on? [y/N] ");
  assertStringIncludes(yes.err, "Wiped the cache");
  const no = await go(["wipe"], { terminal: true, lines: ["no"] });
  assertEquals([no.code], [2]);
  assertStringIncludes(no.err, "Not confirmed: nothing was changed.");
  assertEquals((await go(["wipe"], { terminal: true, lines: [] })).code, 2, "an end of input is no");
  const never = await go(["wipe", "--non-interactive"], { terminal: true, lines: ["y"] });
  assertEquals(never.code, 2, "--non-interactive never asks");
  assertEquals((await go(["wipe", "--dry-run"], { terminal: true })).err.includes("[y/N]"), false);
});

proves(["0004-headless-cli FR-006"], "ask and confirm ask no one without a terminal, take one line with one, and only a plain yes is yes", async () => {
  const asked: string[] = [];
  const prompt = (interactive: boolean, lines: (string | undefined)[]) => promptOf({ interactive, readLine: () => Promise.resolve(lines.shift()), write: (t) => void asked.push(t) });
  assertEquals(await prompt(false, ["y"]).confirm("Go?"), undefined);
  assertEquals(await prompt(false, ["x"]).ask("Name?"), undefined);
  assertEquals(asked, []);
  assertEquals(await prompt(true, ["alice"]).ask("Name?"), "alice");
  assertEquals(asked, ["Name? "]);
  for (const [line, want] of [["y", true], ["YES", true], [" yes ", true], ["", false], ["n", false], ["yep", false], ["no", false]] as const) assertEquals(await prompt(true, [line]).confirm("Go?"), want, JSON.stringify(line));
  assertEquals(await prompt(true, [undefined]).confirm("Go?"), undefined);
  assert(isYes("y") && !isYes("yy"));
});

proves(["0004-headless-cli FR-009"], "SIGINT ends the run with 130 and SIGTERM with 143, aborts the signal of the command, ends with Stopped, and leaves no listener", async () => {
  for (const [sig, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) {
    const signals = fakeSignals();
    let aborted: unknown;
    let resumed = false;
    const slow = programOf({
      name: "t",
      summary: "T.",
      version: "1",
      children: [
        command({
          name: "go",
          summary: "Go.",
          options: {},
          action: { kind: "action" },
          run: (_a, ctx) => {
            const ph = startPhase(ctx.progress, "Working");
            ph.ok("one");
            return new Promise((resolve) => {
              ctx.signal.addEventListener("abort", () => (aborted = ctx.signal.reason));
              setTimeout(() => ((resumed = true), resolve(outcomeOf(null))), 40);
              queueMicrotask(() => signals.send(sig));
            });
          },
        }),
      ],
    });
    const r = await run(slow, ["go"], world({ signals }));
    assertEquals(r.code, code);
    assertEquals(r.err, "\n[stop] Stopped\n");
    assert(aborted instanceof Error && aborted.message === `stopped by ${sig}`);
    assertEquals(signals.listening(), 0);
    assertEquals(resumed, false, "the run did not wait for the command");
  }
  const done = await guarded(fakeSignals(), new AbortController(), Promise.resolve(5));
  assertEquals(done, { kind: "done", value: 5 });
  const signals = fakeSignals();
  await go(["sync"], { signals });
  assertEquals(signals.listening(), 0, "the listeners are removed where the run ends first");
  assertEquals(await guarded(undefined, new AbortController(), Promise.resolve(1)), { kind: "done", value: 1 });
});

proves(["0004-headless-cli FR-007", "0004-headless-cli FR-014"], "a run writes its log in the folder of state, with every item and problem whatever the verbosity, and a problem carries the number of its line", async () => {
  const store = memoryStore();
  const r = await go(["sync", "--warn", "--quiet"], { store, env: { XDG_STATE_HOME: "/xdg" } });
  assertEquals(r.code, 0);
  const files = [...store.files.keys()];
  assertEquals(files, ["/xdg/tool/log/20261120T100000-4242.log"]);
  const text = store.files.get(files[0] ?? "")?.text ?? "";
  const lines = text.split("\n").filter((l) => l !== "");
  assert(lines.every((l) => /^2026-11-20T10:00:00\.000Z \w+/.test(l)), text);
  assertStringIncludes(text, "item     ok a.txt");
  assertStringIncludes(text, "problem  warn E001-LARGE b.txt is large");
  assertStringIncludes(text, "run      finished with 0: 0 failure(s), 1 warning(s), 0 pending, 0 for you");
  // the log line of a problem is the line it was written on
  const json = JSON.parse((await go(["sync", "--warn", "--json"], { store: memoryStore(), env: { HOME: "/h" } })).out) as { problems: { logLine: number }[] };
  assertEquals(json.problems[0]?.logLine, 5);
  // no home, no variable: no folder, no log, and the run still runs
  const bare = memoryStore();
  assertEquals((await go(["sync"], { store: bare })).code, 0);
  assertEquals(bare.files.size, 0);
  assertEquals((await go(["sync"], { store: false })).code, 0);
  // the program's own TOOL_LOG names a file to write to (a nested run writes to its parent's log)
  const shared = memoryStore();
  await go(["sync"], { store: shared, env: { HOME: "/h", TOOL_LOG: "/parent.log" } });
  assertEquals([...shared.files.keys()], ["/parent.log"]);
  // the folder is the system's: Windows' known folders
  const win = memoryStore();
  await go(["sync"], { store: win, os: "windows", env: { LOCALAPPDATA: "C:\\Users\\a\\AppData\\Local" } });
  assertEquals([...win.files.keys()], ["C:\\Users\\a\\AppData\\Local\\tool\\state\\log\\20261120T100000-4242.log"]);
  // and a log older than 30 days is pruned before the run's own is opened
  const old = memoryStore();
  const day = 86_400_000;
  const now = Date.UTC(2026, 10, 20, 10, 0, 0);
  old.files.set("/h/.local/state/tool/log/a.log", { text: "x", mtimeMs: now - 31 * day });
  old.files.set("/h/.local/state/tool/log/b.log", { text: "x", mtimeMs: now - 29 * day });
  old.files.set("/h/.local/state/tool/log/c.txt", { text: "x", mtimeMs: now - 99 * day });
  await go(["sync"], { store: old, env: { HOME: "/h" } });
  assertEquals([...old.files.keys()].sort(), ["/h/.local/state/tool/log/20261120T100000-4242.log", "/h/.local/state/tool/log/b.log", "/h/.local/state/tool/log/c.txt"]);
});

const hinting = programOf({
  name: "tool",
  summary: "T.",
  version: "1",
  children: [command({ name: "go", summary: "Go.", options: {}, action: { kind: "action" }, run: (_a, ctx) => (startPhase(ctx.progress, "x").hint("remote", "Remote access is off", "tool remote on"), Promise.resolve(outcomeOf(null))) })],
});

proves(["0004-headless-cli FR-008"], "a hint is shown once in seven days from the memory in the folder of state, always with --verbose, never with --quiet, and every time where there is no state", async () => {
  const store = memoryStore();
  const at = (ms: number) => ({ store, env: { HOME: "/h" }, now: () => ms });
  const t0 = Date.UTC(2026, 10, 20, 10);
  const first = await run(hinting, ["go"], world(at(t0)));
  assertEquals(first.err, "\n-> Remote access is off\n   run: tool remote on\n[ok] Up to date · 1 optional\n");
  assertEquals(JSON.parse(store.files.get("/h/.local/state/tool/hints.json")?.text ?? "null"), { remote: t0 });
  const again = await run(hinting, ["go"], world(at(t0 + 6 * 86_400_000)));
  assertEquals(again.err, "\n[ok] Up to date\n");
  const week = await run(hinting, ["go"], world(at(t0 + 7 * 86_400_000)));
  assertStringIncludes(week.err, "-> Remote access is off");
  const verbose = await run(hinting, ["go", "--verbose"], world(at(t0 + 7 * 86_400_000 + 1)));
  assertStringIncludes(verbose.err, "-> Remote access is off");
  const hushed = await run(hinting, ["go", "--quiet"], world(at(t0 + 99 * 86_400_000)));
  assertEquals(hushed.err, "[ok] Up to date\n");
  assertEquals(JSON.parse(store.files.get("/h/.local/state/tool/hints.json")?.text ?? "{}").remote, t0 + 7 * 86_400_000);
  for (let i = 0; i < 2; i++) assertStringIncludes((await run(hinting, ["go"], world({ store: memoryStore() }))).err, "-> Remote access is off");
  store.files.set("/h/.local/state/tool/hints.json", { text: "not json", mtimeMs: 0 });
  assertStringIncludes((await run(hinting, ["go"], world(at(t0)))).err, "-> Remote access is off");
});

proves(["0004-headless-cli FR-011", "0004-headless-cli FR-012"], "a nested run writes its summary to its parent's file and draws nothing; the parent reads it back", async () => {
  const store = memoryStore();
  const r = await go(["sync", "--warn", "--fail"], { store, env: { TOOL_NESTED: "1", TOOL_SUMMARY: "/tmp/summary.json", HOME: "/h", TOOL_LOG: "/parent.log" } });
  assertEquals([r.code, r.err], [1, ""]);
  const read = parseSummary(store.files.get("/tmp/summary.json")?.text ?? "");
  assert(isOk(read));
  if (isOk(read)) {
    assertEquals([read.value.fails, read.value.warns], [1, 1]);
    assertEquals(read.value.problems.map((x) => x.code), ["E001-LARGE", "E002-DISK"]);
  }
  assert(summaryOf(outcomeOf(null, { problems: [problem("warn", "x")] })).warns === 1 && encodeSummary(summaryOf(outcomeOf(null))).startsWith("{"));
  const report = await go(["status"], { env: { TOOL_NESTED: "1" } });
  assertEquals(report.out, "3 files, all fine\n", "a nested report still gives its text");
});

proves(["0004-headless-cli FR-004", "0004-headless-cli FR-011"], "a secret the program holds never reaches the output, the error, the log or the JSON, however a command tells it", async () => {
  const leaky = programOf({
    name: "t",
    summary: "T.",
    version: "1",
    secrets: () => ["tok-123456"],
    children: [
      command({
        name: "go",
        summary: "Go.",
        options: {},
        action: { kind: "action" },
        run: (_a, ctx) => {
          const ph = startPhase(ctx.progress, "Login tok-123456");
          ph.ok("used tok-123456");
          ph.warn("token tok-123456 is old", { fix: "t login --token tok-123456" });
          ph.outcome("sent with tok-123456");
          return Promise.resolve(outcomeOf({ url: "http://u:tok-123456@h/" }, { text: "text tok-123456", problems: [problem("fail", "boom", { raw: "token=tok-123456" })] }));
        },
      }),
      branch({ name: "b", summary: "B.", children: [] }),
    ],
  });
  for (const extra of [[], ["--verbose"], ["--json"], ["--quiet"]]) {
    const store = memoryStore();
    const r = await run(leaky, ["go", ...extra], world({ store, env: { HOME: "/h" } }));
    const all = r.out + r.err + [...store.files.values()].map((f) => f.text).join("");
    assertEquals(all.includes("tok-123456"), false, extra.join(" "));
    assertEquals(all.includes("***"), true);
  }
});
