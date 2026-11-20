/**
 * Tests of the credential prompt (commons headless 0011-credential-prompt FR-001 to FR-009): the secret that is never written, the session that asks once for each credential and ends with
 * the command, the refusals as values, the hard time limit, the redaction of a run, the terminal adapter and its pure reader, and the helper that `ssh` runs.
 *
 * @module
 */
import { inspect } from "node:util";
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { problem } from "../src/governance/mod.ts";
import {
  CREDENTIAL_REFUSALS,
  credentialSession,
  DEFAULT_TIMEOUT_MS,
  command,
  limitOf,
  MAX_TIMEOUT_MS,
  NO_CREDENTIALS,
  outcomeOf,
  parseCredentialId,
  programOf,
  refusalCode,
  refusalMessage,
  secretOf,
  type Clock,
  type CredentialEvent,
  type CredentialPort,
  type CredentialRefusal,
  type CredentialRequest,
  type Secret,
} from "../src/logical/mod.ts";
import { askpassEnv, drawPrompt, idTextOf, kindOfPrompt, launcherOf, readerStep, requestOf, runAskpass, START, terminalCredentials, ttyDevicesOf, type TtyHandle, type TtyPort } from "../src/surfaces/askpass/mod.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { memoryStore, world } from "./world.ts";

const PASS = "correct horse battery";
const idOf = (t: string) => {
  const r = parseCredentialId(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const request = (id = "ssh-key:/k", kind: CredentialRequest["kind"] = "passphrase"): CredentialRequest => ({ kind, id: idOf(id), prompt: `Passphrase for ${id}:` });

/** A port that counts its asks and answers from a function. */
function port(answer: (r: CredentialRequest) => Result<Secret, CredentialRefusal> | Promise<Result<Secret, CredentialRefusal>> = () => ok(secretOf(PASS))): CredentialPort & { readonly calls: string[]; readonly signals: AbortSignal[] } {
  const calls: string[] = [];
  const signals: AbortSignal[] = [];
  return {
    calls,
    signals,
    ask: async (r, limits) => {
      calls.push(r.id);
      signals.push(limits.signal);
      return await answer(r);
    },
  };
}

/** A clock a test runs by hand. */
function clock(): Clock & { readonly fire: () => void; readonly pending: () => number; readonly last: () => number } {
  const timers = new Set<() => void>();
  let lastMs = 0;
  return {
    after: (ms, fn) => {
      lastMs = ms;
      timers.add(fn);
      return () => void timers.delete(fn);
    },
    fire: () => [...timers].forEach((f) => f()),
    pending: () => timers.size,
    last: () => lastMs,
  };
}

proves(["0011-credential-prompt FR-001"], "a secret is never written: its text, JSON and inspected forms are redacted and only reveal() gives it, and an id is parsed", () => {
  const s = secretOf(PASS);
  assertEquals([String(s), JSON.stringify({ s }), `${s}`, inspect(s), s.reveal()], ["[redacted]", '{"s":"[redacted]"}', "[redacted]", "[redacted]", PASS]);
  assert(!inspect({ nested: { s } }, { depth: 5 }).includes(PASS));
  assert(Object.values(s).every((v) => typeof v === "function"), "the value is on no property");
  fc.assert(fc.property(fc.stringMatching(/^[a-z0-9]{8,20}$/), (v) => !JSON.stringify([secretOf(v)]).includes(v) && !inspect(secretOf(v)).includes(v)));
  for (const bad of ["", "a\nb", "x".repeat(201)]) assertEquals(parseCredentialId(bad).kind, "err", JSON.stringify(bad));
  assertEquals(parseCredentialId("ssh-key:/home/u/.ssh/id_ed25519").kind, "ok");
});

proves(["0011-credential-prompt FR-002"], "a credential is asked once for each command, shared by asks at the same time, in turn for different ids, and dropped at close", async () => {
  const p = port();
  const events: CredentialEvent[] = [];
  const s = credentialSession({ port: p, interactive: true, clock: clock(), onEvent: (e) => events.push(e) });
  const [a, b] = await Promise.all([s.get(request("one")), s.get(request("one"))]);
  assertEquals([a.kind, b.kind, p.calls], ["ok", "ok", ["one"]]);
  await s.get(request("one"));
  assertEquals(p.calls, ["one"], "a second ask is answered from memory");
  await s.get(request("two"));
  assertEquals(p.calls, ["one", "two"]);
  assertEquals(s.values(), [PASS, PASS]);
  // different ids go one at a time
  let live = 0;
  let most = 0;
  const slow = port(async () => {
    live += 1;
    most = Math.max(most, live);
    await Promise.resolve();
    live -= 1;
    return ok(secretOf(PASS));
  });
  const t = credentialSession({ port: slow, interactive: true, clock: clock() });
  await Promise.all([t.get(request("a")), t.get(request("b")), t.get(request("c"))]);
  assertEquals(most, 1);
  // a refusal is held too: a person who cancelled is not asked again
  const no = port(() => err({ kind: "cancelled" }));
  const u = credentialSession({ port: no, interactive: true, clock: clock() });
  await u.get(request("x"));
  const again = await u.get(request("x"));
  assertEquals([again.kind === "err" ? again.error.kind : "ok", no.calls], ["cancelled", ["x"]]);
  s.close();
  assertEquals(s.values(), []);
  const late = await s.get(request("three"));
  assertEquals([late.kind === "err" ? late.error.kind : "ok", p.calls], ["closed", ["one", "two"]]);
  assertEquals(events.filter((e) => e.kind === "asked").length, 2);
  assert(events.every((e) => !JSON.stringify(e).includes(PASS)));
});

proves(["0011-credential-prompt FR-003"], "where no person can be asked the refusal is a typed value and the port is not called, and every refusal has a sentence and a code with no value in it", async () => {
  const p = port();
  const off = await credentialSession({ port: p, interactive: false, clock: clock() }).get(request());
  assertEquals([off.kind === "err" ? off.error.kind : "ok", p.calls], ["non-interactive", []]);
  const none = await credentialSession({ interactive: true, clock: clock() }).get(request());
  assertEquals(none.kind === "err" ? none.error.kind : "ok", "unavailable");
  assertEquals((await NO_CREDENTIALS.get(request())).kind, "err");
  const throwing = await credentialSession({ port: { ask: () => Promise.reject(new TypeError(`secret ${PASS}`)) }, interactive: true, clock: clock() }).get(request());
  assertEquals(throwing.kind === "err" && throwing.error, { kind: "unavailable", why: "TypeError" });
  const all: readonly CredentialRefusal[] = [{ kind: "non-interactive" }, { kind: "timeout", afterMs: 5000 }, { kind: "cancelled" }, { kind: "unavailable", why: "x" }, { kind: "empty" }, { kind: "too-short", minimum: 4 }, { kind: "closed" }];
  assertEquals(all.map((r) => r.kind), [...CREDENTIAL_REFUSALS]);
  for (const r of all) {
    assert(/^E3-CRED-[A-Z]+$/.test(refusalCode(r)), refusalCode(r));
    assertStringIncludes(refusalMessage(r, "ssh-key:/k"), "ssh-key:/k");
  }
  assertEquals(new Set(all.map(refusalCode)).size, all.length);
});

proves(["0011-credential-prompt FR-004"], "a prompt has a hard time limit that aborts the port, a stopped run cancels it, and an empty or short answer is refused", async () => {
  assertEquals([limitOf(undefined), limitOf(Number.NaN), limitOf(5), limitOf(30_000), limitOf(99_999_999), limitOf(Number.POSITIVE_INFINITY)], [DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1000, 30_000, MAX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS]);
  fc.assert(fc.property(fc.double({ noNaN: true }), (ms) => limitOf(ms) >= 1000 && limitOf(ms) <= MAX_TIMEOUT_MS));
  const c = clock();
  const hang = port(() => new Promise(() => undefined));
  const s = credentialSession({ port: hang, interactive: true, clock: c, timeoutMs: 20_000 });
  const asked = s.get(request());
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(c.last(), 20_000);
  c.fire();
  const r = await asked;
  assertEquals(r.kind === "err" && r.error, { kind: "timeout", afterMs: 20_000 });
  assertEquals(hang.signals[0]?.aborted, true, "the port was told to stop");
  assertEquals(c.pending(), 0, "the timer is cleared");
  const controller = new AbortController();
  const stopped = credentialSession({ port: port(() => new Promise(() => undefined)), interactive: true, clock: clock(), signal: controller.signal });
  const waiting = stopped.get(request());
  await Promise.resolve();
  controller.abort();
  const cancelled = await waiting;
  assertEquals(cancelled.kind === "err" && cancelled.error.kind, "cancelled");
  const empty = await credentialSession({ port: port(() => ok(secretOf(""))), interactive: true, clock: clock() }).get(request());
  assertEquals(empty.kind === "err" && empty.error.kind, "empty");
  const short = await credentialSession({ port: port(() => ok(secretOf("abc"))), interactive: true, clock: clock() }).get(request());
  assertEquals(short.kind === "err" && short.error.kind, "too-short");
  const yes = credentialSession({ port: port(() => ok(secretOf("y"))), interactive: true, clock: clock() });
  assertEquals((await yes.get(request("ok?", "confirm"))).kind, "ok", "a yes is not a secret");
  assertEquals(yes.values(), []);
});

/** A program with one command that asks for a credential, writes it into everything it can, and returns. */
const leaky = (calls: { n: number }) =>
  programOf({
    name: "tool",
    summary: "T.",
    version: "1",
    children: [
      command({
        name: "sign",
        summary: "Sign.",
        options: {},
        action: { kind: "report" },
        run: async (_a, ctx) => {
          const got = await ctx.credentials.get(request());
          const again = await ctx.credentials.get(request());
          calls.n += 1;
          if (got.kind === "err" || again.kind === "err") return outcomeOf(null, { exit: "environment", problems: [problem("fail", got.kind === "err" ? refusalMessage(got.error, "key") : "x", { code: got.kind === "err" ? refusalCode(got.error) : "E1-X" })] });
          const value = got.value.reveal();
          ctx.progress({ kind: "live", message: `using ${value}` });
          return outcomeOf({ echoed: value }, { text: `signed with ${value}`, problems: [problem("warn", `the passphrase ${value} is weak`, { code: "E1-WEAK" })] });
        },
      }),
    ],
  });

proves(["0011-credential-prompt FR-005", "0011-credential-prompt FR-006"], "a command is given its session, the redaction of the run covers the values it handed out, the log records the prompt and never the value, and the session ends with the command", async () => {
  const calls = { n: 0 };
  const p = port();
  const store = memoryStore(Date.UTC(2026, 10, 20, 10, 0, 0));
  const io = { ...world({ terminal: true, store, env: { HOME: "/h", XDG_STATE_HOME: "/s" } }), credentials: p, clock: clock() };
  for (const argv of [["sign"], ["sign", "--json"], ["sign", "--verbose"]]) {
    const r = await run(leaky(calls), argv, { ...io, pid: argv.length });
    assert(!r.out.includes(PASS) && !r.err.includes(PASS), `${argv.join(" ")}: neither stream holds the value`);
    assertEquals(r.code, 0, "the warning is not a failure");
  }
  assertEquals(p.calls.length, 3, "each run is one command and asks once");
  const logs = [...store.files.values()].map((f) => f.text).join("\n");
  assert(!logs.includes(PASS), "the log holds no value");
  assertStringIncludes(logs, "credential ssh-key:/k (passphrase) asked");
  assertStringIncludes(logs, "credential ssh-key:/k given");
  const text = (await run(leaky(calls), ["sign"], { ...io, pid: 9 })).out;
  assertEquals(text, "signed with ***\n");
  // no terminal: the command gets a typed refusal and the port is not called
  const quiet = port();
  const refused = await run(leaky(calls), ["sign", "--json"], { ...world({ store }), credentials: quiet });
  assertEquals([refused.code, quiet.calls], [3, []]);
  assertStringIncludes(refused.out, "E3-CRED-NOTTY");
  const noPort = await run(leaky(calls), ["sign"], world({ terminal: true }));
  assertStringIncludes(noPort.err, "E3-CRED-UNAVAILABLE");
  assertEquals((await run(leaky(calls), ["sign", "--non-interactive"], { ...world({ terminal: true }), credentials: quiet })).code, 3);
  let kept: ReturnType<typeof credentialSession> | undefined;
  const grabbing = programOf({ name: "tool", summary: "T.", version: "1", children: [command({ name: "grab", summary: "G.", options: {}, action: { kind: "report" }, run: async (_a, ctx) => { kept = ctx.credentials; await ctx.credentials.get(request()); return outcomeOf(null); } })] });
  await run(grabbing, ["grab"], { ...world({ terminal: true }), credentials: port(), clock: clock() });
  assertEquals(kept?.values(), [], "the session was closed when the command ended");
  assertEquals((await kept?.get(request("late")))?.kind, "err");
});

/** A terminal a test drives: what is written, and the answers it types. */
function fakeTty(answers: readonly (string | undefined)[], open: Result<true, string> = ok(true)): TtyPort & { readonly written: string[]; readonly echoes: boolean[]; readonly closed: () => number } {
  const written: string[] = [];
  const echoes: boolean[] = [];
  let closed = 0;
  const queue = [...answers];
  return {
    written,
    echoes,
    closed: () => closed,
    open: () => {
      if (open.kind === "err") return Promise.resolve(err({ kind: "no-terminal" as const, why: open.error }));
      const handle: TtyHandle = {
        write: (t) => void written.push(t),
        readLine: (echo, signal) => {
          echoes.push(echo);
          return Promise.resolve(signal.aborted ? undefined : queue.shift());
        },
        close: () => void (closed += 1),
      };
      return Promise.resolve(ok(handle));
    },
  };
}

proves(["0011-credential-prompt FR-007"], "the terminal adapter draws the prompt, reads with no echo for a secret and with echo for a yes, never writes the value, and cancels on an ended input; the reader is pure and the devices are rows by system", async () => {
  const tty = fakeTty([PASS, "yes", undefined]);
  const adapter = terminalCredentials(tty);
  const limits = { timeoutMs: 1000, signal: new AbortController().signal };
  const got = await adapter.ask(request(), limits);
  assertEquals(got.kind === "ok" && got.value.reveal(), PASS);
  assertEquals(tty.written, ["Passphrase for ssh-key:/k: ", "\n"]);
  assert(!tty.written.join("").includes(PASS));
  const yes = await adapter.ask(request("sure", "confirm"), limits);
  assertEquals([yes.kind === "ok" && yes.value.reveal(), tty.echoes], ["yes", [false, true]]);
  assertEquals((await adapter.ask(request("gone"), limits)).kind === "err", true);
  assertEquals(tty.closed(), 3, "the terminal is given back every time");
  const aborted = new AbortController();
  aborted.abort();
  assertEquals((await adapter.ask(request("stopped"), { timeoutMs: 1000, signal: aborted.signal })).kind === "err", true);
  const none = await terminalCredentials(fakeTty([], err("standard input is not a terminal"))).ask(request(), limits);
  assertEquals(none.kind === "err" && none.error, { kind: "unavailable", why: "standard input is not a terminal" });
  assertEquals(drawPrompt({ ...request(), prompt: "Pass: " }), "Pass: ");
  // the reader
  const feed = (text: string) => {
    let state = START;
    for (const ch of text) {
      const step = readerStep(state, ch);
      if (step.kind === "line") return step.line;
      if (step.kind === "ended") return undefined;
      state = step.state;
    }
    return "<reading>";
  };
  assertEquals([feed("abc\r"), feed("abd\u007fc\n"), feed("ab\u0003"), feed("ab\u0004"), feed("ab")], ["abc", "abc", undefined, undefined, "<reading>"]);
  assertEquals(readerStep(START, "ab\tc\r"), { kind: "line", line: "abc" }, "a control character is not part of a line");
  fc.assert(fc.property(fc.string({ unit: fc.constantFrom(..."abcXYZ019 !") }), (typed) => readerStep(START, `${typed}\r`).kind === "line"));
  assertEquals(ttyDevicesOf("linux"), { input: "/dev/tty", output: "/dev/tty", echo: "stty" });
  assertEquals(ttyDevicesOf("darwin").echo, "stty");
  assertEquals(ttyDevicesOf("windows"), { input: "CONIN$", output: "CONOUT$", echo: "console-mode" });
});

proves(["0011-credential-prompt FR-008"], "the helper ssh runs reads the request from its argument, asks once, writes the answer as one line and ends 0, ends 1 with only a reason where there is none, and ends 2 for arguments that are no request", async () => {
  const env = (m: Record<string, string>) => (n: string) => m[n];
  const key = "Enter passphrase for key '/home/u/.ssh/id_ed25519': ";
  const parsed = requestOf([key], env({}));
  assertEquals(parsed.kind === "ok" && parsed.value.kind === "ask" && [parsed.value.request.kind, String(parsed.value.request.id)], ["passphrase", "ssh-key:/home/u/.ssh/id_ed25519"]);
  assertEquals(idTextOf("alice@host's password: "), "ssh-password:alice@host");
  assertEquals(kindOfPrompt("alice@host's password:", undefined), "password");
  assertEquals(kindOfPrompt("Enter PIN for 'token':", undefined), "pin");
  assertEquals(kindOfPrompt("Are you sure (yes/no)?", "confirm"), "confirm");
  const p = port();
  const ok0 = await runAskpass([key], env({}), { port: p, clock: clock() });
  assertEquals(ok0, { stdout: `${PASS}\n`, stderr: "", code: 0 });
  assertEquals(p.calls.length, 1);
  const none = await runAskpass([key], env({}), { port: port(() => err({ kind: "cancelled" })), clock: clock() });
  assertEquals([none.stdout, none.code, none.stderr.includes(PASS)], ["", 1, false]);
  assertStringIncludes(none.stderr, "cancelled");
  const yes = await runAskpass(["Are you sure?"], env({ SSH_ASKPASS_PROMPT: "confirm" }), { port: port(() => ok(secretOf("yes"))), clock: clock() });
  assertEquals([yes.stdout, yes.code], ["yes\n", 0]);
  const info = await runAskpass(["Authenticated."], env({ SSH_ASKPASS_PROMPT: "none" }), { port: p, clock: clock() });
  assertEquals([info.stdout, info.stderr, info.code, p.calls.length], ["", "Authenticated.\n", 0, 1]);
  const usage = await runAskpass([], env({}), { port: p, clock: clock() });
  assertEquals([usage.code, usage.stdout], [2, ""]);
  assertEquals((await runAskpass(["a", "b"], env({}), { port: p, clock: clock() })).code, 2);
  const slow = clock();
  const waiting = runAskpass([key], env({}), { port: port(() => new Promise(() => undefined)), clock: slow, timeoutMs: 5000 });
  await Promise.resolve();
  await Promise.resolve();
  slow.fire();
  const timed = await waiting;
  assertEquals([timed.code, timed.stdout], [1, ""]);
  assertStringIncludes(timed.stderr, "timeout");
});

proves(["0011-credential-prompt FR-009"], "the launcher is a script on Linux and macOS and a .cmd file on Windows, a path that cannot be quoted is refused, and ssh is told to use it even with a terminal", () => {
  const unix = launcherOf("linux", "/usr/bin/bun", "/opt/tool/askpass.ts");
  assertEquals(unix.kind === "ok" && unix.value, { fileName: "askpass.sh", text: "#!/bin/sh\nexec '/usr/bin/bun' '/opt/tool/askpass.ts' \"$@\"\n", mode: 0o700 });
  assertEquals(launcherOf("darwin", "/b", "/e").kind, "ok");
  const win = launcherOf("windows", "C:\\bun\\bun.exe", "C:\\tool\\askpass.ts");
  assertEquals(win.kind === "ok" && win.value, { fileName: "askpass.cmd", text: '@echo off\r\n"C:\\bun\\bun.exe" "C:\\tool\\askpass.ts" %*\r\n', mode: 0o700 });
  for (const [os, rt, entry] of [["linux", "/b'x", "/e"], ["windows", "C:\\b\"x", "C:\\e"], ["windows", "C:\\100%\\bun.exe", "C:\\e"], ["linux", "/b", "/e\n"], ["linux", "", "/e"]] as const) assertEquals(launcherOf(os, rt, entry).kind, "err", `${os} ${rt}`);
  assertEquals(askpassEnv("/x/askpass.sh"), { SSH_ASKPASS: "/x/askpass.sh", SSH_ASKPASS_REQUIRE: "force" });
});
