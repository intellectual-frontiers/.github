// Spec: 0030-generated-workflows FR-014
/**
 * The golden copy of every generated workflow (commons 0030-generated-workflows FR-014): the files the model makes today, kept byte for byte in `tests/fixtures/workflows-golden/`, so that a change of how they are made (a definition written
 * as a graph of workload, 0016-ci-on-graph) shows as a difference of bytes and never as a surprise in CI. The test renders every workflow and composite action of the model, compares each with its
 * golden copy and with the file that is checked in, and finds a golden copy that no workflow makes. A deliberate change of CI refreshes the copies with `UPDATE_GOLDEN=1 bun test tests/commons-workflows-golden.test.ts`.
 *
 * @module
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ACTIONS, workflows } from "../commons/libraries/src/workflows/definitions.ts";
import { renderAction, renderWorkflow } from "../commons/libraries/src/workflows/render.ts";
import { path } from "../commons/system/src/mod.ts";
import { assert, assertEquals, proves } from "../commons/test/src/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const GOLDEN = join(ROOT, "tests", "fixtures", "workflows-golden");

/** Every file the model makes, by the name of its golden copy and the path it has in the repository. */
const made = (): readonly { readonly golden: string; readonly file: string; readonly text: string }[] => [
  ...workflows().map((w) => ({ golden: `${w.file}.auto.yml`, file: `.github/workflows/${w.file}.auto.yml`, text: renderWorkflow(w) })),
  ...ACTIONS.map((a) => ({ golden: `action-${a.folder}.yml`, file: `.github/actions/${a.folder}/action.yml`, text: renderAction(a) })),
];

proves(["0030-generated-workflows FR-014"], "every workflow and composite action of the model is byte for byte its golden copy and the file that is checked in, and a golden copy that nothing makes is found", () => {
  const files = made();
  if (process.env["UPDATE_GOLDEN"] === "1") {
    mkdirSync(GOLDEN, { recursive: true });
    for (const f of files) writeFileSync(join(GOLDEN, f.golden), f.text);
  }
  assert(files.length >= 8, "the model makes the seven workflows and the composite action");
  for (const f of files) {
    assert(existsSync(join(GOLDEN, f.golden)), `${f.golden}: no golden copy; run UPDATE_GOLDEN=1 bun test tests/commons-workflows-golden.test.ts`);
    const golden = readFileSync(join(GOLDEN, f.golden), "utf8");
    assertEquals(f.text, golden, `${f.file} is not its golden copy`);
    assertEquals(readFileSync(join(ROOT, f.file), "utf8").replace(/\r\n/gu, "\n"), golden, `${f.file} as checked in is not its golden copy`);
  }
  const names = new Set(files.map((f) => f.golden));
  assertEquals(readdirSync(GOLDEN).filter((n) => !names.has(n)), [], "a golden copy that no workflow makes");
});
