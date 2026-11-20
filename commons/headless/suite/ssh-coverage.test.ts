/**
 * Tests of the ssh coverage: the families of options, the verb of first contact, files copied with scp, a session with piped streams (against a stand-in client that answers its
 * input), the typed key tools, the two files of known hosts, and the table of the ways stolos calls ssh (commons headless 0007-ssh-coverage FR-001 to FR-007).
 *
 * @module
 */
import { chmodSync } from "node:fs";
import fc from "fast-check";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { isErr, isOk } from "@intellectual-frontiers/core";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { defineReach, interactiveAllowed } from "../src/governance/mod.ts";
import { outcomeOf, target, textOf, type Output, type RunOptions, type Target } from "../src/logical/mod.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { programOf } from "../src/logical/mod.ts";
import { localExecutor } from "../src/targets/local/mod.ts";
import { configForReach, localForScp, safeRemotePath, scpArgv, sshArgv, type SshConfig } from "../src/targets/ssh/argv.ts";
import { sshExecutor } from "../src/targets/ssh/executor.ts";
import { acceptHostKey, scanHost } from "../src/targets/ssh/hostkey.ts";
import {
  FINGERPRINT_ARGV,
  findPrincipalsArgv,
  keygenArgv,
  knownHostName,
  parseFingerprint,
  parseScan,
  pinnedKnownHosts,
  publicKeyArgv,
  removeHostArgv,
  scanArgv,
} from "../src/targets/ssh/hostkeys.ts";
import { trustHostCommand } from "../src/targets/ssh/trust.ts";
import { world } from "./world.ts";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const out = (code: number, stdout = "", stderr = ""): Output => ({ code, success: code === 0, signal: null, stdout: enc(stdout), stderr: enc(stderr) });
const T = (id: string, extra: Partial<Parameters<typeof target>[0]> = {}): Target => {
  const r = target({ id, class: "server", address: `${id}.example`, ...extra });
  if (!isOk(r)) throw new Error(r.error);
  return r.value;
};
const BASE: SshConfig = { knownHostsRepository: "/repo/known_hosts.auto", knownHostsUser: "/home/a/.ssh/known_hosts", identityFor: (n) => (n === "probe" ? "/keys/probe" : undefined) };
const FAKE = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "fixtures", "fake-ssh.mjs");
const argvOf = (r: ReturnType<typeof sshArgv>): readonly string[] => {
  assert(isOk(r), isErr(r) ? r.error : "");
  return isOk(r) ? r.value : [];
};

proves(["0007-ssh-coverage FR-001"], "the three families hold what each is for; a terminal and the interactive family need the reach policy to say so", () => {
  const t = T("alpha");
  const flags = (config: SshConfig): readonly string[] => argvOf(sshArgv(t, [t], config, "x"));
  const batch = flags(BASE);
  for (const want of ["-T", "BatchMode=yes", "PasswordAuthentication=no", "KbdInteractiveAuthentication=no", "StrictHostKeyChecking=yes", "UserKnownHostsFile=/repo/known_hosts.auto /home/a/.ssh/known_hosts"]) assert(batch.includes(want), want);
  const pinned = flags({ ...BASE, family: "pinned" });
  assert(pinned.includes("BatchMode=yes") && pinned.includes("UserKnownHostsFile=/repo/known_hosts.auto"), "pinned is batch with one file");
  assert(!pinned.some((a) => a.includes("/home/a/.ssh/known_hosts")));
  const interactive = flags({ ...BASE, family: "interactive" });
  assert(!interactive.some((a) => a.startsWith("BatchMode") || a.startsWith("PasswordAuthentication") || a.startsWith("KbdInteractiveAuthentication")));
  assert(interactive.includes("StrictHostKeyChecking=yes") && interactive.includes("-T"));
  const pty = flags({ ...BASE, family: "interactive", pty: true });
  assert(pty.includes("-t") && !pty.includes("-T"));
  assert(isErr(sshArgv(t, [t], { ...BASE, pty: true }, "x")), "a terminal only in the family interactive");
  assert(isErr(sshArgv(t, [t], { ...BASE, family: "pinned", pty: true }, "x")));
  const person = defineReach({ channels: ["local"], needsTty: true });
  const machine = defineReach({ channels: ["local", "ssh"] });
  assert(interactiveAllowed(person) && !interactiveAllowed(machine));
  assert(isOk(configForReach(BASE, person, "interactive", true)));
  assert(isErr(configForReach(BASE, machine, "interactive")));
  assert(isErr(configForReach(BASE, machine, "batch", true)));
  assert(isErr(configForReach(BASE, person, "pinned", true)));
  assertEquals(isOk(configForReach(BASE, machine, "pinned")) && (configForReach(BASE, machine, "pinned") as { value: SshConfig }).value.family, "pinned");
  for (const family of ["batch", "pinned", "interactive"] as const) assert(!flags({ ...BASE, family }).join(" ").match(/accept-new|StrictHostKeyChecking=no/));
});

/** A pair of scan and fingerprint answers for two keys, ed25519 and rsa, in the order the host shows them (rsa first). */
function scanRun(calls: (readonly string[])[], inputs: (string | undefined)[] = []) {
  return (argv: readonly string[], opts?: RunOptions): Promise<Output> => {
    calls.push(argv);
    if (argv[0] === "ssh-keyscan") return Promise.resolve(out(0, "# alpha.example:22 SSH-2.0-OpenSSH\nalpha.example ssh-rsa AAAARSA\nalpha.example ssh-ed25519 AAAAED\nalpha.example ssh-ed25519 AAAAED\n"));
    inputs.push(typeof opts?.input === "string" ? opts.input : undefined);
    return Promise.resolve(out(0, `${(opts?.input as string).includes("AAAAED") ? "256 SHA256:edFP alpha.example (ED25519)" : "3072 SHA256:rsaFP alpha.example (RSA)"}\n`));
  };
}

proves(["0007-ssh-coverage FR-002"], "trust-host shows what a host presents, ed25519 first, records nothing without a fingerprint or with --dry-run, and records only a fingerprint the host showed", async () => {
  const lines: string[] = [];
  const t = T("alpha");
  const calls: (readonly string[])[] = [];
  const verb = trustHostCommand({ targets: [t], run: scanRun(calls), append: (l) => void lines.push(l) });
  const p = programOf({ name: "ops", summary: "Ops.", version: "1", children: [verb] });
  const shown = await run(p, ["trust-host", "alpha"], world());
  assertEquals(shown.code, 0);
  assertEquals(shown.out, "alpha presents:\n  SHA256:edFP\n  SHA256:rsaFP\n");
  assertStringIncludes(shown.err, "ops trust-host alpha --fingerprint SHA256:edFP");
  assertEquals(lines, []);
  const dry = await run(p, ["trust-host", "alpha", "--fingerprint", "SHA256:edFP", "--dry-run"], world());
  assertEquals(dry.code, 0);
  assertEquals(lines, [], "a dry run records nothing");
  const wrong = await run(p, ["trust-host", "alpha", "--fingerprint", "SHA256:nope"], world());
  assertEquals(wrong.code, 1);
  assertStringIncludes(wrong.err, "did not show SHA256:nope; it showed SHA256:edFP, SHA256:rsaFP: nothing was written");
  assertEquals(lines, []);
  const right = await run(p, ["trust-host", "alpha", "--fingerprint", "SHA256:edFP"], world());
  assertEquals(right.code, 0);
  assertEquals(lines, ["alpha.example ssh-ed25519 AAAAED"]);
  assertEquals((await run(p, ["trust-host", "nope"], world())).code, 1);
  // the fingerprint is for a person only, the action for the local channel only, and no flag accepts a key
  const placed = (await import("../src/logical/mod.ts")).placedCommands(p.children)[0];
  assertEquals(placed?.facts.humanOnly, ["fingerprint"]);
  assertEquals([placed?.reach?.channels, placed?.reach?.confirmation], [["local"], "person"]);
  assertEquals(placed?.command.options["yes"], undefined);
  const noKey = trustHostCommand({ targets: [t], run: () => Promise.resolve(out(0, "")), append: () => undefined });
  const gone = await run(programOf({ name: "ops", summary: "Ops.", version: "1", children: [noKey] }), ["trust-host", "alpha"], world());
  assertEquals(gone.code, 1);
  assertStringIncludes(gone.err, "showed no host key");
  void outcomeOf;
});

proves(["0007-ssh-coverage FR-002", "0007-ssh-coverage FR-005"], "the scan gives fingerprints with ed25519 first, and a fingerprint that was not shown writes nothing", async () => {
  const t = T("alpha", { port: 2222 });
  const calls: (readonly string[])[] = [];
  const inputs: (string | undefined)[] = [];
  const scanned = await scanHost(t, scanRun(calls, inputs));
  assert(isOk(scanned));
  assertEquals(calls[0], ["ssh-keyscan", "-T", "8", "-p", "2222", "--", "alpha.example"]);
  assertEquals(calls[1], FINGERPRINT_ARGV);
  if (!isOk(scanned)) return;
  assertEquals(scanned.value.map((k) => k.fingerprint), ["SHA256:edFP", "SHA256:rsaFP"]);
  const written: string[] = [];
  assert(isErr(await acceptHostKey(t, scanned.value, "SHA256:other", (l) => void written.push(l))));
  assertEquals(written, []);
});

proves(["0007-ssh-coverage FR-003"], "scp copies with the options of the family, -P, --, every word its own argument, a local path that could be a host made relative, an IPv6 address in brackets, and a remote path a shell could expand refused", async () => {
  const t = T("alpha", { user: "ops", port: 2222, credential: "probe" });
  const put = scpArgv(t, [t], BASE, { kind: "put", files: ["a.txt", "-rf", "x:y", "/abs/b.txt"], remoteDir: "/srv/in" });
  assert(isOk(put));
  if (isOk(put)) {
    assertEquals(put.value.slice(0, 2), ["scp", "-q"]);
    for (const want of ["BatchMode=yes", "StrictHostKeyChecking=yes", "IdentitiesOnly=yes", "/keys/probe"]) assert(put.value.includes(want), want);
    assertEquals(put.value.slice(put.value.indexOf("-P"), put.value.indexOf("-P") + 2), ["-P", "2222"]);
    assertEquals(put.value.slice(put.value.indexOf("--")), ["--", "a.txt", "./-rf", "./x:y", "/abs/b.txt", "ops@alpha.example:/srv/in/"]);
  }
  const get = scpArgv(T("v6", { address: "fe80::1" }), [], BASE, { kind: "get", remote: "/etc/hostname", local: "out.txt" });
  assert(isOk(get) && get.value.slice(-3).join(" ") === "-- [fe80::1]:/etc/hostname out.txt");
  for (const bad of ["/srv/in dir", "/srv/$HOME", "/srv/`id`", "/srv/a;b", "/srv/*", "../up", "/a/../b", "-oProxyCommand=x", "~/x", "", "/a\\b", "/a'b"]) {
    assertEquals(safeRemotePath(bad), false, JSON.stringify(bad));
    assert(isErr(scpArgv(t, [t], BASE, { kind: "put", files: ["a"], remoteDir: bad })), bad);
  }
  assert(isErr(scpArgv(t, [t], BASE, { kind: "put", files: [], remoteDir: "/srv" })));
  assert(isErr(scpArgv(t, [t], BASE, { kind: "put", files: ["a\u0000b"], remoteDir: "/srv" })));
  assert(isErr(scpArgv(t, [t], { ...BASE, family: "interactive", pty: true }, { kind: "put", files: ["a"], remoteDir: "/srv" })));
  assertEquals([localForScp("a"), localForScp("-a"), localForScp("a:b"), localForScp("/a:b"), localForScp("C:\\x"), localForScp("./a:b")], ["a", "./-a", "./a:b", "/a:b", "C:\\x", "./a:b"]);
  // through the executor, a path that is refused is an exit of 255 and scp is not run
  const calls: (readonly string[])[] = [];
  const ex = sshExecutor(t, [t], BASE, (argv) => (calls.push(argv), Promise.resolve(out(0))));
  assertEquals((await ex.put?.(["a"], "/srv/in"))?.code, 0);
  assertEquals((await ex.get?.("/etc/x", "x"))?.code, 0);
  const refused = await ex.put?.(["a"], "/srv/a b");
  assertEquals(refused?.code, 255);
  assertStringIncludes(textOf(refused?.stderr ?? new Uint8Array()), "not a remote path");
  assertEquals(calls.length, 2);
  fc.assert(
    fc.property(fc.string(), (p) => {
      const r = scpArgv(t, [t], BASE, { kind: "get", remote: p, local: "l" });
      if (isOk(r)) assert(safeRemotePath(p) && !/[\s$`;&|<>(){}*?~\\'"!#]/.test(p));
    }),
  );
});

proves(["0007-ssh-coverage FR-003"], "the local executor copies files with the system's file functions and gives a failure as an exit", async () => {
  await fs.withTempDir(async (dir) => {
    const src = path.join(dir, "a.txt");
    await fs.writeTextFile(src, "hello");
    const ex = localExecutor();
    assertEquals((await ex.put?.([src], path.join(dir, "in", "deep")))?.code, 0);
    assertEquals(await fs.readTextFile(path.join(dir, "in", "deep", "a.txt")), "hello");
    assertEquals((await ex.get?.(src, path.join(dir, "copy.txt")))?.code, 0);
    assertEquals(await fs.readTextFile(path.join(dir, "copy.txt")), "hello");
    const missing = await ex.get?.(path.join(dir, "none"), path.join(dir, "x"));
    assertEquals(missing?.code, 1);
    assert(textOf(missing?.stderr ?? new Uint8Array()).length > 0);
  });
});

async function readAll(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (stream === null) return "";
  const dec = new TextDecoder();
  let text = "";
  for await (const chunk of stream) text += dec.decode(chunk, { stream: true });
  return text;
}

proves(["0007-ssh-coverage FR-004"], "a session is a spawned client with piped streams: the quoted command reaches it, lines written come back, and it ends with its status when the input closes", async () => {
  if (process.platform === "win32") return; // the stand-in is an executable script
  chmodSync(FAKE, 0o755);
  const t = T("alpha", { user: "ops" });
  const ex = sshExecutor(t, [t], { ...BASE, program: FAKE });
  assert(ex.spawn !== undefined);
  const session = ex.spawn?.(["ops", "mcp", "it's"]);
  assert(session?.stdin !== null && session?.stdout !== null);
  if (session === undefined || session.stdin === null || session.stdout === null) return;
  const writer = session.stdin.getWriter();
  const reader = session.stdout.getReader();
  const dec = new TextDecoder();
  let seen = "";
  const nextLine = async (): Promise<string> => {
    while (!seen.includes("\n")) {
      const { value, done } = await reader.read();
      if (done) break;
      seen += dec.decode(value, { stream: true });
    }
    const i = seen.indexOf("\n");
    const line = seen.slice(0, i);
    seen = seen.slice(i + 1);
    return line;
  };
  const first = JSON.parse(await nextLine()) as { options: string[]; after: string[] };
  assertEquals(first.after, ["ops@alpha.example", `ops mcp 'it'\\''s'`]);
  assert(first.options.includes("-T") && first.options.includes("BatchMode=yes"));
  await writer.write(enc('{"jsonrpc":"2.0","id":1}\n'));
  assertEquals(await nextLine(), '{"JSONRPC":"2.0","ID":1}');
  await writer.write(enc("second\n"));
  assertEquals(await nextLine(), "SECOND");
  await writer.close();
  const status = await session.status;
  assertEquals([status.code, status.success], [0, true]);
  // exec does not stream: it gives its output when the program has ended
  const done = await ex.exec(["ops", "run", "--json", "status"]);
  assertEquals(done.code, 0);
  assertStringIncludes(textOf(done.stdout), '"after"');
  // a session that cannot be made is an error thrown
  let threw = false;
  try {
    ex.spawn?.(["a\u0000b"]);
  } catch {
    threw = true;
  }
  assert(threw);
  assert(localExecutor().spawn !== undefined);
  const local = localExecutor().spawn?.([process.execPath, "-e", "process.stdin.on('data', (d) => process.stdout.write(String(d).toUpperCase())).on('end', () => process.exit(3))"]);
  if (local?.stdin === null || local?.stdin === undefined || local.stdout === null) return;
  const w = local.stdin.getWriter();
  await w.write(enc("abc"));
  await w.close();
  assertEquals(await readAll(local.stdout), "ABC");
  assertEquals((await local.status).code, 3);
  void proc;
});

const KEYSCAN = ["# alpha.example:22 SSH-2.0-OpenSSH_9.6", "alpha.example ssh-rsa AAAARSA", "alpha.example ecdsa-sha2-nistp256 AAAAECDSA", "alpha.example ssh-ed25519 AAAAED", "alpha.example ssh-ed25519 AAAAED", "not a key", "", "alpha.example ssh-ed25519 AAAAED2 trailing comment"].join("\n");

proves(["0007-ssh-coverage FR-005"], "the key tools have typed argument vectors, and what they write is parsed: keys deduplicated with ed25519 first, fingerprints with size, comment and type", () => {
  const t = T("alpha");
  const p = T("beta", { port: 2222 });
  assertEquals(scanArgv(t), ["ssh-keyscan", "-T", "8", "--", "alpha.example"]);
  assertEquals(scanArgv(p), ["ssh-keyscan", "-T", "8", "-p", "2222", "--", "beta.example"]);
  assertEquals(parseScan(KEYSCAN).map((k) => k.type + ":" + k.key), ["ssh-ed25519:AAAAED", "ssh-ed25519:AAAAED2", "ecdsa-sha2-nistp256:AAAAECDSA", "ssh-rsa:AAAARSA"]);
  assertEquals(parseScan("").length + parseScan("# only a comment\n").length, 0);
  assertEquals(parseFingerprint("256 SHA256:abc+/= alpha comment (ED25519)\n"), { bits: 256, fingerprint: "SHA256:abc+/=", comment: "alpha comment", type: "ED25519" });
  assertEquals(parseFingerprint("3072 SHA256:xyz  (RSA)"), { bits: 3072, fingerprint: "SHA256:xyz", comment: "", type: "RSA" });
  assertEquals(parseFingerprint("nothing here"), undefined);
  assertEquals(FINGERPRINT_ARGV, ["ssh-keygen", "-l", "-f", "-"]);
  assertEquals(publicKeyArgv("/keys/probe"), ["ssh-keygen", "-y", "-f", "/keys/probe"]);
  assertEquals(removeHostArgv(t, "/repo/known_hosts"), ["ssh-keygen", "-R", "alpha.example", "-f", "/repo/known_hosts"]);
  assertEquals(removeHostArgv(p, "/repo/known_hosts"), ["ssh-keygen", "-R", "[beta.example]:2222", "-f", "/repo/known_hosts"]);
  assertEquals(findPrincipalsArgv("/repo/allowed_signers", "/tmp/sig"), ["ssh-keygen", "-Y", "find-principals", "-s", "/tmp/sig", "-f", "/repo/allowed_signers"]);
  assertEquals(keygenArgv({ type: "ed25519", comment: "stolos-probe@fleet", file: "/tmp/k" }), ["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "stolos-probe@fleet", "-f", "/tmp/k"]);
  assertEquals(keygenArgv({ type: "rsa", comment: "root@h", file: "/tmp/k" }).slice(2, 6), ["-t", "rsa", "-b", "3072"]);
  assertEquals(knownHostName(t) + " " + knownHostName(T("g", { port: 22 })) + " " + knownHostName(p), "alpha.example g.example [beta.example]:2222");
  assertEquals(pinnedKnownHosts(p, parseScan(KEYSCAN).slice(0, 2)), "[beta.example]:2222 ssh-ed25519 AAAAED\n[beta.example]:2222 ssh-ed25519 AAAAED2\n");
  assertEquals(pinnedKnownHosts(t, []), "");
  fc.assert(
    fc.property(fc.string(), (text) => {
      const keys = parseScan(text);
      assertEquals(new Set(keys.map((k) => k.line)).size, keys.length);
    }),
  );
});

proves(["0007-ssh-coverage FR-006"], "the known hosts are two files in one option, the repository's first and the user's after, one file in the pinned family, and a path with a space is refused", () => {
  const t = T("alpha");
  const opt = (config: SshConfig) => argvOf(sshArgv(t, [t], config, "x")).find((a) => a.startsWith("UserKnownHostsFile="));
  assertEquals(opt(BASE), "UserKnownHostsFile=/repo/known_hosts.auto /home/a/.ssh/known_hosts");
  assertEquals(opt({ ...BASE, family: "pinned" }), "UserKnownHostsFile=/repo/known_hosts.auto");
  assert(isErr(sshArgv(t, [t], { ...BASE, knownHostsUser: "/home/a b/.ssh/known_hosts" }, "x")));
  assert(isErr(sshArgv(t, [t], { ...BASE, family: "pinned", knownHostsRepository: "/tmp/a b" }, "x")));
});

proves(["0007-ssh-coverage FR-007"], "every way stolos calls ssh, in a table, is built, with the options its shape needs and never accept-new", async () => {
  const alpha = T("alpha", { user: "admin" });
  const pinnedHost = T("pin", { user: "ops", port: 2222, address: "10.0.0.7", credential: "probe" });
  const shapes: readonly { shape: string; argv: readonly string[]; has: readonly string[]; lacks: readonly string[] }[] = [
    { shape: "a credential pushed by stdin to a server, with a prompt allowed", argv: argvOf(sshArgv(alpha, [], { ...BASE, family: "interactive", connectTimeoutSec: 10 }, "archon web credential")), has: ["ConnectTimeout=10", "admin@alpha.example", "archon web credential"], lacks: ["BatchMode=yes"] },
    { shape: "a one-shot read in batch", argv: argvOf(sshArgv(alpha, [], BASE, "archon data --json")), has: ["BatchMode=yes", "ConnectTimeout=10", "archon data --json"], lacks: ["-t"] },
    { shape: "a command with a tight time out and the two known-hosts files", argv: argvOf(sshArgv(alpha, [], { ...BASE, connectTimeoutSec: 8 }, "x")), has: ["ConnectTimeout=8", "UserKnownHostsFile=/repo/known_hosts.auto /home/a/.ssh/known_hosts", "ServerAliveInterval=15"], lacks: [] },
    { shape: "a script as sh -s", argv: argvOf(sshArgv(alpha, [], BASE, "sh -s")), has: ["sh -s"], lacks: [] },
    { shape: "a pinned host with its own keys, a port and a probe key", argv: argvOf(sshArgv(pinnedHost, [], { ...BASE, family: "pinned", knownHostsRepository: "/tmp/pinned" }, "request")), has: ["UserKnownHostsFile=/tmp/pinned", "StrictHostKeyChecking=yes", "-p", "2222", "IdentitiesOnly=yes", "/keys/probe", "ops@10.0.0.7"], lacks: ["/home/a/.ssh/known_hosts"] },
    { shape: "a session for MCP with a longer keep-alive", argv: argvOf(sshArgv(alpha, [], { ...BASE, serverAliveSec: 30 }, "archon mcp")), has: ["-T", "ServerAliveInterval=30", "archon mcp"], lacks: [] },
  ];
  for (const s of shapes) {
    for (const h of s.has) assert(s.argv.includes(h), `${s.shape}: ${h} in ${s.argv.join(" ")}`);
    for (const l of s.lacks) assert(!s.argv.includes(l), `${s.shape}: no ${l}`);
    assert(!s.argv.join(" ").match(/accept-new|StrictHostKeyChecking=no/), s.shape);
  }
  const copy = scpArgv(alpha, [], BASE, { kind: "put", files: ["a", "b"], remoteDir: "/root/bootstrap" });
  assert(isOk(copy) && copy.value.includes("admin@alpha.example:/root/bootstrap/"));
  assertEquals(scanArgv(alpha)[0], "ssh-keyscan");
  assertEquals(FINGERPRINT_ARGV[1], "-l");
  const { sshArgumentFindings } = await import("../src/targets/ssh/ban.ts");
  const sources = [{ path: "x.ts", text: 'run(["ssh", "-o", "StrictHostKeyChecking=accept-new", host]);' }];
  assertEquals(sshArgumentFindings(sources).length, 1, "a consumer that writes accept-new by hand is found by the ban");
});
