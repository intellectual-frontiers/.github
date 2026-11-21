/**
 * Tests of change control (commons change-control 0002-change-control-policy, 0003-change-control-git): the policy refused with every reason, the `allowed_signers` text, a signed change accepted, an unsigned one and one signed by a stranger refused, a change to a controlled path blocked until a different signer of an approving
 * role approves it, and, on a real repository with real SSH keys and Git's own verification, the same verdicts, the repository left as it was. Every name is made up.
 *
 * @module
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { allowedSigners, judgeRange, matches, parsePolicy, type Commit } from "../src/logical/mod.ts";
import { readCommits } from "../src/physical/mod.ts";

const KEY = (n: string) => `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${n.padEnd(43, "A")}`;
const POLICY = { signers: [{ name: "daily", role: "daily", key: KEY("D") }, { name: "recovery", role: "recovery", key: KEY("R") }], controlled: [{ path: "fleets/*/signers.ts", approvers: ["recovery"] }, { path: "deploy/**", approvers: ["recovery"] }] };

proves(["0002-change-control-policy FR-001", "0002-change-control-policy FR-002"], "a policy is refused with every reason and accepted otherwise, a private key is never a signer's key, and the allowed signers text has a line for each signer", () => {
  const bad = parsePolicy({ signers: [{ name: "Daily!", role: "daily", key: "not a key" }, { name: "x", role: "r", key: "-----BEGIN OPENSSH PRIVATE KEY-----" }], controlled: [{ path: "/etc/x", approvers: ["daily"] }, { path: "a", approvers: ["nobody"] }, { path: "b", approvers: [] }] });
  assert(bad.kind === "err");
  assert(bad.error.length >= 6, bad.error.join("\n"));
  assertEquals(parsePolicy({ signers: [] }).kind, "err");
  assert(parsePolicy({ signers: [{ name: "a", role: "r", key: KEY("A") }, { name: "a", role: "r", key: KEY("B") }] }).kind === "err", "a signer is named once");
  const ok = parsePolicy(POLICY);
  assert(ok.kind === "ok");
  assertEquals(allowedSigners(ok.value.signers), `daily namespaces="git" ${KEY("D")}\nrecovery namespaces="git" ${KEY("R")}\n`);
  assert(matches("fleets/*/signers.ts", "fleets/fcr/signers.ts") && !matches("fleets/*/signers.ts", "fleets/a/b/signers.ts") && matches("deploy/**", "deploy/a/b.yml") && !matches("deploy/**", "other/deploy/a"));
});

const commit = (sha: string, signature: Commit["signature"], signer: string, files: readonly string[], body = ""): Commit => ({ sha, author: "x", subject: `change ${sha.slice(0, 4)}`, body, files, signature, signer });

proves(["0002-change-control-policy FR-003", "0002-change-control-policy FR-004"], "a signed change is accepted, an unsigned one, a stranger's and a bad one are refused with the reason, a controlled change is blocked until a different signer of an approving role approves it, and no other kind of approval counts", () => {
  const policy = parsePolicy(POLICY);
  assert(policy.kind === "ok");
  const a = "a".repeat(40), b = "b".repeat(40), c = "c".repeat(40), d = "d".repeat(40), e = "e".repeat(40), f = "f".repeat(40);
  const j = judgeRange([commit(a, "G", "daily", ["README.md"]), commit(b, "N", "", ["README.md"]), commit(c, "U", "", ["x"]), commit(d, "B", "", ["x"]), commit(e, "G", "stranger", ["x"])], policy.value);
  assertEquals(j.verdicts.map((v) => v.state), ["accepted", "refused", "refused", "refused", "refused"]);
  assert(j.verdicts[1]?.reasons[0] === "it is not signed" && j.verdicts[2]?.reasons[0]?.includes("not a signer of the fleet") === true && j.verdicts[3]?.reasons[0] === "its signature is bad" && j.verdicts[4]?.reasons[0]?.includes("stranger") === true);
  assertEquals(j.ok, false);
  const blocked = judgeRange([commit(a, "G", "daily", ["fleets/fcr/signers.ts", "README.md"])], policy.value);
  assertEquals(blocked.verdicts[0]?.state, "blocked");
  assert(blocked.verdicts[0]?.reasons[0]?.includes("fleets/fcr/signers.ts") === true && blocked.verdicts[0]?.reasons[0]?.includes("recovery") === true);
  const approved = judgeRange([commit(a, "G", "daily", ["fleets/fcr/signers.ts"]), commit(b, "G", "recovery", ["NOTES.md"], `Adds a signer.\n\nApproves: ${a.slice(0, 12)}`)], policy.value);
  assertEquals(approved.verdicts.map((v) => v.state), ["accepted", "accepted"]);
  assertEquals(approved.verdicts[0]?.approvedBy, "recovery");
  assertEquals(approved.ok, true);
  for (const [name, range] of [
    ["by the same signer", [commit(a, "G", "recovery", ["fleets/fcr/signers.ts"]), commit(b, "G", "recovery", ["x"], `Approves: ${a.slice(0, 12)}`)]],
    ["by a signer of another role", [commit(a, "G", "recovery", ["deploy/x"]), commit(b, "G", "daily", ["x"], `Approves: ${a.slice(0, 12)}`)]],
    ["before the commit", [commit(b, "G", "recovery", ["x"], `Approves: ${a.slice(0, 12)}`), commit(a, "G", "daily", ["deploy/x"])]],
    ["that is not signed", [commit(a, "G", "daily", ["deploy/x"]), commit(b, "N", "", ["x"], `Approves: ${a.slice(0, 12)}`)]],
    ["of another commit", [commit(a, "G", "daily", ["deploy/x"]), commit(b, "G", "recovery", ["x"], `Approves: ${f.slice(0, 12)}`)]],
    ["too short", [commit(a, "G", "daily", ["deploy/x"]), commit(b, "G", "recovery", ["x"], "Approves: aaaa")]],
  ] as const) assertEquals(judgeRange(range, policy.value).verdicts.find((v) => v.sha === a)?.state, "blocked", name);
  void c; void d; void e;
});

const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.test", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.test" };
const git = (dir: string, ...args: string[]): string => execFileSync("git", ["-C", dir, ...args], { env: ENV, encoding: "utf8" }).trim();
const keygen = (dir: string, name: string): { file: string; pub: string } => {
  const file = join(dir, name);
  execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", name, "-f", file]);
  return { file, pub: readFileSync(`${file}.pub`, "utf8").trim() };
};

const haveTools = spawnSync("ssh-keygen", ["-?"]).error === undefined && spawnSync("git", ["--version"]).error === undefined;

proves(["0003-change-control-git FR-001", "0003-change-control-git FR-002", "0002-change-control-policy FR-003", "0002-change-control-policy FR-004"], "on a real repository with real SSH keys, Git's own verification gives the verdicts: a change signed by a signer is accepted, unsigned and a stranger's refused, a change to a controlled path blocked until the recovery signer approves it, and the repository is left as it was", async (t) => {
  if (!haveTools) return t.skip("git and ssh-keygen are not on this machine");
  const dir = mkdtempSync(join(tmpdir(), "change-control-"));
  try {
    const daily = keygen(dir, "daily"), recovery = keygen(dir, "recovery"), stranger = keygen(dir, "stranger");
    const repo = join(dir, "repo");
    mkdirSync(join(repo, "fleets", "f"), { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    const signed = (key: { file: string } | undefined, message: string): void => {
      const args = key === undefined ? ["-c", "commit.gpgsign=false"] : ["-c", "gpg.format=ssh", "-c", `user.signingkey=${key.file}`, "-c", "commit.gpgsign=true"];
      git(repo, "add", "-A");
      git(repo, ...args, "commit", "-q", "-m", message);
    };
    writeFileSync(join(repo, "README.md"), "one\n");
    signed(daily, "a signed change");
    const base = git(repo, "rev-parse", "HEAD");
    writeFileSync(join(repo, "README.md"), "two\n");
    signed(undefined, "an unsigned change");
    writeFileSync(join(repo, "README.md"), "three\n");
    signed(stranger, "a stranger's change");
    writeFileSync(join(repo, "fleets", "f", "signers.ts"), "export const signers = [];\n");
    signed(daily, "a change to the signers");
    const target = git(repo, "rev-parse", "HEAD");
    writeFileSync(join(repo, "NOTES.md"), "approval\n");
    signed(recovery, `Approve the signers\n\nApproves: ${target.slice(0, 12)}`);
    const policy = parsePolicy({ signers: [{ name: "daily", role: "daily", key: daily.pub }, { name: "recovery", role: "recovery", key: recovery.pub }], controlled: [{ path: "fleets/*/signers.ts", approvers: ["recovery"] }] });
    assert(policy.kind === "ok");
    const head = git(repo, "rev-parse", "HEAD");
    const status = git(repo, "status", "--porcelain");
    const read = await readCommits(repo, base, "HEAD", allowedSigners(policy.value.signers));
    assert(read.kind === "ok", read.kind === "err" ? read.error : "");
    assertEquals(read.value.map((c) => [c.subject, c.signature, c.signer]), [["an unsigned change", "N", ""], ["a stranger's change", "U", ""], ["a change to the signers", "G", "daily"], ["Approve the signers", "G", "recovery"]]);
    assert(read.value[2]?.files.includes("fleets/f/signers.ts") === true);
    const j = judgeRange(read.value, policy.value);
    assertEquals(j.verdicts.map((v) => v.state), ["refused", "refused", "accepted", "accepted"]);
    assertEquals(j.verdicts[2]?.approvedBy, "recovery");
    const without = judgeRange(read.value.filter((c) => c.subject !== "Approve the signers"), policy.value);
    assertEquals(without.verdicts[2]?.state, "blocked");
    const all = await readCommits(repo, "", "HEAD", allowedSigners(policy.value.signers));
    assert(all.kind === "ok" && all.value.length === 5 && all.value[0]?.signature === "G");
    assertEquals(await readCommits(repo, "--exec=x", "HEAD", "").then((r) => r.kind), "err");
    assertEquals([git(repo, "rev-parse", "HEAD"), git(repo, "status", "--porcelain")], [head, status], "the repository is as it was");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
