/**
 * The Trust page as one self-contained HTML file (commons 0022-trust FR-001 to FR-005, FR-009): embedded CSS (light and dark), no script, no
 * external resource, no clock, made from a `TrustView` and nothing else, so that the same view gives the same bytes. Failures come first
 * (open nonconformances with their age, open CAPA, failed cases, cases that did not run), then the figures, the objectives with their budgets,
 * every requirement with its grade, freshness and last proof, what people and plans recorded, and the scope with what the page does not cover.
 *
 * @remarks
 * Every value is escaped for HTML where it is written; the page's own sentences state evidence and never conformity (FR-004), and a test reads
 * the generated text for the words a claim would use, outside the one sentence that denies one.
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import { showGrade } from "../pure/names.ts";
import { showStrength } from "../attestation/mutation.ts";
import type { TrustCapa, TrustFailure, TrustNonconformance, TrustView } from "./view.ts";

/** Text escaped for HTML. */
export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS = `:root{color-scheme:light dark;--bg:#fbfbfa;--fg:#1b1d1f;--muted:#5b6168;--line:#d9dcdf;--panel:#ffffff;--bad:#b3261e;--badbg:#fdecea;--ok:#1b6e3c;--warn:#8a5a00;--warnbg:#fff4d6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121416;--fg:#e6e8ea;--muted:#9aa1a8;--line:#2f353a;--panel:#1a1d20;--bad:#ff8a80;--badbg:#3a1b19;--ok:#7fd69b;--warn:#f1c668;--warnbg:#3a2f12}}
:root[data-theme="dark"]{--bg:#121416;--fg:#e6e8ea;--muted:#9aa1a8;--line:#2f353a;--panel:#1a1d20;--bad:#ff8a80;--badbg:#3a1b19;--ok:#7fd69b;--warn:#f1c668;--warnbg:#3a2f12}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:70rem;margin:0 auto;padding:2rem 1rem 4rem}h1{font-size:1.6rem;margin:0 0 .25rem}h2{font-size:1.2rem;margin:2.2rem 0 .6rem;border-bottom:1px solid var(--line);padding-bottom:.3rem}
.meta{color:var(--muted);margin:0 0 1rem}.notice{border:1px solid var(--warn);background:var(--warnbg);padding:.6rem .8rem;border-radius:6px;margin:1rem 0}
.bad{color:var(--bad)}.ok{color:var(--ok)}.muted{color:var(--muted)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.6rem;margin:.6rem 0}.tile{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:.5rem .7rem}
.tile b{display:block;font-size:1.5rem;font-variant-numeric:tabular-nums}.tile span{color:var(--muted);font-size:.85rem}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:.35rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}code{font:.85em ui-monospace,Menlo,Consolas,monospace}
tr.fail td:first-child{border-left:3px solid var(--bad)}footer{margin-top:3rem;color:var(--muted);font-size:.85rem}`;

function table(
  head: readonly { readonly h: string; readonly n?: boolean }[],
  rows: readonly (readonly string[])[],
  rowClass?: (i: number) => string,
): string {
  const th = head.map((c) => `<th${c.n === true ? ' class="n"' : ""}>${esc(c.h)}</th>`).join("");
  const body = rows
    .map(
      (cells, i) =>
        `<tr${rowClass === undefined || rowClass(i) === "" ? "" : ` class="${rowClass(i)}"`}>${cells.map((c, j) => `<td${head[j]?.n === true ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`,
    )
    .join("\n");
  return `<div class="wrap"><table><thead><tr>${th}</tr></thead><tbody>\n${body}\n</tbody></table></div>`;
}

const code = (s: string): string => `<code>${esc(s)}</code>`;

/** The head of the table of nonconformances: the Public page names each by its identifier and shows no text of the record (0022-trust FR-018). */
function nonconformanceHead(audience: TrustView["audience"]): readonly { readonly h: string; readonly n?: boolean }[] {
  const named = [{ h: "Id" }, { h: "Requirement" }, { h: "Cause" }, { h: "Age", n: true }, { h: "State" }];
  return audience === "Public" ? [...named, { h: "CAPA" }] : [...named, { h: "Requirement text" }, { h: "Reason" }, { h: "CAPA" }];
}

function nonconformanceRows(list: readonly TrustNonconformance[], audience: TrustView["audience"]): readonly (readonly string[])[] {
  return list.map((n) => {
    const named = [
      code(n.id),
      esc(n.requirement),
      esc(n.cause),
      `${n.ageDays} day${n.ageDays === 1 ? "" : "s"}`,
      esc(n.state === "NonconformanceOpen" ? "open" : `closed ${n.closedOn ?? ""}`),
    ];
    const capas = n.capas.map(code).join(" ");
    return audience === "Public" ? [...named, capas] : [...named, esc(n.requirementText ?? ""), esc(n.reason ?? ""), capas];
  });
}

function capaRows(list: readonly TrustCapa[]): readonly (readonly string[])[] {
  return list.map((c) => [
    code(c.id),
    code(c.nonconformance),
    esc(c.state === "CapaOpen" ? "open" : c.state === "CapaVerified" ? `verified ${c.verifiedOn ?? ""}` : `closed ${c.closedOn ?? ""}`),
    esc(c.openedOn),
    esc(c.action),
    esc(c.test),
  ]);
}

function failureRows(list: readonly TrustFailure[], withMessage: boolean): readonly (readonly string[])[] {
  return list.map((f) => [
    esc(f.requirements.join(", ")),
    esc(f.name),
    esc(f.reason),
    `${esc(f.day)} ${code(f.run.slice(0, 12))}`,
    ...(withMessage ? [esc([f.file, f.message].filter((x): x is string => x !== undefined).join(": "))] : []),
  ]);
}

/** The page for a view: the HTML document, one file (FR-001). */
export function trustHtml(v: TrustView): string {
  const withMessage = v.audience !== "Public";
  const failed = v.failures.filter((f) => f.outcome === "fail");
  const notRun = v.failures.filter((f) => f.outcome === "not_run");
  const open = v.nonconformances.filter((n) => n.state === "NonconformanceOpen");
  const closed = v.nonconformances.filter((n) => n.state === "NonconformanceClosed");
  const openCapas = v.capas.filter((c) => c.state !== "CapaClosed");
  const out: string[] = [];
  out.push(
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`,
  );
  out.push(`<title>${esc(`Trust: ${v.harness}`)}</title>\n<style>${CSS}</style></head><body><main>`);
  out.push(`<h1>Trust: ${esc(v.harness)}</h1>`);
  const span = v.span === undefined ? "no evidence yet" : `evidence ${esc(v.span.from)} to ${esc(v.span.to)}`;
  out.push(
    `<p class="meta">Revision ${code(v.revision.slice(0, 12))} &middot; as of ${esc(v.generated)} &middot; ${span} &middot; for the ${esc(v.audience.toLowerCase())} audience &middot; ${v.redactions} value${v.redactions === 1 ? "" : "s"} redacted</p>`,
  );
  if (v.stale !== undefined)
    out.push(
      `<p class="notice"><b>This page is stale.</b> Its newest run is from ${esc(v.stale.newest)}, and a run is held to a cadence of ${v.stale.cadenceDays} days: the evidence is ${v.stale.overdueDays} day${v.stale.overdueDays === 1 ? "" : "s"} past it.</p>`,
    );
  if (v.span === undefined) out.push(`<p class="notice">No evidence is kept yet: every requirement is at grade E0.</p>`);

  // failures first (FR-003)
  out.push(`<h2 id="failures">Failures</h2>`);
  const none = v.open.failedCases + v.open.notRunCases + v.open.nonconformances + v.open.capas === 0 && closed.length === 0;
  out.push(
    `<p class="${none ? "ok" : "bad"}">${v.open.failedCases} failed case${v.open.failedCases === 1 ? "" : "s"}, ${v.open.notRunCases} not run, ${v.open.nonconformances} open nonconformance${v.open.nonconformances === 1 ? "" : "s"}, ${v.open.capas} open CAPA.</p>`,
  );
  if (open.length > 0) {
    out.push(`<h3>Open nonconformances</h3>`);
    out.push(table(nonconformanceHead(v.audience), nonconformanceRows(open, v.audience), () => "fail"));
  }
  if (openCapas.length > 0) {
    out.push(`<h3>Open CAPA</h3>`);
    out.push(
      table(
        [{ h: "Id" }, { h: "Nonconformance" }, { h: "State" }, { h: "Opened" }, { h: "Corrective action" }, { h: "Verified by test" }],
        capaRows(openCapas),
        () => "fail",
      ),
    );
  }
  const failHead = [{ h: "Requirement" }, { h: "Case" }, { h: "Reason" }, { h: "Run" }, ...(withMessage ? [{ h: "Message" }] : [])];
  if (failed.length > 0) {
    out.push(`<h3>Failed cases</h3>`);
    out.push(table(failHead, failureRows(failed, withMessage), () => "fail"));
  }
  if (notRun.length > 0) {
    out.push(`<h3>Cases that did not run</h3>`);
    out.push(table(failHead, failureRows(notRun, withMessage)));
  }
  if (closed.length > 0) {
    out.push(`<h3>Closed nonconformances</h3>`);
    out.push(table(nonconformanceHead(v.audience), nonconformanceRows(closed, v.audience)));
    const done = v.capas.filter((c) => c.state === "CapaClosed");
    if (done.length > 0)
      out.push(
        table(
          [{ h: "Id" }, { h: "Nonconformance" }, { h: "State" }, { h: "Opened" }, { h: "Corrective action" }, { h: "Verified by test" }],
          capaRows(done),
        ),
      );
  }

  // figures (FR-002)
  const f = v.figures;
  out.push(`<h2 id="figures">Figures</h2>`);
  const tile = (n: number | string, label: string): string => `<div class="tile"><b>${esc(String(n))}</b><span>${esc(label)}</span></div>`;
  out.push(
    `<div class="tiles">${tile(f.evidenceFiles, "runs kept")}${tile(f.cases, "cases")}${tile(f.passed, "passed")}${tile(f.failed, "failed")}${tile(f.notRun, "not run")}${tile(f.otherCases, "skipped, todo or cancelled")}${tile(f.nonconformancesOpen, "open nonconformances")}${tile(f.capasOpen, "open CAPA")}</div>`,
  );
  out.push(`<p>${esc(v.proof.count)}</p>`);
  out.push(
    `<p>Review debt: <b>${v.proof.reviewDebt}</b> requirement${v.proof.reviewDebt === 1 ? "" : "s"} rest on a review or a statement and on no run: ${v.proof.reviewDebtByPerson} on a person's, ${v.proof.reviewDebtByAgent} on an agent's. Requirements by grade: ${Object.entries(
      v.proof.byGrade,
    )
      .map(([g, n]) => `${esc(g)} ${n}`)
      .join(", ")}.</p>`,
  );
  if (v.head !== undefined) out.push(`<p class="muted">Head of the evidence chain: ${code(v.head)}</p>`);

  // objectives
  out.push(`<h2 id="objectives">Objectives</h2>`);
  if (v.objectives.length === 0) out.push(`<p class="muted">No objective is declared.</p>`);
  else
    out.push(
      table(
        [
          { h: "Objective" },
          { h: "Metric" },
          { h: "Target" },
          { h: "Now", n: true },
          { h: "State" },
          { h: "Budget", n: true },
          { h: "Remaining", n: true },
          { h: "Window", n: true },
        ],
        v.objectives.map((o) => [
          code(o.id),
          code(o.metric),
          esc(`${o.comparator === "at-least" ? "at least" : "at most"} ${o.target} ${o.unit}`),
          o.value === null ? "-" : esc(String(o.value)),
          esc(o.state),
          esc(String(o.budget)),
          o.remaining === null ? "-" : esc(String(o.remaining)),
          `${o.windowDays} d`,
        ]),
        (i) => (v.objectives[i]?.state === "spent" ? "fail" : ""),
      ),
    );

  // requirements
  out.push(`<h2 id="requirements">Requirements</h2>`);
  out.push(
    table(
      [
        { h: "Requirement" },
        { h: "Grade" },
        { h: "Counted proved" },
        { h: "Freshness" },
        { h: "Last proof" },
        { h: "Run" },
        { h: "Strength of proof" },
      ],
      v.requirements.map((q) => [
        esc(q.id),
        esc(showGrade(q.grade)),
        q.proved ? "yes" : `no, needs ${esc(q.required)}`,
        esc(q.freshness),
        q.day === undefined ? "-" : esc(q.day),
        q.run === undefined ? "-" : code(q.run.slice(0, 12)),
        q.strengthPermille === undefined
          ? "not measured"
          : esc(
              `${showStrength(q.strengthPermille)}${q.gradeAfterStrength !== undefined && q.gradeAfterStrength !== q.grade ? `, so ${q.gradeAfterStrength}` : ""}`,
            ),
      ]),
    ),
  );

  // people and plans
  const p = v.people;
  out.push(`<h2 id="people">People and plans</h2>`);
  out.push(
    `<p>${p.plans} test plan${p.plans === 1 ? "" : "s"} registered before their runs; ${p.samplesDrawn} sample${p.samplesDrawn === 1 ? "" : "s"} drawn and ${p.samplesAttested} attested by a named person; ${p.mutationRuns} mutation run${p.mutationRuns === 1 ? "" : "s"}; ${p.agentReviews} review${p.agentReviews === 1 ? "" : "s"} by agents, ${p.agentReviewsSampled} of them sampled by a person.</p>`,
  );

  // scope (FR-004)
  out.push(`<h2 id="scope">Scope</h2>`);
  out.push(`<p>${esc(v.scope)}</p>`);
  out.push(
    `<p>It covers the harness above at revision ${code(v.revision)}, as of ${esc(v.generated)}${v.span === undefined ? "" : `, over the evidence of ${esc(v.span.from)} to ${esc(v.span.to)}`}.</p>`,
  );
  if (v.notCovered.length > 0) out.push(`<p>It does not cover:</p><ul>${v.notCovered.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`);
  out.push(
    `<footer>Generated from the evidence of the harness; edit nothing here. A person with the assessor pack checks every figure offline with <code>verify/verify.ts</code>.</footer>`,
  );
  out.push(`</main></body></html>\n`);
  return out.join("\n");
}

/** The audience's name as the page shows it, kept here so that a switch over audiences stays exhaustive in one place. */
export function audienceWords(a: TrustView["audience"]): string {
  switch (a) {
    case "Public":
      return "public";
    case "Assessor":
      return "assessor";
    case "Internal":
      return "internal";
    default:
      return absurd(a);
  }
}
