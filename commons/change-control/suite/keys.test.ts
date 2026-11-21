/**
 * Tests of the custody of the signing keys (commons change-control 0004-change-control-keys): the checks with their codes and fixes from facts, the signers file, the recovery reminder, and, on real keys with real OpenSSH and Git (the passphrase given through the program OpenSSH is told to ask, never seen by the code under test), a key made and never overwritten,
 * Git set for one repository, a test signature that proves the key and refuses a wrong one, the hook installed once and never over another's, a signed commit that verifies, and the facts read with nothing changed. Every name is made up.
 *
 * @module
 */
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { allowedSigners, checkKeys, opensshSigns, opensshVersion, recoveryOverdue, renderSigners, replaceKey, signingWorks, withSigner, type Facts } from "../src/logical/mod.ts";
import { commitSigned, configureGit, HOOK_MARKER, installHook, makeKey, readCommits, readFacts, testSign } from "../src/physical/mod.ts";

const GOOD: Facts = { openssh: "9.6", daily: { exists: true, hasPassphrase: true, inAgent: false }, git: { signs: true, formatSsh: true, signingKeyIsDaily: true, identity: true }, signers: { dailyListed: true, recoveryListed: true }, recovery: { privateHere: false, checkedAt: "2026-10-01" }, hookInstalled: true };

proves(["0004-change-control-keys FR-001", "0004-change-control-keys FR-003"], "a machine that is set up has every check holding, and each fact that is wrong gives its code and one fix, signing working only where the checks that stop a commit hold, and the recovery key reminded after 183 days", () => {
  const all = checkKeys(GOOD, "2026-11-21");
  assertEquals(all.map((f) => f.code), ["E-KEY-SSH", "E-KEY-DAILY", "E-KEY-PASSPHRASE", "E-KEY-AGENT", "E-KEY-GIT", "E-KEY-IDENTITY", "E-KEY-LISTED", "E-KEY-RECOVERY-LISTED", "E-KEY-RECOVERY-HERE", "E-KEY-RECOVERY-OLD", "E-KEY-HOOK"]);
  assert(all.every((f) => f.ok) && signingWorks(all));
  const wrong = (patch: Partial<Facts>, code: string): void => {
    const found = checkKeys({ ...GOOD, ...patch }, "2026-11-21").filter((f) => !f.ok);
    assertEquals(found.map((f) => f.code), [code]);
    assert(found[0]?.fix !== "" && found[0]?.says !== "");
  };
  wrong({ openssh: "7.9" }, "E-KEY-SSH");
  wrong({ openssh: undefined }, "E-KEY-SSH");
  wrong({ daily: { exists: true, hasPassphrase: false, inAgent: false } }, "E-KEY-PASSPHRASE");
  wrong({ daily: { exists: true, hasPassphrase: true, inAgent: true } }, "E-KEY-AGENT");
  wrong({ git: { ...GOOD.git, signs: false } }, "E-KEY-GIT");
  wrong({ git: { ...GOOD.git, identity: false } }, "E-KEY-IDENTITY");
  wrong({ signers: { dailyListed: false, recoveryListed: true } }, "E-KEY-LISTED");
  wrong({ signers: { dailyListed: true, recoveryListed: false } }, "E-KEY-RECOVERY-LISTED");
  wrong({ recovery: { privateHere: true, checkedAt: "2026-10-01" } }, "E-KEY-RECOVERY-HERE");
  wrong({ recovery: { privateHere: false, checkedAt: "2026-01-01" } }, "E-KEY-RECOVERY-OLD");
  wrong({ recovery: { privateHere: false, checkedAt: undefined } }, "E-KEY-RECOVERY-OLD");
  wrong({ hookInstalled: false }, "E-KEY-HOOK");
  assertEquals(signingWorks(checkKeys({ ...GOOD, hookInstalled: false, recovery: { privateHere: true, checkedAt: undefined } }, "2026-11-21")), true, "the hook and the recovery key do not stop a commit");
  assertEquals(signingWorks(checkKeys({ ...GOOD, daily: { exists: false, hasPassphrase: false, inAgent: false } }, "2026-11-21")), false);
  assertEquals([recoveryOverdue("2026-10-01", "2026-11-21"), recoveryOverdue("2026-01-01", "2026-11-21"), recoveryOverdue(undefined, "2026-11-21"), recoveryOverdue("not a day", "2026-11-21")], [false, true, true, true]);
  assertEquals([opensshVersion("OpenSSH_9.6p1 Ubuntu-3, OpenSSL 3.0.13"), opensshVersion("nothing")], ["9.6", undefined]);
  assertEquals([opensshSigns("8.1"), opensshSigns("8.2"), opensshSigns("9.0")], [false, true, true]);
});

proves(["0004-change-control-keys FR-002"], "the signers file lists each signer, a key is replaced with the name and role kept, and a signer is added once", () => {
  const a = { name: "daily", role: "daily", key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOne a@x", added: "2026-11-14" };
  const b = { name: "recovery", role: "recovery", key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITwo b@x", added: "2026-11-14" };
  const text = renderSigners([a, b]);
  assert(text.startsWith("// ") && text.includes('"name": "daily"') && text.includes("] as const;"));
  const swapped = replaceKey([a, b], "daily", "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINew c@x", "2026-12-01");
  assertEquals(swapped?.map((x) => [x.name, x.retired ?? "", x.added ?? ""]).sort(), [["daily", "", "2026-12-01"], ["daily-retired-2026-12-01", "2026-12-01", "2026-11-14"], ["recovery", "", "2026-11-14"]].sort());
  assertEquals(swapped?.find((x) => x.name === "daily")?.role, "daily");
  assert(renderSigners(swapped ?? []).includes('"retired": "2026-12-01"'));
  assertEquals(replaceKey([a], "nobody", "k", "d"), undefined);
  assertEquals(withSigner([a], { ...a, name: "other", key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOne other@x" }), [a], "a key that is listed is not listed twice");
  assertEquals(withSigner([a], { name: "daily", role: "x", key: "ssh-ed25519 AAAAB different" }), "a signer is already named daily");
  assertEquals(withSigner([a], b), [a, b]);
});

const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_AUTHOR_NAME: "Ada", GIT_AUTHOR_EMAIL: "ada@example.test", GIT_COMMITTER_NAME: "Ada", GIT_COMMITTER_EMAIL: "ada@example.test" };
const git = (dir: string, ...args: string[]): string => execFileSync("git", ["-C", dir, ...args], { env: ENV, encoding: "utf8" }).trim();
const haveTools = spawnSync("ssh-keygen", ["-?"]).error === undefined && spawnSync("git", ["--version"]).error === undefined;

proves(["0004-change-control-keys FR-004", "0004-change-control-keys FR-005", "0004-change-control-keys FR-006"], "on real keys with real OpenSSH and Git: a key with a passphrase is made and never overwritten, Git is set for one repository, a test signature proves the key and refuses a wrong passphrase and a key that is not the listed one, the hook is installed once and never over another's, a commit is signed and verifies, and the facts are read with nothing changed", async (t) => {
  if (!haveTools) return t.skip("git and ssh-keygen are not on this machine");
  const dir = mkdtempSync(join(tmpdir(), "keys-"));
  const saved = { ...process.env };
  try {
    const ask = join(dir, "ask.sh");
    writeFileSync(ask, '#!/bin/sh\necho "${KEYS_TEST_PASSPHRASE}"\n');
    chmodSync(ask, 0o755);
    process.env["SSH_ASKPASS"] = ask;
    process.env["SSH_ASKPASS_REQUIRE"] = "force";
    process.env["KEYS_TEST_PASSPHRASE"] = "correct horse";
    const repo = join(dir, "repo");
    mkdirSync(repo);
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "--local", "user.name", "Ada");
    git(repo, "config", "--local", "user.email", "ada@example.test");
    const keyFile = join(dir, "keys", "daily");
    const before = await readFacts({ repo, keyFile, dailyPub: undefined, recoveryListed: false, recoveryKeyFile: undefined, recoveryCheckedAt: undefined, signersText: "" });
    assertEquals([before.daily.exists, before.git.signs, before.hookInstalled, before.git.identity], [false, false, false, true]);
    const pub = await makeKey(keyFile, "daily@example");
    assert(pub.kind === "ok" && pub.value.startsWith("ssh-ed25519 "), JSON.stringify(pub));
    const again = await makeKey(keyFile, "daily@example");
    assert(again.kind === "err" && again.error.includes("never overwritten"));
    assertEquals((await configureGit(repo, keyFile)).kind, "ok");
    assertEquals(git(repo, "config", "--local", "--get", "commit.gpgsign"), "true");
    assertEquals(git(repo, "config", "--local", "--get", "gpg.format"), "ssh");
    const listed = `daily namespaces="git" ${pub.value}\n`;
    const after = await readFacts({ repo, keyFile, dailyPub: pub.value, recoveryListed: true, recoveryKeyFile: undefined, recoveryCheckedAt: "2026-11-01", signersText: listed });
    assertEquals([after.daily.exists, after.daily.hasPassphrase, after.daily.inAgent, after.git.signs, after.git.formatSsh, after.git.signingKeyIsDaily, after.signers.dailyListed], [true, true, false, true, true, true, true]);
    assert(signingWorks(checkKeys({ ...after, hookInstalled: true }, "2026-11-21")));
    assertEquals(await testSign(keyFile, pub.value, "daily").then((r) => r.kind), "ok");
    const other = join(dir, "keys", "other");
    const otherPub = await makeKey(other, "other@example");
    assert(otherPub.kind === "ok");
    const stranger = await testSign(keyFile, otherPub.value, "daily");
    assert(stranger.kind === "err" && stranger.error.includes("not the key the fleet has"), JSON.stringify(stranger));
    process.env["KEYS_TEST_PASSPHRASE"] = "a wrong passphrase";
    const wrong = await testSign(keyFile, pub.value, "daily");
    assert(wrong.kind === "err" && wrong.error.includes("wrong passphrase"), JSON.stringify(wrong));
    process.env["KEYS_TEST_PASSPHRASE"] = "correct horse";
    assertEquals(await installHook(repo, "opsfolio keys check-push").then((r) => r.kind === "ok" && r.value), "installed");
    assertEquals(await installHook(repo, "opsfolio keys check-push").then((r) => r.kind === "ok" && r.value), "already");
    assert((await readFacts({ repo, keyFile, dailyPub: pub.value, recoveryListed: true, recoveryKeyFile: undefined, recoveryCheckedAt: undefined, signersText: listed })).hookInstalled);
    writeFileSync(join(repo, ".git", "hooks", "pre-push"), "#!/bin/sh\n# somebody else's hook\n");
    const foreign = await installHook(repo, "opsfolio keys check-push");
    assert(foreign.kind === "err" && foreign.error.includes("not overwritten") && !foreign.error.includes(HOOK_MARKER));
    writeFileSync(join(repo, "a.txt"), "one\n");
    const sha = await commitSigned(repo, keyFile, "a signed change", { paths: ["a.txt"] });
    assert(sha.kind === "ok", JSON.stringify(sha));
    const read = await readCommits(repo, "", "HEAD", allowedSigners([{ name: "daily", role: "daily", key: pub.value }]));
    assert(read.kind === "ok" && read.value[0]?.signature === "G" && read.value[0]?.signer === "daily", JSON.stringify(read));
    const empty = await commitSigned(repo, keyFile, "Approves: nothing", { allowEmpty: true });
    assert(empty.kind === "ok");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmSync(dir, { recursive: true, force: true });
  }
});
