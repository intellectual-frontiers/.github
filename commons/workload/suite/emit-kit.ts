/**
 * What the tests of the emitters share: the artifacts of the fixture, a fake verb command that records the calls it gets, a way to run a script against it with a clean environment, and the lint of a script. Every name is synthetic.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Artifact, emitWorkload } from "@intellectual-frontiers/workload/physical";
import { bootstrapFleet, SYNTHETIC_BOOTSTRAP_01 } from "@intellectual-frontiers/workload/forms/runbook";
import { authored, runnerId } from "@intellectual-frontiers/workload/governance";
import { must } from "./kit.ts";

export const INPUT = { fleet: bootstrapFleet };

/** The artifact of the bootstrap runbook for a runner. */
export const artifactOf = async (runner: "bash" | "pwsh"): Promise<Artifact> => must(await emitWorkload(SYNTHETIC_BOOTSTRAP_01, authored(runnerId(runner)), INPUT));

/** Whether a program runs here: the tests that need it say so where they are skipped. */
export const have = (program: string): boolean => spawnSync(program, ["--version"], { encoding: "utf8", env: { ...process.env, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: "1" } }).status === 0;

/** Says out loud that a check was skipped because a program is not installed: a skipped check is never a pass that was not said. */
export const skipped = (what: string, program: string): void => console.log(`UNVERIFIED here: ${what} (${program} is not installed on this machine)`);

/** A folder with a fake verb command named `workload`: it appends the arguments it gets, one line for each call, to `log`, and exits with 7 where the verb id (its second argument) is the one in `FAKE_FAIL_VERB`. */
export function fakeWorld(): { readonly dir: string; readonly bin: string; readonly log: string; calls(): readonly string[]; run(command: string, args: readonly string[], env?: Readonly<Record<string, string>>): { readonly status: number | null; readonly stdout: string; readonly stderr: string }; close(): void } {
  const dir = mkdtempSync(join(tmpdir(), "workload-emit-"));
  const bin = join(dir, "bin");
  const log = join(dir, "calls.log");
  spawnSync("mkdir", ["-p", bin]);
  writeFileSync(join(bin, "workload"), '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> "${FAKE_LOG}"\nif [[ "${2:-}" == "${FAKE_FAIL_VERB:-}" ]]; then exit 7; fi\n');
  chmodSync(join(bin, "workload"), 0o755);
  writeFileSync(log, "");
  return {
    dir,
    bin,
    log,
    calls: () => readFileSync(log, "utf8").split("\n").filter((l) => l !== ""),
    run: (command, args, env = {}) => {
      const r = spawnSync(command, [...args], { encoding: "utf8", env: { PATH: `${bin}:${process.env["PATH"] ?? ""}`, HOME: dir, FAKE_LOG: log, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: "1", ...env } });
      return { status: r.status, stdout: r.stdout, stderr: r.stderr };
    },
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Writes a script into the folder of a world and gives its path. */
export function write(world: { readonly dir: string }, name: string, text: string): string {
  const path = join(world.dir, name);
  writeFileSync(path, text);
  return path;
}

/** Where a `$` of a Bash script is not inside double quotes (outside single quotes, comments and the trap text): each is an expansion that is not quoted. */
export function unquotedExpansions(script: string): readonly string[] {
  const out: string[] = [];
  for (const [n, line] of script.split("\n").entries()) {
    if (line.trimStart().startsWith("#")) continue;
    let state: "none" | "single" | "double" = "none";
    for (let i = 0; i < line.length; i++) {
      const c = line.charAt(i);
      if (state === "single") {
        if (c === "'") state = "none";
      } else if (state === "double") {
        if (c === "\\") i++;
        else if (c === '"') state = "none";
      } else if (c === "'") state = "single";
      else if (c === '"') state = "double";
      else if (c === "\\") i++;
      else if (c === "$") out.push(`${n + 1}: ${line.trim()}`);
    }
  }
  return out;
}
