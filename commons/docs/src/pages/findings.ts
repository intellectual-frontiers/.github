// Spec: 0001-docs FR-030
/**
 * The page of the build's findings (docs 0001-docs FR-030; commons 0038-build-policy): what the tools said of each module in the runs of the workflows, with the history that says which are new, which are fixed and which a person has accepted. A run is red only for a fault of the pipeline's own
 * scripting or configuration, so a failing test or a type error is a finding and lives here, for the people who review quality and risk. The page is made from the findings of the runs kept on the history branch and from the accepted risks, and it states the policy from the typed values the workflows are
 * made from (the red causes, the release policy), so that the page and the pipeline cannot disagree. The same rows are given as `quality/findings.json` and `quality/findings.csv`.
 *
 * @module
 */
import { type Acceptance, countsOf, deriveRows, type Row } from "@intellectual-frontiers/libraries/ci/findings";
import { RED_CAUSE_WHY, RED_CAUSES, RELEASE_POLICY, releaseDecision } from "@intellectual-frontiers/libraries/ci/policy";
import type { Build } from "../build.ts";
import { sparkText } from "../emit/html.ts";
import type { Block, Inline } from "../model.ts";

const text = (t: string): Inline => ({ kind: "text", text: t });
const code = (t: string): Inline => ({ kind: "code", text: t });
const th = (...hs: string[]): Inline[][] => hs.map((h) => [text(h)]);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const SHOWN = 500;

const dayOf = (iso: string): string => iso.slice(0, 10);
const ageDays = (from: string, day: string): number => Math.max(0, Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(from)) / 86_400_000));

/** One row of the export: the finding, its status and the history that says it. */
export type ExportRow = {
  readonly id: string;
  readonly status: Row["status"];
  readonly tool: string;
  readonly code: string;
  readonly module: string;
  readonly file: string;
  readonly line: number | null;
  readonly severity: string;
  readonly message: string;
  readonly firstSeen: string;
  readonly lastSeen: string;
  readonly runsSeen: number;
  readonly owner: string;
  readonly acceptedUntil: string;
  readonly note: string;
};

/** The rows of the export, in the order of the page. */
export function exportRows(rows: readonly Row[]): readonly ExportRow[] {
  const order = { open: 0, accepted: 1, fixed: 2 } as const;
  return [...rows]
    .sort((a, b) => order[a.status] - order[b.status] || (a.finding.severity < b.finding.severity ? -1 : a.finding.severity > b.finding.severity ? 1 : 0) || (a.finding.module < b.finding.module ? -1 : a.finding.module > b.finding.module ? 1 : 0) || (a.finding.id < b.finding.id ? -1 : 1))
    .map((r) => ({
      id: r.finding.id,
      status: r.status,
      tool: r.finding.tool,
      code: r.finding.code,
      module: r.finding.module,
      file: r.finding.file ?? "",
      line: r.finding.line ?? null,
      severity: r.finding.severity,
      message: r.finding.message,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      runsSeen: r.runsSeen,
      owner: r.acceptance?.owner ?? "",
      acceptedUntil: r.status === "accepted" ? (r.acceptance?.until ?? "") : "",
      note: r.note ?? "",
    }));
}

const csvCell = (v: string | number | null): string => {
  const t = v === null ? "" : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** The rows as CSV, with a header. */
export function csvOf(rows: readonly ExportRow[]): string {
  const head = ["id", "status", "tool", "code", "module", "file", "line", "severity", "message", "firstSeen", "lastSeen", "runsSeen", "owner", "acceptedUntil", "note"] as const;
  return `${[head.join(","), ...rows.map((r) => head.map((h) => csvCell(r[h])).join(","))].join("\n")}\n`;
}

/** Adds the page `quality/findings.html` and its exports; nothing where no run has findings recorded and no acceptance is kept (the Quality page then says so). */
export function findingsPage(b: Build): void {
  const ev = b.evidence;
  const runs = ev.findings;
  const blocks: Block[] = [];
  const policy: Block = {
    kind: "paragraph",
    inlines: [
      text("A run of a workflow of this repository is red only for a fault of the pipeline's own scripting or configuration: "),
      ...RED_CAUSES.flatMap((c, i): Inline[] => [...(i === 0 ? [] : [text(", ")]), code(c)]),
      text(`. What a module says (a failing test, a type error, a warning) is a finding, kept here with its history. The release publishes regardless of open findings. A hold, of a library or of the package, is a serious decision and only the owner makes it: the gate holds nothing by itself. After ${RELEASE_POLICY.until} the finding owner-review-due asks the owner again until the policy is reviewed.`),
    ],
  };
  blocks.push(policy);
  blocks.push({ kind: "list", ordered: false, items: RED_CAUSES.map((c) => [{ kind: "paragraph", inlines: [code(c), text(`: ${RED_CAUSE_WHY[c]}.`)] }]) });
  if (runs.length === 0 && ev.acceptances.accepted.length === 0) {
    blocks.push({ kind: "callout", tone: "note", title: "No findings recorded yet", blocks: [{ kind: "paragraph", inlines: [text("No run has kept its findings on the history branch yet. Nothing here is a pass: the findings of a run appear after the run that follows the push of the workflows that make them.")] }] });
    b.add({ path: "quality/build-findings.html", title: "Build findings", description: "What the tools said of each module in the runs of the workflows.", section: "quality", group: "Quality", order: 6, blocks });
    return;
  }
  const latest = runs[runs.length - 1];
  const today = latest === undefined ? "1970-01-01" : dayOf(latest.run.at);
  const accepted: readonly Acceptance[] = ev.acceptances.accepted;
  const rows = deriveRows(runs, accepted, today);
  const counts = countsOf(rows, runs);
  const decision = releaseDecision(today);
  if (decision.ownerReview !== undefined) {
    blocks.unshift({ kind: "callout", tone: "warn", title: "Owner review due", blocks: [{ kind: "paragraph", inlines: [text(decision.ownerReview.message)] }] });
  }
  blocks.push({ kind: "paragraph", inlines: [text(`As of ${today}, from ${plural(runs.length, "run")} of the workflows: `), text(`${counts.open} open, ${counts.fresh} new in the latest run, ${counts.fixed} fixed in it, ${counts.accepted} accepted. `), { kind: "link", href: { kind: "external", url: "build-findings.json" }, children: [text("JSON")] }, text(" and "), { kind: "link", href: { kind: "external", url: "build-findings.csv" }, children: [text("CSV")] }, text(" hold every row.")] });
  const open = rows.filter((r) => r.status === "open");
  const byModule = new Map<string, { errors: number; warnings: number; accepted: number; oldest: number }>();
  for (const r of rows.filter((x) => x.status !== "fixed")) {
    const m = byModule.get(r.finding.module) ?? { errors: 0, warnings: 0, accepted: 0, oldest: 0 };
    if (r.status === "accepted") m.accepted += 1;
    else if (r.finding.severity === "error") m.errors += 1;
    else m.warnings += 1;
    m.oldest = Math.max(m.oldest, ageDays(r.firstSeen, today));
    byModule.set(r.finding.module, m);
  }
  blocks.push({ kind: "heading", level: 2, id: "modules", text: [text("By module")] });
  blocks.push({
    kind: "table",
    filter: "Filter the modules",
    head: th("Module", "Open errors", "Open warnings", "Accepted", "Oldest (days)"),
    rows: [...byModule].sort(([x], [y]) => (x < y ? -1 : 1)).map(([m, v]) => [[text(m)], [text(String(v.errors))], [text(String(v.warnings))], [text(String(v.accepted))], [text(String(v.oldest))]]),
  });
  blocks.push({ kind: "heading", level: 2, id: "trend", text: [text("Trend by workflow")] });
  const workflows = [...new Set(runs.map((r) => r.run.workflow))].sort();
  blocks.push({
    kind: "table",
    head: th("Workflow", "Runs", "Findings in the latest run", "Findings per run"),
    rows: workflows.map((w) => {
      const rs = runs.filter((r) => r.run.workflow === w);
      return [[text(w)], [text(String(rs.length))], [text(String(rs[rs.length - 1]?.findings.length ?? 0))], rs.length < 2 ? [] : [code(sparkText(rs.slice(-24).map((r) => r.findings.length)))]];
    }),
  });
  blocks.push({ kind: "heading", level: 2, id: "open", text: [text("Open findings")] });
  const exported = exportRows(rows);
  const shown = exported.filter((r) => r.status === "open").slice(0, SHOWN);
  if (open.length === 0) blocks.push({ kind: "paragraph", inlines: [text("None is open in the latest runs.")] });
  else {
    blocks.push({
      kind: "table",
      filter: "Filter the findings",
      head: th("Module", "Tool", "Code", "Where", "Severity", "Age (days)", "Finding", "Id"),
      rows: shown.map((r) => [
        [text(r.module)],
        [text(r.tool)],
        [code(r.code)],
        [text(r.file === "" ? "" : r.line === null ? r.file : `${r.file}:${r.line}`)],
        [text(r.severity)],
        [text(String(ageDays(r.firstSeen, today)))],
        [text(r.note === "" ? r.message : `${r.message} (${r.note})`)],
        [code(r.id)],
      ]),
    });
    if (open.length > SHOWN) blocks.push({ kind: "paragraph", inlines: [text(`The first ${SHOWN} of ${open.length} are shown; the exports hold all of them.`)] });
  }
  blocks.push({ kind: "heading", level: 2, id: "accepted", text: [text("Accepted risks")] });
  const known = new Set(rows.map((r) => r.finding.id));
  if (accepted.length === 0) blocks.push({ kind: "paragraph", inlines: [text("No risk is accepted. An acceptance is a person's word that a risk has been seen until a day, written as a typed file the owner controls; it never makes a check pass.")] });
  else {
    blocks.push({
      kind: "table",
      head: th("Finding", "Owner", "Reason", "Until", "Approved by", "State"),
      rows: accepted.map((a) => [
        [code(a.id)],
        [text(a.owner)],
        [text(a.reason)],
        [text(a.until)],
        [text(a.by)],
        [text(a.until < today ? "ended: the finding is open again" : known.has(a.id) ? "live" : "live, and the finding is not in the runs (fixed, or its module did not run)")],
      ]),
    });
  }
  for (const p of ev.acceptances.problems) blocks.push({ kind: "callout", tone: "warn", title: "An accepted risk is wrong", blocks: [{ kind: "paragraph", inlines: [text(p)] }] });
  b.add({ path: "quality/build-findings.html", title: "Build findings", description: "What the tools said of each module in the runs of the workflows, with the history: new, fixed and accepted.", section: "quality", group: "Quality", order: 6, blocks });
}

/** The data files of the page: the rows as JSON and as CSV (none where the page has no findings to show). */
export function findingsData(b: Build): readonly { readonly path: string; readonly text: string; readonly what: string }[] {
  const ev = b.evidence;
  const runs = ev.findings;
  const latest = runs[runs.length - 1];
  if (latest === undefined) return [];
  const today = dayOf(latest.run.at);
  const rows = deriveRows(runs, ev.acceptances.accepted, today);
  const exported = exportRows(rows);
  const doc = { schema: "build-findings-export/1", asOf: today, runs: runs.length, policy: { redCauses: [...RED_CAUSES], release: RELEASE_POLICY }, counts: countsOf(rows, runs), rows: exported };
  return [
    { path: "quality/build-findings.json", text: `${JSON.stringify(doc, null, 2)}\n`, what: "the findings of the build with their status and history, and the policy they are under" },
    { path: "quality/build-findings.csv", text: csvOf(exported), what: "the same rows, for a spreadsheet" },
  ];
}
