// Spec: 0001-docs FR-010, FR-011
/**
 * The Quality section (docs 0001-docs FR-010, FR-011; commons 0011-documentation FR-041): what the tests and the issues say of each library, made from the evidence the configuration names (`evidence.ts`): a dashboard with a row
 * for each library, a page for each library (its failing and its skipped tests, its slowest, the requirements no passing test proves, its open issues and tickets), a register of the issues and tickets and a page for each issue kept
 * as typed code; and, beside the code, a line on the requirement, the module and the library page that the evidence is of. With no run recorded the pages say so and nothing is shown as passed.
 *
 * @module
 */
import type { Build } from "../build.ts";
import { type Evidence, isOpen, type LibraryResults, standing, testsFor, type TestResult, type Ticket, type TypedIssue } from "../evidence.ts";
import { specPage } from "../links.ts";
import type { Area } from "../sources.ts";
import type { Badge, Block, Inline, Page, Tone } from "../model.ts";
import { slugOf } from "../model.ts";
import { areaPage } from "./overview.ts";
import type { Spec } from "../extract/specs.ts";
import { kitDirOf, kitNameOf } from "./specs.ts";

const text = (t: string): Inline => ({ kind: "text", text: t });
const code = (t: string): Inline => ({ kind: "code", text: t });
const th = (...hs: string[]): Inline[][] => hs.map((h) => [text(h)]);
const page = (path: string, anchor?: string) => ({ kind: "page" as const, path, ...(anchor === undefined ? {} : { anchor }) });
const link = (path: string, label: string | Inline[], anchor?: string): Inline => ({ kind: "link", href: page(path, anchor), children: typeof label === "string" ? [text(label)] : label });

/** The library a specification belongs to, by the name of its folder: that of the folder that holds its spec kit, `repository` for the repository's own kit, and, for a kit that is in no library's folder (the plain layout), the one package a repository has. */
function libraryOfSpec(b: Build, spec: Spec): string {
  const name = kitNameOf(kitDirOf(b, spec));
  if (name === "commons") return "repository";
  if (name === "") return b.config.packages.length === 1 ? (b.config.packages[0]?.slug ?? "repository") : "repository";
  return name;
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const SEVERITY: Readonly<Record<string, number>> = { critical: 0, high: 1, medium: 2, low: 3 };
const severityTone = (s: string): Tone => (s === "critical" || s === "high" ? "warn" : s === "medium" ? "info" : "neutral");
const statusTone = (k: string): Tone => (k === "fixed" ? "good" : k === "open" || k === "in-progress" ? "warn" : "neutral");
const issuePath = (i: Pick<TypedIssue, "library" | "scope" | "id">): string => `quality/issues/${i.library}${i.scope === undefined ? "" : `-${slugOf(i.scope)}`}-${String(i.id).padStart(5, "0")}.html`;
const issueName = (i: Pick<TypedIssue, "library" | "scope" | "id" | "title">): string => `${i.scope ?? i.library} ${String(i.id).padStart(5, "0")}: ${i.title}`;

/** The libraries the section knows: those that keep a spec kit, those with results, and those with issues. */
function librariesOf(b: Build): string[] {
  const names = new Set<string>();
  for (const s of b.kit.specs) names.add(libraryOfSpec(b, s));
  for (const k of b.evidence.results.keys()) names.add(k);
  for (const i of b.evidence.issues) names.add(i.library);
  return [...names].sort((x, y) => (x === "repository" ? -1 : y === "repository" ? 1 : x < y ? -1 : x > y ? 1 : 0));
}

/** The requirements (FR) of the specifications of a library, as `0009-example FR-001`. */
function requirementsOf(b: Build, library: string): string[] {
  return b.kit.specs.filter((s) => libraryOfSpec(b, s) === library).flatMap((s) => s.requirements.filter((r) => r.id.startsWith("FR-")).map((r) => `${s.id} ${r.id}`));
}

/** How the requirements of a library stand on the tests recorded for them. */
export function requirementStanding(b: Build, library: string): { readonly proved: number; readonly partly: number; readonly failing: number; readonly none: number; readonly total: number; readonly missing: readonly string[] } {
  const reqs = requirementsOf(b, library);
  const by = { proved: 0, partly: 0, failing: 0, none: 0 };
  const missing: string[] = [];
  for (const r of reqs) {
    const s = standing(testsFor(b.evidence, r));
    by[s] += 1;
    if (s === "none" || s === "partly") missing.push(r);
  }
  return { ...by, total: reqs.length, missing };
}

/** The findings a library holds against its trace and its specification checks (`trace.baseline.txt` and `spec-kit/mizan.baseline.txt`): debt that only shrinks, as a count. */
export function heldFindings(b: Build, library: string): number {
  const dir = library === "repository" ? "commons" : (b.config.packages.find((p) => p.slug === library)?.dir ?? `commons/${library}`);
  let n = 0;
  for (const f of [`${dir}/trace.baseline.txt`, `${dir}/spec-kit/mizan.baseline.txt`, ...(library === "repository" ? ["commons/spec-kit/mizan.baseline.txt"] : [])]) {
    if (!b.exists(f)) continue;
    n += b.read(f).split("\n").filter((l) => l.trim() !== "" && !l.startsWith("#")).length;
  }
  return n;
}

const openIssuesOf = (ev: Evidence, library: string): TypedIssue[] => ev.issues.filter((i) => i.library === library && isOpen(i));
const openTicketsOf = (ev: Evidence, library: string): Ticket[] => ev.tickets.filter((t) => t.state === "open" && t.libraries.includes(library));

/** The line of a run: which commit and when, or that none is recorded. */
function runLine(b: Build): Inline[] {
  const run = b.evidence.run;
  if (!b.evidence.recorded) return [text("No test run is recorded for this build of the site, so no test is shown as passed.")];
  const commit = run?.commit === undefined ? undefined : run.commit.slice(0, 10);
  return [
    text("Results of the run "),
    ...(commit === undefined ? [] : [text("of the commit "), run?.commit === undefined ? code(commit) : { kind: "link" as const, href: { kind: "external" as const, url: `${b.config.repository}/commit/${run.commit}` }, children: [code(commit)] }, text(" ")]),
    ...(run?.at === undefined ? [] : [text(`at ${run.at} `)]),
    ...(run?.url === undefined ? [] : [text("("), { kind: "link" as const, href: { kind: "external" as const, url: run.url }, children: [text("the run")] }, text(") ")]),
    text("that made this site; a library whose suite was not run in it has none."),
  ];
}

const testRow = (b: Build, t: TestResult): Inline[][] => [
  [text(t.name.replace(/^(\d{3,4}-[a-z0-9-]+ FR-\d{3}[a-z]?(, )?)+: /, ""))],
  t.file === "" ? [] : [{ kind: "link", href: { kind: "external", url: b.index.blob(t.file) }, children: [code(t.file.replace(/^commons\/[a-z0-9-]+\//, ""))] }],
  [text(t.status)],
  [text(`${t.durationMs} ms`)],
  ...(t.message === undefined ? [] : [[text(t.message)]]),
];

/** A requirement as a link to its place in its specification, or as code where no specification of the kits has it (a citation of another repository's). */
const requirementLink = (b: Build, r: string): Inline => {
  const [id, fr] = r.split(" ");
  const there = b.kit.specs.some((sp) => sp.id === id && sp.requirements.some((q) => q.id === fr));
  return there ? link(specPage(id ?? ""), [code(r)], (fr ?? "").toLowerCase()) : code(r);
};

/** The tests of a library as a table, with the heading's id. */
function testTable(b: Build, tests: readonly TestResult[], filter: string): Block {
  const withMessage = tests.some((t) => t.message !== undefined);
  return {
    kind: "table",
    filter,
    head: th("Test", "File", "Result", "Time", ...(withMessage ? ["Why"] : [])),
    rows: tests.map((t) => {
      const row = testRow(b, t);
      return withMessage && t.message === undefined ? [...row, []] : row;
    }),
  };
}

const BANNER = (failed: number): Block => ({
  kind: "callout",
  tone: "warn",
  title: "Tests are failing",
  blocks: [{ kind: "paragraph", inlines: [text(`${plural(failed, "test")} failed in the run these pages show. The site is published anyway, so that the failure is seen and not hidden.`)] }],
});

/** The dashboard, the page of each library, the register of issues and tickets, and a page for each issue. */
export function qualityPages(b: Build): void {
  const ev = b.evidence;
  if (b.config.evidence === undefined) return;
  const libraries = librariesOf(b);
  if (libraries.length === 0 && !ev.recorded && ev.tickets.length === 0) return;
  const failedAll = [...ev.results.values()].reduce((n, l) => n + l.failed, 0);
  const hasOverview = (lib: string): boolean => b.pages.some((p) => p.path === `overview/${lib}.html`);
  const title = (lib: string): string => (lib === "repository" ? "Repository" : (b.packageTitles.get(lib) ?? lib));
  const rows = libraries.map((lib): Inline[][] => {
    const r = ev.results.get(lib);
    const q = requirementStanding(b, lib);
    return [
      [link(`quality/${lib}.html`, title(lib))],
      [text(r === undefined ? "none" : String(r.tests.length))],
      [text(r === undefined ? "" : String(r.passed))],
      [text(r === undefined ? "" : String(r.failed))],
      [text(r === undefined ? "" : String(r.skipped + r.other))],
      [text(q.total === 0 ? "" : `${q.proved} of ${q.total}`)],
      [text(String(heldFindings(b, lib)))],
      [text(String(openIssuesOf(ev, lib).length))],
      [text(String(openTicketsOf(ev, lib).length))],
    ];
  });
  const sum = (f: (l: LibraryResults) => number): number => [...ev.results.values()].reduce((n, l) => n + f(l), 0);
  b.add({
    path: "quality/index.html",
    title: "Quality",
    description: "What the tests and the issues say of each library: results, requirements proved, open issues and tickets.",
    section: "quality",
    group: "Quality",
    order: 0,
    blocks: [
      ...(failedAll > 0 ? [BANNER(failedAll)] : []),
      { kind: "paragraph", inlines: runLine(b) },
      ...(ev.recorded
        ? [{
          kind: "paragraph" as const,
          inlines: [text(`${plural(sum((l) => l.tests.length), "test")} in ${plural(ev.results.size, "library", "libraries")}: ${sum((l) => l.passed)} passed, ${sum((l) => l.failed)} failed, ${sum((l) => l.skipped + l.other)} skipped or planned.`)],
        }]
        : []),
      {
        kind: "table",
        filter: "Filter the libraries",
        head: th("Library", "Tests", "Passed", "Failed", "Skipped", "Proved", "Held", "Issues", "Tickets"),
        rows,
      },
      { kind: "paragraph", inlines: [link("quality/issues/index.html", "Every open issue and ticket"), text(" is in the register. Proved: requirements of the library's specifications whose every test passed (one with no test recorded is not counted as proved). Held: findings of the trace and specification checks held against a baseline. Issues and tickets: open ones.")] },
    ],
  });
  libraries.forEach((lib, i) => {
    const r = ev.results.get(lib);
    const q = requirementStanding(b, lib);
    const open = openIssuesOf(ev, lib);
    const tickets = openTicketsOf(ev, lib);
    const blocks: Block[] = [];
    if (r !== undefined && r.failed > 0) blocks.push(BANNER(r.failed));
    blocks.push({ kind: "paragraph", inlines: runLine(b) });
    if (hasOverview(lib)) blocks.push({ kind: "paragraph", inlines: [text("The library: "), link(`overview/${lib}.html`, title(lib)), text(".")] });
    if (r !== undefined) {
      blocks.push({ kind: "heading", level: 2, id: "tests", text: [text("Tests")] });
      blocks.push({ kind: "paragraph", inlines: [text(`${plural(r.tests.length, "test")}: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped, ${r.other} planned or other.`)] });
      const failing = r.tests.filter((t) => t.status === "failed");
      if (failing.length > 0) blocks.push({ kind: "heading", level: 3, id: "failing", text: [text("Failing")] }, testTable(b, failing, "Filter the failing tests"));
      const notPassed = r.tests.filter((t) => t.status === "skipped" || t.status === "pending" || t.status === "other");
      if (notPassed.length > 0) blocks.push({ kind: "heading", level: 3, id: "not-run", text: [text("Skipped or planned")] }, testTable(b, notPassed.slice(0, 100), "Filter the skipped tests"));
      const slow = [...r.tests].sort((a, c) => c.durationMs - a.durationMs).slice(0, 10).filter((t) => t.durationMs > 0);
      if (slow.length > 0) blocks.push({ kind: "heading", level: 3, id: "slowest", text: [text("Slowest")] }, testTable(b, slow, "Filter the slowest tests"));
    }
    if (q.total > 0) {
      blocks.push({ kind: "heading", level: 2, id: "requirements", text: [text("Requirements")] });
      blocks.push({ kind: "paragraph", inlines: [text(`${q.total} requirements: ${q.proved} proved, ${q.partly} partly (a test skipped or planned), ${q.failing} failing, ${q.none} with no test recorded.`)] });
      const held = heldFindings(b, lib);
      if (held > 0) blocks.push({ kind: "paragraph", inlines: [text(`${plural(held, "finding")} of the trace and specification checks held against a baseline that only shrinks (`), code("trace.baseline.txt"), text(", "), code("mizan.baseline.txt"), text(").")] });
      if (q.missing.length > 0) {
        const shown = q.missing.slice(0, 80);
        blocks.push({
          kind: "paragraph",
          inlines: [text("Not proved by a passing test: "), ...shown.flatMap((x, k): Inline[] => [...(k === 0 ? [] : [text(", ")]), requirementLink(b, x)]), ...(q.missing.length > shown.length ? [text(` and ${q.missing.length - shown.length} more`)] : [])],
        });
      }
    }
    if (open.length > 0 || tickets.length > 0) blocks.push({ kind: "heading", level: 2, id: "issues", text: [text("Open issues and tickets")] });
    if (open.length > 0) blocks.push(issueTable(b, open));
    if (tickets.length > 0) blocks.push(ticketTable(b, tickets));
    b.add({
      path: `quality/${lib}.html`,
      title: `${title(lib)}: quality`,
      navTitle: title(lib),
      description: `Test results, requirements proved and open issues of ${title(lib)}.`,
      section: "quality",
      group: "Libraries",
      order: 100 + i,
      badges: r === undefined ? [{ text: "no run", tone: "neutral" }] : r.failed > 0 ? [{ text: `${r.failed} failing`, tone: "warn" }] : [{ text: "passing", tone: "good" }],
      blocks,
    });
  });
  issuePages(b);
}

/** The table of issues kept as typed code. */
function issueTable(b: Build, issues: readonly TypedIssue[]): Block {
  return {
    kind: "table",
    filter: "Filter the issues",
    head: th("Issue", "Severity", "Priority", "Status", "Cites"),
    rows: [...issues].sort((x, y) => (SEVERITY[x.severity] ?? 9) - (SEVERITY[y.severity] ?? 9) || x.priority.localeCompare(y.priority) || x.id - y.id).map((i) => [
      [link(issuePath(i), issueName(i))],
      [text(i.severity)],
      [text(i.priority)],
      [text(i.status.kind)],
      (i.cites ?? []).slice(0, 3).flatMap((c, k): Inline[] => [...(k === 0 ? [] : [text(", ")]), requirementLink(b, c)]),
    ]),
  };
}

/** The table of tickets of GitHub. */
function ticketTable(b: Build, tickets: readonly Ticket[]): Block {
  return {
    kind: "table",
    filter: "Filter the tickets",
    head: th("Ticket", "State", "Labels", "Requirements"),
    rows: tickets.map((t) => [
      [{ kind: "link", href: { kind: "external", url: t.url }, children: [text(`#${t.number}: ${t.title}`)] }],
      [text(t.state)],
      [text(t.labels.join(", "))],
      t.requirements.slice(0, 3).flatMap((c, k): Inline[] => [...(k === 0 ? [] : [text(", ")]), requirementLink(b, c)]),
    ]),
  };
}

/** The register, and a page for each issue. */
function issuePages(b: Build): void {
  const ev = b.evidence;
  if (ev.issues.length === 0 && ev.tickets.length === 0) return;
  const open = ev.issues.filter(isOpen);
  const closed = ev.issues.filter((i) => !isOpen(i));
  const openTickets = ev.tickets.filter((t) => t.state === "open");
  const blocks: Block[] = [
    { kind: "paragraph", inlines: [text(`${plural(open.length, "issue")} kept as typed code are open (${closed.length} closed), and ${plural(openTickets.length, "ticket")} of GitHub.`)] },
  ];
  if (open.length > 0) blocks.push({ kind: "heading", level: 2, id: "issues", text: [text("Open issues")] }, issueTable(b, open));
  if (openTickets.length > 0) blocks.push({ kind: "heading", level: 2, id: "tickets", text: [text("Open tickets of GitHub")] }, ticketTable(b, openTickets));
  if (closed.length > 0) blocks.push({ kind: "heading", level: 2, id: "closed", text: [text("Closed issues")] }, issueTable(b, closed));
  b.add({
    path: "quality/issues/index.html",
    title: "Issues and tickets",
    description: "The issues kept as typed code and the tickets of GitHub, with what each is about.",
    section: "quality",
    group: "Issues",
    order: 200,
    blocks,
  });
  const byId = new Map(ev.issues.map((i) => [`${i.library}|${i.scope ?? ""}#${i.id}`, i] as const));
  ev.issues.forEach((i, k) => {
    const sb: Block[] = [{ kind: "paragraph", inlines: [text(i.summary)] }];
    const facts: Inline[][][] = [
      [[text("Library")], [link(`quality/${i.library}.html`, i.library === "repository" ? "Repository" : (b.packageTitles.get(i.library) ?? i.library))]],
      [[text("Severity")], [text(i.severity)]],
      [[text("Priority")], [text(i.priority)]],
      [[text("Status")], [text(statusText(i))]],
      ...(i.size === undefined ? [] : [[[text("Size")], [text(i.size)]]]),
      ...(i.goals === undefined || i.goals.length === 0 ? [] : [[[text("Goals")], [text(i.goals.join(", "))]]]),
      [[text("Raised")], [text(i.raised)]],
    ];
    sb.push({ kind: "table", head: th("", ""), rows: facts });
    if ((i.cites ?? []).length > 0) sb.push({ kind: "heading", level: 2, id: "requirements", text: [text("Requirements it is about")] }, { kind: "list", ordered: false, items: (i.cites ?? []).map((c) => [{ kind: "paragraph", inlines: [requirementLink(b, c)] }]) });
    const evidence = i.evidence ?? [];
    if (evidence.length > 0) {
      sb.push({ kind: "heading", level: 2, id: "evidence", text: [text("Evidence")] });
      sb.push({ kind: "list", ordered: false, items: evidence.map((e) => [{ kind: "paragraph", inlines: evidenceInlines(b, e) }]) });
    }
    const links = i.links ?? [];
    if (links.length > 0) {
      sb.push({ kind: "heading", level: 2, id: "related", text: [text("Related issues")] });
      sb.push({
        kind: "list",
        ordered: false,
        items: links.map((l) => {
          const to = byId.get(`${i.library}|${i.scope ?? ""}#${l.to}`);
          return [{ kind: "paragraph", inlines: [text(`${l.kind}: `), to === undefined ? code(String(l.to)) : link(issuePath(to), `${String(l.to).padStart(5, "0")}: ${to.title}`)] }];
        }),
      });
    }
    const badges: Badge[] = [{ text: i.severity, tone: severityTone(i.severity) }, { text: i.status.kind, tone: statusTone(i.status.kind) }];
    b.add({
      path: issuePath(i),
      title: i.title,
      description: i.summary.replace(/\s+/g, " ").slice(0, 200),
      section: "quality",
      group: "Issues",
      order: 300 + k,
      parent: "quality/issues/index.html",
      navKind: i.scope ?? i.library,
      badges,
      blocks: sb,
    });
  });
}

function statusText(i: TypedIssue): string {
  const s = i.status;
  return [s.kind, s.by === undefined ? "" : `by ${s.by}`, s.reason === undefined ? "" : `(${s.reason})`, s.of === undefined ? "" : `of ${s.of}`, s.until === undefined ? "" : `until ${s.until}`].filter((x) => x !== "").join(" ");
}

function evidenceInlines(b: Build, e: { readonly kind: string; readonly [k: string]: unknown }): Inline[] {
  const s = (k: string): string => (typeof e[k] === "string" ? (e[k] as string) : "");
  switch (e.kind) {
    case "file":
      return [text("file "), { kind: "link", href: { kind: "external", url: b.index.blob(s("path")) }, children: [code(s("path") + (typeof e["line"] === "number" ? `:${e["line"]}` : ""))] }];
    case "test":
      return [text("test "), { kind: "link", href: { kind: "external", url: b.index.blob(s("file")) }, children: [code(s("file"))] }, text(`: ${s("name")}`)];
    case "spec":
      return [text("specification "), link(specPage(s("id")), [code(s("id"))])];
    case "commit":
      return [text("commit "), { kind: "link", href: { kind: "external", url: `${b.config.repository}/commit/${s("sha")}` }, children: [code(s("sha").slice(0, 10))] }];
    default:
      return [text(`${e.kind}: ${s("source")}`)];
  }
}

/** The lines the evidence adds to a requirement's entry on its specification's page: the tests with their results, and the open issues and tickets that name it. */
export function requirementEvidence(b: Build, key: string): { readonly badge: Badge | undefined; readonly blocks: Block[] } {
  const ev = b.evidence;
  const tests = testsFor(ev, key);
  const blocks: Block[] = [];
  let badge: Badge | undefined;
  if (ev.recorded) {
    const s = standing(tests);
    badge = s === "none" ? { text: "no test run", tone: "warn" } : s === "proved" ? { text: "passing", tone: "good" } : s === "failing" ? { text: "failing", tone: "warn" } : { text: "partly run", tone: "info" };
    if (tests.length > 0) {
      const shown = tests.slice(0, 5);
      blocks.push({
        kind: "meta",
        inlines: [
          { kind: "strong", children: [text("Tests: ")] },
          ...shown.flatMap((t, k): Inline[] => [...(k === 0 ? [] : [text("; ")]), text(`${t.status}`), text(": "), ...(t.file === "" ? [] : [{ kind: "link" as const, href: { kind: "external" as const, url: b.index.blob(t.file) }, children: [code(t.file.replace(/^commons\/[a-z0-9-]+\//, ""))] }, text(" ")]), text(`${t.name.replace(/^.*?: /, "").slice(0, 90)}`)]),
          ...(tests.length > shown.length ? [text(` and ${tests.length - shown.length} more`)] : []),
        ],
      });
    }
  }
  const issues = ev.issues.filter((i) => isOpen(i) && (i.cites ?? []).includes(key));
  const tickets = ev.tickets.filter((t) => t.state === "open" && t.requirements.includes(key));
  if (issues.length + tickets.length > 0) {
    blocks.push({
      kind: "meta",
      inlines: [
        { kind: "strong", children: [text("Open: ")] },
        ...issues.flatMap((i, k): Inline[] => [...(k === 0 ? [] : [text("; ")]), link(issuePath(i), `issue ${issueName(i)}`)]),
        ...tickets.flatMap((t, k): Inline[] => [...(k === 0 && issues.length === 0 ? [] : [text("; ")]), { kind: "link", href: { kind: "external", url: t.url }, children: [text(`ticket #${t.number}: ${t.title}`)] }]),
      ],
    });
  }
  return { badge, blocks };
}

/** What the evidence adds to the pages that are made: a Quality part on each library's page, a line on each area's page and on each module's, once every page is made. */
export function decorate(b: Build, areas: readonly Area[]): void {
  const ev = b.evidence;
  if (!b.pages.some((p) => p.path === "quality/index.html")) return;
  const replace = (path: string, f: (p: Page) => Page): void => {
    const i = b.pages.findIndex((p) => p.path === path);
    const p = b.pages[i];
    if (p !== undefined) b.pages[i] = f(p);
  };
  const lines = (lib: string): Block[] => {
    const r = ev.results.get(lib);
    const q = requirementStanding(b, lib);
    const open = openIssuesOf(ev, lib).length;
    const tickets = openTicketsOf(ev, lib).length;
    if (r === undefined && q.total === 0 && open + tickets === 0) return [];
    const said = [
      r === undefined ? (ev.recorded ? "no test of the library was in the run" : "no test run is recorded") : `${plural(r.tests.length, "test")}: ${r.passed} passed, ${r.failed} failed, ${r.skipped + r.other} skipped`,
      q.total === 0 ? "" : `${q.proved} of ${q.total} requirements proved`,
      ...(heldFindings(b, lib) > 0 ? [`${plural(heldFindings(b, lib), "finding")} held`] : []),
      `${plural(open, "open issue")}`,
      ...(ev.tickets.length === 0 ? [] : [plural(tickets, "open ticket")]),
    ].filter((x) => x !== "");
    return [{ kind: "meta", inlines: [{ kind: "strong", children: [text("Quality: ")] }, text(`${said.join(", ")}. `), link(`quality/${lib}.html`, "The tests and issues of the library")] }];
  };
  for (const lib of librariesOf(b)) replace(`overview/${lib}.html`, (p) => ({ ...p, blocks: [...p.blocks, { kind: "heading", level: 2, id: "quality", text: [text("Quality")] }, ...lines(lib)] }));
  for (const a of areas) replace(areaPage(a), (p) => ({ ...p, blocks: [...lines(a.pkg.slug), ...p.blocks] }));
  // a module: the requirements its file is written to, and what the tests of them say
  const trace = b.trace;
  if (trace === undefined) return;
  for (const [file, path] of b.apiFiles) {
    const reqs = [...trace.code].filter(([, files]) => files.includes(file)).map(([k]) => k);
    if (reqs.length === 0) continue;
    const results = reqs.map((r) => standing(testsFor(ev, r)));
    const count = (s: string): number => results.filter((x) => x === s).length;
    const said = ev.recorded ? `${plural(reqs.length, "requirement")}: ${count("proved")} proved, ${count("partly")} partly, ${count("failing")} failing, ${count("none")} with no test recorded` : `${plural(reqs.length, "requirement")}; no test run is recorded`;
    replace(path, (p) => ({ ...p, blocks: [{ kind: "meta", inlines: [{ kind: "strong", children: [text("Written to: ")] }, text(`${said}. `), ...reqs.slice(0, 6).flatMap((r, k): Inline[] => [...(k === 0 ? [] : [text(", ")]), requirementLink(b, r)]), ...(reqs.length > 6 ? [text(` and ${reqs.length - 6} more`)] : [])] }, ...p.blocks] }));
  }
}


/** The numbers of the Quality section as a JSON file beside the pages, for a program (an agent) that wants them and not the pages. */
export function qualityData(b: Build): readonly { readonly path: string; readonly text: string; readonly what: string }[] {
  const ev = b.evidence;
  if (!b.pages.some((p) => p.path === "quality/index.html")) return [];
  const libraries = librariesOf(b).map((lib) => {
    const r = ev.results.get(lib);
    const q = requirementStanding(b, lib);
    return {
      library: lib,
      tests: r === undefined ? null : { total: r.tests.length, passed: r.passed, failed: r.failed, skipped: r.skipped, other: r.other },
      requirements: { total: q.total, proved: q.proved, partly: q.partly, failing: q.failing, none: q.none },
      heldFindings: heldFindings(b, lib),
      openIssues: openIssuesOf(ev, lib).map((i) => ({ id: i.id, title: i.title, severity: i.severity, priority: i.priority, status: i.status.kind, cites: i.cites ?? [] })),
      openTickets: openTicketsOf(ev, lib).map((t) => ({ number: t.number, title: t.title, url: t.url, requirements: t.requirements })),
      failing: (r?.tests ?? []).filter((t) => t.status === "failed").map((t) => ({ name: t.name, file: t.file, message: t.message ?? null, requirements: t.requirements })),
    };
  });
  return [{ path: "quality.json", text: `${JSON.stringify({ recorded: ev.recorded, run: ev.run ?? null, libraries }, null, 2)}\n`, what: "the results of the tests, the requirements proved and the open issues and tickets, by library" }];
}
