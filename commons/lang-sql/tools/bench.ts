/**
 * The benchmark of the SQL language core's lexer (commons lang-sql 0001-sql-lang FR-018): it lexes a corpus of this library's own, repeated to a few megabytes, in each dialect of `src`, takes the best of
 * several runs, and prints the throughput in megabytes of text a second. It also prints the one-line Python program that measures sqlglot's tokenizer on the same corpus, so that the two numbers are of
 * one text; run it where sqlglot is installed.
 *
 * ```sh
 * bun tools/bench.ts            lex, print
 * bun tools/bench.ts --json     the same as one line of JSON
 * ```
 *
 * Spec: 0001-sql-lang FR-018
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { ansi, type Dialect, lex, parse } from "../src/mod.ts";
import { dialect as duckdb } from "../src/dialects/duckdb/mod.ts";
import { dialect as postgres } from "../src/dialects/postgres/mod.ts";
import { dialect as sqlite } from "../src/dialects/sqlite/mod.ts";

const CORPUS_PATH = fileURLToPath(new URL("../suite/corpus.sql", import.meta.url));

/** The throughput of lexing `text` in each dialect, in megabytes of text a second, the best of `runs`. */
export function throughput(text: string, dialects: readonly Dialect[], runs = 7): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const d of dialects) {
    lex(text, d.compiled);
    let best = Number.POSITIVE_INFINITY;
    for (let r = 0; r < runs; r++) {
      const t0 = performance.now();
      lex(text, d.compiled);
      best = Math.min(best, performance.now() - t0);
    }
    out[d.name] = text.length / 1e6 / (best / 1000);
  }
  return out;
}

/** The throughput of the lexer and the parser together, and of the parser with comments not attached, in each dialect, in megabytes of text a second. */
export function parseThroughput(
  text: string,
  dialects: readonly Dialect[],
  runs = 5,
): Readonly<Record<string, { readonly parse: number; readonly noAttach: number }>> {
  const out: Record<string, { parse: number; noAttach: number }> = {};
  for (const d of dialects) {
    parse(text, d);
    let best = Number.POSITIVE_INFINITY;
    let bestNo = Number.POSITIVE_INFINITY;
    for (let r = 0; r < runs; r++) {
      const t0 = performance.now();
      parse(text, d);
      best = Math.min(best, performance.now() - t0);
      const t1 = performance.now();
      parse(text, d, { attach: false });
      bestNo = Math.min(bestNo, performance.now() - t1);
    }
    out[d.name] = { parse: text.length / 1e6 / (best / 1000), noAttach: text.length / 1e6 / (bestNo / 1000) };
  }
  return out;
}

/** How many times the corpus is repeated to be at least `bytes` long. */
export function repeats(bytes: number): number {
  return Math.ceil(bytes / readFileSync(CORPUS_PATH, "utf8").length);
}

/** The corpus, repeated until it is at least `bytes` long. */
export function repeated(bytes: number): string {
  return readFileSync(CORPUS_PATH, "utf8").repeat(repeats(bytes));
}

if (import.meta.main) {
  const text = repeated(4_000_000);
  const result = throughput(text, [ansi, sqlite, postgres, duckdb]);
  const parsed = parseThroughput(text, [ansi, sqlite, postgres, duckdb]);
  if (process.argv.includes("--json")) console.log(JSON.stringify({ megabytes: text.length / 1e6, lexMBps: result, parseMBps: parsed }));
  else {
    console.log(`corpus: ${(text.length / 1e6).toFixed(1)} MB of text, best of 7 runs (lexer), 5 (parser)`);
    for (const [name, mbps] of Object.entries(result)) console.log(`  lex   ${name.padEnd(9)} ${mbps.toFixed(1)} MB/s`);
    for (const [name, r] of Object.entries(parsed))
      console.log(`  parse ${name.padEnd(9)} ${r.parse.toFixed(1)} MB/s (${r.noAttach.toFixed(1)} without attaching comments)`);
    console.log("sqlglot's tokenizer and parser on the same corpus (where sqlglot is installed):");
    console.log(
      `  python3 -c "import time,sqlglot,sqlglot.tokens as t;s=open('${CORPUS_PATH}').read();n=${repeats(4_000_000)};k=t.Tokenizer();T=lambda f:min((lambda a:(f(),time.perf_counter()-a)[1])(time.perf_counter()) for _ in range(3));print('lex  %.2f MB/s'%(len(s)*n/1e6/T(lambda:k.tokenize(s*n))));print('parse %.2f MB/s'%(len(s)*20/1e6/T(lambda:sqlglot.parse(s*20))))"`,
    );
  }
}
