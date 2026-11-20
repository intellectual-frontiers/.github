/**
 * Retention and archive of the evidence (commons 0001-quality-evidence FR-050): the harness's record (`ifccm.declaration.ts`, the file the quality commands
 * already read) states a retention period in days; `quality archive --tag NAME` makes a Git tag on the tip of the `quality` branch once the period
 * of the oldest evidence has passed, and deletes nothing. The judgement is pure (the period and the day are arguments); the command is run on a
 * real temporary Git repository with a real run kept on a real `quality` branch.
 *
 * @module
 */
import { decodeDeclaration } from "@intellectual-frontiers/mizan/changes/declaration";
import { archiveCommand } from "../src/commands.ts";
import { archiveBranch, oldestEvidenceDay, tagTarget } from "../src/host/archive.ts";
import { branchTip, keepRun, verifyBranch } from "../src/host/branch.ts";
import { readDeclaration } from "../src/host/declaration.ts";
import { addDays, judgeRetention, showRetention, tagNameProblem } from "../src/pure/retention.ts";
import { makeTempDir, remove, writeTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { assembledRun, git, needsGit, repositoryWithCommit } from "./quality-fixtures.ts";

proves(
  ["0001-quality-evidence FR-050"],
  "judgeRetention: the period of the oldest evidence has passed on the day it ends and after it, never before; no period and no evidence are said so (period and day are arguments)",
  () => {
    assertEquals(addDays("2026-11-17", 30), "2026-12-17");
    assertEquals(addDays("2027-12-31", 1), "2028-01-01");
    assertEquals(addDays("2026-02-30", 1), undefined);
    const j = (oldestDay: string | undefined, retentionDays: number | undefined, today: string) =>
      judgeRetention({ oldestDay, retentionDays, today });
    assertEquals(j("2026-11-17", 30, "2026-12-16"), {
      kind: "ok",
      value: { kind: "kept", oldestDay: "2026-11-17", dueOn: "2026-12-17", daysLeft: 1 },
    });
    assertEquals(j("2026-11-17", 30, "2026-12-17"), { kind: "ok", value: { kind: "due", oldestDay: "2026-11-17", dueOn: "2026-12-17" } });
    const later = j("2026-11-17", 30, "2030-01-01");
    assert(later.kind === "ok" && later.value.kind === "due");
    assertEquals(j(undefined, 30, "2026-12-17"), { kind: "ok", value: { kind: "no-evidence" } });
    assertEquals(j("2026-11-17", undefined, "2026-12-17"), { kind: "ok", value: { kind: "no-period" } });
    // a period that is not a whole number of days of at least one, and a day that is not one, are refused
    for (const bad of [0, -3, 1.5]) assert(j("2026-11-17", bad, "2026-12-17").kind === "err");
    assert(j("2026-11-17", 30, "yesterday").kind === "err");
    assert(j("2026-13-17", 30, "2026-12-17").kind === "err");
    const kept = j("2026-11-17", 30, "2026-11-30");
    assert(kept.kind === "ok");
    assertStringIncludes(showRetention(kept.value), "kept until 2026-12-17, 17 days more");
    // tag names
    assertEquals(tagNameProblem("quality-archive-2026"), undefined);
    assertEquals(tagNameProblem("archive/2026-11"), undefined);
    for (const bad of ["", "a b", "a..b", "-x", "a:b", "x.lock", "/x", "x/", "a~1", ".x"]) assert(tagNameProblem(bad) !== undefined, bad);
  },
);

proves(
  ["0001-quality-evidence FR-050"],
  "the record states the retention period as a typed field: a whole number of days of at least one, read from the file the quality commands already read",
  async () => {
    const ok = decodeDeclaration({ regulatedDomains: [], retentionDays: 2555 });
    assert(ok.kind === "ok");
    assertEquals(ok.value.retentionDays, 2555);
    for (const bad of [0, -1, 1.5, "30"])
      assert(decodeDeclaration({ regulatedDomains: [], retentionDays: bad }).kind === "err", String(bad));
    const none = decodeDeclaration({ regulatedDomains: [] });
    assert(none.kind === "ok" && none.value.retentionDays === undefined, "a record that states no period has none");
    const dir = await makeTempDir({ prefix: "ifqs-retention-decl-" });
    try {
      await writeTextFile(
        join(dir, "ifccm.declaration.ts"),
        `export const declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2026-11-01", retentionDays: 365 };\n`,
      );
      const read = await readDeclaration(dir);
      assert(read.kind === "ok" && read.value !== undefined);
      assertEquals(read.value.retentionDays, 365);
      await writeTextFile(join(dir, "bad.ts"), `export const declaration = { regulatedDomains: [], retentionDays: 0 };\n`);
      assert((await readDeclaration(dir, "bad.ts")).kind === "err");
    } finally {
      await remove(dir, { recursive: true });
    }
  },
);

proves(
  ["0001-quality-evidence FR-050"],
  "quality archive --tag tags the tip of the branch once the period of the oldest evidence has passed, never earlier, never over a tag that exists, and deletes nothing",
  async () => {
    const dir = await makeTempDir({ prefix: "ifqs-retention-" });
    try {
      const tested = await repositoryWithCommit(dir);
      // no branch yet: nothing to archive, and a branch is not made by asking
      const none = await archiveBranch({ repo: dir, tag: "t0", retentionDays: 30, today: "2030-01-01" });
      assert(none.kind === "err" && none.error.kind === "no-branch");
      assertEquals(await archiveCommand(["--repo", dir, "--tag", "t0", "--today", "2030-01-01"]), 1);
      // the oldest evidence is the run of 2026-11-17
      const kept = await keepRun({
        repo: dir,
        record: await assembledRun(1, [{ name: "a", requirements: ["0001-quality-evidence FR-050"] }], { revision: tested }),
        sign: false,
      });
      assert(kept.kind === "ok", kept.kind === "err" ? JSON.stringify(kept.error) : "");
      assertEquals(await oldestEvidenceDay(dir), { kind: "ok", value: "2026-11-17" });
      const tip = await branchTip(dir);
      assert(tip.kind === "ok" && tip.value !== undefined);
      // a record that states no period: refused, nothing is tagged
      assertEquals(await archiveCommand(["--repo", dir, "--tag", "t1", "--today", "2030-01-01"]), 1);
      assertEquals(await git(dir, "tag", "--list"), "");
      await writeTextFile(join(dir, "ifccm.declaration.ts"), `export const declaration = { regulatedDomains: [], retentionDays: 30 };\n`);
      // the day before the period ends: nothing is written
      assertEquals(await archiveCommand(["--repo", dir, "--tag", "t1", "--today", "2026-12-16"]), 0);
      assertEquals(await git(dir, "tag", "--list"), "");
      // the day it ends: a tag on the tip
      assertEquals(await archiveCommand(["--repo", dir, "--tag", "t1", "--today", "2026-12-17"]), 0);
      assertEquals(await git(dir, "tag", "--list"), "t1");
      assertEquals(await tagTarget(dir, "t1"), { kind: "ok", value: tip.value });
      // an archive tag is never moved or replaced, even after the branch grows
      const more = await keepRun({
        repo: dir,
        record: await assembledRun(2, [{ name: "b", requirements: ["0001-quality-evidence FR-050"] }], { revision: tested }),
        sign: false,
      });
      assert(more.kind === "ok");
      assertEquals(await archiveCommand(["--repo", dir, "--tag", "t1", "--today", "2027-01-01"]), 1);
      assertEquals(await tagTarget(dir, "t1"), { kind: "ok", value: tip.value });
      // the command has no way to delete: an option that asks is a usage error, a name that is not a tag name too
      assertEquals(await archiveCommand(["--repo", dir, "--tag", "t1", "--delete"]), 2);
      assertEquals(await archiveCommand(["--repo", dir, "--tag", "a b"]), 2);
      // nothing was deleted: every file is on the branch and its chain verifies
      const verified = await verifyBranch(dir);
      assert(verified.kind === "ok", verified.kind === "err" ? JSON.stringify(verified.error) : "");
      assertEquals(verified.value.files.length, 2);
      const grown = await branchTip(dir);
      assert(grown.kind === "ok" && grown.value !== undefined && grown.value !== tip.value);
      assertEquals(await git(dir, "merge-base", "--is-ancestor", tip.value, grown.value).then(() => "ancestor"), "ancestor");
    } finally {
      await remove(dir, { recursive: true });
    }
  },
  needsGit,
);
