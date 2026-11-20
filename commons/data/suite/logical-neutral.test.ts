// Spec: 0006-logical FR-013
/**
 * The logical schema names no engine (commons data 0006-logical FR-013): none of the names of a database, in the code of the layer (its comments may say what it is not). Unlike governance
 * it may say table, column and key: it is a relational schema.
 *
 * @module
 */
import { path } from "@intellectual-frontiers/system";
import * as trace from "@intellectual-frontiers/mizan/host/trace";
import { assert, proves } from "@intellectual-frontiers/test";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const ENGINES =
  /\b(postgres|postgresql|pg|sqlite|duckdb|mysql|mariadb|oracle|mssql|sqlserver|pglite|varchar|timestamptz|serial|jsonb|bytea)\b/i;

/** The text of a file without its comments. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

proves(["0006-logical FR-013"], "the code of the logical schema names no engine and no type of one", async () => {
  const files = await trace.readSources(ROOT, ["sql/logical"]);
  assert(files.length >= 4, `${files.length} files`);
  for (const f of files) {
    const lines = code(f.text).split("\n");
    const hit = lines.findIndex((line) => ENGINES.test(line));
    assert(hit < 0, `${f.path}: ${lines[hit]}`);
  }
  assert(
    ENGINES.test("a Postgres type") && ENGINES.test("timestamptz") && !ENGINES.test("a timestamp"),
    "the pattern finds what it should",
  );
});
