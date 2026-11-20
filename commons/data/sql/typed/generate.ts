// Spec: 0053-sql-typed FR-008, FR-009
/**
 * The typed tables of a model (commons data 0053-sql-typed): each model (a module of governance) gets a file `<model>.auto.ts` of the tables that it owns, made from the logical schema and governance and never
 * written by hand: for each table a row type, an insert type (what the database fills may be left out), a key type, and a `defineTable` value whose columns are typed from the model (a closed list of codes is a
 * union of its names). It reads nothing but the schema, the modules and the naming; the tool `tools/typed.ts` writes the files and checks that they are up to date.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Module, words } from "@intellectual-frontiers/data/governance";
import { type Column, type LogicalSchema, type LogicalType, sameWords, type Table } from "@intellectual-frontiers/data/sql/logical";
import { type Artifact, type Naming, naming as defaultNaming } from "@intellectual-frontiers/data/sql/physical";

const RESERVED = new Set(["break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for", "function", "if", "import", "in", "instanceof", "new", "null", "return", "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield", "let", "static", "await", "async", "of", "type", "from", "as"]);

/** A name as a program writes it: words in camel case; one that the language reserves gets an underscore. */
export const camel = (w: readonly string[]): string => {
  const c = w.map((x, i) => (i === 0 ? x : x.charAt(0).toUpperCase() + x.slice(1))).join("");
  const safe = /^[0-9]/.test(c) ? `_${c}` : c;
  return RESERVED.has(safe) ? `${safe}_` : safe;
};
/** The same with a capital, as a type's name. */
export const pascal = (w: readonly string[]): string => {
  const c = w.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join("");
  return /^[0-9]/.test(c) ? `_${c}` : c;
};

/** The words of a model's name (`arcaParty`) joined by hyphens: the stem of its file. */
export const stemOf = (module: Module): string => words(module.name).join("-");

const tsType = (t: LogicalType): string => {
  switch (t.kind) {
    case "text":
    case "decimal":
    case "date":
      return "string";
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "timestamp":
      return "Timestamp";
    case "json":
      return "unknown";
    case "bytes":
      return "Uint8Array";
    case "vector":
      return "readonly number[]";
  }
};

const q = (s: string): string => JSON.stringify(s);
const oneLine = (s: string): string => s.replace(/\s+/g, " ").replace(/\*\//g, "* /").trim();
const doc = (s: string, indent = ""): string[] => (oneLine(s) === "" ? [] : [`${indent}/** ${oneLine(s)} */`]);

/** The module that owns a table: the one that has the concept or the code list it was made from. */
export function ownerOf(table: Table, domain: string, modules: readonly Module[]): Module | undefined {
  const prefix = `${domain}/`;
  const from = String(table.from);
  if (!from.startsWith(prefix)) return undefined;
  const rest = from.slice(prefix.length);
  const name = rest.startsWith("list:") ? rest.slice(5).split(".")[0] : rest.split(".")[0];
  return modules.find((m) => (rest.startsWith("list:") ? m.codeLists.some((l) => l.name === name) : m.concepts.some((c) => c.name === name)));
}

interface Col {
  readonly key: string;
  readonly sql: string;
  readonly type: string;
  readonly nullable: boolean;
  readonly optional: boolean;
  readonly comment: string;
  readonly primary: boolean;
}

function columns(t: Table, naming: Naming): readonly Col[] {
  return t.columns.map((c: Column): Col => {
    const check = t.checks.find((k) => k.expression.kind === "oneOf" && sameWords(k.expression.column, c.name));
    const codes = check !== undefined && check.expression.kind === "oneOf" ? check.expression.codes : undefined;
    const base = codes === undefined || codes.length === 0 ? tsType(c.type) : codes.map((x) => q(naming.codes === "name" ? x : naming.codes.write(words(x)))).join(" | ");
    return {
      key: camel(c.name),
      sql: naming.names.write(c.name),
      type: c.nullable ? `${base} | null` : base,
      nullable: c.nullable,
      optional: c.nullable || c.default !== undefined,
      comment: c.comment,
      primary: t.primaryKey.some((k) => sameWords(k, c.name)),
    };
  });
}

/** What the generator is told. */
export interface TypedOptions {
  /** The modules of the composition, in the order they were composed; a table belongs to the one whose concept or code list it came from. */
  readonly modules: readonly Module[];
  readonly naming?: Naming;
}

/** What is wrong with a generation. */
export type TypedGenerateError = { readonly kind: "orphan"; readonly table: string } | { readonly kind: "collision"; readonly module: string; readonly name: string };

/**
 * The files of the typed tables: one for each module that owns a table, and `mod.ts`, which names them.
 *
 * @param schema - the logical schema of the whole composition
 * @param options - the modules and the naming
 * @returns the files, or the tables no module owns and the names that are the same
 */
export function typedFiles(schema: LogicalSchema, options: TypedOptions): Result<readonly Artifact[], readonly TypedGenerateError[]> {
  const naming = options.naming ?? defaultNaming();
  const errors: TypedGenerateError[] = [];
  const byModule = new Map<string, { module: Module; tables: Table[] }>();
  for (const t of schema.tables) {
    const m = ownerOf(t, schema.domain, options.modules);
    if (m === undefined) {
      errors.push({ kind: "orphan", table: naming.names.write(t.name) });
      continue;
    }
    const slot = byModule.get(m.name) ?? { module: m, tables: [] };
    slot.tables.push(t);
    byModule.set(m.name, slot);
  }
  const files: Artifact[] = [];
  for (const { module, tables } of byModule.values()) {
    const out = [
      "// Spec: 0053-sql-typed FR-008",
      "/**",
      ` * The typed tables of the ${module.name} model, generated by IFC Data from the model. Do not edit: change the model and run \`bun tools/typed.ts --write\`.`,
      ...(oneLine(module.definition) === "" ? [] : [" *", ` * ${oneLine(module.definition)}`]),
      " *",
      " * @module",
      " */",
      "@@import",
    ];
    const seen = new Set<string>();
    for (const t of tables) {
      const cols = columns(t, naming);
      const name = camel(t.name);
      const type = pascal(t.name);
      if (seen.has(name)) errors.push({ kind: "collision", module: module.name, name });
      seen.add(name);
      const keyOf = (w: readonly string[]): string => camel(w);
      const pk = t.primaryKey.map(keyOf);
      out.push("", ...doc(t.comment), `export interface ${type}Row {`);
      for (const c of cols) out.push(...doc(c.comment, "  "), `  readonly ${c.key}: ${c.type};`);
      out.push("}", "", ...doc(`What an insert into ${naming.names.write(t.name)} takes: what the database fills may be left out.`), `export interface ${type}Insert {`);
      for (const c of cols) out.push(`  readonly ${c.key}${c.optional ? "?" : ""}: ${c.type};`);
      out.push("}");
      out.push("", ...doc(`The key of a row of ${naming.names.write(t.name)}.`));
      out.push(pk.length === 0 ? `export type ${type}Key = never;` : `export type ${type}Key = { ${pk.map((k) => `readonly ${k}: ${cols.find((c) => c.key === k)?.type ?? "never"}`).join("; ")} };`);
      out.push("", ...doc(t.comment), `export const ${name} = defineTable<${type}Row, ${type}Insert, ${q(name)}>({`);
      out.push(`  alias: ${q(name)},`, `  name: ${q(naming.names.write(t.name))},`, "  columns: {");
      for (const c of cols) out.push(`    ${c.key}: ${q(c.sql)},`);
      out.push("  },", `  primaryKey: [${pk.map(q).join(", ")}],`);
      if (t.foreignKeys.length > 0) {
        out.push("  foreignKeys: [");
        for (const f of t.foreignKeys)
          out.push(`    { columns: [${f.columns.map((c) => q(keyOf(c))).join(", ")}], references: ${q(camel(f.references.table))}, referencesColumns: [${f.references.columns.map((c) => q(keyOf(c))).join(", ")}] },`);
        out.push("  ],");
      }
      out.push("});");
    }
    const text = out.join("\n");
    const importLine = /\bTimestamp\b/.test(text.replace("@@import", "")) ? 'import { defineTable, type Timestamp } from "@intellectual-frontiers/data/sql/typed";' : 'import { defineTable } from "@intellectual-frontiers/data/sql/typed";';
    files.push({ path: `${stemOf(module)}.auto.ts`, text: `${text.replace("@@import", importLine)}\n` });
  }
  const names = files.map((f) => f.path.replace(/\.auto\.ts$/, ""));
  files.push({
    path: "mod.ts",
    text: [
      "// Spec: 0053-sql-typed FR-008",
      "/**",
      " * The typed tables of each model, one module for each (generated: `bun tools/typed.ts --write`).",
      " *",
      " * @module",
      " */",
      ...names.map((n) => `export * as ${camel(words(n))} from "./${n}.auto.ts";`),
      "",
    ].join("\n"),
  });
  return errors.length > 0 ? err(errors) : ok(files);
}
