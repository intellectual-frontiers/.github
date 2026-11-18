// Spec: 0001-layers FR-001
/**
 * Governance names no database (commons data 0001-layers FR-001): no engine, and none of the words of a relational schema, in the code of governance (its comments may say what it is not).
 * The generated terms of DPV are the vocabulary's own and are not read.
 *
 * @module
 */
import { path, trace } from "@intellectual-frontiers/commons/ts/runtime";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const WORDS =
  /\b(postgres|postgresql|sqlite|duckdb|mysql|oracle|sql|table|tables|column|columns|row|rows|index|indexes|schema|foreign|primary|varchar|dialect)\b/i;

/** The text of a file without its comments. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

proves(["0001-layers FR-001"], "the code of governance names no engine and no part of a relational schema", async () => {
  const files = (await trace.readSources(ROOT, ["governance"])).filter((f) => !f.path.includes(".auto."));
  assert(files.length >= 10, `${files.length} files`);
  for (const f of files) {
    const hit = code(f.text)
      .split("\n")
      .findIndex((line) => WORDS.test(line));
    assert(hit < 0, `${f.path}:${hit + 1}: ${code(f.text).split("\n")[hit]}`);
  }
  assert(WORDS.test("CREATE TABLE") && WORDS.test("a column") && !WORDS.test("a concept"), "the pattern finds what it should");
});
