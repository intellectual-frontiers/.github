// Spec: 0002-dossier-core FR-006
/**
 * The AsciiDoc of a dossier (0046-dossiers FR-050 to FR-053): the writer of the print-shaped model of blocks and inlines, and of the document that holds the plates and the evidence they cite. It writes no include, no macro that needs an extension and only the
 * attributes of a fixed list; every value is made safe with the rules that formats holds (`textAdoc`, `lead`, `codeAdoc`, `fence`); a citation is a reference to the entry of the evidence; and the bytes are the same on every platform: lines end with `\n`,
 * none ends in a space and there is one final newline.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Block, BuildError, DisclosureClass, Inline, Plate, Source } from "@intellectual-frontiers/dossier/governance";
import { codeAdoc, fence, lead, textAdoc } from "@intellectual-frontiers/formats/asciidoc";
import { evidenceAnchor } from "./lens.ts";

/** The attributes a dossier sets, in this order: nothing else is written. */
export const ATTRIBUTES = ["lang", "revdate", "toc", "sectanchors", "nofooter"] as const;

/** Inlines as AsciiDoc. */
export function inlinesAdoc(xs: readonly Inline[]): string {
  return xs
    .map((i): string => {
      switch (i.t) {
        case "text":
          return textAdoc(i.text);
        case "code":
          return codeAdoc(i.text);
        case "em":
          return `__${inlinesAdoc(i.children)}__`;
        case "strong":
          return `**${inlinesAdoc(i.children)}**`;
        case "cite":
          return `xref:${evidenceAnchor(i.source)}[${i.children === undefined ? textAdoc(i.source) : inlinesAdoc(i.children)}]`;
        case "xref":
          return `xref:${i.anchor}[${inlinesAdoc(i.children)}]`;
        default:
          return absurd(i);
      }
    })
    .join("");
}

const cell = (xs: readonly Inline[]): string => inlinesAdoc(xs).replaceAll("|", "\\|").replaceAll("\n", " ");

/** A block as lines of AsciiDoc. */
export function blockAdoc(b: Block): string[] {
  switch (b.t) {
    case "section":
      return ["", `[[${b.id}]]`, `${"=".repeat(b.level + 1)} ${textAdoc(b.title)}`, "", ...b.blocks.flatMap(blockAdoc)];
    case "para":
      return ["", lead(inlinesAdoc(b.inlines))];
    case "list":
      return ["", ...b.items.map((it) => `${b.ordered ? "." : "*"} ${lead(inlinesAdoc(it))}`)];
    case "defs":
      return ["", ...b.items.map((d) => `${textAdoc(d.term)}:: ${inlinesAdoc(d.inlines)}`)];
    case "table":
      return ["", `[cols="${b.head.map(() => "1").join(",")}",options="header"]`, "|===", ...b.head.map((h) => `|${textAdoc(h)}`), ...b.rows.flatMap((r) => ["", ...r.map((c) => `|${cell(c)}`)]), "|==="];
    case "note":
      return ["", `[${b.tone.toUpperCase()}]`, "====", lead(inlinesAdoc(b.inlines)), "===="];
    case "code": {
      const f = fence(b.text);
      return ["", `[source${b.lang === "" ? "" : `,${b.lang}`}]`, f, ...b.text.split("\n"), f];
    }
    default:
      return absurd(b);
  }
}

/** A plate as lines of AsciiDoc: a section of its own, with its slug as its anchor. */
export function plateAdoc(p: Plate): string[] {
  return blockAdoc({ t: "section", level: 1, id: p.slug, title: p.title, blocks: p.blocks });
}

/** What a document is made from. */
export interface DocumentParts {
  readonly title: string;
  readonly asOf: string;
  readonly audience: DisclosureClass;
  readonly inputs: string;
  readonly lenses: readonly { readonly id: string; readonly version: string }[];
  readonly plates: readonly Plate[];
  readonly sources: readonly Source[];
}

/** The anchors a plate holds: its slug and the ids of its sections, at any depth. */
function anchorsOf(bs: readonly Block[]): string[] {
  return bs.flatMap((b) => (b.t === "section" ? [b.id, ...anchorsOf(b.blocks)] : []));
}

/** The inlines of a block, for the citations. */
function citesOf(bs: readonly Block[]): string[] {
  const inl = (xs: readonly Inline[]): string[] => xs.flatMap((i) => (i.t === "cite" ? [i.source, ...(i.children === undefined ? [] : inl(i.children))] : i.t === "em" || i.t === "strong" || i.t === "xref" ? inl(i.children) : []));
  return bs.flatMap((b): string[] => {
    switch (b.t) {
      case "section":
        return citesOf(b.blocks);
      case "para":
      case "note":
        return inl(b.inlines);
      case "list":
        return b.items.flatMap(inl);
      case "defs":
        return b.items.flatMap((d) => inl(d.inlines));
      case "table":
        return b.rows.flatMap((r) => r.flatMap(inl));
      case "code":
        return [];
      default:
        return absurd(b);
    }
  });
}

/** The document: its title and attributes, a part that says what the dossier is and how to verify it, each plate, and the evidence. It is refused where two anchors are one, where a citation names a source the document does not hold, or where a plate's own list of citations is not what its blocks cite. */
export function documentAdoc(d: DocumentParts): Result<string, BuildError> {
  const held = new Set(d.sources.map((s) => s.id));
  const anchors = new Map<string, string>();
  const claim = (a: string, by: string): BuildError | undefined => {
    const old = anchors.get(a);
    if (old !== undefined) return { code: "E-DOSSIER-ANCHOR", message: `the anchor ${a} is claimed by ${old} and by ${by}` };
    anchors.set(a, by);
    return undefined;
  };
  for (const a of ["about", "evidence"]) claim(a, "the document");
  for (const s of d.sources) {
    const e = claim(evidenceAnchor(s.id), `source ${s.id}`);
    if (e !== undefined) return err(e);
  }
  for (const p of d.plates) {
    for (const a of [p.slug, ...anchorsOf(p.blocks)]) {
      const e = claim(a, `plate ${p.slug}`);
      if (e !== undefined) return err(e);
    }
    for (const c of new Set([...p.cites, ...citesOf(p.blocks)])) {
      if (!held.has(c)) return err({ code: "E-DOSSIER-LENS-CITE", message: `plate ${p.slug} cites ${c}, which is not among the sources of the dossier` });
    }
  }
  const lines: string[] = [`= ${textAdoc(d.title)}`, ":lang: en", `:revdate: ${d.asOf}`, ":toc:", ":sectanchors:", ":nofooter:"];
  lines.push("", "[[about]]", "== About this dossier", "");
  lines.push(
    ...blockAdoc({
      t: "defs",
      items: [
        { term: "As of", inlines: [{ t: "text", text: d.asOf }] },
        { term: "Audience", inlines: [{ t: "text", text: d.audience }] },
        { term: "Inputs", inlines: [{ t: "code", text: d.inputs }] },
        { term: "Lenses", inlines: [{ t: "text", text: d.lenses.map((l) => `${l.id} ${l.version}`).join(", ") }] },
      ],
    }),
  );
  lines.push(...blockAdoc({ t: "para", inlines: [{ t: "text", text: "Every statement of fact in this dossier cites its evidence, and the evidence at the end of it names the hash of each source, so that the dossier can be checked against its manifest without any other means." }] }));
  for (const p of d.plates) lines.push(...plateAdoc(p));
  lines.push("", "[[evidence]]", "== Evidence", "");
  lines.push(
    ...blockAdoc({
      t: "table",
      head: ["Source", "Kind", "Observed", "Class", "Hash", "Signer"],
      rows: d.sources.map((s) => [[{ t: "text", text: s.id }], [{ t: "text", text: s.kind }], [{ t: "text", text: s.observedAt }], [{ t: "text", text: s.class }], [{ t: "code", text: s.hash }], [{ t: "text", text: s.signer ?? "not signed" }]]),
    }),
  );
  // The anchor of each entry is a line of its own after the table, so that a citation has a place to go to.
  for (const s of d.sources) lines.push("", `[[${evidenceAnchor(s.id)}]]`, `${lead(textAdoc(`Evidence: ${s.id}`))}`);
  const text = lines.map((l) => l.replace(/[ \t]+$/g, "")).join("\n").replace(/\n{3,}/g, "\n\n");
  return ok(`${text.replace(/^\n+/, "").replace(/\n+$/, "")}\n`);
}
