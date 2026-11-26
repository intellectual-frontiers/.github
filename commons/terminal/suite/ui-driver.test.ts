/**
 * Tests of `src/ui-driver.ts`: the loop with scripted input and output, a question with a validation retry, a run, a human gate that only
 * the person releases, the refusal where the input is not a person's, waits polled on a fake clock, an abort at every await, the refusal of a
 * secret field, input that ends lines with CRLF (commons 0002-ui FR-004 to FR-007).
 *
 * @module
 */
import { win32 } from "node:path";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { exitCodeOf, type FlowCall, type UiError, type FlowFinished, type UiIn, lineReader, runFlow } from "../src/ui.ts";
import { createScreen } from "../src/vt.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { bare, capsOf, fakeClock, machine, recorder, scriptedIn, silentIn } from "./ui-helpers.ts";

const base = { say: "" };
const ask = { field: "folder", prompt: "Which folder?", hint: "a path" };
const question = { ...base, id: "synthetic-step-01", kind: "question", summary: "Choose a folder", ask: [ask] };
const run = { ...base, id: "synthetic-step-02", kind: "run", summary: "Install", verb: { id: "synthetic-install", inputs: { root: "./works" } } };
const human = { ...base, id: "synthetic-step-03", kind: "human", summary: "Approve the key", say: "Approve it yourself.", gate: { who: "person" } };
const wait = { ...base, id: "synthetic-step-04", kind: "wait", summary: "Waiting for the host" };
const end = { ...base, id: "synthetic-step-05", kind: "done", summary: "All set" };

/** Text with wrapped lines joined, to look for a sentence. */
const flat = (t: string): string => t.replace(/\n\s+/g, " ");

function expectErr(r: Result<FlowFinished, UiError>, code: UiError["code"]): UiError {
  assert(r.kind === "err", `expected ${code}, got ok`);
  assertEquals(r.error.code, code);
  return r.error;
}

/** Runs a guide with the calls recorded. */
async function drive(steps: readonly unknown[], extra: Partial<Parameters<typeof runFlow>[0]> = {}) {
  const m = machine(steps);
  const calls: FlowCall[] = [];
  const out = recorder(60, 24);
  const result = await runFlow({
    next: m.next,
    run: (c) => {
      calls.push(c);
      return Promise.resolve(ok({ summary: `did ${c.step.id}` }));
    },
    out,
    in: scriptedIn([], true),
    caps: capsOf("plain", 60),
    clock: fakeClock(),
    ...extra,
  });
  return { result, calls, out, taken: m.taken };
}

proves(["0002-ui FR-004"], "a question is asked field by field, a refused answer is asked again with the reason, the answers go to run", async () => {
  const { result, calls, out } = await drive([question, run, end], {
    in: scriptedIn(["bad\r\n", "./works\r\n"]),
    ask: (_f, answer) => (answer.startsWith("./") ? ok(answer) : err("it must start with ./")),
  });
  assert(result.kind === "ok");
  assertEquals(result.value.steps, 3);
  assertEquals(
    calls.map((c) => [c.step.id, c.answers]),
    [
      ["synthetic-step-01", { folder: "./works" }],
      ["synthetic-step-02", {}],
    ],
  );
  const text = out.text();
  assertStringIncludes(text, "[ask] Choose a folder");
  assertStringIncludes(text, "Which folder? (a path)");
  assertStringIncludes(text, "[failed] it must start with ./. Try again.");
  assertEquals(text.match(/Which folder\?/g)?.length, 3, "once in the step, twice as a prompt");
  assertStringIncludes(text, "will run: synthetic-install");
  assertStringIncludes(text, "[ok] did synthetic-step-02");
  assertStringIncludes(text, "[done] All set");
  assert(!text.includes("\u001b"), "plain holds no escape sequence");
  assertEquals(exitCodeOf(result), 0);
});

proves(["0002-ui FR-004"], "a field is given up after the attempts, with the typed error and the last reason", async () => {
  const { result, calls } = await drive([question, end], {
    in: scriptedIn(["a\n", "b\n", "c\n"]),
    ask: () => err("no good"),
    attempts: 3,
  });
  const e = expectErr(result, "E-UI-ANSWER-INVALID");
  assert(e.code === "E-UI-ANSWER-INVALID");
  assertEquals([e.field, e.reason], ["folder", "no good"]);
  assertEquals(calls.length, 0);
  assertEquals(exitCodeOf(result), 1);
});

proves(["0002-ui FR-004"], "an empty answer is refused by default", async () => {
  const { result, calls } = await drive([question, end], { in: scriptedIn(["\n", "  ./x  \n"]) });
  assert(result.kind === "ok");
  assertEquals(calls[0]?.answers, { folder: "./x" });
});

proves(["0002-ui FR-004"], "a verb that fails ends the guide with its reason; a verb not confirmed is not run", async () => {
  const failed = await drive([run, end], { run: () => Promise.resolve(err("the registry said no")) });
  const e = expectErr(failed.result, "E-UI-RUN-FAILED");
  assert(e.code === "E-UI-RUN-FAILED");
  assertEquals(e.reason, "the registry said no");
  assertStringIncludes(failed.out.text(), "[failed] Install: the registry said no");

  let ran = 0;
  const declined = await drive([run, end], {
    confirm: () => Promise.resolve(false),
    run: () => {
      ran++;
      return Promise.resolve(ok({ summary: "" }));
    },
  });
  expectErr(declined.result, "E-UI-DECLINED");
  assertEquals(ran, 0);
});

proves(["0002-ui FR-004"], "a step that is not a step ends the guide with the path of the fault", async () => {
  const { result, calls } = await drive([{ ...end, colour: "red" }]);
  const e = expectErr(result, "E-UI-STEP-INVALID");
  assert(e.code === "E-UI-STEP-INVALID");
  assertEquals(e.error.path, "$.colour");
  assertEquals(calls.length, 0);
  assertEquals(exitCodeOf(result), 2);
});

proves(["0002-ui FR-004"], "a wait polls next again with backoff and in plain says so every so often", async () => {
  const clock = fakeClock();
  const { result, out, taken } = await drive([wait, wait, wait, wait, end], {
    clock,
    poll: { initialMs: 1000, factor: 2, maxMs: 3000, plainEveryMs: 2500 },
  });
  assert(result.kind === "ok");
  assertEquals(clock.sleeps, [1000, 2000, 3000, 3000]);
  assertEquals(taken(), 5);
  const lines = out.text().split("\n");
  assertEquals(lines.filter((l) => l.startsWith("[wait] still waiting")).length, 3);
  assertStringIncludes(out.text(), "[wait] still waiting: Waiting for the host (3s)");
  assertStringIncludes(out.text(), "[done] All set");
});

proves(["0002-ui FR-004"], "a wait shows a spinner at ansi, and gives up after the time limit", async () => {
  const clock = fakeClock();
  const ansi = await drive([wait, end], { clock, caps: capsOf("ansi", 60), poll: { initialMs: 300, spinnerMs: 100 } });
  assert(ansi.result.kind === "ok");
  assertEquals(clock.sleeps, [100, 100, 100]);
  const text = ansi.out.text();
  assertStringIncludes(text, "\r\u001b[K");
  assertStringIncludes(bare(text), "| Waiting for the host (0s)");
  assertStringIncludes(bare(text), "/ Waiting for the host");

  const c2 = fakeClock();
  const late = await drive([wait], { clock: c2, poll: { initialMs: 1000, maxWaitMs: 2500 } });
  const e = expectErr(late.result, "E-UI-WAIT-TIMEOUT");
  assertEquals(e.code, "E-UI-WAIT-TIMEOUT");
  assertEquals(c2.sleeps, [1000, 1500], "the limit is reached at 2500 ms");
  assertEquals(exitCodeOf(late.result), 1);
});

proves(["0002-ui FR-005"], "a human gate is released by Enter, by the person only, and the caller is told", async () => {
  const { result, calls, out } = await drive([human, end], { in: scriptedIn(["\r\n"]) });
  assert(result.kind === "ok");
  assertEquals(calls.map((c) => [c.step.id, c.answers]), [["synthetic-step-03", {}]]);
  const text = out.text();
  assertStringIncludes(text, "[you] Approve the key");
  assertStringIncludes(text, "Approve it yourself.");
  assertStringIncludes(flat(text), "the guide will not do it and will not confirm it for you");
  assertStringIncludes(text, "Press Enter when you have done it");
});

proves(["0002-ui FR-005"], "a human gate that asks for a value takes it, validated, and passes it on", async () => {
  const typed = { ...human, ask: [{ field: "code", prompt: "The code on the page", hint: "6 digits" }] };
  const { result, calls } = await drive([typed, end], {
    in: scriptedIn(["12\r\n", "123456\r\n"]),
    ask: (_f, a) => (/^\d{6}$/.test(a) ? ok(a) : err("six digits")),
  });
  assert(result.kind === "ok");
  assertEquals(calls[0]?.answers, { code: "123456" });
});

proves(["0002-ui FR-005"], "a human gate where the input is not a TTY ends with E-UI-NEEDS-PERSON and the step, and reads nothing", async () => {
  let reads = 0;
  const pipe: UiIn = {
    isTTY: false,
    readLine: () => {
      reads++;
      return Promise.resolve({ kind: "line", text: "" });
    },
  };
  const { result, calls, out } = await drive([human, end], { in: pipe });
  const e = expectErr(result, "E-UI-NEEDS-PERSON");
  assert(e.code === "E-UI-NEEDS-PERSON");
  assertEquals([e.step.id, e.reason], ["synthetic-step-03", "input-not-interactive"]);
  assertEquals([reads, calls.length], [0, 0], "never confirmed, never run");
  assertStringIncludes(out.text(), "[failed] This step is for a person");
  assertEquals(exitCodeOf(result), 2);
});

proves(["0002-ui FR-005"], "a question whose input ends before it is answered ends with E-UI-NEEDS-PERSON, never a hang", async () => {
  const two = { ...question, ask: [ask, { field: "name", prompt: "Which name?", hint: "" }] };
  const { result, calls } = await drive([two, end], { in: scriptedIn(["./works\n"], false) });
  const e = expectErr(result, "E-UI-NEEDS-PERSON");
  assert(e.code === "E-UI-NEEDS-PERSON");
  assertEquals([e.reason, e.step.id], ["input-ended", "synthetic-step-01"]);
  assertEquals(calls.length, 0);
  // Piped answers are fine for a question: the lines are the answers.
  const piped = await drive([two, end], { in: scriptedIn(["./works\nsynthetic-name\n"], false) });
  assert(piped.result.kind === "ok");
  assertEquals(piped.calls[0]?.answers, { folder: "./works", name: "synthetic-name" });
  assertStringIncludes(piped.out.text(), "> ./works\n", "a pipe does not echo, so the driver does");
});

proves(["0002-ui FR-005"], "input lines end with LF, CRLF or CR, even where the end is split between two chunks", async () => {
  const lines = ["a", "b", "c", "d"];
  const chunked: readonly (readonly string[])[] = [["a\nb\r\nc\rd\n"], ["a\n", "b\r", "\nc\r", "d\r\n"], ["a\r", "\nb\r\nc", "\r", "d"]];
  for (const chunks of chunked) {
    const input = scriptedIn(chunks);
    const read: string[] = [];
    for (;;) {
      const r = await input.readLine();
      if (r.kind !== "line") break;
      read.push(r.text);
    }
    assertEquals(read, lines, JSON.stringify(chunks));
  }
});

proves(["0002-ui FR-005"], "bytes are decoded as UTF-8 even where a character is split between two chunks", async () => {
  const bytes = new TextEncoder().encode("测试\r\n");
  async function* gen(): AsyncGenerator<Uint8Array> {
    yield bytes.slice(0, 2);
    yield bytes.slice(2, 4);
    yield bytes.slice(4);
  }
  const r = await lineReader(gen(), true).readLine();
  assertEquals(r, { kind: "line", text: "测试" });
});

proves(["0002-ui FR-005"], "a Windows path typed with CRLF lines is taken whole, and validated with node:path/win32", async () => {
  const typed = "C:\\Users\\synthetic-user-01\\works";
  const { result, calls } = await drive([question, end], {
    in: scriptedIn(["works\r\n", `${typed}\r`, "\n"]),
    ask: (_f, a) => (win32.isAbsolute(a) ? ok(win32.normalize(a)) : err("an absolute path, with its drive")),
  });
  assert(result.kind === "ok");
  assertEquals(calls[0]?.answers, { folder: typed });
  assertEquals(win32.basename(calls[0]?.answers["folder"] ?? ""), "works");
});

proves(["0002-ui FR-006"], "a field marked secret is refused before anything is asked or read", async () => {
  let reads = 0;
  const spy: UiIn = {
    isTTY: true,
    readLine: () => {
      reads++;
      return Promise.resolve({ kind: "line", text: "synthetic-value" });
    },
  };
  for (const step of [
    { ...question, ask: [ask, { field: "token", prompt: "Your token", hint: "", secret: true }] },
    { ...human, ask: [{ field: "password", prompt: "Your password", hint: "", secret: true }] },
  ]) {
    const { result, calls, out } = await drive([step, end], { in: spy });
    const e = expectErr(result, "E-UI-SECRET-FIELD");
    assert(e.code === "E-UI-SECRET-FIELD");
    assertEquals(e.step.id, step.id);
    assert(e.field === "token" || e.field === "password");
    assertEquals([reads, calls.length], [0, 0]);
    assert(!out.text().includes("Which folder?"), "the other field was not asked either");
    assertStringIncludes(flat(out.text()), "never asks for a token or a password");
    assertEquals(exitCodeOf(result), 2);
  }
});

proves(["0002-ui FR-007"], "an abort while waiting stops within the step, with status 130", async () => {
  const c = new AbortController();
  const m = machine([wait, wait, end]);
  let polls = 0;
  const { result } = await drive([], {
    signal: c.signal,
    next: () => {
      if (++polls === 2) c.abort();
      return m.next();
    },
  });
  const e = expectErr(result, "E-UI-ABORTED");
  assert(e.code === "E-UI-ABORTED");
  assertEquals(e.exitCode, 130);
  assertEquals(exitCodeOf(result), 130);
  assertEquals(polls, 2);
});

proves(["0002-ui FR-007"], "an abort while the person has not typed yet ends at once, even though no line comes", async () => {
  const c = new AbortController();
  const pending = drive([question, end], { in: silentIn(), signal: c.signal });
  await new Promise((r) => setTimeout(r, 10));
  c.abort();
  const { result } = await pending;
  expectErr(result, "E-UI-ABORTED");
});

proves(["0002-ui FR-007"], "Ctrl+C that arrives as a character is an abort, and an already aborted signal runs nothing", async () => {
  const { result, calls } = await drive([question, end], { in: scriptedIn(["\u0003\n"]) });
  expectErr(result, "E-UI-ABORTED");
  assertEquals(calls.length, 0);
  const c = new AbortController();
  c.abort();
  const pre = await drive([question, end], { signal: c.signal });
  expectErr(pre.result, "E-UI-ABORTED");
  assertEquals(pre.calls.length, 0);
});

proves(["0002-ui FR-007"], "in full the terminal is restored on an abort: alternate screen left, cursor shown, and the person keeps a transcript", async () => {
  const c = new AbortController();
  const out = recorder(80, 24);
  const m = machine([run, wait, wait, end]);
  let polls = 0;
  const { result } = await drive([], {
    out,
    caps: capsOf("full", 80, 24),
    signal: c.signal,
    plan: [
      { id: run.id, title: "Install" },
      { id: wait.id, title: "Wait" },
    ],
    next: () => {
      if (++polls === 3) c.abort();
      return m.next();
    },
  });
  expectErr(result, "E-UI-ABORTED");
  const all = out.text();
  assert(all.lastIndexOf("\u001b[?1049h") < all.lastIndexOf("\u001b[?1049l"), "left after it was entered");
  const screen = createScreen({ width: 80, height: 24 });
  screen.write(all);
  assertEquals(screen.cursor().visible, true);
  assertStringIncludes(screen.text(), "Stopped.");
  assertStringIncludes(screen.text(), "will run: synthetic-install");
});

proves(["0002-ui FR-007"], "the terminal is restored too where the caller's function throws", async () => {
  const out = recorder(80, 24);
  let thrown: unknown;
  try {
    await runFlow({
      next: () => Promise.reject(new Error("synthetic failure")),
      run: () => Promise.resolve(ok({ summary: "" })),
      out,
      in: scriptedIn([]),
      caps: capsOf("full", 80, 24),
      clock: fakeClock(),
    });
  } catch (e) {
    thrown = e;
  }
  assert(thrown instanceof Error);
  assertEquals(out.text(), "\u001b[0m\u001b[?25h", "nothing was drawn, and the cursor and the styles are as they were found");
});

proves(["0002-ui FR-004"], "the driver never answers for the person: a human step is never run before a line is read", async () => {
  const order: string[] = [];
  const input: UiIn = {
    isTTY: true,
    readLine: () => {
      order.push("read");
      return Promise.resolve({ kind: "line", text: "" });
    },
  };
  await drive([human, end], {
    in: input,
    run: (c) => {
      order.push(`run ${c.step.kind}`);
      return Promise.resolve(ok({ summary: "" }));
    },
  });
  assertEquals(order, ["read", "run human"]);
});
