// Spec: 0006-logical FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * The normalized projection (commons data 0006-logical): a domain made into a logical schema, one table for each concept and for each open code list, the columns and keys that
 * the attributes and relationships say, the constraints and indexes the vocabularies say, and the names, as lists of words, that 0005-naming says. It returns the schema and a
 * report of the flow, or every error together. A `Projection` is a value: this is the library's own, and another takes its place.
 *
 * @remarks
 * What the schema cannot express itself, it carries: the annotations of privacy, security, ownership, requirements and the rest stay on the tables and columns that were made from what they
 * were on, so that a layer or an extension below may express them, and the report says so.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import {
  type Annotation,
  type AnnotationName,
  annotationsOf,
  type AnyCodeList,
  type AnyConcept,
  attributeId,
  type Attribute,
  codeListId,
  conceptId,
  type Datatype,
  defaultVocabularies,
  domainId,
  type Domain,
  type ElementId,
  elementsOf,
  membersOf,
  type Relationship,
  relationshipId,
  resolve,
  vocabularies,
  words,
  type Words,
} from "@intellectual-frontiers/data/governance";
import {
  type Check,
  type CodeRow,
  type Column,
  columnId,
  constraintId,
  type ForeignKey,
  type Index,
  type LogicalDefault,
  type LogicalId,
  type LogicalSchema,
  type LogicalType,
  schemaId,
  type Table,
  tableId,
  type Unique,
  type ValueSet,
  valueSetId,
} from "./schema.ts";

const { quality, usage } = vocabularies;

/** What is wrong with a projection; `project` returns all of it together. */
export type ProjectionError =
  | {
      readonly kind: "collision";
      readonly what: "table" | "column" | "constraint";
      readonly name: Words;
      readonly table?: Words;
      readonly first: ElementId;
      readonly second: ElementId;
    }
  | {
      readonly kind: "member";
      readonly concept: ElementId;
      readonly member: string;
      readonly why: "unknown" | "not-a-column" | "not-one-column";
    }
  | { readonly kind: "identity"; readonly concept: ElementId; readonly why: "cycle" };

/** Where an annotation ended. */
export type Disposition = "expressed" | "carried" | "unexpressed";

/** What became of one annotation of governance. */
export interface FlowEntry {
  readonly element: ElementId;
  /** The annotation's position among the element's annotations. */
  readonly index: number;
  readonly annotation: AnnotationName;
  readonly disposition: Disposition;
  /** The logical elements it became, or that carry it. */
  readonly logical: readonly LogicalId[];
  readonly note?: string;
}

/** A logical schema and the report of the flow of governance into it. */
export interface Projected {
  readonly schema: LogicalSchema;
  readonly flow: readonly FlowEntry[];
}

/** A projection: a value that makes a logical schema from a domain. */
export type Projection = (domain: Domain) => Result<Projected, readonly ProjectionError[]>;

/** What a projection may be told besides the domain. */
export interface ProjectionOptions {
  /** Kinds of annotation, besides the library's own vocabularies', that the schema carries. */
  readonly carry?: readonly AnnotationName[];
}

const EXPRESSED: ReadonlySet<AnnotationName> = new Set([
  quality.defaultValue.name,
  quality.unique.name,
  quality.differs.name,
  quality.audited.name,
  quality.openness.name,
  quality.range.name,
  quality.pattern.name,
  usage.lookup.name,
]);

const typeOf = (t: Datatype): LogicalType => {
  switch (t.kind) {
    case "text":
      return t.max === undefined ? { kind: "text" } : { kind: "text", max: t.max };
    case "identifier":
    case "code":
      return { kind: "text" };
    case "integer":
      return { kind: "integer" };
    case "decimal":
      return {
        kind: "decimal",
        ...(t.precision === undefined ? {} : { precision: t.precision }),
        ...(t.scale === undefined ? {} : { scale: t.scale }),
      };
    case "boolean":
      return { kind: "boolean" };
    case "date":
      return { kind: "date" };
    case "instant":
      return { kind: "timestamp", zone: true };
    case "structured":
      return { kind: "json" };
    case "binary":
      return { kind: "bytes" };
  }
};

const openness = (l: AnyCodeList): "open" | "closed" => annotationsOf(l, quality.openness)[0] ?? "closed";

/** The words of the column that refers to a column of a target's key (0005-naming FR-003). */
export function referenceWords(relationship: string, target: string, key: Words): Words {
  const t = words(target);
  const begins = key.length >= t.length && t.every((w, i) => key[i] === w);
  return [...(relationship === target ? [] : words(relationship)), ...(begins ? key : [...t, ...key])];
}

interface KeyColumn {
  readonly name: Words;
  readonly type: LogicalType;
}

/** The normalized projection with its options. */
export function normalizedProjection(options: ProjectionOptions = {}): Projection {
  const carried: ReadonlySet<AnnotationName> = new Set([
    ...defaultVocabularies.flatMap((v) => v.kinds.map((k) => k.name)).filter((n) => !EXPRESSED.has(n)),
    ...(options.carry ?? []),
  ]);
  return (d) => project(d, carried);
}

/** The normalized projection, with the library's vocabularies. */
export const normalized: Projection = normalizedProjection();

function project(d: Domain, carriedKinds: ReadonlySet<AnnotationName>): Result<Projected, readonly ProjectionError[]> {
  const errors: ProjectionError[] = [];
  const expressed = new Map<string, LogicalId[]>();
  const carriers = new Map<ElementId, LogicalId[]>();
  const express = (el: ElementId, index: number, ...ids: LogicalId[]): void =>
    void expressed.set(`${el}|${index}`, [...(expressed.get(`${el}|${index}`) ?? []), ...ids]);
  const carry = (el: ElementId, ...ids: LogicalId[]): void => void carriers.set(el, [...(carriers.get(el) ?? []), ...ids]);
  const annotated = (
    el: { readonly annotations: readonly Annotation[] },
    kind: AnnotationName,
  ): { readonly index: number; readonly value: unknown }[] =>
    el.annotations.flatMap((a, index) => (a.kind === kind ? [{ index, value: a.value }] : []));

  // key columns of each concept, by the words of its own table: an identifying attribute, or the reference columns of an identifying relationship
  const keys = new Map<string, readonly KeyColumn[]>();
  const stack: string[] = [];
  const keyOf = (c: AnyConcept): readonly KeyColumn[] => {
    const known = keys.get(c.name);
    if (known !== undefined) return known;
    if (stack.includes(c.name)) {
      errors.push({ kind: "identity", concept: conceptId(d.name, c.name), why: "cycle" });
      return [];
    }
    stack.push(c.name);
    const out: KeyColumn[] = [];
    for (const m of c.identifiedBy) {
      const a = c.attributes[m];
      const r = c.relationships[m];
      if (a !== undefined) out.push({ name: attributeColumnWords(m, a), type: typeOf(a.type) });
      else if (r !== undefined)
        for (const k of keyOf(resolve(r.to))) out.push({ name: referenceWords(m, resolve(r.to).name, k.name), type: k.type });
    }
    stack.pop();
    keys.set(c.name, out);
    return out;
  };
  const attributeColumnWords = (key: string, a: Attribute): Words =>
    a.type.kind === "code" && openness(a.type.list) === "open" ? [...words(a.type.list.name), "code"] : words(key);
  const referencesOf = (
    key: string,
    r: Relationship,
  ): readonly { readonly name: Words; readonly target: Words; readonly type: LogicalType }[] => {
    const target = resolve(r.to);
    return keyOf(target).map((k) => ({ name: referenceWords(key, target.name, k.name), target: k.name, type: k.type }));
  };

  const tables: Table[] = [];
  const valueSets: ValueSet[] = [];
  const closedChecks = new Map<string, LogicalId[]>();

  // code lists: an open one is a table of codes, a closed one a set of values
  for (const l of d.codeLists) {
    const lid = codeListId(d.name, l.name);
    const rows: CodeRow[] = Object.entries(l.codes).map(([code, spec]) => ({
      code,
      label: spec.label,
      description: spec.definition ?? null,
    }));
    if (openness(l) === "open") {
      const name = words(l.name);
      const col = (n: string, nullable: boolean, comment: string): Column => ({
        id: columnId(name, [n]),
        from: lid,
        name: [n],
        type: { kind: "text" },
        nullable,
        comment,
        governance: [],
        role: "code",
      });
      const t: Table = {
        id: tableId(name),
        from: lid,
        name,
        comment: l.definition,
        role: "code",
        columns: [
          col("code", false, "The code other tables point to: a short word that does not change"),
          col("label", false, "What a person is shown for the code"),
          col("description", true, "What the code means, where the label is not enough"),
        ],
        primaryKey: [["code"]],
        foreignKeys: [],
        uniques: [],
        checks: [],
        indexes: [],
        rows,
        governance: l.annotations,
      };
      tables.push(t);
      carry(lid, t.id);
      for (const o of annotated(l, quality.openness.name)) express(lid, o.index, t.id);
    } else {
      const vs: ValueSet = {
        id: valueSetId(words(l.name)),
        from: lid,
        name: words(l.name),
        comment: l.definition,
        codes: rows,
        governance: l.annotations,
      };
      valueSets.push(vs);
      carry(lid, vs.id);
    }
  }

  const auditOf = (
    c: AnyConcept,
  ): { readonly element: ElementId; readonly index: number; readonly removal: "mark" | "delete" } | undefined => {
    const own = annotated(c, quality.audited.name)[0];
    if (own !== undefined)
      return { element: conceptId(d.name, c.name), index: own.index, removal: (own.value as { removal: "mark" | "delete" }).removal };
    const inherited = annotated(d, quality.audited.name)[0];
    return inherited === undefined
      ? undefined
      : { element: domainId(d.name), index: inherited.index, removal: (inherited.value as { removal: "mark" | "delete" }).removal };
  };

  const concept = (c: AnyConcept): void => {
    const cid = conceptId(d.name, c.name);
    const tname = words(c.name);
    const columns: Column[] = [];
    const foreignKeys: ForeignKey[] = [];
    const uniques: Unique[] = [];
    const checks: Check[] = [];
    const indexes: Index[] = [];
    const extra: Table[] = [];
    const columnsOfMember = new Map<string, readonly Words[]>();
    const identifying = new Set<string>(c.identifiedBy);
    const fk = (from: ElementId, cols: readonly Words[], table: Words, refs: readonly Words[]): void => {
      const name = [...tname, ...cols.flat(), "fk"];
      foreignKeys.push({ id: constraintId("fk", name), from, name, columns: cols, references: { table, columns: refs } });
    };
    const addAttribute = (key: string, a: Attribute): void => {
      const aid = attributeId(d.name, c.name, key);
      if (a.multiplicity === "many") {
        const name = [...tname, ...words(key)];
        const owner = keyOf(c).map((k) => ({ name: referenceWords(c.name, c.name, k.name), target: k.name, type: k.type }));
        const valueColumn: Column = {
          id: columnId(name, words(key)),
          from: aid,
          name: words(key),
          type: typeOf(a.type),
          nullable: false,
          comment: a.definition,
          governance: a.annotations,
          role: "attribute",
        };
        const cols: Column[] = [
          ...owner.map((o): Column => ({
            id: columnId(name, o.name),
            from: cid,
            name: o.name,
            type: o.type,
            nullable: false,
            comment: c.definition,
            governance: [],
            role: "reference",
          })),
          valueColumn,
        ];
        const pk = cols.map((x) => x.name);
        const fname = [...name, ...owner.flatMap((o) => o.name), "fk"];
        extra.push({
          id: tableId(name),
          from: aid,
          name,
          comment: a.definition,
          role: "values",
          columns: cols,
          primaryKey: pk,
          foreignKeys: [
            {
              id: constraintId("fk", fname),
              from: aid,
              name: fname,
              columns: owner.map((o) => o.name),
              references: { table: tname, columns: owner.map((o) => o.target) },
            },
          ],
          uniques: [],
          checks: [],
          indexes: [],
          governance: a.annotations,
        });
        carry(aid, tableId(name));
        return;
      }
      const name = attributeColumnWords(key, a);
      const def = annotated(a, quality.defaultValue.name)[0];
      const dflt: LogicalDefault | undefined =
        def === undefined
          ? undefined
          : a.type.kind === "code"
            ? { kind: "code", name: String(def.value) }
            : { kind: "literal", value: def.value as string | number | boolean };
      const col: Column = {
        id: columnId(tname, name),
        from: aid,
        name,
        type: typeOf(a.type),
        nullable: a.multiplicity === "optional",
        ...(dflt === undefined ? {} : { default: dflt }),
        comment: a.definition,
        governance: a.annotations,
        role: a.type.kind === "code" && openness(a.type.list) === "open" ? "reference" : "attribute",
      };
      columns.push(col);
      columnsOfMember.set(key, [name]);
      carry(aid, col.id);
      if (def !== undefined) express(aid, def.index, col.id);
      if (a.type.kind === "code") {
        const list = a.type.list;
        if (openness(list) === "open") fk(aid, [name], words(list.name), [["code"]]);
        else {
          const cname = [...tname, ...name, "ck"];
          checks.push({
            id: constraintId("ck", cname),
            from: aid,
            name: cname,
            expression: { kind: "oneOf", column: name, codes: Object.keys(list.codes) },
          });
          closedChecks.set(list.name, [...(closedChecks.get(list.name) ?? []), constraintId("ck", cname)]);
        }
      }
      for (const r of annotated(a, quality.range.name)) {
        const v = r.value as { min?: number; max?: number };
        const cname = [...tname, ...name, "range", "ck"];
        checks.push({
          id: constraintId("ck", cname),
          from: aid,
          name: cname,
          expression: {
            kind: "range",
            column: name,
            ...(v.min === undefined ? {} : { min: v.min }),
            ...(v.max === undefined ? {} : { max: v.max }),
          },
        });
        express(aid, r.index, constraintId("ck", cname));
      }
      for (const p of annotated(a, quality.pattern.name)) {
        const cname = [...tname, ...name, "pattern", "ck"];
        checks.push({
          id: constraintId("ck", cname),
          from: aid,
          name: cname,
          expression: { kind: "pattern", column: name, pattern: String(p.value) },
        });
        express(aid, p.index, constraintId("ck", cname));
      }
    };
    const addRelationship = (key: string, r: Relationship): void => {
      const rid = relationshipId(d.name, c.name, key);
      const target = resolve(r.to);
      if (r.cardinality === "many") {
        const name = [...tname, ...words(key)];
        const owner = keyOf(c).map((k) => ({ name: referenceWords(c.name, c.name, k.name), target: k.name, type: k.type }));
        const far = referencesOf(key, r);
        const cols: Column[] = [...owner, ...far].map((o): Column => ({
          id: columnId(name, o.name),
          from: rid,
          name: o.name,
          type: o.type,
          nullable: false,
          comment: r.definition,
          governance: [],
          role: "reference",
        }));
        const ownerFk = [...name, ...owner.flatMap((o) => o.name), "fk"];
        const farFk = [...name, ...far.flatMap((o) => o.name), "fk"];
        extra.push({
          id: tableId(name),
          from: rid,
          name,
          comment: r.definition,
          role: "junction",
          columns: cols,
          primaryKey: cols.map((x) => x.name),
          foreignKeys: [
            {
              id: constraintId("fk", ownerFk),
              from: rid,
              name: ownerFk,
              columns: owner.map((o) => o.name),
              references: { table: tname, columns: owner.map((o) => o.target) },
            },
            {
              id: constraintId("fk", farFk),
              from: rid,
              name: farFk,
              columns: far.map((o) => o.name),
              references: { table: words(target.name), columns: far.map((o) => o.target) },
            },
          ],
          uniques: [],
          checks: [],
          indexes: [],
          governance: r.annotations,
        });
        carry(rid, tableId(name));
        return;
      }
      const refs = referencesOf(key, r);
      const cols: Column[] = refs.map((o) => ({
        id: columnId(tname, o.name),
        from: rid,
        name: o.name,
        type: o.type,
        nullable: r.cardinality === "optional",
        comment: r.definition,
        governance: r.annotations,
        role: "reference",
      }));
      columns.push(...cols);
      columnsOfMember.set(
        key,
        cols.map((x) => x.name),
      );
      carry(rid, ...cols.map((x) => x.id));
      if (cols.length > 0)
        fk(
          rid,
          cols.map((x) => x.name),
          words(target.name),
          refs.map((x) => x.target),
        );
    };

    // the columns that identify the concept first, then the other attributes, then the other relationships
    for (const m of c.identifiedBy) {
      const a = c.attributes[m];
      const r = c.relationships[m];
      if (a !== undefined) addAttribute(m, a);
      else if (r !== undefined) addRelationship(m, r);
    }
    for (const [key, a] of Object.entries(c.attributes)) if (!identifying.has(key)) addAttribute(key, a);
    for (const [key, r] of Object.entries(c.relationships)) if (!identifying.has(key)) addRelationship(key, r);

    // what the vocabularies say of the concept
    const columnsFor = (member: string): readonly Words[] | undefined => columnsOfMember.get(member);
    const memberColumns = (member: string, why: "not-a-column" | "not-one-column", single: boolean): readonly Words[] | undefined => {
      if (!membersOf(c).includes(member)) {
        errors.push({ kind: "member", concept: cid, member, why: "unknown" });
        return undefined;
      }
      const cols = columnsFor(member);
      if (cols === undefined || cols.length === 0) {
        errors.push({ kind: "member", concept: cid, member, why: "not-a-column" });
        return undefined;
      }
      if (single && cols.length !== 1) {
        errors.push({ kind: "member", concept: cid, member, why });
        return undefined;
      }
      return cols;
    };
    for (const u of annotated(c, quality.unique.name)) {
      const cols = (u.value as { members: readonly string[] }).members.flatMap((m) => memberColumns(m, "not-a-column", false) ?? []);
      const name = [...tname, ...cols.flat(), "uq"];
      uniques.push({ id: constraintId("uq", name), from: cid, name, columns: cols });
      express(cid, u.index, constraintId("uq", name));
    }
    for (const x of annotated(c, quality.differs.name)) {
      const v = x.value as { name: string; members: readonly [string, string] };
      const pair = v.members.map((m) => memberColumns(m, "not-one-column", true)?.[0]);
      const [a, b] = pair;
      if (a === undefined || b === undefined) continue;
      const name = [...tname, ...words(v.name), "ck"];
      checks.push({ id: constraintId("ck", name), from: cid, name, expression: { kind: "differs", columns: [a, b] } });
      express(cid, x.index, constraintId("ck", name));
    }
    for (const l of annotated(c, usage.lookup.name)) {
      const cols = (l.value as { members: readonly string[] }).members.flatMap((m) => memberColumns(m, "not-a-column", false) ?? []);
      const name = [...tname, ...cols.flat(), "idx"];
      indexes.push({ id: constraintId("ix", name), from: cid, name, columns: cols });
      express(cid, l.index, constraintId("ix", name));
    }

    // the audit columns
    const audit = auditOf(c);
    if (audit !== undefined) {
      const moment = (n: Words, comment: string, nullable: boolean, now: boolean): Column => ({
        id: columnId(tname, n),
        from: audit.element,
        name: n,
        type: { kind: "timestamp", zone: true },
        nullable,
        ...(now ? { default: { kind: "now" } as const } : {}),
        comment,
        governance: [],
        role: "audit",
      });
      const who = (n: Words, comment: string): Column => ({
        id: columnId(tname, n),
        from: audit.element,
        name: n,
        type: { kind: "text" },
        nullable: true,
        comment,
        governance: [],
        role: "audit",
      });
      const made: Column[] = [
        moment(["created", "at"], "When the row was made", false, true),
        who(["created", "by"], "Who made the row"),
        moment(["updated", "at"], "When the row was last changed", true, false),
        who(["updated", "by"], "Who last changed the row"),
        ...(audit.removal === "mark"
          ? [
              moment(["deleted", "at"], "When the row was marked as removed", true, false),
              who(["deleted", "by"], "Who marked the row as removed"),
            ]
          : []),
      ];
      columns.push(...made);
      express(audit.element, audit.index, ...made.map((x) => x.id));
    }

    const t: Table = {
      id: tableId(tname),
      from: cid,
      name: tname,
      comment: c.definition,
      role: "concept",
      columns,
      primaryKey: keyOf(c).map((k) => k.name),
      foreignKeys,
      uniques,
      checks,
      indexes,
      governance: c.annotations,
    };
    tables.push(t, ...extra);
    carry(cid, t.id);
  };
  for (const c of d.concepts) concept(c);

  // names that are equal once made: two tables, two columns of a table, two constraints or indexes
  const seenTables = new Map<string, ElementId>();
  const seenConstraints = new Map<string, ElementId>();
  for (const t of tables) {
    const key = t.name.join(".");
    const first = seenTables.get(key);
    if (first !== undefined) errors.push({ kind: "collision", what: "table", name: t.name, first, second: t.from });
    else seenTables.set(key, t.from);
    const seenColumns = new Map<string, ElementId>();
    for (const c of t.columns) {
      const k = c.name.join(".");
      const f = seenColumns.get(k);
      if (f !== undefined) errors.push({ kind: "collision", what: "column", name: c.name, table: t.name, first: f, second: c.from });
      else seenColumns.set(k, c.from);
    }
    for (const x of [...t.foreignKeys, ...t.uniques, ...t.checks, ...t.indexes]) {
      const k = x.name.join(".");
      const f = seenConstraints.get(k);
      if (f !== undefined) errors.push({ kind: "collision", what: "constraint", name: x.name, table: t.name, first: f, second: x.from });
      else seenConstraints.set(k, x.from);
    }
  }
  if (errors.length > 0) return err(errors);

  // the flow: every annotation of the domain, once
  const closedOf = new Map(d.codeLists.map((l) => [codeListId(d.name, l.name), l.name]));
  const flow: FlowEntry[] = [];
  const schema = schemaId(d.name);
  for (const e of elementsOf(d)) {
    e.annotations.forEach((a, index) => {
      const key = `${e.id}|${index}`;
      const made = expressed.get(key);
      if (EXPRESSED.has(a.kind)) {
        const listName = closedOf.get(e.id);
        const ids =
          a.kind === quality.openness.name && listName !== undefined && made === undefined ? (closedChecks.get(listName) ?? []) : made;
        flow.push(
          ids === undefined
            ? {
                element: e.id,
                index,
                annotation: a.kind,
                disposition: "unexpressed",
                logical: [],
                note: "the projection knows the kind and made nothing of it",
              }
            : { element: e.id, index, annotation: a.kind, disposition: "expressed", logical: ids },
        );
      } else if (carriedKinds.has(a.kind)) {
        flow.push({
          element: e.id,
          index,
          annotation: a.kind,
          disposition: "carried",
          logical: e.kind === "domain" ? [schema] : (carriers.get(e.id) ?? []),
        });
      } else
        flow.push({
          element: e.id,
          index,
          annotation: a.kind,
          disposition: "unexpressed",
          logical: [],
          note: "the projection knows nothing of this kind",
        });
    });
  }
  return ok({
    schema: { id: schema, from: domainId(d.name), domain: d.name, comment: d.definition, tables, valueSets, governance: d.annotations },
    flow,
  });
}

/**
 * The logical schema of a domain.
 *
 * @param domain - the domain
 * @param projection - how to project it; the normalized projection where none is given
 * @returns the schema and the report of the flow, or every error of the projection
 */
export function projectDomain(domain: Domain, projection: Projection = normalized): Result<Projected, readonly ProjectionError[]> {
  return projection(domain);
}
