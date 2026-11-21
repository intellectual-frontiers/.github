// Spec: 0001-docs FR-002
/**
 * The releases lens (commons 0011-documentation FR-035): the record of the next release, read from the file the release command writes (`commons/generated/release.auto.json`): each library it publishes, at which version, under which tag
 * and in which order, with a link to the library's page. The lens knows nothing of how the record is made.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import type { Block, Inline, Lens, LensPages } from "../mod.ts";

/** What the releases lens is given. */
export interface ReleasesOptions {
  /** Its name, which the build reports it by. */
  readonly name: string;
  /** The record, from the repository's root. */
  readonly file: string;
}

/** One row of the record. */
interface Row {
  readonly slug: string;
  readonly version: string;
  readonly tag: string;
  readonly publish: boolean;
}

/** The releases lens. */
export function releasesLens(options: ReleasesOptions): Lens {
  return {
    name: options.name,
    read: async (b): Promise<LensPages> => {
      let rows: Row[] = [];
      try {
        const record = JSON.parse(await fs.readTextFile(path.join(b.root, options.file))) as { readonly releases?: readonly Row[] };
        rows = [...(record.releases ?? [])];
      } catch {
        b.found.push({ where: options.file, problem: { kind: "undescribed", entity: `the release record ${options.file}, which the releases lens is told of, cannot be read` } });
      }
      return (build, after) => {
        const text = (t: string): Inline => ({ kind: "text", text: t });
        const blocks: Block[] = [
          { kind: "paragraph", inlines: [text("What the next release publishes and tags, in the order of the imports: a library comes after the libraries it imports. The record is written by the release command and read by the release workflow.")] },
          {
            kind: "table",
            head: ["Order", "Library", "Version", "Tag", "Published"].map((h) => [text(h)]),
            rows: rows.map((r, i) => [[text(String(i + 1))], [build.pages.some((p) => p.path === `overview/${r.slug}.html`) ? { kind: "link", href: { kind: "page", path: `overview/${r.slug}.html` }, children: [{ kind: "code", text: r.slug }] } : { kind: "code", text: r.slug }], [{ kind: "code", text: r.version }], [{ kind: "code", text: r.tag }], [text(r.publish ? "yes" : "tag only")]]),
          },
        ];
        build.add({ path: "overview/releases.html", title: "Releases", description: "What the next release publishes and tags, library by library.", section: "overview", group: "Libraries", order: 8, blocks });
        return after;
      };
    },
  };
}
