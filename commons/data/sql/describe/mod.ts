// Spec: 0057-sql-describe FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
/**
 * Describing models in layers (commons data 0057-sql-describe): the models of governance, the logical schema that projects from them and the physical forms of that schema (SQL for each dialect, the typed tables
 * of 0053) as plain data a documentation generator reads. One `LayeredModel` for each module: its elements in each layer with their stable ids, the words the model gives them, where they are written and what is said
 * of them; the trace from an element to what it is made into; and the findings (what has no definition, personal data that is held for no purpose). It is pure: it imports no documentation library and returns values
 * that are checked against the generator's types by their shape alone.
 *
 * @remarks
 * The layers are written for a developer and for an agent: each says what it is, which code writes it and what may be edited, so that the generated pages say how to use the layers and not only what they hold.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type AnyCodeList, type AnyConcept, type Annotation, composeModules, type Datatype, type Module, vocabularies, words } from "@intellectual-frontiers/data/governance";
import { type Column, type LogicalSchema, projectDomain } from "@intellectual-frontiers/data/sql/logical";
import { bind, type Dialect, type Naming, naming as defaultNaming, type Physical } from "@intellectual-frontiers/data/sql/physical";
import { camel, ownerOf, stemOf } from "@intellectual-frontiers/data/sql/typed/generate";

const { privacy } = vocabularies;

/** Where an element is written. */
export interface Source {
  readonly file: string;
  readonly line?: number;
}

/** A layer of a model. */
export interface Layer {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly kinds: readonly string[];
}

/** An element of a layer. */
export interface Element {
  readonly id: string;
  readonly layer: string;
  readonly kind: string;
  readonly name: string;
  readonly definition: string;
  readonly parent?: string;
  readonly source?: Source;
  readonly properties: { readonly [name: string]: string | number | boolean | readonly string[] | null };
}

/** An element made into another. */
export interface Trace {
  readonly from: string;
  readonly to: string;
  readonly how: string;
}

/** What is wrong with a model. */
export interface Finding {
  readonly rule: "undescribed" | "personal-no-purpose" | "empty-code-list" | "no-identity";
  readonly element: string;
  readonly message: string;
}

/** A model described in layers: structurally the generator's `LayeredModel`. */
export interface Described {
  readonly name: string;
  readonly library: string;
  readonly title: string;
  readonly summary: string;
  readonly layers: readonly Layer[];
  readonly elements: readonly Element[];
  readonly trace: readonly Trace[];
  readonly findings: readonly Finding[];
}

/** What describing is told. */
export interface DescribeOptions {
  /** The modules of the composition, in the order they are composed. */
  readonly modules: readonly Module[];
  /** The dialects whose SQL is shown. */
  readonly dialects: readonly Dialect[];
  /** The library the models are of, as the site names it. */
  readonly library?: string;
  /** The name of the domain the modules are composed into; `models` where not given. */
  readonly domain?: string;
  readonly naming?: Naming;
  /** Where a value is written (a module, a concept, a code list) and, for a member of a concept, where it is: the generator's lens finds them from the exports it knows. */
  readonly locate?: (value: unknown, member?: string) => Source | undefined;
  /** Where the generated typed tables are, relative to the repository's root; `commons/data/sql/typed/models` where not given. */
  readonly typedDir?: string;
}

/** Why a description could not be made. */
export type DescribeError = { readonly kind: "compose" | "project" | "bind"; readonly why: string };

/** The layers, with what each is for and how to use it. */
export const LAYERS: readonly Layer[] = [
  {
    id: "governance",
    title: "Governance",
    summary:
      "What the business means, written in TypeScript with the data definition DSL: `defineModule`, `concept`, `attribute`, `relationship`, `codeList` and annotations (privacy, security, ownership, lifecycle). This is the layer a person or an agent edits. A concept's `definition` is its documentation. Everything below it is made from it and is never edited by hand.",
    kinds: ["module", "concept", "attribute", "relationship", "codelist", "code"],
  },
  {
    id: "logical",
    title: "Logical",
    summary:
      "The tables, columns, keys and constraints that a projection (`projectDomain`) makes of governance, independent of any engine. Not written by hand: change governance and the logical schema follows. Each element says which governance element it came from.",
    kinds: ["table", "column", "foreign-key", "unique", "index"],
  },
  {
    id: "physical",
    title: "Physical",
    summary:
      "The forms the logical schema takes: the SQL statements for each dialect (`bind(schema, { dialect })`) and the typed tables a program reads and writes (`sql/typed/models/<model>.auto.ts`, written by `bun tools/typed.ts --write`). Generated and committed: never edit them, change governance and generate again.",
    kinds: ["ddl", "typed-table"],
  },
];

const compact = (v: unknown): string => {
  const s = JSON.stringify(v, (_k, x) => (typeof x === "function" ? "[function]" : x)) ?? "null";
  return s.length > 160 ? `${s.slice(0, 157)}...` : s;
};
const annotationsOf = (as: readonly Annotation[]): readonly string[] => as.map((a) => `${a.kind}=${compact(a.value)}`);

/** A datatype in words. */
export function typeText(t: Datatype): string {
  switch (t.kind) {
    case "text":
      return t.max === undefined ? "text" : `text(max ${t.max})`;
    case "code":
      return `code of ${t.list.name}`;
    case "vector":
      return `vector(${t.dimensions})`;
    case "decimal":
      return "precision" in t && "scale" in t ? `decimal(${String((t as { precision?: number }).precision)},${String((t as { scale?: number }).scale)})` : "decimal";
    default:
      return t.kind;
  }
}

const id = {
  module: (m: string): string => `governance:module/${m}`,
  concept: (c: string): string => `governance:concept/${c}`,
  attribute: (c: string, a: string): string => `governance:attribute/${c}.${a}`,
  relationship: (c: string, r: string): string => `governance:relationship/${c}.${r}`,
  list: (l: string): string => `governance:codelist/${l}`,
  code: (l: string, c: string): string => `governance:code/${l}.${c}`,
};

/** The element a logical `from` (`domain/concept.attribute`, `domain/concept>relationship`, `domain/list:name`) names in governance. */
function governanceOf(from: string, domain: string): string | undefined {
  const rest = from.startsWith(`${domain}/`) ? from.slice(domain.length + 1) : undefined;
  if (rest === undefined) return undefined;
  if (rest.startsWith("list:")) {
    const [l, c] = rest.slice(5).split(".");
    return c === undefined ? id.list(l ?? "") : id.code(l ?? "", c);
  }
  const gt = rest.indexOf(">");
  if (gt > 0) return id.relationship(rest.slice(0, gt), rest.slice(gt + 1).split(".")[0] ?? "");
  const dot = rest.indexOf(".");
  return dot > 0 ? id.attribute(rest.slice(0, dot), rest.slice(dot + 1)) : id.concept(rest);
}

/**
 * Describes the models of a composition in layers.
 *
 * @param options - the modules, the dialects and where things are written
 * @returns one described model for each module that owns a table or a concept, or why the composition could not be made
 */
export function describeModels(options: DescribeOptions): Result<readonly Described[], DescribeError> {
  const domainName = options.domain ?? "models";
  const naming = options.naming ?? defaultNaming();
  const domain = composeModules(domainName, { definition: `The models ${options.modules.map((m) => m.name).join(", ")}` }, options.modules);
  if (domain.kind === "err") return err({ kind: "compose", why: JSON.stringify(domain.error).slice(0, 400) });
  const projected = projectDomain(domain.value);
  if (projected.kind === "err") return err({ kind: "project", why: JSON.stringify(projected.error).slice(0, 400) });
  const schema: LogicalSchema = projected.value.schema;
  const physical = new Map<string, Physical>();
  for (const d of options.dialects) {
    const p = bind(schema, { dialect: d, naming });
    if (p.kind === "err") return err({ kind: "bind", why: `${d.name}: ${JSON.stringify(p.error).slice(0, 400)}` });
    physical.set(d.name, p.value);
  }
  const typedDir = options.typedDir ?? "commons/data/sql/typed/models";
  const locate = options.locate ?? ((): undefined => undefined);
  const out: Described[] = [];
  for (const m of options.modules) {
    const elements: Element[] = [];
    const trace: Trace[] = [];
    const findings: Finding[] = [];
    const add = (e: Element): void => void elements.push(e);
    const src = (value: unknown, member?: string): { readonly source?: Source } => {
      const s = locate(value, member);
      return s === undefined ? {} : { source: s };
    };
    const undescribed = (elementId: string, what: string, definition: string): void => {
      if (definition.trim() === "") findings.push({ rule: "undescribed", element: elementId, message: `${what} has no definition: say what it means` });
    };
    add({ id: id.module(m.name), layer: "governance", kind: "module", name: m.name, definition: m.definition, ...src(m), properties: { requires: [...m.requires], concepts: m.concepts.map((c) => c.name), codeLists: m.codeLists.map((l) => l.name) } });
    undescribed(id.module(m.name), `module ${m.name}`, m.definition);
    const describeConcept = (c: AnyConcept): void => {
      const cid = id.concept(c.name);
      add({
        id: cid,
        layer: "governance",
        kind: "concept",
        name: c.name,
        definition: c.definition,
        parent: id.module(m.name),
        ...src(c),
        properties: { identifiedBy: [...c.identifiedBy], attributes: Object.keys(c.attributes), relationships: Object.keys(c.relationships), annotations: annotationsOf(c.annotations) },
      });
      undescribed(cid, `concept ${c.name}`, c.definition);
      if (c.identifiedBy.length === 0) findings.push({ rule: "no-identity", element: cid, message: `concept ${c.name} is identified by nothing` });
      for (const [n, a] of Object.entries(c.attributes)) {
        const aid = id.attribute(c.name, n);
        add({ id: aid, layer: "governance", kind: "attribute", name: n, definition: a.definition, parent: cid, ...src(c, n), properties: { type: typeText(a.type), multiplicity: a.multiplicity, annotations: annotationsOf(a.annotations) } });
        undescribed(aid, `attribute ${c.name}.${n}`, a.definition);
        for (const an of a.annotations)
          if (an.kind === privacy.personal.name && ((an.value as { purposes?: readonly string[] }).purposes ?? []).length === 0) findings.push({ rule: "personal-no-purpose", element: aid, message: `${c.name}.${n} holds personal data and says what it is held for nowhere` });
      }
      for (const [n, r] of Object.entries(c.relationships)) {
        const rid = id.relationship(c.name, n);
        const to = typeof r.to === "function" ? r.to() : r.to;
        add({ id: rid, layer: "governance", kind: "relationship", name: n, definition: r.definition, parent: cid, ...src(c, n), properties: { to: to.name, cardinality: r.cardinality, annotations: annotationsOf(r.annotations) } });
        undescribed(rid, `relationship ${c.name}.${n}`, r.definition);
      }
    };
    m.concepts.forEach(describeConcept);
    const describeList = (l: AnyCodeList): void => {
      const lid = id.list(l.name);
      add({ id: lid, layer: "governance", kind: "codelist", name: l.name, definition: l.definition, parent: id.module(m.name), ...src(l), properties: { codes: Object.keys(l.codes), annotations: annotationsOf(l.annotations) } });
      undescribed(lid, `code list ${l.name}`, l.definition);
      if (Object.keys(l.codes).length === 0) findings.push({ rule: "empty-code-list", element: lid, message: `code list ${l.name} has no code` });
      for (const [c, spec] of Object.entries(l.codes)) add({ id: id.code(l.name, c), layer: "governance", kind: "code", name: c, definition: spec.definition ?? spec.label, parent: lid, properties: { label: spec.label } });
    };
    m.codeLists.forEach(describeList);
    // logical and physical: the tables this module owns
    const tables = schema.tables.filter((t) => ownerOf(t, domainName, options.modules)?.name === m.name);
    for (const t of tables) {
      const tid = `logical:${String(t.id)}`;
      const tname = naming.names.write(t.name);
      add({
        id: tid,
        layer: "logical",
        kind: "table",
        name: tname,
        definition: t.comment,
        properties: { role: t.role, primaryKey: t.primaryKey.map((k) => naming.names.write(k)), columns: t.columns.map((c) => naming.names.write(c.name)) },
      });
      const gt = governanceOf(String(t.from), domainName);
      if (gt !== undefined) trace.push({ from: gt, to: tid, how: "projects to" });
      for (const c of t.columns as readonly Column[]) {
        const cid = `logical:${String(c.id)}`;
        add({ id: cid, layer: "logical", kind: "column", name: naming.names.write(c.name), definition: c.comment, parent: tid, properties: { type: c.type.kind, nullable: c.nullable, role: c.role, default: c.default === undefined ? null : compact(c.default) } });
        const gc = governanceOf(String(c.from), domainName);
        if (gc !== undefined) trace.push({ from: gc, to: cid, how: "projects to" });
      }
      for (const f of t.foreignKeys) {
        const fid = `logical:${String(f.id)}`;
        const target = schema.tables.find((x) => x.name.join(".") === f.references.table.join("."));
        add({ id: fid, layer: "logical", kind: "foreign-key", name: naming.names.write(f.name), definition: "", parent: tid, properties: { columns: f.columns.map((c) => naming.names.write(c)), references: target === undefined ? naming.names.write(f.references.table) : `logical:${String(target.id)}` } });
      }
      for (const u of t.uniques) add({ id: `logical:${String(u.id)}`, layer: "logical", kind: "unique", name: naming.names.write(u.name), definition: "", parent: tid, properties: { columns: u.columns.map((c) => naming.names.write(c)) } });
      for (const i of t.indexes) add({ id: `logical:${String(i.id)}`, layer: "logical", kind: "index", name: naming.names.write(i.name), definition: "", parent: tid, properties: { columns: i.columns.map((c) => naming.names.write(c)) } });
      for (const d of options.dialects) {
        const ph = physical.get(d.name);
        const sql = (ph?.statements ?? []).filter((s) => s.of.includes(t.id)).map((s) => s.sql);
        if (sql.length === 0) continue;
        const pid = `physical:${d.name}/${String(t.id)}`;
        add({ id: pid, layer: "physical", kind: "ddl", name: `${tname} (${d.name})`, definition: "", parent: tid, properties: { dialect: d.name, sql: sql.join("\n\n"), statements: sql.length } });
        trace.push({ from: tid, to: pid, how: "written as" });
      }
      const typedId = `physical:typed/${String(t.id)}`;
      add({
        id: typedId,
        layer: "physical",
        kind: "typed-table",
        name: camel(t.name),
        definition: "",
        parent: tid,
        source: { file: `${typedDir}/${stemOf(m)}.auto.ts` },
        properties: { export: camel(t.name), module: `@intellectual-frontiers/data/sql/typed/models`, row: `${camel(t.name).charAt(0).toUpperCase()}${camel(t.name).slice(1)}Row`, columns: t.columns.length },
      });
      trace.push({ from: tid, to: typedId, how: "read and written by" });
    }
    out.push({
      name: m.name,
      library: options.library ?? "data",
      title: words(m.name).join(" "),
      summary: m.definition,
      layers: LAYERS,
      elements: elements.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      trace: trace.toSorted((a, b) => (a.from + a.to < b.from + b.to ? -1 : 1)),
      findings: findings.toSorted((a, b) => (a.element + a.rule < b.element + b.rule ? -1 : 1)),
    });
  }
  return ok(out);
}
