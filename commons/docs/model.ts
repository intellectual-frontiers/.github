/**
 * The page model (commons 0011-documentation FR-016): every page of the site is a value of these types before it is HTML. Readers (the
 * Markdown of TSDoc and of specifications, the API reader, the lenses) make blocks and inlines; the HTML emitter is the one writer, and
 * matches every case with a `switch` that ends in `absurd`, so that a case added here and left out there does not compile.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";

/** Where a link goes: a page of the site (by its path from the site's root), or an address outside it. */
export type Href =
  | { readonly kind: "page"; readonly path: string; readonly anchor?: string }
  | { readonly kind: "external"; readonly url: string };

/** A run of text inside a block. */
export type Inline =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "code"; readonly text: string }
  | { readonly kind: "emphasis"; readonly children: readonly Inline[] }
  | { readonly kind: "strong"; readonly children: readonly Inline[] }
  | { readonly kind: "link"; readonly href: Href; readonly children: readonly Inline[] };

/** The languages the highlighter knows; anything else is shown as plain text. */
export type Lang = "ts" | "sql" | "sh" | "toml" | "json" | "turtle" | "mermaid" | "text";

/** A colour of a badge: neutral, or one that says how something stands. */
export type Tone = "neutral" | "good" | "warn" | "info";

/** A small label beside a title: a kind, a status, a mechanism. */
export interface Badge {
  /** What it says. */
  readonly text: string;
  /** Its colour. */
  readonly tone: Tone;
}

/** A card: a title that links somewhere, with a line under it. */
export interface Card {
  /** The title. */
  readonly title: string;
  /** Where it goes. */
  readonly href: Href;
  /** The line under the title. */
  readonly text: readonly Inline[];
  /** Badges beside the title. */
  readonly badges?: readonly Badge[];
  /** Cards shown under this one, a level in. */
  readonly children?: readonly Card[];
}

/** A node of a tree diagram: a label, a note, and what is under it. */
export interface TreeNode {
  /** What the node is called, as code. */
  readonly label: string;
  /** A short note beside it. */
  readonly note?: readonly Inline[];
  /** The nodes under it. */
  readonly children: readonly TreeNode[];
}

/** A tab of a set of tabs. */
export interface Tab {
  /** Its label. */
  readonly label: string;
  /** What it shows. */
  readonly blocks: readonly Block[];
}

/** A part of a page. */
export type Block =
  | { readonly kind: "heading"; readonly level: 2 | 3 | 4; readonly id: string; readonly text: readonly Inline[] }
  | { readonly kind: "paragraph"; readonly inlines: readonly Inline[] }
  | { readonly kind: "meta"; readonly inlines: readonly Inline[] }
  | { readonly kind: "list"; readonly ordered: boolean; readonly items: readonly (readonly Block[])[] }
  | { readonly kind: "code"; readonly lang: Lang; readonly text: string; readonly title?: string }
  | { readonly kind: "table"; readonly head: readonly (readonly Inline[])[]; readonly rows: readonly (readonly (readonly Inline[])[])[] }
  | { readonly kind: "callout"; readonly tone: "note" | "limit" | "warn"; readonly title: string; readonly blocks: readonly Block[] }
  | {
    readonly kind: "entry";
    readonly id: string;
    readonly name: string;
    readonly badges: readonly Badge[];
    readonly signature?: string;
    readonly blocks: readonly Block[];
  }
  | { readonly kind: "tabs"; readonly id: string; readonly tabs: readonly Tab[] }
  | { readonly kind: "diagram"; readonly source: string; readonly caption: string }
  | { readonly kind: "cards"; readonly cards: readonly Card[] }
  | { readonly kind: "badges"; readonly badges: readonly Badge[] }
  | { readonly kind: "tree"; readonly nodes: readonly TreeNode[] };

/** The four sections of the site (FR-009). */
export type Section = "overview" | "specs" | "api" | "models";

/** A page: where it is, what it is called, which section and group of the navigation it is in, and its blocks. */
export interface Page {
  /** Its path from the site's root, ending in `.html`. */
  readonly path: string;
  /** Its title. */
  readonly title: string;
  /** A sentence that says what it is, for the search and the page's description. */
  readonly description: string;
  /** Its section. */
  readonly section: Section;
  /** Its group in the section's navigation. */
  readonly group: string;
  /** Its place in the group: lower first, then by title. */
  readonly order: number;
  /** What the navigation calls it, where that is not its title. */
  readonly navTitle?: string;
  /** Its badges, beside the title. */
  readonly badges?: readonly Badge[];
  /** What it holds. */
  readonly blocks: readonly Block[];
}

/** The text of inlines, with no markup: for a heading's anchor, the search and a page's description. */
export function plain(inlines: readonly Inline[]): string {
  return inlines
    .map((i) => {
      switch (i.kind) {
        case "text":
        case "code":
          return i.text;
        case "emphasis":
        case "strong":
        case "link":
          return plain(i.children);
        default:
          return absurd(i);
      }
    })
    .join("");
}

/** A text as one inline. */
export const text = (t: string): Inline => ({ kind: "text", text: t });

/** An anchor made from a text: lower-case letters, digits and hyphens. */
export function slugOf(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** A name as a possessive: `commons'`, `Stolos'`, `Erga's`. */
export const possessive = (name: string): string => (name.endsWith("s") ? `${name}'` : `${name}'s`);
