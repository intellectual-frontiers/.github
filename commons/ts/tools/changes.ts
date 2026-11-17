/**
 * The change-control check with a Git host (commons 0020-ifccm FR-009, FR-028 to FR-030): `mizan/changes.ts` judges commits and, with `--strict`, asks the host about each issue they name,
 * but it is given its host's client and never makes one. This command makes it from the repository's `origin` (`githost/remote.ts` reads the remote, `githost/mod.ts` makes the client,
 * with a token only from the environment) and runs the check, so that `--strict` asks GitHub or GitLab and a plain Git remote is `not_run` with its reason.
 *
 *     bun commons/ts/tools/changes.ts [--repo DIR] [--strict] [--range A..B] ...    every flag of `mizan/changes.ts`
 *
 * @module
 */
import process from "node:process";
import { clientFor, parseRemote } from "../githost/mod.ts";
import { run as changes } from "../mizan/changes.ts";
import { env, run } from "../runtime/proc.ts";

/** The command line. Returns the exit status of the check (0, 1, 2, 3). */
export async function main(argv: readonly string[]): Promise<number> {
  const i = argv.indexOf("--repo");
  const repo = i >= 0 ? argv[i + 1] : undefined;
  const cwd = repo ?? process.cwd();
  if (!argv.includes("--strict")) return changes(argv);
  const origin = await run(["git", "-C", cwd, "remote", "get-url", "origin"]);
  const parsed = origin.code === 0 ? parseRemote(origin.stdout.trim()) : undefined;
  if (parsed === undefined || parsed.kind === "err") return changes(argv);
  const environment = Object.fromEntries(["GITHUB_TOKEN", "GH_TOKEN", "GITLAB_TOKEN", "CI_JOB_TOKEN"].map((k) => [k, env.get(k)]));
  return changes(argv, { client: clientFor(parsed.value, { env: environment }), home: parsed.value });
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
