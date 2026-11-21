/**
 * The conformance of the SQL language core's dialects (commons data 0069-sql-dialects FR-006 to FR-009): it reads every `suite/corpus/<source>/<dialect>/<name>.sql`, a file of statements taken from an open-source test
 * suite, in the dialect of its folder, and says for each file how many statements the parser read with no error and how many the lexer found an error in. The numbers are held in `suite/corpus/baseline.tsv`, which
 * only improves.
 *
 * ```sh
 * bun tools/conformance-lang.ts            the report: for each dialect the statements, the share read, the lexer's errors and the commonest errors
 * bun tools/conformance-lang.ts --check    compare with the baseline (what the test does); exit 1 where a file reads less than it did
 * bun tools/conformance-lang.ts --write    write the baseline; refuses where a file reads less, unless --allow-regression
 * ```
 *
 * Spec: 0069-sql-dialects FR-006, FR-007, FR-008, FR-009
 *
 * @module
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ansi, type Dialect, type Parsed, parse } from "../sql/lang/mod.ts";
import { ALL_DIALECTS } from "../suite/lang-fixture.ts";

/** The folder of the corpora. */
export const CORPUS = fileURLToPath(new URL("../suite/corpus/", import.meta.url));

/** What one corpus file gives. */
export interface FileResult {
  /** `<source>/<dialect>/<name>.sql`. */
  readonly path: string;
  readonly dialect: string;
  readonly statements: number;
  /** Statements read with no error. */
  readonly ok: number;
  /** Errors of the lexer in the file. */
  readonly lexErrors: number;
  /** The parser's errors, as `expected ... found ...` classes, with how many. */
  readonly errors: ReadonlyMap<string, number>;
}

/** The dialect of a name. */
export function dialectOf(name: string): Dialect | undefined {
  return name === "ansi" ? ansi : ALL_DIALECTS.find((d) => d.name === name);
}

/** Every corpus file as `[path from the corpus folder, dialect name]`. */
export function corpusFiles(): readonly (readonly [string, string])[] {
  const out: [string, string][] = [];
  for (const source of readdirSync(CORPUS, { withFileTypes: true })) {
    if (!source.isDirectory() || source.name === "LICENSES") continue;
    for (const dialect of readdirSync(join(CORPUS, source.name), { withFileTypes: true })) {
      if (!dialect.isDirectory()) continue;
      for (const f of readdirSync(join(CORPUS, source.name, dialect.name)).sort()) {
        if (f.endsWith(".sql")) out.push([`${source.name}/${dialect.name}/${f}`, dialect.name]);
      }
    }
  }
  return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** What a failed statement says, without its place: what was expected and what was found. */
function errorClass(e: Parsed["errors"][number]): string {
  switch (e.kind) {
    case "expected":
      return `expected ${e.expected}, found ${e.found.length > 20 ? `${e.found.slice(0, 20)}..` : e.found}`;
    case "unsupported":
      return `unsupported ${e.what}`;
    case "too-deep":
      return "too deep";
    case "lex":
      return `lex ${e.error.kind}`;
  }
}

/** Reads one corpus file in its dialect. */
export function readFile(path: string, dialect: string, d: Dialect, text = readFileSync(join(CORPUS, path), "utf8")): FileResult {
  const p = parse(text, d, { attach: false });
  const statements = p.script.statements.length;
  const bad = p.script.statements.filter((s) => s.kind === "unparsed").length;
  const errors = new Map<string, number>();
  let lexErrors = 0;
  for (const e of p.errors) {
    if (e.kind === "lex") lexErrors++;
    else errors.set(errorClass(e), (errors.get(errorClass(e)) ?? 0) + 1);
  }
  return { path, dialect, statements, ok: statements - bad, lexErrors, errors };
}

/** The result for every corpus file. */
export function readAll(): readonly FileResult[] {
  return corpusFiles().flatMap(([path, dialect]) => {
    const d = dialectOf(dialect);
    return d === undefined ? [] : [readFile(path, dialect, d)];
  });
}

/** The baseline as `path -> [statements, ok, lexErrors]`. */
export function readBaseline(): ReadonlyMap<string, readonly [number, number, number]> {
  const out = new Map<string, readonly [number, number, number]>();
  let text = "";
  try {
    text = readFileSync(join(CORPUS, "baseline.tsv"), "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    if (line === "" || line.startsWith("#") || line.startsWith("path\t")) continue;
    const [path, s, ok, lex] = line.split("\t");
    if (path !== undefined) out.set(path, [Number(s), Number(ok), Number(lex)]);
  }
  return out;
}

/** The baseline's text for results. */
export function baselineText(results: readonly FileResult[]): string {
  const head = [
    "# What each corpus file reads (commons data 0069-sql-dialects FR-008): statements, statements read with no error, errors of the lexer.",
    "# The numbers only improve: a file that reads less, or whose lexer finds more errors, fails the test. `bun tools/conformance-lang.ts --write` writes this file.",
    "path\tstatements\tok\tlexErrors",
  ];
  return `${[...head, ...results.map((r) => `${r.path}\t${r.statements}\t${r.ok}\t${r.lexErrors}`)].join("\n")}\n`;
}

/** Where the results read less than the baseline says, one sentence each. */
export function regressions(
  results: readonly FileResult[],
  baseline: ReadonlyMap<string, readonly [number, number, number]>,
): readonly string[] {
  const out: string[] = [];
  for (const r of results) {
    const b = baseline.get(r.path);
    if (b === undefined) out.push(`${r.path}: not in the baseline (run bun tools/conformance-lang.ts --write)`);
    else if (r.ok < b[1]) out.push(`${r.path}: reads ${r.ok} of ${r.statements}, the baseline has ${b[1]}`);
    else if (r.lexErrors > b[2]) out.push(`${r.path}: the lexer finds ${r.lexErrors} errors, the baseline has ${b[2]}`);
  }
  for (const path of baseline.keys())
    if (!results.some((r) => r.path === path))
      out.push(`${path}: in the baseline and not a file (run bun tools/conformance-lang.ts --write)`);
  return out;
}

if (import.meta.main) {
  const results = readAll();
  const baseline = readBaseline();
  const mode = process.argv.includes("--write") ? "write" : process.argv.includes("--check") ? "check" : "report";
  if (mode === "report") {
    const by = new Map<string, FileResult[]>();
    for (const r of results) by.set(r.dialect, [...(by.get(r.dialect) ?? []), r]);
    process.stdout.write("dialect         statements   read    lexer-errors  commonest errors\n");
    for (const [dialect, rs] of [...by].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const statements = rs.reduce((n, r) => n + r.statements, 0);
      const ok = rs.reduce((n, r) => n + r.ok, 0);
      const lexErrors = rs.reduce((n, r) => n + r.lexErrors, 0);
      const all = new Map<string, number>();
      for (const r of rs) for (const [k, n] of r.errors) all.set(k, (all.get(k) ?? 0) + n);
      const top = [...all]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, n]) => `${n}x ${k}`)
        .join("; ");
      process.stdout.write(
        `${dialect.padEnd(15)} ${String(statements).padStart(9)} ${((100 * ok) / Math.max(1, statements)).toFixed(1).padStart(6)}% ${String(lexErrors).padStart(12)}  ${top}\n`,
      );
    }
    const total = results.reduce((n, r) => n + r.statements, 0);
    const okTotal = results.reduce((n, r) => n + r.ok, 0);
    process.stdout.write(
      `all             ${String(total).padStart(9)} ${((100 * okTotal) / Math.max(1, total)).toFixed(1).padStart(6)}%\n`,
    );
  } else {
    const bad = regressions(results, baseline);
    if (
      mode === "check" ||
      (mode === "write" &&
        bad.some((b) => b.includes("reads") || b.includes("lexer finds")) &&
        !process.argv.includes("--allow-regression"))
    ) {
      for (const b of bad) process.stdout.write(`${b}\n`);
      process.exitCode = bad.length === 0 ? 0 : 1;
      if (mode === "write" && bad.length > 0)
        process.stdout.write("not written: a file reads less than the baseline (--allow-regression to write anyway)\n");
    }
    if (mode === "write" && process.exitCode !== 1) {
      writeFileSync(join(CORPUS, "baseline.tsv"), baselineText(results));
      process.stdout.write(`baseline: ${results.length} files written\n`);
    }
  }
}
