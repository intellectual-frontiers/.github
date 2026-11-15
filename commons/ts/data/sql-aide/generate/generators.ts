/**
 * Generators: what a model's tables say, written for other readers: an entity-relationship diagram as Mermaid and as D2, a data
 * dictionary in Markdown from the model and its documentation, Rust structures and Zod schemas, all as text (commons 0009-sql-aide
 * FR-045). A generator is a typed value, and a plugin may add its own (FR-024). The library depends on neither Rust nor Zod: it writes
 * text that a Rust compiler and a program that imports Zod read.
 *
 * @limits
 * The diagrams are committed as text and are not rendered by a Mermaid or D2 tool here. Rust structures keep dates, moments, decimals and
 * JSON as `String`, so they need no crate; the test compiles them where `rustc` is on the PATH. Zod is a development dependency of the
 * tests only: the library writes the schemas as text.
 *
 * @module
 */
import { absurd } from "../../../kernel/mod.ts";
import type { ColumnSpec } from "../algebra/column.ts";
import type { DomainSpec } from "../algebra/domain.ts";
import type { TableSpec } from "../algebra/table.ts";
import { token } from "../core/text.ts";
import type { EmitContext } from "../emit/context.ts";
import type { Linted } from "../govern/lint.ts";

/** A file a generator makes: where it goes, relative to where the caller keeps generated files, and its text. */
export interface GeneratedFile {
  /** The path. */
  readonly path: string;
  /** The text. */
  readonly text: string;
}

/** A generator: from a model's tables and the context (its documentation, its dialect), files. */
export interface Generator {
  /** The generator's name, as the command line asks for it. */
  readonly name: string;
  /** Makes the files. */
  generate(tables: readonly Linted[], ctx: EmitContext): readonly GeneratedFile[];
}

const referencesOf = (spec: TableSpec): readonly (readonly [string, ColumnSpec, string])[] =>
  spec.columns.flatMap(([n, c]) => {
    const r = c.references;
    if (r === undefined) return [];
    return [[n, c, r.table === undefined ? spec.name : r.table().name] as const];
  });

const description = (t: Linted, ctx: EmitContext): string | undefined => t.spec.doc ?? ctx.docs.get(t)?.summary;
const columnDoc = (t: Linted, ctx: EmitContext, n: string, c: ColumnSpec): string | undefined => c.doc ?? ctx.docs.get(t)?.members[n];

function kindWord(d: DomainSpec): string {
  return d.kind === "array" ? `${kindWord(d.of)}_array` : d.kind === "custom" ? d.name.replace(/[^A-Za-z0-9_]/g, "_") : d.kind;
}

/**
 * The tables as a Mermaid entity-relationship diagram: each table with its columns, and a relation for each foreign key, one to many,
 * or one to at most one where the key is the table's whole primary key.
 *
 * @param tables - the tables
 */
export function mermaidErd(tables: readonly Linted[]): string {
  const out = ["erDiagram"];
  for (const { spec } of tables) {
    out.push(`    ${spec.name} {`);
    for (const [n, c] of spec.columns) {
      const keys = [...(spec.primaryKey.includes(n) ? ["PK"] : []), ...(c.references === undefined ? [] : ["FK"])];
      out.push(`        ${kindWord(c.domain)} ${n}${keys.length === 0 ? "" : ` ${keys.join(", ")}`}`);
    }
    out.push("    }");
  }
  for (const { spec } of tables)
    for (const [n, c, target] of referencesOf(spec)) {
      const one = spec.primaryKey.length === 1 && spec.primaryKey[0] === n;
      const parent = c.nullable ? "|o" : "||";
      out.push(`    ${target} ${parent}--${one ? "o|" : "o{"} ${spec.name} : "${n}"`);
    }
  return `${out.join("\n")}\n`;
}

/**
 * The tables as a D2 diagram: each table a `sql_table` shape whose rows are its columns, and an arrow from each foreign key to the
 * column it points to.
 *
 * @param tables - the tables
 */
export function d2Erd(tables: readonly Linted[]): string {
  const out: string[] = [];
  for (const { spec } of tables) {
    out.push(`${spec.name}: {`, "  shape: sql_table");
    for (const [n, c] of spec.columns) {
      const constraints = [...(spec.primaryKey.includes(n) ? ["primary_key"] : []), ...(c.references === undefined ? [] : ["foreign_key"])];
      const tail =
        constraints.length === 0
          ? ""
          : constraints.length === 1
            ? ` {constraint: ${constraints[0]}}`
            : ` {constraint: [${constraints.join("; ")}]}`;
      out.push(`  ${n}: ${kindWord(c.domain)}${tail}`);
    }
    out.push("}");
  }
  for (const { spec } of tables)
    for (const [n, c, target] of referencesOf(spec)) out.push(`${spec.name}.${n} -> ${target}.${c.references?.column ?? ""}`);
  return `${out.join("\n")}\n`;
}

const cell = (s: string): string => s.replaceAll("|", "\\|").replaceAll("\n", " ");

/**
 * A data dictionary in Markdown: for each table its description, owner and key, and a row for each column with its type in the
 * context's dialect, whether it may be null, what it points to, its description and the class of personal data it holds.
 *
 * @param tables - the tables
 * @param ctx - the context: the dialect the types are written in, and the documentation
 */
export function dataDictionary(tables: readonly Linted[], ctx: EmitContext): string {
  const out = ["# Data dictionary", "", `Types as ${ctx.dialect.name} writes them.`];
  for (const t of tables) {
    const { spec } = t;
    out.push("", `## ${spec.name}`, "");
    const d = description(t, ctx);
    if (d !== undefined) out.push(d, "");
    const remarks = ctx.docs.get(t)?.remarks;
    if (remarks !== undefined) out.push(remarks, "");
    out.push(
      `Owner: ${spec.owner ?? "not said"}. Primary key: ${spec.primaryKey.length === 0 ? "none" : `(${spec.primaryKey.join(", ")})`}.`,
      "",
    );
    out.push("| Column | Type | Null | Points to | Description | Personal data |", "| --- | --- | --- | --- | --- | --- |");
    for (const [n, c] of spec.columns) {
      const r = c.references;
      const points = r === undefined ? "" : `${r.table === undefined ? spec.name : r.table().name}.${r.column}`;
      const personal = c.personal === undefined ? "" : c.category === undefined ? c.personal : `${c.personal}: ${c.category}`;
      out.push(
        `| ${cell(n)} | ${cell(ctx.dialect.typeOf(c.domain))} | ${c.nullable ? "yes" : "no"} | ${cell(points)} | ${cell(columnDoc(t, ctx, n, c) ?? "")} | ${cell(personal)} |`,
      );
    }
  }
  return `${out.join("\n")}\n`;
}

const RUST_KEYWORDS = new Set(
  "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self static struct super trait true type unsafe use where while abstract become box do final macro override priv typeof unsized virtual yield try".split(
    " ",
  ),
);
const rustField = (n: string): string => (RUST_KEYWORDS.has(token(n).snake) ? `r#${token(n).snake}` : token(n).snake);

function rustType(d: DomainSpec, enumName: string): string {
  switch (d.kind) {
    case "text":
    case "numeric":
    case "date":
    case "timestamp":
    case "json":
    case "uuid":
    case "custom":
      return "String";
    case "integer":
      return "i32";
    case "bigint":
      return "i64";
    case "real":
      return "f64";
    case "boolean":
      return "bool";
    case "bytes":
      return "Vec<u8>";
    case "enum":
      return enumName;
    case "array":
      return `Vec<${rustType(d.of, enumName)}>`;
    default:
      return absurd(d);
  }
}

/**
 * Rust structures of the rows of the tables: a `struct` for each table with a field for each column, `Option` where it may be null,
 * and an `enum` for each column of a closed set of words. Dates, moments, decimals and JSON are `String`, so that the code needs no
 * crate; a program converts them where it reads them.
 *
 * @param tables - the tables
 * @param ctx - the context, for the documentation
 */
export function rustStructs(tables: readonly Linted[], ctx: EmitContext): string {
  const out = ["//! Rows of the model's tables, generated by IFC SQL Aide. Do not edit: change the model and generate again.", ""];
  for (const t of tables) {
    const { spec } = t;
    const name = token(spec.name).pascal;
    for (const [n, c] of spec.columns) {
      const d = c.domain.kind === "array" ? c.domain.of : c.domain;
      if (d.kind !== "enum") continue;
      out.push(
        `/// The values of ${spec.name}.${n}.`,
        "#[derive(Debug, Clone, Copy, PartialEq, Eq)]",
        `pub enum ${name}${token(n).pascal} {`,
      );
      for (const v of d.values) out.push(`    /// \`${v}\``, `    ${token(v).pascal},`);
      out.push("}", "");
    }
    const doc = description(t, ctx);
    if (doc !== undefined) out.push(`/// ${doc.replaceAll("\n", " ")}`);
    out.push("#[derive(Debug, Clone, PartialEq)]", `pub struct ${name} {`);
    for (const [n, c] of spec.columns) {
      const cd = columnDoc(t, ctx, n, c);
      if (cd !== undefined) out.push(`    /// ${cd.replaceAll("\n", " ")}`);
      const type = rustType(c.domain, `${name}${token(n).pascal}`);
      out.push(`    pub ${rustField(n)}: ${c.nullable ? `Option<${type}>` : type},`);
    }
    out.push("}", "");
  }
  return out.join("\n");
}

function zodType(d: DomainSpec): string {
  switch (d.kind) {
    case "text":
    case "uuid":
    case "custom":
      return "z.string()";
    case "numeric":
      return "decimal";
    case "date":
      return "isoDate";
    case "timestamp":
      return "z.date()";
    case "integer":
      return "z.int()";
    case "bigint":
      return "z.bigint()";
    case "real":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "json":
      return "z.json()";
    case "bytes":
      return "z.instanceof(Uint8Array)";
    case "enum":
      return `z.enum([${d.values.map((v) => JSON.stringify(v)).join(", ")}])`;
    case "array":
      return `z.array(${zodType(d.of)})`;
    default:
      return absurd(d);
  }
}

/**
 * Zod schemas of the rows of the tables, as a TypeScript module that imports Zod: one schema for each table, a column that may be null
 * `.nullable()`. The values are those a driver of the library decodes (a date as `YYYY-MM-DD` text, a moment as a `Date`).
 *
 * @param tables - the tables
 * @param ctx - the context, for the documentation
 */
export function zodSchemas(tables: readonly Linted[], ctx: EmitContext): string {
  const out = [
    "/**",
    " * Zod schemas of the rows of the model's tables, generated by IFC SQL Aide. Do not edit: change the model and generate again.",
    " *",
    " * @module",
    " */",
    // the module the schemas are written in imports Zod; this one does not
    `import { z } from ${JSON.stringify("zod")};`,
  ];
  const body: string[] = [];
  for (const t of tables) {
    const { spec } = t;
    body.push(
      "",
      `/** ${(description(t, ctx) ?? `A row of ${spec.name}.`).replaceAll("\n", " ")} */`,
      `export const ${token(spec.name).pascal} = z.object({`,
    );
    for (const [n, c] of spec.columns)
      body.push(`  ${/^[A-Za-z_$][\w$]*$/.test(n) ? n : JSON.stringify(n)}: ${zodType(c.domain)}${c.nullable ? ".nullable()" : ""},`);
    body.push("});");
  }
  // the schemas of a date and of a decimal are written once, where a column uses them
  const uses = (word: string): boolean => body.some((l) => new RegExp(`\\b${word}\\b`).test(l));
  if (uses("isoDate"))
    out.push(
      "",
      "/** A calendar date, as a driver of IFC SQL Aide gives it. */",
      "const isoDate = z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/);",
    );
  if (uses("decimal")) out.push("", "/** An exact decimal, as text. */", "const decimal = z.string().regex(/^-?\\d+(\\.\\d+)?$/);");
  return `${[...out, ...body].join("\n")}\n`;
}

/** The generators the library has, by name. */
export const generators: readonly Generator[] = [
  { name: "mermaid", generate: (tables) => [{ path: "erd.mmd", text: mermaidErd(tables) }] },
  { name: "d2", generate: (tables) => [{ path: "erd.d2", text: d2Erd(tables) }] },
  { name: "dictionary", generate: (tables, ctx) => [{ path: "dictionary.md", text: dataDictionary(tables, ctx) }] },
  { name: "rust", generate: (tables, ctx) => [{ path: "model.rs", text: rustStructs(tables, ctx) }] },
  { name: "zod", generate: (tables, ctx) => [{ path: "model.zod.ts", text: zodSchemas(tables, ctx) }] },
];
