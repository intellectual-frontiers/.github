/**
 * Tests of `repoctl merge` (commons repoctl 0003-repoctl-sync FR-005, FR-006) in real Git repositories with real generators: a generated file that conflicts is made again and staged and never resolved by hand, a conflict in a file
 * a person wrote is left as Git left it and named, the merge is committed only where nothing conflicts any more (as the repository's identity), a clean merge reports the generated files that are stale, and a refusal of Git is reported.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { parseGitRef } from "@intellectual-frontiers/repoctl/governance";
import { findingsOfSync, orderGenerators, partitionConflicts, runMerge, runSync } from "@intellectual-frontiers/repoctl/logical";
import { mergeDone } from "@intellectual-frontiers/repoctl/physical";
import { CAN_RUN, genOf, git, TEST_IDENTITY, withRepo } from "./world.ts";

const IDENTITY = TEST_IDENTITY;

const TABLE = [{ id: "readme", out: "README.md", from: ["a.txt", "b.txt"] }] as const;

const ref = (text: string) => {
  const r = parseGitRef(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

/** A repository with `a.txt`, `b.txt`, `notes.txt` and the README that its generator makes of the first two, committed on main, and a branch `feature` that changed `a.txt` (and the README, and the notes) while main changed `b.txt` (and the README, and the notes). */
async function diverged(dir: string, world: Parameters<typeof runSync>[0], order: Parameters<typeof runSync>[2], notes: boolean): Promise<void> {
  const write = (f: string, t: string) => fs.writeTextFile(path.join(dir, f), t);
  await write("a.txt", "1\n");
  await write("b.txt", "1\n");
  await write("notes.txt", "one\n");
  await runSync(world, "write", order);
  await git(dir, "add", ".");
  await git(dir, "commit", "-q", "-m", "Start");
  await git(dir, "checkout", "-q", "-b", "feature");
  await write("a.txt", "2\n");
  if (notes) await write("notes.txt", "feature\n");
  await runSync(world, "write", order);
  await git(dir, "add", ".");
  await git(dir, "commit", "-q", "-m", "Feature");
  await git(dir, "checkout", "-q", "main");
  await write("b.txt", "3\n");
  if (notes) await write("notes.txt", "main\n");
  await runSync(world, "write", order);
  await git(dir, "add", ".");
  await git(dir, "commit", "-q", "-m", "Main");
}

proves(["0003-repoctl-sync FR-005"], "the conflicted paths are split into the ones a generator writes and the ones a person wrote", () => {
  const table = [genOf("readme", [], ["README.md", "commons/*/LICENSE"])];
  assertEquals(partitionConflicts(table, ["README.md", "commons/core/LICENSE", "commons/core/src/a.ts"]), { generated: ["README.md", "commons/core/LICENSE"], written: ["commons/core/src/a.ts"] });
});

proves(["0003-repoctl-sync FR-005", "0003-repoctl-sync FR-006"], "a generated file that conflicts is made again, staged and committed as the identity, with no marker left", async () => {
  if (!CAN_RUN) return;
  await withRepo(TABLE, async (dir, world, generators) => {
    const ordered = orderGenerators(generators);
    assert(ordered.kind === "ok");
    await diverged(dir, world, ordered.value, false);
    const r = await runMerge(world, ref("feature"), ordered.value, TEST_IDENTITY);
    assert(r.kind === "conflicts", `a conflict: ${JSON.stringify(r)}`);
    assertEquals([r.regenerated, r.unioned, r.unresolved, r.written, r.committed], [["README.md"], [], [], [], true]);
    assertEquals(await fs.readTextFile(path.join(dir, "README.md")), "a=2 b=3\n");
    assert(!(await fs.readTextFile(path.join(dir, "README.md"))).includes("<<<<<<<"));
    assertEquals((await git(dir, "status", "--porcelain")).trim(), "");
    const who = `${IDENTITY.name} <${IDENTITY.email}>`;
    assertEquals((await git(dir, "log", "-1", "--format=%an <%ae>|%cn <%ce>")).trim(), `${who}|${who}`);
    assertEquals((await git(dir, "log", "-1", "--format=%p")).trim().split(" ").length, 2, "it is a merge commit")
    assertEquals(mergeDone(r, "feature").findings, []);
  });
});

proves(["0003-repoctl-sync FR-005", "0003-repoctl-sync FR-006"], "a conflict in a file a person wrote is named and left as Git left it, and the merge is not committed", async () => {
  if (!CAN_RUN) return;
  await withRepo(TABLE, async (dir, world, generators) => {
    const ordered = orderGenerators(generators);
    assert(ordered.kind === "ok");
    await diverged(dir, world, ordered.value, true);
    const r = await runMerge(world, ref("feature"), ordered.value, TEST_IDENTITY);
    assert(r.kind === "conflicts");
    assertEquals([r.regenerated, r.unioned, r.unresolved, r.written, r.committed], [["README.md"], [], [], ["notes.txt"], false]);
    assertStringIncludes(await fs.readTextFile(path.join(dir, "notes.txt")), "<<<<<<<");
    assertStringIncludes(await fs.readTextFile(path.join(dir, "notes.txt")), "feature");
    assertEquals((await git(dir, "diff", "--name-only", "--diff-filter=U")).trim(), "notes.txt");
    const done = mergeDone(r, "feature");
    assertEquals(done.findings.map((f) => `${f.code} ${f.message.split(" ")[0]}`), ["E-MERGE-CONFLICT notes.txt"]);
    assertStringIncludes(done.text, "written by a person, untouched");
  });
});

/** A generator that makes only the lines of README.md that begin with `a=`, from the sources, and leaves every other line of it as it finds it: a file a person also writes. */
const MIXED = `import { existsSync, readFileSync, writeFileSync } from "node:fs";
const read = (f) => readFileSync(f, "utf8").trim();
const made = "a=" + read("a.txt") + " b=" + read("b.txt");
const have = existsSync("README.md") ? readFileSync("README.md", "utf8").split("\\n").filter((l) => l !== "") : [];
const text = [...have.filter((l) => !l.startsWith("a=")), made].join("\\n") + "\\n";
if (process.argv.includes("--check")) process.exit(existsSync("README.md") && readFileSync("README.md", "utf8") === text ? 0 : 1);
writeFileSync("README.md", text);
`;

proves(["0003-repoctl-sync FR-005"], "a generated file that a person also writes keeps the lines of both sides and has its generated part made again", async () => {
  if (!CAN_RUN) return;
  await withRepo(TABLE, async (dir, world, generators) => {
    const mixed = generators.map((g) => ({ ...g, mixed: ["README.md"] }));
    const ordered = orderGenerators(mixed);
    assert(ordered.kind === "ok");
    await fs.writeTextFile(path.join(dir, "gen-readme.mjs"), MIXED);
    const write = (f: string, t: string) => fs.writeTextFile(path.join(dir, f), t);
    await write("a.txt", "1\n");
    await write("b.txt", "1\n");
    await write("README.md", "# Title\n");
    await runSync(world, "write", ordered.value);
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Start");
    await git(dir, "checkout", "-q", "-b", "feature");
    await write("a.txt", "2\n");
    await write("README.md", "# Title\nfeature wrote this\n");
    await runSync(world, "write", ordered.value);
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Feature");
    await git(dir, "checkout", "-q", "main");
    await write("b.txt", "3\n");
    await write("README.md", "# Title\nmain wrote that\n");
    await runSync(world, "write", ordered.value);
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Main");
    const r = await runMerge(world, ref("feature"), ordered.value, TEST_IDENTITY);
    assert(r.kind === "conflicts", JSON.stringify(r));
    assertEquals([r.regenerated, r.unioned, r.written, r.committed], [["README.md"], ["README.md"], [], true]);
    const text = await fs.readTextFile(path.join(dir, "README.md"));
    assertStringIncludes(text, "feature wrote this");
    assertStringIncludes(text, "main wrote that");
    assertStringIncludes(text, "a=2 b=3");
    assert(!text.includes("<<<<<<<") && !text.includes("a=1 b=1") && !text.includes("a=2 b=1") && !text.includes("a=1 b=3"), text);
    assertStringIncludes(mergeDone(r, "feature").text, "the lines of both sides were kept");
  });
});

proves(["0003-repoctl-sync FR-006"], "a clean merge reports the generated files that are stale, and a refusal of Git is E-MERGE-FAILED with Git's words", async () => {
  if (!CAN_RUN) return;
  await withRepo(TABLE, async (dir, world, generators) => {
    const ordered = orderGenerators(generators);
    assert(ordered.kind === "ok");
    const write = (f: string, t: string) => fs.writeTextFile(path.join(dir, f), t);
    await write("a.txt", "1\n");
    await write("b.txt", "1\n");
    await runSync(world, "write", ordered.value);
    await git(dir, "add", ".");
    await git(dir, "commit", "-q", "-m", "Start");
    await git(dir, "checkout", "-q", "-b", "feature");
    await write("a.txt", "2\n");
    await git(dir, "commit", "-q", "-am", "A source changes and its generated file does not");
    await git(dir, "checkout", "-q", "main");
    const merged = await runMerge(world, ref("feature"), ordered.value, TEST_IDENTITY);
    assert(merged.kind === "merged");
    assertEquals(findingsOfSync(merged.sync).map((f) => f.code), ["E-STALE-GENERATED"]);
    assertEquals(mergeDone(merged, "feature").next, ["repoctl sync"]);
    const refused = await runMerge(world, ref("no-such-branch"), ordered.value, TEST_IDENTITY);
    assert(refused.kind === "refused");
    const done = mergeDone(refused, "no-such-branch");
    assertEquals(done.findings.map((f) => f.code), ["E-MERGE-FAILED"]);
    assertStringIncludes(done.findings[0]?.message ?? "", "no-such-branch");
  });
});
