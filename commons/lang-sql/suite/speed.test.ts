/**
 * The lexer's speed (commons lang-sql 0001-sql-lang FR-018): it reads text in one pass with no regular expression and no object for a token, and it is fast enough that a floor far below what it does would catch a
 * change that made it slow. The number that matters is printed by `bun tools/bench.ts`; a test keeps only a floor, because timings in a shared runner are noisy.
 *
 * Spec: 0001-sql-lang FR-018; 0002-sql-ast-parser FR-018
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { assert, proves } from "@intellectual-frontiers/test";
import { ansi, lex, parse } from "@intellectual-frontiers/lang-sql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { CORPUS } from "./fixture.ts";

proves(
  ["0001-sql-lang FR-018"],
  "the lexer has no regular expression, a token is no object, and it lexes the corpus at a floor of ten megabytes of text a second",
  () => {
    const source = readFileSync(fileURLToPath(new URL("../src/lexer.ts", import.meta.url)), "utf8");
    const code = source
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    assert(!/new RegExp|\.match\(|\.matchAll\(|\.replace\(|\.split\(|\.exec\(|\.test\(/.test(code), "a regular expression call");
    const l = lex("select a from t", postgres.compiled);
    assert(
      l.tokens.kind.every((k) => typeof k === "number") && l.tokens.start.every((k) => typeof k === "number"),
      "tokens are columns of numbers",
    );
    const text = CORPUS.repeat(Math.ceil(2_000_000 / CORPUS.length));
    lex(text, postgres.compiled);
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      lex(text, postgres.compiled);
      best = Math.min(best, performance.now() - t0);
    }
    const mbps = text.length / 1e6 / (best / 1000);
    assert(mbps >= 10, `${mbps.toFixed(1)} MB/s is below the floor`);
  },
);

proves(
  ["0002-sql-ast-parser FR-018"],
  "the parser reads tokens by index with no regular expression, and parses the corpus, comments attached, at a floor of three megabytes of text a second",
  () => {
    const source = readFileSync(fileURLToPath(new URL("../src/parser.ts", import.meta.url)), "utf8");
    const code = source
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    assert(!/new RegExp|\.match\(|\.matchAll\(|\.replace\(|\.exec\(|\.test\(/.test(code), "a regular expression call");
    const text = CORPUS.repeat(Math.ceil(1_000_000 / CORPUS.length));
    assert(parse(text, ansi).errors.length === 0);
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      parse(text, ansi);
      best = Math.min(best, performance.now() - t0);
    }
    const mbps = text.length / 1e6 / (best / 1000);
    assert(mbps >= 3, `${mbps.toFixed(1)} MB/s is below the floor`);
  },
);
