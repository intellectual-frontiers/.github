// Spec: 0003-repoctl-sync FR-007
/**
 * `repoctl check` (commons repoctl 0003-repoctl-sync FR-007, FR-008): every check of the repository in one report. A section is one check (a generator's, the specification kit of commons, the rules of Mizan, the versions, the
 * specification kit of each library, the constants that say a version) with its findings, each a code of the closed union that `repoctl explain` explains and the command that fixes it. Nothing is written.
 *
 * @example
 * ```ts
 * import { sectionOk } from "./check.ts";
 * sectionOk({ id: "specs", title: "The specification kit of commons", findings: [] }); // true
 * ```
 *
 * @module
 */
import { type Config, stepText } from "@intellectual-frontiers/repoctl/governance";
import { constantFindings, type Source } from "./constants.ts";
import { finding, type Finding, tailLines } from "./findings.ts";
import { fixOf } from "./order.ts";
import { pool } from "./pool.ts";
import type { LibraryInfo, Run, World } from "./ports.ts";
import { runStep } from "./step.ts";
import { findingsOfSync, runSync } from "./sync.ts";

/** One check and what it found. */
export type Section = { readonly id: string; readonly title: string; readonly findings: readonly Finding[] };

/** Every section, in the order they are reported. */
export type CheckReport = { readonly sections: readonly Section[] };

/** Whether a section found nothing that fails. */
export function sectionOk(s: Section): boolean {
  return s.findings.every((f) => f.level !== "fail");
}

/** Whether a whole report found nothing that fails. */
export function reportOk(r: CheckReport): boolean {
  return r.sections.every(sectionOk);
}

/** How many findings a check's output is made into, so that a broken check does not drown the report. */
const MOST = 12;

/** What a check program's end is as findings: none where it ended with 0, one for each line it said where it ended with 1, and a warning that it did not run for any other status. */
export function findingsOfProgram(run: Run, code: Finding["code"], fix: string): readonly Finding[] {
  if (run.code === 0) return [];
  const said = tailLines(`${run.stderr}\n${run.stdout}`, 200);
  if (run.code === 1) {
    const shown = said.slice(0, MOST).map((l) => finding("fail", code, l, fix));
    return said.length > MOST ? [...shown, finding("fail", code, `and ${said.length - MOST} more lines; run ${fix} to read them`, fix)] : shown;
  }
  return [finding("warn", "E-ENVIRONMENT", `the check could not run (status ${run.code}): ${said.slice(-2).join("; ")}`, fix)];
}

const fill = (argv: readonly string[], values: Readonly<Record<string, string>>): readonly string[] => argv.map((w) => w.replace(/\{(kit|level)\}/g, (_m, k: string) => values[k] ?? ""));

/** What a check of the specification kit of one library is: the program that judges its format, then the one that judges its rules at its level (the configuration's words, with `{kit}` and `{level}` filled). */
async function specKitSection(w: Pick<World, "process" | "repo">, specKit: { readonly format: readonly string[]; readonly rules: readonly string[] }, lib: LibraryInfo): Promise<Section> {
  const kit = `${lib.folder}/${lib.specKit ?? "spec-kit"}`;
  const values = { kit, level: lib.level };
  const here = { cwd: w.repo };
  const format = fill(specKit.format, values);
  const rules = fill(specKit.rules, values);
  const [f, r] = [await w.process.run(format, here), await w.process.run(rules, here)];
  return {
    id: `spec-kit:${lib.name}`,
    title: `The specification kit of ${lib.name}`,
    findings: [...findingsOfProgram(f, "E-SPEC-KIT", format.join(" ")), ...findingsOfProgram(r, "E-MIZAN-RULE", rules.join(" "))],
  };
}

/** The sources of the libraries that are read for constants. */
async function sourcesOf(w: Pick<World, "files" | "repo">, libs: readonly LibraryInfo[]): Promise<readonly Source[]> {
  const out: Source[] = [];
  for (const lib of libs) {
    const base = `${w.repo}/${lib.folder}`;
    const paths = new Set<string>([...(await w.files.walk(`${base}/src`)).filter((p) => p.endsWith(".ts")).map((p) => `src/${p}`), ...lib.versionConstants.map((c) => c.file)]);
    for (const inside of [...paths].sort()) {
      const text = await w.files.read(`${base}/${inside}`);
      if (text !== undefined) out.push({ path: `${lib.folder}/${inside}`, text });
    }
  }
  return out;
}

/** Runs every check of the configuration: the generators', its named checks, and, where it has libraries, the specification kit of each and the constants that say a version. */
export async function runCheck(w: World, config: Pick<Config, "generators" | "checks" | "libraries">): Promise<CheckReport> {
  const sections: Section[] = [];
  const synced = await runSync(w, "check", config.generators);
  for (const o of synced.outcomes) {
    const g = config.generators.find((x) => x.id === o.id);
    sections.push({ id: `generator:${o.id}`, title: `The files of the generator ${o.id}`, findings: findingsOfSync({ mode: "check", outcomes: [o] }).map((f) => (g === undefined ? f : { ...f, fix: fixOf(g) })) });
  }
  for (const c of config.checks) sections.push({ id: c.id, title: c.summary, findings: findingsOfProgram(await runStep(w, c.run), c.code, stepText(c.run)) });
  if (config.libraries === undefined) return { sections };
  const libs = await w.libraries.list();
  if (libs.kind === "err") {
    sections.push({ id: "libraries", title: "The manifests of the libraries", findings: [finding("fail", "E-LIBRARY-CHECK", libs.error, "repoctl doctor")] });
    return { sections };
  }
  const specKit = config.libraries.specKit;
  if (specKit !== undefined) for (const s of await pool(libs.value.filter((l) => l.specKit !== undefined), 6, (l) => specKitSection(w, specKit, l))) sections.push(s);
  if (config.libraries.versionConstants) sections.push({ id: "version-constants", title: "The constants of the sources that say a version", findings: constantFindings(libs.value, await sourcesOf(w, libs.value)) });
  return { sections };
}
