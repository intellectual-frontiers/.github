/**
 * The guides lens (commons 0011-documentation FR-032): pages that people write in Markdown for the reader who is new to a repository (a path for each kind of reader, the ideas the repository is built on, and how to do the
 * common things), kept in the repository beside the code and checked like every page: its citations of a specification and its links to a file or a folder become links, an unknown requirement is a finding, and a page names
 * the section and group it is in. The lens knows nothing of what the guides say.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import type { Lens, LensPages, Section } from "../mod.ts";

/** The first sentence of a text, cut at 200 characters. */
function firstSentence(t: string, max = 200): string {
  const flat = t.replace(/\s+/g, " ").trim();
  const s = /^(.+?[.!?])(\s|$)/.exec(flat)?.[1] ?? flat;
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** One guide: its Markdown file and where it is in the site. */
export interface GuideSpec {
  /** The Markdown file, from the repository's root. Its first heading is the page's title. */
  readonly file: string;
  /** The page's address on the site, as `start/new-developer.html`. */
  readonly path: string;
  /** The section it is in. */
  readonly section: Extract<Section, "start" | "concepts" | "howto">;
  /** The group of the navigation it is in. */
  readonly group: string;
  /** Its place in its group, lowest first. */
  readonly order: number;
}

/** What the guides lens is given. */
export interface GuidesOptions {
  /** Its name, which the build reports it by. */
  readonly name: string;
  /** The guides, which include the index page of each section it uses. */
  readonly guides: readonly GuideSpec[];
}

/** The guides lens. */
export function guidesLens(options: GuidesOptions): Lens {
  return {
    name: options.name,
    read: async (b): Promise<LensPages> => {
      const texts = new Map<string, string>();
      for (const g of options.guides) {
        try {
          texts.set(g.file, await fs.readTextFile(path.join(b.root, g.file)));
        } catch {
          b.found.push({ where: g.file, problem: { kind: "undescribed", entity: `the guide ${g.file}, which the guides lens is told of, cannot be read` } });
        }
      }
      for (const g of options.guides) if (texts.has(g.file)) b.files.set(g.file, g.path);
      return (build, after) => {
        for (const g of options.guides) {
          const text = texts.get(g.file);
          if (text === undefined) continue;
          const m = /^#\s+(.+)\n+/.exec(text);
          const title = m?.[1]?.trim() ?? g.path;
          const body = m === null ? text : text.slice(m[0].length);
          const blocks = build.md(body, { page: g.path, file: g.file });
          const lead = /^(?![#>|`\-*\d])[^\n]+/m.exec(body)?.[0] ?? title;
          build.add({ path: g.path, title, description: firstSentence(lead.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, ""), 200), section: g.section, group: g.group, order: g.order, blocks });
        }
        return after;
      };
    },
  };
}
