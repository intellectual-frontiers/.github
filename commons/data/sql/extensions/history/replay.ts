// Spec: 0018-sql-history FR-005, FR-006
/**
 * Replaying a history (commons data 0018-sql-history FR-005, FR-006): the manifest and every file are checked, then what the files say is run through the lifecycle's run, with its ledger, its
 * transactions, its checks, its guards and its base, so that replaying the files is running the plan they were frozen from.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import {
  type Applied,
  type Driver,
  execute,
  type Repeatable,
  type RunError,
  type RunOptions,
  type RunPlan,
  type RunStep,
} from "@intellectual-frontiers/data/sql/lifecycle";
import type { Dialect } from "@intellectual-frontiers/data/sql/physical";
import type { Artifact } from "./deps.ts";
import { parseStep } from "./format.ts";
import { checkHistory, type Problem } from "./manifest.ts";

/** What is wrong with a replay. */
export type ReplayError = { readonly kind: "history"; readonly problems: readonly Problem[] } | { readonly kind: "empty" } | RunError;

/** The plan a history holds. */
export function historyPlan(
  files: readonly Artifact[],
  folder = "migrations",
): Result<RunPlan & { readonly dialect: string }, readonly ReplayError[]> {
  const { manifest, problems } = checkHistory(files, folder);
  if (problems.length > 0) return err([{ kind: "history", problems }]);
  if (manifest === undefined) return err([{ kind: "empty" }]);
  const steps: RunStep[] = [];
  for (const e of manifest.entries) {
    const parsed = parseStep(files.find((f) => f.path === e.file)?.text ?? "");
    if (parsed.kind === "err")
      return err([{ kind: "history", problems: [{ kind: "unreadable", file: e.file, why: parsed.error.join("; ") }] }]);
    const s = parsed.value.step;
    steps.push({
      id: s.id,
      name: s.name,
      from: s.from,
      to: s.to,
      up: s.up,
      of: s.of as RunStep["of"],
      ...(s.verify === undefined ? {} : { verify: s.verify }),
    });
  }
  const text = files.find((f) => f.path === `${folder}/repeatable.json`)?.text;
  const repeatable: Repeatable[] =
    text === undefined
      ? []
      : (
          JSON.parse(text) as { repeatable: { key: string; hash: string; of: Repeatable["of"]; statements: Repeatable["statements"] }[] }
        ).repeatable.map((r) => ({ key: r.key, hash: r.hash, of: r.of, statements: r.statements }));
  return ok({
    dialect: manifest.dialect,
    from: manifest.base,
    to: manifest.entries[manifest.entries.length - 1]?.to ?? manifest.base,
    steps,
    repeatable,
  });
}

/**
 * Replays a history on a database.
 *
 * @param files - the files of the history
 * @param driver - the database
 * @param dialect - its dialect
 * @param options - what the run is given, and the folder
 * @returns what was applied, or why not
 */
export async function replay(
  files: readonly Artifact[],
  driver: Driver,
  dialect: Dialect,
  options: RunOptions & { readonly folder?: string },
): Promise<Result<Applied, readonly ReplayError[]>> {
  const plan = historyPlan(files, options.folder);
  if (plan.kind === "err") return plan;
  if (plan.value.dialect !== dialect.name)
    return err([
      { kind: "history", problems: [{ kind: "manifest", why: `the history is for ${plan.value.dialect}, not ${dialect.name}` }] },
    ]);
  return execute(plan.value, driver, dialect, options);
}
