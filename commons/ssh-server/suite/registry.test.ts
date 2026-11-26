/**
 * Tests of the grammar of a command and of the registry: the table of commands, a command added by a test with no change to the core, and a seeded loop of random command lines.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { err, ok } from "@intellectual-frontiers/core";
import { serverPolicy, wordsOf } from "../src/governance/mod.ts";
import type { SessionId } from "../src/governance/mod.ts";
import { BUILTIN, CONVERSATIONS, builtinRegistry, commandOf, defineCommand, makeRegistry, runCommand } from "../src/logical/mod.ts";
import type { CommandContext } from "../src/logical/mod.ts";
import { seeded } from "./governance.test.ts";
import { TEST_IDENTITY } from "./helpers.ts";

const registry = builtinRegistry();
const ctx = (over: Partial<CommandContext> = {}): CommandContext => ({
  now: 1000,
  policy: serverPolicy(TEST_IDENTITY),
  enroll: { rules: [] },
  registry,
  pins: [],
  account: "s-enroll",
  sourceIp: "10.0.0.2",
  clientIdent: "SSH-2.0-OpenSSH_9.6",
  keys: [],
  assets: [],
  stdin: "",
  crypto: { sha256Hex: (t) => createHash("sha256").update(t).digest("hex"), randomHex: (n) => "ab".repeat(n), fingerprintOfLine: () => undefined },
  controllerHostKey: "ssh-ed25519 AAAA",
  newId: () => "en-aaaaaaaaaaaaaaaa" as SessionId,
  planFor: () => ({ steps: [] }),
  ...over,
});

proves(["0002-enrollment-protocol FR-001"], "a command is words of a small alphabet at single spaces: no shell syntax, no free text, no oversize", () => {
  assertEquals(wordsOf("report en-aaaaaaaaaaaaaaaa").kind, "ok");
  for (const bad of ["", " ", "hello ", " hello", "hello  x", "a;b", "a|b", "a&b", "a$b", "a`b`", "a'b", 'a"b', "a\\b", "a\nb", "a\tb", "a*", "a?", "a<b", "a>b", "a(b)", "a{b}", "a#b", "a~b", "a!b", "a/b", "é", "a".repeat(97), `hello ${"a".repeat(260)}`]) assertEquals(wordsOf(bad).kind, "err", JSON.stringify(bad));
  assertEquals(wordsOf(7).kind, "err");
});

proves(["0002-enrollment-protocol FR-003", "0002-enrollment-protocol FR-013"], "the registry holds the built-in commands, each with its account, and refuses an unknown one", () => {
  assertEquals([...registry.keys()].sort(), ["bootstrap", "bootstrap-ps", "checkin", "done", "hello", "join", "knock", "leave", "next", "pair-commit", "pair-reveal", "rekey", "rekey-confirm", "report", "revoke", "status", "tether"]);
  assertEquals(registry.get("checkin")?.account, "s-device");
  assertEquals(registry.get("bootstrap")?.account, "s-enroll");
  assertEquals(registry.get("tether")?.reserved, true);
  assertEquals(commandOf(registry, "format c").kind, "err");
  assertEquals(commandOf(registry, "report").kind, "err");
  assertEquals(commandOf(registry, "report nope").kind, "err");
  assertEquals(commandOf(registry, "next en-aaaaaaaaaaaaaaaa extra").kind, "err");
  assertEquals(commandOf(registry, "join maple-river-4821 ps").kind, "ok");
  assertEquals(commandOf(registry, "join maple-river-4821 ruby").kind, "err");
  assertEquals(commandOf(registry, "hello token=tok-abcdefgh-abcdefghijklmnopqrstuvwx").kind, "err", "hello takes no token");
  assertEquals(commandOf(registry, "bootstrap token=tok-abcdefgh-abcdefghijklmnopqrstuvwx").kind, "ok");
  assertEquals(commandOf(registry, "bootstrap token=short").kind, "err");
  const hello = commandOf(registry, "hello");
  assert(hello.kind === "ok");
  const r = runCommand(registry, hello.value, ctx());
  assert(r.kind === "ok" && r.value.reply.stdout.includes("hello"), "hello answers");
  assert(r.kind === "ok" && !r.value.reply.stdout.includes("checkin"), "hello lists the commands of the account only");
  const tether = commandOf(registry, "tether");
  assert(tether.kind === "ok");
  assertEquals(runCommand(registry, tether.value, ctx({ account: "s-device" })).kind, "err");
  const checkin = commandOf(registry, "checkin");
  assert(checkin.kind === "ok");
  assertEquals(runCommand(registry, checkin.value, ctx()).kind, "err", "checkin is not run by s-enroll");
  assertEquals(runCommand(registry, checkin.value, ctx({ account: "s-device" })).kind, "err", "checkin needs an enrolled key");
  for (const d of BUILTIN) assert(CONVERSATIONS.some((c) => c.id === d.conversation), `${d.name} names a conversation of the table`);
});

proves(["0002-enrollment-protocol FR-002", "0002-enrollment-protocol FR-016"], "a command is added by a definition, with no change to the core, and a duplicate or a bad name is refused", () => {
  const ping = defineCommand<{ readonly n: number }>({
    name: "ping",
    summary: "a command that a test adds",
    account: "s-enroll",
    conversation: "enroll",
    auth: "none",
    effects: [],
    audit: "hello",
    decode: (w) => (w.length === 1 && /^[0-9]{1,3}$/.test(w[0] as string) ? ok({ n: Number(w[0]) }) : err("takes one number")),
    run: (_c, a) => ok({ reply: { stdout: `pong ${a.n}\n`, stderr: "", exit: 0 }, effects: [] }),
  });
  const r = makeRegistry([...BUILTIN, ping]);
  assert(r.kind === "ok");
  const cmd = commandOf(r.value, "ping 7");
  assert(cmd.kind === "ok");
  const out = runCommand(r.value, cmd.value, ctx({ registry: r.value }));
  assert(out.kind === "ok" && out.value.reply.stdout === "pong 7\n");
  assertEquals(commandOf(r.value, "ping x").kind, "err");
  assertEquals(commandOf(registry, "ping 7").kind, "err", "the closed registry does not have it");
  assertEquals(makeRegistry([ping, ping]).kind, "err");
  assertEquals(makeRegistry([defineCommand({ ...{ name: "bad name", summary: "", account: "s-enroll", conversation: "enroll", auth: "none", effects: [], audit: "hello", decode: () => ok({}), run: () => err("x") } })]).kind, "err");
});

proves(["0002-enrollment-protocol FR-001", "0002-enrollment-protocol FR-002"], "a seeded loop of random and mutated command lines never throws, and every line that is accepted is of the alphabet", () => {
  const rnd = seeded(7);
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._:=- ;|&$`'\"\\\n\t*?<>(){}#~!/é💥%";
  const seeds = ["hello", "status en-abcdefghijklmnop", "report en-abcdefghijklmnop", "join maple-river-4821 sh", "bootstrap token=tok-abcdefgh-abcdefghijklmnopqrstuvwx", "knock", "checkin"];
  let accepted = 0;
  for (let i = 0; i < 5000; i++) {
    let line = seeds[Math.floor(rnd() * seeds.length)] as string;
    for (let k = Math.floor(rnd() * 4); k > 0; k--) {
      const at = Math.floor(rnd() * (line.length + 1));
      const c = alphabet[Math.floor(rnd() * alphabet.length)] ?? "";
      line = rnd() < 0.5 ? line.slice(0, at) + c + line.slice(at) : line.slice(0, at) + line.slice(at + 1);
    }
    if (rnd() < 0.05) line += " ".repeat(Math.floor(rnd() * 3)) + "x".repeat(Math.floor(rnd() * 400));
    const r = commandOf(registry, line);
    if (r.kind === "ok") {
      accepted += 1;
      assert(/^[A-Za-z0-9._:= -]+$/.test(line) && line.length <= 256, `accepted: ${JSON.stringify(line)}`);
      assert(!line.includes("  "), line);
    }
  }
  assert(accepted > 100, `some lines were accepted (${accepted})`);
});
