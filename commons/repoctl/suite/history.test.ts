/**
 * Tests of the identity of merge commits (commons repoctl 0007-repoctl-hygiene FR-007): the pure check over merges read as data, and `repoctl hygiene` in a real temporary Git repository where a real merge was made under another identity (as a `git pull` does where `user.name` and `user.email` are
 * not set), where the same merge is held by its hash, where a merge made by `repoctl merge` is the repository's identity, and where a held hash that matches nothing is a warning. History is never rewritten.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { parseGitRef } from "@intellectual-frontiers/repoctl/governance";
import { identityFindings, MERGE_LOG, parseMerges, runMerge } from "@intellectual-frontiers/repoctl/logical";
import { systemProcess } from "@intellectual-frontiers/repoctl/physical";
import { CAN_RUN, configInput, execute, hostOf, TEST_IDENTITY, withRepo } from "./world.ts";

const ID = TEST_IDENTITY;
const hash = (c: string): string => c.repeat(40);
const line = (c: string, author: string, committer: string): string => `${hash(c)}\t${author}\t${author.toLowerCase().replace(/ /g, ".")}@example.test\t${committer}\t${committer.toLowerCase().replace(/ /g, ".")}@example.test`;

proves(["0007-repoctl-hygiene FR-007"], "a merge is a finding unless its author and its committer are the identity, a held hash by prefix is not reported, and a held hash that matches no merge is a warning", () => {
  const out = [
    `${hash("a")}\t${ID.name}\t${ID.email}\t${ID.name}\t${ID.email}`,
    line("b", "Claude", "Claude"),
    `${hash("c")}\t${ID.name}\t${ID.email}\tGitHub\tnoreply@github.com`,
    "not a merge line",
    `${hash("d")}\t${ID.name}\t${ID.email.toUpperCase()}\t${ID.name}\t${ID.email}`,
  ].join("\n");
  const merges = parseMerges(out);
  assertEquals(merges.length, 4, "the line that is not five fields is left out");
  const found = identityFindings(merges, ID, []);
  assertEquals(found.map((f) => f.message.slice(0, 22)), ["the merge bbbbbbbbbbbb", "the merge cccccccccccc"], "the address is compared without case, the name as it is");
  assert(found.every((f) => f.code === "E-HYGIENE-IDENTITY" && f.level === "fail" && f.path === "history"));
  assertStringIncludes(found[0]?.message ?? "", "authored by Claude <claude@example.test> and committed by Claude");
  const held = identityFindings(merges, ID, ["bbbbbbb", "cccccccc", "1234567"]);
  assertEquals(held.map((f) => [f.level, f.message.startsWith("commit.heldMerges holds 1234567, which is no merge")]), [["warn", true]], "held merges are not reported, and an old entry that matches nothing is");
  assertEquals(identityFindings([], ID, []), []);
});

proves(["0007-repoctl-hygiene FR-007"], "in a real repository a merge made under another identity fails the hygiene verb naming it, is held by its hash, and a merge by `repoctl merge` is the repository's identity", async (t) => {
  if (!CAN_RUN) return t.skip("git and bun cannot be run here");
  await withRepo([], async (dir, world) => {
    const as = (name: string, email: string) => ["-c", `user.name=${name}`, "-c", `user.email=${email}`, "-c", "commit.gpgsign=false"];
    const run = async (...args: readonly string[]): Promise<string> => {
      const r = await systemProcess.run(["git", "-C", dir, ...args]);
      if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
      return r.stdout;
    };
    await fs.writeTextFile(path.join(dir, "a.txt"), "1\n");
    await run(...as(ID.name, ID.email), "add", ".");
    await run(...as(ID.name, ID.email), "commit", "-q", "-m", "Start");
    await run("checkout", "-q", "-b", "feature");
    await fs.writeTextFile(path.join(dir, "b.txt"), "f\n");
    await run(...as(ID.name, ID.email), "add", ".");
    await run(...as(ID.name, ID.email), "commit", "-q", "-m", "Feature");
    await run("checkout", "-q", "main");
    await fs.writeTextFile(path.join(dir, "c.txt"), "m\n");
    await run(...as(ID.name, ID.email), "add", ".");
    await run(...as(ID.name, ID.email), "commit", "-q", "-m", "Main");
    // the merge of a pull where no identity was set: another name
    await run(...as("Claude", "noreply@anthropic.com"), "merge", "--no-ff", "-q", "-m", "Merge feature", "feature");
    const wrong = (await run("rev-parse", "HEAD")).trim();
    const history = await systemProcess.run(["git", "-C", dir, ...MERGE_LOG]);
    assertEquals(parseMerges(history.stdout).map((m) => m.hash), [wrong]);
    const before = (await run("rev-list", "--count", "HEAD")).trim();

    const failing = await execute(hostOf(world), ["hygiene", "--json"]);
    assertEquals(failing.code, 1, failing.err + failing.out);
    assertStringIncludes(failing.out, "E-HYGIENE-IDENTITY");
    assertStringIncludes(failing.out, wrong.slice(0, 12));
    assertStringIncludes(failing.out, "Claude");

    const held = await execute(hostOf(world, { config: configInput({ commit: { ...configInput().commit, heldMerges: [wrong.slice(0, 12)] } }) }), ["hygiene", "--json"]);
    assertEquals(held.code, 0, "a held merge is not reported: " + held.out + held.err);
    assertEquals((await run("rev-list", "--count", "HEAD")).trim(), before, "history is not rewritten");

    // a second merge, made by repoctl merge with the configured identity whatever the checkout's own configuration says
    await run("checkout", "-q", "-b", "other", "HEAD~1");
    await fs.writeTextFile(path.join(dir, "d.txt"), "o\n");
    await run(...as(ID.name, ID.email), "add", ".");
    await run(...as(ID.name, ID.email), "commit", "-q", "-m", "Other");
    await run("checkout", "-q", "main");
    const ref = parseGitRef("other");
    assert(ref.kind === "ok");
    await run("config", "user.name", "Somebody Else");
    await run("config", "user.email", "somebody@example.test");
    const merged = await runMerge(world, ref.value, [], ID);
    assert(merged.kind !== "refused", JSON.stringify(merged));
    const last = (await run("log", "-1", "--format=%an|%ae|%cn|%ce")).trim();
    assertEquals(last, `${ID.name}|${ID.email}|${ID.name}|${ID.email}`, "the merge repoctl makes is the identity of the configuration, not the checkout's own");
    const stale = await execute(hostOf(world, { config: configInput({ commit: { ...configInput().commit, heldMerges: [wrong.slice(0, 12), "1234567"] } }) }), ["hygiene", "--json"]);
    assertEquals(stale.code, 0, "a warning alone does not fail the run");
    assertStringIncludes(stale.out, "1234567, which is no merge");
  });
});

proves(["0007-repoctl-hygiene FR-007"], "a held hash that is not a hash is refused by the configuration", async () => {
  const { parseConfig } = await import("@intellectual-frontiers/repoctl/governance");
  const bad = parseConfig(configInput({ commit: { ...configInput().commit, heldMerges: ["XYZ", "abc"] } }));
  assert(bad.kind === "err" && bad.error.join(" ").includes("is not a hash"), JSON.stringify(bad));
  const twice = parseConfig(configInput({ commit: { ...configInput().commit, heldMerges: ["abcdef1", "abcdef1"] } }));
  assert(twice.kind === "err" && twice.error.join(" ").includes("twice"));
});
