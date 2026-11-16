/**
 * The state of one build of the site (commons 0011-documentation FR-003, FR-023): the configuration and the repository it reads, its spec kit, the pages made so far, the
 * findings, and what links can reach (the specifications and their requirements, the page that shows each file, and each export's page),
 * with every citation that became a link, so that a specification's page can say which pages cite it.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/ifc-ts/runtime";
import type { Finding } from "./check.ts";
import type { Config } from "./config.ts";
import type { SpecKit } from "./extract/specs.ts";
import { contextFor, type LinkIndex, type LinkScope, specPage } from "./links.ts";
import { markdown } from "./markdown.ts";
import type { Block, Inline, Page } from "./model.ts";

/** One build: what it reads, what it has made, and what it has found. */
export class Build {
  /** The configuration. */
  readonly config: Config;
  /** The repository's root. */
  readonly root: string;
  /** The spec kit. */
  readonly kit: SpecKit;
  /** The pages made so far. */
  readonly pages: Page[] = [];
  /** What has been found. */
  readonly found: Finding[] = [];
  /** The page that shows each file of the repository, by its path from the root. */
  readonly files: Map<string, string> = new Map();
  /** The API page of each source file, by its path from the root: where its exports have their anchors. */
  readonly apiFiles: Map<string, string> = new Map();
  /** Where each export is shown on the page of the file it is declared in, by `file#name` (the name it is declared with). */
  readonly declared: Map<string, { readonly path: string; readonly anchor: string }> = new Map();
  /** Each export's page and anchor, by area and name. */
  readonly exports: Map<string, Map<string, { readonly path: string; readonly anchor: string }>> = new Map();
  /** The page that shows a model's entity, by its area and export name (`arca!party`). */
  readonly entityPages: Map<string, string> = new Map();
  /** The pages that cite each specification (key `0009-sql-aide`) and each requirement (key `0009-sql-aide FR-001`). */
  readonly citations: Map<string, Set<string>> = new Map();
  /** What links can reach. */
  readonly index: LinkIndex;

  /**
   * A build of a repository.
   *
   * @param config - its configuration
   * @param kit - its spec kits, read
   */
  constructor(config: Config, kit: SpecKit) {
    this.config = config;
    this.root = config.root;
    this.kit = kit;
    const specs = new Map(kit.specs.map((s) => [s.id, new Set(itemsOf(s.body))] as const));
    for (const s of kit.specs) {
      this.files.set(s.file, specPage(s.id));
      this.files.set(s.file.split("/").slice(0, -1).join("/"), specPage(s.id));
    }
    this.index = {
      specs,
      files: this.files,
      exports: this.exports,
      citations: config.citations,
      blob: (p) => `${config.repository}/blob/${config.branch}/${p}`,
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

  /** A path of the repository, absolute, from its path from the root. */
  abs(rel: string): string {
    return path.join(this.root, rel);
  }

  /** Whether a path of the repository exists. */
  exists(rel: string): boolean {
    return fs.existsSync(this.abs(rel));
  }

  /** The text of a file of the repository. */
  read(rel: string): string {
    return fs.readTextFileSync(this.abs(rel));
  }
}

/** The numbered items of a specification's text: its requirements and success criteria. */
export function itemsOf(body: string): string[] {
  return [...body.matchAll(/^- \*\*((?:FR|SC)-\d{3}[a-z]?)\*\*/gm)].map((m) => m[1] ?? "");
}
