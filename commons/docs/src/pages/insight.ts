// Spec: 0001-docs FR-017, FR-018, FR-019
/**
 * The pages that read the repository beside the tests (docs 0001-docs FR-017 to FR-019): the quality gate of each library as data, the requirements by specification, what each library imports and is imported by (with licences, and an
 * SBOM in CycloneDX), the notes people left in the code (TODO, FIXME), and the acceptance kits with their findings. Each is made from files of the repository or the evidence, shows what it is made from, and says none where there is none.
 *
 * @module
 */
import { fs } from "@intellectual-frontiers/system";
import type { Build } from "../build.ts";
import type { GateCondition } from "../config.ts";
import { isOpen } from "../evidence.ts";
import { specPage } from "../links.ts";
import type { Block, Inline } from "../model.ts";
import { slugOf } from "../model.ts";
import { requirementStanding } from "./quality.ts";
import { kitDirOf, kitNameOf } from "./specs.ts";

const text = (t: string): Inline => ({ kind: "text", text: t });
const code = (t: string): Inline => ({ kind: "code", text: t });
const th = (...hs: string[]): Inline[][] => hs.map((h) => [text(h)]);
const link = (path: string, label: string): Inline => ({ kind: "link", href: { kind: "page", path }, children: [text(label)] });
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The conditions the configuration gives, or the three that are the default. */
export const gateOf = (b: Build): readonly GateCondition[] => b.config.evidence?.gate ?? [{ id: "ran" }, { id: "tests-pass" }, { id: "no-blocking-issues" }];

/** What a library comes to against the gate: each condition, whether it holds and why not. */
export function gateResult(b: Build, library: string): readonly { readonly condition: GateCondition; readonly holds: boolean; readonly why: string }[] {
  const ev = b.evidence;
  const r = ev.results.get(library);
  const q = requirementStanding(b, library);
  return gateOf(b).map((condition) => {
    switch (condition.id) {
      case "ran":
        return { condition, holds: r !== undefined || !ev.recorded, why: r !== undefined || !ev.recorded ? "" : "its tests were not in the run" };
      case "tests-pass":
        return { condition, holds: r === undefined || r.failed === 0, why: r === undefined || r.failed === 0 ? "" : `${plural(r.failed, "test")} failed` };
      case "no-blocking-issues": {
        const n = ev.issues.filter((i) => i.library === library && isOpen(i) && (i.severity === "critical" || i.severity === "high")).length;
        return { condition, holds: n === 0, why: n === 0 ? "" : `${plural(n, "open issue")} of severity high or critical` };
      }
      case "requirements-proved": {
        const min = condition.min ?? 100;
        const pct = q.total === 0 ? 100 : Math.round((q.proved / q.total) * 100);
        return { condition, holds: pct >= min, why: pct >= min ? "" : `${pct}% of the requirements are proved, ${min}% are wanted` };
      }
    }
  });
}

const GATE_TEXT: Readonly<Record<GateCondition["id"], string>> = {
  ran: "its tests were in the run",
  "tests-pass": "no test failed",
  "no-blocking-issues": "no open issue of severity high or critical",
  "requirements-proved": "its requirements are proved",
};

/** The text of the gate for a library page: the conditions it is held to and which hold. */
export function gateBlocks(b: Build, library: string): Block[] {
  const result = gateResult(b, library);
  const failed = result.filter((x) => !x.holds);
  return [
    { kind: "heading", level: 2, id: "gate", text: [text("Quality gate")] },
    { kind: "paragraph", inlines: [text(failed.length === 0 ? "The library holds every condition of the gate." : `The library does not hold ${plural(failed.length, "condition")} of the gate. The gate is shown and enforces nothing: the site is published whatever it says.`)] },
    { kind: "table", head: th("Condition", "Holds", "Why not"), rows: result.map((x) => [[text(`${GATE_TEXT[x.condition.id]}${x.condition.min === undefined ? "" : ` (${x.condition.min}%)`}`)], [text(x.holds ? "yes" : "no")], [text(x.why)]]) },
  ];
}

/** The gate of a library as `pass` or `fail`, for the dashboard. */
export const gateMark = (b: Build, library: string): string => (gateResult(b, library).every((x) => x.holds) ? "pass" : "fail");

const packagesOf = (b: Build): readonly { readonly slug: string; readonly dir: string }[] => b.config.packages.filter((p) => p.dir !== "").map((p) => ({ slug: p.slug, dir: p.dir }));

interface Manifest {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly internal: readonly string[];
  readonly external: readonly (readonly [name: string, range: string, kind: "dependency" | "peer" | "dev"])[];
}

function manifestOf(b: Build, dir: string): Manifest | undefined {
  const file = `${dir}/package.json`;
  if (!b.exists(file)) return undefined;
  try {
    const j = JSON.parse(b.read(file)) as Record<string, unknown>;
    const take = (key: string, kind: "dependency" | "peer" | "dev"): (readonly [string, string, "dependency" | "peer" | "dev"])[] =>
      Object.entries((typeof j[key] === "object" && j[key] !== null ? j[key] : {}) as Record<string, unknown>).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v), kind] as const);
    const all = [...take("dependencies", "dependency"), ...take("peerDependencies", "peer"), ...take("devDependencies", "dev")];
    return {
      name: typeof j["name"] === "string" ? j["name"] : "",
      version: typeof j["version"] === "string" ? j["version"] : "",
      license: typeof j["license"] === "string" ? j["license"] : "",
      internal: [...new Set(all.filter(([k]) => k.startsWith("@intellectual-frontiers/")).map(([k]) => k.slice("@intellectual-frontiers/".length)))].sort(),
      external: all.filter(([k]) => !k.startsWith("@intellectual-frontiers/")).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)),
    };
  } catch {
    return undefined;
  }
}

/** The pages, once the Quality section's own are made. */
export function insightPages(b: Build): void {
  if (b.config.evidence === undefined) return;
  requirementsPage(b);
  dependenciesPage(b);
  todoPage(b);
  acceptancePage(b);
}

function requirementsPage(b: Build): void {
  const rows = b.kit.specs.map((s) => {
    const reqs = s.requirements.filter((r) => r.id.startsWith("FR-")).map((r) => `${s.id} ${r.id}`);
    const by = { proved: 0, partly: 0, failing: 0, none: 0 };
    for (const r of reqs) by[standingOf(b, r)] += 1;
    return { s, total: reqs.length, ...by };
  }).filter((x) => x.total > 0);
  const sum = (f: (x: (typeof rows)[number]) => number): number => rows.reduce((n, x) => n + f(x), 0);
  const pct = (n: number, d: number): string => (d === 0 ? "" : `${Math.round((n / d) * 100)}%`);
  b.add({
    path: "quality/requirements.html",
    title: "Requirements",
    description: "Every specification with how many of its requirements are proved by a passing test, partly, failing or have no test recorded.",
    section: "quality",
    group: "Quality",
    order: 2,
    blocks: [
      { kind: "paragraph", inlines: [text(b.evidence.recorded ? `${plural(sum((x) => x.total), "requirement")} of ${plural(rows.length, "specification")}: ${sum((x) => x.proved)} proved (${pct(sum((x) => x.proved), sum((x) => x.total))}), ${sum((x) => x.partly)} partly, ${sum((x) => x.failing)} failing, ${sum((x) => x.none)} with no test recorded.` : "No test run is recorded for this build of the site, so no requirement is shown as proved.")] },
      {
        kind: "table",
        filter: "Filter the specifications",
        head: th("Specification", "Library", "Requirements", "Proved", "Partly", "Failing", "No test"),
        rows: rows.sort((x, y) => (x.s.id < y.s.id ? -1 : 1)).map((x) => [
          [link(specPage(x.s.id), x.s.id)],
          [text(kitNameOf(kitDirOf(b, x.s)) || "commons")],
          [text(String(x.total))],
          [text(String(x.proved))],
          [text(String(x.partly))],
          [text(String(x.failing))],
          [text(String(x.none))],
        ]),
      },
    ],
  });
}

const standingOf = (b: Build, key: string): "proved" | "partly" | "failing" | "none" => {
  const tests = [...b.evidence.results.values()].flatMap((l) => l.tests.filter((t) => t.requirements.includes(key)));
  if (tests.length === 0) return "none";
  if (tests.some((t) => t.status === "failed")) return "failing";
  return tests.every((t) => t.status === "passed") ? "proved" : "partly";
};

function dependenciesPage(b: Build): void {
  const libs = packagesOf(b).map((p) => ({ ...p, m: manifestOf(b, p.dir) })).filter((x): x is typeof x & { m: Manifest } => x.m !== undefined);
  const importedBy = new Map<string, string[]>();
  for (const l of libs) for (const dep of l.m.internal) importedBy.set(dep, [...(importedBy.get(dep) ?? []), l.slug]);
  const known = new Set(libs.map((l) => l.slug));
  const overview = (slug: string): Inline => (b.pages.some((p) => p.path === `overview/${slug}.html`) ? link(`overview/${slug}.html`, slug) : code(slug));
  const list = (xs: readonly string[]): Inline[] => xs.flatMap((x, i): Inline[] => [...(i === 0 ? [] : [text(", ")]), known.has(x) ? overview(x) : code(x)]);
  const externals = new Map<string, Set<string>>();
  for (const l of libs) for (const [name, range] of l.m.external) externals.set(`${name}@${range}`, (externals.get(`${name}@${range}`) ?? new Set()).add(l.slug));
  const licences = new Map<string, number>();
  for (const l of libs) licences.set(l.m.license === "" ? "see its LICENSE" : l.m.license, (licences.get(l.m.license === "" ? "see its LICENSE" : l.m.license) ?? 0) + 1);
  b.add({
    path: "quality/dependencies.html",
    title: "Dependencies",
    description: "What each library imports of the others and of npm, who imports it, and its licence; with an SBOM in CycloneDX.",
    section: "quality",
    group: "Quality",
    order: 3,
    blocks: [
      { kind: "paragraph", inlines: [text(`${plural(libs.length, "library", "libraries")} and ${plural(externals.size, "external package version")}, read from each library's package.json. The software bill of materials is `), { kind: "link", href: { kind: "external", url: "../sbom.cdx.json" }, children: [code("sbom.cdx.json")] }, text(" (CycloneDX 1.5).")] },
      { kind: "heading", level: 2, id: "libraries", text: [text("Libraries")] },
      {
        kind: "table",
        filter: "Filter the libraries",
        head: th("Library", "Version", "Imports", "Imported by", "External packages", "Licence"),
        rows: libs.map((l) => [
          [overview(l.slug)],
          [code(l.m.version)],
          list(l.m.internal),
          list([...new Set(importedBy.get(l.slug) ?? [])].sort()),
          [text(String(l.m.external.length))],
          [text(l.m.license === "" ? "see its LICENSE" : l.m.license)],
        ]),
      },
      { kind: "heading", level: 2, id: "packages", text: [text("External packages")] },
      {
        kind: "table",
        filter: "Filter the packages",
        head: th("Package", "Used by"),
        rows: [...externals].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([k, v]) => [[code(k)], list([...v].sort())]),
      },
      { kind: "heading", level: 2, id: "licences", text: [text("Licences of the libraries")] },
      { kind: "list", ordered: false, items: [...licences].sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, n]) => [{ kind: "paragraph", inlines: [text(`${k}: ${plural(n, "library", "libraries")}`)] }]) },
    ],
  });
}

/** The SBOM, deterministic: CycloneDX 1.5 with a component for each library and each external package version, and the dependencies between them. */
export function sbom(b: Build): { readonly path: string; readonly text: string; readonly what: string } | undefined {
  if (b.config.evidence === undefined) return undefined;
  const libs = packagesOf(b).map((p) => ({ ...p, m: manifestOf(b, p.dir) })).filter((x): x is typeof x & { m: Manifest } => x.m !== undefined);
  const ext = new Map<string, { name: string; range: string }>();
  for (const l of libs) for (const [name, range, kind] of l.m.external) if (kind !== "dev") ext.set(`${name}@${range}`, { name, range });
  const ref = (name: string, v: string): string => `pkg:npm/${name.replace("@", "%40")}@${v}`;
  const doc = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: { component: { type: "application", name: b.config.name, "bom-ref": "root" } },
    components: [
      ...libs.map((l) => ({ type: "library", name: l.m.name, version: l.m.version, "bom-ref": ref(l.m.name, l.m.version), ...(l.m.license === "" ? {} : { licenses: [{ license: { id: l.m.license } }] }) })),
      ...[...ext].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([, e]) => ({ type: "library", name: e.name, version: e.range, "bom-ref": ref(e.name, e.range) })),
    ],
    dependencies: libs.map((l) => ({ ref: ref(l.m.name, l.m.version), dependsOn: l.m.external.filter(([, , k]) => k !== "dev").map(([n, r]) => ref(n, r)).sort() })),
  };
  return { path: "sbom.cdx.json", text: `${JSON.stringify(doc, null, 2)}\n`, what: "the software bill of materials of the libraries and the packages they depend on, in CycloneDX 1.5" };
}

const NOTE = /\b(TODO|FIXME|XXX|HACK)\b[:(\s-]*(.{0,140})/;

function todoPage(b: Build): void {
  const rows: { lib: string; file: string; line: number; kind: string; text: string }[] = [];
  const walk = (dir: string, lib: string): void => {
    if (!b.exists(dir)) return;
    for (const e of [...fs.readDirSync(b.abs(dir))].sort((x, y) => (x.name < y.name ? -1 : 1))) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory) {
        if (!["node_modules", "dist", "fixtures", "fixture", "fixture-repo", ".git"].includes(e.name) && !e.name.startsWith(".")) walk(rel, lib);
      } else if (e.isFile && e.name.endsWith(".ts") && !e.name.includes(".auto.")) {
        b.read(rel).split("\n").forEach((l, i) => {
          const m = NOTE.exec(l);
          if (m !== null && /(\/\/|\/\*|\*)\s*\S*\s*(TODO|FIXME|XXX|HACK)/.test(l)) rows.push({ lib, file: rel, line: i + 1, kind: m[1] ?? "", text: (m[2] ?? "").trim() });
        });
      }
    }
  };
  for (const p of packagesOf(b)) walk(p.dir, p.slug);
  const shown = rows.slice(0, 600);
  const byLib = new Map<string, number>();
  for (const r of rows) byLib.set(r.lib, (byLib.get(r.lib) ?? 0) + 1);
  b.add({
    path: "quality/todo.html",
    title: "Notes in the code",
    description: "The TODO, FIXME, XXX and HACK notes people left in the sources of the libraries.",
    section: "quality",
    group: "Quality",
    order: 4,
    blocks: rows.length === 0
      ? [{ kind: "paragraph", inlines: [text("No TODO, FIXME, XXX or HACK note is left in the sources of the libraries.")] }]
      : [
        { kind: "paragraph", inlines: [text(`${plural(rows.length, "note")} in ${plural(byLib.size, "library", "libraries")}: ${[...byLib].sort(([x], [y]) => (x < y ? -1 : 1)).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(", ")}${byLib.size > 12 ? ", …" : ""}.`)] },
        { kind: "table", filter: "Filter the notes", head: th("Library", "Kind", "Where", "Note"), rows: shown.map((r) => [[text(r.lib)], [text(r.kind)], [{ kind: "link", href: { kind: "external", url: `${b.index.blob(r.file)}#L${r.line}` }, children: [code(`${r.file.replace(/^commons\//, "")}:${r.line}`)] }], [text(r.text)]]) },
        ...(rows.length > shown.length ? [{ kind: "paragraph" as const, inlines: [text(`${rows.length - shown.length} more are not listed here.`)] }] : []),
      ],
  });
}

function acceptancePage(b: Build): void {
  const kits: { lib: string; folder: string; kit: string; kind: string; findings: number; known: number; fixed: number }[] = [];
  for (const p of packagesOf(b)) {
    for (const folder of ["acceptance", "oat", "uat", "aat"]) {
      const root = `${p.dir}/${folder}`;
      if (!b.exists(root)) continue;
      for (const e of [...fs.readDirSync(b.abs(root))].filter((x) => x.isDirectory && b.exists(`${root}/${x.name}/README.md`)).sort((x, y) => (x.name < y.name ? -1 : 1))) {
        const readme = b.read(`${root}/${e.name}/README.md`);
        const kind = /\b(UAT|OAT|AAT)\b/.exec(readme.split("\n").slice(0, 3).join(" "))?.[1] ?? folder.toUpperCase();
        const f = b.exists(`${root}/${e.name}/FINDINGS.md`) ? b.read(`${root}/${e.name}/FINDINGS.md`) : "";
        const rows = (re: RegExp): number => f.split("\n").filter((l) => re.test(l)).length;
        kits.push({ lib: p.slug, folder, kit: e.name, kind, findings: rows(/^\| [KF]\d+ \|/), known: rows(/^\| K\d+ \|/), fixed: rows(/^\| F\d+ \|/) });
      }
    }
  }
  b.add({
    path: "quality/acceptance.html",
    title: "Acceptance kits",
    description: "Testing by people and agents for the experience beyond the code: the kits of the libraries and what they found.",
    section: "quality",
    group: "Quality",
    order: 6,
    blocks: kits.length === 0
      ? [{ kind: "paragraph", inlines: [text("No library keeps an acceptance kit.")] }]
      : [
        { kind: "paragraph", inlines: [text("Acceptance is testing by people, or by agents acting as people, for the experience beyond the code. A kit is a guide, its data and its own checks; its findings are what the people who followed it wrote down.")] },
        { kind: "table", head: th("Library", "Kit", "Kind", "Known findings", "Found and fixed"), rows: kits.map((k) => [[text(k.lib)], [{ kind: "link", href: { kind: "external", url: b.index.blob(`commons/${k.lib}/${k.folder}/${k.kit}/README.md`) }, children: [code(`${k.folder}/${k.kit}`)] }], [text(k.kind)], [text(String(k.known))], [text(String(k.fixed))]]) },
      ],
  });
}

void slugOf;
