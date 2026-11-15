/**
 * Rows to code: CSV text made into a TypeScript module that exports the rows and their type, so that seed and reference data kept as a
 * spreadsheet become rows written in TypeScript, which the compiler checks against the table they are for (commons 0009-sql-aide
 * FR-032). It is text in and text out: a runtime module writes the file.
 *
 * @module
 */
import { absurd, type CsvError, err, ok, parseCsv, type Result, tsLiteral } from "../../../kernel/mod.ts";
import { token } from "../core/text.ts";
import type { ColumnSpec } from "../algebra/column.ts";
import type { DomainSpec } from "../algebra/domain.ts";
import type { TableSpec } from "../algebra/table.ts";

/** Why CSV could not be made into a module. */
export type CsvModuleError =
  | CsvError
  | { readonly kind: "header"; readonly message: string }
  | { readonly kind: "value"; readonly line: number; readonly column: string; readonly message: string };

/** What a module of rows is called and what it is for. */
export interface CsvModuleOptions {
  /** The name the rows are exported under (`partyKinds`); the row type is its singular in Pascal case with `Row` (`PartyKindRow`). */
  readonly exportName: string;
  /** Where the CSV came from, said in the module's comment. */
  readonly source: string;
  /** The table the rows are for: each column is typed and its values read by the column's domain. Without it every value is text. */
  readonly table?: TableSpec;
}

type Kind = "string" | "number" | "boolean";

function kindOf(d: DomainSpec): Kind | undefined {
  switch (d.kind) {
    case "text":
    case "date":
    case "uuid":
    case "enum":
    case "numeric":
      return "string";
    case "integer":
    case "real":
      return "number";
    case "boolean":
      return "boolean";
    case "bigint":
    case "timestamp":
    case "json":
    case "bytes":
    case "array":
    case "custom":
      return undefined;
    default:
      return absurd(d);
  }
}

function typeText(c: ColumnSpec | undefined): string {
  const base =
    c === undefined
      ? "string"
      : c.domain.kind === "enum"
        ? c.domain.values.map((v) => JSON.stringify(v)).join(" | ")
        : (kindOf(c.domain) ?? "string");
  return c?.nullable === true ? `${base} | null` : base;
}

function valueOf(field: string, c: ColumnSpec | undefined): Result<string | number | boolean | null, string> {
  if (c === undefined) return ok(field);
  if (field === "") return c.nullable ? ok(null) : kindOf(c.domain) === "string" ? ok("") : err("is empty, and the column is not null");
  const k = kindOf(c.domain);
  if (k === undefined) return err(`is of a ${c.domain.kind} column, which a module of rows does not write`);
  if (c.domain.kind === "enum" && !c.domain.values.includes(field))
    return err(`${JSON.stringify(field)} is not one of ${c.domain.values.join(", ")}`);
  if (k === "number") {
    const n = Number(field);
    if (!Number.isFinite(n) || (c.domain.kind === "integer" && !Number.isInteger(n)))
      return err(`${JSON.stringify(field)} is not ${c.domain.kind === "integer" ? "an integer" : "a number"}`);
    return ok(n);
  }
  if (k === "boolean") {
    if (["true", "1", "yes"].includes(field.toLowerCase())) return ok(true);
    if (["false", "0", "no"].includes(field.toLowerCase())) return ok(false);
    return err(`${JSON.stringify(field)} is not true or false`);
  }
  return ok(field);
}

/**
 * Makes CSV text with a header line into a TypeScript module: an interface of one row and a constant of the rows.
 *
 * @param csv - the text
 * @param options - the names, where it came from, and the table it is for
 * @example
 * csvModule("code,label\nperson,Person\n", { exportName: "partyKinds", source: "party_kind.csv", table: partyKind.spec });
 */
export function csvModule(csv: string, options: CsvModuleOptions): Result<string, CsvModuleError> {
  const parsed = parseCsv(csv);
  if (parsed.kind === "err") return parsed;
  const [header, ...records] = parsed.value;
  if (header === undefined || header.length === 0) return err({ kind: "header", message: "the text has no header line" });
  const specs = new Map(options.table?.columns ?? []);
  if (options.table !== undefined) {
    const unknown = header.filter((h) => !specs.has(h));
    if (unknown.length > 0) return err({ kind: "header", message: `${options.table.name} has no column ${unknown.join(", ")}` });
  }
  const rows: Record<string, string | number | boolean | null>[] = [];
  for (const [i, record] of records.entries()) {
    if (record.length === 1 && record[0] === "") continue;
    if (record.length !== header.length)
      return err({ kind: "value", line: i + 2, column: "", message: `has ${record.length} fields and the header ${header.length}` });
    const row: Record<string, string | number | boolean | null> = {};
    for (const [j, h] of header.entries()) {
      const v = valueOf(record[j] ?? "", specs.get(h));
      if (v.kind === "err") return err({ kind: "value", line: i + 2, column: h, message: v.error });
      row[h] = v.value;
    }
    rows.push(row);
  }
  const typeName = `${token(options.exportName).pascal.replace(/s$/, "")}Row`;
  const fields = header.map((h) => `  readonly ${h}: ${typeText(specs.get(h))};`);
  const what = options.table === undefined ? "" : ` for the table ${options.table.name}`;
  return ok(
    [
      "/**",
      ` * Rows${what}, made from ${options.source} by IFC SQL Aide's csvModule. Do not edit this file: change the CSV and make it again.`,
      " *",
      " * @module",
      " */",
      "",
      `/** One row of {@link ${options.exportName}}. */`,
      `export interface ${typeName} {`,
      ...fields,
      "}",
      "",
      "/** The rows, in the order of the CSV. */",
      `export const ${options.exportName}: readonly ${typeName}[] = ${tsLiteral(rows)};`,
      "",
    ].join("\n"),
  );
}
