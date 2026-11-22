// Spec: 0005-planning-surfaces FR-003
/**
 * `planctl`, the program of Planning (commons planning 0005-planning-surfaces FR-003, FR-004): a command line on Headless over the repository the run started in, whose `planning.config.ts` names the sources and the store.
 * Its words are parsed, a run proceeds, previews or is refused as the facts of its verbs say, the output is drawn (or the one JSON document of `--json`), the problems come with the verdict and the one `next:` command on
 * standard error, and the program explains its problem codes (`planctl explain <code>`). The tier it holds is the one the variable `PLANCTL_TIER` names: reader or writer, writer where it says nothing.
 *
 * ```sh
 * planctl collect --trust
 * planctl plan 0190 --source markdown --do close
 * planctl apply 0190 --source markdown --do close --preview-hash HASH
 * ```
 *
 * @remarks
 * A run ends in Headless' statuses: 0 ok, 1 findings, 2 a command line that does not fit, 3 a host that cannot do it, 4 where a check finds something pending (a place and the store differ, a plan that would write).
 *
 * @example
 * ```ts
 * import { main } from "./planctl.ts";
 * const status = await main(["help"], { cwd: "/tmp", out: () => undefined, err: () => undefined });
 * status; // 0
 * ```
 *
 * @module
 */
import process from "node:process";
import { launch } from "@intellectual-frontiers/headless/cli";
import type { GitHostClient, RepoRef } from "@intellectual-frontiers/githost";
import { type Host, LADDER, planctlProgram } from "@intellectual-frontiers/planning/physical";

/** What `main` is given besides the command line; each is read from this process where it is not. */
export type MainDeps = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: string;
  readonly out?: (text: string) => void;
  readonly err?: (text: string) => void;
  readonly now?: () => number;
  readonly githost?: (ref: RepoRef) => GitHostClient | undefined;
};

/** Runs `planctl` with the words after its name; returns the exit status. */
export async function main(argv: readonly string[], deps: MainDeps = {}): Promise<number> {
  const environment = deps.env ?? process.env;
  const env = (name: string): string | undefined => (environment[name] === "" ? undefined : environment[name]);
  const word = env("PLANCTL_TIER");
  const tier = word === undefined ? LADDER.default : LADDER.ladder.find((t) => t === word);
  if (tier === undefined) {
    (deps.err ?? ((t: string): void => void process.stderr.write(t)))(`planctl: ${word} is not a tier (reader, writer)\n`);
    return 2;
  }
  const host: Host = { cwd: deps.cwd ?? process.cwd(), env, now: deps.now ?? (() => Date.now()), channel: "cli", ...(deps.githost === undefined ? {} : { githost: deps.githost }) };
  return await launch(planctlProgram(host), {
    argv,
    io: {
      env,
      tier,
      ...(deps.out === undefined && deps.err === undefined
        ? {}
        : { sink: { out: deps.out ?? ((t: string): void => void process.stdout.write(t)), err: deps.err ?? ((t: string): void => void process.stderr.write(t)) } }),
    },
  });
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
