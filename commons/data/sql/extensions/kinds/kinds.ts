// Spec: 0026-sql-kinds FR-001, FR-002, FR-003, FR-004
/**
 * Kinds (commons data 0026-sql-kinds): reference data kept as CSV, read into typed rows, checked against a table of a logical schema, written as a TypeScript module, and given to integrations and
 * ephemeral targets as they are.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { words } from "@intellectual-frontiers/data/governance";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { parseCsv } from "@intellectual-frontiers/data/sql/physical";

export type KindType = "text" | "integer" | "number" | "boolean";
export type Cell = string | number | boolean | null;

/** What a file is read with. */
export interface KindsOptions {
  /** The name of what the rows are of, for the module. */
  readonly name: string;
  /** The types of columns, by header; text where not said. */
  readonly types?: Readonly<Record<string, KindType>>;
  /** The delimiter; a comma where not said. */
  readonly delimiter?: string;
  /** The columns of the key; the first column where not said. */
  readonly key?: readonly string[];
}

/** The rows of a file. */
export interface Kinds {
  readonly name: string;
  readonly columns: readonly { readonly name: string; readonly type: KindType; readonly nullable: boolean }[];
  readonly rows: readonly Readonly<Record<string, Cell>>[];
  readonly key: readonly string[];
}

export type KindsError =
  | { readonly kind: "header"; readonly why: string }
  | { readonly kind: "fields"; readonly line: number; readonly expected: number; readonly found: number }
  | { readonly kind: "type"; readonly line: number; readonly column: string; readonly expected: KindType; readonly value: string }
  | { readonly kind: "duplicate-key"; readonly line: number; readonly key: readonly Cell[] }
  | { readonly kind: "unknown-key"; readonly column: string };

const read = (type: KindType, v: string): Cell | undefined => {
  if (v === "") return null;
  switch (type) {
    case "text":
      return v;
    case "integer": {
      const n = Number(v);
      return /^-?\d+$/.test(v.trim()) && Number.isSafeInteger(n) ? n : undefined;
    }
    case "number": {
      const n = Number(v);
      return v.trim() !== "" && Number.isFinite(n) ? n : undefined;
    }
    case "boolean": {
      const s = v.trim().toLowerCase();
      return s === "true" || s === "1" ? true : s === "false" || s === "0" ? false : undefined;
    }
  }
};

/**
 * Typed rows from CSV text.
 *
 * @param text - the text, with a header
 * @param options - the name, types, delimiter and key
 * @returns the rows, or why not
 */
export function kindsFromCsv(text: string, options: KindsOptions): Result<Kinds, readonly KindsError[]> {
  const records = parseCsv(text, options.delimiter);
  const header = (records[0] ?? []).map((h) => h.trim());
  if (header.length === 0 || header.every((h) => h === "")) return err([{ kind: "header", why: "the file has no header" }]);
  const errors: KindsError[] = [];
  const seen = new Set<string>();
  for (const h of header) {
    if (h === "") errors.push({ kind: "header", why: "a column has no name" });
    else if (seen.has(words(h).join("."))) errors.push({ kind: "header", why: `the column ${h} is there twice` });
    seen.add(words(h).join("."));
  }
  const key = options.key ?? [header[0] ?? ""];
  for (const k of key) if (!header.includes(k)) errors.push({ kind: "unknown-key", column: k });
  if (errors.length > 0) return err(errors);
  const types = header.map((h) => options.types?.[h] ?? "text");
  const rows: Record<string, Cell>[] = [];
  const keys = new Set<string>();
  records.slice(1).forEach((r, i) => {
    const line = i + 2;
    if (r.length !== header.length) {
      errors.push({ kind: "fields", line, expected: header.length, found: r.length });
      return;
    }
    const row: Record<string, Cell> = {};
    header.forEach((h, j) => {
      const v = read(types[j] as KindType, r[j] as string);
      if (v === undefined) errors.push({ kind: "type", line, column: h, expected: types[j] as KindType, value: r[j] as string });
      else row[h] = v;
    });
    const k = JSON.stringify(key.map((c) => row[c] ?? null));
    if (keys.has(k)) errors.push({ kind: "duplicate-key", line, key: key.map((c) => row[c] ?? null) });
    keys.add(k);
    rows.push(row);
  });
  if (errors.length > 0) return err(errors);
  return ok({
    name: options.name,
    columns: header.map((h, j) => ({ name: h, type: types[j] as KindType, nullable: rows.some((r) => r[h] === null) })),
    rows,
    key,
  });
}

export type CheckError =
  | { readonly kind: "unknown-table"; readonly table: string }
  | { readonly kind: "unknown-column"; readonly table: string; readonly column: string }
  | { readonly kind: "missing-required"; readonly table: string; readonly columns: readonly string[] }
  | { readonly kind: "empty-required"; readonly table: string; readonly column: string; readonly line: number };

/**
 * Checks rows against a table of a schema.
 *
 * @param kinds - the rows
 * @param schema - the logical schema
 * @param table - the table, by the words of its name
 * @returns nothing wrong, or what is
 */
export function checkKinds(kinds: Kinds, schema: LogicalSchema, table: string): readonly CheckError[] {
  const t = schema.tables.find((x) => x.name.join(".") === words(table).join("."));
  if (t === undefined) return [{ kind: "unknown-table", table }];
  const errors: CheckError[] = [];
  const named = (h: string): string => words(h).join(".");
  for (const c of kinds.columns) if (!t.columns.some((x) => x.name.join(".") === named(c.name))) errors.push({ kind: "unknown-column", table, column: c.name });
  const required = t.columns.filter((c) => !c.nullable && c.default === undefined);
  const missing = required.filter((c) => !kinds.columns.some((x) => named(x.name) === c.name.join("."))).map((c) => c.name.join("."));
  if (missing.length > 0) errors.push({ kind: "missing-required", table, columns: missing });
  for (const c of required) {
    const col = kinds.columns.find((x) => named(x.name) === c.name.join("."));
    if (col !== undefined) kinds.rows.forEach((r, i) => r[col.name] === null && errors.push({ kind: "empty-required", table, column: col.name, line: i + 2 }));
  }
  return errors;
}

const camel = (s: string): string => words(s).map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join("");
const pascal = (s: string): string => words(s).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
const TS: Readonly<Record<KindType, string>> = { text: "string", integer: "number", number: "number", boolean: "boolean" };
const prop = (n: string): string => (/^[A-Za-z_$][\w$]*$/.test(n) ? n : JSON.stringify(n));

/**
 * A TypeScript module of the rows.
 *
 * @param kinds - the rows
 * @param options - the file's name for the header, and the names of the type and the array
 * @returns the text of the module
 */
export function kindsModule(kinds: Kinds, options: { readonly source?: string; readonly typeName?: string; readonly constName?: string } = {}): string {
  const typeName = options.typeName ?? `${pascal(kinds.name)}Row`;
  const constName = options.constName ?? `${camel(kinds.name)}Rows`;
  const from = options.source === undefined ? "a CSV file" : options.source;
  const fields = kinds.columns.map((c) => `  readonly ${prop(c.name)}: ${TS[c.type]}${c.nullable ? " | null" : ""};`).join("\n");
  const rows = kinds.rows.map((r) => `  {\n${kinds.columns.map((c) => `    ${prop(c.name)}: ${JSON.stringify(r[c.name] ?? null)},`).join("\n")}\n  },`).join("\n");
  return [
    "/**",
    ` * Rows for ${kinds.name}, made from ${from}. Do not edit this file: change the CSV and make it again.`,
    " *",
    " * @module",
    " */",
    "",
    `/** One row of {@link ${constName}}. */`,
    `export interface ${typeName} {`,
    fields,
    "}",
    "",
    "/** The rows, in the order of the file. */",
    `export const ${constName}: readonly ${typeName}[] = [${rows === "" ? "" : `\n${rows}\n`}];`,
    "",
  ].join("\n");
}

/**
 * The rows as the records integrations and ephemeral targets take.
 *
 * @param kinds - the rows
 * @returns the records
 */
export const rowsOf = (kinds: Kinds): readonly Readonly<Record<string, Cell>>[] => kinds.rows;
