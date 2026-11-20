// Spec: 0004-package-managers-dialect FR-003, FR-007
/**
 * The program of the kit, which the steps of a manager dialect run: `check PLAN` changes nothing and says, tool by tool, whether it is installed or would be installed, ending with the status 2 where
 * something would change; `apply PLAN` installs what is not, and a second `apply` of the same plan changes nothing where the manager can be asked. It runs only the commands the plan file holds, which
 * is the digest-named file a person reviewed, and never through a shell. Every failure names the tool, the step and the one action that is next.
 *
 * ```sh
 * bun bin.ts check .archon/<digest>/<dialect>/plan.json
 * bun bin.ts apply .archon/<digest>/<dialect>/plan.json
 * ```
 *
 * @module
 */
import * as fs from "@intellectual-frontiers/system/fs";
import * as proc from "@intellectual-frontiers/system/proc";
import { readPlanFile, type PlanLine } from "@intellectual-frontiers/package-managers/logical";
import { runWithin, type Run } from "./runner.ts";

/** What the program says to the world and runs programs with; a test passes its own. */
export type Io = {
  readonly out: (line: string) => void;
  /** Runs a check, which is short. */
  readonly ask?: Run;
  /** Runs an install, which may take long. */
  readonly install?: Run;
};

type Asked = { readonly state: "installed" | "missing" | "unknown" | "failed"; readonly note: string };

async function asked(line: PlanLine, ask: Run): Promise<Asked> {
  if (line.check === null || line.missingExit === null) return { state: "unknown", note: "this manager cannot be asked" };
  const said = await ask(line.check);
  if (said === undefined) return { state: "failed", note: `${line.check.join(" ")} could not be run or did not answer in time` };
  if (said.status === 0) return { state: "installed", note: "" };
  if (said.status === line.missingExit) return { state: "missing", note: "" };
  return { state: "failed", note: `${line.check.join(" ")} ended with status ${said.status}, which is neither installed (0) nor missing (${line.missingExit})` };
}

/** Runs the program with its arguments and returns its exit status. */
export async function main(argv: readonly string[], io: Io): Promise<number> {
  const [command, file] = argv;
  if ((command !== "check" && command !== "apply") || file === undefined) {
    io.out("usage: bin check PLAN | bin apply PLAN");
    return 64;
  }
  const text = await fs.readTextOr(file);
  if (text === undefined) {
    io.out(`❌ the plan file ${file} could not be read. Next: run the render again and use the path it gives`);
    return 1;
  }
  const plan = readPlanFile(text);
  if (plan.kind === "err") {
    io.out(`❌ ${file} is not a plan of this program: ${plan.error}. Next: render it again`);
    return 1;
  }
  const ask = io.ask ?? runWithin(30_000);
  const install = io.install ?? runWithin(1_800_000);
  let changes = 0;
  let failures = 0;
  for (const line of plan.value.lines) {
    const label = `${line.tool}${line.version === null ? "" : ` ${line.version}`}`;
    const state = await asked(line, ask);
    if (state.state === "failed") {
      failures++;
      io.out(`❌ ${label}: check: ${state.note}. Next: run the check by hand and fix what it says`);
      continue;
    }
    if (state.state === "installed") {
      io.out(`✅ ${label}: installed by ${plan.value.manager}, nothing to do`);
      continue;
    }
    changes++;
    if (command === "check") {
      io.out(`⚡ ${label}: would install ${line.packages.join(" ")} with ${plan.value.manager}${state.state === "unknown" ? " (it cannot be asked first)" : ""}`);
      continue;
    }
    const said = await install(line.install);
    if (said === undefined) {
      failures++;
      io.out(`❌ ${label}: install: ${line.install.join(" ")} could not be run or did not finish in time. Next: run it by hand and read what it says`);
    } else if (said.status !== 0) {
      failures++;
      const tail = said.stdout.trim().split("\n").slice(-3).join(" | ");
      io.out(`❌ ${label}: install: ${line.install.join(" ")} ended with status ${said.status}${tail === "" ? "" : ` and said ${tail}`}. Next: run it by hand${line.admin ? " with administrator rights" : ""}`);
    } else io.out(`✅ ${label}: installed with ${plan.value.manager}`);
  }
  if (failures > 0) return 1;
  return command === "check" && changes > 0 ? 2 : 0;
}

if (import.meta.main) {
  proc.exit(await main(proc.args, { out: (line) => console.log(line) }));
}
