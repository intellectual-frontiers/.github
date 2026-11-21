/**
 * The golden files of the SQL parser (commons lang-sql 0002-sql-ast-parser FR-017): for each `suite/golden/<dialect>/<name>.sql` it writes `<name>.sexp`, the tree of the text, and `<name>.comments` where the
 * text has comments, the place of each. A change of the grammar shows as a difference of these files; read it before you commit it.
 *
 * ```sh
 * bun tools/golden.ts           check: say which files are not what the parser makes
 * bun tools/golden.ts --write   write them
 * ```
 *
 * Spec: 0002-sql-ast-parser FR-017
 *
 * @module
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GOLDEN, GOLDEN_DIALECTS, goldenOf } from "../suite/fixture.ts";

/** What the golden files of one `.sql` file must be: the path of each and its text. */
export function expected(
  dir: string,
  name: string,
): readonly { readonly path: string; readonly text: string | undefined; readonly kind: "sexp" | "comments" }[] {
  const d = GOLDEN_DIALECTS[dir];
  if (d === undefined) return [];
  const g = goldenOf(d, readFileSync(join(GOLDEN, dir, `${name}.sql`), "utf8"));
  return [
    { path: join(GOLDEN, dir, `${name}.sexp`), text: g.sexp, kind: "sexp" },
    { path: join(GOLDEN, dir, `${name}.comments`), text: g.comments, kind: "comments" },
  ];
}

/** Every `.sql` file of the golden folder as `[dialect folder, name]`. */
export function sources(): readonly (readonly [string, string])[] {
  const out: [string, string][] = [];
  for (const dir of readdirSync(GOLDEN, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of readdirSync(join(GOLDEN, dir.name))) if (f.endsWith(".sql")) out.push([dir.name, f.slice(0, -4)]);
  }
  return out;
}

if (import.meta.main) {
  const write = process.argv.includes("--write");
  let wrong = 0;
  for (const [dir, name] of sources()) {
    for (const e of expected(dir, name)) {
      const have = existsSync(e.path) ? readFileSync(e.path, "utf8") : undefined;
      if (have === e.text) continue;
      if (write) {
        if (e.text === undefined) rmSync(e.path, { force: true });
        else writeFileSync(e.path, e.text);
      } else {
        wrong++;
        process.stdout.write(`${e.path}: not what the parser makes\n`);
      }
    }
  }
  process.stdout.write(
    write
      ? "golden: written\n"
      : wrong === 0
        ? "golden: every file is what the parser makes\n"
        : `golden: ${wrong} files differ; run with --write after reading the difference\n`,
  );
  process.exitCode = wrong === 0 ? 0 : 1;
}
