/**
 * The state of one build of the site (commons 0011-documentation FR-003): the checkout it reads, its spec kit, the pages made so far, the
 * findings, and what links can reach (the specifications and their requirements, the page that shows each file, and each export's page),
 * with every citation that became a link, so that a specification's page can say which pages cite it.
 *
 * @module
 */
import { fs, path } from "../ts/runtime/mod.ts";
import type { Finding } from "./check.ts";
import type { SpecKit } from "./extract/specs.ts";
import { contextFor, type LinkIndex, type LinkScope } from "./links.ts";
import { markdown } from "./markdown.ts";
import type { Block, Inline, Page } from "./model.ts";

/** The repository on GitHub, for links to files the site does not show and for the top bar. */
export const REPOSITORY = "https://github.com/intellectual-frontiers/.github";

/** One build: what it reads, what it has made, and what it has found. */
export class Build {
  /** The checkout's root. */
  readonly root: string;
  /** The spec kit. */
  readonly kit: SpecKit;
  /** The pages made so far. */
  readonly pages: Page[] = [];
  /** What has been found. */
  readonly found: Finding[] = [];
  /** The page that shows each file of the checkout, by its path from the root. */
  readonly files: Map<string, string> = new Map();
  /** Each export's page and anchor, by area and name. */
  readonly exports: Map<string, Map<string, { readonly path: string; readonly anchor: string }>> = new Map();
  /** The page that shows a model's entity, by its area and export name (`arca!party`). */
  readonly entityPages: Map<string, string> = new Map();
  /** The pages that cite each specification (key `0009-sql-aide`) and each requirement (key `0009-sql-aide FR-001`). */
  readonly citations: Map<string, Set<string>> = new Map();
  /** What links can reach. */
  readonly index: LinkIndex;

  /**
   * A build of a checkout.
   *
   * @param root - the checkout's root
   * @param kit - its spec kit
   */
  constructor(root: string, kit: SpecKit) {
    this.root = root;
    this.kit = kit;
    const specs = new Map(kit.specs.map((s) => [s.id, new Set(itemsOf(s.body))] as const));
    this.index = {
      specs,
      files: this.files,
      exports: this.exports,
      blob: (p) => `${REPOSITORY}/blob/main/${p}`,
      cited: (spec, req, page) => {
        for (const key of req === undefined ? [spec] : [spec, `${spec} ${req}`]) {
          const set = this.citations.get(key) ?? new Set<string>();
          set.add(page);
          this.citations.set(key, set);
        }
      },
    };
  }

  /** Markdown read with this build's links, for a scope. */
  md(text: string, scope: LinkScope): Block[] {
    return markdown(text, contextFor(this.index, scope, this.found));
  }

  /** An example of TSDoc: Markdown where it has a fence, else TypeScript. */
  example(text: string, scope: LinkScope): Block[] {
    return /^\s*(```|~~~)/m.test(text) ? this.md(text, scope) : [{ kind: "code", lang: "ts", text: text.replace(/^\n+|\s+$/g, "") }];
  }

  /** A run of Markdown with this build's links, as inlines. */
  line(text: string, scope: LinkScope): Inline[] {
    const first = this.md(text, scope)[0];
    return first !== undefined && first.kind === "paragraph" ? [...first.inlines] : [{ kind: "text", text }];
  }

  /** A page made. */
  add(page: Page): void {
    this.pages.push(page);
  }

  /** A path of the checkout, from its root. */
  abs(rel: string): string {
    return path.join(this.root, rel);
  }

  /** Whether a path of the checkout exists. */
  exists(rel: string): boolean {
    return fs.existsSync(this.abs(rel));
  }

  /** The text of a file of the checkout. */
  read(rel: string): string {
    return fs.readTextFileSync(this.abs(rel));
  }
}

/** The numbered items of a specification's text: its requirements and success criteria. */
export function itemsOf(body: string): string[] {
  return [...body.matchAll(/^- \*\*((?:FR|SC)-\d{3})\*\*/gm)].map((m) => m[1] ?? "");
}
