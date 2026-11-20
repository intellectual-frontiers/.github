// Spec: 0054-sql-loads FR-001, FR-002
/**
 * Sources of a load (commons data 0054-sql-loads): where the rows come from, as batches of rows of a type. A source is a value: rows in memory, CSV text read with a typed parser for each column, lines of JSON,
 * or a select of another database. A line that cannot be read is not a thrown error but a rejected line, with its number and why, so that a load says what it did not take.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Scope, Select } from "@intellectual-frontiers/data/sql/typed";
import type { Runner } from "@intellectual-frontiers/data/sql/typed";

/** A line that was not taken. */
export interface Rejected {
  /** Where it was: the line (CSV, JSON lines) or the row (others), from 1. */
  readonly at: number;
  readonly reason: string;
  /** What it was, as text. */
  readonly raw: string;
}

/** A batch: rows and the lines that were rejected on the way. */
export interface Batch<R> {
  readonly rows: readonly R[];
  readonly rejected: readonly Rejected[];
}

/** Where rows come from. */
export interface Source<R> {
  readonly name: string;
  /** The rows, in batches of at most `size`. */
  batches(size: number): AsyncIterable<Batch<R>>;
}

async function* chunked<R>(rows: readonly R[], rejected: readonly Rejected[], size: number): AsyncGenerator<Batch<R>> {
  if (rows.length === 0 && rejected.length === 0) return;
  let first = true;
  for (let i = 0; i < Math.max(rows.length, 1); i += size) {
    yield { rows: rows.slice(i, i + size), rejected: first ? rejected : [] };
    first = false;
  }
}

/** Rows in memory. */
export const fromRows = <R>(rows: readonly R[], name = "rows"): Source<R> => ({ name, batches: (size) => chunked(rows, [], size) });

/** The rows of a select, run on a database: the way to copy between databases. */
export const fromQuery = <R>(select: Select<Scope, R>, on: Runner, name = "query"): Source<R> => ({
  name,
  batches: (size) =>
    (async function* () {
      const rows = await select.run(on);
      yield* chunked(rows, [], size);
    })(),
});

/** How one column of a CSV is read: the text of a cell to a value, or why not. */
export type CellParser<T> = (cell: string) => Result<T, string>;

const parserOf = <T>(f: (s: string) => T | undefined, what: string): CellParser<T> => (s) => {
  const v = f(s.trim());
  return v === undefined ? err(`${JSON.stringify(s)} is not ${what}`) : ok(v);
};
/** A text, as it is. */
export const text: CellParser<string> = (s) => ok(s);
/** An integer. */
export const integer: CellParser<number> = parserOf((s) => (/^[+-]?\d+$/.test(s) ? Number(s) : undefined), "an integer");
/** A number with a fraction, kept as text so that no digit is lost. */
export const decimal: CellParser<string> = parserOf((s) => (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? s : undefined), "a decimal number");
/** true or false (also yes, no, 1, 0, t, f, in any case). */
export const bool: CellParser<boolean> = parserOf((s) => (/^(true|yes|t|1)$/i.test(s) ? true : /^(false|no|f|0)$/i.test(s) ? false : undefined), "true or false");
/** A calendar date as 2026-11-19. */
export const date: CellParser<string> = parserOf((s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : undefined;
}, "a date as 2026-11-19");
/** An instant as ISO 8601. */
export const timestamp: CellParser<string> = parserOf((s) => (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !Number.isNaN(Date.parse(s.replace(" ", "T"))) ? s : undefined), "a timestamp");
/** One of a closed list of codes. */
export const oneOf = <T extends string>(...codes: readonly T[]): CellParser<T> => (s) => (codes.includes(s as T) ? ok(s as T) : err(`${JSON.stringify(s)} is not one of ${codes.join(", ")}`));
/** A cell that may be empty: empty is null. */
export const optional = <T>(p: CellParser<T>): CellParser<T | null> => (s) => (s.trim() === "" ? ok(null) : p(s));

/** The cells of CSV text (RFC 4180: quoted cells, doubled quotes, line breaks inside quotes), with the line each record starts on. */
export function csvRecords(textIn: string): readonly { readonly line: number; readonly cells: readonly string[] }[] {
  const out: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let start = 1;
  let any = false;
  const t = textIn.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (quoted) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
      any = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
      any = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      if (any || cell !== "") {
        cells.push(cell);
        out.push({ line: start, cells });
      }
      cells = [];
      cell = "";
      any = false;
      line++;
      start = line;
    } else {
      cell += ch;
      any = true;
    }
  }
  if (any || cell !== "") {
    cells.push(cell);
    out.push({ line: start, cells });
  }
  return out;
}

/**
 * CSV text whose first line names the columns, read into rows of type `R`: each key of `R` has the parser of its cell and the name of its column in the file (the key where not given). A line with a cell that
 * does not parse, or the wrong number of cells, is rejected with its line and why; the rest are taken.
 */
export function fromCsv<R>(csv: string, columns: { readonly [K in keyof R & string]: CellParser<R[K]> | { readonly parse: CellParser<R[K]>; readonly column: string } }, name = "csv"): Source<R> {
  return {
    name,
    batches: (size) => {
      const recs = csvRecords(csv);
      const header = recs[0]?.cells.map((h) => h.trim()) ?? [];
      const keys = Object.keys(columns) as (keyof R & string)[];
      const spec = keys.map((k) => {
        const c = columns[k];
        const parse = (typeof c === "function" ? c : c.parse) as CellParser<unknown>;
        return { key: k, column: typeof c === "function" ? k : c.column, parse };
      });
      const missing = spec.filter((s) => !header.includes(s.column)).map((s) => s.column);
      const rows: R[] = [];
      const rejected: Rejected[] = [];
      if (missing.length > 0) rejected.push({ at: 1, reason: `the header has no column ${missing.join(", ")}`, raw: header.join(",") });
      else
        for (const rec of recs.slice(1)) {
          if (rec.cells.length !== header.length) {
            rejected.push({ at: rec.line, reason: `${rec.cells.length} cells where the header has ${header.length}`, raw: rec.cells.join(",") });
            continue;
          }
          const row: Record<string, unknown> = {};
          let bad: string | undefined;
          for (const s of spec) {
            const r = s.parse(rec.cells[header.indexOf(s.column)] ?? "");
            if (r.kind === "err") {
              bad = `${s.column}: ${r.error}`;
              break;
            }
            row[s.key] = r.value;
          }
          if (bad === undefined) rows.push(row as R);
          else rejected.push({ at: rec.line, reason: bad, raw: rec.cells.join(",") });
        }
      return chunked(rows, rejected, size);
    },
  };
}

/** Lines of JSON, one record each, read by a function that checks a value is a row of `R`; a line that is not JSON or not a row is rejected. */
export function fromJsonLines<R>(jsonl: string, read: (value: unknown) => Result<R, string>, name = "jsonl"): Source<R> {
  return {
    name,
    batches: (size) => {
      const rows: R[] = [];
      const rejected: Rejected[] = [];
      jsonl.split(/\r?\n/).forEach((raw, i) => {
        if (raw.trim() === "") return;
        let value: unknown;
        try {
          value = JSON.parse(raw);
        } catch {
          rejected.push({ at: i + 1, reason: "not JSON", raw });
          return;
        }
        const r = read(value);
        if (r.kind === "ok") rows.push(r.value);
        else rejected.push({ at: i + 1, reason: r.error, raw });
      });
      return chunked(rows, rejected, size);
    },
  };
}
