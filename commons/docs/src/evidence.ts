// Spec: 0001-docs FR-009, FR-022, FR-027
/**
 * The evidence the site shows beside the code (docs 0001-docs FR-009 to FR-011): the results of the tests, the issues kept as typed code, and the tickets of GitHub, read from files that CI (or a person) leaves in
 * a folder, so that the same files give the same pages. The results are CTRF (the Common Test Report Format: `<library>.ctrf.json`, one file for each library, written by `ifc test run --report ctrf`), with
 * the requirements each test proves in `extra.requirements`; `meta.json` says which commit they are of. The package reads the format and imports no library that makes it (0011-documentation FR-026). Nothing here
 * runs a test or reaches a network: a missing folder is "no run recorded", and a file that cannot be read is a finding.
 *
 * @module
 */
import { type LibraryCoverage, parseCoverage } from "./coverage.ts";
import { type LibraryMutation, parseMutation } from "./mutation.ts";
import { type ConsumerUsage, type PackageReport, parsePackageReport, parseUsage } from "./package.ts";
import { fs, path } from "@intellectual-frontiers/system";
import type { Finding } from "./check.ts";
import type { EvidenceSource, IssueLike } from "./config.ts";
import { type Acceptance, decodeFindingsFile, type FindingsFile } from "@intellectual-frontiers/libraries/ci/findings";
import { type HistoryRun, parseHistoryRun } from "./history.ts";

/** How a test ended, in CTRF's words. */
export type TestStatus = "passed" | "failed" | "skipped" | "pending" | "other";

/** One test of a run. */
export interface TestResult {
  /** Its name, as `proves` makes it: the requirements, a colon and what it says. */
  readonly name: string;
  readonly status: TestStatus;
  readonly durationMs: number;
  /** Its file, from the repository's root. */
  readonly file: string;
  /** The requirements it proves, as `0009-example FR-001`. */
  readonly requirements: readonly string[];
  readonly risk: string;
  readonly runtime: string;
  readonly retries: number;
  /** Why it failed, cut short; for a failed test only. */
  readonly message: string | undefined;
}

/** The results of one library's suite. */
export interface LibraryResults {
  /** The library, by the name of its folder (`repository` for the tests of the repository itself). */
  readonly library: string;
  readonly tests: readonly TestResult[];
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  /** Tests that were planned and not run (`pending`, `todo`, `other`). */
  readonly other: number;
}

/** Which run the results are of. */
export interface RunMeta {
  readonly commit: string | undefined;
  readonly at: string | undefined;
  readonly url: string | undefined;
}

/** A ticket of GitHub, as its API gives it, read from a snapshot. */
export interface Ticket {
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed";
  readonly url: string;
  readonly labels: readonly string[];
  readonly body: string;
  /** The libraries it is about (a label `lib:<name>`, or a path of `commons/<name>/` in its words). */
  readonly libraries: readonly string[];
  /** The requirements it names, as `0009-example FR-001`. */
  readonly requirements: readonly string[];
}

/** An issue kept as typed code, with the library it is of. */
export interface TypedIssue extends IssueLike {
  readonly library: string;
  /** The path of its set in the library, where the library has more than one. */
  readonly scope: string | undefined;
}

/** Whether an issue's status is one that is still to be dealt with. */
export const isOpen = (i: Pick<IssueLike, "status">): boolean => i.status.kind === "open" || i.status.kind === "in-progress" || i.status.kind === "deferred";

/** Why a library has a report, or none: what the job that ran its tests says (`success`, `failure`, `skipped`, `cancelled`). */
export interface LibraryStatus {
  readonly library: string;
  readonly install: string;
  readonly runner: string;
  readonly tests: string;
  /** Whether the job left a CTRF report. */
  readonly reported: boolean;
}

/** Which build of the site this is: the commit, when, the run, and how the generator's own check ended (`success`, `failure`, `skipped`). */
export interface BuildInfo {
  readonly commit: string | undefined;
  readonly at: string | undefined;
  readonly url: string | undefined;
  readonly check: string | undefined;
}

/** A run of a workflow, as the API gives it. */
export interface WorkflowRun {
  readonly id: number;
  readonly number: number;
  readonly event: string;
  readonly status: string;
  readonly conclusion: string | undefined;
  readonly sha: string;
  readonly title: string;
  readonly url: string;
  readonly createdAt: string;
  readonly startedAt: string | undefined;
  readonly updatedAt: string | undefined;
}

/** A workflow, its recent runs (newest first) and the jobs that failed in the latest failed ones. */
export interface WorkflowRuns {
  readonly name: string;
  readonly path: string;
  readonly runs: readonly WorkflowRun[];
  readonly failed: readonly { readonly run: number; readonly jobs: readonly { readonly name: string; readonly url: string; readonly step: string | undefined }[] }[];
}

/** Everything the site knows of quality. */
export interface Evidence {
  /** What the package weighs, from the report of its packer (docs 0001-docs FR-032), where one is kept. */
  readonly packageReport: PackageReport | undefined;
  /** What each consumer repository reaches of the package, from `usage.<consumer>.json`. */
  readonly usages: readonly ConsumerUsage[];
  readonly results: ReadonlyMap<string, LibraryResults>;
  readonly run: RunMeta | undefined;
  readonly issues: readonly TypedIssue[];
  readonly tickets: readonly Ticket[];
  /** Whether a folder of results was given and read (a run is recorded), as opposed to none. */
  readonly recorded: boolean;
  /** What each library's job says of its tests, by library. */
  readonly status: ReadonlyMap<string, LibraryStatus>;
  readonly build: BuildInfo | undefined;
  /** The workflows and their recent runs; none where `runs.json` is not there. */
  readonly workflows: readonly WorkflowRuns[];
  /** Why the runs could not be read, where `runs.json` says so. */
  readonly runsError: string | undefined;
  /** The runs of the evidence that were kept (docs 0001-docs FR-016), oldest first. */
  readonly history: readonly HistoryRun[];
  /** The line coverage of each library whose tests were run with it (docs 0001-docs FR-022). */
  readonly coverage: ReadonlyMap<string, LibraryCoverage>;
  /** The mutation run of each library that has one (docs 0001-docs FR-027). */
  readonly mutation: ReadonlyMap<string, LibraryMutation>;
  /** The findings of the runs of the workflows, from the history branch, oldest first (docs 0001-docs FR-030). */
  readonly findings: readonly FindingsFile[];
  /** The accepted risks of the repository and what was wrong with their files (docs 0001-docs FR-030). */
  readonly acceptances: { readonly accepted: readonly Acceptance[]; readonly problems: readonly string[] };
}

/** No evidence: nothing recorded. */
<<<<<<< HEAD
export const NONE: Evidence = { packageReport: undefined, usages: [], results: new Map(), run: undefined, issues: [], tickets: [], recorded: false, status: new Map(), build: undefined, workflows: [], runsError: undefined, history: [], coverage: new Map(), mutation: new Map() };
=======
export const NONE: Evidence = { results: new Map(), run: undefined, issues: [], tickets: [], recorded: false, status: new Map(), build: undefined, workflows: [], runsError: undefined, history: [], findings: [], acceptances: { accepted: [], problems: [] }, coverage: new Map(), mutation: new Map() };
>>>>>>> 856caa74a6ea80c3629a5100f5935563055a4bf6

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

const STATUS: Readonly<Record<string, TestStatus>> = { passed: "passed", failed: "failed", skipped: "skipped", pending: "pending" };

/** The requirement keys a text names, as `0009-example FR-001`. */
export function requirementsIn(text: string): string[] {
  return [...new Set([...text.matchAll(/\b(\d{3,4}-[a-z0-9]+(?:-[a-z0-9]+)*) (FR-\d{3}[a-z]?)\b/g)].map((m) => `${m[1]} ${m[2]}`))].sort();
}

/**
 * The results of a CTRF file: its tests, or why it cannot be read.
 *
 * @param library - the library the file is of
 * @param text - the file's text
 * @param prefix - what is put before a test's path to make it a path from the repository's root
 */
export function parseCtrf(library: string, text: string, prefix: string): { readonly value: LibraryResults } | { readonly error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const results = isRecord(json) ? json["results"] : undefined;
  const tests = isRecord(results) ? results["tests"] : undefined;
  if (!Array.isArray(tests)) return { error: "is not CTRF: it has no results.tests" };
  const out: TestResult[] = [];
  for (const t of tests) {
    if (!isRecord(t) || typeof t["name"] !== "string") return { error: "is not CTRF: a test has no name" };
    const extra = isRecord(t["extra"]) ? t["extra"] : {};
    const reqs = Array.isArray(extra["requirements"]) ? extra["requirements"].filter((r): r is string => typeof r === "string") : requirementsIn(t["name"]);
    const file = str(t["filePath"]) ?? "";
    const message = str(t["message"]);
    out.push({
      name: t["name"],
      status: STATUS[String(t["status"])] ?? "other",
      durationMs: typeof t["duration"] === "number" ? Math.round(t["duration"]) : 0,
      file: file === "" ? "" : `${prefix}${file.replace(/^\.\//, "")}`,
      requirements: [...reqs].sort(),
      risk: str(extra["risk"]) ?? "not-high",
      runtime: str(extra["runtime"]) ?? "",
      retries: typeof t["retries"] === "number" ? t["retries"] : 0,
      message: message === undefined ? undefined : message.replace(/\s+/g, " ").slice(0, 300),
    });
  }
  out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const count = (s: TestStatus): number => out.filter((x) => x.status === s).length;
  return { value: { library, tests: out, passed: count("passed"), failed: count("failed"), skipped: count("skipped"), other: count("pending") + count("other") } };
}

/**
 * The tickets of a snapshot of the GitHub issues of a repository (a JSON array as the API gives it; pull requests are left out).
 *
 * @param text - the snapshot
 */
export function parseTickets(text: string): { readonly value: readonly Ticket[] } | { readonly error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!Array.isArray(json)) return { error: "is not a list of issues" };
  const out: Ticket[] = [];
  for (const t of json) {
    if (!isRecord(t) || typeof t["number"] !== "number" || typeof t["title"] !== "string" || isRecord(t["pull_request"])) continue;
    const labels = (Array.isArray(t["labels"]) ? t["labels"] : []).map((l) => (typeof l === "string" ? l : isRecord(l) ? str(l["name"]) : undefined)).filter((l): l is string => l !== undefined).sort();
    const body = typeof t["body"] === "string" ? t["body"] : "";
    const words = `${t["title"]}\n${body}`;
    const libraries = new Set<string>(labels.filter((l) => l.startsWith("lib:")).map((l) => l.slice(4)));
    for (const m of words.matchAll(/\bcommons\/([a-z][a-z0-9-]*)\//g)) libraries.add(m[1] ?? "");
    out.push({
      number: t["number"],
      title: t["title"],
      state: t["state"] === "closed" ? "closed" : "open",
      url: str(t["html_url"]) ?? str(t["url"]) ?? "",
      labels,
      body: body.length > 600 ? `${body.slice(0, 600)}…` : body,
      libraries: [...libraries].sort(),
      requirements: requirementsIn(words),
    });
  }
  return { value: out.sort((a, b) => a.number - b.number) };
}

/** The runs of the workflows, from `runs.json` as `tools/ci-runs.ts` writes it. */
export function parseRuns(text: string): { readonly workflows: readonly WorkflowRuns[]; readonly error: string | undefined } | { readonly error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isRecord(json) || !Array.isArray(json["workflows"])) return { error: "is not a list of workflows" };
  const num = (v: unknown): number => (typeof v === "number" ? v : 0);
  const workflows = json["workflows"].filter(isRecord).map((w): WorkflowRuns => ({
    name: str(w["name"]) ?? "",
    path: str(w["path"]) ?? "",
    runs: (Array.isArray(w["runs"]) ? w["runs"] : []).filter(isRecord).map((r): WorkflowRun => ({
      id: num(r["id"]),
      number: num(r["run_number"]),
      event: str(r["event"]) ?? "",
      status: str(r["status"]) ?? "",
      conclusion: str(r["conclusion"]),
      sha: str(r["head_sha"]) ?? "",
      title: str(r["display_title"]) ?? "",
      url: str(r["html_url"]) ?? "",
      createdAt: str(r["created_at"]) ?? "",
      startedAt: str(r["run_started_at"]),
      updatedAt: str(r["updated_at"]),
    })),
    failed: (Array.isArray(w["failed"]) ? w["failed"] : []).filter(isRecord).map((f) => ({
      run: num(f["run"]),
      jobs: (Array.isArray(f["jobs"]) ? f["jobs"] : []).filter(isRecord).map((j) => ({ name: str(j["name"]) ?? "", url: str(j["url"]) ?? "", step: str(j["step"]) })),
    })),
  }));
  return { workflows, error: str(json["error"]) };
}

/**
 * The evidence the configuration names, read from its files.
 *
 * @param root - the repository's root, absolute
 * @param source - what the configuration gives
 * @param found - where findings are added
 * @param dirOf - the folder of a library, from the repository's root (`commons/core`; `""` for the repository itself)
 */
export function readEvidence(root: string, source: EvidenceSource | undefined, found: Finding[], dirOf: (library: string) => string = (l) => (l === "repository" ? "" : `commons/${l}`)): Evidence {
  if (source === undefined) return NONE;
  const issues: TypedIssue[] = (source.issues ?? []).flatMap((set) => set.issues.map((i): TypedIssue => ({ ...i, library: set.library, scope: set.scope })));
  const results = new Map<string, LibraryResults>();
  let run: RunMeta | undefined;
  let recorded = false;
  const status = new Map<string, LibraryStatus>();
  let build: BuildInfo | undefined;
  let workflows: readonly WorkflowRuns[] = [];
  let runsError: string | undefined;
  const history: HistoryRun[] = [];
  const coverage = new Map<string, LibraryCoverage>();
  const mutation = new Map<string, LibraryMutation>();
  let packageReport: PackageReport | undefined;
  const usages: ConsumerUsage[] = [];
  const dir = source.results === undefined ? undefined : path.resolve(root, source.results);
  if (dir !== undefined && fs.existsSync(dir)) {
    for (const entry of [...fs.readDirSync(dir)].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join("/");
      if (entry.name === "meta.json") {
        try {
          const m = JSON.parse(fs.readTextFileSync(path.join(dir, entry.name))) as unknown;
          if (isRecord(m)) run = { commit: str(m["commit"]), at: str(m["at"]), url: str(m["url"]) };
        } catch (e) {
          found.push({ where: rel, problem: { kind: "evidence-unreadable", why: `is not JSON: ${e instanceof Error ? e.message : String(e)}` } });
        }
      } else if (entry.name === "build.json") {
        try {
          const m = JSON.parse(fs.readTextFileSync(path.join(dir, entry.name))) as unknown;
          if (isRecord(m)) build = { commit: str(m["commit"]), at: str(m["at"]), url: str(m["url"]), check: str(m["check"]) };
        } catch (e) {
          found.push({ where: rel, problem: { kind: "evidence-unreadable", why: `is not JSON: ${e instanceof Error ? e.message : String(e)}` } });
        }
      } else if (entry.name === "runs.json") {
        const r = parseRuns(fs.readTextFileSync(path.join(dir, entry.name)));
        if ("workflows" in r) {
          workflows = r.workflows;
          runsError = r.error;
        } else found.push({ where: rel, problem: { kind: "evidence-unreadable", why: r.error } });
      } else if (entry.isFile && entry.name.startsWith("status-") && entry.name.endsWith(".json")) {
        try {
          const m = JSON.parse(fs.readTextFileSync(path.join(dir, entry.name))) as unknown;
          if (isRecord(m) && typeof m["library"] === "string") status.set(m["library"], { library: m["library"], install: str(m["install"]) ?? "", runner: str(m["runner"]) ?? "", tests: str(m["tests"]) ?? "", reported: m["reported"] === true });
        } catch (e) {
          found.push({ where: rel, problem: { kind: "evidence-unreadable", why: `is not JSON: ${e instanceof Error ? e.message : String(e)}` } });
        }
      } else if (entry.isFile && entry.name === "package.report.json") {
        const r = parsePackageReport(fs.readTextFileSync(path.join(dir, entry.name)));
        if ("error" in r) found.push({ where: rel, problem: { kind: "evidence-unreadable", why: r.error } });
        else packageReport = r.value;
      } else if (entry.isFile && entry.name.startsWith("usage.") && entry.name.endsWith(".json")) {
        const r = parseUsage(entry.name.slice("usage.".length, -".json".length), fs.readTextFileSync(path.join(dir, entry.name)));
        if ("error" in r) found.push({ where: rel, problem: { kind: "evidence-unreadable", why: r.error } });
        else usages.push(r.value);
      } else if (entry.isFile && entry.name.endsWith(".mutation.json")) {
        const r = parseMutation(fs.readTextFileSync(path.join(dir, entry.name)));
        if ("error" in r) found.push({ where: rel, problem: { kind: "evidence-unreadable", why: r.error } });
        else mutation.set(r.value.library, r.value);
      } else if (entry.isFile && entry.name.endsWith(".coverage.json")) {
        const r = parseCoverage(fs.readTextFileSync(path.join(dir, entry.name)));
        if ("error" in r) found.push({ where: rel, problem: { kind: "evidence-unreadable", why: r.error } });
        else coverage.set(r.value.library, r.value);
      } else if (entry.isFile && entry.name.endsWith(".ctrf.json")) {
        const library = entry.name.slice(0, -".ctrf.json".length);
        const folder = dirOf(library);
        const r = parseCtrf(library, fs.readTextFileSync(path.join(dir, entry.name)), folder === "" ? "" : `${folder}/`);
        if ("error" in r) found.push({ where: rel, problem: { kind: "evidence-unreadable", why: r.error } });
        else {
          results.set(library, r.value);
          recorded = true;
        }
      }
    }
  }
  const runsDir = dir === undefined ? undefined : path.join(dir, "history", "runs");
  if (runsDir !== undefined && fs.existsSync(runsDir)) {
    for (const e of [...fs.readDirSync(runsDir)].filter((x) => x.name.endsWith(".json")).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = parseHistoryRun(fs.readTextFileSync(path.join(runsDir, e.name)));
      if ("error" in r) found.push({ where: path.relative(root, path.join(runsDir, e.name)).split(path.sep).join("/"), problem: { kind: "evidence-unreadable", why: r.error } });
      else history.push(r.value);
    }
  }
  // the findings of the runs of the workflows, kept on the history branch and laid out under findings-history/runs/YYYY/MM/DD/ by the site's workflow (docs 0001-docs FR-030)
  const findings: FindingsFile[] = [];
  const findingsDir = dir === undefined ? undefined : path.join(dir, "findings-history", "runs");
  const walkFindings = (d: string): void => {
    for (const e of [...fs.readDirSync(d)].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(d, e.name);
      if (e.isDirectory) walkFindings(full);
      else if (e.name.endsWith(".json")) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(fs.readTextFileSync(full));
        } catch (cause) {
          found.push({ where: path.relative(root, full).split(path.sep).join("/"), problem: { kind: "evidence-unreadable", why: cause instanceof Error ? cause.message : String(cause) } });
          continue;
        }
        const r = decodeFindingsFile(parsed);
        if (r.kind === "ok") findings.push(r.value);
        else found.push({ where: path.relative(root, full).split(path.sep).join("/"), problem: { kind: "evidence-unreadable", why: r.error } });
      }
    }
  };
  if (findingsDir !== undefined && fs.existsSync(findingsDir)) walkFindings(findingsDir);
  findings.sort((a, b) => (a.run.at < b.run.at ? -1 : a.run.at > b.run.at ? 1 : a.run.id < b.run.id ? -1 : 1));
  let acceptances: Evidence["acceptances"] = { accepted: [], problems: [] };
  const acceptedFile = dir === undefined ? undefined : path.join(dir, "accepted-findings.json");
  if (acceptedFile !== undefined && fs.existsSync(acceptedFile)) {
    try {
      const j = JSON.parse(fs.readTextFileSync(acceptedFile)) as { acceptances?: Acceptance[]; problems?: string[] };
      acceptances = { accepted: Array.isArray(j.acceptances) ? j.acceptances : [], problems: Array.isArray(j.problems) ? j.problems : [] };
    } catch (cause) {
      found.push({ where: path.relative(root, acceptedFile).split(path.sep).join("/"), problem: { kind: "evidence-unreadable", why: cause instanceof Error ? cause.message : String(cause) } });
    }
  }
  let tickets: readonly Ticket[] = [];
  if (source.github !== undefined) {
    const file = path.resolve(root, source.github);
    if (fs.existsSync(file)) {
      const r = parseTickets(fs.readTextFileSync(file));
      if ("error" in r) found.push({ where: path.relative(root, file).split(path.sep).join("/"), problem: { kind: "evidence-unreadable", why: r.error } });
      else tickets = r.value;
    }
  }
<<<<<<< HEAD
  return { packageReport, usages, results, run, issues, tickets, recorded, status, build, workflows, runsError, history, coverage, mutation };
=======
  return { results, run, issues, tickets, recorded, status, build, workflows, runsError, history, findings, acceptances, coverage, mutation };
>>>>>>> 856caa74a6ea80c3629a5100f5935563055a4bf6
}

/** The tests of every library that name a requirement, as `0009-example FR-001`. */
export function testsFor(ev: Evidence, requirement: string): readonly TestResult[] {
  return [...ev.results.values()].flatMap((l) => l.tests.filter((t) => t.requirements.includes(requirement)));
}

/** What the tests of a requirement come to: not run (none recorded), failing, proved (every one passed) or partly (some skipped or planned). */
export function standing(tests: readonly TestResult[]): "none" | "failing" | "proved" | "partly" {
  if (tests.length === 0) return "none";
  if (tests.some((t) => t.status === "failed")) return "failing";
  return tests.every((t) => t.status === "passed") ? "proved" : "partly";
}
