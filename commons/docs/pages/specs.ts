/**
 * The Specifications section (commons 0011-documentation FR-015): a page for each specification in force, its header as badges, an
 * anchor for each requirement and success criterion with its row of `enforcement.tsv` beside it, and, once every other page is made, the
 * pages that cite each; the register; and the matrix of every requirement with its mechanism and who enforces it.
 *
 * @module
 */
import type { Build } from "../build.ts";
import type { Enforcement, Spec } from "../extract/specs.ts";
import { specPage } from "../links.ts";
import type { Badge, Block, Inline, Page, Tone } from "../model.ts";
import { plain } from "../model.ts";

const toneOf = (mechanism: Enforcement["mechanism"] | undefined): Tone =>
  mechanism === "check" || mechanism === "gate" ? "good" : mechanism === "review" ? "info" : "warn";

const statusTone = (s: string): Tone => (s === "Adopted" ? "good" : s === "Superseded" ? "warn" : "neutral");

const ITEM = /^((?:FR|SC)-\d{3}|OQ-\d+)$/;

/** The enforcement of a requirement, as a line under it. */
function enforcedLine(e: Enforcement | undefined): Block {
  if (e === undefined) return { kind: "meta", inlines: [{ kind: "text", text: "No row in enforcement.tsv." }] };
  const by: Inline[] = e.by === "-" ? [] : [{ kind: "code", text: e.by }, { kind: "text", text: " — " }];
  return { kind: "meta", inlines: [{ kind: "strong", children: [{ kind: "text", text: `Enforced (${e.mechanism}): ` }] }, ...by, { kind: "text", text: e.note }] };
}

/** A list whose items are numbered items of the specification, made into entries with anchors. */
function itemEntries(b: Build, spec: Spec, list: Extract<Block, { kind: "list" }>): Block[] | undefined {
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
    const trimmed: Inline[] = head !== undefined && head.kind === "text" ? [{ kind: "text", text: head.text.replace(/^:\s*/, "") }, ...rest.slice(1)] : rest;
    const e = id.startsWith("FR-") ? b.kit.enforcement.get(`${spec.id} ${id}`) : undefined;
    const badges: Badge[] = id.startsWith("FR-")
      ? [{ text: e?.mechanism ?? "no row", tone: toneOf(e?.mechanism) }]
      : [{ text: id.startsWith("SC-") ? "success criterion" : "open question", tone: "neutral" }];
    entries.push({
      kind: "entry",
      id: id.toLowerCase(),
      name: id,
      badges,
      blocks: [{ kind: "paragraph", inlines: trimmed }, ...item.slice(1), ...(id.startsWith("FR-") ? [enforcedLine(e)] : [])],
    });
  }
  return entries;
}

/** A specification's page, without the pages that cite it, which `citedBy` adds once every page is made. */
function specPageOf(b: Build, spec: Spec, order: number): Page {
  const page = specPage(spec.id);
  const file = `commons/spec-kit/specs/${spec.id}/spec.md`;
  b.files.set(file, page);
  b.files.set(`commons/spec-kit/specs/${spec.id}`, page);
  const scope = { page, file, spec: spec.id };
  const blocks: Block[] = [];
  const parent = spec.partOf;
  blocks.push({
    kind: "paragraph",
    inlines: [
      { kind: "text", text: `${spec.id} · owner ${spec.owner} · domain ${spec.domain}` },
      ...(parent === undefined ? [] : [{ kind: "text" as const, text: " · part of " }, ...b.line(parent, scope)]),
    ],
  });
  blocks.push({ kind: "callout", tone: "note", title: "Input", blocks: b.md(spec.input, scope) });
  for (const block of b.md(spec.body, scope)) {
    if (block.kind === "list") {
      const entries = itemEntries(b, spec, block);
      if (entries !== undefined) {
        blocks.push(...entries);
        continue;
      }
    }
    blocks.push(block);
  }
  return {
    path: page,
    title: spec.title,
    description: plain(b.line(spec.input, scope)).slice(0, 240),
    section: "specs",
    group: "Specifications",
    order,
    badges: [{ text: spec.id.slice(0, 4), tone: "neutral" }, { text: spec.status, tone: statusTone(spec.status) }],
    blocks,
  };
}

/**
 * The register, the matrix and a page for each specification in force.
 *
 * @param b - the build
 */
export function specPages(b: Build): void {
  b.add({
    path: "specs/index.html",
    title: "Register",
    description: "Every specification of commons in force, with its status, owner, domain and part.",
    section: "specs",
    group: "Spec kit",
    order: 0,
    blocks: [
      {
        kind: "paragraph",
        inlines: [{ kind: "text", text: "Every specification of commons in force, as commons/spec-kit/registry.tsv lists them." }],
      },
      {
        kind: "table",
        head: ["Number", "Specification", "Status", "Part of", "Requirements"].map((h) => [{ kind: "text", text: h }]),
        rows: b.kit.specs.map((s) => [
          [{ kind: "code", text: s.id.slice(0, 4) }],
          [{ kind: "link", href: { kind: "page", path: specPage(s.id) }, children: [{ kind: "text", text: s.title }] }],
          [{ kind: "text", text: s.status }],
          s.partOf === undefined ? [] : [{ kind: "link", href: { kind: "page", path: specPage(s.partOf) }, children: [{ kind: "code", text: s.partOf }] }],
          [{ kind: "text", text: String(s.requirements.length) }],
        ]),
      },
    ],
  });
  const rows = b.kit.specs.flatMap((s) =>
    s.requirements.map((r): Inline[][] => {
      const e = b.kit.enforcement.get(`${s.id} ${r.id}`);
      return [
        [{ kind: "link", href: { kind: "page", path: specPage(s.id), anchor: r.id.toLowerCase() }, children: [{ kind: "code", text: `${s.id.slice(0, 4)} ${r.id}` }] }],
        [{ kind: "text", text: e?.mechanism ?? "no row" }],
        e === undefined || e.by === "-" ? [] : [{ kind: "code", text: e.by }],
        [{ kind: "text", text: e?.note ?? "" }],
      ];
    })
  );
  b.add({
    path: "specs/matrix.html",
    title: "Traceability matrix",
    description: "Every requirement of commons, with how it is enforced and by what.",
    section: "specs",
    group: "Spec kit",
    order: 1,
    blocks: [
      { kind: "paragraph", inlines: [{ kind: "text", text: "Every requirement of commons, with the row commons/spec-kit/enforcement.tsv has for it." }] },
      { kind: "table", head: ["Requirement", "Mechanism", "Who", "Note"].map((h) => [{ kind: "text", text: h }]), rows },
    ],
  });
  b.kit.specs.forEach((s, i) => b.add(specPageOf(b, s, 10 + i)));
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
    if (p === undefined || p.section !== "specs" || !p.path.startsWith("specs/") || p.path === "specs/index.html" || p.path === "specs/matrix.html") continue;
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
