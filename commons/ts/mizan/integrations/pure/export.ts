/**
 * The first exporters (commons 0019-mizan-integrations FR-010): an ontology's class schemas and code lists written in forms other tools read, as text, deterministically, so
 * that a generated file can be checked for staleness. A JSON Schema for the values of a class, SHACL shapes for its individuals, a SKOS concept scheme and a SQL table for a
 * code list.
 *
 * @remarks
 * A class schema's fields give the shape: a `one` field is required, an `optional` one is not, a `many` one is an array; a plain string, boolean or integer keeps its type, a
 * string that is one of a list of words is an enumeration, a string in a language is an object with its `value` and `language`, and a reference is an IRI (the kernel keeps the
 * classes a reference may name for the compiler only, so a shape cannot state them).
 *
 * @limits
 * Not yet written: OWL, RDF/XML, SSSOM mappings (the term schema does not yet say which relation a mapping is) and the DCAT entry. The JSON Schema is checked here by its own
 * structure; an independent validator reads it in a test only when one is a dependency of the suite.
 *
 * @example
 * ```ts
 * import { exportSqlCodeList } from "./export.ts";
 * exportSqlCodeList("basis", [{ code: "Adopts", label: "adopts" }]); // { kind: "ok", ... } the CREATE TABLE and INSERT
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/result.ts";
import type { Fields } from "../../../kernel/rdf-schema.ts";
import type { Named } from "../../../kernel/rdf-term.ts";
import type { IntegrationFinding } from "./types.ts";

/** A class schema as an exporter reads it: the class and its fields, whatever their types. */
export type AnySchema = { readonly class: Named; readonly curie: string; readonly fields: Fields };

const XSD = "http://www.w3.org/2001/XMLSchema#";

/** The local name of an IRI: what follows the last `#` or `/`. */
function localOf(iri: string): string {
  return iri.slice(Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/")) + 1);
}

// ---- JSON Schema

type Json = null | boolean | number | string | readonly Json[] | { readonly [k: string]: Json };

function jsonFor(f: AnySchema["fields"][string]): Json {
  const r = f.range;
  let one: Json;
  switch (r.kind) {
    case "string":
      one = r.words === undefined ? { type: "string" } : { enum: [...r.words] };
      break;
    case "lang":
      one = {
        type: "object",
        required: ["value", "language"],
        properties: { value: { type: "string" }, language: { type: "string" } },
        additionalProperties: false,
      };
      break;
    case "text":
      one = {
        oneOf: [
          { type: "string" },
          { type: "object", required: ["value", "language"], properties: { value: { type: "string" }, language: { type: "string" } } },
        ],
      };
      break;
    case "boolean":
      one = { type: "boolean" };
      break;
    case "integer":
      one = { type: "integer" };
      break;
    case "ref":
      one = { type: "string", format: "iri" };
      break;
    default:
      return r.kind satisfies never;
  }
  return f.cardinality === "many" ? { type: "array", items: one } : one;
}

/** A JSON Schema (2020-12) for the values of a class's individuals, as text: its fields by name, the `one` fields required, nothing else allowed. */
export function exportJsonSchema(schema: AnySchema, id?: string): string {
  const properties: Record<string, Json> = {};
  const required: string[] = [];
  for (const [name, f] of Object.entries(schema.fields)) {
    properties[name] = jsonFor(f);
    if (f.cardinality === "one") required.push(name);
  }
  const doc: Json = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    ...(id === undefined ? {} : { $id: id }),
    title: schema.curie,
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// ---- SHACL

function lit(s: string): string {
  return `"${s.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t")}"`;
}

/** SHACL node shapes for class schemas, as Turtle: each class a shape that targets it, each field a named property shape with its path, cardinality and datatype or node kind. */
export function exportShacl(schemas: readonly AnySchema[], shapes: { readonly prefix: string; readonly iri: string }): string {
  const out: string[] = [
    `@prefix sh: <http://www.w3.org/ns/shacl#> .`,
    `@prefix xsd: <${XSD}> .`,
    `@prefix ${shapes.prefix}: <${shapes.iri}> .`,
    ``,
  ];
  for (const s of schemas) {
    const shape = `${shapes.prefix}:${localOf(s.class.iri)}Shape`;
    const props = Object.keys(s.fields).map((n) => `${shapes.prefix}:${localOf(s.class.iri)}Shape-${n}`);
    out.push(
      `${shape} a sh:NodeShape ;`,
      `    sh:targetClass <${s.class.iri}> ;`,
      ...(props.length === 0 ? [] : [`    sh:property ${props.join(", ")} ;`]),
      `    sh:closed false .`,
      ``,
    );
    for (const [n, f] of Object.entries(s.fields)) {
      const r = f.range;
      const parts = [`sh:path <${f.property.iri}>`];
      if (f.cardinality === "one") parts.push(`sh:minCount 1`);
      if (f.cardinality !== "many") parts.push(`sh:maxCount 1`);
      switch (r.kind) {
        case "string":
          parts.push(r.words === undefined ? `sh:datatype xsd:string` : `sh:in ( ${r.words.map(lit).join(" ")} )`);
          break;
        case "lang":
          parts.push(`sh:datatype <http://www.w3.org/1999/02/22-rdf-syntax-ns#langString>`);
          break;
        case "text":
          break;
        case "boolean":
          parts.push(`sh:datatype xsd:boolean`);
          break;
        case "integer":
          parts.push(`sh:datatype xsd:integer`);
          break;
        case "ref":
          parts.push(`sh:nodeKind sh:IRI`);
          break;
        default:
          return r.kind satisfies never;
      }
      out.push(
        `${shapes.prefix}:${localOf(s.class.iri)}Shape-${n} a sh:PropertyShape ;\n${parts.map((x) => `    ${x}`).join(" ;\n")} .`,
        ``,
      );
    }
  }
  return `${out.join("\n").trimEnd()}\n`;
}

// ---- code lists

/** One member of a code list as the exporters read it. */
export type CodeMember = { readonly code: string; readonly label: string; readonly definition?: string };

/** A SKOS concept scheme for a code list, as Turtle: the scheme, and each member a concept with its notation, label and definition. */
export function exportSkos(list: {
  readonly schemeIri: string;
  readonly label: string;
  readonly conceptBase: string;
  readonly members: readonly CodeMember[];
}): string {
  const out: string[] = [
    `@prefix skos: <http://www.w3.org/2004/02/skos/core#> .`,
    ``,
    `<${list.schemeIri}> a skos:ConceptScheme ;`,
    `    skos:prefLabel ${lit(list.label)}@en .`,
    ``,
  ];
  for (const m of list.members) {
    out.push(
      `<${list.conceptBase}${m.code}> a skos:Concept ;`,
      `    skos:inScheme <${list.schemeIri}> ;`,
      `    skos:notation ${lit(m.code)} ;`,
      `    skos:prefLabel ${lit(m.label)}@en${m.definition === undefined ? " ." : " ;"}`,
      ...(m.definition === undefined ? [] : [`    skos:definition ${lit(m.definition)}@en .`]),
      ``,
    );
  }
  return `${out.join("\n").trimEnd()}\n`;
}

function sqlText(s: string): string {
  return `'${s.replaceAll("'", "''")}'`;
}

/** A SQL table for a code list, as a `CREATE TABLE` and one `INSERT` per member in order, or the finding that its name is not one a table may have. */
export function exportSqlCodeList(table: string, members: readonly CodeMember[]): Result<string, readonly IntegrationFinding[]> {
  if (!/^[a-z][a-z0-9_]*$/.test(table)) return err([{ kind: "bad-name", name: table }]);
  const lines = [`CREATE TABLE ${table} (`, `  code text PRIMARY KEY,`, `  label text NOT NULL,`, `  definition text`, `);`];
  for (const m of members) {
    lines.push(
      `INSERT INTO ${table} (code, label, definition) VALUES (${sqlText(m.code)}, ${sqlText(m.label)}, ${m.definition === undefined ? "NULL" : sqlText(m.definition)});`,
    );
  }
  return ok(`${lines.join("\n")}\n`);
}

/** A JSON Schema document whose `$defs` are the schemas of several classes, by their local names: one file for an ontology's classes. */
export function exportJsonSchemaDefs(schemas: readonly AnySchema[], id: string, comment: string): string {
  const defs: Record<string, Json> = {};
  for (const s of schemas) {
    const one: unknown = JSON.parse(exportJsonSchema(s));
    if (typeof one === "object" && one !== null && !Array.isArray(one)) {
      const { $schema: _drop, ...rest } = one as Record<string, Json>;
      defs[localOf(s.class.iri)] = rest;
    }
  }
  return `${JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", $id: id, $comment: comment, $defs: defs }, null, 2)}\n`;
}
