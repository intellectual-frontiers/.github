// Spec: 0002-report-site FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * The site of a report (0002-report-site FR-002 to FR-006): an index of how each requirement stands with the counts of every standing and grade (never a percentage), a page for each requirement with its objectives, the evidence behind each with its origin, grade and age, and who answers for it,
 * the stylesheet, and the data the pages are made from as JSON. The pages are plain HTML with one stylesheet: no script, no font or image or any other address, so that the report can be opened from a file, kept as evidence and read offline. Every text is escaped. The same input gives the same bytes.
 *
 * @example
 * ```ts
 * import { escapeHtml } from "./site.ts";
 * escapeHtml("<b>"); // "&lt;b&gt;"
 * ```
 *
 * @module
 */
import type { ObjectiveGrade } from "@intellectual-frontiers/assessment/logical";
import type { ReportInput, Site } from "@intellectual-frontiers/posture-report/governance";

/** Text made safe to put in HTML, in text and in a double-quoted attribute. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** The file name of a requirement's page: only letters, digits, dots, dashes and underscores survive. */
export function pageName(requirement: string): string {
  return `requirements/${requirement.replace(/[^A-Za-z0-9._-]/g, "_")}.html`;
}

const CSS = `:root{--bg:#fff;--fg:#1b1f24;--muted:#57606a;--line:#d0d7de;--ok:#1a7f37;--bad:#cf222e;--warn:#9a6700;--weak:#8250df}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8b949e;--line:#30363d;--ok:#3fb950;--bad:#f85149;--warn:#d29922;--weak:#a371f7}}
body{margin:0 auto;max-width:60rem;padding:1.5rem 1rem;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
h1{font-size:1.6rem}h2{margin-top:2rem}a{color:inherit}table{border-collapse:collapse;width:100%;margin:1rem 0}
th,td{border-bottom:1px solid var(--line);padding:.4rem .5rem;text-align:left;vertical-align:top}th{color:var(--muted);font-weight:600}
.met{color:var(--ok)}.not-met{color:var(--bad)}.partial,.supported,.stale{color:var(--warn)}.weak,.expired{color:var(--weak)}.muted{color:var(--muted)}
.counts span{margin-right:1rem;white-space:nowrap}
`;

const STANDING_LABEL: Readonly<Record<string, string>> = { met: "Met", "not-met": "Not met", "not-applicable": "Not applicable", partial: "Partial", "no-evidence": "No evidence", supported: "Supported by tools", stale: "Stale", strong: "Strong", moderate: "Moderate", weak: "Weak", expired: "Expired", none: "None" };
const label = (s: string): string => STANDING_LABEL[s] ?? s;
const page = (title: string, depth: number, body: string): string =>
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<link rel="stylesheet" href="${"../".repeat(depth)}style.css">\n</head>\n<body>\n${body}</body>\n</html>\n`;
const counts = (c: Readonly<Record<string, number>>): string => `<p class="counts">${Object.entries(c).filter(([, n]) => n > 0).map(([k, n]) => `<span class="${escapeHtml(k)}">${escapeHtml(label(k))}: ${n}</span>`).join("")}</p>`;

function indexPage(input: ReportInput): string {
  const a = input.assessment;
  const matrix = new Map((input.responsibilities?.lines ?? []).map((l) => [l.requirement, l]));
  const rows = a.requirements.map((r) => {
    const m = matrix.get(r.requirement);
    const title = input.requirementTitles?.[r.requirement];
    return `<tr><td><a href="${escapeHtml(pageName(r.requirement))}">${escapeHtml(r.requirement)}</a></td><td>${title === undefined ? "" : escapeHtml(title)}</td><td class="${escapeHtml(r.rollup)}">${escapeHtml(label(r.rollup))}</td><td>${r.objectives.length}</td><td>${m === undefined ? '<span class="muted">not stated</span>' : escapeHtml(m.who)}</td></tr>`;
  }).join("\n");
  const grades = new Map<string, number>();
  for (const g of input.grades) grades.set(g.grade, (grades.get(g.grade) ?? 0) + 1);
  const unassigned = input.responsibilities?.unassigned ?? [];
  return page(`${input.title}: ${input.framework.title}`, 0, `<h1>${escapeHtml(input.title)}</h1>
<p class="muted">${escapeHtml(input.framework.title)} (${escapeHtml(input.framework.id)}), as of ${escapeHtml(input.generatedAt)}. Read-only; every number is a count, and no percentage is given.</p>
<h2>Objectives</h2>
${counts(a.counts)}
<h2>Evidence grade</h2>
${counts(Object.fromEntries(grades))}
<h2>Requirements</h2>
<table>
<thead><tr><th scope="col">Requirement</th><th scope="col">Title</th><th scope="col">Standing</th><th scope="col">Objectives</th><th scope="col">Answered by</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
${unassigned.length === 0 ? "" : `<h2>Nobody is named for</h2>\n<p>${unassigned.map((u) => escapeHtml(u)).join(", ")}</p>\n`}${a.strays.length === 0 ? "" : `<h2>Evidence for objectives this framework does not have</h2>\n<p>${a.strays.map((u) => escapeHtml(u)).join(", ")}</p>\n`}`);
}

function requirementPage(input: ReportInput, requirement: string): string {
  const r = input.assessment.requirements.find((x) => x.requirement === requirement);
  const grades = new Map<string, ObjectiveGrade>(input.grades.map((g) => [g.objective, g]));
  const line = input.responsibilities?.lines.find((l) => l.requirement === requirement);
  const objectives = input.assessment.objectives.filter((o) => o.objective.requirement === requirement);
  const blocks = objectives.map((o) => {
    const g = grades.get(o.objective.id);
    const ev = o.evidence.length === 0 ? '<p class="muted">No evidence recorded.</p>' : `<table>
<thead><tr><th scope="col">Evidence</th><th scope="col">Method</th><th scope="col">Result</th><th scope="col">By</th><th scope="col">When</th><th scope="col">Source</th></tr></thead>
<tbody>
${o.evidence.map((e) => `<tr><td>${escapeHtml(e.id)}</td><td>${escapeHtml(e.method)}</td><td>${escapeHtml(e.result)}</td><td>${escapeHtml(e.by.kind)}: ${escapeHtml(e.by.name)}</td><td>${escapeHtml(e.at)}${e.validUntil === undefined ? "" : ` (until ${escapeHtml(e.validUntil)})`}</td><td>${escapeHtml(e.source)}</td></tr>`).join("\n")}
</tbody>
</table>`;
    return `<h3 id="${escapeHtml(o.objective.id.replace(/[^A-Za-z0-9]/g, "_"))}">${escapeHtml(o.objective.id)} <span class="${escapeHtml(o.standing)}">${escapeHtml(label(o.standing))}</span></h3>
<p>${escapeHtml(o.objective.statement)}</p>
<p class="muted">Grade: <span class="${escapeHtml(g?.grade ?? "none")}">${escapeHtml(g?.grade ?? "none")}</span>${g?.origin === undefined ? "" : ` (rests on ${escapeHtml(g.basis ?? "")}, ${escapeHtml(g.origin)}, ${g.ageDays} days old)`}</p>
${ev}`;
  }).join("\n");
  const who = line === undefined ? '<span class="muted">not stated</span>' : `${escapeHtml(line.who)}${line.provider === undefined ? "" : ` (from ${escapeHtml(line.provider)})`}${line.note === undefined ? "" : `: ${escapeHtml(line.note)}`}`;
  const title = input.requirementTitles?.[requirement];
  return page(`${requirement}: ${input.title}`, 1, `<p><a href="../index.html">All requirements</a></p>
<h1>${escapeHtml(requirement)}${title === undefined ? "" : ` ${escapeHtml(title)}`}</h1>
<p>Standing: <strong class="${escapeHtml(r?.rollup ?? "no-evidence")}">${escapeHtml(label(r?.rollup ?? "no-evidence"))}</strong>. Answered by: ${who}.</p>
${counts(r?.counts ?? {})}
${blocks}`);
}

/** The files of the site of a report. */
export function buildSite(input: ReportInput): Site {
  const files = new Map<string, string>();
  files.set("index.html", indexPage(input));
  files.set("style.css", CSS);
  for (const r of input.assessment.requirements) files.set(pageName(r.requirement), requirementPage(input, r.requirement));
  files.set("report.json", `${JSON.stringify({ title: input.title, generatedAt: input.generatedAt, framework: input.framework, counts: input.assessment.counts, requirements: input.assessment.requirements.map((r) => ({ requirement: r.requirement, rollup: r.rollup, counts: r.counts })), grades: input.grades }, null, 2)}\n`);
  return files;
}
