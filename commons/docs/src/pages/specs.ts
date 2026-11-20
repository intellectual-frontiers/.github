// Spec: 0001-docs FR-001
/**
 * The Specifications section (commons 0011-documentation FR-015, FR-024): a page for each specification in force, its header as badges,
 * an anchor for each requirement and success criterion with its row of `enforcement.tsv` (or of its `reviewed.tsv`) beside it, and, once
 * every other page is made, the pages that cite each; the register; the matrix of every requirement with its mechanism and who enforces
 * it; and the constitution of a plain spec kit.
 *
 * @module
 */
import { fs } from "@intellectual-frontiers/system";
import type { Build } from "../build.ts";
import { under } from "../config.ts";
import type { Enforcement, KitSource, Spec } from "../extract/specs.ts";
import { specPage } from "../links.ts";
import type { Badge, Block, Inline, Page, Tone } from "../model.ts";
import { plain, slugOf } from "../model.ts";

const toneOf = (mechanism: Enforcement["mechanism"] | undefined): Tone =>
  mechanism === "check" || mechanism === "gate" ? "good" : mechanism === "review" ? "info" : "warn";

const statusTone = (s: string): Tone => (s === "Adopted" ? "good" : s === "Superseded" ? "warn" : "neutral");

const ITEM = /^((?:FR|SC)-\d{3}[a-z]?|OQ-\d+)$/;

/** The folder that holds a kit's specifications, from the root, of the kit a specification was read from: `commons/core/spec-kit` for `commons/core/spec-kit/specs/0001-core/spec.md`. */
export function kitDirOf(b: Build, spec: Spec): string {
  return b.kit.sources.find((k) => spec.file.startsWith(`${k.dir}/`))?.dir ?? "";
}

/** The library a spec kit belongs to, by the name of the folder that holds `spec-kit`: `core` for `commons/core/spec-kit`, and `commons` for the repository's own kit. */
export function kitNameOf(dir: string): string {
  const parts = dir.split("/").filter((x) => x !== "");
  const last = parts[parts.length - 1];
  const owner = last === "spec-kit" || last === "specs" ? parts[parts.length - 2] : last;
  return owner ?? "";
}

/** The files that prove a requirement (the tests that name it) and the files written to it (a `// Spec:` header names it), by requirement as `0009-example FR-001`. */
export interface Trace {
  readonly tests: ReadonlyMap<string, readonly string[]>;
  readonly code: ReadonlyMap<string, readonly string[]>;
}

/** Reads the trace from the files of the repository: a requirement named in a quoted string of a test file is proved by it, and one named in the `// Spec:` header of any other file is written there. */
export function traceOf(b: Build): Trace {
  const tests = new Map<string, Set<string>>();
  const code = new Map<string, Set<string>>();
  const roots = [...new Set(b.kit.sources.map((k) => k.dir.split("/").slice(0, -1).join("/")))].filter((d) => d !== "" || b.kit.sources.length > 0);
  const walk = (rel: string, out: string[]): void => {
    if (!b.exists(rel)) return;
    for (const e of [...fs.readDirSync(b.abs(rel))].sort((x, y) => (x.name < y.name ? -1 : 1))) {
      const child = under(rel, e.name);
      if (e.isDirectory) {
        if (e.name !== "node_modules" && e.name !== "dist" && !e.name.startsWith(".")) walk(child, out);
      } else if (e.isFile && e.name.endsWith(".ts") && !e.name.includes(".auto.")) out.push(child);
    }
  };
  const files: string[] = [];
  for (const r of roots) walk(r, files);
  const top = roots.length === 0 ? "" : (roots.map((r) => r.split("/")[0] ?? "").find((x) => x !== "") ?? "");
  if (top === "commons" || roots.includes("commons")) walk("tests", files);
  for (const f of [...new Set(files)]) {
    const text = b.read(f);
    if (f.includes(".test.") || /(^|\/)(suite|tests)\//.test(f)) {
      for (const m of text.matchAll(/"(\d{3,4}-[a-z0-9-]+ FR-\d{3}[a-z]?)"/g)) {
        const key = m[1] ?? "";
        tests.set(key, (tests.get(key) ?? new Set()).add(f));
      }
    } else {
      const head = /^\/\/ Spec: (\d{3,4}-[a-z0-9-]+) ([^\n]*)/m.exec(text.slice(0, 400));
      if (head !== null) for (const r of (head[2] ?? "").matchAll(/FR-\d{3}[a-z]?/g)) {
        const key = `${head[1]} ${r[0]}`;
        code.set(key, (code.get(key) ?? new Set()).add(f));
      }
    }
  }
  const frozen = (m: Map<string, Set<string>>): ReadonlyMap<string, readonly string[]> => new Map([...m].map(([k, v]) => [k, [...v].sort()] as const));
  return { tests: frozen(tests), code: frozen(code) };
}

/** The number of a specification's id: `0009` of `0009-example`. */
export const numberOf = (id: string): string => id.split("-")[0] ?? id;

/** The page of the constitution of a plain spec kit. */
export const CONSTITUTION_PAGE = "specs/constitution.html";

/** The enforcement of a requirement, as a line under it; a plain kit says only what its `reviewed.tsv` says. */
function enforcedLine(spec: Spec, e: Enforcement | undefined): Block[] {
  if (spec.layout === "spec-kit") {
    return e === undefined ? [] : [{ kind: "meta", inlines: [{ kind: "strong", children: [{ kind: "text", text: "Reviewed: " }] }, { kind: "text", text: e.note }] }];
  }
  if (e === undefined) return [{ kind: "meta", inlines: [{ kind: "text", text: "No row in enforcement.tsv." }] }];
  const by: Inline[] = e.by === "-" ? [] : [{ kind: "code", text: e.by }, { kind: "text", text: " — " }];
  return [{ kind: "meta", inlines: [{ kind: "strong", children: [{ kind: "text", text: `Enforced (${e.mechanism}): ` }] }, ...by, { kind: "text", text: e.note }] }];
}

/** The badges of a requirement: its mechanism, or, in a plain kit, `review` where it is reviewed and none where it is not. */
function requirementBadges(spec: Spec, e: Enforcement | undefined): Badge[] {
  if (spec.layout === "spec-kit") return e === undefined ? [] : [{ text: "review", tone: "info" }];
  return [{ text: e?.mechanism ?? "no row", tone: toneOf(e?.mechanism) }];
}

/** The lines under a requirement that say which files prove it and which are written to it. */
function traceLines(b: Build, trace: Trace, key: string): Block[] {
  const line = (label: string, files: readonly string[] | undefined): Block[] => {
    if (files === undefined || files.length === 0) return [];
    const shown = files.slice(0, 6);
    return [{
      kind: "meta",
      inlines: [
        { kind: "strong", children: [{ kind: "text", text: `${label}: ` }] },
        ...shown.flatMap((f, i): Inline[] => [...(i === 0 ? [] : [{ kind: "text", text: ", " } as Inline]), { kind: "link", href: { kind: "external", url: b.index.blob(f) }, children: [{ kind: "code", text: f.replace(/^commons\//, "") }] }]),
        ...(files.length > shown.length ? [{ kind: "text", text: ` and ${files.length - shown.length} more` } as Inline] : []),
      ],
    }];
  };
  return [...line("Proved by", trace.tests.get(key)), ...line("Written in", trace.code.get(key))];
}

/** A list whose items are numbered items of the specification, made into entries with anchors. */
function itemEntries(b: Build, spec: Spec, list: Extract<Block, { kind: "list" }>, trace: Trace): Block[] | undefined {
  const entries: Block[] = [];
  for (const item of list.items) {
    const first = item[0];
    if (first === undefined || first.kind !== "paragraph") return undefined;
    const lead = first.inlines[0];
    if (lead === undefined || lead.kind !== "strong") return undefined;
    const id = plain(lead.children);
    if (!ITEM.test(id)) return undefined;
    const rest = first.inlines.slice(1);
    const head = rest[0];
    const trimmed: Inline[] = head !== undefined && head.kind === "text" ? [{ kind: "text", text: head.text.replace(spec.layout === "commons" ? /^:\s*/ : /^:?\s*/, "") }, ...rest.slice(1)] : rest;
    const e = id.startsWith("FR-") ? b.kit.enforcement.get(`${spec.id} ${id}`) : undefined;
    const badges: Badge[] = id.startsWith("FR-")
      ? requirementBadges(spec, e)
      : [{ text: id.startsWith("SC-") ? "success criterion" : "open question", tone: "neutral" }];
    entries.push({
      kind: "entry",
      id: id.toLowerCase(),
      name: id,
      badges,
      blocks: [{ kind: "paragraph", inlines: trimmed }, ...item.slice(1), ...(id.startsWith("FR-") ? enforcedLine(spec, e) : []), ...(id.startsWith("FR-") ? traceLines(b, trace, `${spec.id} ${id}`) : [])],
    });
  }
  return entries;
}

/** The title of the library whose spec kit holds a specification: the title of its package where the site has one, else its folder's name. */
function libraryTitle(b: Build, spec: Spec): string {
  const name = kitNameOf(kitDirOf(b, spec));
  if (name === "" || name === "commons") return "Commons";
  return b.packageTitles.get(name) ?? name;
}

/** A specification's page, without the pages that cite it, which `citedBy` adds once every page is made. */
function specPageOf(b: Build, spec: Spec, order: number, trace: Trace): Page {
  const page = specPage(spec.id);
  const file = spec.file;
  const scope = { page, file, spec: spec.id };
  const blocks: Block[] = [];
  const parent = spec.partOf;
  const said = [spec.id, ...(spec.owner === "" ? [] : [`owner ${spec.owner}`]), ...(spec.domain === "" ? [] : [`domain ${spec.domain}`])].join(" · ");
  blocks.push({
    kind: "paragraph",
    inlines: [
      { kind: "text", text: said },
      ...(parent === undefined ? [] : [{ kind: "text" as const, text: " · part of " }, ...b.line(parent, scope)]),
    ],
  });
  if (spec.input !== "") blocks.push({ kind: "callout", tone: "note", title: "Input", blocks: b.md(spec.input, scope) });
  for (const block of b.md(spec.body, scope)) {
    if (block.kind === "list") {
      const entries = itemEntries(b, spec, block, trace);
      if (entries !== undefined) {
        blocks.push(...entries);
        continue;
      }
    }
    blocks.push(block);
  }
  const lead = spec.input !== "" ? spec.input : /^(?![#>|`-])[^\n]+(?:\n(?![#>|`-])[^\n]+)*/m.exec(spec.body)?.[0] ?? spec.title;
  return {
    path: page,
    title: spec.title,
    description: plain(b.line(lead, scope)).slice(0, 240),
    section: "specs",
    group: libraryTitle(b, spec),
    order,
    badges: [{ text: numberOf(spec.id), tone: "neutral" }, ...(spec.status === "" ? [] : [{ text: spec.status, tone: statusTone(spec.status) }])],
    blocks,
  };
}

/** Where a kit's specifications come from, as the register says it. */
function registerSource(k: KitSource): string {
  return k.layout === "commons" ? `as ${under(k.dir, "registry.tsv")} lists them` : `as the folders of ${k.dir === "" ? "the root" : `${k.dir}/`} hold them`;
}

/** What a kit's matrix rows come from, as the matrix says it. */
function matrixSource(k: KitSource): string {
  return k.layout === "commons" ? `with the row ${under(k.dir, "enforcement.tsv")} has for it` : `with the reason the reviewed.tsv beside its specification gives where it is proven by review`;
}

/** A list of phrases joined with commas and a last `and`. */
const joined = (xs: readonly string[]): string => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1] ?? ""}`);

/**
 * The register, the matrix and a page for each specification in force.
 *
 * @param b - the build
 */
export function specPages(b: Build): void {
  if (b.kit.sources.length === 0) return;
  const subject = b.config.subject;
  const commonsOnly = b.kit.sources.every((k) => k.layout === "commons");
  b.add({
    path: "specs/index.html",
    title: "Register",
    description: commonsOnly ? `Every specification of ${subject} in force, with its status, owner, domain and part.` : `Every specification of ${subject} in force, with its status.`,
    section: "specs",
    group: "Spec kit",
    order: 0,
    blocks: [
      {
        kind: "paragraph",
        inlines: [{ kind: "text", text: `Every specification of ${subject} in force, ${joined(b.kit.sources.map(registerSource))}.` }],
      },
      ...b.kit.sources.flatMap((k): Block[] => {
        const here = b.kit.specs.filter((s) => kitDirOf(b, s) === k.dir);
        if (here.length === 0) return [];
        const name = kitNameOf(k.dir);
        const title = name === "" || name === "commons" ? "Commons" : (b.packageTitles.get(name) ?? name);
        return [
          { kind: "heading", level: 2, id: slugOf(name === "" ? "specifications" : name), text: [{ kind: "text", text: title }] },
          {
            kind: "table",
            head: ["Number", "Specification", "Status", "Part of", "Requirements"].map((h) => [{ kind: "text", text: h }]),
            rows: here.map((s) => [
              [{ kind: "code", text: numberOf(s.id) }],
              [{ kind: "link", href: { kind: "page", path: specPage(s.id) }, children: [{ kind: "text", text: s.title }] }],
              [{ kind: "text", text: s.status }],
              s.partOf === undefined ? [] : [{ kind: "link", href: { kind: "page", path: specPage(s.partOf) }, children: [{ kind: "code", text: s.partOf }] }],
              [{ kind: "text", text: String(s.requirements.length) }],
            ]),
          },
        ];
      }),
    ],
  });
  const rows = b.kit.specs.flatMap((s) =>
    s.requirements.map((r): Inline[][] => {
      const e = b.kit.enforcement.get(`${s.id} ${r.id}`);
      return [
        [{ kind: "link", href: { kind: "page", path: specPage(s.id), anchor: r.id.toLowerCase() }, children: [{ kind: "code", text: `${numberOf(s.id)} ${r.id}` }] }],
        [{ kind: "text", text: e?.mechanism ?? (s.layout === "commons" ? "no row" : "") }],
        e === undefined || e.by === "-" ? [] : [{ kind: "code", text: e.by }],
        [{ kind: "text", text: e?.note ?? "" }],
      ];
    })
  );
  b.add({
    path: "specs/matrix.html",
    title: "Traceability matrix",
    description: `Every requirement of ${subject}, with how it is enforced and by what.`,
    section: "specs",
    group: "Spec kit",
    order: 1,
    blocks: [
      { kind: "paragraph", inlines: [{ kind: "text", text: `Every requirement of ${subject}, ${joined(b.kit.sources.map(matrixSource))}.` }] },
      { kind: "table", head: ["Requirement", "Mechanism", "Who", "Note"].map((h) => [{ kind: "text", text: h }]), rows },
    ],
  });
  const c = b.kit.constitution;
  if (c !== undefined) {
    b.files.set(c.file, CONSTITUTION_PAGE);
    const scope = { page: CONSTITUTION_PAGE, file: c.file };
    b.add({
      path: CONSTITUTION_PAGE,
      title: c.title,
      description: `The constitution of ${subject}, which governs every specification.`,
      section: "specs",
      group: "Spec kit",
      order: 2,
      navTitle: "Constitution",
      blocks: b.md(c.body, scope),
    });
  }
  const trace = traceOf(b);
  b.kit.specs.forEach((s, i) => b.add(specPageOf(b, s, 10 + i, trace)));
}

/**
 * The pages that cite each specification and requirement, added to the specifications' pages once every other page is made.
 *
 * @param b - the build
 */
export function citedBy(b: Build): void {
  const titleOf = new Map(b.pages.map((p) => [p.path, p.title]));
  const links = (key: string, self: string): Inline[] => {
    const pages = [...(b.citations.get(key) ?? [])].filter((p) => p !== self).sort();
    return pages.flatMap((p, i): Inline[] => [
      ...(i === 0 ? [] : [{ kind: "text" as const, text: ", " }]),
      { kind: "link", href: { kind: "page", path: p }, children: [{ kind: "text", text: titleOf.get(p) ?? p }] },
    ]);
  };
  for (let i = 0; i < b.pages.length; i++) {
    const p = b.pages[i];
    if (p === undefined || p.section !== "specs" || !p.path.startsWith("specs/") || ["specs/index.html", "specs/matrix.html", CONSTITUTION_PAGE].includes(p.path)) continue;
    const id = p.path.slice("specs/".length, -".html".length);
    const blocks = p.blocks.map((blk): Block => {
      if (blk.kind !== "entry" || !blk.name.startsWith("FR-")) return blk;
      const cited = links(`${id} ${blk.name}`, p.path);
      return cited.length === 0 ? blk : { ...blk, blocks: [...blk.blocks, { kind: "paragraph", inlines: [{ kind: "strong", children: [{ kind: "text", text: "Cited by: " }] }, ...cited] }] };
    });
    const all = links(id, p.path);
    if (all.length > 0) {
      blocks.push({ kind: "heading", level: 2, id: "cited-by", text: [{ kind: "text", text: "Cited by" }] }, { kind: "paragraph", inlines: all });
    }
    b.pages[i] = { ...p, blocks };
  }
}
