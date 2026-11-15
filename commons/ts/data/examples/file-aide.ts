/**
 * A query over a folder laid out as IFRFS (commons 0010-file-aide FR-019 to FR-028): the PDFs of every book, in the builder's form and in
 * the text form of the same query, whose plan lists `book/` alone; and `fd`'s walk, every file and folder, `.gitignore` and `.faignore`
 * honoured.
 *
 * @module
 */
import { compile, parseQuery, query, queryTree } from "../file-aide/mod.ts";
import { posixStore } from "../file-aide/runtime/mod.ts";
import { ENTRIES, rendition } from "../ifrfs/mod.ts";

/** The query in the builder's form: the kind, slug and file of every PDF of a book, in key order. */
export const pdfs = query(rendition)
  .select("kind", "slug", "file")
  .where((w) => w.and(w.eq("kind", "book"), w.glob("file", "*.pdf")))
  .orderByKey();

/** The same query, in its text form. */
export const same = parseQuery("select kind, slug, file from rendition where kind = 'book' and file glob '*.pdf' order by key", ENTRIES);

/** `fd`'s walk: every Markdown file and folder of a store. */
export const markdown = compile(
  queryTree()
    .where((w) => w.eq("extension", "md"))
    .scan(),
);

/** The rows of `pdfs` in the folder `works`, read only. */
export async function pdfsIn(works: string): Promise<readonly unknown[]> {
  const store = posixStore(works, { readOnly: true });
  const c = compile(pdfs);
  if (c.kind !== "ok") return [];
  const rows: unknown[] = [];
  for await (const row of c.value.run(store)) rows.push(row);
  return rows;
}
