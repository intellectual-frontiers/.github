// Spec: 0002-libraries-ci-findings FR-009
/**
 * The accepted risks of the repository (commons 0038-build-policy FR-008): `commons/spec-kit/accepted-findings/<id>.ts`, each a typed file with an export `acceptance` (the finding's id, who answers for the risk, the reason, the day it begins and ends, and the approver). `bun commons/libraries/src/ci/accepted.ts [DIR]`
 * is the check of them, run by `repoctl check`: it finds an acceptance with no reason, an end that is not a day or is more than 366 days ahead, an approver who is not on the list, a file whose name is not its finding's id and two acceptances of one finding, and it ends 1 for any. An acceptance is a person's
 * word that a risk has been seen until a day; it is never made to pass a check, and an agent never writes one (the approver is a person of `APPROVERS`, and the path is the owner's in CODEOWNERS).
 *
 * @example
 * ```ts
 * import { loadAcceptances } from "./accepted.ts";
 * (await loadAcceptances("/nonexistent")).acceptances.length; // 0
 * ```
 *
 * @module
 */
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Acceptance, acceptanceProblems } from "./findings.ts";

/** Where the acceptances are, from the root of the repository. */
export const ACCEPTED_DIR = "commons/spec-kit/accepted-findings";

/** The acceptances of a folder and what is wrong with the files (each a sentence naming the file). */
export async function loadAcceptances(dir: string): Promise<{ readonly acceptances: readonly Acceptance[]; readonly problems: readonly string[] }> {
  const acceptances: Acceptance[] = [];
  const problems: string[] = [];
  if (!existsSync(dir)) return { acceptances, problems };
  const seen = new Map<string, string>();
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".ts")).sort()) {
    const file = `${dir}/${name}`;
    let mod: Record<string, unknown>;
    try {
      mod = (await import(resolve(file))) as Record<string, unknown>;
    } catch (e) {
      problems.push(`${file}: cannot be read: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const a = mod["acceptance"] as Acceptance | undefined;
    if (a === undefined || typeof a !== "object") {
      problems.push(`${file}: exports no \`acceptance\``);
      continue;
    }
    for (const p of acceptanceProblems(a)) problems.push(`${file}: ${p}`);
    if (name !== `${a.id}.ts`) problems.push(`${file}: the file is named for the finding it accepts (${a.id}.ts)`);
    const before = seen.get(a.id);
    if (before !== undefined) problems.push(`${file}: ${a.id} is accepted twice (${before})`);
    seen.set(a.id, file);
    acceptances.push(a);
  }
  return { acceptances, problems };
}

if (import.meta.main) {
  const dir = process.argv[2] ?? ACCEPTED_DIR;
  const r = await loadAcceptances(dir);
  for (const p of r.problems) process.stdout.write(`${p}\n`);
  process.stdout.write(`accepted-findings: ${r.acceptances.length} acceptances, ${r.problems.length} problems\n`);
  process.exitCode = r.problems.length > 0 ? 1 : 0;
}
