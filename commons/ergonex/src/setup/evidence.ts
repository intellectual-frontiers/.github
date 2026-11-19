// Spec: 0002-workspace-model FR-041
/**
 * The content of a run's evidence record (commons 0002-workspace-model FR-041 to FR-043): every run of a command of `ergonex` is one record in the IFQS test-record shape (0021-ifqs), named by the
 * run's UTC time and identifier and never overwritten, naming the command and its options, the hash of the plan, the version of each tool probed or installed, the hash of the state record, the
 * findings and the exit status, and holding no credential and no file content; where a check did not run it is `not_run` with its reason, and where a regulated domain is named every tool used
 * is named with its version.
 *
 * @remarks
 * A record of the quality system is a set of cases (`checkRun`): each fact of the run is a case whose name states it (`ergonex/run: ergonex setup --apply`, `ergonex/plan: sha256 ...`, `ergonex/tool: git 2.43.0`,
 * `ergonex/exit: Findings`), each finding is a failed case with its rule, file and message, and a check that did not run is `not_run`. `runRules` makes the cases and `checkRun` (the quality
 * module) makes the record; the host layer (`host/evidence.ts`) writes it once. The options are only the NAMES of the flags: a value that follows a flag is never kept.
 *
 * @module
 */
import { type Finding } from "../findings.ts";
import { isRegulated, type Policy } from "../policy.ts";
import { scanText } from "../scan/secrets.ts";

/** The facts of a run that its evidence names. */
export type RunFacts = {
  /** The command, such as `setup`, `tools`, `doctor`. */
  readonly command: string;
  /** The arguments as given; only the names of flags are kept in the evidence, never a value. */
  readonly argv: readonly string[];
  /** The SHA-256 of the plan, where the run made one. */
  readonly planSha256?: string;
  /** The SHA-256 of the state record after the run, where there is one. */
  readonly stateSha256?: string;
  /** The version of each tool probed or installed, by name. */
  readonly tools: Readonly<Record<string, string>>;
  readonly findings: readonly Finding[];
  /** The exit status, by name (`Ok`, `Findings`, `Usage`, `Environment`). */
  readonly exit: string;
  /** Checks that did not run, each with its name and why. */
  readonly notRun: readonly {
    readonly name: string;
    readonly reason: string;
  }[];
  readonly policy: Policy;
};

/** The options of an argument vector as the evidence keeps them: the names of the flags (`--apply`), never a value (`--home=/x` is `--home`; a word that is not a flag is dropped). */
export function optionNames(argv: readonly string[]): readonly string[] {
  return argv.filter((a) => a.startsWith("-")).map((a) => a.split("=")[0] ?? a);
}

/** One rule of a run's record, in the shape the quality module's `checkRun` takes: the rule, what it found (a file and a message each) and, where it did not run, why. */
export type EvidenceRule = {
  readonly id: string;
  readonly findings: readonly {
    readonly file: string;
    readonly message: string;
  }[];
  readonly notRun?: string;
};

/** The cases of a run's record: the facts as passing cases, each failing rule's findings as failing cases, and the checks that did not run. */
export function runRules(facts: RunFacts): readonly EvidenceRule[] {
  const rules: EvidenceRule[] = [];
  const fact = (id: string): void => void rules.push({ id, findings: [] });
  const options = optionNames(facts.argv);
  fact(`ergonex/run: ergonex ${[facts.command, ...options].join(" ")}`);
  if (facts.planSha256 !== undefined) fact(`ergonex/plan: sha256 ${facts.planSha256}`);
  if (facts.stateSha256 !== undefined) fact(`ergonex/state: sha256 ${facts.stateSha256}`);
  for (const name of Object.keys(facts.tools).sort()) fact(`ergonex/tool: ${name} ${facts.tools[name] ?? ""}`);
  const byRule = new Map<string, { file: string; message: string }[]>();
  for (const f of facts.findings) {
    const rows = byRule.get(f.ruleId) ?? [];
    rows.push({ file: f.subject, message: `${f.severity}: ${f.message}` });
    byRule.set(f.ruleId, rows);
  }
  for (const id of [...byRule.keys()].sort()) rules.push({ id, findings: byRule.get(id) ?? [] });
  for (const n of facts.notRun) rules.push({ id: n.name, findings: [], notRun: n.reason });
  fact(`ergonex/exit: ${facts.exit}`);
  return rules;
}

/** How many cases (and so span ids) the rules make: one for each rule that ran clean or did not run, one for each finding of the others. */
export function caseCount(rules: readonly EvidenceRule[]): number {
  return rules.reduce((n, r) => n + (r.notRun !== undefined ? 0 : Math.max(1, r.findings.length)), 0);
}

/** The tools whose version a regulated run must name (0002-workspace-model FR-043) that the facts do not: none where no domain is regulated, else `git`, `bun` and `node` and every tool installed. */
export function missingToolVersions(facts: Pick<RunFacts, "tools" | "policy">, used: readonly string[]): readonly string[] {
  if (!isRegulated(facts.policy)) return [];
  return used.filter((t) => !Object.hasOwn(facts.tools, t));
}

/** Whether a record's text holds a secret of the shapes the secrets scan knows: the evidence must hold none (0002-workspace-model FR-042). */
export function holdsCredential(recordText: string): boolean {
  return scanText("evidence", recordText).length > 0;
}

/** The name of a run's evidence file below `<home>/.ergonex/evidence/`: the UTC time and the run's identifier (the trace id), so it sorts by time and is never reused. */
export function evidenceFileName(endIso: string, traceId: string): string {
  // to the millisecond, so that the names of one workspace's records sort in the order of their runs
  const stamp = endIso.replace(/[-:]/g, "").replace(/Z$/, "");
  return `${stamp}Z-${traceId}.otlp.json`;
}
