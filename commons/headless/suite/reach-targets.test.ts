/**
 * Tests of reach and targets: the reach policy and its conformance rule, the trust policy, the executor port and its local and ssh adapters, the quoting of the remote
 * command (read back by a real shell), the host key that is never accepted, the dispatch of a verb to targets and the entry a target runs, the mapping of what comes back, the
 * inbound generator, and the ban on hand-built ssh arguments (commons headless 0005-reach-and-targets FR-001 to FR-010).
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { isErr, isOk } from "@intellectual-frontiers/core";
import { proc } from "@intellectual-frontiers/system";
import { defineAction, defineReach, reachConformance, reachDecision, reachProblems, TARGET_CLASSES, TRUST, type Reached } from "../src/governance/mod.ts";
import {
  command,
  decodeEnvelope,
  envelopeOf,
  exitOfRemote,
  fanOut,
  hostTable,
  jsonText,
  modelProblems,
  outcomeOfRemote,
  outcomeOf,
  programOf,
  REMOTE_CATALOGUE,
  catalogueProblems,
  reportOfRemote,
  selectTargets,
  target,
  textOf,
  type Executor,
  type Output,
  type RemoteOutcome,
  type Target,
  type RunOptions,
} from "../src/logical/mod.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { authorizedKeysLine, forcedCommand, inboundPlan, matchBlock, modesFor } from "../src/surfaces/ssh-inbound/mod.ts";
import { localExecutor } from "../src/targets/local/mod.ts";
import { remoteCommand, shQuote, sshArgv, type SshConfig } from "../src/targets/ssh/argv.ts";
import { runScript, sshExecutor } from "../src/targets/ssh/executor.ts";
import { sshArgumentFindings } from "../src/targets/ssh/ban.ts";
import { acceptHostKey, scanHost, type ScannedKey } from "../src/targets/ssh/hostkey.ts";
import { problem } from "../src/governance/mod.ts";
import { world } from "./world.ts";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const out = (code: number, stdout = "", stderr = ""): Output => ({ code, success: code === 0, signal: null, stdout: enc(stdout), stderr: enc(stderr) });
const T = (id: string, extra: Partial<Parameters<typeof target>[0]> = {}): Target => {
  const r = target({ id, class: "server", address: `${id}.example`, ...extra });
  if (!isOk(r)) throw new Error(r.error);
  return r.value;
};
const CONFIG: SshConfig = { knownHostsRepository: "/repo/known_hosts.auto", knownHostsUser: "/home/a/.ssh/known_hosts", controlDir: "/run/ctl", identityFor: (n) => (n === "probe" ? "/keys/probe" : undefined) };

const reads = defineAction({ id: "status", summary: "Status.", kind: "report" });
const changes = defineAction({ id: "sync", summary: "Sync.", kind: "action", dryRun: true });
const wipes = defineAction({ id: "wipe", summary: "Wipe.", kind: "action", effect: "destructive", dryRun: true });

proves(["0005-reach-and-targets FR-001"], "a reach policy has the safe defaults, and the decision refuses a channel it does not list and a changing action for a key that may only read", () => {
  assertEquals(defineReach({ channels: ["local"] }), { channels: ["local"], readOnly: false, idempotent: false, needsTty: false, runsAs: "caller", confirmation: "none" });
  const r = defineReach({ channels: ["local", "ssh"], readOnly: true, idempotent: true });
  assertEquals(reachDecision(reads, r, "ssh", { mayOnlyRead: true }), { kind: "allowed" });
  const mcp = reachDecision(reads, r, "mcp", { mayOnlyRead: false });
  assertEquals(mcp.kind === "refused" && mcp.reason, "channel");
  const w = reachDecision(changes, defineReach({ channels: ["ssh"] }), "ssh", { mayOnlyRead: true });
  assertEquals(w.kind === "refused" && w.reason, "read-only-key");
  assertEquals(reachDecision(changes, defineReach({ channels: ["ssh"] }), "ssh", { mayOnlyRead: false }), { kind: "allowed" });
});

proves(["0005-reach-and-targets FR-002"], "the classes of target are four, the trust policy has one value for each field and names no secret", () => {
  assertEquals(TARGET_CLASSES, ["server", "workstation", "device", "network-gear"]);
  assertEquals(TRUST, { hostKey: "verify", knownHosts: ["repository", "user"], onMismatch: "refuse", firstContact: "explicit-verb", credentials: "reference-only" });
  assert(!/secret|password|token|key=/i.test(JSON.stringify(TRUST).replace("hostKey", "").replace("credentials", "")));
});

proves(["0005-reach-and-targets FR-003"], "an action with no reach policy is rejected, and a policy that contradicts its action is found by rule", () => {
  const fits = defineReach({ channels: ["local", "ssh"], readOnly: true, idempotent: true });
  assertEquals(reachProblems(reads, fits), []);
  assertEquals(reachConformance([{ facts: reads, reach: undefined }]).map((p) => p.rule), ["reach/missing"]);
  const rules = (a: typeof reads, r: ReturnType<typeof defineReach>) => reachProblems(a, r).map((p) => p.rule);
  assertEquals(rules(reads, defineReach({ channels: [], readOnly: true, idempotent: true })), ["reach/no-channel"]);
  assertEquals(rules(reads, defineReach({ channels: ["ssh", "ssh"], readOnly: true, idempotent: true })), ["reach/duplicate-channel"]);
  assertEquals(rules(reads, defineReach({ channels: ["local"], readOnly: false, idempotent: true })), ["reach/read-only-mismatch"]);
  assertEquals(rules(changes, defineReach({ channels: ["local"], readOnly: true })), ["reach/read-only-mismatch"]);
  assertEquals(rules(reads, defineReach({ channels: ["local"], readOnly: true, idempotent: false })), ["reach/idempotent-mismatch"]);
  assertEquals(rules(reads, defineReach({ channels: ["mcp"], readOnly: true, idempotent: true, needsTty: true })), ["reach/tty-without-terminal"]);
  assertEquals(rules(wipes, defineReach({ channels: ["local"] })), ["reach/destructive-unconfirmed"]);
  assertEquals(rules(wipes, defineReach({ channels: ["local"], confirmation: "person" })), []);
  assertEquals(rules({ ...reads, audience: "human" }, defineReach({ channels: ["local", "ssh"], readOnly: true, idempotent: true })), ["reach/human-only-remote"]);
  const missing = programOf({ name: "t", summary: "T.", version: "1", children: [command({ name: "x", summary: "X.", options: {}, action: { kind: "report" }, run: () => Promise.resolve(outcomeOf(null)) })] });
  assertEquals(modelProblems(missing), []);
  assertEquals(modelProblems(missing, { requireReach: true }).map((m) => m.rule), ["model/no-reach-policy"]);
  const bad = programOf({ name: "t", summary: "T.", version: "1", children: [command({ name: "x", summary: "X.", options: {}, action: { kind: "report", reach: defineReach({ channels: ["ssh"] }) }, run: () => Promise.resolve(outcomeOf(null)) })] });
  assertEquals(modelProblems(bad, { requireReach: true }).map((m) => m.rule), ["model/reach", "model/reach"]);
});

proves(["0005-reach-and-targets FR-004"], "an executor has the shape of the system's proc: proc.output is an Executor's exec, and the local target is it", async () => {
  const procOutput: (argv: readonly string[], opts?: RunOptions) => Promise<Output> = (argv, opts) => proc.output(argv, opts);
  const viaType: Executor = { exec: proc.output };
  assert(viaType.exec === proc.output);
  const outputOf: Output = await procOutput([process.execPath, "-e", "process.stdout.write('hi')"]);
  assertEquals([outputOf.code, textOf(outputOf.stdout)], [0, "hi"]);
  const local = await localExecutor().exec([process.execPath, "-e", "process.stdout.write(require('node:fs').readFileSync(0, 'utf8').toUpperCase())"], { input: "abc" });
  assertEquals(textOf(local.stdout), "ABC");
  assertEquals((await localExecutor().exec([process.execPath, "-e", "process.exit(7)"])).code, 7);
});

/** The words of a command string made by `remoteCommand`, read back by hand: single-quoted runs and bare words, the one `'\\''` escape. */
function unquoted(remote: string): string[] {
  const words: string[] = [];
  let cur = "";
  let has = false;
  for (let i = 0; i < remote.length; i += 1) {
    const c = remote[i];
    if (c === "'") {
      const end = remote.indexOf("'", i + 1);
      cur += remote.slice(i + 1, end);
      has = true;
      i = end;
    } else if (c === "\\") {
      cur += remote[i + 1] ?? "";
      i += 1;
    } else if (c === " ") {
      if (has || cur !== "") words.push(cur);
      cur = "";
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (has || cur !== "") words.push(cur);
  return words;
}

/** What a real POSIX shell reads back from a remote command string, as NUL-separated words. */
function shellWords(remote: string): string[] {
  // a POSIX shell on a remote host is what the quoting is for; the sh of a Windows runner (Git for Windows) changes a carriage return in its arguments, so the words are read back only where a POSIX sh is the system's
  if (process.platform === "win32") return JSON.parse(JSON.stringify(unquoted(remote)));
  const r = spawnSync("sh", ["-c", `for w in ${remote}; do printf '%s\\0' "$w"; done`], { encoding: "utf8" });
  return r.stdout.split("\u0000").slice(0, -1);
}

proves(["0005-reach-and-targets FR-005"], "the remote command is quoted word by word into one string that a real shell reads back as the same words", () => {
  assertEquals(shQuote("plain-word_1.0/x"), "plain-word_1.0/x");
  assertEquals(shQuote(""), "''");
  assertEquals(shQuote("it's here"), `'it'\\''s here'`);
  const argv = ["ops", "run", "--json", "say", "it's; rm -rf /", "$(id)", "a b", "`x`", "", "*", "\\n"];
  const r = remoteCommand(argv);
  assert(isOk(r));
  if (isOk(r)) {
    assertEquals(shellWords(r.value), argv);
    assertEquals(unquoted(r.value), argv, "the hand reading agrees with a real shell");
  }
  assert(isErr(remoteCommand([])) && isErr(remoteCommand(["a\u0000b"])));
  fc.assert(
    fc.property(fc.array(fc.string({ unit: "binary" }).filter((s) => !s.includes("\u0000")), { minLength: 1, maxLength: 5 }), (words) => {
      const q = remoteCommand(words);
      assert(isOk(q));
      if (isOk(q)) assertEquals(shellWords(q.value), words);
    }),
  );
});

proves(["0005-reach-and-targets FR-005", "0005-reach-and-targets FR-006"], "the ssh arguments hold the one set of options in one place, put the destination after --, and never accept a host key", () => {
  const t = T("alpha", { user: "ops", port: 2222, jump: ["gate"], credential: "probe" });
  const gate = T("gate", { user: "jump", port: 22 });
  const r = sshArgv(t, [t, gate], CONFIG, "ops run --json status");
  assert(isOk(r));
  if (!isOk(r)) return;
  const v = r.value;
  assertEquals(v[0], "ssh");
  for (const want of ["-T", "BatchMode=yes", "ConnectTimeout=10", "ServerAliveInterval=15", "StrictHostKeyChecking=yes", "UserKnownHostsFile=/repo/known_hosts.auto /home/a/.ssh/known_hosts", "PasswordAuthentication=no", "KbdInteractiveAuthentication=no", "ControlMaster=auto", "ControlPath=/run/ctl/%C", "ControlPersist=60", "IdentitiesOnly=yes", "/keys/probe", "2222", "jump@gate.example:22"]) {
    assert(v.includes(want), `${want} in ${v.join(" ")}`);
  }
  assertEquals(v.slice(-3), ["--", "ops@alpha.example", "ops run --json status"]);
  assertEquals(v.indexOf("-J") > 0 && v[v.indexOf("-J") + 1], "jump@gate.example:22");
  const bare = sshArgv(T("beta"), [], { knownHostsRepository: "/r", knownHostsUser: "/u" }, "x");
  assert(isOk(bare) && !bare.value.some((a) => a.startsWith("ControlMaster") || a === "-i" || a === "-J" || a === "-p"));
  assert(isErr(sshArgv(t, [t], CONFIG, "x")), "a jump through a target that is not known");
  assert(isErr(sshArgv(T("cred", { credential: "nope" }), [], CONFIG, "x")), "a credential that does not resolve");
  assert(isErr(sshArgv(T("sp"), [], { knownHostsRepository: "/a b", knownHostsUser: "/u" }, "x")));
  fc.assert(
    fc.property(fc.constantFrom("alpha", "b2", "c-d"), fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }), fc.string(), (id, port, remote) => {
      const x = sshArgv(T(id, port === undefined ? {} : { port }), [], CONFIG, remote);
      assert(isOk(x));
      if (!isOk(x)) return;
      const text = x.value.join("\n").replace(remote, "");
      assert(!/accept-new|StrictHostKeyChecking=no|StrictHostKeyChecking=off/i.test(text));
      assert(x.value.includes("StrictHostKeyChecking=yes"));
      assertEquals(x.value.at(-1), remote);
    }),
  );
});

proves(["0005-reach-and-targets FR-005"], "an address that could be taken for an option, a user, a port, a jump or a credential that is not one is not a target", () => {
  const bad = (d: Partial<Parameters<typeof target>[0]>) => isErr(target({ id: "a", class: "server", address: "h", ...d }));
  assert(bad({ address: "-oProxyCommand=x" }) && bad({ address: "a b" }) && bad({ address: "" }));
  assert(bad({ id: "Bad Id" }) && bad({ class: "toaster" as never }) && bad({ port: 0 }) && bad({ port: 70_000 }) && bad({ port: 1.5 }));
  assert(bad({ user: "a b" }) && bad({ jump: ["a"] }) && bad({ jump: ["BAD"] }) && bad({ credential: "-----BEGIN KEY" }));
  assert(!bad({ address: "10.0.0.5" }) && !bad({ address: "fe80::1" }) && !bad({ user: "ops", port: 22, jump: ["gate"], credential: "probe" }));
  assertEquals(T("x", { credential: "probe" }).credential, { kind: "ref", name: "probe" });
});

proves(["0005-reach-and-targets FR-005"], "the ssh executor runs the system's client with the quoted command, gives a call that cannot be made as 255 and runs a script as sh -s with it on the input", async () => {
  const calls: { argv: readonly string[]; opts: RunOptions | undefined }[] = [];
  const fake = (argv: readonly string[], opts?: RunOptions): Promise<Output> => (calls.push({ argv, opts }), Promise.resolve(out(0, "ok")));
  const t = T("alpha");
  const ex = sshExecutor(t, [t], CONFIG, fake);
  assertEquals(textOf((await ex.exec(["ops", "run", "--json", "it's"], { input: "in" })).stdout), "ok");
  assertEquals(calls[0]?.argv.at(-1), `ops run --json 'it'\\''s'`);
  assertEquals(calls[0]?.opts, { input: "in" });
  const bad = await ex.exec(["a\u0000b"]);
  assertEquals(bad.code, 255);
  assertStringIncludes(textOf(bad.stderr), "NUL");
  assertEquals(calls.length, 1, "a call that cannot be made is not made");
  await runScript(t, [t], CONFIG, "echo hi\n", ["a b"], fake);
  assertEquals(calls[1]?.argv.at(-1), "sh -s -- 'a b'");
  assertEquals(calls[1]?.opts, { input: "echo hi\n" });
  assertEquals((await sshExecutor(T("cred", { credential: "nope" }), [], CONFIG, fake).exec(["x"])).code, 255);
});

proves(["0005-reach-and-targets FR-006"], "a host is learned only by the fingerprint a person checked, and only if the host showed it", async () => {
  const t = T("alpha", { port: 2222 });
  const keyline = "alpha.example ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEXAMPLE";
  const calls: (readonly string[])[] = [];
  const fake = (argv: readonly string[]): Promise<Output> => {
    calls.push(argv);
    return Promise.resolve(argv[0] === "ssh-keyscan" ? out(0, `# alpha\n${keyline}\n`) : out(0, "256 SHA256:abcDEF123+/= alpha (ED25519)\n"));
  };
  const scanned = await scanHost(t, fake);
  assert(isOk(scanned));
  assertEquals(calls[0], ["ssh-keyscan", "-T", "8", "-p", "2222", "--", "alpha.example"]);
  if (!isOk(scanned)) return;
  assertEquals(scanned.value, [{ line: keyline, fingerprint: "SHA256:abcDEF123+/=" }]);
  const written: string[] = [];
  const wrong = await acceptHostKey(t, scanned.value, "SHA256:other", (l) => void written.push(l));
  assert(isErr(wrong));
  if (isErr(wrong)) assertStringIncludes(wrong.error, "SHA256:abcDEF123+/=");
  assertEquals(written, [], "nothing was written");
  const right = await acceptHostKey(t, scanned.value, " SHA256:abcDEF123+/= ", (l) => void written.push(l));
  assert(isOk(right));
  assertEquals(written, [keyline]);
  assert(isErr(await scanHost(t, () => Promise.resolve(out(1, "", "timed out")))));
  assert(isErr(await scanHost(t, () => Promise.resolve(out(0, "")))));
  const noPrint: ScannedKey[] = [];
  assertEquals(noPrint.length, 0);
});

/** Two targets and a program with a read-only verb, a changing one and a destructive one, for the dispatch. */
function fleet(responses: Record<string, (argv: readonly string[]) => Promise<Output>>) {
  const seen: Record<string, (readonly string[])[]> = {};
  const executors = (id: string): Executor | undefined => (responses[id] === undefined ? undefined : { exec: (argv) => ((seen[id] ??= []).push(argv), responses[id]!(argv)) });
  const okReport = (data: unknown, problems = [] as ReturnType<typeof problem>[]): Output => out(problems.some((p) => p.level === "fail") ? 1 : 0, jsonText(envelopeOf({ program: "ops", command: "status", outcome: outcomeOf(data, { problems }), code: problems.some((p) => p.level === "fail") ? 1 : 0 })));
  const reach = defineReach({ channels: ["local", "ssh"], readOnly: true, idempotent: true });
  const program = programOf({
    name: "ops",
    summary: "Ops.",
    version: "1.0.0",
    targets: [T("alpha", { class: "server" }), T("beta", { class: "server" }), T("gamma", { class: "device" })],
    remote: { concurrency: 2, perHostTimeoutMs: 200 },
    children: [
      command({ name: "status", summary: "Status.", options: {}, action: { kind: "report", reach }, run: () => Promise.resolve(outcomeOf({ here: true }, { text: "here" })) }),
      command({ name: "sync", summary: "Sync.", options: {}, action: { kind: "action", reach: defineReach({ channels: ["local", "ssh"] }) }, run: () => Promise.resolve(outcomeOf({ changed: true })) }),
      command({ name: "wipe", summary: "Wipe.", options: {}, action: { kind: "action", effect: "destructive", dryRun: true, reach: defineReach({ channels: ["local", "ssh"], confirmation: "person" }) }, run: () => Promise.resolve(outcomeOf({ wiped: true })) }),
      command({ name: "local-only", summary: "Local.", options: {}, action: { kind: "report", reach: defineReach({ channels: ["local"], readOnly: true, idempotent: true }) }, run: () => Promise.resolve(outcomeOf(null)) }),
      command({ name: "bare", summary: "No reach.", options: {}, action: { kind: "report" }, run: () => Promise.resolve(outcomeOf(null)) }),
    ],
  });
  return { program, seen, executors, okReport };
}

proves(["0005-reach-and-targets FR-007", "0005-reach-and-targets FR-009"], "--on dispatches the same verb as run --json to each target; one that cannot be reached is a row, the report is one, and the status is 1", async () => {
  const f = fleet({
    alpha: () => Promise.resolve(f.okReport({ disk: 40 })),
    beta: () => Promise.resolve(out(255, "", "ssh: connect to host beta.example port 22: Connection timed out")),
  });
  const r = await run(f.program, ["status", "--on", "alpha,beta"], { ...world(), executors: f.executors });
  assertEquals(r.code, 1);
  assertEquals(f.seen["alpha"], [["ops", "run", "--json", "status"]]);
  assertStringIncludes(r.out, "TARGET");
  assertStringIncludes(r.out, "alpha");
  assertStringIncludes(r.out, "unreachable");
  assertStringIncludes(r.err, "[x] beta: beta could not be reached [E000-REMOTE-UNREACHABLE]");
  const j = JSON.parse((await run(f.program, ["status", "--on", "all", "--json"], { ...world(), executors: f.executors })).out) as { exit: { code: number }; data: Record<string, { kind: string; code: number; data: unknown }>; problems: { message: string; phase: string }[] };
  assertEquals(j.exit.code, 1, "alpha ran, beta is unreachable and gamma has no way to be reached: a partial failure");
  assertEquals(Object.keys(j.data), ["alpha", "beta", "gamma"]);
});

proves(["0005-reach-and-targets FR-007"], "a verb reaches targets only where its reach policy allows ssh, and the selector, the executors and the forwarding are checked", async () => {
  const f = fleet({ alpha: () => Promise.resolve(f.okReport(1)), beta: () => Promise.resolve(f.okReport(2)) });
  const on = (argv: string[], over: Parameters<typeof world>[0] = {}) => run(f.program, argv, { ...world(over), executors: f.executors });
  assertEquals((await on(["local-only", "--help"])).out.includes("--on"), false);
  assertEquals((await on(["status", "--help"])).out.includes("--on"), true);
  assertEquals((await on(["status", "--on", "nope"])).err, "nope is not a target\n");
  assertEquals((await on(["status", "--on", "class:toaster"])).code, 2);
  assertEquals((await run(f.program, ["status", "--on", "alpha"], world())).err, "ops has no targets set up for --on\n");
  assertEquals((await on(["status", "--on", "class:server"])).code, 0);
  assertEquals(f.seen["alpha"]?.length, 1);
  assertEquals((await on(["status", "--on", "alpha", "--quiet", "--json"])).code, 0);
  assertEquals(f.seen["alpha"]?.at(-1), ["ops", "run", "--json", "status", "--quiet"], "--on and --json are not forwarded, the other options are");
  const sync = await on(["sync", "--on", "alpha"]);
  assertEquals(sync.code, 0);
  const wipe = await on(["wipe", "--on", "alpha", "--yes"]);
  assertEquals(wipe.code, 0);
  assertEquals(f.seen["alpha"]?.at(-1), ["ops", "run", "--json", "wipe", "--yes"]);
  assertEquals((await on(["wipe", "--on", "alpha"])).code, 2, "a destructive verb is confirmed here before it is sent");
});

proves(["0005-reach-and-targets FR-007"], "a fan-out is bounded by a cap and a time: at most the cap run at once, a host that hangs is a time out, one that throws is a row, and every id has its row in order", async () => {
  let running = 0;
  let peak = 0;
  const rows = await fanOut(["a", "b", "c", "d", "e"], async (id) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 10));
    running -= 1;
    return id;
  }, { concurrency: 2, perHostTimeoutMs: 1000 });
  assertEquals(peak, 2);
  assertEquals(rows.map((r) => (r.kind === "done" ? r.value : r.kind)), ["a", "b", "c", "d", "e"]);
  let aborted = false;
  const mixed = await fanOut(["slow", "boom", "fast"], (id, signal) => (id === "slow" ? new Promise<string>((_r, rej) => signal.addEventListener("abort", () => ((aborted = true), rej(new Error("aborted"))))) : id === "boom" ? Promise.reject(new Error("exploded")) : Promise.resolve("fine")), { concurrency: 3, perHostTimeoutMs: 30 });
  assertEquals(mixed.map((r) => r.kind), ["timeout", "failed", "done"]);
  assertEquals(mixed[1]?.kind === "failed" && mixed[1].message, "exploded");
  assert(aborted, "the signal of a host that is late is aborted");
  assertEquals(await fanOut([], () => Promise.resolve(1), { concurrency: 4, perHostTimeoutMs: 10 }), []);
  fc.assert(
    fc.asyncProperty(fc.array(fc.string({ minLength: 1, maxLength: 3 }), { maxLength: 8 }), fc.integer({ min: 1, max: 5 }), async (ids, cap) => {
      const r = await fanOut(ids, (id) => Promise.resolve(id), { concurrency: cap, perHostTimeoutMs: 100 });
      assertEquals(r.map((x) => x.id), ids);
    }),
  );
});

proves(["0005-reach-and-targets FR-007", "0005-reach-and-targets FR-008"], "the entry a target runs: run --ssh takes the command a forced command was given, refuses all else, a verb with no reach or no ssh channel, a changing verb for a read-only key, and any onward hop", async () => {
  const f = fleet({});
  const at = (args: string[], original?: string) => run(f.program, args, world({ env: original === undefined ? {} : { SSH_ORIGINAL_COMMAND: original } }));
  const ran = await at(["run", "--ssh"], "ops run --json status");
  assertEquals(ran.code, 0);
  assertEquals((JSON.parse(ran.out) as { data: unknown }).data, { here: true });
  assertEquals((await at(["run", "--ssh", "--read-only"], "ops run --json status")).code, 0);
  const refused = async (args: string[], original: string | undefined, why: string) => {
    const r = await at(args, original);
    assertEquals(r.code, 2, `${args.join(" ")} / ${original}`);
    assertStringIncludes(r.err, `ops: refused: ${why}`);
  };
  await refused(["run", "--ssh"], undefined, "there is no command to run");
  await refused(["run", "--ssh"], "rm -rf /", "only `ops run --json <verb>` is allowed here");
  await refused(["run", "--ssh"], "ops status", "only `ops run --json <verb>` is allowed here");
  await refused(["run", "--ssh"], "ops run --json status 'unterminated", "the command could not be read");
  await refused(["run", "--ssh", "--read-only"], "ops run --json sync", "sync changes something, and this key may only read");
  await refused(["run", "--ssh"], "ops run --json local-only", "local-only may not be reached through ssh");
  await refused(["run", "--ssh"], "ops run --json bare", "bare has no reach policy");
  await refused(["run", "--ssh"], "ops run --json nope", "that is not a command");
  await refused(["run", "--ssh"], "ops run --json status --on beta", "a command run here does not go on to another target");
  assertEquals((await at(["run", "--json", "sync"])).code, 0, "without --ssh the words are the arguments");
  assertEquals((await at(["run", "--read-only", "--json", "sync"])).code, 2);
  assertEquals((await at(["run", "--ssh"], "ops run --json sync --dry-run")).code, 2, "sync has no --dry-run and the usage error is the program's own");
});

proves(["0005-reach-and-targets FR-009"], "an exit of 255, a host key that does not match, a time out, a program that is not there, a refusal and a body that is not a report each have their code, and the statuses of the runs over several are 0, 3, 2 or 1", () => {
  const code = (o: Output | undefined, timedOut = false) => {
    const r = outcomeOfRemote("alpha", o, timedOut);
    return [r.kind, r.code, r.outcome.problems[0]?.code ?? null];
  };
  assertEquals(code(out(255, "", "ssh: connect to host alpha port 22: Connection refused")), ["unreachable", 3, "E000-REMOTE-UNREACHABLE"]);
  assertEquals(code(out(255, "", "Host key verification failed.")), ["hostkey", 3, "E000-REMOTE-HOSTKEY"]);
  assertEquals(code(out(255, "", "@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@")), ["hostkey", 3, "E000-REMOTE-HOSTKEY"]);
  assertEquals(code(undefined, true), ["timeout", 3, "E000-REMOTE-TIMEOUT"]);
  assertEquals(code(out(0), true), ["timeout", 3, "E000-REMOTE-TIMEOUT"]);
  assertEquals(code(out(127, "", "sh: ops: command not found")), ["missing", 3, "E000-REMOTE-NO-PROGRAM"]);
  assertEquals(code(out(2, "", "ops: refused: only run is allowed")), ["refused", 2, "E000-REMOTE-REFUSED"]);
  assertEquals(code(out(0, "not json")), ["malformed", 1, "E000-REMOTE-MALFORMED"]);
  assertEquals(code(out(1, "{}")), ["malformed", 1, "E000-REMOTE-MALFORMED"]);
  const good = outcomeOfRemote("alpha", out(1, jsonText(envelopeOf({ program: "ops", command: "status", outcome: outcomeOf({ n: 1 }, { problems: [problem("fail", "boom", { code: "E1-X" })], outcomes: ["said"], next: ["next: ops fix"] }), code: 1 }))), false);
  assertEquals([good.kind, good.code, good.outcome.data, good.outcome.problems[0]?.code, good.outcome.outcomes], ["ran", 1, { n: 1 }, "E1-X", ["said"]]);
  assert(isErr(decodeEnvelope("")) && isErr(decodeEnvelope('{"schema":"other"}')));
  assertEquals(catalogueProblems(REMOTE_CATALOGUE), []);
  const row = (kind: RemoteOutcome["kind"], c: number): RemoteOutcome => ({ target: kind + c, kind, code: c, outcome: outcomeOf(null) });
  assertEquals(exitOfRemote([row("ran", 0), row("ran", 0)]), 0);
  assertEquals(exitOfRemote([row("unreachable", 3), row("timeout", 3)]), 3);
  assertEquals(exitOfRemote([row("refused", 2), row("refused", 2)]), 2);
  assertEquals(exitOfRemote([row("ran", 0), row("unreachable", 3)]), 1);
  assertEquals(exitOfRemote([row("ran", 1), row("ran", 0)]), 1);
  assertEquals(exitOfRemote([row("malformed", 1), row("refused", 2)]), 1);
});

proves(["0005-reach-and-targets FR-009"], "the runs over several targets are one report: the table of the hosts, each host's data under its id, every problem once and marked with its target", () => {
  const rows: RemoteOutcome[] = [
    { target: "alpha", kind: "ran", code: 0, outcome: outcomeOf({ disk: 40 }, { outcomes: ["fine"] }) },
    { target: "beta", kind: "unreachable", code: 3, outcome: outcomeOf(null, { problems: [problem("fail", "beta could not be reached", { code: "E000-REMOTE-UNREACHABLE" })] }) },
  ];
  const report = reportOfRemote(rows);
  assertEquals(report.data, { alpha: { kind: "ran", code: 0, data: { disk: 40 } }, beta: { kind: "unreachable", code: 3, data: null } });
  assertEquals(report.problems.map((p) => [p.message, p.phase]), [["beta: beta could not be reached", "beta"]]);
  assertEquals(report.outcomes, ["alpha: fine"]);
  assertEquals(hostTable(rows), ["TARGET  STATUS       EXIT  FIRST PROBLEM", "alpha   ok              0", "beta    unreachable     3  beta could not be reached"].join("\n"));
  assertEquals(report.text, hostTable(rows));
  assertEquals(selectTargets([T("a"), T("b", { class: "device" })], "class:device").kind, "ok");
  const sel = selectTargets([T("a"), T("b", { class: "device" })], "a,b,a");
  assert(isOk(sel) && sel.value.length === 2);
  assert(isErr(selectTargets([T("a")], "")) && isErr(selectTargets([T("a")], "z")));
});

const PUB = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEXAMPLEKEY probe@alpha";

proves(["0005-reach-and-targets FR-008"], "the inbound lines are generated from reach: forced commands with restrict, read-only for a read-only key, no line for a mode nothing is reached through, and a Match block that takes away what a forced command does not need", () => {
  const ssh = { facts: reads, reach: defineReach({ channels: ["ssh", "mcp"], readOnly: true, idempotent: true }) } satisfies Reached;
  const sshOnlyChange = { facts: changes, reach: defineReach({ channels: ["ssh"] }) } satisfies Reached;
  const mcpLine = authorizedKeysLine({ program: "ops", mode: "mcp", key: { name: "ops", publicKey: PUB, role: "full" } });
  assertEquals(mcpLine, { kind: "ok", value: `restrict,command="ops mcp" ${PUB}` });
  const runLine = authorizedKeysLine({ program: "ops", mode: "run", key: { name: "probe", publicKey: PUB, role: "read-only", from: ["10.0.0.0/8", "*.example"] } });
  assertEquals(runLine, { kind: "ok", value: `restrict,from="10.0.0.0/8,*.example",command="ops run --ssh --read-only" ${PUB}` });
  assertEquals(forcedCommand("ops", "mcp", "read-only"), "ops mcp --read-only");
  assertEquals(modesFor([ssh], "read-only"), ["mcp", "run"]);
  assertEquals(modesFor([sshOnlyChange], "read-only"), []);
  assertEquals(modesFor([sshOnlyChange], "full"), ["run"]);
  const plan = inboundPlan("ops", [ssh, sshOnlyChange], [{ name: "probe", publicKey: PUB, role: "read-only" }, { name: "admin", publicKey: PUB, role: "full" }]);
  assertEquals(plan.problems, []);
  assertEquals(plan.lines.map((l) => /command="([^"]*)"/.exec(l)?.[1]), ["ops mcp --read-only", "ops run --ssh --read-only", "ops mcp", "ops run --ssh"]);
  assert(plan.lines.every((l) => l.startsWith("restrict,")));
  const nothing = inboundPlan("ops", [{ facts: reads, reach: defineReach({ channels: ["local"], readOnly: true, idempotent: true }) }, { facts: changes, reach: undefined }], [{ name: "probe", publicKey: PUB, role: "full" }]);
  assertEquals(nothing.lines, []);
  assertEquals(nothing.problems.length, 2);
  for (const bad of ["-----BEGIN OPENSSH PRIVATE KEY-----\nabc", "ssh-ed25519", "not a key", `${PUB}\nrestrict ${PUB}`, "ssh-ed25519 AAAA!!!"]) {
    assert(isErr(authorizedKeysLine({ program: "ops", mode: "mcp", key: { name: "k", publicKey: bad, role: "full" } })), JSON.stringify(bad));
  }
  assert(isErr(authorizedKeysLine({ program: 'ops" ; rm', mode: "mcp", key: { name: "k", publicKey: PUB, role: "full" } })));
  assert(isErr(authorizedKeysLine({ program: "ops", mode: "mcp", key: { name: "k", publicKey: PUB, role: "full", from: ['a",command="x'] } })));
  const block = matchBlock({ user: "ops", addresses: ["10.0.0.0/8"] });
  assert(isOk(block));
  if (isOk(block)) for (const want of ["Match User ops Address 10.0.0.0/8", "AuthenticationMethods publickey", "PermitTTY no", "AllowTcpForwarding no", "AllowAgentForwarding no", "X11Forwarding no", "PermitTunnel no"]) assertStringIncludes(block.value, want);
  assert(isErr(matchBlock({ user: "Ops; rm" })) && isErr(matchBlock({ user: "ops", addresses: ["a b"] })));
  fc.assert(
    fc.property(fc.string(), (s) => {
      const r = authorizedKeysLine({ program: "ops", mode: "mcp", key: { name: "k", publicKey: s, role: "full" } });
      if (isOk(r)) assert(!/[\n\r]/.test(r.value) && r.value.startsWith('restrict,command="ops mcp" '));
    }),
  );
});

proves(["0005-reach-and-targets FR-010"], "a hand-built ssh argument in a consumer is found, and one made by the executor is not asked of the consumer", () => {
  const found = (text: string) => sshArgumentFindings([{ path: "a.ts", text }]).map((f) => f.line);
  assertEquals(found('run(["ssh", "-o", "BatchMode=yes", host, cmd]);'), [1]);
  assertEquals(found('const argv = [\n  "ssh",\n  `-oConnectTimeout=10`,\n];'), [2]);
  assertEquals(found("exec(`ssh -o StrictHostKeyChecking=no ${h}`)"), [1]);
  assertEquals(found('spawn("ssh", ["-T", host])'), [], "an ssh call with no option of its own is not a hand-built set of options");
  assertEquals(found('// ["ssh", "-o", "BatchMode=yes"]\n * ssh -o x'), []);
  assertEquals(found('await ex.exec(["ops", "run", "--json", "status"]);'), []);
  assertEquals(found('const word = "ssh";\nconsole.log(word);'), []);
});

proves(["0005-reach-and-targets FR-010"], "no unit of the library imports an ssh library or reads a protocol: the rows of the layers table for targets and for the inbound surface allow the terminal, the system and Core only", async () => {
  const { decodeTable, importFindings } = await import("@intellectual-frontiers/kanon");
  const { library } = await import("../library.ts");
  const decoded = decodeTable(library.kanon);
  if (decoded.kind === "err") throw new Error(decoded.error);
  const table = decoded.value;
  const packages = (folder: string) => (table.units.find((u) => u.folder === folder)?.packages ?? []).map((a) => a.name);
  assertEquals(table.units.filter((u) => u.folder.startsWith("src/targets/")).map((u) => u.folder), ["src/targets/local/", "src/targets/ssh/"]);
  assertEquals(packages("src/targets/ssh/"), ["@intellectual-frontiers/core", "@intellectual-frontiers/system", "@intellectual-frontiers/terminal"]);
  assertEquals(packages("src/surfaces/ssh-inbound/"), ["@intellectual-frontiers/core"]);
  const files = (path: string, spec: string) => [{ path, text: `import { x } from "${spec}";\n` }];
  const exportsMap = { "./logical": "./src/logical/mod.ts", "./cli": "./src/surfaces/cli/mod.ts" };
  const rules = (path: string, spec: string) => importFindings(table, files(path, spec), exportsMap).map((f) => f.rule);
  assertEquals(rules("src/targets/ssh/a.ts", "ssh2"), ["layers/external"]);
  assertEquals(rules("src/targets/ssh/a.ts", "@intellectual-frontiers/telemetry"), ["layers/external"]);
  assertEquals(rules("src/surfaces/ssh-inbound/a.ts", "@intellectual-frontiers/system"), ["layers/external"]);
  assertEquals(rules("src/targets/local/a.ts", "@intellectual-frontiers/headless/cli"), ["layers/around"]);
  assertEquals(rules("src/surfaces/cli/a.ts", "@intellectual-frontiers/headless/logical"), []);
  assertEquals(rules("src/targets/ssh/a.ts", "@intellectual-frontiers/headless/logical"), []);
});
