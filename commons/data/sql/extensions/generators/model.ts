// Spec: 0010-sql-generators FR-004, FR-006, FR-012
/**
 * What every generator reads (commons data 0010-sql-generators): the logical schema as a plain document, with the name of each table and column as the case style writes it, the column each
 * foreign key points to, the codes a closed list lets a column hold, and what governance said of each table and column. It reads nothing but the logical schema, the naming and the dialect.
 *
 * @module
 */
import { vocabularies, words } from "@intellectual-frontiers/data/governance";
import {
  carriedOf,
  type Column,
  type LogicalSchema,
  type LogicalType,
  sameWords,
  type Table,
} from "@intellectual-frontiers/data/sql/logical";
import { type GenerateContext, writeCode } from "@intellectual-frontiers/data/sql/physical";

const { privacy, security, ownership } = vocabularies;

/** A column of the document. */
export interface DocColumn {
  readonly name: string;
  readonly column: Column;
  readonly type: LogicalType;
  readonly nullable: boolean;
  readonly primaryKey: boolean;
  /** The table and column it points to, as written. */
  readonly points?: { readonly table: string; readonly column: string };
  /** Whether at most one row of the table points to a row: the column alone is the key or is unique. */
  readonly single: boolean;
  readonly comment: string;
  /** The codes that only a closed list lets the column hold, as stored. */
  readonly codes?: readonly string[];
  readonly personal?: { readonly category?: string; readonly class?: string; readonly purposes: readonly string[] };
}

/** A table of the document. */
export interface DocTable {
  readonly name: string;
  readonly table: Table;
  readonly comment: string;
  readonly owner?: string;
  readonly primaryKey: readonly string[];
  readonly columns: readonly DocColumn[];
}

/** The document. */
export interface Doc {
  /** The domain's name written as the case style writes names, which paths are made of. */
  readonly stem: string;
  readonly domain: string;
  readonly comment: string;
  readonly tables: readonly DocTable[];
}

/**
 * The document of a logical schema.
 *
 * @param context - what a generator is given
 * @returns the document
 */
export function docOf(context: GenerateContext): Doc {
  const { schema, naming } = context;
  const write = (w: readonly string[]): string => naming.names.write(w);
  const owner = (t: Table, s: LogicalSchema): string | undefined => carriedOf(t, ownership.owner)[0] ?? carriedOf(s, ownership.owner)[0];
  const tables = schema.tables.map((t): DocTable => {
    const points = new Map<string, { table: string; column: string }>();
    for (const f of t.foreignKeys)
      f.columns.forEach((c, i) => {
        const target = f.references.columns[i];
        if (target !== undefined) points.set(c.join("."), { table: write(f.references.table), column: write(target) });
      });
    const columns = t.columns.map((c): DocColumn => {
      const check = t.checks.find((k) => k.expression.kind === "oneOf" && sameWords(k.expression.column, c.name));
      const codes =
        check !== undefined && check.expression.kind === "oneOf" ? check.expression.codes.map((x) => writeCode(naming, x)) : undefined;
      const p = carriedOf(c, privacy.personal)[0];
      const target = points.get(c.name.join("."));
      return {
        name: write(c.name),
        column: c,
        type: c.type,
        nullable: c.nullable,
        primaryKey: t.primaryKey.some((k) => sameWords(k, c.name)),
        ...(target === undefined ? {} : { points: target }),
        single:
          (t.primaryKey.length === 1 && t.primaryKey.some((k) => sameWords(k, c.name))) ||
          t.uniques.some((u) => u.columns.length === 1 && u.columns.some((k) => sameWords(k, c.name))),
        comment: c.comment,
        ...(codes === undefined ? {} : { codes }),
        ...(p === undefined
          ? {}
          : {
              personal: {
                ...(p.category === undefined ? {} : { category: p.category, class: privacy.dpvClassOf(p.category) }),
                purposes: p.purposes ?? [],
              },
            }),
      };
    });
    const o = owner(t, schema);
    return {
      name: write(t.name),
      table: t,
      comment: t.comment,
      ...(o === undefined ? {} : { owner: o }),
      primaryKey: t.primaryKey.map(write),
      columns,
    };
  });
  return { stem: write(words(schema.domain)), domain: schema.domain, comment: schema.comment, tables };
}

/** The name of a logical type, as a diagram writes it. */
export function typeName(t: LogicalType): string {
  switch (t.kind) {
    case "text":
      return "text";
    case "integer":
      return "integer";
    case "decimal":
      return "decimal";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "timestamp":
      return "timestamp";
    case "json":
      return "json";
    case "bytes":
      return "bytes";
    case "vector":
      return `vector${t.dimensions}`;
  }
}

/** The security a column or a table carries, in the words of a register. */
export function securityOf(e: {
  readonly governance: readonly import("@intellectual-frontiers/data/governance").Annotation[];
}): readonly string[] {
  const out: string[] = [];
  const c = carriedOf(e, security.classification)[0];
  if (c !== undefined) out.push(`classification: ${c}`);
  const a = carriedOf(e, security.access)[0];
  if (a !== undefined) out.push(`read: ${a.read.join(", ") || "none"}; write: ${a.write.join(", ") || "none"}`);
  const s = carriedOf(e, security.scope)[0];
  if (s !== undefined) out.push(`scope: ${s.name}`);
  const m = carriedOf(e, security.mask)[0];
  if (m !== undefined) out.push(`mask: ${m}`);
  return out;
}

/** A text on one line, as a Markdown table cell holds it: a pipe and a line break escaped. */
export const cell = (text: string): string => text.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replace(/\r?\n/g, " ");

/** A text as HTML holds it. */
export const html = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/** A text on one line for a documentation comment: a line break is a space. */
export const oneLine = (text: string): string => text.replace(/\s*\r?\n\s*/g, " ").trim();

/** A text as a string of TypeScript or JSON. */
export const quoted = (text: string): string => JSON.stringify(text);

/** The words of a name in Pascal case. */
export const pascalOf = (name: string): string =>
  words(name)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

/** Lines joined, ending in one newline. */
export const lines = (ls: readonly string[]): string => `${ls.join("\n")}\n`;
