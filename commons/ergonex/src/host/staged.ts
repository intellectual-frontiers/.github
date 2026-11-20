// Spec: 0002-workspace-model FR-031
/**
 * The plaintext-token scan of the staged changes (commons 0002-workspace-model FR-031, 0003-host FR-014): what the `pre-commit` hook runs. It reads each staged file as the index holds it (not the
 * working tree, which may differ), skips a file that is binary or over a megabyte, and returns where a secret is (file, line, rule) and never what it is.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { run } from "../platform/r-proc.ts";
import { MAX_SCAN_BYTES } from "../scan/host/scan.ts";
import { SECRET_RULE, scanText } from "../scan/secrets.ts";

/** A hit of the staged-change scan: where it is and the rule that found it, never the secret. */
export type StagedHit = {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
};

const ENV = { GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };

/** The hits of the staged files of the repository at `cwd`, or why `git` could not read them (the hook then says it cannot run its checker). */
export async function stagedSecretsScan(cwd: string): Promise<Result<readonly StagedHit[], string>> {
  const names = await run(["git", "-C", cwd, "diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"], { env: ENV });
  if (!names.success) return err(names.stderr.trim().split("\n")[0] ?? "git diff --cached failed");
  const hits: StagedHit[] = [];
  for (const file of names.stdout.split("\0").filter((f) => f !== "")) {
    const blob = await run(["git", "-C", cwd, "show", `:${file}`], {
      env: ENV,
    });
    if (!blob.success || blob.stdout.length > MAX_SCAN_BYTES || blob.stdout.includes("\0")) continue;
    for (const h of scanText(file, blob.stdout)) hits.push({ file: h.file, line: h.line, rule: SECRET_RULE });
  }
  return ok(hits);
}
