/**
 * CSV by RFC 4180, read and written with no outside package (commons 0005-typescript-runtime FR-036): fields separated by a comma (or
 * another single character), a field quoted where it holds the separator, a quote or a line break, a quote inside one doubled, records
 * ended by CRLF or LF. The reader refuses a quote in an unquoted field and a quoted field that is not closed, and says the line and column;
 * it can give each record as an object by the header's names. Replaces `@std/csv` in erga.
 *
 * @example
 * ```ts
 * import { parseCsv, toCsv } from "./csv.ts";
 * parseCsv('name,quote\nAda,"Hello, ""world"""\n'); // { kind: "ok", value: [["name", "quote"], ["Ada", 'Hello, "world"']] }
 * toCsv([["a", "b,c"]]); // 'a,"b,c"\r\n'
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** Where a text stops being CSV, and why. Lines and columns count from 1. */
export type CsvError = { readonly kind: "csv"; readonly line: number; readonly column: number; readonly message: string };

/** A CSV error as one line: `3:14: a quote in a field that is not quoted`. */
export function formatCsvError(e: CsvError): string {
  return `${e.line}:${e.column}: ${e.message}`;
}

/** How to read and write: the separator (a comma by default), and for writing the line ending (CRLF by default, as RFC 4180 has it). */
export type CsvOptions = { readonly separator?: string; readonly lineEnding?: "\r\n" | "\n" };

/** The records of a CSV text, each a list of fields; a final line break ends the last record and makes no empty one. */
export function parseCsv(text: string, options: CsvOptions = {}): Result<readonly (readonly string[])[], CsvError> {
  const sep = options.separator ?? ",";
  if (sep.length !== 1 || sep === '"' || sep === "\n" || sep === "\r")
    throw new Error(`a CSV separator is one character that is not a quote or a line break: ${JSON.stringify(sep)}`);
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let line = 1;
  let column = 1;
  let quoted = false;
  let wasQuoted = false;
  let fieldStart = true;
  let i = text.startsWith("\ufeff") ? 1 : 0;
  const fail = (message: string): Result<never, CsvError> => err({ kind: "csv", line, column, message });
  const endField = (): void => {
    record.push(field);
    field = "";
    fieldStart = true;
    wasQuoted = false;
  };
  for (; i < text.length; i++, column++) {
    const c = text[i] ?? "";
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
          column++;
        } else {
          quoted = false;
          wasQuoted = true;
        }
      } else {
        if (c === "\n") {
          line++;
          column = 0;
        }
        field += c;
      }
      continue;
    }
    if (c === sep) {
      endField();
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endField();
      records.push(record);
      record = [];
      line++;
      column = 0;
      continue;
    }
    if (wasQuoted) return fail(`the separator or a line break after a quoted field, not ${JSON.stringify(c)}`);
    if (c === '"') {
      if (!fieldStart) return fail("a quote in a field that is not quoted");
      quoted = true;
      fieldStart = false;
      continue;
    }
    field += c;
    fieldStart = false;
  }
  if (quoted) return fail("the closing quote of a quoted field");
  if (!fieldStart || record.length > 0) {
    endField();
    records.push(record);
  }
  return ok(records);
}

/** The records of a CSV text with a header, each an object by the header's names; a record whose length is not the header's is an error. */
export function parseCsvRecords(text: string, options: CsvOptions = {}): Result<readonly Readonly<Record<string, string>>[], CsvError> {
  const rows = parseCsv(text, options);
  if (rows.kind === "err") return rows;
  const [header, ...body] = rows.value;
  if (header === undefined) return ok([]);
  if (new Set(header).size !== header.length) return err({ kind: "csv", line: 1, column: 1, message: "a header whose names differ" });
  const out: Record<string, string>[] = [];
  for (const [n, row] of body.entries()) {
    if (row.length !== header.length)
      return err({ kind: "csv", line: n + 2, column: 1, message: `${header.length} fields, as the header has, not ${row.length}` });
    const record: Record<string, string> = {};
    for (const [k, name] of header.entries())
      Object.defineProperty(record, name, { value: row[k] ?? "", enumerable: true, writable: true, configurable: true });
    out.push(record);
  }
  return ok(out);
}

/** A field as CSV writes it: quoted, with its quotes doubled, where it holds the separator, a quote, a line break or leading or trailing space. */
export function csvField(value: string, separator = ","): string {
  return value.includes(separator) || /["\r\n]/.test(value) || value !== value.trim() ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Records as CSV text, each ended by the line ending. */
export function toCsv(records: readonly (readonly string[])[], options: CsvOptions = {}): string {
  const sep = options.separator ?? ",";
  const end = options.lineEnding ?? "\r\n";
  return records.map((r) => `${r.length === 1 && r[0] === "" ? '""' : r.map((f) => csvField(f, sep)).join(sep)}${end}`).join("");
}
