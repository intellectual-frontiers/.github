/**
 * Tests of the protocol and of the ban on hand-built ssh arguments (commons anyfs-ssh 0002-anyfs-ssh-helper FR-003, FR-004; 0001-anyfs-ssh-layers FR-003): the argument vector of a call, each exit
 * status of the helper as one answer, the lines the helper writes read back, and no source of the library builds an ssh command line of its own.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { sshArgumentFindings } from "@intellectual-frontiers/headless/targets/ssh";
import { fs, path } from "@intellectual-frontiers/system";
import { helperOf, POSIX } from "../src/dialect.ts";
import { callOf, factsOf, hostFactsOf, replyOf, writtenOf } from "../src/protocol.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const enc = (t: string): Uint8Array => new TextEncoder().encode(t);
const out = (code: number, stdout = "", stderr = "", signal: string | null = null) => ({ code, success: code === 0, signal, stdout: enc(stdout), stderr: enc(stderr) });
import { type Revision } from "@intellectual-frontiers/anyfs/governance";
const REV = `sha256:${"a".repeat(64)}` as Revision;

proves(["0002-anyfs-ssh-helper FR-003"], "a call is one vector: the kept script and the command, or the carried script as the argument of sh -c", () => {
  const helper = helperOf(POSIX);
  assertEquals(callOf(helper, { kind: "installed", path: "/h/x.sh" }, "read", "/srv", ["a b", "0"]), ["sh", "/h/x.sh", "read", "/srv", "a b", "0"]);
  const carried = callOf(helper, { kind: "carried" }, "stat", "/srv", ["a"]);
  assertEquals([carried[0], carried[1], carried[3], carried[4], carried[5], carried[6]], ["sh", "-c", "anyfs-helper", "stat", "/srv", "a"]);
  assertEquals(carried[2], helper.text);
});

proves(["0002-anyfs-ssh-helper FR-004"], "each exit status of the helper is one answer of a closed union", () => {
  assertEquals(replyOf(out(0, "x")).kind, "done");
  assertEquals(replyOf(out(10)).kind, "missing");
  assertEquals(replyOf(out(11, "found absent\n")), { kind: "conflict", found: { kind: "absent" }, at: "path" });
  assertEquals(replyOf(out(11, `found ${REV} at to\n`)), { kind: "conflict", found: { kind: "rev", rev: REV }, at: "to" });
  assertEquals(replyOf(out(11, "found nonsense\n")).kind, "failed");
  assertEquals(replyOf(out(12, "outside\n")), { kind: "refused", reason: "outside" });
  assertEquals(replyOf(out(13)).kind, "locked");
  assertEquals(replyOf(out(14)).kind, "too-large");
  assertEquals(replyOf(out(21)).kind, "no-hash");
  assertEquals(replyOf(out(22)).kind, "no-root");
  assertEquals(replyOf(out(30, "hash abc\n")), { kind: "bad-hash", got: "abc" });
  assertEquals(replyOf(out(255, "", "refused\n")).kind, "lost");
  assertEquals(replyOf(out(143, "", "", "SIGTERM")).kind, "lost");
  assertEquals(replyOf(out(127)).kind, "failed");
  assertEquals(replyOf(out(1, "", "boom")).kind, "failed");
});

proves(["0002-anyfs-ssh-helper FR-004"], "the lines of the helper are read back, and a line that is not one is a sentence", () => {
  assertEquals(writtenOf(enc(`created ${REV}\n`)), { kind: "ok", value: { rev: REV, created: true } });
  assertEquals(writtenOf(enc(`updated ${REV}`)).kind, "ok");
  assertEquals(writtenOf(enc("done\n")).kind, "err");
  const f = factsOf(["12", "1795260566", "a".repeat(64)]);
  assertEquals(f.kind === "ok" ? [f.value.size, f.value.rev, f.value.modified] : f, [12, REV, "2026-11-21T11:29:26.000Z"]);
  assertEquals(factsOf(["x", "1", "a".repeat(64)]).kind, "err");
  const noTime = factsOf(["1", "-", "a".repeat(64)]);
  assert(noTime.kind === "ok" && noTime.value.modified === undefined);
  const host = hostFactsOf(enc("protocol=1\ndialect=posix\nhash=sha256sum\nstat=gnu\ncase=insensitive\n"));
  assertEquals(host.kind === "ok" ? [host.value.hash, host.value.caseSensitive] : host, ["sha256sum", false]);
  assertEquals(hostFactsOf(enc("protocol=2\ndialect=posix\nhash=none\nstat=none\n")).kind, "err");
  assertEquals(hostFactsOf(enc("protocol=1\ndialect=powershell\nhash=none\nstat=none\n")).kind, "err");
});

proves(["0001-anyfs-ssh-layers FR-003"], "no source of the library builds an ssh command line of its own", async () => {
  const files: { path: string; text: string }[] = [];
  for (const dir of ["src", "tools"]) {
    for await (const e of fs.readDir(path.join(ROOT, dir))) {
      if (e.isFile && e.name.endsWith(".ts")) files.push({ path: `${dir}/${e.name}`, text: await fs.readTextFile(path.join(ROOT, dir, e.name)) });
    }
  }
  assert(files.length >= 4);
  assertEquals(sshArgumentFindings(files), []);
});

proves(["0002-anyfs-ssh-helper FR-002"], "the posix dialect has its helper, its shell and its hash, and the match on a dialect states every case", async () => {
  const helper = helperOf(POSIX);
  assertEquals([helper.dialect, helper.shell, helper.sha256.length], [POSIX, "sh", 64]);
  const source = await fs.readTextFile(path.join(ROOT, "src/dialect.ts"));
  assert(source.includes("absurd(dialect.kind)"), "the match ends in the exhaustive case");
});
