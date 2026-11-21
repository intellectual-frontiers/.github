/**
 * The queries of the automated acceptance (commons lang-sql 0011-acceptance FR-007): each is run over the fixture by sqlfs over the disk, by sqlfs over the entries the fixture is meant to have, and by sqlfind through the `find` of the system, and
 * the three must give the same rows. A query with no total order is compared by its first column.
 *
 * Spec: 0011-acceptance FR-007
 *
 * @module
 */
import { BASE, DAY } from "./shared/fixture.ts";

/** What a query may need to know of the machine. */
export interface Context {
  readonly owner: string;
}

/** The time `now()` gives in the acceptance. */
export const NOW = BASE + 10 * DAY;

/** The queries. */
export function queries(ctx: Context): readonly string[] {
  const d = (n: number): number => BASE + n * DAY;
  return [
    "SELECT path FROM files",
    "SELECT path FROM files WHERE kind = 'f'",
    "SELECT path FROM files WHERE kind <> 'f'",
    "SELECT path FROM files WHERE kind = 'l'",
    "SELECT path FROM files WHERE ext = 'ts'",
    "SELECT path FROM files WHERE ext IN ('ts', 'md')",
    "SELECT path FROM files WHERE ext = 'TS'",
    "SELECT path FROM files WHERE ext = 'gz'",
    "SELECT path FROM files WHERE ext = 'tar.gz'",
    "SELECT path FROM files WHERE ext = '' AND kind = 'f'",
    "SELECT path FROM files WHERE name = 'a b.ts'",
    "SELECT path FROM files WHERE name = 'glob[1].ts'",
    "SELECT path FROM files WHERE name = '-dash.ts'",
    "SELECT path FROM files WHERE name LIKE '%.ts'",
    "SELECT path FROM files WHERE name ILIKE '%.ts'",
    "SELECT path FROM files WHERE name ILIKE 'READ%'",
    "SELECT path FROM files WHERE name NOT LIKE '%.ts' AND kind = 'f'",
    "SELECT path FROM files WHERE name LIKE 'glob[1]%'",
    "SELECT path FROM files WHERE name LIKE 'under!_%' ESCAPE '!'",
    "SELECT path FROM files WHERE name LIKE 'percent!%%' ESCAPE '!'",
    "SELECT path FROM files WHERE name LIKE 'under_score%'",
    "SELECT path FROM files WHERE name GLOB 'star[*].ts'",
    "SELECT path FROM files WHERE name GLOB '[a-d]*' AND kind = 'f'",
    "SELECT path FROM files WHERE name GLOB '[!a-z]*'",
    "SELECT path FROM files WHERE length(name) = 11",
    "SELECT path FROM files WHERE path GLOB 'src/*'",
    "SELECT path FROM files WHERE path LIKE 'lib/%'",
    "SELECT path FROM files WHERE path = 'docs/guide.md'",
    "SELECT path FROM files WHERE path GLOB '*/nested/*'",
    "SELECT path FROM files WHERE path GLOB '.hidden/*'",
    "SELECT path FROM files WHERE depth = 1",
    "SELECT path FROM files WHERE depth >= 2 AND depth <= 3",
    "SELECT path FROM files WHERE depth > 3",
    "SELECT path FROM files WHERE depth < 2 AND kind = 'd'",
    "SELECT path FROM files WHERE depth <= 2 ORDER BY path",
    "SELECT path FROM files WHERE size > 1 KB AND kind = 'f'",
    "SELECT path FROM files WHERE size >= 20 AND size < 200 AND kind = 'f'",
    "SELECT path FROM files WHERE size = 7",
    "SELECT path FROM files WHERE size <> 7 AND kind = 'f'",
    "SELECT path FROM files WHERE size > 100 KB",
    "SELECT path FROM files WHERE size <= 10 AND kind = 'f'",
    `SELECT path FROM files WHERE mtime > ${d(5)}`,
    `SELECT path FROM files WHERE mtime >= ${d(5)} AND mtime <= ${d(7)} AND kind = 'f'`,
    `SELECT path FROM files WHERE mtime < ${d(2)} AND kind = 'f'`,
    `SELECT path FROM files WHERE mtime = ${d(5)}`,
    `SELECT path FROM files WHERE mtime <> ${d(5)} AND kind = 'f'`,
    "SELECT path FROM files WHERE mtime > now() - 3 D AND kind = 'f'",
    "SELECT path FROM files WHERE mode = 420 AND kind = 'f'",
    "SELECT path FROM files WHERE mode = 493",
    "SELECT path FROM files WHERE mode <> 420 AND kind = 'f'",
    `SELECT path FROM files WHERE owner = '${ctx.owner}' AND depth = 1`,
    `SELECT path FROM files WHERE owner <> '${ctx.owner}'`,
    "SELECT path FROM files WHERE lower(name) = 'big.ts'",
    "SELECT path FROM files WHERE regexp(name, '^[a-d]') AND kind = 'f'",
    "SELECT path FROM files WHERE NOT (ext = 'ts' OR ext = 'md') AND kind = 'f'",
    "SELECT path FROM files WHERE (ext = 'ts' AND size > 10) OR name LIKE 'read%'",
    "SELECT path FROM files WHERE name <> 'a b.ts' AND ext = 'ts' AND depth = 2",
    "SELECT path FROM files WHERE kind = 'f' AND (name = 'noext' OR (ext = 'json' AND size > 1 KB))",
    "SELECT path FROM files WHERE FALSE",
    "SELECT path FROM files WHERE 1 = 2",
    "SELECT path FROM files WHERE ext = 'ts' AND ext = 'md'",
    "SELECT path, size FROM files WHERE kind = 'f' ORDER BY size DESC, path LIMIT 5",
    "SELECT path FROM files WHERE kind = 'f' ORDER BY path DESC LIMIT 3 OFFSET 2",
    "SELECT path FROM files WHERE kind = 'f' ORDER BY mtime DESC, path LIMIT 3",
    "SELECT DISTINCT ext FROM files WHERE kind = 'f' ORDER BY ext",
    "SELECT name, size * 2 AS dbl, upper(ext) AS e FROM files WHERE ext = 'md' ORDER BY path",
    "SELECT * FROM files WHERE depth = 1 ORDER BY path",
    "SELECT path FROM files WHERE size > 5 KB OR kind = 'l' ORDER BY path",
  ];
}

/** Whether a query gives a total order (and so is compared as it comes). */
export const isOrdered = (q: string): boolean => / ORDER BY /.test(q);
