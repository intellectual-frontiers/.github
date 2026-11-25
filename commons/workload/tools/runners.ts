// Spec: 0010-workload-runners FR-014
/**
 * The generated artifacts of the integration runners for the fixtures of the library: the script of `synthetic-bootstrap-01` for each runner (`bash` and `pwsh`), from the code, in `commons/workload/artifacts/`.
 * `bun commons/workload/tools/runners.ts` writes them and `--check` writes nothing and says which differ (a stale artifact, or one edited by hand, is `E-WL-RUNNER-DRIFT`), as every generator of this repository does.
 *
 * @module
 */
import { describeFinding } from "../src/governance/mod.ts";
import { bootstrapFleet, SYNTHETIC_BOOTSTRAP_01 } from "../src/logical/forms/runbook/mod.ts";
import { checkArtifact, EMITTERS, emitWorkload } from "../src/physical/mod.ts";
import { fs, path, proc } from "@intellectual-frontiers/system";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "..");
const FOLDER = "commons/workload/artifacts";
const INPUT = { fleet: bootstrapFleet };

/** Every file this writes, with its text, by its path from the root of the repository. */
export async function outputs(): Promise<Readonly<Record<string, string>>> {
  const out: Record<string, string> = {};
  for (const e of EMITTERS) {
    const made = await emitWorkload(SYNTHETIC_BOOTSTRAP_01, e.runner.id, INPUT);
    if (made.kind === "err") throw new Error(made.error.map(describeFinding).join("\n"));
    out[`${FOLDER}/${made.value.path}`] = made.value.text;
  }
  return out;
}

if (import.meta.main) {
  const check = proc.args.includes("--check");
  const stale: string[] = [];
  for (const [file, text] of Object.entries(await outputs())) {
    const full = path.join(ROOT, file);
    const have = (await fs.exists(full)) ? await fs.readTextFile(full) : undefined;
    if (have === text) continue;
    stale.push(file);
    if (!check) {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeTextFile(full, text);
    }
  }
  if (check) {
    for (const e of EMITTERS) {
      const file = `${FOLDER}/${SYNTHETIC_BOOTSTRAP_01.id}.${e.extension}`;
      const full = path.join(ROOT, file);
      if (!(await fs.exists(full))) continue;
      for (const f of await checkArtifact(await fs.readTextFile(full), SYNTHETIC_BOOTSTRAP_01, e.runner.id, INPUT)) console.error(describeFinding(f));
    }
  }
  if (check && stale.length > 0) {
    console.error(`stale: ${stale.join(", ")}: run bun commons/workload/tools/runners.ts`);
    proc.exit(1);
  }
  console.log(check ? "the artifacts are current" : `wrote ${stale.length} files`);
}
