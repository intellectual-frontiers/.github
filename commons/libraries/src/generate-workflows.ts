/**
 * The workflows of this repository, written from the typed model (commons 0030-generated-workflows FR-001, FR-004, FR-006, FR-008): every file under `.github/workflows/` is `<name>.auto.yml` and made here, and so is
 * `.github/actions/bun/action.yml`, whose name GitHub fixes.
 *
 *     bun commons/libraries/src/generate-workflows.ts            write the files that are not what the model makes
 *     bun commons/libraries/src/generate-workflows.ts --check    write nothing and exit 1 where a file is not what the model makes, where a workflow is written by hand, or where the model has a finding
 *     other flags: --repo DIR (the repository, the working folder by default)
 *
 * @remarks
 * The workflow of each library of commons is made from its manifest (`commons/<name>/library.ts`, 0027-commons-libraries FR-012) and the facts of its CI that the manifest does not hold
 * (`LIBRARY_CI` of `workflows/definitions.ts`); the others are written as values there. A file that is not `.auto.yml` in the workflows' folder, and a generated file that no workflow makes, are findings
 * (nothing is deleted). Line ends are not compared: a Windows checkout of a file is the file.
 *
 * @limits
 * It reads manifests and writes files; it does not run a workflow and does not ask GitHub whether it accepts one (`tests/commons-workflows-schema.test.ts` validates the files against the schema GitHub's tools publish).
 *
 * Spec: 0001-libraries FR-005
 *
 * @module
 */
import process from "node:process";
import { ACTIONS, workflows } from "./workflows/definitions.ts";
import { policyFindings } from "./ci/inventory.ts";
import { validateAction, validateWorkflow } from "./workflows/model.ts";
import { renderAction, renderWorkflow } from "./workflows/render.ts";
import { readLibraries } from "./libraries.ts";
import { existsSync, readDirSync, readTextFileSync, writeTextFileSync, mkdirSync } from "@intellectual-frontiers/system/fs";
import { stdio } from "@intellectual-frontiers/system";

const RUN = "bun commons/libraries/src/generate-workflows.ts";
const FOLDER = ".github/workflows";

/** The files the model makes, by their path from the repository's root, and what is wrong with the model or the folder. */
export function outputs(repo: string): { readonly files: ReadonlyMap<string, string>; readonly problems: readonly string[] } {
  const root = repo.replace(/[\\/]$/, "");
  const problems: string[] = [];
  for (const f of readLibraries(root)) {
    if ("problem" in f) problems.push(`commons/${f.dir}/library.ts: ${f.problem}`);
    else {
      if (f.library.distribution.includes("npm") && !existsSync(`${root}/commons/${f.dir}/tools/pack.ts`))
        problems.push(
          `commons/${f.dir} is published to npm and has no tools/pack.ts, which the release workflow runs (0030-generated-workflows FR-009)`,
        );
    }
  }
  const files = new Map<string, string>();
  for (const w of workflows()) {
    problems.push(...validateWorkflow(w), ...policyFindings(w));
    files.set(`${FOLDER}/${w.file}.auto.yml`, renderWorkflow(w));
  }
  for (const a of ACTIONS) {
    problems.push(...validateAction(a));
    files.set(`.github/actions/${a.folder}/action.yml`, renderAction(a));
  }
  const dir = `${root}/${FOLDER}`;
  for (const e of existsSync(dir) ? readDirSync(dir) : []) {
    if (!e.isFile) continue;
    const path = `${FOLDER}/${e.name}`;
    if (!e.name.endsWith(".auto.yml"))
      problems.push(`${path} is written by hand: a workflow is made by ${RUN} and is named <name>.auto.yml (FR-001)`);
    else if (!files.has(path)) problems.push(`${path} is no workflow's file: remove it, or give the model a workflow for it (FR-004)`);
  }
  return { files, problems };
}

const lf = (s: string): string => s.replace(/\r\n/g, "\n");

/** Writes (or, with `write` false, only compares) the files; the paths that are not what the model makes, and the problems. */
export function synchronize(repo: string, write: boolean): { readonly stale: readonly string[]; readonly problems: readonly string[] } {
  const root = repo.replace(/[\\/]$/, "");
  const { files, problems } = outputs(root);
  const stale: string[] = [];
  for (const [path, text] of files) {
    const at = `${root}/${path}`;
    if (existsSync(at) && lf(readTextFileSync(at)) === text) continue;
    stale.push(path);
    if (write && problems.length === 0) {
      mkdirSync(at.slice(0, at.lastIndexOf("/")), { recursive: true });
      writeTextFileSync(at, text);
    }
  }
  return { stale, problems };
}

/** The command line. Returns the exit status: 0, or 1 where a file is not what the model makes, a workflow is written by hand or the model has a finding. */
export function main(argv: readonly string[]): number {
  const at = argv.indexOf("--repo");
  const repo = at >= 0 ? (argv[at + 1] ?? ".") : ".";
  const check = argv.includes("--check");
  const r = synchronize(repo, !check);
  for (const p of r.problems) stdio.stderr.writeSync(`${p}\n`);
  for (const s of r.stale) stdio.stderr.writeSync(check ? `${s} is not what the model makes; run: ${RUN}\n` : `wrote ${s}\n`);
  return r.problems.length > 0 || (check && r.stale.length > 0) ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
