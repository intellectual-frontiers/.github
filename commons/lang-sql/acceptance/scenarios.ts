/**
 * The scenarios of the user acceptance (commons lang-sql 0011-acceptance FR-009): each is a sentence a person would say, the query that answers it, and the paths it must give over the fixture, which are written by hand and not read from any run.
 *
 * Spec: 0011-acceptance FR-009
 *
 * @module
 */

/** A thing a person asks of a directory. */
export interface Scenario {
  readonly say: string;
  readonly query: string;
  /** The values of the first column, in order. */
  readonly expect: readonly string[];
}

/** The scenarios, over the fixture, with `now()` at the tenth day. */
export const SCENARIOS: readonly Scenario[] = [
  { say: "The five biggest files", query: "SELECT path, size FROM files WHERE kind = 'f' ORDER BY size DESC, path LIMIT 5", expect: ["lib/data.json", "src/Big.TS", "docs/guide.md", "src/util.ts", "docs/readme.md"] },
  { say: "Markdown files bigger than a kilobyte", query: "SELECT path FROM files WHERE ext = 'md' AND size > 1 KB", expect: ["docs/guide.md"] },
  { say: "Files changed in the last three days", query: "SELECT path FROM files WHERE kind = 'f' AND mtime > now() - 3 D ORDER BY path", expect: ["README.md", "docs/readme.md", 'lib/dq"uote.ts', "src/deep/nested/mod.ts"] },
  { say: "Everything in the hidden directory", query: "SELECT path FROM files WHERE path GLOB '.hidden/*'", expect: [".hidden/secret.ts"] },
  { say: "The executable files", query: "SELECT path FROM files WHERE kind = 'f' AND mode = 493", expect: ["src/util.ts"] },
  { say: "Files with a space in the name", query: "SELECT path FROM files WHERE name LIKE '% %'", expect: ["lib/a b.ts"] },
  { say: "The directories at the top", query: "SELECT path FROM files WHERE kind = 'd' AND depth = 1 ORDER BY path", expect: [".hidden", "docs", "empty", "lib", "src"] },
  { say: "Files with no extension", query: "SELECT path FROM files WHERE kind = 'f' AND ext = ''", expect: ["lib/noext"] },
  { say: "Files in the top directory only", query: "SELECT path FROM files WHERE depth = 1 AND kind = 'f'", expect: ["README.md"] },
  { say: "Where the compressed archives are", query: "SELECT path FROM files WHERE ext = 'gz'", expect: ["lib/archive.tar.gz"] },
  { say: "The three newest files", query: "SELECT path FROM files WHERE kind = 'f' ORDER BY mtime DESC, path LIMIT 3", expect: ["README.md", "docs/readme.md", "src/deep/nested/mod.ts"] },
  { say: "Symbolic links", query: "SELECT path FROM files WHERE kind = 'l' ORDER BY path", expect: ["lib/link.ts", "lib/loop"] },
  { say: "Upper-case extensions, whatever the case", query: "SELECT path FROM files WHERE ext ILIKE 'ts' AND name <> lower(name)", expect: ["src/Big.TS"] },
];
