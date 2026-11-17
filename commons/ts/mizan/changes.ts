/**
 * The `changes` check of Intellectual Frontiers Capabilities Configuration Management (commons 0020-ifccm): every commit of a range names the change request it serves, a closing word is
 * `Closes` and only on the commit that finishes a capability, a departure from a specification has a Decision, a relaxed declaration is found, and each requirement can be followed from its issue
 * to the run that proved it.
 *
 *     bun commons/ts/mizan/changes.ts --range origin/main..HEAD         judge the commits of the range (offline: no network)
 *     bun commons/ts/mizan/changes.ts --range A..B --strict             also ask the Git host for each change request the commits name
 *     bun commons/ts/mizan/changes.ts --declaration FILE                read the harness's record (declaration, decisions, roles) from FILE (`ifccm.declaration.ts` by default)
 *     bun commons/ts/mizan/changes.ts --capabilities FILE --document FILE [--check]
 *                                                                        write the view of capabilities by rung into the document, or with --check fail where it differs
 *     bun commons/ts/mizan/changes.ts --trace ISSUE_BODY_FILE [--runs RECORD] [--specs DIR]
 *                                                                        follow each requirement of a `Done when` from its term to the run, and say where the chain ends
 *     other flags: --repo DIR (the repository, the working folder by default), --today YYYY-MM-DD, --baseline FILE (`changes.baseline.txt` of the repository by default), --write-baseline
 *
 * Exit status: 0 clean, 1 findings (or a stale baseline line, or a chain that breaks, or a view that differs), 2 usage, 3 environment (no `git`, not a repository, a file that cannot be read).
 * A strict rule that could not ask the host is `not_run` with its reason on standard error and is never reported as passed (0020-ifccm FR-030). The host's client is given to `run`, never made
 * here: whoever wires the adapters passes it.
 *
 * @module
 */
import process from "node:process";
import type { GitHostClient, RepoRef } from "../githost/types.ts";
import { formatBaseline, judge, parseBaseline, passes, report } from "../kernel/trace.ts";
import { readRecord } from "../kernel/test-report.ts";
import { existsSync, readDirSync, readTextFileSync, writeTextFileSync } from "../runtime/fs.ts";
import { formatGitError } from "../runtime/git.ts";
import { cwd } from "../runtime/proc.ts";
import { join, relative, resolve } from "../runtime/path.ts";
import { stdio } from "../runtime/mod.ts";
import { decodeViewRecord, formatViewError, spliceView, viewIsCurrent, viewOf } from "./changes/capability-view.ts";
import { dayOf, decodeHarnessRecord, formatRecordError, type HarnessRecord, phaseOf, relaxations } from "./changes/declaration.ts";
import { declarationHistory, readRange } from "./changes/git-log.ts";
import { doneWhenRequirements, parseIssueBody } from "./changes/issue-body.ts";
import {
  CHANGES_RULES,
  type ChangesFinding,
  commitFindings,
  declarationFindings,
  relaxationFindings,
  ruleCases,
  STRICT_RULES,
  strictFindings,
} from "./changes/rules.ts";
import { askHost, NO_CLIENT } from "./changes/strict.ts";
import { type RunCase, traceLines, traceOf, firstBreak } from "./changes/trace.ts";
import { readSpecTexts } from "./spec-files.ts";
import { packagingTerms } from "../../ontology/audit/mod.ts";
import * as ifccmOntology from "../../ontology/ifccm/mod.ts";
import * as ifqsOntology from "../../ontology/ifqs/mod.ts";
import * as ifwsOntology from "../../ontology/ifws/mod.ts";
import { terms } from "../../ontology/mizan/mod.ts";

/** One rule's result in a run of the check (0020-ifccm FR-031): its findings, or the reason it did not run. Its shape is the quality system's `CheckRule`, so a caller keeps it as a record without this file knowing the quality system. */
export type RuleResult = {
  readonly id: string;
  readonly findings: readonly { readonly file: string; readonly line?: number; readonly message: string }[];
  readonly notRun?: string;
};

/** The rules that need no range of commits: the declaration's own, and its history. */
const WITHOUT_RANGE: readonly string[] = ["changes/declaration", "changes/gate-relaxed"];

/** What the command is given besides its arguments: the host's client and the repository it serves, which the command never makes, and where it writes. */
export type Deps = {
  /** Called once with each rule's result where the check judged commits or a declaration (0020-ifccm FR-031), so that the caller can keep it as a record. */
  readonly onRules?: (rules: readonly RuleResult[]) => void;
  readonly client?: GitHostClient;
  /** The repository on the host that the commits belong to; a reference `#N` is asked of it. */
  readonly home?: RepoRef;
  readonly out?: (text: string) => void;
  readonly err?: (text: string) => void;
};

/** The default name of a harness's record, in the repository's top folder. */
export const RECORD_FILE = "ifccm.declaration.ts";

/** The default name of the baseline of the check's findings, in the repository's top folder. */
export const BASELINE_FILE = "changes.baseline.txt";

const COMMENTS = [
  "The findings of the changes check (commons 0020-ifccm FR-011) held while the harness has not declared production.",
  "A new finding fails the check, and so does a line below that no longer occurs: when you fix one, delete its line.",
  "Never add a line to make a check pass. A finding in the gate phase is never held by this file.",
] as const;

type Flags = {
  readonly values: ReadonlyMap<string, string>;
  readonly switches: ReadonlySet<string>;
};

const VALUE_FLAGS = [
  "--repo",
  "--range",
  "--declaration",
  "--today",
  "--baseline",
  "--capabilities",
  "--document",
  "--trace",
  "--runs",
  "--specs",
] as const;
const SWITCH_FLAGS = ["--strict", "--check", "--write-baseline"] as const;

/** The flags of a command line, or the sentence that says what is wrong with it. */
function parseFlags(argv: readonly string[]): Flags | string {
  const values = new Map<string, string>();
  const switches = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    const eq = a.indexOf("=");
    const name = eq > 0 ? a.slice(0, eq) : a;
    if (SWITCH_FLAGS.some((f) => f === name) && eq < 0) switches.add(name);
    else if (VALUE_FLAGS.some((f) => f === name)) {
      const value = eq > 0 ? a.slice(eq + 1) : argv[++i];
      if (value === undefined || value === "") return `${name} needs a value`;
      values.set(name, value);
    } else return `unknown argument ${a}`;
  }
  return { values, switches };
}

/** Every `.ts` file under a folder (skipping `node_modules`, `.git` and `.claude`), as `{ path (relative, with /), text }`. */
function sourcesUnder(root: string): readonly { readonly path: string; readonly text: string }[] {
  const out: { readonly path: string; readonly text: string }[] = [];
  const walk = (dir: string): void => {
    for (const e of readDirSync(dir)) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === ".claude") continue;
      const p = join(dir, e.name);
      if (e.isDirectory) walk(p);
      else if (e.name.endsWith(".ts")) out.push({ path: relative(root, p).replaceAll("\\", "/"), text: readTextFileSync(p) });
    }
  };
  walk(root);
  return out;
}

/** The citations of requirements by the terms of commons' own ontologies (`mz:definedBy`), for the chain's third stage. */
function termCitations(): readonly { readonly term: string; readonly cites: readonly string[]; readonly file: string }[] {
  return [...terms, ...packagingTerms, ...ifccmOntology.terms, ...ifqsOntology.terms, ...ifwsOntology.terms].map((t) => ({
    term: t.values.termIri,
    cites: t.values.definedBy ?? [],
    file: "commons/ontology",
  }));
}

/** Run the command; the exit status (0 clean, 1 findings, 2 usage, 3 environment). */
export async function run(
  argv: readonly string[],
  deps: Deps = {},
  now: () => string = () => new Date().toISOString().slice(0, 10),
): Promise<number> {
  const out = deps.out ?? ((t: string): void => void stdio.stdout.writeSync(t));
  const log = deps.err ?? ((t: string): void => void stdio.stderr.writeSync(t));
  const flags = parseFlags(argv);
  if (typeof flags === "string") {
    log(
      `changes: ${flags}\nusage: changes.ts [--range A..B] [--strict] [--declaration FILE] [--check] [--capabilities FILE --document FILE] [--trace BODY] [--repo DIR] [--today DAY] [--baseline FILE] [--write-baseline]\n`,
    );
    return 2;
  }
  const value = (name: string): string | undefined => flags.values.get(name);
  const has = (name: string): boolean => flags.switches.has(name);
  const repo = resolve(value("--repo") ?? cwd());
  const today = value("--today") ?? now();
  if (dayOf(today) === undefined) {
    log(`changes: --today ${today} is not a day (YYYY-MM-DD)\n`);
    return 2;
  }
  if (has("--strict") && value("--range") === undefined) {
    log("changes: --strict asks the host about the commits of a range: give --range\n");
    return 2;
  }
  if (has("--check") && (value("--capabilities") === undefined || value("--document") === undefined)) {
    log("changes: --check needs --capabilities FILE and --document FILE\n");
    return 2;
  }

  // the harness's record
  const recordPath = value("--declaration") !== undefined ? resolve(repo, value("--declaration") ?? "") : join(repo, RECORD_FILE);
  let record: HarnessRecord = { declaration: undefined, decisions: [], roles: {} };
  if (existsSync(recordPath)) {
    const r = decodeHarnessRecord(readTextFileSync(recordPath));
    if (r.kind === "err") {
      log(`changes: ${recordPath}: ${formatRecordError(r.error)}\n`);
      return 3;
    }
    record = r.value;
  } else if (value("--declaration") !== undefined) {
    log(`changes: ${recordPath} does not exist\n`);
    return 3;
  }
  const phase = phaseOf(record.declaration, today);
  const recordName = relative(repo, recordPath).replaceAll("\\", "/");
  const findings: ChangesFinding[] = [...declarationFindings(record.declaration, recordName)];
  let notRun: string | undefined;
  let failed = false;

  // the declaration's history: a day moved later or a domain dropped
  if (existsSync(recordPath) && existsSync(join(repo, ".git"))) {
    const history = await declarationHistory(repo, recordName);
    if (history.kind === "err") {
      log(`changes: ${formatGitError(history.error)}\n`);
      return 3;
    }
    findings.push(...relaxationFindings(relaxations(history.value), record.decisions, phase, recordName));
  }

  // the commits of a range
  const range = value("--range");
  if (range !== undefined) {
    const read = await readRange(repo, range);
    if (read.kind === "err") {
      log(`changes: ${formatGitError(read.error)}\n`);
      return 3;
    }
    const commits = read.value;
    findings.push(
      ...commitFindings(commits, {
        phase,
        ...(record.declaration === undefined ? {} : { declaration: record.declaration }),
        decisions: record.decisions,
        roles: record.roles,
      }),
    );
    if (has("--strict")) {
      const home = deps.home;
      const asked =
        home === undefined && deps.client !== undefined
          ? { answers: new Map(), notRun: "the repository's reference on the host was not given" }
          : home === undefined
            ? { answers: new Map(), notRun: NO_CLIENT }
            : await askHost(deps.client, home, commits);
      notRun = asked.notRun;
      findings.push(...strictFindings(commits, asked.answers, phase));
    }
  }

  // each rule's result, for the record of the run (FR-031): a rule that was not run is never a pass
  if (deps.onRules !== undefined) {
    const strict = has("--strict");
    deps.onRules(
      CHANGES_RULES.map((rule): RuleResult => {
        const why =
          range === undefined && !WITHOUT_RANGE.includes(rule)
            ? "no --range was given, so no commit was judged"
            : STRICT_RULES.includes(rule)
              ? !strict
                ? "--strict was not given, so the host was not asked"
                : notRun
              : undefined;
        if (why !== undefined) return { id: rule, findings: [], notRun: why };
        return {
          id: rule,
          findings: findings.filter((f) => f.rule === rule).map((f) => ({ file: f.file, line: f.line, message: f.message })),
        };
      }),
    );
  }

  // judgement against the baseline: a warning is held by it, a finding in the gate phase never is
  const baselineFile = value("--baseline") !== undefined ? resolve(repo, value("--baseline") ?? "") : join(repo, BASELINE_FILE);
  const warned = findings.filter((f) => f.severity === "warn");
  const gated = findings.filter((f) => f.severity === "gate");
  if (has("--write-baseline")) {
    writeTextFileSync(baselineFile, formatBaseline(warned, COMMENTS));
    out(`wrote ${baselineFile}: ${new Set(warned.map((f) => f.key)).size} findings\n`);
  } else if (range !== undefined || findings.length > 0) {
    const held = existsSync(baselineFile) ? parseBaseline(readTextFileSync(baselineFile)) : [];
    // a baseline line is stale only where this run could have found it: without a range no commit is judged
    const judged = judge(warned, range === undefined ? [] : held);
    const verdict = { ...judged, fresh: [...judged.fresh, ...gated] };
    const lines = report(verdict, `changes (${phase})`, relative(repo, baselineFile).replaceAll("\\", "/"));
    log(`${lines.join("\n")}\n`);
    if (!passes(verdict)) failed = true;
  }
  if (has("--strict") && notRun !== undefined)
    for (const c of ruleCases(findings, notRun)) if (c.outcome === "not_run") log(`${c.rule}: not_run: ${c.reason}\n`);

  // the view of capabilities by rung
  const capabilities = value("--capabilities");
  const document = value("--document");
  if (capabilities !== undefined && document !== undefined) {
    const file = resolve(repo, capabilities);
    const docFile = resolve(repo, document);
    if (!existsSync(file) || !existsSync(docFile)) {
      log(`changes: ${existsSync(file) ? docFile : file} does not exist\n`);
      return 3;
    }
    const view = decodeViewRecord(readTextFileSync(file));
    if (view.kind === "err") {
      log(`changes: ${file}: ${view.error}\n`);
      return 3;
    }
    const text = viewOf(view.value.rungs, view.value.capabilities, view.value.runs);
    const current = readTextFileSync(docFile).replaceAll("\r\n", "\n");
    if (has("--check")) {
      const same = viewIsCurrent(current, text);
      if (same.kind === "err") {
        log(`changes: ${docFile}: ${formatViewError(same.error)}\n`);
        return 3;
      }
      if (!same.value) {
        log(
          `${document}: the view of capabilities by rung differs from what is generated; run changes.ts --capabilities ${capabilities} --document ${document}\n`,
        );
        failed = true;
      }
    } else {
      const next = spliceView(current, text);
      if (next.kind === "err") {
        log(`changes: ${docFile}: ${formatViewError(next.error)}\n`);
        return 3;
      }
      if (next.value !== current) writeTextFileSync(docFile, next.value);
      out(`${document}: the view of capabilities by rung is written\n`);
    }
  }

  // the chain of a change request's requirements
  const body = value("--trace");
  if (body !== undefined) {
    const file = resolve(repo, body);
    if (!existsSync(file)) {
      log(`changes: ${file} does not exist\n`);
      return 3;
    }
    const wanted = doneWhenRequirements(parseIssueBody(readTextFileSync(file)));
    const specsRoot =
      value("--specs") !== undefined
        ? resolve(repo, value("--specs") ?? "")
        : existsSync(join(repo, "specs"))
          ? repo
          : join(repo, "commons", "spec-kit");
    const sources = sourcesUnder(repo);
    let cases: readonly RunCase[] = [];
    const runs = value("--runs");
    if (runs !== undefined) {
      const rf = resolve(repo, runs);
      if (!existsSync(rf)) {
        log(`changes: ${rf} does not exist\n`);
        return 3;
      }
      const rec = readRecord(readTextFileSync(rf));
      if (rec.kind === "err") {
        log(`changes: ${rf} is not a test record\n`);
        return 3;
      }
      cases = rec.value.tests.map((t) => ({ requirements: t.requirements, outcome: t.outcome }));
    }
    const traces = wanted.map((r) =>
      traceOf(r, {
        specs: readSpecTexts(specsRoot).map((s) => ({ slug: s.slug, spec: s.spec })),
        terms: termCitations(),
        sources: sources.filter((s) => !s.path.endsWith(".test.ts")),
        tests: sources.filter((s) => s.path.endsWith(".test.ts")),
        cases,
      }),
    );
    out(`${traceLines(traces).join("\n")}${traces.length === 0 ? "the Done when section names no requirement\n" : "\n"}`);
    if (traces.length === 0 || traces.some((t) => firstBreak(t) !== undefined)) failed = true;
  }
  return failed ? 1 : 0;
}

if (import.meta.main) process.exitCode = await run(process.argv.slice(2));
