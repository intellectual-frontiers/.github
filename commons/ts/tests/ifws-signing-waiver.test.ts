/**
 * The waiver of the signed-commit rule for a bot account that signs through the host (commons 0023-if-workspaces FR-049, owner decision of 2026-11-17): where the manifest names a regulated domain, a
 * Decision of the repository's own harness record (`ifccm.declaration.ts`, the file `0020-ifccm` FR-033 reads) may waive the rule for one account and one key, written
 * `signing-waiver <account> <key>`. The waiver clears the finding only for that account with that key, never silently (an informational finding names the Decision, the account and the key), and not for a
 * commit that is not signed or whose signature is bad, expired or revoked. The judgement is pure; the facts are read by real `git` from real commits signed by an SSH key that the real `ssh-keygen`
 * makes where it is installed, and `ifws doctor` is run as a real program over a real workspace.
 *
 * @module
 */
import { decodeHarnessRecord, signingWaivers, type SigningWaiver } from "../mizan/changes/declaration.ts";
import { makeTempDir, remove, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { run } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { policyOf } from "../workspaces/policy.ts";
import { commitSignatures } from "../workspaces/scan/host/scan.ts";
import { readSigningWaivers } from "../workspaces/scan/host/waivers.ts";
import { type CommitSignature, signedCommitFindings, type SigningWaivers } from "../workspaces/scan/policy-scans.ts";
import { needsSshKeygen } from "./quality-fixtures.ts";
import { needsWorld, ONE_REPOSITORY, withWorld } from "./ifws-fixtures.ts";

const TODAY = "2026-11-17";
const REPO = "github.com/o/r";
const BOT = "noreply@example.org";
const KEY = "SHA256:abcDEF123456789abcDEF123456789abcDEF1234567";
const regulated = policyOf({ regulatedDomain: ["DeviceQuality"] });

const waiver = (over: Partial<SigningWaiver> = {}): SigningWaiver => ({
  decision: "D-7",
  approvedBy: "quality lead",
  account: BOT,
  key: KEY,
  ...over,
});
const waivers = (...w: SigningWaiver[]): SigningWaivers => new Map([[REPO, w]]);
const commit = (c: string, over: Partial<CommitSignature> = {}): CommitSignature => ({
  repo: REPO,
  commit: c.repeat(40),
  letter: "U",
  account: BOT,
  keys: [KEY],
  ...over,
});

proves(["0023-if-workspaces FR-049"], "the Decisions of the record make waivers only where they name an account and a key", () => {
  const record = decodeHarnessRecord(
    [
      `export const declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2026-11-01" };`,
      `export const decisions = [`,
      `  { id: "D-7", approvedBy: "quality lead", covers: ["signing-waiver ${BOT} ${KEY}", "0021-ifqs FR-005"], record: 12 },`,
      `  { id: "D-8", approvedBy: "quality lead", covers: ["signing-waiver", "signing-waiver only-an-account", "signing-waiver a b c"] },`,
      `];`,
    ].join("\n"),
  );
  assert(record.kind === "ok");
  assertEquals(signingWaivers(record.value.decisions), [waiver()]);
});

proves(
  ["0023-if-workspaces FR-049"],
  "a waiver clears the finding only for the named account with the named key, says so, and leaves every other commit as it was",
  () => {
    const commits = [
      commit("a"), // the named account, the named key: waived
      commit("b", { account: "someone@example.org" }), // another account, the same key
      commit("c", { keys: ["SHA256:anotherkeyentirely0000000000000000000000000"] }), // the named account, another key
      commit("d", { letter: "N", keys: [] }), // not signed at all
      commit("e", { letter: "B" }), // a bad signature
      commit("f", { letter: "R" }), // a revoked key
      commit("0", { letter: "E", account: BOT.toUpperCase(), keys: [KEY.toLowerCase()] }), // not verifiable here, the same account and key in another case
    ];
    const found = signedCommitFindings(regulated, commits, TODAY, waivers(waiver()));
    assertEquals(
      found.map((f) => [f.subject.slice(-12), f.ruleId, f.severity]),
      [
        ["aaaaaaaaaaaa", "ifws/commit-signing-waived", "Informational"],
        ["bbbbbbbbbbbb", "ifws/commit-not-signed", "Error"],
        ["cccccccccccc", "ifws/commit-not-signed", "Error"],
        ["dddddddddddd", "ifws/commit-not-signed", "Error"],
        ["eeeeeeeeeeee", "ifws/commit-not-signed", "Error"],
        ["ffffffffffff", "ifws/commit-not-signed", "Error"],
        ["000000000000", "ifws/commit-signing-waived", "Informational"],
      ],
    );
    // never silent: the waived commit is told with the Decision, the account and the key
    const told = found[0]?.message ?? "";
    for (const part of ["D-7", BOT, KEY, "quality lead", "waived"]) assertStringIncludes(told, part);
    // a near miss says which key the Decision names
    assertStringIncludes(found[2]?.message ?? "", `waives ${BOT} only with the key ${KEY}`);
    assertStringIncludes(found[3]?.message ?? "", "this commit is not signed");
    // no Decision, no waiver: the same commits with none, with one of another repository, or in a workspace that names no regulated domain
    assertEquals(
      signedCommitFindings(regulated, [commit("a")], TODAY).map((f) => f.severity),
      ["Error"],
    );
    assertEquals(
      signedCommitFindings(regulated, [commit("a")], TODAY, new Map([["github.com/o/other", [waiver()]]])).map((f) => f.severity),
      ["Error"],
    );
    assertEquals(
      signedCommitFindings(policyOf({}), [commit("a")], TODAY, waivers(waiver())).map((f) => [f.ruleId, f.severity]),
      [["ifws/commit-not-signed", "Warning"]],
    );
  },
);

proves(
  ["0023-if-workspaces FR-049"],
  "the facts are read from real commits and the record of the repository: a commit signed by a key outside the allowed signers is waived only under a Decision that names its committer and its key",
  async () => {
    const dir = await makeTempDir({ prefix: "ifws-waiver-" });
    try {
      const repo = join(dir, REPO);
      const run0 = async (...args: string[]): Promise<string> => {
        const r = await run(["git", "-C", repo, ...args], {
          env: { GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(dir, "none") },
        });
        assert(r.success, `git ${args.join(" ")}: ${r.stderr}`);
        return r.stdout.trim();
      };
      const made = await run(["git", "init", "-q", "-b", "main", repo]);
      assert(made.success, made.stderr);
      const key = join(dir, "bot");
      const other = join(dir, "other");
      for (const k of [key, other]) {
        const r = await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "k", "-f", k]);
        assert(r.success, r.stderr);
      }
      const fingerprint = (await run(["ssh-keygen", "-lf", `${key}.pub`])).stdout.split(" ")[1] ?? "";
      assert(fingerprint.startsWith("SHA256:"), fingerprint);
      // the allowed signers hold another key only: the bot's key is good but not trusted (`U`)
      await writeTextFile(
        join(dir, "allowed"),
        `trusted@example.org namespaces="git" ${(await run(["cat", `${other}.pub`])).stdout.trim()}\n`,
      );
      for (const [k, v] of [
        ["user.name", "bot"],
        ["gpg.format", "ssh"],
        ["gpg.ssh.program", "ssh-keygen"],
        ["gpg.ssh.allowedSignersFile", join(dir, "allowed")],
        ["commit.gpgsign", "false"],
      ] as const)
        await run0("config", k, v);
      const as = async (email: string, name: string, signWith: string | undefined): Promise<string> => {
        await writeTextFile(join(repo, name), `${name}\n`);
        await run0("add", "-A");
        await run0(
          "-c",
          `user.email=${email}`,
          ...(signWith === undefined ? [] : ["-c", `user.signingkey=${signWith}.pub`, "commit", "-S"]),
          ...(signWith === undefined ? ["commit"] : []),
          "-q",
          "-m",
          name,
        );
        return run0("rev-parse", "HEAD");
      };
      const bot = await as(BOT, "bot.txt", key);
      const impostor = await as("someone@example.org", "impostor.txt", key);
      const unsigned = await as(BOT, "unsigned.txt", undefined);
      const read = await commitSignatures(repo, "HEAD", 10);
      assert(read.kind === "ok");
      const byCommit = (c: string) => read.value.find((x) => x.commit === c);
      assertEquals(byCommit(bot)?.account, BOT);
      assertEquals(byCommit(bot)?.keys?.includes(fingerprint), true, "Git reports the key's fingerprint");
      assertEquals(byCommit(unsigned)?.letter, "N");
      // the record of the repository holds the Decision
      await writeTextFile(
        join(repo, "ifccm.declaration.ts"),
        `export const declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2026-11-01" };\nexport const decisions = [{ id: "D-7", approvedBy: "quality lead", covers: ["signing-waiver ${BOT} ${fingerprint}"] }];\n`,
      );
      const got = await readSigningWaivers(dir, [REPO, "github.com/o/missing"]);
      assertEquals(got.notes, []);
      assertEquals(
        got.waivers.get(REPO)?.map((w) => [w.decision, w.account, w.key]),
        [["D-7", BOT, fingerprint]],
      );
      const found = signedCommitFindings(
        regulated,
        read.value.map((c) => ({ ...c, repo: REPO })),
        TODAY,
        got.waivers,
      );
      const of = (c: string) => found.find((f) => f.subject.endsWith(c.slice(0, 12)));
      assertEquals(of(bot)?.ruleId, "ifws/commit-signing-waived");
      assertEquals(of(impostor)?.ruleId, "ifws/commit-not-signed", "the same key under another account is not waived");
      assertEquals(of(unsigned)?.ruleId, "ifws/commit-not-signed");
      // a record that cannot be read waives nothing and is said
      await writeTextFile(join(repo, "ifccm.declaration.ts"), `export const decisions = [ someCall() ];\n`);
      const broken = await readSigningWaivers(dir, [REPO]);
      assertEquals(broken.waivers.size, 0);
      assertEquals(broken.notes.length, 1);
    } finally {
      await remove(dir, { recursive: true });
    }
  },
  needsSshKeygen,
);

proves(
  ["0023-if-workspaces FR-049"],
  "ifws doctor, run as a program, reports the waived commit as informational and the unwaived ones as errors, and reports an error again once the Decision is removed",
  async () => {
    await withWorld(async (w) => {
      await w.ifws("init");
      await w.manifest({ ...ONE_REPOSITORY, policy: { regulatedDomain: ["DeviceQuality"] } });
      assertEquals((await w.ifws("apply")).code, 0);
      const key = join(w.dir, "bot");
      const other = join(w.dir, "other");
      for (const k of [key, other]) {
        const r = await run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-C", "k", "-f", k]);
        assert(r.success, r.stderr);
      }
      const fingerprint = (await run(["ssh-keygen", "-lf", `${key}.pub`])).stdout.split(" ")[1] ?? "";
      await writeTextFile(
        join(w.dir, "allowed"),
        `trusted@example.org namespaces="git" ${(await run(["cat", `${other}.pub`])).stdout.trim()}\n`,
      );
      for (const [k, v] of [
        ["gpg.format", "ssh"],
        ["gpg.ssh.program", "ssh-keygen"],
        ["gpg.ssh.allowedSignersFile", join(w.dir, "allowed")],
        ["user.signingkey", `${key}.pub`],
      ] as const)
        await w.git(w.repo, "config", k, v);
      await writeTextFile(join(w.repo, "bot.txt"), "bot\n");
      await w.git(w.repo, "add", ".");
      await w.git(
        w.repo,
        "-c",
        `user.email=${BOT}`,
        "-c",
        "user.name=bot",
        "commit",
        "-S",
        "-q",
        "--no-verify",
        "-m",
        "a commit the host signed",
      );
      await writeTextFile(join(w.repo, "mine.txt"), "mine\n");
      await w.git(w.repo, "add", ".");
      await w.git(w.repo, "-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", "an unsigned commit");
      type Checks = { data: { checks: { id: string; level: string; subject: string; message: string }[] } };
      const doctor = async () =>
        (JSON.parse((await w.ifws("doctor", "--json")).stdout) as Checks).data.checks.filter((c) => c.id.startsWith("ifws/commit-"));
      const before = await doctor();
      assertEquals(
        before.map((c) => [c.id, c.level]).sort(),
        [
          ["ifws/commit-not-signed", "error"],
          ["ifws/commit-not-signed", "error"],
        ],
        JSON.stringify(before),
      );
      await writeTextFile(
        join(w.repo, "ifccm.declaration.ts"),
        `export const decisions = [{ id: "D-7", approvedBy: "quality lead", covers: ["signing-waiver ${BOT} ${fingerprint}"] }];\n`,
      );
      const after = await doctor();
      assertEquals(after.map((c) => [c.id, c.level]).sort(), [
        ["ifws/commit-not-signed", "error"],
        ["ifws/commit-signing-waived", "suggest"],
      ]);
      const waived = after.find((c) => c.id === "ifws/commit-signing-waived");
      assertStringIncludes(waived?.message ?? "", "D-7");
      assertStringIncludes(waived?.message ?? "", fingerprint);
      // the unsigned commit of a person is still an error
      assertStringIncludes(after.find((c) => c.id === "ifws/commit-not-signed")?.message ?? "", "it is not signed");
    });
  },
  { ...needsWorld, ...needsSshKeygen },
);
