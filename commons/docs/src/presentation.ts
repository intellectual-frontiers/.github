// Spec: 0001-docs FR-007
/**
 * The presentations of the pages (docs 0001-docs FR-007): the pages are one model, and a presentation is a way of writing them as files. There are four. The `web` is the static site (a
 * page of HTML for each page, the stylesheet, the script, the search index); the `markdown` is the Markdown twin of each page and `llms.txt` for a program; the `data` is the JSON the
 * lenses add; the `book` is the AsciiDoc of the volumes of a book (docs 0001-docs FR-008). A presentation makes its files in memory, as a list, so that the same list is written
 * (`build`), or compared with what is on disk (`build --check`), and the same pages give the same bytes in each.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { bookFiles } from "./book.ts";
import type { Finding } from "./check.ts";
import type { Config, PresentationId } from "./config.ts";
import { document } from "./emit/html.ts";
import { llmsIndex, markdownOf, twinOf } from "./emit/markdown.ts";
import { searchIndex } from "./emit/search.ts";
import type { Built } from "./site.ts";

/** A file a presentation makes: its path from the output folder, and its text or the file it is copied from. */
export type OutFile = { readonly path: string; readonly text: string } | { readonly path: string; readonly from: string };

/** What a presentation makes: its files, and what it found while making them. */
export interface Made {
  /** The files, by path. */
  readonly files: readonly OutFile[];
  /** What was found. */
  readonly found: readonly Finding[];
}

/** The typefaces of the site (FR-035): Latin subsets of two variable fonts under the SIL Open Font License 1.1, with their license texts, served by the site itself. */
const FONTS = ["inter-latin-wght-normal.woff2", "jetbrains-mono-latin-wght-normal.woff2", "Inter-OFL.txt", "JetBrainsMono-OFL.txt"] as const;

/** The files of the theme (beside this module, in the source and in the package alike), and where the site serves them. */
function assets(): readonly OutFile[] {
  const theme = (f: string): string => path.fromFileUrl(new URL(`./theme/${f}`, import.meta.url));
  return [
    { path: "assets/fumadocs.css", from: theme("fumadocs.css") },
    { path: "assets/site.css", from: theme("site.css") },
    { path: "assets/site.js", from: theme("site.js") },
    ...FONTS.map((f): OutFile => ({ path: `assets/fonts/${f}`, from: theme(`fonts/${f}`) })),
  ];
}

const web = (config: Config, built: Built): Made => {
  const sections = [...new Set(built.pages.map((p) => p.section))];
  const site = { name: config.name, repository: config.repository, pages: built.pages, sections, ...(built.release === undefined ? {} : { release: built.release }) };
  const pages = [...built.pages].sort((a, b) => (a.path < b.path ? -1 : 1));
  return {
    files: [
      ...pages.map((p): OutFile => ({ path: p.path, text: document(p, site) })),
      ...assets(),
      { path: "search.json", text: `${JSON.stringify(searchIndex(built.pages))}\n` },
      { path: ".nojekyll", text: "" },
    ],
    found: [],
  };
};

const markdown = (config: Config, built: Built): Made => ({
  files: [
    ...[...built.pages].sort((a, b) => (a.path < b.path ? -1 : 1)).map((p): OutFile => ({ path: twinOf(p.path), text: markdownOf(p) })),
    { path: "llms.txt", text: llmsIndex(config.name, built.pages, built.files.map((f) => [f.path, f.what] as const)) },
  ],
  found: [],
});

const data = (_config: Config, built: Built): Made => ({
  files: [...built.files].sort((a, b) => (a.path < b.path ? -1 : 1)).map((f): OutFile => ({ path: f.path, text: f.text })),
  found: [],
});

const book = (config: Config, built: Built): Made => {
  const found: Finding[] = [];
  const files = bookFiles(config.books, built.pages, found);
  return { files, found };
};

/** A presentation: a name, and the files it makes of a built site. */
export interface Presentation {
  /** Its name. */
  readonly id: PresentationId;
  /** What it is, in a few words. */
  readonly what: string;
  /** Its files. */
  readonly make: (config: Config, built: Built) => Made;
}

/** The presentations there are. */
export const PRESENTATIONS: readonly Presentation[] = [
  { id: "web", what: "the static site: HTML, stylesheet, script, search index", make: web },
  { id: "markdown", what: "a Markdown twin of every page, and llms.txt", make: markdown },
  { id: "data", what: "the JSON that the lenses add", make: data },
  { id: "book", what: "the AsciiDoc of the volumes of a book of erga", make: book },
];

/**
 * The files of a set of presentations, in the order of the presentations and then of their paths; a path two presentations make is made by the first.
 *
 * @param config - the configuration
 * @param built - the site
 * @param ids - the presentations
 */
export function presentationFiles(config: Config, built: Built, ids: readonly PresentationId[]): Made {
  const files = new Map<string, OutFile>();
  const found: Finding[] = [];
  for (const p of PRESENTATIONS.filter((x) => ids.includes(x.id))) {
    const made = p.make(config, built);
    for (const f of made.files) if (!files.has(f.path)) files.set(f.path, f);
    found.push(...made.found);
  }
  return { files: [...files.values()], found };
}

/**
 * Files written into a folder.
 *
 * @param out - the folder
 * @param files - the files
 */
export async function writeFiles(out: string, files: readonly OutFile[]): Promise<void> {
  for (const f of files) {
    const file = path.join(out, f.path);
    await fs.ensureDir(path.dirname(file));
    if ("text" in f) await fs.writeTextFile(file, f.text);
    else await fs.copyFile(f.from, file);
  }
}

/**
 * The files whose text is not what is in a folder: missing, or different.
 *
 * @param out - the folder
 * @param files - the files that should be there
 */
export async function staleFiles(out: string, files: readonly OutFile[]): Promise<string[]> {
  const stale: string[] = [];
  for (const f of files) {
    const file = path.join(out, f.path);
    if (!fs.existsSync(file)) {
      stale.push(f.path);
      continue;
    }
    const now = await fs.readTextFile(file);
    const want = "text" in f ? f.text : await fs.readTextFile(f.from);
    if (now !== want) stale.push(f.path);
  }
  return stale;
}
