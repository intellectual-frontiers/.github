// Spec: 0007-physical FR-013
/**
 * The physical schema's own code names no engine (commons data 0007-physical FR-013): the name of an engine is found only in its own dialect's folder, so that a fourth dialect is an extension
 * and not a change here. The comments may say what a layer is not; the code may not.
 *
 * @module
 */
import { path } from "@intellectual-frontiers/system";
import { trace } from "@intellectual-frontiers/commons/ts/runtime";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const ENGINES = ["postgres", "postgresql", "sqlite", "duckdb", "mysql", "mariadb", "oracle", "mssql", "pglite"] as const;
const word = (e: string): RegExp => new RegExp(`\\b${e}\\b`, "i");

/** The text of a file without its comments. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

proves(["0007-physical FR-013", "0001-layers FR-003"], "the code of the physical core names no engine", async () => {
  const files = await trace.readSources(ROOT, ["sql/physical"]);
  assert(files.length >= 5, `${files.length} files`);
  for (const f of files) {
    for (const e of ENGINES) {
      const lines = code(f.text).split("\n");
      const hit = lines.findIndex((l) => word(e).test(l));
      assert(hit < 0, `${f.path} names ${e}: ${lines[hit]}`);
    }
  }
});

proves(["0007-physical FR-013"], "each dialect names its own engine and no other", async () => {
  for (const own of ["postgres", "sqlite", "duckdb"] as const) {
    const files = await trace.readSources(ROOT, [`sql/dialects/${own}`]);
    assert(files.length >= 1, own);
    for (const f of files) {
      const text = code(f.text);
      for (const other of ENGINES.filter((e) => e !== own && !(own === "postgres" && e === "postgresql")))
        assert(!word(other).test(text), `${f.path} names ${other}`);
    }
  }
  assert(word("postgres").test("a Postgres type") && !word("postgres").test("a typed post"), "the pattern finds what it should");
});
