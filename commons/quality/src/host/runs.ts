// Spec: 0002-quality-query FR-004
/**
 * The runs kept on the `quality` branch, read for a question (commons quality 0002-quality-query FR-004): the branch is verified as every other reader verifies it, each file of evidence is read back through `readQuality`, and a file that does not
 * read is left out. A branch that does not verify gives no runs and says why.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Grade, RUN_GRADE } from "../pure/names.ts";
import { readQuality } from "../pure/record.ts";
import type { KeptRun } from "../query/mod.ts";
import { blobAt, verifyBranch } from "./branch.ts";

/** Every run the branch keeps, oldest first; none where there is no branch. */
export async function keptRuns(repo: string): Promise<Result<readonly KeptRun[], string>> {
  const verified = await verifyBranch(repo);
  if (verified.kind === "err") return verified.error.kind === "no-branch" ? ok([]) : err(`the quality branch cannot be read: ${verified.error.kind}`);
  const gradeOf = new Map(verified.value.grades.map((g) => [g.path, g.grade]));
  const runs: KeptRun[] = [];
  for (const f of verified.value.files) {
    const body = await blobAt(repo, f.commit, f.path);
    if (body.kind === "err") return err(`the file ${f.path} cannot be read`);
    const q = readQuality(body.value);
    if (q.kind === "err") continue;
    const grade: Grade = gradeOf.get(f.path) ?? RUN_GRADE;
    runs.push({ record: q.value, day: f.path.split("/").slice(2, 5).join("-"), grade });
  }
  return ok(runs);
}
